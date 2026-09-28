import assert from 'node:assert/strict';

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
  
  // Empty
  assert.equal(validateHttpsUrl('').valid, false);
  assert.equal(validateHttpsUrl('   ').valid, false);
  assert.equal(validateHttpsUrl('').error, 'Please paste your Google Gemini chat link before submitting.');

  // Non-HTTPS
  assert.equal(validateHttpsUrl('http://gemini.google.com/share/123').valid, false);
  assert.equal(validateHttpsUrl('ftp://gemini.google.com').valid, false);
  assert.equal(validateHttpsUrl('javascript:alert(1)').valid, false);
  assert.equal(validateHttpsUrl('just-a-string').valid, false);
  assert.equal(validateHttpsUrl('http://gemini.google.com/share/123').error, 'Please enter a valid HTTPS URL for your Google Gemini chat link.');

  // Valid HTTPS Google Gemini share URLs with whitespace
  const valid1 = validateHttpsUrl('  https://gemini.google.com/share/48b4e768a8dc  ');
  assert.equal(valid1.valid, true);
  assert.equal(valid1.cleanedUrl, 'https://gemini.google.com/share/48b4e768a8dc');

  const valid2 = validateHttpsUrl('https://g.co/gemini/share/abcdef');
  assert.equal(valid2.valid, true);
  assert.equal(valid2.cleanedUrl, 'https://g.co/gemini/share/abcdef');

  console.log('   ✓ URL validation correctly enforces HTTPS and trims whitespace.\n');

  // 2. INTEGRATION TESTS AGAINST DEV SERVER API
  console.log('2. Testing Backend API Endpoints (Auth, Challenge, Gemini Link, Admin, Leaderboard)...');

  // Helper for requests
  const participantToken = 'u' + Date.now().toString().slice(-10);
  const adminToken = 'admin-token-admin_gemini_test';

  // Check health
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.equal(healthRes.status, 200, 'Server should be healthy');

  // Start round challenge
  console.log('   Starting round challenge for test participant...');
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
  assert.ok(subId, 'Submission ID should be present');
  console.log(`   ✓ Challenge started with ID: ${subId}`);
  assert.equal(startJson.data.gemini_chat_link, null, 'gemini_chat_link should initially be null');

  // 3. Test saving invalid Gemini Chat Link (non-HTTPS) -> 400
  console.log('   Testing rejection of non-HTTPS Gemini link...');
  const badLinkRes = await fetch(`${BASE_URL}/api/submissions/${subId}/gemini-link`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemini_chat_link: 'http://gemini.google.com/share/insecure' }),
  });
  assert.equal(badLinkRes.status, 400, 'Non-HTTPS link should return 400');
  const badLinkJson = await badLinkRes.json();
  assert.ok(badLinkJson.detail.includes('HTTPS'), 'Error should specify HTTPS requirement');
  console.log('   ✓ Non-HTTPS URL correctly rejected with 400.');

  // 4. Test saving valid Google Gemini Chat Link
  console.log('   Saving valid Google Gemini Chat Link with surrounding whitespace...');
  const saveLinkRes = await fetch(`${BASE_URL}/api/submissions/${subId}/gemini-link`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemini_chat_link: '   https://gemini.google.com/share/987xyz123   ' }),
  });
  assert.equal(saveLinkRes.status, 200, 'Saving valid link should succeed');
  const saveLinkJson = await saveLinkRes.json();
  assert.equal(saveLinkJson.data.gemini_chat_link, 'https://gemini.google.com/share/987xyz123', 'Whitespace must be trimmed');
  console.log('   ✓ Link saved and whitespace trimmed.');

  // 5. Test page reload restoration
  console.log('   Simulating page reload: fetching round status...');
  const statusRes = await fetch(`${BASE_URL}/api/rounds/round_cyberpunk/status`, {
    headers: {
      Authorization: `Bearer ${participantToken}`,
    },
  });
  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.data.gemini_chat_link, 'https://gemini.google.com/share/987xyz123', 'Saved Gemini link must be restored on status fetch');
  console.log('   ✓ Saved Gemini link correctly restored across page reload/resync.');

  // 6. Test submission validation when link is missing or empty
  console.log('   Testing submit final challenge without link...');
  // Clear link to test rejection
  await fetch(`${BASE_URL}/api/submissions/${subId}/gemini-link`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemini_chat_link: '' }),
  });

  const emptySubmitRes = await fetch(`${BASE_URL}/api/submissions/${subId}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemini_chat_link: '   ' }),
  });
  assert.equal(emptySubmitRes.status, 400, 'Submitting without Gemini link must return 400');
  const emptySubmitJson = await emptySubmitRes.json();
  assert.equal(emptySubmitJson.detail, 'Please paste your Google Gemini chat link before submitting.');
  console.log('   ✓ Missing link on submission correctly rejected: "Please paste your Google Gemini chat link before submitting."');

  // 7. Re-populate link and submit successfully
  console.log('   Submitting challenge with authoritative Gemini chat link...');
  const officialGeminiLink = 'https://gemini.google.com/share/championship_round_official_link';
  const submitRes = await fetch(`${BASE_URL}/api/submissions/${subId}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${participantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemini_chat_link: officialGeminiLink }),
  });
  assert.equal(submitRes.status, 200, 'Submission with valid link must succeed');
  const submitJson = await submitRes.json();
  assert.equal(submitJson.data.gemini_chat_link, officialGeminiLink);
  console.log('   ✓ Submission completed and gemini_chat_link preserved.');

  // 8. Test Admin view of Gemini Chat Link
  console.log('   Testing Admin Submissions List endpoint...');
  const adminSubsRes = await fetch(`${BASE_URL}/api/admin/rounds/round_cyberpunk/submissions`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(adminSubsRes.status, 200);
  const adminSubsJson = await adminSubsRes.json();
  assert.ok(Array.isArray(adminSubsJson.data), 'Submissions list must be an array');
  const mySubInAdmin = adminSubsJson.data.find((s: any) => s.id === subId);
  assert.ok(mySubInAdmin, 'Admin must see the test submission');
  assert.equal(mySubInAdmin.gemini_chat_link, officialGeminiLink, 'Admin must receive participant gemini_chat_link');
  console.log('   ✓ Admin can inspect participant Google Gemini chat link.');

  // 9. Test Public Leaderboard privacy
  console.log('   Testing Public Leaderboard endpoint for privacy...');
  const leaderboardRes = await fetch(`${BASE_URL}/api/leaderboard?round_id=round_cyberpunk`, {
    headers: {
      Authorization: `Bearer ${participantToken}`,
    },
  });
  assert.equal(leaderboardRes.status, 200);
  const leaderboardJson = await leaderboardRes.json();
  assert.ok(Array.isArray(leaderboardJson.data));
  for (const entry of leaderboardJson.data) {
    assert.equal(entry.gemini_chat_link, undefined, 'Public leaderboard MUST NOT expose gemini_chat_link');
  }
  console.log('   ✓ Public leaderboard verified: gemini_chat_link is NOT exposed on public leaderboard.');

  // 10. Backward compatibility with older submissions
  console.log('   Testing backward compatibility: seeded submission with null link...');
  const davidSub = adminSubsJson.data.find((s: any) => s.id === 'sub_david_1');
  if (davidSub) {
    assert.equal(davidSub.gemini_chat_link, null, 'David seed submission backward compatible with null');
    console.log('   ✓ Backward compatibility verified for submissions without link.');
  }

  console.log('\n=======================================================');
  console.log('ALL GOOGLE GEMINI CHAT LINK TESTS PASSED SUCCESSFULLY!');
  console.log('=======================================================\n');
}

runGeminiChatLinkTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
