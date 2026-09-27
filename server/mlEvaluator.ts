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

export const EVALUATOR_VERSION = 'clip-calibrated-v1';
export const EVALUATOR_MODEL = 'openai/clip-vit-base-patch32';

export interface MLScoreBreakdown {
  semantic_score: number;      // max 32
  composition_score: number;   // max 20
  objects_score: number;       // max 16
  color_score: number;         // max 8
  details_score: number;       // max 4
  total_score: number;         // max 80
  clip_similarity: number;     // raw cosine similarity (-1.0 to 1.0)
  calibrated_similarity_pct: number; // 0.0 to 100.0%
  evaluation_method: string;
  evaluator_version: string;
  evaluation_time_ms: number;
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

  // 2. 64x64 RGB image for fast deterministic spatial and color analysis
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
 * Computes 64-bit difference hash (dHash) for visual structural comparison.
 */
function computeDHash(rgb64: Uint8Array): bigint {
  // Sample an 9x8 grayscale grid from the 64x64 buffer
  const gray9x8: number[] = [];
  for (let row = 0; row < 8; row++) {
    const y = Math.floor((row / 8) * 64);
    for (let col = 0; col < 9; col++) {
      const x = Math.floor((col / 9) * 64);
      const idx = (y * 64 + x) * 3;
      // Perceptual grayscale: 0.299*R + 0.587*G + 0.114*B
      const gray = 0.299 * rgb64[idx] + 0.587 * rgb64[idx + 1] + 0.114 * rgb64[idx + 2];
      gray9x8.push(gray);
    }
  }

  let hash = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = gray9x8[row * 9 + col];
      const right = gray9x8[row * 9 + col + 1];
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

/**
 * Computes normalized structural similarity (0 to 1) from two dHashes.
 */
function computeDHashSimilarity(hash1: bigint, hash2: bigint): number {
  let diff = hash1 ^ hash2;
  let count = 0;
  while (diff > 0n) {
    if (diff & 1n) count++;
    diff >>= 1n;
  }
  return Math.max(0, 1.0 - count / 64);
}

/**
 * Computes spatial composition similarity using aspect ratio, visual mass, and 4x4 spatial grid.
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

  return 0.35 * aspectSim + 0.45 * spatialGridSim + 0.20 * centroidSim;
}

/**
 * Computes 3D color histogram and lighting similarity.
 */
function computeColorSimilarity(rgb1: Uint8Array, rgb2: Uint8Array): number {
  // 512-bin quantized RGB histogram (8 bins per channel: 8x8x8)
  const hist1 = new Float32Array(512);
  const hist2 = new Float32Array(512);
  const numPixels = 64 * 64;

  let lumSum1 = 0, lumSum2 = 0;
  let satSum1 = 0, satSum2 = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 3;
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

    // Saturation = (max - min) / max
    const max1 = Math.max(r1, g1, b1);
    const min1 = Math.min(r1, g1, b1);
    satSum1 += max1 > 0 ? (max1 - min1) / max1 : 0;

    const max2 = Math.max(r2, g2, b2);
    const min2 = Math.min(r2, g2, b2);
    satSum2 += max2 > 0 ? (max2 - min2) / max2 : 0;
  }

  // Normalize histograms and compute histogram intersection
  let histIntersection = 0;
  for (let b = 0; b < 512; b++) {
    hist1[b] /= numPixels;
    hist2[b] /= numPixels;
    histIntersection += Math.min(hist1[b], hist2[b]);
  }

  const meanLum1 = lumSum1 / numPixels;
  const meanLum2 = lumSum2 / numPixels;
  const lumSim = Math.max(0, 1.0 - Math.abs(meanLum1 - meanLum2) / 255);

  const meanSat1 = satSum1 / numPixels;
  const meanSat2 = satSum2 / numPixels;
  const satSim = Math.max(0, 1.0 - Math.abs(meanSat1 - meanSat2));

  return 0.50 * histIntersection + 0.25 * lumSim + 0.25 * satSim;
}

/**
 * Computes high-frequency detail and edge energy similarity.
 */
function computeDetailSimilarity(
  rgb1: Uint8Array,
  rgb2: Uint8Array,
  w1: number,
  h1: number,
  w2: number,
  h2: number
): number {
  // Estimate edge energy via horizontal and vertical luminance variance
  let energy1 = 0;
  let energy2 = 0;

  for (let y = 0; y < 63; y++) {
    for (let x = 0; x < 63; x++) {
      const idx = (y * 64 + x) * 3;
      const idxRight = idx + 3;
      const idxDown = ((y + 1) * 64 + x) * 3;

      const l1 = 0.299 * rgb1[idx] + 0.587 * rgb1[idx + 1] + 0.114 * rgb1[idx + 2];
      const l1R = 0.299 * rgb1[idxRight] + 0.587 * rgb1[idxRight + 1] + 0.114 * rgb1[idxRight + 2];
      const l1D = 0.299 * rgb1[idxDown] + 0.587 * rgb1[idxDown + 1] + 0.114 * rgb1[idxDown + 2];
      energy1 += Math.abs(l1 - l1R) + Math.abs(l1 - l1D);

      const l2 = 0.299 * rgb2[idx] + 0.587 * rgb2[idx + 1] + 0.114 * rgb2[idx + 2];
      const l2R = 0.299 * rgb2[idxRight] + 0.587 * rgb2[idxRight + 1] + 0.114 * rgb2[idxRight + 2];
      const l2D = 0.299 * rgb2[idxDown] + 0.587 * rgb2[idxDown + 1] + 0.114 * rgb2[idxDown + 2];
      energy2 += Math.abs(l2 - l2R) + Math.abs(l2 - l2D);
    }
  }

  const maxEnergy = Math.max(energy1, energy2, 1e-6);
  const edgeSim = Math.min(energy1, energy2) / maxEnergy;

  const res1 = w1 * h1;
  const res2 = w2 * h2;
  const resSim = Math.min(res1, res2) / Math.max(res1, res2, 1);

  return 0.70 * edgeSim + 0.30 * Math.sqrt(resSim);
}

/**
 * Master Evaluation Function: Evaluates a candidate image against the authoritative target image.
 * Produces a reproducible, defensible similarity score out of 80 points.
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
  // Empirical CLIP ViT-B/32 image-to-image cosine similarity ranges from ~0.70 (unrelated images)
  // to 1.00 (identical image). Values <= 0.70 represent zero visual correlation.
  const MIN_CLIP_BASELINE = 0.70;
  let calibratedRatio = 0.0;
  if (rawCosine > MIN_CLIP_BASELINE) {
    const normRange = (rawCosine - MIN_CLIP_BASELINE) / (1.0 - MIN_CLIP_BASELINE);
    calibratedRatio = Math.pow(Math.max(0.0, Math.min(1.0, normRange)), 1.2);
  }
  calibratedRatio = Math.max(0.0, Math.min(1.0, calibratedRatio));

  // Category 1: Semantic / Overall Similarity (Max: 32)
  const semanticScoreRaw = calibratedRatio * 32.0;
  const semantic_score = Math.round(Math.max(0.0, Math.min(32.0, semanticScoreRaw)) * 100) / 100;

  // Category 2: Composition / Layout (Max: 20)
  const compRatio = computeCompositionSimilarity(
    targetData.aspectRatio,
    candidateData.aspectRatio,
    targetData.resized64Rgb,
    candidateData.resized64Rgb
  );
  const compScoreRaw = compRatio * 20.0;
  const composition_score = Math.round(Math.max(0.0, Math.min(20.0, compScoreRaw)) * 100) / 100;

  // Category 3: Objects / Attributes (Max: 16)
  // Combines calibrated difference hash (structural gradient pattern) and calibrated visual correlation
  const dHashTarget = computeDHash(targetData.resized64Rgb);
  const dHashCandidate = computeDHash(candidateData.resized64Rgb);
  const rawDHashSim = computeDHashSimilarity(dHashTarget, dHashCandidate);
  // Random unrelated images have expected Hamming distance of 32/64 bits (raw similarity 0.50).
  // Calibrate 0.50 -> 0.0 and 1.00 -> 1.0.
  const calibratedStructSim = Math.max(0.0, Math.min(1.0, (rawDHashSim - 0.50) / 0.50));
  const objRatio = 0.50 * calibratedStructSim + 0.50 * calibratedRatio;
  const objScoreRaw = objRatio * 16.0;
  const objects_score = Math.round(Math.max(0.0, Math.min(16.0, objScoreRaw)) * 100) / 100;

  // Category 4: Color / Lighting (Max: 8)
  const colorRatio = computeColorSimilarity(targetData.resized64Rgb, candidateData.resized64Rgb);
  const colorScoreRaw = colorRatio * 8.0;
  const color_score = Math.round(Math.max(0.0, Math.min(8.0, colorScoreRaw)) * 100) / 100;

  // Category 5: Fine Details (Max: 4)
  const detailRatio = computeDetailSimilarity(
    targetData.resized64Rgb,
    candidateData.resized64Rgb,
    targetData.width,
    targetData.height,
    candidateData.width,
    candidateData.height
  );
  const detailScoreRaw = detailRatio * 4.0;
  const details_score = Math.round(Math.max(0.0, Math.min(4.0, detailScoreRaw)) * 100) / 100;

  // Final Total Score: Strict sum bounded between 0.00 and 80.00
  const rawTotal = semantic_score + composition_score + objects_score + color_score + details_score;
  const total_score = Math.round(Math.max(0.0, Math.min(80.0, rawTotal)) * 100) / 100;

  const elapsedTime = Date.now() - startTime;

  return {
    semantic_score,
    composition_score,
    objects_score,
    color_score,
    details_score,
    total_score,
    clip_similarity: Math.round(rawCosine * 10000) / 10000,
    calibrated_similarity_pct: Math.round(calibratedRatio * 10000) / 100,
    evaluation_method: 'CLIP ViT-B/32 + Spatial/Color Vision (Calibrated)',
    evaluator_version: EVALUATOR_VERSION,
    evaluation_time_ms: elapsedTime,
  };
}
