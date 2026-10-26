import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import { applyManagedPlan } from '../shared/managed-install.js';
import { modernizeAgent, modernizePrompt, frontmatter, clientSkills, codexRole, codexMcp, copilotMcp, collectSources } from '../shared/client-assets.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('managed JSON entries preserve unrelated servers and reject edits before writes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile JSON '));
  const filename = path.join(directory, '.mcp.json');
  const entry = { path: '.mcp.json', jsonPath: ['mcpServers', 'aigile-test'], content: JSON.stringify({ command: 'test' }), owners: ['copilot'] };
  const options = { targets: { copilot: { mcp: true } }, version: '1.5.0' };
  try {
    fs.writeFileSync(filename, JSON.stringify({ custom: true, mcpServers: { mine: { command: 'user' } } }));
    applyManagedPlan(directory, [entry], options);
    assert.equal(JSON.parse(fs.readFileSync(filename)).mcpServers.mine.command, 'user');
    const before = fs.readFileSync(filename);
    applyManagedPlan(directory, [entry], options);
    assert.deepEqual(fs.readFileSync(filename), before);
    const edited = JSON.parse(before);
    edited.mcpServers['aigile-test'].command = 'user edit';
    fs.writeFileSync(filename, JSON.stringify(edited));
    assert.throws(() => applyManagedPlan(directory, [entry, { path: 'new.txt', content: 'new', owners: ['copilot'] }], options), /Preserved/);
    assert.equal(fs.existsSync(path.join(directory, 'new.txt')), false);
    fs.writeFileSync(filename, before);
    applyManagedPlan(directory, [], { ...options, uninstall: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(filename)), { custom: true, mcpServers: { mine: { command: 'user' } } });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('legacy whole-file MCP migrates unchanged ownership and preserves edits on host switches', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile legacy MCP '));
  const filename = path.join(directory, '.vscode/mcp.json');
  const options = { targets: { copilot: { mcp: true } }, version: '1.5.0' };
  try {
    const content = JSON.stringify({ servers: { test: { command: 'old' } }, inputs: [{ id: 'token', type: 'promptString' }] });
    applyManagedPlan(directory, [{ path: '.vscode/mcp.json', content, owners: ['copilot'] }], options);
    fs.writeFileSync(filename, content + ' ');
    assert.throws(() => applyManagedPlan(directory, [], options), /modified owned MCP/);
    assert.equal(fs.readFileSync(filename, 'utf8'), content + ' ');
    fs.writeFileSync(filename, content);
    applyManagedPlan(directory, [{ path: '.vscode/mcp.json', jsonPath: ['servers', 'test'], content: JSON.stringify({ command: 'new' }), owners: ['copilot'] }], options);
    assert.deepEqual(JSON.parse(fs.readFileSync(filename)), { servers: { test: { command: 'new' } } });
    applyManagedPlan(directory, [], { ...options, targets: { copilot: { mcp: true, mcpHost: 'native' } } });
    assert.equal(fs.existsSync(filename), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('skill metadata and recursive resources share the resolved long name', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile skills '));
  try {
    fs.cpSync(path.join(root, 'core'), path.join(fixture, 'core'), { recursive: true });
    const folder = path.join(fixture, 'core/skills', `aigile-${'long-'.repeat(16)}name`);
    fs.mkdirSync(path.join(folder, 'assets/nested'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'SKILL.md'), '---\ndescription: Long skill\nuser-invocable: false\ndisable-model-invocation: false\nargument-hint: "<target>"\n---\nRead assets/nested/data.txt.');
    const resource = '```js\nconst text = "Claude Code #tool:runSubagent .kiro/specs";\n```\n';
    fs.writeFileSync(path.join(folder, 'assets/nested/data.txt'), resource);
    for (const host of ['copilot', 'codex']) {
      const entries = clientSkills(fixture, host);
      const entry = entries.find(entry => entry.path.endsWith('/SKILL.md') && entry.content.includes('Read assets/nested/data.txt.'));
      const metadata = frontmatter(entry.content).metadata;
      assert.equal(metadata['user-invocable'], false);
      assert.equal(metadata['disable-model-invocation'], false);
      assert.equal(metadata['argument-hint'], '<target>');
      assert.equal(entries.find(item => item.path === entry.path.replace('SKILL.md', 'assets/nested/data.txt')).content.toString(), resource);
    }
    for (const header of ['description: " "', 'description: valid\nuser-invocable: "false"', 'description: valid\ndisable-model-invocation: no', 'description: valid\nargument-hint: []']) {
      fs.writeFileSync(path.join(folder, 'SKILL.md'), `---\n${header}\n---\nBody`);
      assert.throws(() => clientSkills(fixture, 'copilot'), /SKILL.md.*(description|user-invocable|disable-model-invocation|argument-hint)/);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('native Copilot precedence and metadata preserve tool permissions and prompt bodies', () => {
  const sources = collectSources(path.join(root, 'core/agents'), true);
  assert.equal(sources.get('dev'), 'dev.agent.md');
  assert.equal(collectSources(path.join(root, 'core/agents')).get('dev'), 'dev.md');
  const result = frontmatter(modernizeAgent('---\nname: test\ndescription: test\ntools: [read/readFile, vendor/tool]\nuser-invokable: false\ninfer: false\n---\nBody'));
  assert.deepEqual(result.metadata.tools, ['read/readFile', 'vendor/tool']);
  assert.equal(result.metadata['user-invocable'], false);
  assert.equal(result.metadata['disable-model-invocation'], true);
  assert.equal(result.body, 'Body');
  const prompt = frontmatter(modernizePrompt('---\nmode: agent\ndescription: test\n---\nBody\r\n'));
  assert.equal(prompt.metadata.agent, 'agent');
  assert.equal(prompt.metadata.mode, undefined);
  assert.equal(prompt.body, 'Body\r\n');
});

test('recursive prompt adapters retain context without granting skill permissions', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile prompts '));
  try {
    fs.cpSync(path.join(root, 'core'), path.join(fixture, 'core'), { recursive: true });
    const filename = path.join(fixture, 'core/prompts/nested/context.prompt.md');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const literals = [
      '```js\r\nconst text = ["Claude Code", "#tool:runSubagent", ".kiro/specs"];\r\n```',
      '~~~~markdown\n~~~js\nClaude Code #tool:runSubagent .kiro/specs\n~~~\n~~~~',
      '`````md\n```js\nClaude Code\n```\n`````',
      '> ```js\n> Claude Code #tool:runSubagent .kiro/specs\n> ```',
      '>     Claude Code #tool:runSubagent .kiro/specs',
      '- Example:\n    ```js\n    Claude Code #tool:runSubagent .kiro/specs\n    ```',
      '`Claude Code #tool:runSubagent .kiro/specs` and `` `askQuestions` ``',
      '``Claude Code\n#tool:runSubagent .kiro/specs``',
      '    const text = "Claude Code #tool:runSubagent .kiro/specs";',
      '\\#tool:runSubagent and \\#runSubagent',
      '`codex /goal Claude Code` and `copilot /goal .kiro/specs`',
    ];
    const body = 'Review ${selection} and #file:src/example.js. Literal: `${example}`.\n' + literals.join('\n\n') + '\n\nUse Claude Code and #tool:runSubagent with .kiro/specs.';
    fs.writeFileSync(filename, `---\ndescription: Review context\nagent: ask\nmodel: preferred\ntools: []\nuser-invocable: false\ndisable-model-invocation: false\nargument-hint: "<file>"\n---\n${body}`);
    for (const host of ['copilot', 'codex']) {
      const entry = clientSkills(fixture, host).find(entry => entry.path.includes('prompt-nested-context/'));
      const parsed = frontmatter(entry.content);
      assert.equal(parsed.metadata['user-invocable'], false);
      assert.equal(parsed.metadata['disable-model-invocation'], false);
      assert.equal(parsed.metadata['argument-hint'], '<file>');
      assert.equal(parsed.metadata['allowed-tools'], undefined);
      for (const text of [...literals, `Use ${host === 'codex' ? 'Codex' : 'Copilot'} and available native agent delegation with docs/specs.`, 'Source agent: "ask"', 'Source tools: []', 'Source model preference: "preferred"', 'STOP', 'Ask for missing inputs', 'Preserve literal examples', '.github/prompts/nested/context.prompt.md']) assert.ok(entry.content.includes(text), text);
    }
    for (const header of ['description: ""', 'agent: []', 'model: 12', 'tools: read', 'user-invocable: "false"']) {
      fs.writeFileSync(filename, `---\n${header}\n---\nBody`);
      assert.throws(() => clientSkills(fixture, 'copilot'), /nested\/context.prompt.md:/);
    }
    const review = clientSkills(root, 'copilot').find(entry => entry.path.includes('prompt-code-review/'));
    assert.match(review.content, /Source agent: "ask"/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('portable adapters preserve container code bytes and resume prose conversion', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile container code '));
  const literal = 'Claude Code #tool:runSubagent .kiro/specs';
  const cases = [
    `>     ${literal}`,
    `>>     ${literal}\n>>\n>>     ${literal}`,
    `> >     ${literal}\n> >\n> >     ${literal}`,
    `> \t${literal}`,
    `- Outer\n  - Inner\n\n        ${literal}\n\n        ${literal}`,
    `1. Outer\n   2) Inner\n\n          ${literal}`,
    `> - Outer\n>   - Inner\n>\n>         ${literal}`,
    `- >     ${literal}\n  >\n  >     ${literal}`,
    `> - >     ${literal}`,
    `-     ${literal}`,
    `> 10)     ${literal}`,
    `-\t>     ${literal}`,
    `> 1.\t${literal}`,
  ];
  for (const character of ['`', '~']) {
    for (const length of [3, 4, 5]) {
      for (const [opening, continuation] of [['> ', '> '], ['>> ', '>> '], ['- > ', '  > '], ['> - > ', '>   > '], ['1. > - ', '   >   '], ['-\t> ', '  > '], ['>\t', '> ']]) {
        const fence = character.repeat(length);
        cases.push(`${opening}${fence}text\n${continuation}${literal}\n${continuation}\n\n${continuation}${character.repeat(length - 1)}\n${continuation}${literal}\n${continuation}${fence}${character}`);
      }
    }
  }
  try {
    for (const directory of ['skills-portable', 'skills/container', 'tasks', 'prompts', 'workflows']) fs.mkdirSync(path.join(fixture, 'core', directory), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'core/skills-portable/goal.md'), 'Goal');
    for (const newline of ['\n', '\r\n']) {
      for (const source of cases) {
        const code = source.replace(/\n/g, newline);
        const prose = ['Use ', '> Use ', '- Use ', '> - Use ', '- > Use '].map(prefix => prefix + literal + '.').join(newline);
        const body = `Before${newline}${newline}${code}${newline}${newline}${prose}`;
        const content = `---\nname: Container\ndescription: Container\n---\n${body}`;
        fs.writeFileSync(path.join(fixture, 'core/skills/container/SKILL.md'), content);
        fs.writeFileSync(path.join(fixture, 'core/prompts/container.prompt.md'), content);
        for (const host of ['copilot', 'codex']) {
          const converted = `${host === 'codex' ? 'Codex' : 'Copilot'} available native agent delegation docs/specs`;
          const expected = body.replace(prose, prose.replaceAll(literal, converted));
          const entries = clientSkills(fixture, host).filter(entry => /-(?:prompt-)?container\/SKILL.md$/.test(entry.path));
          assert.equal(entries.length, 2);
          for (const entry of entries) assert.ok(entry.content.includes(expected), `${host}: ${JSON.stringify(code)}`);
          if (host === 'codex') {
            const role = codexRole({ id: 'container', filename: 'container.agent.md', content });
            assert.ok(TOML.parse(role.content).developer_instructions.includes(expected), `role: ${JSON.stringify(code)}`);
          }
        }
      }
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('all portable Codex roles parse and include usable instructions', () => {
  for (const [id, filename] of collectSources(path.join(root, 'core/agents'))) {
    const role = codexRole({ id, filename, content: fs.readFileSync(path.join(root, 'core/agents', filename), 'utf8') });
    const parsed = TOML.parse(role.content);
    assert.equal(parsed.name, role.name);
    assert.ok(parsed.description.length > 0);
    assert.ok(parsed.developer_instructions.length > 500);
    assert.ok(parsed.developer_instructions.includes(`.aigile-core/agents/${filename}`));
    assert.equal(parsed.model, undefined);
    assert.equal(parsed.sandbox_mode, undefined);
  }
});

test('both clients receive namespaced valid skills and exact native goal semantics', () => {
  for (const host of ['codex', 'copilot']) {
    const entries = clientSkills(root, host);
    const names = entries.filter(entry => entry.path.endsWith('/SKILL.md')).map(entry => {
      const parsed = frontmatter(entry.content);
      assert.equal(parsed.metadata.name, entry.path.split('/').at(-2));
      assert.ok(parsed.metadata.description.length <= 1024);
      assert.ok(parsed.metadata.name.length <= 64);
      return parsed.metadata.name;
    });
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.includes(`aigile-${host}-goal`));
    assert.ok(names.includes(`aigile-${host}-spec-bridge`));
    assert.ok(names.includes(`aigile-${host}-prompt-java-java-junit`));
    const orchestration = entries.find(entry => entry.path.includes(`aigile-${host}-orchestration/`)).content;
    assert.equal(orchestration.includes('.kiro/agents'), false);
    assert.equal(orchestration.includes('Up to four'), false);
    assert.ok(orchestration.includes('actual client limits'));
    const goal = entries.find(entry => entry.path.includes(`aigile-${host}-goal/`)).content;
    assert.ok(goal.includes('independent QA'));
    if (host === 'codex') {
      assert.ok(goal.includes('Words status and view are objective text'));
      assert.ok(goal.includes('does not mutate persistent goal state'));
    } else {
      assert.ok(goal.includes('an alias for /autopilot'));
      assert.ok(goal.includes('do not claim editor-native /goal support'));
    }
  }
});

test('documentation distinguishes native goal enablement and unpublished source usage', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const mcpGuide = fs.readFileSync(path.join(root, 'docs/mcp-servers.md'), 'utf8');
  assert.ok(readme.includes('`goals` feature is stable and enabled by default'));
  assert.ok(readme.includes('`codex --enable goals`'));
  assert.ok(readme.includes('`codex -c features.goals=true`'));
  assert.ok(readme.includes('does not write persistent configuration'));
  assert.ok(readme.includes('`status` and `view` are objective text, not controls'));
  assert.ok(readme.includes('$aigile-codex-goal <objective>'));
  assert.ok(readme.includes('/aigile-copilot-goal'));
  for (const source of ['features/src/lib.rs', 'cli/src/main.rs', 'tui/src/chatwidget/slash_dispatch.rs']) {
    assert.ok(readme.includes(`https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/${source}`));
  }
  for (const document of [readme, mcpGuide]) {
    assert.ok(document.includes('1.5.0'));
    assert.ok(document.includes('current npm release'));
    assert.match(document, /node [^`\n]+\/tools\/cli\.js install --for-codex/);
  }
  assert.ok(mcpGuide.includes('../README.md#codex-and-copilot-workflows'));
  for (const text of ['Copilot CLI native `/goal [OBJECTIVE]`', '`/autopilot`', '1.136.2', 'allowed-tools', 'COPILOT_HOME']) assert.ok(readme.includes(text), text);
  for (const text of ['--copilot-mcp-host=native', 'installs three native entries', 'NOT auto-approval', 'three actionable diagnostics', 'before any actual destination writes', 'uninstall --for-copilot']) assert.ok(mcpGuide.includes(text), text);
  for (const document of [readme, mcpGuide]) {
    assert.ok(document.includes('1.0.4'));
    assert.ok(document.includes('UNKNOWNOPTION'));
    assert.ok(document.includes('subcommand help advertises'));
  }
});

test('native MCP rejects invalid applicable field types without coercion', () => {
  const local = { command: 'test', args: [], tools: [] };
  const remote = { type: 'http', url: 'https://example.com/mcp', tools: [] };
  for (const [base, field, values] of [
    [local, 'env', [0, null, [], 'text', { TOKEN: null }, { TOKEN: 12 }]],
    [remote, 'headers', [0, null, [], 'text', { Authorization: false }]],
    [local, 'cwd', [12, null, []]],
    [local, 'timeout', ['bad', null, {}, false]],
    [remote, 'timeout', ['bad', null]],
    [local, 'command', [12, null]],
    [local, 'args', [null, 'arg', [12]]],
    [remote, 'url', [12, null]],
    [local, 'type', [null, 12, 'unknown']],
    [local, 'tools', [null, 'inspect', [12]]],
  ]) {
    for (const value of values) {
      const result = copilotMcp({ servers: { invalid: { ...base, [field]: value } } }, 'native');
      assert.equal(result.entries.length, 0, `${field}: ${JSON.stringify(value)}`);
      assert.equal(result.warnings.length, 1);
    }
  }
  for (const server of [{ ...local, env: {}, cwd: '', timeout: 0 }, { ...local, env: { EMPTY: '', VALUE: 'text' }, timeout: 12.5 }, { ...remote, headers: {}, timeout: 100 }, { ...remote, type: 'streamable-http' }, { ...local, deferTools: 'never', disableToolCache: false, oidc: true }, { ...remote, oauthClientId: 'example', oauthPublicClient: false, oauthGrantType: 'client_credentials', filterMapping: 'none' }]) {
    assert.equal(copilotMcp({ servers: { valid: server } }, 'native').entries.length, 1, JSON.stringify(server));
  }
});

test('native catalog supplies availability defaults for exactly three credential-free servers', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'mcp/servers.json')));
  const before = structuredClone(catalog);
  const native = copilotMcp(catalog, 'native');
  assert.deepEqual(native.entries.map(entry => entry.jsonPath[1]), ['playwright', 'memory', 'sequentialthinking']);
  for (const entry of native.entries) {
    assert.deepEqual(JSON.parse(entry.content), { ...catalog.servers[entry.jsonPath[1]], type: 'stdio', tools: ['*'] });
  }
  assert.equal(native.warnings.length, 3);
  for (const name of ['atlassian', 'github.com', 'context7']) assert.ok(native.warnings.some(warning => warning.includes(`Skipped MCP ${name}: unsupported interpolation`)));
  assert.deepEqual(catalog, before);
});

test('Copilot MCP hosts retain explicit filters and translate only documented native fields', () => {
  const catalog = { servers: {
    supported: { command: 'test', args: [], tools: ['inspect'], env: { TOKEN: '${env:TOKEN}', DEFAULT: '${NAME:-fallback}', DIRECT: '$NAME' } },
    remote: { type: 'http', url: 'https://example.com/mcp', tools: [], headers: { Authorization: 'Bearer ${TOKEN}' } },
    input: { command: 'test', args: [], tools: [], env: { TOKEN: '${input:token}' } },
    missing: { command: 'test', args: [] },
    unknown: { command: 'test', args: [], tools: [], sandbox: false },
    argument: { command: 'test', args: ['${env:TOKEN}'], tools: [] },
  }, inputs: [{ id: 'token', type: 'promptString', password: true }] };
  const native = copilotMcp(catalog, 'native');
  assert.equal(native.entries.length, 3);
  assert.equal(native.warnings.length, 3);
  assert.deepEqual(JSON.parse(native.entries[1].content).tools, []);
  assert.deepEqual(JSON.parse(native.entries[2].content).tools, ['*']);
  assert.deepEqual(native.entries[0].jsonPath, ['mcpServers', 'supported']);
  const supported = JSON.parse(native.entries[0].content);
  assert.deepEqual(supported.tools, ['inspect']);
  assert.deepEqual(supported.env, { TOKEN: '${TOKEN}', DEFAULT: '${NAME:-fallback}', DIRECT: '$NAME' });
  assert.equal(native.entries[0].path, '.mcp.json');
  assert.equal(JSON.stringify(native.entries).includes('${input:'), false);
  const vscode = copilotMcp(catalog);
  assert.equal(vscode.entries[0].path, '.vscode/mcp.json');
  assert.deepEqual(vscode.entries.at(-1).jsonPath, ['inputs', 'token']);
  assert.deepEqual(JSON.parse(vscode.entries[0].content), catalog.servers.supported);
  assert.throws(() => copilotMcp(catalog, 'bad'), /host/);
});

test('MCP uses inherited secrets, skips credential arguments and rejects collisions', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'mcp/servers.json')));
  const original = '# User comment\nmodel = "custom"\n[mcp_servers.mine]\nurl = "https://example.com/mcp"\n';
  const output = codexMcp(catalog, original);
  const parsed = TOML.parse(original + output.content);
  assert.equal(parsed.model, 'custom');
  assert.deepEqual(parsed.mcp_servers['aigile-github.com'].env_vars, ['GITHUB_PERSONAL_ACCESS_TOKEN']);
  assert.equal(parsed.mcp_servers['aigile-context7'], undefined);
  assert.equal(output.warnings.length, 1);
  assert.equal(output.content.includes('${input:'), false);
  assert.throws(() => codexMcp(catalog, '[mcp_servers."aigile-github.com"]\ncommand="user"'), /collision/);
  assert.throws(() => codexMcp(catalog, 'bad TOML ['));
});

test('MCP supports appendable dotted and normal tables and precisely rejects sealed inline roots', () => {
  const catalog = { servers: { test: { command: 'generated' } } };
  for (const original of ['mcp_servers.mine.command = "user"\n', '[mcp_servers]\nmine = { command = "user" }\n', '[mcp_servers.mine]\ncommand = "user"\n']) {
    const output = codexMcp(catalog, original);
    const parsed = TOML.parse(original + '\n' + output.content);
    assert.equal(parsed.mcp_servers.mine.command, 'user');
    assert.equal(parsed.mcp_servers['aigile-test'].command, 'generated');
    assert.equal(codexMcp(catalog, original + '\n' + output.content).content, output.content);
  }
  assert.throws(() => codexMcp(catalog, 'mcp_servers = { mine = { command = "user" } }'), /No files were changed.*explicit \[mcp_servers/);
  for (const original of ['mcp_servers = { aigile-test = { command = "user" } }', 'mcp_servers.aigile-test.command = "user"']) {
    assert.throws(() => codexMcp(catalog, original), /collision/);
  }
});