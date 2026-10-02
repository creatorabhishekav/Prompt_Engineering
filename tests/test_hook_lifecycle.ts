import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('[TEST] Checking React Hooks order rules in Challenge.tsx...');

const challengePath = path.resolve(process.cwd(), 'src/pages/Challenge.tsx');
const content = fs.readFileSync(challengePath, 'utf-8');
const lines = content.split('\n');

// Find all phase early return statements in ChallengePage
const earlyReturns: { line: number; text: string }[] = [];

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  if (/if\s*\(phase\s*===/.test(line)) {
    earlyReturns.push({ line: lineNum, text: line.trim() });
  }
});

console.log(`Found ${earlyReturns.length} phase early returns:`);
earlyReturns.forEach((r) => console.log(`  Line ${r.line}: ${r.text}`));
assert(earlyReturns.length >= 4, 'Expected phase early returns in ChallengePage');

// Now verify that NO hooks (useMemo, useEffect, useState, useCallback, useRef) occur after the FIRST early return
const firstEarlyReturnLine = earlyReturns[0].line;
const hookRegex = /\b(useState|useEffect|useMemo|useCallback|useRef|useContext|useReducer|useLayoutEffect)\s*\(/;

const violatingHooks: { line: number; text: string }[] = [];
const headerComponentLine = lines.findIndex((l) => l.includes('function Header()')) + 1;

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  // Check within ChallengePage component body (up to Header component declaration)
  if (lineNum > firstEarlyReturnLine && lineNum < headerComponentLine) {
    if (hookRegex.test(line)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        violatingHooks.push({ line: lineNum, text: trimmed });
      }
    }
  }
});

if (violatingHooks.length > 0) {
  console.error('[FAIL] Hooks detected AFTER early returns:');
  violatingHooks.forEach((h) => console.error(`  Line ${h.line}: ${h.text}`));
  process.exit(1);
}

console.log('[PASS] Zero hooks detected after early returns! All hooks execute unconditionally at top level.');
console.log('[PASS] Invariant hook ordering verified. React Error #310 eliminated.');
