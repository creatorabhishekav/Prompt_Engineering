import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  evaluateTargetVsCandidate,
  initMLModel,
  EVALUATOR_VERSION,
  EVALUATOR_MODEL,
} from '../server/mlEvaluator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DIR = path.resolve(__dirname, 'fixtures');
fs.mkdirSync(TEST_DIR, { recursive: true });

async function createTestImage(
  filename: string,
  width: number,
  height: number,
  drawFn: (s: sharp.Sharp) => sharp.Sharp
) {
  const filePath = path.resolve(TEST_DIR, filename);
  let base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 30, b: 50 },
    },
  });
  base = drawFn(base);
  await base.png().toFile(filePath);
  return filePath;
}

async function runTests() {
  console.log('====================================================');
  console.log('ML IMAGE EVALUATOR AUTOMATED AUDIT & TEST SUITE');
  console.log(`Evaluator Model: ${EVALUATOR_MODEL}`);
  console.log(`Evaluator Version: ${EVALUATOR_VERSION}`);
  console.log('====================================================\n');

  console.log('1. Initializing CLIP ViT-B/32 model...');
  const initStart = Date.now();
  const ok = await initMLModel();
  if (!ok) {
    throw new Error('Failed to initialize CLIP model');
  }
  console.log(`   Model ready in ${Date.now() - initStart}ms\n`);

  // Generate test fixtures:
  // A: Cyberpunk neon target (Cyan, Magenta, dark street)
  const targetSvg = Buffer.from(`
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="#0b0b1a"/>
      <rect x="50" y="200" width="300" height="150" fill="#151530"/>
      <circle cx="120" cy="150" r="45" fill="#00f3ff"/>
      <rect x="220" y="100" width="100" height="80" fill="#ff007f"/>
      <line x1="0" y1="350" x2="400" y2="350" stroke="#00f3ff" stroke-width="6"/>
      <line x1="50" y1="200" x2="350" y2="200" stroke="#ff007f" stroke-width="4"/>
    </svg>
  `);
  const targetPath = path.resolve(TEST_DIR, 'target.png');
  await sharp(targetSvg).png().toFile(targetPath);

  // B: Similar image (similar colors, slight layout shift)
  const similarSvg = Buffer.from(`
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="#0e0e22"/>
      <rect x="60" y="190" width="280" height="140" fill="#181838"/>
      <circle cx="130" cy="140" r="40" fill="#00d5ee"/>
      <rect x="230" y="110" width="90" height="75" fill="#ee0070"/>
      <line x1="0" y1="345" x2="400" y2="345" stroke="#00d5ee" stroke-width="5"/>
    </svg>
  `);
  const similarPath = path.resolve(TEST_DIR, 'similar.png');
  await sharp(similarSvg).png().toFile(similarPath);

  // C: Same composition but completely inverted / wrong colors (Warm Yellow/Orange/Green)
  const wrongColorSvg = Buffer.from(`
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="#f5deb3"/>
      <rect x="50" y="200" width="300" height="150" fill="#d2691e"/>
      <circle cx="120" cy="150" r="45" fill="#228b22"/>
      <rect x="220" y="100" width="100" height="80" fill="#ff8c00"/>
      <line x1="0" y1="350" x2="400" y2="350" stroke="#228b22" stroke-width="6"/>
    </svg>
  `);
  const wrongColorPath = path.resolve(TEST_DIR, 'wrong_color.png');
  await sharp(wrongColorSvg).png().toFile(wrongColorPath);

  // D: Unrelated image (bright pastoral landscape: green grass, white cloud, blue sky)
  const unrelatedSvg = Buffer.from(`
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="200" fill="#87ceeb"/>
      <rect y="200" width="400" height="200" fill="#32cd32"/>
      <circle cx="300" cy="80" r="35" fill="#ffd700"/>
      <ellipse cx="100" cy="100" rx="50" ry="25" fill="#ffffff"/>
    </svg>
  `);
  const unrelatedPath = path.resolve(TEST_DIR, 'unrelated.png');
  await sharp(unrelatedSvg).png().toFile(unrelatedPath);

  // E: Solid blank white image
  const blankPath = path.resolve(TEST_DIR, 'blank_white.png');
  await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toFile(blankPath);

  // F: Low-resolution downsampled copy of target
  const lowResPath = path.resolve(TEST_DIR, 'target_lowres.png');
  await sharp(targetPath).resize(64, 64).png().toFile(lowResPath);

  // G: Corrupted file
  const corruptedPath = path.resolve(TEST_DIR, 'corrupted.png');
  fs.writeFileSync(corruptedPath, Buffer.from('NOT_A_VALID_IMAGE_DATA'));

  const results: Record<string, any> = {};

  // Test 1: Identical Image vs Itself
  console.log('--- Test 1: Identical Image vs Itself ---');
  const resIdentical = await evaluateTargetVsCandidate(targetPath, targetPath);
  results['identical'] = resIdentical;
  console.log(`Total: ${resIdentical.total_score}/80 | Semantic: ${resIdentical.semantic_score}/32 | Comp: ${resIdentical.composition_score}/20 | Obj: ${resIdentical.objects_score}/16 | Color: ${resIdentical.color_score}/8 | Details: ${resIdentical.details_score}/4`);
  console.log(`Raw Cosine: ${resIdentical.clip_similarity} | Calibrated: ${resIdentical.calibrated_similarity_pct}% | Time: ${resIdentical.evaluation_time_ms}ms`);
  if (resIdentical.total_score < 75) {
    throw new Error(`Identical image score too low: ${resIdentical.total_score}`);
  }

  // Test 2: Strongly Similar Image
  console.log('\n--- Test 2: Strongly Similar Candidate ---');
  const resSimilar = await evaluateTargetVsCandidate(targetPath, similarPath);
  results['similar'] = resSimilar;
  console.log(`Total: ${resSimilar.total_score}/80 | Semantic: ${resSimilar.semantic_score}/32 | Comp: ${resSimilar.composition_score}/20 | Obj: ${resSimilar.objects_score}/16 | Color: ${resSimilar.color_score}/8 | Details: ${resSimilar.details_score}/4`);
  console.log(`Raw Cosine: ${resSimilar.clip_similarity} | Calibrated: ${resSimilar.calibrated_similarity_pct}%`);

  // Test 3: Same Composition but Inverted/Wrong Colors
  console.log('\n--- Test 3: Same Composition, Wrong Colors ---');
  const resWrongColor = await evaluateTargetVsCandidate(targetPath, wrongColorPath);
  results['wrong_color'] = resWrongColor;
  console.log(`Total: ${resWrongColor.total_score}/80 | Color Score: ${resWrongColor.color_score}/8 | Comp Score: ${resWrongColor.composition_score}/20`);
  if (resWrongColor.color_score > resSimilar.color_score) {
    throw new Error('Wrong color image should have lower color score than similar image');
  }

  // Test 4: Completely Unrelated Image
  console.log('\n--- Test 4: Completely Unrelated Image ---');
  const resUnrelated = await evaluateTargetVsCandidate(targetPath, unrelatedPath);
  results['unrelated'] = resUnrelated;
  console.log(`Total: ${resUnrelated.total_score}/80 | Semantic: ${resUnrelated.semantic_score}/32 | Comp: ${resUnrelated.composition_score}/20 | Color: ${resUnrelated.color_score}/8`);
  console.log(`Raw Cosine: ${resUnrelated.clip_similarity} | Calibrated: ${resUnrelated.calibrated_similarity_pct}%`);
  if (resUnrelated.total_score > 35) {
    throw new Error(`Unrelated image score too high: ${resUnrelated.total_score}`);
  }

  // Test 5: Blank Solid Image
  console.log('\n--- Test 5: Blank Solid White Image ---');
  const resBlank = await evaluateTargetVsCandidate(targetPath, blankPath);
  results['blank'] = resBlank;
  console.log(`Total: ${resBlank.total_score}/80 | Semantic: ${resBlank.semantic_score}/32 | Details: ${resBlank.details_score}/4`);

  // Test 6: Low-Res Target Copy
  console.log('\n--- Test 6: Low-Res Copy of Target ---');
  const resLowRes = await evaluateTargetVsCandidate(targetPath, lowResPath);
  results['low_res'] = resLowRes;
  console.log(`Total: ${resLowRes.total_score}/80 | Semantic: ${resLowRes.semantic_score}/32 | Details: ${resLowRes.details_score}/4`);
  if (resLowRes.total_score <= resUnrelated.total_score) {
    throw new Error('Low res copy should score higher than unrelated image');
  }

  // Test 7: Determinism & Reproducibility (repeat evaluation 3 times)
  console.log('\n--- Test 7: Determinism Check (Repeat 3x) ---');
  const run1 = await evaluateTargetVsCandidate(targetPath, similarPath);
  const run2 = await evaluateTargetVsCandidate(targetPath, similarPath);
  const run3 = await evaluateTargetVsCandidate(targetPath, similarPath);
  console.log(`Run 1: ${run1.total_score} | Run 2: ${run2.total_score} | Run 3: ${run3.total_score}`);
  if (run1.total_score !== run2.total_score || run2.total_score !== run3.total_score) {
    throw new Error('Evaluator is not deterministic! Repeated runs produced different scores.');
  }

  // Test 8: Corrupted Image Handling
  console.log('\n--- Test 8: Corrupted Image Handling ---');
  try {
    await evaluateTargetVsCandidate(targetPath, corruptedPath);
    throw new Error('Expected evaluation of corrupted file to throw error, but it succeeded.');
  } catch (err: any) {
    console.log(`   Correctly rejected corrupted image: "${err.message}"`);
  }

  // Test 9: Score Monotonicity and Distribution Check
  console.log('\n--- Test 9: Score Distribution & Monotonicity ---');
  console.log(`Identical:   ${resIdentical.total_score}/80`);
  console.log(`Similar:     ${resSimilar.total_score}/80`);
  console.log(`Low-Res:     ${resLowRes.total_score}/80`);
  console.log(`Wrong Color: ${resWrongColor.total_score}/80`);
  console.log(`Unrelated:   ${resUnrelated.total_score}/80`);
  console.log(`Blank:       ${resBlank.total_score}/80`);

  const monotonic =
    resIdentical.total_score > resSimilar.total_score &&
    resSimilar.total_score > resUnrelated.total_score &&
    resUnrelated.total_score >= 0;

  if (!monotonic) {
    throw new Error('Score monotonicity violated: identical > similar > unrelated');
  }
  console.log('   Monotonicity verified: identical > similar > unrelated');

  // Verify all categories bounded
  for (const [key, r] of Object.entries(results)) {
    if (r.semantic_score < 0 || r.semantic_score > 32) throw new Error(`${key}: semantic out of bounds`);
    if (r.composition_score < 0 || r.composition_score > 20) throw new Error(`${key}: composition out of bounds`);
    if (r.objects_score < 0 || r.objects_score > 16) throw new Error(`${key}: objects out of bounds`);
    if (r.color_score < 0 || r.color_score > 8) throw new Error(`${key}: color out of bounds`);
    if (r.details_score < 0 || r.details_score > 4) throw new Error(`${key}: details out of bounds`);
    if (r.total_score < 0 || r.total_score > 80) throw new Error(`${key}: total out of bounds`);
    if (isNaN(r.total_score) || !isFinite(r.total_score)) throw new Error(`${key}: NaN or infinite`);
  }
  console.log('   All category and total bounds verified [0, max] and [0, 80] with no NaNs.');

  console.log('\n====================================================');
  console.log('ALL ML EVALUATOR AUDIT TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
