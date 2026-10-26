import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('actual npm allowlist excludes untracked agents and stale generated outputs without deleting them', context => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile release space '));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  assert.ok(metadata.files.every(filename => !/[*!?]/.test(filename) && !filename.endsWith('/')));
  for (const relative of metadata.files) {
    assert.ok(fs.statSync(path.join(root, relative)).isFile(), relative);
    fs.mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    fs.copyFileSync(path.join(root, relative), path.join(directory, relative));
  }
  const extras = ['core/agents/local-only.agent.md', 'dist/agents/local-only.txt', 'plugin/agents/local-only.md', 'tools/local-only.js', 'package-lock.json'];
  for (const relative of extras) {
    fs.mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    fs.writeFileSync(path.join(directory, relative), 'user-owned sentinel');
  }
  const npmCli = process.env.AIGILE_NPM_CLI || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const result = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--ignore-scripts', '--json', '--cache', path.join(directory, 'cache')], { cwd: directory, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const names = JSON.parse(result.stdout)[0].files.map(file => file.path).sort();
  assert.deepEqual(names, [...metadata.files].sort());
  for (const relative of extras) {
    assert.equal(names.includes(relative), false, relative);
    assert.equal(fs.readFileSync(path.join(directory, relative), 'utf8'), 'user-owned sentinel');
  }
});