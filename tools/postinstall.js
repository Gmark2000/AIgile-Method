#!/usr/bin/env node
/**
 * Postinstall bootstrap for @mark-gozner/aigile-method
 *
 * Goal: Allow a single command install:
 *   npm install @mark-gozner/aigile-method
 * which automatically lays down .aigile-core and agents in the *consuming* project.
 *
 * Safeguards / Opt-outs:
 *   - Set AIGILE_NO_POSTINSTALL=1 to skip entirely
 *   - Set CI=true (common in pipelines) to skip (avoid polluting build images)
 *   - Set AIGILE_INSTALL_ARGS="--with-mcp" to pass extra flags
 *   - Set AIGILE_SILENT=1 to suppress non-error logging
 *
 * Behavior:
 *   1. Detect if running inside the package itself (development) -> if so, skip
 *   2. Otherwise invoke tools/cli.js install with optional flags
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');

function log(msg){ if(!process.env.AIGILE_SILENT) console.log(`[aigile-postinstall] ${msg}`); }
function warn(msg){ console.warn(`[aigile-postinstall] WARN: ${msg}`); }
function skip(reason){ log(`Skipped automatic install: ${reason}`); process.exit(0); }

// 1. Global skips
if(process.env.AIGILE_NO_POSTINSTALL === '1') skip('AIGILE_NO_POSTINSTALL=1');
if(process.env.CI === 'true') skip('CI=true');

// 2. Detect if we're inside the package's own repo (development scenario)
// Heuristic: presence of .git AND core/agents folder at same root as this script.
const devIndicators = [
  path.join(pkgRoot, '.git'),
  path.join(pkgRoot, 'core', 'agents')
];
const looksLikeDev = devIndicators.every(p => fs.existsSync(p));
if(looksLikeDev) skip('development workspace detected');

// 3. Determine project root (one level above node_modules/<this package>)
// process.cwd() during postinstall is the consuming project root for npm (unless workspaces alter it)
const projectRoot = process.cwd();
if(projectRoot.startsWith(pkgRoot)) {
  // Unusual but guard anyway
  skip('ambiguous install path (project root equals package root)');
}

// 4. Build args
const extra = process.env.AIGILE_INSTALL_ARGS ? process.env.AIGILE_INSTALL_ARGS.split(/\s+/).filter(Boolean) : [];
const cliPath = path.join(pkgRoot, 'tools', 'cli.js');
// Use 'install' command with --yes for non-interactive install
const args = [cliPath, 'install', '--yes'];
args.push(...extra);

log(`Running automatic install into consumer project: ${projectRoot}`);
log(`Command: node ${args.map(a => (a.includes(' ') ? '"'+a+'"' : a)).join(' ')}`);

const child = spawn(process.execPath, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  if(code === 0) log('AIgile installed successfully (postinstall).');
  else warn(`AIgile postinstall exited with code ${code}. You can rerun: npx @mark-gozner/aigile-method install`);
});
