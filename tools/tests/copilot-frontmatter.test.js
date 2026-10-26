import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { modernizeAgent, frontmatter } from '../shared/client-assets.js';

const source = fs.readFileSync(new URL('../cli.js', import.meta.url), 'utf8');
const definition = source.match(/function formatToolsFrontmatter\(toolList\) \{[\s\S]*?\n\}/)[0];
const format = vm.runInNewContext(`(${definition})`);

test('native agents reject malformed tool grants', () => {
  assert.throws(() => modernizeAgent('---\nname: Broken\ntools: [null, 42]\n---\nBody'), /tools must contain nonempty strings/);
  const parsed = frontmatter(modernizeAgent('---\nname: Worker\ntools: [read/readFile]\nagents: []\ndisable-model-invocation: false\n---\nBody'));
  assert.deepEqual(parsed.metadata.agents, []);
  assert.equal(parsed.metadata['disable-model-invocation'], false);
});

test('Copilot tools are a YAML-compatible JSON flow array with exact permissions', () => {
  const tools = ['read/readFile', 'agent/runSubagent', 'vendor/server/tool', 'search/fileSearch'];
  const output = format(tools);
  assert.ok(output.startsWith('tools: '));
  assert.equal(output.split('\n').length, 1);
  assert.deepEqual(JSON.parse(output.slice(7)), tools);
});

test('tool serialization deduplicates without expanding or dropping grants', () => {
  assert.deepEqual(JSON.parse(format(['askQuestions', 'read/readFile', 'read/readFile', 'customTool', 'vendor/*']).slice(7)),
    ['vscode/askQuestions', 'read/readFile', 'customTool', 'vendor/*']);
  assert.deepEqual(JSON.parse(format([]).slice(7)), []);
});

test('developer and coordinator policies handle unavailable capabilities without broader grants', () => {
  const dev = fs.readFileSync(new URL('../../core/agents/dev.agent.md', import.meta.url), 'utf8');
  const coordinator = fs.readFileSync(new URL('../../core/agents/aigile-orchestrator.agent.md', import.meta.url), 'utf8');
  assert.match(dev, /written plan is sufficient/);
  assert.match(dev, /return questions, consent requests, and escalation needs to the parent/);
  assert.doesNotMatch(dev, /\| `(architect|qa|po|analyst)` \|/);
  assert.match(coordinator, /unavailable, STOP/);
  assert.match(coordinator, /otherwise maintain a text checklist/);
  assert.match(coordinator, /otherwise ask conversationally/);
  for (const name of ['aigile-orchestrator', 'aigile-manual-orchestrator']) {
    const content = fs.readFileSync(new URL(`../../core/agents/${name}.agent.md`, import.meta.url), 'utf8');
    assert.deepEqual(frontmatter(content).metadata.tools, ['agent', 'todo', 'vscode/askQuestions']);
    assert.doesNotMatch(content, /MVEL Workflow Engineer/);
  }
  const manual = fs.readFileSync(new URL('../../core/agents/aigile-manual-orchestrator.agent.md', import.meta.url), 'utf8');
  assert.match(manual, /end the turn and await explicit approval/);
  assert.match(manual, /Never infer blanket approval/);
  assert.match(manual, /otherwise ask conversationally/);
});