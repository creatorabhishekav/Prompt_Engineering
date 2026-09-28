import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Data types matching the system
interface StoredScoreBreakdown {
  semantic_score: number;
  composition_score: number;
  objects_score: number;
  color_score: number;
  details_score: number;
  total_score: number;
}

interface StoredSubmission {
  id: string;
  user_id: string;
  round_id: string;
  status: string;
  scoring_status?: string | null;
  submitted_at: string | null;
  created_at: string;
  first_stage_breakdown?: StoredScoreBreakdown | null;
  final_stage_breakdown?: StoredScoreBreakdown | null;
  total_score?: number | null;
}

interface StoredUser {
  id: string;
  username: string;
  full_name: string | null;
}

// Reproduction of the authoritative leaderboard logic in server.ts
function computeLeaderboard(
  submissions: StoredSubmission[],
  users: Map<string, StoredUser>,
  roundId?: string
) {
  // Filter ONLY submissions that have an official, valid FINAL evaluation score
  let eligibleSubs = submissions.filter((s) => {
    const finalScore = s.final_stage_breakdown?.total_score;
    if (typeof finalScore !== 'number' || isNaN(finalScore) || finalScore < 0) {
      return false;
    }
    return true;
  });

  if (roundId) {
    eligibleSubs = eligibleSubs.filter((s) => s.round_id === roundId);
  }

  // Group by user and take their latest authoritative FINAL submission
  // (If a participant replaces their final image or plays multiple rounds, their authoritative
  // current submission reflects their latest submitted attempt)
  const userSubmissionMap = new Map<string, StoredSubmission>();
  for (const sub of eligibleSubs) {
    const current = userSubmissionMap.get(sub.user_id);
    if (!current) {
      userSubmissionMap.set(sub.user_id, sub);
    } else {
      const subTime = new Date(sub.submitted_at || (sub as any).updated_at || sub.created_at).getTime();
      const currentTime = new Date(current.submitted_at || (current as any).updated_at || current.created_at).getTime();
      if (subTime >= currentTime) {
        userSubmissionMap.set(sub.user_id, sub);
      }
    }
  }

  // Sort ALL participants by authoritative CURRENT FINAL score (descending numeric), with stable tie-breaking
  const sorted = Array.from(userSubmissionMap.values()).sort((a, b) => {
    const scoreA = Number(a.final_stage_breakdown?.total_score ?? 0);
    const scoreB = Number(b.final_stage_breakdown?.total_score ?? 0);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const timeA = new Date(a.submitted_at || a.created_at).getTime();
    const timeB = new Date(b.submitted_at || b.created_at).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return a.user_id.localeCompare(b.user_id);
  });

  let currentRank = 1;
  const entries = sorted.map((sub, index) => {
    const u = users.get(sub.user_id);
    const b = sub.final_stage_breakdown!;
    const finalScore = Number(b.total_score);

    if (index > 0) {
      const prevScore = Number(sorted[index - 1].final_stage_breakdown?.total_score ?? 0);
      if (finalScore < prevScore) {
        currentRank = index + 1;
      }
    }

    return {
      rank: currentRank,
      user_id: sub.user_id,
      username: u?.username || 'Participant',
      full_name: u?.full_name || null,
      total_score: finalScore,
      semantic_score: Number(b.semantic_score ?? 0),
      composition_score: Number(b.composition_score ?? 0),
      objects_score: Number(b.objects_score ?? 0),
      color_score: Number(b.color_score ?? 0),
      details_score: Number(b.details_score ?? 0),
      rounds_played: 1,
    };
  });

  return entries;
}

async function runLeaderboardTests() {
  console.log('--- RUNNING LEADERBOARD AUDIT & VERIFICATION SUITE ---\n');

  const usersMap = new Map<string, StoredUser>();
  for (let i = 1; i <= 60; i++) {
    usersMap.set(`user_${i}`, {
      id: `user_${i}`,
      username: `participant_${i}`,
      full_name: `Participant ${i}`,
    });
  }

  // TEST 1: 10 participants created with descending scores. ALL 10 must appear.
  console.log('TEST 1: 10 participants created, scores 50 down to 5. Expect ALL 10 to appear.');
  const test1Subs: StoredSubmission[] = [];
  const test1Scores = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5];
  for (let i = 0; i < 10; i++) {
    test1Subs.push({
      id: `sub_${i + 1}`,
      user_id: `user_${i + 1}`,
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
      created_at: new Date().toISOString(),
      final_stage_breakdown: {
        semantic_score: test1Scores[i] * 0.4,
        composition_score: test1Scores[i] * 0.25,
        objects_score: test1Scores[i] * 0.2,
        color_score: test1Scores[i] * 0.1,
        details_score: test1Scores[i] * 0.05,
        total_score: test1Scores[i],
      },
    });
  }
  const res1 = computeLeaderboard(test1Subs, usersMap);
  assert.equal(res1.length, 10, 'Expected exactly 10 participants');
  assert.equal(res1[0].user_id, 'user_1');
  assert.equal(res1[0].total_score, 50);
  assert.equal(res1[9].user_id, 'user_10');
  assert.equal(res1[9].total_score, 5);
  console.log('✓ TEST 1 PASSED: All 10 participants returned without truncation.\n');

  // TEST 2: Participant 10 receives score 90. Expected: Participant 10 = Rank 1, Top 3 updates.
  console.log('TEST 2: Participant 10 receives score 90. Expect Participant 10 = Rank 1.');
  const test2Subs = [...test1Subs];
  test2Subs[9] = {
    ...test2Subs[9],
    final_stage_breakdown: {
      semantic_score: 36,
      composition_score: 22.5,
      objects_score: 18,
      color_score: 9,
      details_score: 4.5,
      total_score: 90,
    },
  };
  const res2 = computeLeaderboard(test2Subs, usersMap);
  assert.equal(res2[0].user_id, 'user_10');
  assert.equal(res2[0].rank, 1);
  assert.equal(res2[0].total_score, 90);
  assert.equal(res2[1].user_id, 'user_1');
  assert.equal(res2[1].rank, 2);
  assert.equal(res2[2].user_id, 'user_2');
  assert.equal(res2[2].rank, 3);
  console.log('✓ TEST 2 PASSED: Participant 10 moved to Rank 1 and Top 3 dynamically updated.\n');

  // TEST 3: Participant outside initial Top 5 receives higher score.
  console.log('TEST 3: Participant 7 (initial score 20) receives score 78. Expect them to move into Rank 1.');
  const test3Subs = [...test1Subs];
  test3Subs[6] = {
    ...test3Subs[6],
    final_stage_breakdown: {
      ...test3Subs[6].final_stage_breakdown!,
      total_score: 78,
    },
  };
  const res3 = computeLeaderboard(test3Subs, usersMap);
  assert.equal(res3[0].user_id, 'user_7');
  assert.equal(res3[0].rank, 1);
  assert.equal(res3[0].total_score, 78);
  console.log('✓ TEST 3 PASSED: Participant 7 outside top 5 jumped directly to Rank 1.\n');

  // TEST 4: FIRST score is higher than FINAL score. Expected: Leaderboard uses FINAL score only.
  console.log('TEST 4: Participant with FIRST score = 75, but FINAL score = 42. Expect score = 42.');
  const test4Subs: StoredSubmission[] = [
    {
      id: 'sub_test4',
      user_id: 'user_1',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      first_stage_breakdown: {
        semantic_score: 30,
        composition_score: 20,
        objects_score: 15,
        color_score: 6,
        details_score: 4,
        total_score: 75, // First score high
      },
      final_stage_breakdown: {
        semantic_score: 15,
        composition_score: 12,
        objects_score: 8,
        color_score: 4,
        details_score: 3,
        total_score: 42, // Final score lower
      },
    },
  ];
  const res4 = computeLeaderboard(test4Subs, usersMap);
  assert.equal(res4[0].total_score, 42, 'Must use authoritative FINAL score (42), not FIRST score (75)');
  console.log('✓ TEST 4 PASSED: Leaderboard strictly evaluated FINAL stage breakdown.\n');

  // TEST 5: Participant has FIRST score but NO FINAL score. Expected: Excluded from official leaderboard.
  console.log('TEST 5: Participant has FIRST score only (no final submission yet). Expect exclusion.');
  const test5Subs: StoredSubmission[] = [
    {
      id: 'sub_test5_only_first',
      user_id: 'user_1',
      round_id: 'round_1',
      status: 'in_progress',
      submitted_at: null,
      created_at: new Date().toISOString(),
      first_stage_breakdown: {
        semantic_score: 25,
        composition_score: 15,
        objects_score: 12,
        color_score: 6,
        details_score: 3,
        total_score: 61,
      },
      final_stage_breakdown: null, // No final score
    },
    {
      id: 'sub_test5_completed',
      user_id: 'user_2',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      final_stage_breakdown: {
        semantic_score: 20,
        composition_score: 14,
        objects_score: 10,
        color_score: 5,
        details_score: 2,
        total_score: 51,
      },
    },
  ];
  const res5 = computeLeaderboard(test5Subs, usersMap);
  assert.equal(res5.length, 1);
  assert.equal(res5[0].user_id, 'user_2');
  console.log('✓ TEST 5 PASSED: Participant with only FIRST score is cleanly excluded.\n');

  // TEST 6: Two participants have identical FINAL scores. Expected: Documented tie rank handling.
  console.log('TEST 6: Equal scores tie handling. 100, 100, 95, 90 -> Ranks 1, 1, 3, 4.');
  const test6Subs: StoredSubmission[] = [
    {
      id: 'sub_t1',
      user_id: 'user_1',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: '2026-09-28T01:00:00Z',
      created_at: '2026-09-28T01:00:00Z',
      final_stage_breakdown: { semantic_score: 40, composition_score: 25, objects_score: 20, color_score: 10, details_score: 5, total_score: 100 },
    },
    {
      id: 'sub_t2',
      user_id: 'user_2',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: '2026-09-28T01:05:00Z',
      created_at: '2026-09-28T01:05:00Z',
      final_stage_breakdown: { semantic_score: 40, composition_score: 25, objects_score: 20, color_score: 10, details_score: 5, total_score: 100 },
    },
    {
      id: 'sub_t3',
      user_id: 'user_3',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: '2026-09-28T01:10:00Z',
      created_at: '2026-09-28T01:10:00Z',
      final_stage_breakdown: { semantic_score: 38, composition_score: 24, objects_score: 19, color_score: 9, details_score: 5, total_score: 95 },
    },
    {
      id: 'sub_t4',
      user_id: 'user_4',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: '2026-09-28T01:15:00Z',
      created_at: '2026-09-28T01:15:00Z',
      final_stage_breakdown: { semantic_score: 36, composition_score: 22, objects_score: 18, color_score: 9, details_score: 5, total_score: 90 },
    },
  ];
  const res6 = computeLeaderboard(test6Subs, usersMap);
  assert.equal(res6[0].rank, 1);
  assert.equal(res6[1].rank, 1);
  assert.equal(res6[2].rank, 3);
  assert.equal(res6[3].rank, 4);
  console.log('✓ TEST 6 PASSED: Tied participants share rank (1, 1) and next participant is rank 3.\n');

  // TEST 7: Numeric sorting: 80, 79.99, 79.5, 70.
  console.log('TEST 7: Exact descending numeric order for float scores (80, 79.99, 79.5, 70).');
  const test7Subs: StoredSubmission[] = [
    {
      id: 's1',
      user_id: 'user_1',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      final_stage_breakdown: { semantic_score: 0, composition_score: 0, objects_score: 0, color_score: 0, details_score: 0, total_score: 70 },
    },
    {
      id: 's2',
      user_id: 'user_2',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      final_stage_breakdown: { semantic_score: 0, composition_score: 0, objects_score: 0, color_score: 0, details_score: 0, total_score: 79.99 },
    },
    {
      id: 's3',
      user_id: 'user_3',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      final_stage_breakdown: { semantic_score: 0, composition_score: 0, objects_score: 0, color_score: 0, details_score: 0, total_score: 80 },
    },
    {
      id: 's4',
      user_id: 'user_4',
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      final_stage_breakdown: { semantic_score: 0, composition_score: 0, objects_score: 0, color_score: 0, details_score: 0, total_score: 79.5 },
    },
  ];
  const res7 = computeLeaderboard(test7Subs, usersMap);
  assert.deepEqual(res7.map((r) => r.total_score), [80, 79.99, 79.5, 70]);
  console.log('✓ TEST 7 PASSED: Float scores strictly sorted in descending numeric order.\n');

  // TEST 8: 50 participants. ALL 50 must be accessible/returned.
  console.log('TEST 8: 50 participants submitted. Expect ALL 50 returned.');
  const test8Subs: StoredSubmission[] = [];
  for (let i = 1; i <= 50; i++) {
    test8Subs.push({
      id: `sub_large_${i}`,
      user_id: `user_${i}`,
      round_id: 'round_1',
      status: 'completed',
      submitted_at: new Date(Date.now() - i * 60000).toISOString(),
      created_at: new Date().toISOString(),
      final_stage_breakdown: {
        semantic_score: 0,
        composition_score: 0,
        objects_score: 0,
        color_score: 0,
        details_score: 0,
        total_score: 80 - i * 0.5,
      },
    });
  }
  const res8 = computeLeaderboard(test8Subs, usersMap);
  assert.equal(res8.length, 50, 'All 50 participants must be in leaderboard');
  assert.equal(res8[0].rank, 1);
  assert.equal(res8[49].rank, 50);
  assert.equal(res8[0].total_score, 79.5);
  console.log('✓ TEST 8 PASSED: Scaled 50-participant leaderboard verified successfully.\n');

  // TEST 9: Replacement of Final Image (Old FINAL = 75, New/Replaced FINAL = 62)
  console.log('TEST 9: Re-upload/Replace Final Image (Old FINAL = 75 -> Replaced FINAL = 62). Expect 62.');
  const test9Sub: StoredSubmission = {
    id: 'sub_replace_demo',
    user_id: 'user_1',
    round_id: 'round_1',
    status: 'completed',
    submitted_at: '2026-09-28T02:00:00Z',
    created_at: '2026-09-28T01:30:00Z',
    final_stage_breakdown: {
      semantic_score: 30,
      composition_score: 20,
      objects_score: 15,
      color_score: 6,
      details_score: 4,
      total_score: 75, // Old score before replacement
    },
  };

  // Initially scores 75
  const res9Before = computeLeaderboard([test9Sub], usersMap);
  assert.equal(res9Before[0].total_score, 75);

  // Participant re-uploads / replaces final image: updates the same submission's final_stage_breakdown to 62
  const test9SubReplaced: StoredSubmission = {
    ...test9Sub,
    submitted_at: '2026-09-28T02:15:00Z',
    final_stage_breakdown: {
      semantic_score: 24,
      composition_score: 16,
      objects_score: 12,
      color_score: 6,
      details_score: 4,
      total_score: 62, // Current authoritative final score
    },
  };
  const res9After = computeLeaderboard([test9SubReplaced], usersMap);
  assert.equal(res9After[0].total_score, 62, 'Leaderboard must display current authoritative score (62), not historical (75)');
  console.log('✓ TEST 9 PASSED: Replaced final photo score correctly reflected as 62 on leaderboard.\n');

  console.log('====================================================');
  console.log('ALL 9 LEADERBOARD TEST CASES PASSED WITH 100% SUCCESS');
  console.log('====================================================');
}

runLeaderboardTests().catch((e) => {
  console.error('Test run failed:', e);
  process.exit(1);
});
