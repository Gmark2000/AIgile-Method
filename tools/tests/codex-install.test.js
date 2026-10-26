import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import TOML from '@iarna/toml';
import { frontmatter } from '../shared/client-assets.js';

const cli = process.env.AIGILE_TEST_CLI || fileURLToPath(new URL('../cli.js', import.meta.url));
function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile CLI space \u00e9 '));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function run(directory, args, status = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, CLAUDECODE: '', CLAUDE_CODE_ENTRYPOINT: '', KIRO_HOME: '', TERM_PROGRAM: '', AIGILE_ADD_SCRIPTS: '0' },
  });
  assert.equal(result.status, status, result.stdout + result.stderr);
  assert.ok((result.stdout + result.stderr).length > 0);
  return result.stdout + result.stderr;
}
function put(directory, relative, content) {
  fs.mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
  fs.writeFileSync(path.join(directory, relative), content);
}
const read = (directory, relative) => fs.readFileSync(path.join(directory, relative), 'utf8');
function snapshot(directory) {
  const result = {};
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(filename);
      else result[path.relative(directory, filename)] = fs.readFileSync(filename).toString('base64');
    }
  }
  walk(directory);
  return result;
}

test('Codex-only install preserves user files, parses roles and skills, and is byte-stable', context => {
  const directory = fixture(context);
  const original = '# User rules\r\nKeep these';
  put(directory, 'AGENTS.md', original);
  put(directory, '.codex/config.toml', '# User config\r\nmodel = "custom"\r\n');
  put(directory, '.agents/skills/mine/SKILL.md', 'user skill');
  put(directory, 'package.json', '{"name":"consumer","private":true}');
  run(directory, ['install', '--for-codex', '--yes']);
  assert.equal(fs.existsSync(path.join(directory, '.github')), false);
  assert.equal(fs.existsSync(path.join(directory, '.vscode')), false);
  assert.equal(read(directory, 'package.json'), '{"name":"consumer","private":true}');
  assert.equal(read(directory, '.codex/config.toml'), '# User config\r\nmodel = "custom"\r\n');
  assert.equal(read(directory, '.agents/skills/mine/SKILL.md'), 'user skill');
  assert.ok(read(directory, 'AGENTS.md').startsWith(original));
  const roles = fs.readdirSync(path.join(directory, '.codex/agents'));
  assert.ok(roles.length >= 15);
  for (const filename of roles) {
    const role = TOML.parse(read(directory, `.codex/agents/${filename}`));
    assert.equal(filename, `${role.name}.toml`);
    assert.ok(role.developer_instructions.includes('.aigile-core'));
  }
  for (const name of fs.readdirSync(path.join(directory, '.agents/skills')).filter(name => name !== 'mine')) {
    assert.equal(frontmatter(read(directory, `.agents/skills/${name}/SKILL.md`)).metadata.name, name);
  }
  const before = snapshot(directory);
  run(directory, ['update', '--for-codex', '--yes']);
  assert.deepEqual(snapshot(directory), before);
  assert.match(run(directory, ['status']), /codex:.*owned outputs/);
  run(directory, ['uninstall', '--for-codex']);
  assert.equal(read(directory, 'AGENTS.md'), original);
  assert.equal(read(directory, '.agents/skills/mine/SKILL.md'), 'user skill');
});

test('combined targets share ownership and Copilot uses native agents and modern prompts', context => {
  const directory = fixture(context);
  run(directory, ['install', '--for-codex', '--for-copilot', '--yes']);
  const dev = frontmatter(read(directory, '.github/agents/dev.agent.md'));
  assert.equal(dev.metadata.name, 'Full Stack Developer');
  assert.ok(Array.isArray(dev.metadata.tools));
  assert.equal(dev.metadata['user-invokable'], undefined);
  assert.equal(dev.metadata['user-invocable'], true);
  for (const filename of fs.readdirSync(path.join(directory, '.github/agents'))) {
    const agent = frontmatter(read(directory, `.github/agents/${filename}`));
    assert.ok(Array.isArray(agent.metadata.tools), filename);
    assert.ok(agent.metadata.tools.every(tool => typeof tool === 'string'), filename);
  }
  const packageRoot = path.resolve(path.dirname(cli), '..');
  const packaged = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'))).files;
  const canonical = packaged.filter(name => /^core\/agents\/.*\.md$/.test(name));
  const installed = fs.readdirSync(path.join(directory, '.github/agents'))
    .filter(name => canonical.includes(`core/agents/${name}`) || canonical.includes(`core/agents/${name.replace('.agent.md', '.md')}`))
    .map(name => frontmatter(read(directory, `.github/agents/${name}`)));
  const names = new Set(installed.map(agent => agent.metadata.name));
  for (const agent of installed) {
    for (const target of [...(Array.isArray(agent.metadata.agents) ? agent.metadata.agents : []), ...(agent.metadata.handoffs || []).map(handoff => handoff.agent)]) {
      assert.ok(names.has(target), `${agent.metadata.name} references unpackaged agent ${target}`);
    }
    if (/Orchestrator/.test(agent.metadata.name)) assert.deepEqual(agent.metadata.tools, ['agent', 'todo', 'vscode/askQuestions']);
  }
  assert.ok(fs.existsSync(path.join(directory, '.github/skills/aigile-copilot-goal/SKILL.md')));
  assert.equal(fs.existsSync(path.join(directory, '.vscode/mcp.json')), false);
  assert.equal(fs.existsSync(path.join(directory, '.mcp.json')), false);
  for (const name of fs.readdirSync(path.join(directory, '.github/prompts')).filter(name => name.endsWith('.prompt.md'))) {
    assert.equal(frontmatter(read(directory, `.github/prompts/${name}`)).metadata.mode, undefined);
  }
  const before = snapshot(directory);
  run(directory, ['install', '--for-codex', '--for-copilot', '--yes']);
  assert.deepEqual(snapshot(directory), before);
  run(directory, ['uninstall', '--for-codex']);
  assert.ok(fs.existsSync(path.join(directory, '.aigile-core/tasks')));
  assert.ok(fs.existsSync(path.join(directory, '.github/agents/dev.agent.md')));
  assert.equal(fs.existsSync(path.join(directory, '.codex/agents/aigile-dev.toml')), false);
});

test('MCP opt-in preserves comments and settings through update and removal', context => {
  const directory = fixture(context);
  const original = '# Personal settings\r\nmodel = "custom"\r\n[mcp_servers.mine]\r\nurl = "https://example.com"\r\n';
  put(directory, '.codex/config.toml', original);
  run(directory, ['init', '--for-codex', '--with-mcp']);
  const config = read(directory, '.codex/config.toml');
  assert.ok(config.startsWith(original));
  assert.equal(TOML.parse(config).model, 'custom');
  assert.equal(config.includes('${input:'), false);
  const before = snapshot(directory);
  run(directory, ['update', '--for-codex']);
  assert.deepEqual(snapshot(directory), before);
  run(directory, ['uninstall', '--for-codex']);
  assert.equal(read(directory, '.codex/config.toml'), original);
});

test('Copilot and Antigravity share MCP ownership through host switch and uninstall', context => {
  const directory = fixture(context);
  run(directory, ['install', '--for-copilot', '--for-antigravity', '--with-mcp']);
  const original = read(directory, '.vscode/mcp.json');
  run(directory, ['update', '--for-copilot', '--copilot-mcp-host=native']);
  assert.equal(read(directory, '.vscode/mcp.json'), original);
  run(directory, ['uninstall', '--for-copilot']);
  assert.equal(read(directory, '.vscode/mcp.json'), original);
  run(directory, ['uninstall', '--for-antigravity']);
  assert.equal(fs.existsSync(path.join(directory, '.vscode/mcp.json')), false);
});

test('conflicts and invalid MCP fail before writing generated output', context => {
  const directory = fixture(context);
  put(directory, '.codex/agents/aigile-dev.toml', 'user role');
  const before = snapshot(directory);
  assert.match(run(directory, ['install', '--for-codex', '--yes'], 1), /Preserved/);
  assert.deepEqual(snapshot(directory), before);
  fs.rmSync(path.join(directory, '.codex/agents/aigile-dev.toml'));
  put(directory, '.codex/config.toml', 'invalid TOML [');
  const invalid = snapshot(directory);
  run(directory, ['install', '--for-codex', '--with-mcp'], 1);
  assert.deepEqual(snapshot(directory), invalid);
});

test('sealed inline MCP settings get migration guidance without changing any bytes', context => {
  const directory = fixture(context);
  put(directory, '.codex/config.toml', '# Keep comment\r\nmcp_servers = { mine = { command = "user" } }\r\n');
  const before = snapshot(directory);
  assert.match(run(directory, ['install', '--for-codex', '--with-mcp', '--yes'], 1), /No files were changed.*explicit \[mcp_servers/);
  assert.deepEqual(snapshot(directory), before);
});

test('edited owned files are preserved by update and uninstall', context => {
  const directory = fixture(context);
  run(directory, ['codex']);
  put(directory, '.codex/agents/aigile-dev.toml', 'user edit');
  const before = snapshot(directory);
  run(directory, ['update', '--for-codex'], 1);
  assert.deepEqual(snapshot(directory), before);
  run(directory, ['uninstall', '--for-codex'], 1);
  assert.equal(read(directory, '.codex/agents/aigile-dev.toml'), 'user edit');
});

test('target detection, aliases and invalid flags do not fall back to Copilot', context => {
  const directory = fixture(context);
  fs.mkdirSync(path.join(directory, '.codex'));
  run(directory, ['auth-install', '--yes']);
  assert.ok(fs.existsSync(path.join(directory, '.codex/agents/aigile-dev.toml')));
  assert.equal(fs.existsSync(path.join(directory, '.github')), false);
  for (const args of [['install', '--for-typo'], ['install', '--for-codex', '--global'], ['install', '--for-codex', '--with-community-skills'], ['install', '--for-codex', '--with-mcp-settings'], ['uninstall'], ['skills:add', '--for-codex']]) {
    const before = snapshot(directory);
    run(directory, args, 1);
    assert.deepEqual(snapshot(directory), before);
  }
});

for (const target of ['copilot', 'claude', 'kiro', 'antigravity']) {
  test(`existing ${target} target installs and reinstalls unchanged`, context => {
    const directory = fixture(context);
    run(directory, ['install', `--for-${target}`, '--yes']);
    const before = snapshot(directory);
    run(directory, ['update', `--for-${target}`]);
    assert.deepEqual(snapshot(directory), before);
    assert.ok(JSON.parse(read(directory, '.aigile-manifest.json')).targets[target]);
  });
}

test('shared discovery markers alone retain default Copilot selection', context => {
  const directory = fixture(context);
  put(directory, 'AGENTS.md', '# User-only guidance');
  put(directory, '.agents/skills/mine/SKILL.md', 'user');
  run(directory, ['install', '--yes']);
  assert.equal(fs.existsSync(path.join(directory, '.codex')), false);
  assert.ok(fs.existsSync(path.join(directory, '.github/agents/dev.agent.md')));
  assert.equal(read(directory, 'AGENTS.md'), '# User-only guidance');
});

for (const combined of [false, true]) {
  test(`implicit update does not rediscover removed Codex (combined=${combined})`, context => {
    const directory = fixture(context);
    run(directory, ['install', '--for-codex', ...(combined ? ['--for-copilot'] : []), '--yes']);
    run(directory, ['uninstall', '--for-codex']);
    assert.ok(fs.existsSync(path.join(directory, '.codex')));
    const before = snapshot(directory);
    run(directory, ['update', '--yes']);
    assert.deepEqual(snapshot(directory), before);
    assert.deepEqual(Object.keys(JSON.parse(read(directory, '.aigile-manifest.json')).targets), combined ? ['copilot'] : []);
  });
}

test('legacy Claude detection and combined lifecycle never acquire deletion rights to shared bytes', context => {
  const directory = fixture(context);
  run(directory, ['install', '--for-claude', '--yes']);
  put(directory, '.aigile-manifest.json', JSON.stringify({ name: '@mark-gozner/aigile-method', version: '1.4.0', format: 'agents', agents: ['dev'], customAgents: 0, claude: { agents: 18, skills: 6, claudeMd: true }, mcp: { serversJson: false, mockSettings: false } }));
  const legacy = snapshot(directory);
  run(directory, ['install', '--for-codex', '--yes']);
  let manifest = JSON.parse(read(directory, '.aigile-manifest.json'));
  assert.equal(manifest.targets.claude.legacy, true);
  assert.equal(Object.keys(manifest.files).some(name => name.startsWith('.aigile-core/')), false);
  run(directory, ['update', '--yes']);
  run(directory, ['uninstall', '--for-codex']);
  manifest = JSON.parse(read(directory, '.aigile-manifest.json'));
  assert.ok(manifest.targets.claude);
  const afterCodex = snapshot(directory);
  for (const [filename, bytes] of Object.entries(legacy)) {
    if (filename !== '.aigile-manifest.json') assert.equal(afterCodex[filename], bytes, filename);
  }
  run(directory, ['uninstall', '--for-claude']);
  const afterClaude = snapshot(directory);
  for (const [filename, bytes] of Object.entries(legacy)) {
    if (filename !== '.aigile-manifest.json') assert.equal(afterClaude[filename], bytes, filename);
  }
});

test('Copilot partial uninstall retains edited GitHub server input ownership', context => {
  const directory = fixture(context);
  run(directory, ['install', '--for-copilot', '--with-mcp']);
  const manifest = JSON.parse(read(directory, '.aigile-manifest.json'));
  const inputKey = Object.keys(manifest.files).find(key => key.includes('#json:["inputs","github_com_personal_access_token"'));
  const config = JSON.parse(read(directory, '.vscode/mcp.json'));
  config.servers['github.com'].env.GITHUB_DYNAMIC_TOOLSETS = '0';
  put(directory, '.vscode/mcp.json', JSON.stringify(config));
  const before = snapshot(directory);
  run(directory, ['update', '--for-copilot', '--copilot-mcp-host=native'], 1);
  assert.deepEqual(snapshot(directory), before);
  run(directory, ['uninstall', '--for-copilot'], 1);
  const remaining = JSON.parse(read(directory, '.vscode/mcp.json'));
  assert.equal(remaining.servers['github.com'].env.GITHUB_DYNAMIC_TOOLSETS, '0');
  assert.ok(remaining.inputs.some(input => input.id === 'github_com_personal_access_token'));
  assert.deepEqual(JSON.parse(read(directory, '.aigile-manifest.json')).files[inputKey], manifest.files[inputKey]);
});

test('Copilot host switch retains inputs referenced by unowned nested server values', context => {
  const directory = fixture(context);
  run(directory, ['install', '--for-copilot', '--with-mcp']);
  const config = JSON.parse(read(directory, '.vscode/mcp.json'));
  config.servers.mine = { command: 'user', args: ['${input:github_com_personal_access_token}'], env: { NESTED: { headers: { Authorization: 'Bearer ${input:github_com_personal_access_token}' } } } };
  config.inputs.push({ id: 'mine', type: 'promptString' });
  put(directory, '.vscode/mcp.json', JSON.stringify(config));
  run(directory, ['update', '--for-copilot', '--copilot-mcp-host=native']);
  let remaining = JSON.parse(read(directory, '.vscode/mcp.json'));
  assert.deepEqual(remaining.inputs.map(input => input.id).sort(), ['github_com_personal_access_token', 'mine']);
  remaining.inputs[0].description = 'user input edit';
  put(directory, '.vscode/mcp.json', JSON.stringify(remaining));
  const before = snapshot(directory);
  run(directory, ['update', '--for-copilot', '--copilot-mcp-host=vscode'], 1);
  assert.deepEqual(snapshot(directory), before);
  run(directory, ['uninstall', '--for-copilot'], 1);
  remaining = JSON.parse(read(directory, '.vscode/mcp.json'));
  assert.equal(remaining.inputs[0].description, 'user input edit');
  assert.ok(remaining.inputs.some(input => input.id === 'mine'));
});

test('Copilot MCP flag validates opt-in and retains host through safe lifecycle', context => {
  const directory = fixture(context);
  for (const args of [
    ['--for-copilot', '--copilot-mcp-host=native'],
    ['--for-codex', '--with-mcp', '--copilot-mcp-host=native'],
    ['--for-copilot', '--with-mcp', '--copilot-mcp-host=bad'],
    ['--for-copilot', '--with-mcp', '--copilot-mcp-host=native=extra'],
    ['--for-copilot', '--with-mcp', '--copilot-mcp-host'],
  ]) {
    run(directory, ['install', ...args], 1);
    assert.deepEqual(snapshot(directory), {});
  }
  put(directory, '.vscode/mcp.json', JSON.stringify({ custom: true, servers: { mine: { command: 'user' } } }));
  put(directory, '.mcp.json', JSON.stringify({ custom: 'native user', mcpServers: { mine: { command: 'user', args: [], tools: [] } } }));
  run(directory, ['install', '--for-copilot', '--with-mcp', '--yes']);
  assert.equal(JSON.parse(read(directory, '.vscode/mcp.json')).servers.mine.command, 'user');
  assert.equal(JSON.parse(read(directory, '.aigile-manifest.json')).targets.copilot.mcpHost, 'vscode');
  const before = snapshot(directory);
  run(directory, ['update', '--for-copilot']);
  assert.deepEqual(snapshot(directory), before);
  const output = run(directory, ['update', '--for-copilot', '--copilot-mcp-host', 'native']);
  assert.equal((output.match(/Skipped MCP /g) || []).length, 3);
  const nativeServers = JSON.parse(read(directory, '.mcp.json')).mcpServers;
  assert.deepEqual(Object.keys(nativeServers).sort(), ['memory', 'mine', 'playwright', 'sequentialthinking']);
  for (const name of ['playwright', 'memory', 'sequentialthinking']) assert.deepEqual(nativeServers[name].tools, ['*']);
  assert.equal(JSON.parse(read(directory, '.aigile-manifest.json')).targets.copilot.mcpHost, 'native');
  assert.deepEqual(JSON.parse(read(directory, '.vscode/mcp.json')), { custom: true, servers: { mine: { command: 'user' } } });
  const native = snapshot(directory);
  run(directory, ['update', '--for-copilot']);
  assert.deepEqual(snapshot(directory), native);
  run(directory, ['uninstall', '--for-copilot']);
  assert.equal(JSON.parse(read(directory, '.mcp.json')).custom, 'native user');
});

test('Copilot MCP collisions and modified owned servers block all destination writes', context => {
  const directory = fixture(context);
  put(directory, '.vscode/mcp.json', JSON.stringify({ servers: { playwright: { command: 'user' } } }));
  const collision = snapshot(directory);
  run(directory, ['install', '--for-copilot', '--with-mcp'], 1);
  assert.deepEqual(snapshot(directory), collision);
  fs.rmSync(path.join(directory, '.vscode/mcp.json'));
  run(directory, ['install', '--for-copilot', '--with-mcp']);
  const config = JSON.parse(read(directory, '.vscode/mcp.json'));
  config.servers.playwright.command = 'edited';
  put(directory, '.vscode/mcp.json', JSON.stringify(config));
  const edited = snapshot(directory);
  run(directory, ['update', '--for-copilot', '--copilot-mcp-host=native'], 1);
  assert.deepEqual(snapshot(directory), edited);
  run(directory, ['uninstall', '--for-copilot'], 1);
  assert.equal(JSON.parse(read(directory, '.vscode/mcp.json')).servers.playwright.command, 'edited');
});

test('native MCP fixtures merge, switch hosts, preserve multiple targets and remove only owned entries', context => {
  const sourceRoot = path.resolve(path.dirname(cli), '..');
  const packageRoot = fixture(context);
  const metadata = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json')));
  for (const filename of metadata.files.filter(filename => /^(core\/|tools\/|mcp\/|package.json$)/.test(filename))) {
    const target = path.join(packageRoot, filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, filename), target);
  }
  fs.symlinkSync(path.join(sourceRoot, 'node_modules'), path.join(packageRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const catalogPath = path.join(packageRoot, 'mcp/servers.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath));
  for (const server of Object.values(catalog.servers)) server.tools = ['inspect'];
  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  const directory = fixture(context);
  const invoke = (args, status = 0) => {
    const result = spawnSync(process.execPath, [path.join(packageRoot, 'tools/cli.js'), ...args], { cwd: directory, encoding: 'utf8', env: { ...process.env, AIGILE_ADD_SCRIPTS: '0' } });
    assert.equal(result.status, status, result.stdout + result.stderr);
    return result.stdout + result.stderr;
  };
  put(directory, '.mcp.json', JSON.stringify({ custom: 42, mcpServers: { mine: { command: 'user', args: [], tools: [] }, playwright: { command: 'collision', args: [], tools: [] } } }));
  const collision = snapshot(directory);
  invoke(['install', '--for-copilot', '--with-mcp', '--copilot-mcp-host=native'], 1);
  assert.deepEqual(snapshot(directory), collision);
  put(directory, '.mcp.json', JSON.stringify({ custom: 42, mcpServers: { mine: { command: 'user', args: [], tools: [] } } }));
  const output = invoke(['install', '--for-copilot', '--for-codex', '--with-mcp', '--copilot-mcp-host=native']);
  assert.match(output, /unsupported interpolation/);
  const config = JSON.parse(read(directory, '.mcp.json'));
  assert.deepEqual(config.mcpServers.playwright.tools, ['inspect']);
  assert.equal(config.mcpServers.atlassian, undefined);
  assert.equal(config.custom, 42);
  assert.equal(fs.existsSync(path.join(directory, '.vscode/mcp.json')), false);
  const nativeBytes = read(directory, '.mcp.json');
  config.mcpServers.playwright.command = 'user edit';
  put(directory, '.mcp.json', JSON.stringify(config));
  const edited = snapshot(directory);
  invoke(['update', '--for-copilot', '--copilot-mcp-host=vscode'], 1);
  assert.deepEqual(snapshot(directory), edited);
  put(directory, '.mcp.json', nativeBytes);
  const before = snapshot(directory);
  invoke(['update']);
  assert.deepEqual(snapshot(directory), before);
  invoke(['update', '--for-copilot', '--copilot-mcp-host=vscode']);
  assert.deepEqual(JSON.parse(read(directory, '.mcp.json')), { custom: 42, mcpServers: { mine: { command: 'user', args: [], tools: [] } } });
  assert.ok(JSON.parse(read(directory, '.vscode/mcp.json')).servers.playwright);
  invoke(['uninstall', '--for-copilot']);
  assert.ok(fs.existsSync(path.join(directory, '.codex/config.toml')));
  assert.ok(fs.existsSync(path.join(directory, '.aigile-core/tasks')));
  assert.equal(fs.existsSync(path.join(directory, '.vscode/mcp.json')), false);
  catalog.servers = { auth: { command: 'test', args: [], env: { TOKEN: '${input:token}' } } };
  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  for (const document of [{ mcpServers: [] }, { mcpServers: null }, { mcpServers: { bad: { command: 'test', args: [], tools: [], env: null } } }, { mcpServers: { bad: { command: 'test', args: [], tools: [], cwd: 12 } } }, { mcpServers: { bad: { command: 'test', args: [], tools: [], timeout: 'bad' } } }]) {
    put(directory, '.mcp.json', JSON.stringify(document) + '\r\n ');
    const malformed = snapshot(directory);
    invoke(['install', '--for-copilot', '--with-mcp', '--copilot-mcp-host=native'], 1);
    assert.deepEqual(snapshot(directory), malformed);
  }
  fs.rmSync(path.join(directory, '.mcp.json'));
  invoke(['install', '--for-copilot', '--with-mcp', '--copilot-mcp-host=native']);
  assert.equal(fs.existsSync(path.join(directory, '.mcp.json')), false);
});