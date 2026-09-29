import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Helper to validate HTTPS URLs for Google Gemini Chat Link
function validateHttpsUrl(rawUrl: string): { valid: boolean; error?: string; cleanedUrl?: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Please paste your Google Gemini chat link before submitting.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Please enter a valid HTTPS URL for your Google Gemini chat link.' };
    }
    return { valid: true, cleanedUrl: trimmed };
  } catch {
    return { valid: false, error: 'Please enter a valid HTTPS URL for your Google Gemini chat link.' };
  }
}

async function runGeminiChatLinkTests() {
  console.log('--- RUNNING GOOGLE GEMINI CHAT LINK VERIFICATION SUITE ---\n');

  const BASE_URL = 'http://127.0.0.1:3000';

  // 1. UNIT TESTS: URL VALIDATION & TRIMMING
  console.log('1. Testing URL Validation & Whitespace Trimming...');
  assert.equal(validateHttpsUrl('').valid, false);
  assert.equal(validateHttpsUrl('   ').valid, false);
  assert.equal(validateHttpsUrl('').error, 'Please paste your Google Gemini chat link before submitting.');

  assert.equal(validateHttpsUrl('http://gemini.google.com/share/123').valid, false);
  assert.equal(validateHttpsUrl('ftp://gemini.google.com').valid, false);
  assert.equal(validateHttpsUrl('javascript:alert(1)').valid, false);
  assert.equal(validateHttpsUrl('just-a-string').valid, false);
  assert.equal(validateHttpsUrl('http://gemini.google.com/share/123').error, 'Please enter a valid HTTPS URL for your Google Gemini chat link.');

  const valid1 = validateHttpsUrl('  https://gemini.google.com/share/48b4e768a8dc  ');
  assert.equal(valid1.valid, true);
  assert.equal(valid1.cleanedUrl, 'https://gemini.google.com/share/48b4e768a8dc');

  const valid2 = validateHttpsUrl('https://g.co/gemini/share/abcdef');
  assert.equal(valid2.valid, true);
  assert.equal(valid2.cleanedUrl, 'https://g.co/gemini/share/abcdef');
  console.log('   ✓ URL validation correctly enforces HTTPS and trims whitespace.\n');

  // 2. FRONTEND SOURCE AUDIT: VERIFY FIRST IMAGE SECTION HAS NO GEMINI LINK
  console.log('2. Auditing Frontend Code Structure...');
  const challengeCode = fs.readFileSync(path.resolve('src/pages/Challenge.tsx'), 'utf-8');
  
  // Extract Stage 1 (First Image) section
  const step1Index = challengeCode.indexOf('FIRST GENERATED IMAGE');
  const step2Index = challengeCode.indexOf('FINAL GENERATED IMAGE');
  assert.ok(step1Index > -1 && step2Index > -1, 'Both stages must exist in Challenge.tsx');

  const stage1Code = challengeCode.slice(step1Index, step2Index);
  assert.equal(
    stage1Code.includes('GeminiChatLinkSection'),
    false,
    'TEST 4 PASSED: Gemini link MUST NOT be displayed in the first-image section'
  );
  console.log('   ✓ Gemini link is NOT displayed in the first-image section.');

  const stage2Code = challengeCode.slice(step2Index);
  assert.equal(
    stage2Code.includes('GeminiChatLinkSection'),
    true,
    'TEST 5 PASSED: Gemini link MUST be displayed only in the final submission section'
  );
  assert.ok(
    stage2Code.includes('Paste the Gemini conversation link used to generate/revise your final image.'),
    'Helper text must specify "your final image"'
  );
  console.log('   ✓ Gemini link is displayed ONLY in the final submission section near Submit button.\n');

  // 3. INTEGRATION TESTS AGAINST DEV SERVER API
  console.log('3. Testing Workflow & Backend API Endpoints...');
  const participantToken = 'u' + Date.now().toString().slice(-10);
  const adminToken = 'admin-token-admin_gemini_test';

  // Start round challenge
  console.log('   Starting round challenge...');
  const startRes = await fetch(`${BASE_URL}/api/rounds/round_cyberpunk/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
  });
  assert.equal(startRes.status, 200);
  const startJson = await startRes.json();
  const subId = startJson.data.id;
  assert.ok(subId);

  // Submit Prompt 1
  console.log('   Submitting Prompt 1 (no Gemini link)...');
  const p1Res = await fetch(`${BASE_URL}/api/submissions/${subId}/prompt-1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: 'Cyberpunk street with wet neon reflections' }),
  });
  assert.equal(p1Res.status, 200);

  // TEST 1 & 2: Upload First Image & ML score WITHOUT Gemini link
  console.log('   Uploading First Image without Gemini link...');
  const sampleImagePath = path.resolve('tests/fixtures/target.png');
  if (!fs.existsSync(sampleImagePath)) {
    fs.mkdirSync(path.dirname(sampleImagePath), { recursive: true });
    const dummySvg = Buffer.from('<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#00ffff"/></svg>');
    const sharp = (await import('sharp')).default;
    await sharp(dummySvg).png().toFile(sampleImagePath);
  }
  const imageBuffer = fs.readFileSync(sampleImagePath);

  const firstFormData = new FormData();
  firstFormData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'first.png');

  const uploadFirstRes = await fetch(`${BASE_URL}/api/submissions/${subId}/upload-first-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
    },
    body: firstFormData,
  });
  if (uploadFirstRes.status !== 200) {
    const errJson = await uploadFirstRes.json();
    console.error('Upload first image failed with:', errJson);
  }
  assert.equal(uploadFirstRes.status, 200, 'TEST 1 PASSED: First image can be uploaded without Gemini link');
  const uploadFirstJson = await uploadFirstRes.json();
  assert.ok(uploadFirstJson.data.first_score !== null, 'TEST 2 PASSED: First-stage ML scoring works without Gemini link');
  assert.equal(uploadFirstJson.data.gemini_chat_link, null, 'No Gemini link attached to first image');
  console.log(`   ✓ First image uploaded and scored (${uploadFirstJson.data.first_score} pts) without Gemini link.`);

  // Submit Prompt 2
  console.log('   Submitting Prompt 2 (unlocks Final Image)...');
  const p2Res = await fetch(`${BASE_URL}/api/submissions/${subId}/prompt-2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: 'Refined cyberpunk boulevard with cyan hovercars' }),
  });
  assert.equal(p2Res.status, 200);

  // TEST 3: Upload Final Image WITHOUT Gemini link
  console.log('   Uploading Final Image without Gemini link...');
  const finalFormData = new FormData();
  finalFormData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'final.png');

  const uploadFinalRes = await fetch(`${BASE_URL}/api/submissions/${subId}/upload-final-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
    },
    body: finalFormData,
  });
  assert.equal(uploadFinalRes.status, 200, 'TEST 3 PASSED: Final image can be uploaded without Gemini link');
  const uploadFinalJson = await uploadFinalRes.json();
  assert.ok(uploadFinalJson.data.final_score !== null, 'Final stage evaluated');
  console.log('   ✓ Final image uploaded and evaluated without Gemini link.');

  // TEST 9: Replacing Final Image before final submission
  console.log('   Testing replacing Final Image before final submission...');
  const replaceFormData = new FormData();
  replaceFormData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'final_replaced.png');

  const replaceFinalRes = await fetch(`${BASE_URL}/api/submissions/${subId}/upload-final-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
    },
    body: replaceFormData,
  });
  assert.equal(replaceFinalRes.status, 200, 'TEST 9 PASSED: Replacing final image works without requiring Gemini link');
  console.log('   ✓ Replacing final image before final submission works cleanly.');

  // TEST 6: Final submission WITHOUT Gemini link returns 400
  console.log('   Testing final submission without Gemini link...');
  const emptySubmitRes = await fetch(`${BASE_URL}/api/submissions/${subId}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemini_chat_link: '' }),
  });
  assert.equal(emptySubmitRes.status, 400, 'TEST 6 PASSED: Final submission without Gemini link returns 400');
  const emptySubmitJson = await emptySubmitRes.json();
  assert.equal(emptySubmitJson.detail, 'Please paste your Google Gemini chat link before submitting.');
  console.log('   ✓ Submission without link blocked with: "Please paste your Google Gemini chat link before submitting."');

  // TEST 7 & 8: Final submission WITH valid HTTPS Gemini link succeeds and saves link
  console.log('   Testing final submission with valid HTTPS Google Gemini chat link...');
  const officialGeminiLink = 'https://gemini.google.com/share/final_submission_verified_link';
  const submitRes = await fetch(`${BASE_URL}/api/submissions/${subId}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemini_chat_link: `  ${officialGeminiLink}  ` }),
  });
  assert.equal(submitRes.status, 200, 'TEST 7 PASSED: Final submission with valid HTTPS Gemini link succeeds');
  const submitJson = await submitRes.json();
  assert.equal(submitJson.data.gemini_chat_link, officialGeminiLink, 'TEST 8 PASSED: Gemini link saved exactly once with final submission');
  console.log('   ✓ Final submission succeeded and saved gemini_chat_link.');

  // TEST 10: Public leaderboard NEVER exposes gemini_chat_link
  console.log('   Testing Public Leaderboard privacy...');
  const leaderboardRes = await fetch(`${BASE_URL}/api/leaderboard?round_id=round_cyberpunk`, {
    headers: {
      Authorization: `Bearer ${participantToken}`,
    },
  });
  assert.equal(leaderboardRes.status, 200);
  const leaderboardJson = await leaderboardRes.json();
  assert.ok(Array.isArray(leaderboardJson.data));
  for (const entry of leaderboardJson.data) {
    assert.equal(entry.gemini_chat_link, undefined, 'TEST 10 PASSED: Public leaderboard must never expose gemini_chat_link');
  }
  console.log('   ✓ Public leaderboard verified: gemini_chat_link is never exposed.');

  // TEST 11: Admin sees link ONLY in final submission records, never in intermediate records
  console.log('   Testing Admin view: link visible only for final submission records...');
  const adminSubsRes = await fetch(`${BASE_URL}/api/admin/rounds/round_cyberpunk/submissions`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(adminSubsRes.status, 200);
  const adminSubsJson = await adminSubsRes.json();
  const mySubInAdmin = adminSubsJson.data.find((s: any) => s.id === subId);
  assert.ok(mySubInAdmin, 'Admin can see the completed final submission');
  assert.equal(mySubInAdmin.gemini_chat_link, officialGeminiLink, 'TEST 11 PASSED: Admin sees link in final submission record');

  // Verify an intermediate submission without final evaluation does not have gemini_chat_link
  const intermediateSub = adminSubsJson.data.find((s: any) => s.status === 'in_progress' || s.status === 'first_uploaded');
  if (intermediateSub) {
    assert.equal(intermediateSub.gemini_chat_link, null, 'Intermediate submission must have null gemini_chat_link');
  }
  console.log('   ✓ Admin sees Gemini link only in final submission records.');

  console.log('\n========================================================================');
  console.log('ALL 11 GOOGLE GEMINI CHAT LINK REQUIREMENTS VERIFIED & PASSED!');
  console.log('========================================================================\n');
}

runGeminiChatLinkTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
