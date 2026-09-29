import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// AutoProcessor and CLIPVisionModelWithProjection from @xenova/transformers
let AutoProcessor: any = null;
let CLIPVisionModelWithProjection: any = null;
let RawImage: any = null;

let isModelLoaded = false;
let isModelLoading = false;
let modelLoadError: string | null = null;
let processorInstance: any = null;
let visionModelInstance: any = null;
let loadPromise: Promise<boolean> | null = null;

export const EVALUATOR_VERSION = 'clip-multisignal-v2';
export const EVALUATOR_MODEL = 'openai/clip-vit-base-patch32';

/**
 * Robust Multi-Signal Score Breakdown for Reverse Prompt Engineering Challenge.
 * Total: 80.0 points
 * 1. Overall Visual Similarity = 45 points
 * 2. Composition & Layout = 12 points
 * 3. Objects & Attributes = 10 points
 * 4. Color & Lighting = 7 points
 * 5. Image Quality = 4 points
 * 6. Fine Details = 2 points
 */
export interface MLScoreBreakdown {
  total_score: number;             // max 80.0
  semantic_similarity: number;     // max 45.0 (Overall Visual Similarity)
  semantic_score: number;          // max 45.0 (alias for backward compatibility)
  composition_score: number;       // max 12.0
  objects_score: number;           // max 10.0
  color_score: number;             // max 7.0
  image_quality_score: number;     // max 4.0
  fine_details_score: number;      // max 2.0
  details_score: number;           // max 2.0 (alias for backward compatibility)
  clip_similarity: number;         // raw cosine similarity (-1.0 to 1.0)
  calibrated_similarity_pct: number; // 0.0 to 100.0%
  evaluation_method: string;
  evaluator_version: string;
  evaluation_time_ms: number;
  evaluation_stage?: 'FIRST' | 'FINAL';
}

/**
 * Initializes and caches the CLIP ViT-B/32 vision model.
 * Uses ONNX runtime with pre-quantized weights for fast, deterministic evaluation.
 */
export async function initMLModel(): Promise<boolean> {
  if (isModelLoaded) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    isModelLoading = true;
    try {
      const transformers = await import('@xenova/transformers');
      AutoProcessor = transformers.AutoProcessor;
      CLIPVisionModelWithProjection = transformers.CLIPVisionModelWithProjection;
      RawImage = transformers.RawImage;

      // Disable remote telemetry/unnecessary downloads if cached
      transformers.env.allowRemoteModels = true;
      transformers.env.allowLocalModels = true;

      const modelId = 'Xenova/clip-vit-base-patch32';
      processorInstance = await AutoProcessor.from_pretrained(modelId);
      visionModelInstance = await CLIPVisionModelWithProjection.from_pretrained(modelId);

      isModelLoaded = true;
      modelLoadError = null;
      return true;
    } catch (err: any) {
      console.error('[ML EVALUATOR] Failed to load CLIP model:', err);
      modelLoadError = err?.message || 'Failed to load model';
      isModelLoaded = false;
      return false;
    } finally {
      isModelLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Resolves an image path from a URL, relative media path, or absolute path.
 */
export function resolveLocalImagePath(imagePathOrUrl: string, mediaDir: string): string | null {
  if (!imagePathOrUrl) return null;

  // Clean query strings or anchors
  const clean = imagePathOrUrl.split('?')[0].split('#')[0];

  // 1. Direct absolute path
  if (path.isAbsolute(clean) && fs.existsSync(clean)) {
    return clean;
  }

  // 2. /media/... path
  if (clean.startsWith('/media/')) {
    const rel = clean.substring('/media/'.length);
    const candidate = path.resolve(mediaDir, rel);
    if (fs.existsSync(candidate)) return candidate;
  }

  // 3. media/... path
  if (clean.startsWith('media/')) {
    const rel = clean.substring('media/'.length);
    const candidate = path.resolve(mediaDir, rel);
    if (fs.existsSync(candidate)) return candidate;
  }

  // 4. uploads/... or submissions/... directly inside mediaDir
  const candidateDirect = path.resolve(mediaDir, clean.replace(/^\/+/, ''));
  if (fs.existsSync(candidateDirect)) return candidateDirect;

  // 5. Try basename in uploads directory
  const base = path.basename(clean);
  const candidateUploads = path.resolve(mediaDir, 'uploads', base);
  if (fs.existsSync(candidateUploads)) return candidateUploads;

  return null;
}

/**
 * Loads an image with Sharp, sanitizing alpha channels and producing standard RGB pixel buffers.
 */
async function loadAndSanitizeImage(filePath: string): Promise<{
  width: number;
  height: number;
  aspectRatio: number;
  raw224Rgb: Uint8Array;
  resized64Rgb: Uint8Array;
  metadata: sharp.Metadata;
  stats: sharp.Stats;
}> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    throw new Error(`Image file is zero bytes (empty): ${filePath}`);
  }

  const imageSharp = sharp(filePath, { failOnError: false });
  const metadata = await imageSharp.metadata();

  if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
    throw new Error(`Corrupted or invalid image dimensions: ${filePath}`);
  }

  const width = metadata.width;
  const height = metadata.height;
  const aspectRatio = width / height;

  // 1. Standard 224x224 RGB image for CLIP ViT-B/32 with black background for transparent pixels
  const raw224 = await sharp(filePath, { failOnError: false })
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  // 2. 64x64 RGB image for fast deterministic spatial, structural, and color analysis
  const raw64 = await sharp(filePath, { failOnError: false })
    .resize(64, 64, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const stats = await imageSharp.stats();

  return {
    width,
    height,
    aspectRatio,
    raw224Rgb: new Uint8Array(raw224),
    resized64Rgb: new Uint8Array(raw64),
    metadata,
    stats,
  };
}

/**
 * Extracts 512-dimensional normalized CLIP ViT-B/32 visual embedding.
 */
async function extractClipEmbedding(raw224Rgb: Uint8Array): Promise<Float32Array> {
  const ready = await initMLModel();
  if (!ready || !processorInstance || !visionModelInstance || !RawImage) {
    throw new Error(`ML model unavailable: ${modelLoadError || 'Model not loaded'}`);
  }

  const rawImage = new RawImage(new Uint8ClampedArray(raw224Rgb), 224, 224, 3);
  const inputs = await processorInstance(rawImage);
  const outputs = await visionModelInstance(inputs);

  const rawEmbedding = outputs.image_embeds.data as Float32Array;
  const length = rawEmbedding.length; // 512

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < length; i++) {
    norm += rawEmbedding[i] * rawEmbedding[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) norm = 1e-8;

  const normalized = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    normalized[i] = rawEmbedding[i] / norm;
  }

  return normalized;
}

/**
 * Calculates cosine similarity between two L2-normalized embeddings.
 */
function computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(-1.0, Math.min(1.0, dot));
}

/**
 * Computes 128-bit Dual Difference Hash (64-bit horizontal + 64-bit vertical).
 */
function computeDualDHash(rgb64: Uint8Array): { hHash: bigint; vHash: bigint } {
  // Grayscale 9x9 grid
  const gray9x9: number[] = [];
  for (let r = 0; r < 9; r++) {
    const y = Math.floor((r / 8) * 63);
    for (let c = 0; c < 9; c++) {
      const x = Math.floor((c / 8) * 63);
      const idx = (y * 64 + x) * 3;
      const gray = 0.299 * rgb64[idx] + 0.587 * rgb64[idx + 1] + 0.114 * rgb64[idx + 2];
      gray9x9.push(gray);
    }
  }

  // 1. Horizontal gradient hash (8x8 = 64 bits)
  let hHash = 0n;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const left = gray9x9[r * 9 + c];
      const right = gray9x9[r * 9 + c + 1];
      hHash = (hHash << 1n) | (left > right ? 1n : 0n);
    }
  }

  // 2. Vertical gradient hash (8x8 = 64 bits)
  let vHash = 0n;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const top = gray9x9[r * 9 + c];
      const bottom = gray9x9[(r + 1) * 9 + c];
      vHash = (vHash << 1n) | (top > bottom ? 1n : 0n);
    }
  }

  return { hHash, vHash };
}

/**
 * Computes normalized structural similarity from dual dHashes (0 to 1).
 */
function computeDualDHashSimilarity(
  a: { hHash: bigint; vHash: bigint },
  b: { hHash: bigint; vHash: bigint }
): number {
  let diffH = a.hHash ^ b.hHash;
  let diffV = a.vHash ^ b.vHash;
  let count = 0;
  while (diffH > 0n) {
    if (diffH & 1n) count++;
    diffH >>= 1n;
  }
  while (diffV > 0n) {
    if (diffV & 1n) count++;
    diffV >>= 1n;
  }
  return Math.max(0, 1.0 - count / 128);
}

/**
 * Computes Perceptual Structural Similarity (SSIM-like) across an 8x8 block grid (64 sub-blocks).
 */
function computePerceptualSSIM(rgb1: Uint8Array, rgb2: Uint8Array): number {
  const c1 = 6.5025;   // (0.01 * 255)^2
  const c2 = 58.5225;  // (0.03 * 255)^2
  const blockSize = 8; // 64 / 8
  const pixelsPerBlock = 64;

  let ssimSum = 0;

  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      let sum1 = 0;
      let sum2 = 0;

      for (let py = 0; py < blockSize; py++) {
        for (let px = 0; px < blockSize; px++) {
          const x = bx * blockSize + px;
          const y = by * blockSize + py;
          const idx = (y * 64 + x) * 3;

          const l1 = 0.299 * rgb1[idx] + 0.587 * rgb1[idx + 1] + 0.114 * rgb1[idx + 2];
          const l2 = 0.299 * rgb2[idx] + 0.587 * rgb2[idx + 1] + 0.114 * rgb2[idx + 2];

          sum1 += l1;
          sum2 += l2;
        }
      }

      const mu1 = sum1 / pixelsPerBlock;
      const mu2 = sum2 / pixelsPerBlock;

      let var1 = 0;
      let var2 = 0;
      let covar = 0;

      for (let py = 0; py < blockSize; py++) {
        for (let px = 0; px < blockSize; px++) {
          const x = bx * blockSize + px;
          const y = by * blockSize + py;
          const idx = (y * 64 + x) * 3;

          const l1 = 0.299 * rgb1[idx] + 0.587 * rgb1[idx + 1] + 0.114 * rgb1[idx + 2];
          const l2 = 0.299 * rgb2[idx] + 0.587 * rgb2[idx + 1] + 0.114 * rgb2[idx + 2];

          const diff1 = l1 - mu1;
          const diff2 = l2 - mu2;

          var1 += diff1 * diff1;
          var2 += diff2 * diff2;
          covar += diff1 * diff2;
        }
      }

      const s1 = var1 / pixelsPerBlock;
      const s2 = var2 / pixelsPerBlock;
      const s12 = covar / pixelsPerBlock;

      const num = (2 * mu1 * mu2 + c1) * (2 * s12 + c2);
      const den = (mu1 * mu1 + mu2 * mu2 + c1) * (s1 + s2 + c2);

      const blockSsim = den > 0 ? num / den : 1.0;
      ssimSum += Math.max(0, Math.min(1.0, blockSsim));
    }
  }

  return Math.max(0, Math.min(1.0, ssimSum / 64));
}

/**
 * Computes Dense Spatial Patch Appearance Similarity (4x4 regions = 16 spatial tiles).
 */
function computePatchAppearanceSimilarity(rgb1: Uint8Array, rgb2: Uint8Array): number {
  const tileSize = 16; // 64 / 4
  const pixelsPerTile = 256;
  let tileSimSum = 0;

  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      let r1 = 0, g1 = 0, b1 = 0;
      let r2 = 0, g2 = 0, b2 = 0;

      for (let py = 0; py < tileSize; py++) {
        for (let px = 0; px < tileSize; px++) {
          const x = tx * tileSize + px;
          const y = ty * tileSize + py;
          const idx = (y * 64 + x) * 3;

          r1 += rgb1[idx];
          g1 += rgb1[idx + 1];
          b1 += rgb1[idx + 2];

          r2 += rgb2[idx];
          g2 += rgb2[idx + 1];
          b2 += rgb2[idx + 2];
        }
      }

      const mR1 = r1 / pixelsPerTile, mG1 = g1 / pixelsPerTile, mB1 = b1 / pixelsPerTile;
      const mR2 = r2 / pixelsPerTile, mG2 = g2 / pixelsPerTile, mB2 = b2 / pixelsPerTile;

      const diffDist = Math.sqrt(
        (mR1 - mR2) ** 2 +
        (mG1 - mG2) ** 2 +
        (mB1 - mB2) ** 2
      );

      const maxDist = 441.67; // sqrt(255^2 * 3)
      tileSimSum += Math.max(0, 1.0 - diffDist / maxDist);
    }
  }

  return tileSimSum / 16;
}

/**
 * Computes Spatial Composition Similarity (Aspect Ratio, Spatial Grid, Center of Mass, Foreground/Background).
 */
function computeCompositionSimilarity(
  ar1: number,
  ar2: number,
  rgb1: Uint8Array,
  rgb2: Uint8Array
): number {
  // 1. Aspect ratio similarity
  const maxAr = Math.max(ar1, ar2, 0.001);
  const arDiff = Math.abs(ar1 - ar2);
  const aspectSim = Math.max(0, 1.0 - Math.min(1.0, arDiff / maxAr));

  // 2. 4x4 Spatial luminance distribution
  let spatialDiffSum = 0;
  const cellSize = 16; // 64 / 4
  let mass1X = 0, mass1Y = 0, totalMass1 = 0;
  let mass2X = 0, mass2Y = 0, totalMass2 = 0;

  // Foreground (central 32x32) vs Background (border)
  let centerLum1 = 0, borderLum1 = 0, centerCount1 = 0, borderCount1 = 0;
  let centerLum2 = 0, borderLum2 = 0, centerCount2 = 0, borderCount2 = 0;

  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      let lum1 = 0;
      let lum2 = 0;
      let count = 0;

      for (let cy = 0; cy < cellSize; cy++) {
        for (let cx = 0; cx < cellSize; cx++) {
          const px = gx * cellSize + cx;
          const py = gy * cellSize + cy;
          const idx = (py * 64 + px) * 3;

          const l1 = 0.299 * rgb1[idx] + 0.587 * rgb1[idx + 1] + 0.114 * rgb1[idx + 2];
          const l2 = 0.299 * rgb2[idx] + 0.587 * rgb2[idx + 1] + 0.114 * rgb2[idx + 2];

          lum1 += l1;
          lum2 += l2;
          count++;

          mass1X += px * l1;
          mass1Y += py * l1;
          totalMass1 += l1;

          mass2X += px * l2;
          mass2Y += py * l2;
          totalMass2 += l2;

          // Central vs border classification
          if (px >= 16 && px < 48 && py >= 16 && py < 48) {
            centerLum1 += l1;
            centerCount1++;
            centerLum2 += l2;
            centerCount2++;
          } else {
            borderLum1 += l1;
            borderCount1++;
            borderLum2 += l2;
            borderCount2++;
          }
        }
      }

      const mean1 = lum1 / count;
      const mean2 = lum2 / count;
      spatialDiffSum += Math.abs(mean1 - mean2) / 255;
    }
  }

  const meanSpatialDiff = spatialDiffSum / 16;
  const spatialGridSim = Math.max(0, 1.0 - meanSpatialDiff * 1.8);

  // 3. Center of visual mass
  const c1X = totalMass1 > 0 ? mass1X / totalMass1 / 64 : 0.5;
  const c1Y = totalMass1 > 0 ? mass1Y / totalMass1 / 64 : 0.5;
  const c2X = totalMass2 > 0 ? mass2X / totalMass2 / 64 : 0.5;
  const c2Y = totalMass2 > 0 ? mass2Y / totalMass2 / 64 : 0.5;

  const centroidDist = Math.sqrt((c1X - c2X) ** 2 + (c1Y - c2Y) ** 2);
  const centroidSim = Math.max(0, 1.0 - centroidDist * 1.5);

  // 4. Foreground / Background structure
  const fgBgRatio1 = borderLum1 > 0 ? (centerLum1 / centerCount1) / (borderLum1 / borderCount1) : 1.0;
  const fgBgRatio2 = borderLum2 > 0 ? (centerLum2 / centerCount2) / (borderLum2 / borderCount2) : 1.0;
  const fgBgDiff = Math.abs(fgBgRatio1 - fgBgRatio2);
  const fgBgSim = Math.max(0, 1.0 - Math.min(1.0, fgBgDiff / Math.max(fgBgRatio1, fgBgRatio2, 0.5)));

  return 0.20 * aspectSim + 0.40 * spatialGridSim + 0.20 * centroidSim + 0.20 * fgBgSim;
}

/**
 * Computes Objects & Attributes Similarity (Edge Orientation Histograms, Salient Region Overlap, Shape DHash).
 */
function computeObjectsSimilarity(
  rgb1: Uint8Array,
  rgb2: Uint8Array,
  calibratedStructSim: number
): number {
  // 1. Edge orientation histogram (8 directional bins)
  const bins1 = new Float32Array(8);
  const bins2 = new Float32Array(8);
  let totalEdge1 = 0;
  let totalEdge2 = 0;

  // Track salient region energy in a 4x4 grid
  const salientGrid1 = new Float32Array(16);
  const salientGrid2 = new Float32Array(16);

  for (let y = 1; y < 63; y++) {
    const gy = Math.floor(y / 16);
    for (let x = 1; x < 63; x++) {
      const gx = Math.floor(x / 16);
      const gridIdx = gy * 4 + gx;

      // Sobel gradient approximation
      const idxL = (y * 64 + (x - 1)) * 3;
      const idxR = (y * 64 + (x + 1)) * 3;
      const idxT = ((y - 1) * 64 + x) * 3;
      const idxB = ((y + 1) * 64 + x) * 3;

      const lumL1 = 0.299 * rgb1[idxL] + 0.587 * rgb1[idxL + 1] + 0.114 * rgb1[idxL + 2];
      const lumR1 = 0.299 * rgb1[idxR] + 0.587 * rgb1[idxR + 1] + 0.114 * rgb1[idxR + 2];
      const lumT1 = 0.299 * rgb1[idxT] + 0.587 * rgb1[idxT + 1] + 0.114 * rgb1[idxT + 2];
      const lumB1 = 0.299 * rgb1[idxB] + 0.587 * rgb1[idxB + 1] + 0.114 * rgb1[idxB + 2];

      const dx1 = lumR1 - lumL1;
      const dy1 = lumB1 - lumT1;
      const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

      if (mag1 > 10) {
        totalEdge1 += mag1;
        salientGrid1[gridIdx] += mag1;
        const angle1 = (Math.atan2(dy1, dx1) + Math.PI) / (2 * Math.PI); // [0, 1)
        const b1 = Math.floor(angle1 * 8) % 8;
        bins1[b1] += mag1;
      }

      const lumL2 = 0.299 * rgb2[idxL] + 0.587 * rgb2[idxL + 1] + 0.114 * rgb2[idxL + 2];
      const lumR2 = 0.299 * rgb2[idxR] + 0.587 * rgb2[idxR + 1] + 0.114 * rgb2[idxR + 2];
      const lumT2 = 0.299 * rgb2[idxT] + 0.587 * rgb2[idxT + 1] + 0.114 * rgb2[idxT + 2];
      const lumB2 = 0.299 * rgb2[idxB] + 0.587 * rgb2[idxB + 1] + 0.114 * rgb2[idxB + 2];

      const dx2 = lumR2 - lumL2;
      const dy2 = lumB2 - lumT2;
      const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (mag2 > 10) {
        totalEdge2 += mag2;
        salientGrid2[gridIdx] += mag2;
        const angle2 = (Math.atan2(dy2, dx2) + Math.PI) / (2 * Math.PI);
        const b2 = Math.floor(angle2 * 8) % 8;
        bins2[b2] += mag2;
      }
    }
  }

  // Normalize orientation histograms and compute intersection
  let orientationIntersection = 0;
  if (totalEdge1 > 0 && totalEdge2 > 0) {
    for (let b = 0; b < 8; b++) {
      orientationIntersection += Math.min(bins1[b] / totalEdge1, bins2[b] / totalEdge2);
    }
  } else if (totalEdge1 === 0 && totalEdge2 === 0) {
    orientationIntersection = 1.0;
  }

  // 2. Salient Object Region Match
  let salientIntersection = 0;
  if (totalEdge1 > 0 && totalEdge2 > 0) {
    for (let g = 0; g < 16; g++) {
      salientIntersection += Math.min(salientGrid1[g] / totalEdge1, salientGrid2[g] / totalEdge2);
    }
  } else if (totalEdge1 === 0 && totalEdge2 === 0) {
    salientIntersection = 1.0;
  }

  return 0.40 * orientationIntersection + 0.35 * salientIntersection + 0.25 * calibratedStructSim;
}

/**
 * Computes Color & Lighting Similarity (3D Color Histogram, Luminance, Contrast, Saturation, Directional Lighting).
 */
function computeColorSimilarity(rgb1: Uint8Array, rgb2: Uint8Array): number {
  // 512-bin quantized RGB histogram (8 bins per channel: 8x8x8)
  const hist1 = new Float32Array(512);
  const hist2 = new Float32Array(512);
  const numPixels = 64 * 64;

  let lumSum1 = 0, lumSum2 = 0;
  let satSum1 = 0, satSum2 = 0;
  let topLum1 = 0, btmLum1 = 0;
  let topLum2 = 0, btmLum2 = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 3;
    const y = Math.floor(i / 64);
    const r1 = rgb1[idx], g1 = rgb1[idx + 1], b1 = rgb1[idx + 2];
    const r2 = rgb2[idx], g2 = rgb2[idx + 1], b2 = rgb2[idx + 2];

    const bin1 = (Math.floor(r1 / 32) << 6) | (Math.floor(g1 / 32) << 3) | Math.floor(b1 / 32);
    const bin2 = (Math.floor(r2 / 32) << 6) | (Math.floor(g2 / 32) << 3) | Math.floor(b2 / 32);

    hist1[bin1]++;
    hist2[bin2]++;

    // Luminance
    const l1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
    const l2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
    lumSum1 += l1;
    lumSum2 += l2;

    if (y < 32) {
      topLum1 += l1;
      topLum2 += l2;
    } else {
      btmLum1 += l1;
      btmLum2 += l2;
    }

    // Saturation = (max - min) / max
    const max1 = Math.max(r1, g1, b1);
    const min1 = Math.min(r1, g1, b1);
    satSum1 += max1 > 0 ? (max1 - min1) / max1 : 0;

    const max2 = Math.max(r2, g2, b2);
    const min2 = Math.min(r2, g2, b2);
    satSum2 += max2 > 0 ? (max2 - min2) / max2 : 0;
  }

  // 1. Histogram intersection
  let histIntersection = 0;
  for (let b = 0; b < 512; b++) {
    hist1[b] /= numPixels;
    hist2[b] /= numPixels;
    histIntersection += Math.min(hist1[b], hist2[b]);
  }

  // 2. Mean Luminance & Contrast
  const meanLum1 = lumSum1 / numPixels;
  const meanLum2 = lumSum2 / numPixels;
  const lumSim = Math.max(0, 1.0 - Math.abs(meanLum1 - meanLum2) / 255);

  let varLum1 = 0, varLum2 = 0;
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 3;
    const l1 = 0.299 * rgb1[idx] + 0.587 * rgb1[idx + 1] + 0.114 * rgb1[idx + 2];
    const l2 = 0.299 * rgb2[idx] + 0.587 * rgb2[idx + 1] + 0.114 * rgb2[idx + 2];
    varLum1 += (l1 - meanLum1) ** 2;
    varLum2 += (l2 - meanLum2) ** 2;
  }
  const std1 = Math.sqrt(varLum1 / numPixels);
  const std2 = Math.sqrt(varLum2 / numPixels);
  const contrastSim = Math.max(0, 1.0 - Math.abs(std1 - std2) / Math.max(std1, std2, 10));

  // 3. Saturation similarity
  const meanSat1 = satSum1 / numPixels;
  const meanSat2 = satSum2 / numPixels;
  const satSim = Math.max(0, 1.0 - Math.abs(meanSat1 - meanSat2));

  // 4. Directional lighting gradient (top vs bottom)
  const grad1 = (topLum1 - btmLum1) / (numPixels / 2);
  const grad2 = (topLum2 - btmLum2) / (numPixels / 2);
  const lightingDirSim = Math.max(0, 1.0 - Math.abs(grad1 - grad2) / 255);

  return 0.45 * histIntersection + 0.25 * lumSim + 0.15 * contrastSim + 0.15 * (0.5 * satSim + 0.5 * lightingDirSim);
}

/**
 * Computes Candidate Image Quality (Sharpness, Dynamic Range, Severe Blur/Corruption detection).
 * Max: 4.0 points.
 * Note: Sharpness remains a secondary factor so high-quality unrelated images never score high.
 */
function computeImageQuality(
  candidateRgb: Uint8Array,
  w: number,
  h: number
): number {
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;
  let extremeBlackCount = 0;
  let extremeWhiteCount = 0;

  for (let y = 1; y < 63; y++) {
    for (let x = 1; x < 63; x++) {
      const idx = (y * 64 + x) * 3;
      const idxT = ((y - 1) * 64 + x) * 3;
      const idxB = ((y + 1) * 64 + x) * 3;
      const idxL = (y * 64 + (x - 1)) * 3;
      const idxR = (y * 64 + (x + 1)) * 3;

      const c = 0.299 * candidateRgb[idx] + 0.587 * candidateRgb[idx + 1] + 0.114 * candidateRgb[idx + 2];
      const t = 0.299 * candidateRgb[idxT] + 0.587 * candidateRgb[idxT + 1] + 0.114 * candidateRgb[idxT + 2];
      const b = 0.299 * candidateRgb[idxB] + 0.587 * candidateRgb[idxB + 1] + 0.114 * candidateRgb[idxB + 2];
      const l = 0.299 * candidateRgb[idxL] + 0.587 * candidateRgb[idxL + 1] + 0.114 * candidateRgb[idxL + 2];
      const r = 0.299 * candidateRgb[idxR] + 0.587 * candidateRgb[idxR + 1] + 0.114 * candidateRgb[idxR + 2];

      const lap = 4 * c - t - b - l - r;
      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      count++;

      if (c <= 2) extremeBlackCount++;
      if (c >= 253) extremeWhiteCount++;
    }
  }

  // Laplacian variance (measure of focus & edge clarity)
  const meanLap = laplacianSum / count;
  const lapVar = Math.max(0, laplacianSqSum / count - meanLap * meanLap);

  // Normal clean photos/generations typically have lapVar ~ 150-500.
  // Severe blur has lapVar < 25.
  const sharpnessRatio = Math.min(1.0, Math.sqrt(lapVar / 180.0));

  // Dynamic range / clipping sanity (penalize extreme solid saturation)
  const extremeRatio = (extremeBlackCount + extremeWhiteCount) / count;
  const dynamicRangeScore = Math.max(0, 1.0 - Math.max(0, (extremeRatio - 0.40) * 1.6));

  // Resolution adequacy
  const resRatio = Math.min(1.0, Math.sqrt((w * h) / (256 * 256)));

  return 0.55 * sharpnessRatio + 0.30 * dynamicRangeScore + 0.15 * resRatio;
}

/**
 * Computes Fine Details Similarity (High-Frequency Details, Texture Variance).
 * Max: 2.0 points.
 */
function computeFineDetailsSimilarity(
  rgb1: Uint8Array,
  rgb2: Uint8Array
): number {
  let edgeEnergy1 = 0;
  let edgeEnergy2 = 0;
  let localDiff1 = 0;
  let localDiff2 = 0;

  for (let y = 0; y < 63; y++) {
    for (let x = 0; x < 63; x++) {
      const idx = (y * 64 + x) * 3;
      const idxR = idx + 3;
      const idxD = ((y + 1) * 64 + x) * 3;

      const l1 = 0.299 * rgb1[idx] + 0.587 * rgb1[idx + 1] + 0.114 * rgb1[idx + 2];
      const l1R = 0.299 * rgb1[idxR] + 0.587 * rgb1[idxR + 1] + 0.114 * rgb1[idxR + 2];
      const l1D = 0.299 * rgb1[idxD] + 0.587 * rgb1[idxD + 1] + 0.114 * rgb1[idxD + 2];

      const l2 = 0.299 * rgb2[idx] + 0.587 * rgb2[idx + 1] + 0.114 * rgb2[idx + 2];
      const l2R = 0.299 * rgb2[idxR] + 0.587 * rgb2[idxR + 1] + 0.114 * rgb2[idxR + 2];
      const l2D = 0.299 * rgb2[idxD] + 0.587 * rgb2[idxD + 1] + 0.114 * rgb2[idxD + 2];

      const d1 = Math.abs(l1 - l1R) + Math.abs(l1 - l1D);
      const d2 = Math.abs(l2 - l2R) + Math.abs(l2 - l2D);

      edgeEnergy1 += d1;
      edgeEnergy2 += d2;

      localDiff1 += (d1 - d2) ** 2;
    }
  }

  const maxEnergy = Math.max(edgeEnergy1, edgeEnergy2, 1e-5);
  const edgeRatio = Math.min(edgeEnergy1, edgeEnergy2) / maxEnergy;

  const rmsDiff = Math.sqrt(localDiff1 / (63 * 63));
  const textureSim = Math.max(0, 1.0 - rmsDiff / 80.0);

  return 0.60 * edgeRatio + 0.40 * textureSim;
}

/**
 * Master Evaluation Function: Evaluates a candidate image against the authoritative target image.
 * Produces a reproducible, defensible similarity score strictly out of 80 points.
 *
 * NEW SCORING DISTRIBUTION:
 * 1. Overall Visual Similarity = 45 points
 * 2. Composition & Layout = 12 points
 * 3. Objects & Attributes = 10 points
 * 4. Color & Lighting = 7 points
 * 5. Image Quality = 4 points
 * 6. Fine Details = 2 points
 * TOTAL = 80 points
 */
export async function evaluateTargetVsCandidate(
  targetImagePath: string,
  candidateImagePath: string,
  options?: {
    stage?: 'FIRST' | 'FINAL';
  }
): Promise<MLScoreBreakdown> {
  const startTime = Date.now();

  // Validate existence of files
  if (!fs.existsSync(targetImagePath)) {
    throw new Error(`Authoritative target image file not found at: ${targetImagePath}`);
  }
  if (!fs.existsSync(candidateImagePath)) {
    throw new Error(`Submitted candidate image file not found at: ${candidateImagePath}`);
  }

  // Load and sanitize images identically
  const targetData = await loadAndSanitizeImage(targetImagePath);
  const candidateData = await loadAndSanitizeImage(candidateImagePath);

  // Extract CLIP ViT-B/32 embeddings
  const targetEmbedding = await extractClipEmbedding(targetData.raw224Rgb);
  const candidateEmbedding = await extractClipEmbedding(candidateData.raw224Rgb);

  // 1. Raw CLIP Cosine Similarity [-1.0, 1.0]
  const rawCosine = computeCosineSimilarity(targetEmbedding, candidateEmbedding);

  // Calibrated Semantic Similarity:
  // Empirical CLIP ViT-B/32 image-to-image cosine similarity ranges from ~0.65 (unrelated images)
  // to 1.00 (identical image). Values <= 0.65 represent zero visual correlation.
  const MIN_CLIP_BASELINE = 0.65;
  let calibratedRatio = 0.0;
  if (rawCosine > MIN_CLIP_BASELINE) {
    const normRange = (rawCosine - MIN_CLIP_BASELINE) / (1.0 - MIN_CLIP_BASELINE);
    calibratedRatio = Math.pow(Math.max(0.0, Math.min(1.0, normRange)), 1.25);
  }
  calibratedRatio = Math.max(0.0, Math.min(1.0, calibratedRatio));

  // Multi-signal structural & perceptual analysis
  const dHashTarget = computeDualDHash(targetData.resized64Rgb);
  const dHashCandidate = computeDualDHash(candidateData.resized64Rgb);
  const rawDHashSim = computeDualDHashSimilarity(dHashTarget, dHashCandidate);
  const calibratedStructSim = Math.max(0.0, Math.min(1.0, (rawDHashSim - 0.50) / 0.50));

  const perceptualSsim = computePerceptualSSIM(targetData.resized64Rgb, candidateData.resized64Rgb);
  const patchAppearance = computePatchAppearanceSimilarity(targetData.resized64Rgb, candidateData.resized64Rgb);

  // ----------------------------------------------------------------------------------------
  // CATEGORY 1: Overall Visual Similarity (Max: 45.0 points)
  // Dominant factor combining global semantic embedding, perceptual SSIM, patch appearance, and dHash
  // ----------------------------------------------------------------------------------------
  const overallSimilarityRatio =
    0.45 * calibratedRatio +
    0.25 * perceptualSsim +
    0.15 * patchAppearance +
    0.15 * calibratedStructSim;
  const semantic_similarity = Math.round(Math.max(0.0, Math.min(45.0, overallSimilarityRatio * 45.0)) * 100) / 100;
  const semantic_score = semantic_similarity; // backward compatibility

  // ----------------------------------------------------------------------------------------
  // CATEGORY 2: Composition & Layout (Max: 12.0 points)
  // Evaluates framing, aspect ratio, spatial layout, centroid, and foreground/background structure
  // ----------------------------------------------------------------------------------------
  const compRatio = computeCompositionSimilarity(
    targetData.aspectRatio,
    candidateData.aspectRatio,
    targetData.resized64Rgb,
    candidateData.resized64Rgb
  );
  const composition_score = Math.round(Math.max(0.0, Math.min(12.0, compRatio * 12.0)) * 100) / 100;

  // ----------------------------------------------------------------------------------------
  // CATEGORY 3: Objects & Attributes (Max: 10.0 points)
  // Evaluates edge orientations, salient object region presence, and dual structural pattern
  // ----------------------------------------------------------------------------------------
  const objRatio = computeObjectsSimilarity(
    targetData.resized64Rgb,
    candidateData.resized64Rgb,
    calibratedStructSim
  );
  const objects_score = Math.round(Math.max(0.0, Math.min(10.0, objRatio * 10.0)) * 100) / 100;

  // ----------------------------------------------------------------------------------------
  // CATEGORY 4: Color & Lighting (Max: 7.0 points)
  // Evaluates 512-bin 3D RGB color histogram, luminance, contrast, saturation, lighting direction
  // ----------------------------------------------------------------------------------------
  const colorRatio = computeColorSimilarity(targetData.resized64Rgb, candidateData.resized64Rgb);
  const color_score = Math.round(Math.max(0.0, Math.min(7.0, colorRatio * 7.0)) * 100) / 100;

  // ----------------------------------------------------------------------------------------
  // CATEGORY 5: Image Quality (Max: 4.0 points)
  // Evaluates sharpness, dynamic range, and resolution adequacy
  // (Secondary factor so sharp but visually incorrect images never score high overall)
  // ----------------------------------------------------------------------------------------
  const qualityRatio = computeImageQuality(
    candidateData.resized64Rgb,
    candidateData.width,
    candidateData.height
  );
  const image_quality_score = Math.round(Math.max(0.0, Math.min(4.0, qualityRatio * 4.0)) * 100) / 100;

  // ----------------------------------------------------------------------------------------
  // CATEGORY 6: Fine Details (Max: 2.0 points)
  // Evaluates small objects, edge energy density, and local texture patterns
  // ----------------------------------------------------------------------------------------
  const detailRatio = computeFineDetailsSimilarity(
    targetData.resized64Rgb,
    candidateData.resized64Rgb
  );
  const fine_details_score = Math.round(Math.max(0.0, Math.min(2.0, detailRatio * 2.0)) * 100) / 100;
  const details_score = fine_details_score; // backward compatibility

  // ----------------------------------------------------------------------------------------
  // FINAL TOTAL SCORE: Strict sum bounded between 0.00 and 80.00
  // 45 + 12 + 10 + 7 + 4 + 2 = 80.00
  // ----------------------------------------------------------------------------------------
  const rawTotal =
    semantic_similarity +
    composition_score +
    objects_score +
    color_score +
    image_quality_score +
    fine_details_score;
  const total_score = Math.round(Math.max(0.0, Math.min(80.0, rawTotal)) * 100) / 100;

  const elapsedTime = Date.now() - startTime;

  return {
    total_score,
    semantic_similarity,
    semantic_score,
    composition_score,
    objects_score,
    color_score,
    image_quality_score,
    fine_details_score,
    details_score,
    clip_similarity: Math.round(rawCosine * 10000) / 10000,
    calibrated_similarity_pct: Math.round(overallSimilarityRatio * 10000) / 100,
    evaluation_method: 'CLIP ViT-B/32 + Multi-Signal Vision (Calibrated)',
    evaluator_version: EVALUATOR_VERSION,
    evaluation_time_ms: elapsedTime,
    evaluation_stage: options?.stage,
  };
}
