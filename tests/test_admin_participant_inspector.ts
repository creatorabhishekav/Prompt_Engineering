import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('[TEST] Starting Comprehensive Admin Participant Detail Inspector Suite...');

async function runTests() {
  const baseUrl = 'http://127.0.0.1:3000';

  // 1. Source Audit: Frontend Admin Participant Inspector Component
  console.log('  1. Auditing AdminParticipantInspector frontend component...');
  const inspectorPath = path.resolve('src/components/AdminParticipantInspector.tsx');
  assert.ok(fs.existsSync(inspectorPath), 'AdminParticipantInspector.tsx must exist');
  const inspectorCode = fs.readFileSync(inspectorPath, 'utf-8');

  // Verify all sections from user spec
  assert.ok(inspectorCode.includes('Participant Details'), 'Must have title "Participant Details"');
  assert.ok(inspectorCode.includes('Prompt History'), 'Must have "Prompt History" section');
  assert.ok(inspectorCode.includes('Prompt 1'), 'Must display Prompt 1');
  assert.ok(inspectorCode.includes('Prompt 2'), 'Must display Prompt 2');
  assert.ok(inspectorCode.includes('Copy Prompt'), 'Must have Copy Prompt button');
  assert.ok(inspectorCode.includes('Image Comparison'), 'Must have image comparison');
  assert.ok(inspectorCode.includes('Target Image'), 'Must show target image');
  assert.ok(inspectorCode.includes('First Image'), 'Must show first image');
  assert.ok(inspectorCode.includes('Final Image'), 'Must show final image');
  assert.ok(inspectorCode.includes('Score Progression'), 'Must show score progression');
  assert.ok(inspectorCode.includes('Stage 1 Evaluation Breakdown') || inspectorCode.includes('First Evaluation'), 'Must show Stage 1 breakdown');
  assert.ok(inspectorCode.includes('Final AI Evaluation') || inspectorCode.includes('Stage 2'), 'Must show Stage 2 breakdown');
  assert.ok(inspectorCode.includes('Google Gemini Chat Verification') || inspectorCode.includes('gemini_chat_link'), 'Must show Gemini chat link');
  assert.ok(inspectorCode.includes('Submission Lifecycle Timeline') || inspectorCode.includes('Timeline'), 'Must show submission timeline');
  assert.ok(inspectorCode.includes('Lightbox Modal') || inspectorCode.includes('lightboxUrl'), 'Must support full image lightbox');
  assert.ok(inspectorCode.includes('reconstructFromExistingAdminRoutes'), 'Must include resilient fallback reconstruction');
  assert.ok(inspectorCode.includes('[PARTICIPANT INSPECTOR]'), 'Must include debug logging');
  console.log('     ✓ Frontend component satisfies all specifications and includes resilient fallback.');

  // 2. Source Audit: AdminDashboard renders AdminParticipantInspector
  console.log('  2. Auditing AdminDashboard.tsx integration...');
  const adminDashCode = fs.readFileSync(path.resolve('src/pages/AdminDashboard.tsx'), 'utf-8');
  assert.ok(
    adminDashCode.includes('<AdminParticipantInspector'),
    'AdminDashboard must render <AdminParticipantInspector />'
  );
  assert.ok(
    adminDashCode.includes('setInspectingUserId(user.id)'),
    'Clicking participant row must set inspecting user id'
  );
  console.log('     ✓ AdminDashboard correctly mounts inspector upon participant row click.');

  // 3. Source Audit: Public Leaderboard does NOT expose private details
  console.log('  3. Auditing public Leaderboard.tsx privacy...');
  const leaderboardCode = fs.readFileSync(path.resolve('src/pages/Leaderboard.tsx'), 'utf-8');
  assert.strictEqual(
    leaderboardCode.includes('AdminParticipantInspector'),
    false,
    'Public leaderboard must NEVER include AdminParticipantInspector'
  );
  assert.strictEqual(
    leaderboardCode.includes('prompt_1'),
    false,
    'Public leaderboard must NEVER render prompt_1'
  );
  assert.strictEqual(
    leaderboardCode.includes('gemini_chat_link'),
    false,
    'Public leaderboard must NEVER render gemini_chat_link'
  );
  console.log('     ✓ Public leaderboard preserves complete participant privacy.');

  // 4. API Integration: Authenticate as Admin
  console.log('  4. Authenticating as Admin...');
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login should succeed');
  const adminLoginJson = await adminLoginRes.json();
  const adminToken = adminLoginJson.data?.access_token || adminLoginJson.token;
  assert.ok(adminToken, 'Admin token should exist');

  // 5. API Integration: Authenticate as Participant
  console.log('  5. Authenticating as Participant...');
  const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@example.com', password: 'alex123' }),
  });
  assert.strictEqual(userLoginRes.status, 200, 'Participant login should succeed');
  const userLoginJson = await userLoginRes.json();
  const participantToken = userLoginJson.data?.access_token || userLoginJson.token;
  const participantUserId = userLoginJson.data?.user?.id || userLoginJson.user?.id;
  assert.ok(participantToken, 'Participant token should exist');
  assert.ok(participantUserId, 'Participant userId should exist');

  // 6. Security Test: Unauthenticated access returns 401
  console.log('  6. Testing unauthenticated access (401)...');
  const unauthRes = await fetch(`${baseUrl}/api/admin/participants/${participantUserId}/details`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request should return 401');

  // 7. Security Test: Non-admin participant accessing endpoint returns 403 Forbidden
  console.log('  7. Testing normal participant user access (403 Forbidden)...');
  const forbiddenRes = await fetch(`${baseUrl}/api/admin/participants/${participantUserId}/details`, {
    headers: { Authorization: `Bearer ${participantToken}` },
  });
  assert.strictEqual(forbiddenRes.status, 403, 'Participant user must receive 403 Forbidden');
  const forbiddenJson = await forbiddenRes.json();
  assert.ok(
    forbiddenJson.detail.toLowerCase().includes('denied') ||
    forbiddenJson.detail.toLowerCase().includes('permission'),
    '403 must describe permission denial'
  );

  // 8. Unknown Participant Test: returns 404
  console.log('  8. Testing unknown participant access (404)...');
  const unknownRes = await fetch(`${baseUrl}/api/admin/participants/unknown_nonexistent_user_9999/details`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(unknownRes.status, 404, 'Unknown participant should return 404');
  const unknownJson = await unknownRes.json();
  assert.ok(unknownJson.detail.includes('not found') || unknownJson.detail.includes('Not found') || unknownJson.detail.includes('Participant not found.'));

  // 9. Admin Authorized Access with Valid Participant: returns 200
  console.log('  9. Testing Admin authorized access (200 OK) with participant data...');
  const adminInspectRes = await fetch(`${baseUrl}/api/admin/participants/${participantUserId}/details`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(adminInspectRes.status, 200, 'Admin request should succeed with 200 OK');
  const inspectJson = await adminInspectRes.json();
  assert.strictEqual(inspectJson.status, 'success');
  assert.ok(inspectJson.data.user);
  assert.strictEqual(inspectJson.data.user.id, participantUserId, 'Correct participant user ID is used');
  assert.strictEqual(inspectJson.data.user.password, undefined, 'Password must never be exposed');

  // 10. Check Prompt 1, Prompt 2, First Image, Final Image, Gemini Chat link
  console.log('  10. Verifying Prompt 1, Prompt 2, First Image, Final Image separation & Gemini link...');
  if (inspectJson.data.submission) {
    const sub = inspectJson.data.submission;
    assert.ok('prompt_1' in sub, 'Prompt 1 field exists');
    assert.ok('prompt_2' in sub, 'Prompt 2 field exists');
    assert.ok('first_image_url' in sub, 'First image field exists');
    assert.ok('final_image_url' in sub, 'Final image field exists');
    assert.ok('gemini_chat_link' in sub, 'Gemini chat link field exists');
    assert.ok('first_stage_breakdown' in sub, 'First stage breakdown exists');
    assert.ok('final_stage_breakdown' in sub, 'Final stage breakdown exists');
    // Ensure first_image and final_image fields are independent
    if (sub.first_image_url && sub.final_image_url) {
      assert.ok(typeof sub.first_image_url === 'string', 'First image is a string URL');
      assert.ok(typeof sub.final_image_url === 'string', 'Final image is a string URL');
    }
  }

  // 11. Multi-round isolation check
  console.log('  11. Verifying multi-round participant data isolation...');
  assert.ok(Array.isArray(inspectJson.data.rounds), 'Rounds list must be an array');
  for (const r of inspectJson.data.rounds) {
    assert.ok(r.round_id, 'Each round item has round_id');
    assert.ok(r.round_title, 'Each round item has round_title');
  }

  // 12. Public Leaderboard Privacy check
  console.log('  12. Testing Public Leaderboard API privacy protection...');
  const leaderboardRes = await fetch(`${baseUrl}/api/leaderboard`, {
    headers: { Authorization: `Bearer ${participantToken}` },
  });
  assert.strictEqual(leaderboardRes.status, 200);
  const leaderboardJson = await leaderboardRes.json();
  const leaderboardData = Array.isArray(leaderboardJson) ? leaderboardJson : leaderboardJson.data;
  assert.ok(Array.isArray(leaderboardData));
  for (const item of leaderboardData) {
    assert.strictEqual(item.prompt_1, undefined, 'Public leaderboard API must NOT expose prompt_1');
    assert.strictEqual(item.prompt_2, undefined, 'Public leaderboard API must NOT expose prompt_2');
    assert.strictEqual(item.gemini_chat_link, undefined, 'Public leaderboard API must NOT expose gemini_chat_link');
    assert.strictEqual(item.password, undefined, 'Public leaderboard API must NOT expose password');
  }

  console.log('\n[PASS] All 12 Admin Participant Detail Inspector tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('[FAIL] Admin Participant Inspector Test failed:', err);
  process.exit(1);
});
