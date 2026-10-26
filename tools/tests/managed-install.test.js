import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyManagedPlan, safePath } from '../shared/managed-install.js';

function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile managed space '));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
const entry = (content = 'generated', owners = ['codex']) => ({ path: '.aigile-core/test.md', content, owners });
const options = { targets: { codex: { agents: true } }, version: 'test' };

test('surviving servers retain managed input dependencies and original ownership hashes', context => {
  const root = fixture(context);
  const jsonEntry = (section, name, value) => ({ path: '.vscode/mcp.json', jsonPath: [section, name], content: JSON.stringify(value), owners: ['codex'] });
  const input = jsonEntry('inputs', 'token', { id: 'token', type: 'promptString' });
  const server = jsonEntry('servers', 'github', { command: 'test', env: { TOKEN: '${input:token}' } });
  const initial = applyManagedPlan(root, [input, server], options).manifest;
  const filename = path.join(root, input.path);
  const document = JSON.parse(fs.readFileSync(filename));
  document.servers.github.args = ['changed', { headers: { Authorization: 'Bearer ${input:token}' } }];
  fs.writeFileSync(filename, JSON.stringify(document));
  const result = applyManagedPlan(root, [], { ...options, uninstall: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)).inputs, document.inputs);
  const inputKey = Object.keys(initial.files).find(key => key.includes('#json:["inputs"'));
  assert.deepEqual(result.manifest.files[inputKey], initial.files[inputKey]);
  document.servers = {};
  document.local = true;
  fs.writeFileSync(filename, JSON.stringify(document));
  applyManagedPlan(root, [], { ...options, uninstall: true });
  assert.equal(JSON.parse(fs.readFileSync(filename)).inputs, undefined);
});

test('input dependency traversal matches exact syntax and preserves user and shared inputs', context => {
  const root = fixture(context);
  const filename = path.join(root, '.vscode/mcp.json');
  const input = (name, owners = ['codex']) => ({ path: '.vscode/mcp.json', jsonPath: ['inputs', name], content: JSON.stringify({ id: name, type: 'promptString' }), owners });
  applyManagedPlan(root, [input('token'), input('nested'), input('shared', ['codex', 'copilot'])], options);
  const document = JSON.parse(fs.readFileSync(filename));
  document.inputs.push({ id: 'user', type: 'promptString' });
  document.servers = { mine: { args: ['${input:token-extra}', 'input:token', '${input:token'], env: { KEY: '${env:token}' }, headers: { nested: ['Bearer ${input:nested}'] }, '${input:token}': 'key is not a reference value' } };
  fs.writeFileSync(filename, JSON.stringify(document));
  applyManagedPlan(root, [], { ...options, uninstall: true });
  const remaining = JSON.parse(fs.readFileSync(filename));
  assert.deepEqual(remaining.inputs.map(item => item.id), ['nested', 'shared', 'user']);
  const records = Object.values(JSON.parse(fs.readFileSync(path.join(root, '.aigile-manifest.json'))).files);
  assert.deepEqual(records.find(record => record.jsonPath[1] === 'shared').owners, ['copilot']);
  delete remaining.servers;
  fs.writeFileSync(filename, JSON.stringify(remaining));
  applyManagedPlan(root, [], { ...options, uninstall: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)).inputs.map(item => item.id), ['shared', 'user']);
});

test('backup and replacement writes explicitly request owner-only permissions', context => {
  const root = fixture(context);
  const filename = path.join(root, 'private.toml');
  fs.writeFileSync(filename, '# local settings\n', { mode: 0o600 });
  const write = fs.writeFileSync;
  const writes = [];
  context.mock.method(fs, 'writeFileSync', (destination, content, settings) => {
    writes.push({ backup: destination.endsWith('.bak'), ...settings });
    return write(destination, content, settings);
  });
  applyManagedPlan(root, [{ path: 'private.toml', content: '# START\nmanaged = true\n# END', markers: ['# START', '# END'], owners: ['codex'] }], options);
  assert.ok(writes.some(settings => settings.backup));
  assert.ok(writes.some(settings => !settings.backup));
  for (const settings of writes) {
    assert.equal(settings.flag, 'wx');
    assert.equal(settings.mode, 0o600);
  }
});

function checkPermissionLifecycle(context, scenario, mode = 0o600) {
  const root = fixture(context);
  const filename = path.join(root, '.codex/config.toml');
  const manifestPath = path.join(root, '.aigile-manifest.json');
  const original = '# local settings\n';
  const block = { path: '.codex/config.toml', content: '# START\nmanaged = true\n# END', markers: ['# START', '# END'], owners: ['codex'] };
  const role = { path: '.codex/agents/reviewer.toml', content: 'name = "reviewer"\n', owners: ['codex'] };
  const previousUmask = process.umask(0o022);
  try {
    fs.mkdirSync(path.dirname(filename));
    fs.writeFileSync(filename, original, { mode });
    const write = fs.writeFileSync;
    const rename = fs.renameSync;
    const writes = [];
    const backups = new Map();
    context.mock.method(fs, 'writeFileSync', (destination, content, settings) => {
      writes.push({ destination, ...settings });
      const result = write(destination, content, settings);
      if (destination.endsWith('.bak')) backups.set(destination, Buffer.from(content));
      return result;
    });
    const uninstall = scenario.includes('uninstall');
    if (uninstall) applyManagedPlan(root, [block, role], options);
    const before = fs.readFileSync(filename);
    const manifestBefore = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : null;
    const fails = scenario.includes('rollback');
    const retain = scenario === 'rollback retained';
    context.mock.method(fs, 'renameSync', (source, destination) => {
      if (process.platform !== 'win32') {
        const expected = destination === filename ? mode : 0o600;
        assert.equal(fs.statSync(source).mode & 0o777, expected);
      }
      if (fails && destination === manifestPath) throw new Error('injected manifest failure');
      if (retain && source.endsWith('.restore.tmp')) throw new Error('injected restore failure');
      return rename(source, destination);
    });
    const run = () => applyManagedPlan(root, uninstall ? [] : [block, role], { ...options, uninstall });
    if (fails) assert.throws(run, retain ? /Rollback incomplete:.*Recovery backups:/ : /injected manifest failure/);
    else run();
    if (fails && !retain) assert.ok(fs.readFileSync(filename).equals(before), 'original bytes restored');
    if (!fails && uninstall) assert.ok(fs.readFileSync(filename).equals(Buffer.from(original)), 'uninstall preserves local bytes');
    if (!fails && !uninstall) assert.ok(fs.readFileSync(filename, 'utf8').includes(block.content));
    if (fails) {
      assert.equal(fs.existsSync(manifestPath), manifestBefore !== null);
      if (manifestBefore) assert.ok(fs.readFileSync(manifestPath).equals(manifestBefore), 'manifest restored');
    }
    assert.ok(writes.some(settings => settings.destination.endsWith('.bak')));
    assert.ok(writes.some(settings => settings.destination.endsWith('.tmp')));
    for (const settings of writes) {
      assert.equal(settings.flag, 'wx');
      assert.equal(settings.mode, settings.destination.startsWith(`${filename}.`) ? mode & 0o600 : 0o600);
    }
    const retained = [...backups.keys()].filter(backup => fs.existsSync(backup));
    assert.equal(retained.length > 0, retain);
    for (const backup of retained) {
      assert.ok(fs.readFileSync(backup).equals(backups.get(backup)), 'backup retains original bytes');
      if (process.platform !== 'win32') assert.equal(fs.statSync(backup).mode & 0o777, backup.startsWith(`${filename}.`) ? mode & 0o600 : 0o600);
    }
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(filename).mode & 0o777, mode);
      for (const relative of ['.aigile-manifest.json', role.path]) {
        const generated = path.join(root, relative);
        if (fs.existsSync(generated)) assert.equal(fs.statSync(generated).mode & 0o777, 0o600);
      }
    }
  } finally {
    context.mock.restoreAll();
    process.umask(previousUmask);
  }
}

const permissionScenarios = ['commit', 'uninstall', 'rollback', 'uninstall rollback', 'rollback retained'];
for (const scenario of permissionScenarios) {
  test(`private file permission policy through ${scenario}`, context => {
    checkPermissionLifecycle(context, scenario);
  });
}

test('rollback preserves concurrent permission restrictions and retains private backup', context => {
  const root = fixture(context);
  const filename = path.join(root, 'private.toml');
  fs.writeFileSync(filename, '# local settings\n', { mode: 0o600 });
  const rename = fs.renameSync;
  context.mock.method(fs, 'renameSync', (source, destination) => {
    if (destination.endsWith('.aigile-manifest.json')) {
      fs.chmodSync(filename, 0o400);
      throw new Error('injected manifest failure');
    }
    return rename(source, destination);
  });
  try {
    assert.throws(() => applyManagedPlan(root, [{ path: 'private.toml', content: '# START\nmanaged = true\n# END', markers: ['# START', '# END'], owners: ['codex'] }], options), /Rollback incomplete:.*Concurrent edit detected: private.toml.*Recovery backups:/);
    assert.equal(fs.statSync(filename).mode & 0o200, 0);
    const backups = fs.readdirSync(root).filter(name => name.endsWith('.bak'));
    assert.equal(backups.length, 1);
    const backup = path.join(root, backups[0]);
    assert.ok(fs.readFileSync(backup).equals(Buffer.from('# local settings\n')));
    if (process.platform !== 'win32') assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
  } finally {
    fs.chmodSync(filename, 0o600);
  }
});

for (const mode of [0o600, 0o640, 0o400]) {
  test(`POSIX mode ${mode.toString(8)} survives lifecycle with umask 022`, { skip: process.platform === 'win32' }, context => {
    for (const scenario of permissionScenarios) checkPermissionLifecycle(context, scenario, mode);
  });
}

test('Windows read-only destination is refused without clearing its attribute', { skip: process.platform !== 'win32' }, context => {
  const root = fixture(context);
  const filename = path.join(root, 'private.toml');
  fs.writeFileSync(filename, '# local settings\n');
  fs.chmodSync(filename, 0o400);
  try {
    const write = context.mock.method(fs, 'writeFileSync');
    const chmod = context.mock.method(fs, 'chmodSync');
    assert.throws(() => applyManagedPlan(root, [{ path: 'private.toml', content: '# START\nmanaged = true\n# END', markers: ['# START', '# END'], owners: ['codex'] }], options), /Refusing read-only destination/);
    assert.equal(write.mock.callCount(), 0);
    assert.equal(chmod.mock.callCount(), 0);
    assert.equal(fs.statSync(filename).mode & 0o200, 0);
    assert.ok(fs.readFileSync(filename).equals(Buffer.from('# local settings\n')));
  } finally {
    context.mock.restoreAll();
    fs.chmodSync(filename, 0o600);
  }
});

for (const failure of ['second rename', 'manifest write', 'manifest rename']) {
  test(`commit rolls back updates, creations and deletions on ${failure}`, context => {
    const root = fixture(context);
    const asset = (filename, content) => ({ path: filename, content, owners: ['codex'] });
    applyManagedPlan(root, [asset('first.md', 'old first'), asset('second.md', 'old second'), asset('deleted.md', 'keep me')], options);
    const manifestBefore = fs.readFileSync(path.join(root, '.aigile-manifest.json'));
    const rename = fs.renameSync;
    const write = fs.writeFileSync;
    let renames = 0;
    let injected = false;
    const fail = () => { injected = true; throw Object.assign(new Error('injected EPERM'), { code: 'EPERM' }); };
    context.mock.method(fs, 'renameSync', (source, destination) => {
      renames++;
      if (!injected && ((failure === 'second rename' && renames === 2) || (failure === 'manifest rename' && destination.endsWith('.aigile-manifest.json')))) fail();
      return rename(source, destination);
    });
    context.mock.method(fs, 'writeFileSync', (filename, ...args) => {
      if (!injected && failure === 'manifest write' && filename.includes('.aigile-manifest.json.') && filename.endsWith('.tmp')) fail();
      return write(filename, ...args);
    });
    assert.throws(() => applyManagedPlan(root, [asset('new.md', 'new'), asset('first.md', 'new first'), asset('second.md', 'new second')], options), /injected EPERM/);
    assert.equal(fs.readFileSync(path.join(root, 'first.md'), 'utf8'), 'old first');
    assert.equal(fs.readFileSync(path.join(root, 'second.md'), 'utf8'), 'old second');
    assert.equal(fs.readFileSync(path.join(root, 'deleted.md'), 'utf8'), 'keep me');
    assert.equal(fs.existsSync(path.join(root, 'new.md')), false);
    assert.deepEqual(fs.readFileSync(path.join(root, '.aigile-manifest.json')), manifestBefore);
    assert.deepEqual(fs.readdirSync(root).sort(), ['.aigile-manifest.json', 'deleted.md', 'first.md', 'second.md']);
  });
}

test('managed install is byte-stable, updates owned output and refuses edits before any write', context => {
  const root = fixture(context);
  applyManagedPlan(root, [entry()], options);
  const before = fs.readFileSync(path.join(root, '.aigile-manifest.json'));
  assert.equal(applyManagedPlan(root, [entry()], options).changed, 0);
  assert.deepEqual(fs.readFileSync(path.join(root, '.aigile-manifest.json')), before);
  applyManagedPlan(root, [entry('updated')], options);
  fs.writeFileSync(path.join(root, '.aigile-core/test.md'), 'user edit');
  assert.throws(() => applyManagedPlan(root, [entry(), { path: 'other.md', content: 'no', owners: ['codex'] }], options), /Preserved/);
  assert.equal(fs.existsSync(path.join(root, 'other.md')), false);
  assert.equal(fs.readFileSync(path.join(root, '.aigile-core/test.md'), 'utf8'), 'user edit');
});

for (const rollbackFails of [false, true]) {
  test(`two-file update retains recoverable originals when rollback fails=${rollbackFails}`, context => {
    const root = fixture(context);
    const assets = content => ['first.md', 'second.md'].map(filename => ({ path: filename, content, owners: ['codex'] }));
    applyManagedPlan(root, assets('old'), options);
    const originalManifest = fs.readFileSync(path.join(root, '.aigile-manifest.json'));
    const rename = fs.renameSync;
    let calls = 0;
    context.mock.method(fs, 'renameSync', (source, destination) => {
      calls++;
      if (calls === 2 || (rollbackFails && source.endsWith('.restore.tmp'))) throw Object.assign(new Error('injected EPERM'), { code: 'EPERM' });
      return rename(source, destination);
    });
    const remove = fs.rmSync;
    context.mock.method(fs, 'rmSync', (filename, ...args) => {
      if (rollbackFails && filename.endsWith('.tmp')) throw new Error('cleanup EPERM');
      return remove(filename, ...args);
    });
    assert.throws(() => applyManagedPlan(root, assets('new'), options), rollbackFails ? /Rollback incomplete:.*Recovery backups:.*Temporary-file cleanup failed:/ : /injected EPERM/);
    assert.equal(fs.readFileSync(path.join(root, 'second.md'), 'utf8'), 'old');
    assert.deepEqual(fs.readFileSync(path.join(root, '.aigile-manifest.json')), originalManifest);
    assert.equal(fs.readFileSync(path.join(root, 'first.md'), 'utf8'), rollbackFails ? 'new' : 'old');
    const backups = fs.readdirSync(root).filter(filename => filename.endsWith('.bak'));
    if (rollbackFails) {
      assert.equal(fs.readFileSync(path.join(root, backups.find(filename => filename.startsWith('first.md.'))), 'utf8'), 'old');
    } else assert.deepEqual(backups, []);
  });
}

test('managed blocks preserve CRLF and surrounding bytes through update and uninstall', context => {
  const root = fixture(context);
  const original = '# User\r\nRules without trailing newline';
  fs.writeFileSync(path.join(root, 'AGENTS.md'), original);
  const block = { path: 'AGENTS.md', content: '<!-- START -->\nAIgile\n<!-- END -->', markers: ['<!-- START -->', '<!-- END -->'], owners: ['codex'] };
  applyManagedPlan(root, [block], options);
  applyManagedPlan(root, [{ ...block, content: block.content.replace('AIgile', 'Updated') }], options);
  applyManagedPlan(root, [], { ...options, uninstall: true });
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), original);
});

for (const uninstall of [false, true]) {
  test(`manifest commit failure restores lifecycle state (uninstall=${uninstall})`, context => {
    const root = fixture(context);
    const original = '# User settings\r\nmodel = "custom"\r\n';
    fs.mkdirSync(path.join(root, '.codex'));
    fs.writeFileSync(path.join(root, '.codex/config.toml'), original);
    const block = { path: '.codex/config.toml', content: '# START\n[mcp_servers.aigile]\ncommand="test"\n# END', markers: ['# START', '# END'], owners: ['codex'] };
    if (uninstall) applyManagedPlan(root, [entry(), block], options);
    const configBefore = fs.readFileSync(path.join(root, '.codex/config.toml'));
    const manifestPath = path.join(root, '.aigile-manifest.json');
    const manifestBefore = uninstall ? fs.readFileSync(manifestPath) : null;
    const rename = fs.renameSync;
    context.mock.method(fs, 'renameSync', (source, destination) => {
      if (destination === manifestPath && source.endsWith('.tmp')) throw new Error('manifest EPERM');
      return rename(source, destination);
    });
    assert.throws(() => applyManagedPlan(root, uninstall ? [] : [entry(), block], { ...options, uninstall }), /manifest EPERM/);
    assert.deepEqual(fs.readFileSync(path.join(root, '.codex/config.toml')), configBefore);
    assert.equal(fs.existsSync(path.join(root, '.aigile-core/test.md')), uninstall);
    assert.equal(fs.existsSync(manifestPath), uninstall);
    if (uninstall) assert.deepEqual(fs.readFileSync(manifestPath), manifestBefore);
  });
}

test('shared owners retain resources and uninstall preserves modified files', context => {
  const root = fixture(context);
  applyManagedPlan(root, [entry('shared', ['codex', 'copilot'])], { ...options, targets: { codex: {}, copilot: {} } });
  applyManagedPlan(root, [], { ...options, uninstall: true });
  assert.equal(fs.readFileSync(path.join(root, '.aigile-core/test.md'), 'utf8'), 'shared');
  fs.writeFileSync(path.join(root, '.aigile-core/test.md'), 'user');
  const result = applyManagedPlan(root, [], { ...options, targets: { copilot: {} }, uninstall: true });
  assert.deepEqual(result.conflicts, ['.aigile-core/test.md']);
  assert.ok(result.manifest.targets.copilot);
});

test('legacy manifests and identical bytes do not prove ownership', context => {
  const root = fixture(context);
  fs.writeFileSync(path.join(root, '.aigile-manifest.json'), JSON.stringify({ version: 'old', customAgents: 20 }));
  fs.mkdirSync(path.join(root, '.aigile-core'));
  fs.writeFileSync(path.join(root, '.aigile-core/test.md'), 'user');
  assert.throws(() => applyManagedPlan(root, [entry()], options), /Preserved/);
  applyManagedPlan(root, [entry('user')], options);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.aigile-manifest.json'))).schemaVersion, 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.aigile-manifest.json'))).files, {});
  applyManagedPlan(root, [], { ...options, uninstall: true });
  assert.equal(fs.readFileSync(path.join(root, '.aigile-core/test.md'), 'utf8'), 'user');
});

test('unsafe paths and malformed markers are rejected', context => {
  const root = fixture(context);
  for (const value of ['../outside', '/absolute', 'C:/outside', 'a/../../b', 'a\\b']) assert.throws(() => safePath(root, value), /Unsafe/);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '<!-- START --><!-- START --><!-- END -->');
  assert.throws(() => applyManagedPlan(root, [{ path: 'AGENTS.md', owners: ['codex'], content: '', markers: ['<!-- START -->', '<!-- END -->'] }], options), /markers/);
});

test('symlinked directories and malformed ownership ledgers are rejected', context => {
  const root = fixture(context);
  const outside = fixture(context);
  fs.symlinkSync(outside, `${root}/linked`, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => safePath(root, 'linked/output.md'), /symlink/);
  fs.rmSync(outside, { recursive: true, force: true });
  assert.throws(() => safePath(root, 'linked/output.md'), /symlink/);
  for (const manifest of [null, [], { schemaVersion: 2 }, { schemaVersion: 2, files: { bad: null }, targets: {} }]) {
    fs.writeFileSync(`${root}/.aigile-manifest.json`, JSON.stringify(manifest));
    assert.throws(() => applyManagedPlan(root, [entry()], options), /Invalid ownership manifest/);
  }
});