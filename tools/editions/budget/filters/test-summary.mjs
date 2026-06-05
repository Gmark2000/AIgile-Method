#!/usr/bin/env node
// R2 — Budget field-projection: test-runner summary.
// Collapse verbose Jest/Vitest/Mocha output to {passed,failed,failures[]} so a
// failed test run costs a few tokens, not a full log dump.
//
// Usage:
//   <test command> 2>&1 | node test-summary.mjs
//   node test-summary.mjs < run.log
import process from 'node:process';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
  });
}

function summarize(text) {
  const lines = text.split(/\r?\n/);
  let passed = 0;
  let failed = 0;

  // Jest/Vitest "Tests: X failed, Y passed" line.
  const totals = text.match(/Tests?:\s*(?:(\d+)\s*failed[, ]+)?(?:(\d+)\s*passed)?/i);
  if (totals) {
    failed = Number(totals[1] || 0);
    passed = Number(totals[2] || 0);
  }

  const failures = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:✕|×|✗|FAIL|✖)\s+(.+)$/) || line.match(/^\s*\d+\)\s+(.+)$/);
    if (m) {
      const name = m[1].trim().slice(0, 160);
      if (name && !failures.some((f) => f.name === name)) {
        failures.push({ name, msg: '' });
      }
    }
  }
  if (!failed && failures.length) failed = failures.length;
  return { passed, failed, failures: failures.slice(0, 25) };
}

async function main() {
  const summary = summarize(await readStdin());
  process.stdout.write(JSON.stringify(summary) + '\n');
  // Non-zero exit when there are failures so callers can gate on it.
  process.exit(summary.failed > 0 ? 1 : 0);
}

main();
