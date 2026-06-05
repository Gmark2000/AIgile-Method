#!/usr/bin/env node
// R6 — Dependency-light guardrail: test-impact selection.
// Run only the tests related to the changed files so QA returns fast and cheap,
// instead of executing (and dumping) the whole suite. Auto-detects Jest vs
// Vitest from the local package.json; falls back to a printable command.
//
// Usage:
//   node test-impact.mjs <changedFile> [changedFile ...]
//   git diff --name-only | node test-impact.mjs --stdin
//
// Prints the selected command. Add --run to execute it.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
  });
}

function detectRunner(cwd) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.vitest) return 'vitest';
    if (deps.jest) return 'jest';
  } catch { /* no package.json — fall through */ }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const run = args.includes('--run');
  let files = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--stdin')) {
    files = (await readStdin()).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  files = files.filter((f) => /\.(m?[jt]sx?)$/.test(f) && fs.existsSync(f));
  if (!files.length) {
    console.error(JSON.stringify({ selected: [], reason: 'no changed source files — run full suite manually' }));
    process.exit(0);
  }

  const runner = detectRunner(process.cwd());
  let cmd;
  if (runner === 'jest') cmd = ['npx', 'jest', '--findRelatedTests', ...files];
  else if (runner === 'vitest') cmd = ['npx', 'vitest', 'related', '--run', ...files];
  else {
    console.error(JSON.stringify({ selected: files, reason: 'no jest/vitest detected — wire your runner manually' }));
    process.exit(0);
  }

  console.log(cmd.join(' '));
  if (run) {
    const res = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
    process.exit(res.status ?? 1);
  }
}

main();
