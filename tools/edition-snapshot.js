#!/usr/bin/env node
// Golden-snapshot harness for edition installs.
//
// Captures a deterministic content-hash manifest of an edition install so the
// "full power must stay byte-for-byte unchanged" guarantee can be proven across
// the budget-separation refactor.
//
// Usage:
//   node tools/edition-snapshot.js capture <edition> <outFile>
//   node tools/edition-snapshot.js verify  <edition> <snapshotFile>
//
// The install timestamp + package version in .aigile-manifest.json are volatile
// per run, so they are normalized out before hashing. Everything else
// (agent bodies, mcp.json, the full .aigile-core tree, manifest structure) is
// hashed verbatim.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const cliPath = path.join(root, 'tools', 'cli.js');

function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function normalizeManifest(raw) {
  try {
    const parsed = JSON.parse(raw);
    delete parsed.installedAt;
    delete parsed.version;
    return JSON.stringify(parsed, Object.keys(parsed).sort(), 2);
  } catch {
    return raw;
  }
}

function installEdition(edition) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `aigile-snap-${edition}-`));
  const args = ['install', '--yes', '--non-interactive', '--with-mcp'];
  if (edition === 'budget') args.push('--budget');
  else args.push('--full');
  execFileSync(process.execPath, [cliPath, ...args], {
    cwd: dir,
    env: { ...process.env, AIGILE_ADD_SCRIPTS: '0' },
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return dir;
}

function buildManifestHashes(dir) {
  const targets = [
    path.join(dir, '.github', 'agents'),
    path.join(dir, '.github', 'prompts'),
    path.join(dir, '.vscode', 'mcp.json'),
    path.join(dir, '.aigile-manifest.json'),
    path.join(dir, '.aigile-core'),
  ];
  const map = {};
  for (const t of targets) {
    if (!fs.existsSync(t)) continue;
    const stat = fs.statSync(t);
    const files = stat.isDirectory() ? listFilesRecursive(t) : [t];
    for (const f of files) {
      const rel = path.relative(dir, f).split(path.sep).join('/');
      let content = fs.readFileSync(f);
      if (rel === '.aigile-manifest.json') content = Buffer.from(normalizeManifest(content.toString('utf8')));
      map[rel] = sha256(content);
    }
  }
  return map;
}

function capture(edition) {
  const dir = installEdition(edition);
  const map = buildManifestHashes(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  return map;
}

function main() {
  const [, , cmd, edition, file] = process.argv;
  if (!['capture', 'verify'].includes(cmd) || !edition || !file) {
    console.error('Usage: node tools/edition-snapshot.js <capture|verify> <edition> <file>');
    process.exit(2);
  }
  const current = capture(edition);
  if (cmd === 'capture') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(current, Object.keys(current).sort(), 2) + '\n');
    console.log(`captured ${Object.keys(current).length} ${edition} files -> ${file}`);
    return;
  }
  // verify
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const diffs = [];
  const savedKeys = new Set(Object.keys(saved));
  const curKeys = new Set(Object.keys(current));
  for (const k of savedKeys) {
    if (!curKeys.has(k)) diffs.push(`REMOVED: ${k}`);
    else if (saved[k] !== current[k]) diffs.push(`CHANGED: ${k}`);
  }
  for (const k of curKeys) {
    if (!savedKeys.has(k)) diffs.push(`ADDED:   ${k}`);
  }
  if (diffs.length) {
    console.error(`SNAPSHOT MISMATCH for "${edition}" (${diffs.length} diffs):`);
    for (const d of diffs.sort()) console.error(`  ${d}`);
    process.exit(1);
  }
  console.log(`snapshot verify ok: ${edition} (${Object.keys(current).length} files identical)`);
}

main();
