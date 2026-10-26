import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { frontmatter } from '../shared/client-assets.js';
import TOML from '@iarna/toml';
import { canonicalRoles } from '../shared/workflow.js';

const cli = process.env.AIGILE_TEST_CLI || fileURLToPath(new URL('../cli.js', import.meta.url));
function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow CLI space '));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  return root;
}
function command(root, args, expected = 0, raw = false) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, AIGILE_ADD_SCRIPTS: '0' }, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, expected, result.stdout + result.stderr);
  return expected || raw ? result.stdout + result.stderr : JSON.parse(result.stdout);
}
function write(root, relative, value) {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  const bytes = typeof value === 'string' ? value : JSON.stringify(value);
  fs.writeFileSync(path.join(root, relative), bytes);
  return { path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}
function result(root, run) {
  return { ...run.next.resultTemplate, outputs: Object.fromEntries(run.next.requiredOutputs.map(name => [name, write(root, `evidence/${name}.txt`, `Fake local ${name} attestation`)])) };
}
function advance(root, run, payload, options = []) {
  write(root, 'submission.json', payload);
  return command(root, ['workflow', 'advance', run.runId, '--result', 'submission.json', ...options]);
}

test('CLI help exposes required revision host snapshot and complete custom two-writer flow', context => {
  const root = fixture(context);
  const help = command(root, ['--help'], 0, true);
  for (const option of ['--expected-revision', '--snapshot-paths', '--host', '--approve', '--reconcile', 'resultTemplate', 'approvalTemplate']) assert.ok(help.includes(option), option);
  fs.rmdirSync(path.join(root, 'src'));
  command(root, ['workflow', 'create', 'missing', '--steps', 'dev,dev,qa,devops']);
  command(root, ['workflow', 'run', 'missing'], 1);
  assert.equal(fs.existsSync(path.join(root, '.aigile-workflows/runs')), false);
  write(root, 'lib/code.js', 'initial');
  const created = command(root, ['workflow', 'create', 'custom', '--steps', 'dev,dev,qa,devops', '--snapshot-paths', 'lib']);
  assert.equal(created.created, '.aigile-workflows/custom/custom.yaml');
  let run = command(root, ['workflow', 'run', 'custom', '--host', 'copilot']);
  for (const value of ['first writer', 'second writer']) {
    write(root, 'lib/code.js', value);
    run = command(root, ['workflow', 'status', run.runId, '--host', 'copilot']);
    assert.deepEqual(run.blockers, []);
    run = advance(root, run, result(root, run));
  }
  run = advance(root, run, result(root, run));
  run = advance(root, run, result(root, run));
  assert.equal(run.status, 'completed');
  assert.equal(fs.existsSync(path.join(root, '.git')), false);
});

test('CLI create validate run restart and full approved bug flow with uncertain PR reconciliation', context => {
  const root = fixture(context);
  write(root, 'src/fix.js', 'original');
  write(root, 'issue-export.json', { summary: 'Fake bug, no live Jira' });
  write(root, 'inputs.json', { 'issue-export': 'issue-export.json' });
  const created = command(root, ['workflow', 'create', 'bug-resolve-wf', '--from', 'bug-resolve']);
  assert.equal(created.created, '.aigile-workflows/custom/bug-resolve-wf.yaml');
  const validated = command(root, ['workflow', 'validate', 'bug-resolve-wf']);
  assert.equal(validated.source.kind, 'local');
  assert.equal(validated.source.path, created.created);
  command(root, ['workflow', 'create', 'bug-resolve-wf', '--from', 'bug-resolve'], 1);
  command(root, ['workflow', 'run', 'bug-resolve-wf'], 1);
  let run = command(root, ['workflow', 'run', 'bug-resolve-wf', '--issue', 'PROJ-123', '--inputs', 'inputs.json', '--host', 'copilot']);
  assert.equal(run.next.delegationTarget, 'Product Manager');
  assert.match(run.next.missingCapabilities[0], /availability\/authority not verified/);
  assert.equal(run.revision, 0);
  assert.deepEqual(command(root, ['workflow', 'status', run.runId, '--host', 'copilot']), run);
  run = advance(root, run, result(root, run));
  assert.equal(run.next.step, 'fix');
  assert.equal(run.next.readyForAuthorizedWorker, false);
  const scope = { repository: 'example/project', base: 'main', head: 'fix/proj-123', proposedChanges: 'Correct fake bug', pushScope: 'none' };
  const approval = { expectedRevision: run.revision, step: 'fix', attemptId: run.next.attemptId, codeSnapshot: run.next.codeSnapshot, scope };
  run = advance(root, run, approval, ['--approve', 'fix']);
  write(root, 'src/fix.js', 'fixed');
  run = command(root, ['workflow', 'status', run.runId]);
  run = advance(root, run, result(root, run));
  const qaFailure = { ...result(root, run), status: 'failed', verdict: 'fail', reason: 'Independent QA found a regression' };
  write(root, 'submission.json', { ...qaFailure, outputs: {} });
  assert.match(command(root, ['workflow', 'advance', run.runId, '--result', 'submission.json'], 1), /Required QA failure outputs/);
  run = advance(root, run, qaFailure);
  assert.equal(run.next.evidence.review.outputs['qa-report'].sha256, qaFailure.outputs['qa-report'].sha256);
  run = command(root, ['workflow', 'advance', run.runId, '--retry', 'fix', '--expected-revision', String(run.revision)]);
  assert.equal(run.next.approval, null);
  assert.equal(run.next.attemptId, 'fix:2');
  write(root, 'submission.json', { ...approval, expectedRevision: run.revision });
  assert.match(command(root, ['workflow', 'advance', run.runId, '--approve', 'fix', '--result', 'submission.json'], 1), /attemptId/);
  run = advance(root, run, { ...approval, expectedRevision: run.revision, attemptId: run.next.attemptId, codeSnapshot: run.next.codeSnapshot }, ['--approve', 'fix']);
  run = advance(root, run, result(root, run));
  run = advance(root, run, result(root, run));
  run = advance(root, run, { expectedRevision: run.revision, attemptId: run.next.attemptId, step: 'draft-pr', codeSnapshot: run.next.codeSnapshot, scope: { ...scope, pushScope: `branch:${scope.head}` } }, ['--approve', 'draft-pr']);
  assert.match(command(root, ['workflow', 'advance', run.runId, '--retry', 'fix', '--expected-revision', String(run.revision)], 1), /authority already issued/);
  run = advance(root, run, { expectedRevision: run.revision, attemptId: run.next.attemptId, step: 'draft-pr', outcome: 'not-performed', reconciliation: write(root, 'not-performed.txt', 'Fake provider export confirms no action was performed') }, ['--reconcile', 'draft-pr']);
  run = command(root, ['workflow', 'advance', run.runId, '--retry', 'draft-pr', '--expected-revision', String(run.revision)]);
  assert.equal(run.next.approval, null);
  run = advance(root, run, { expectedRevision: run.revision, attemptId: run.next.attemptId, step: 'draft-pr', codeSnapshot: run.next.codeSnapshot, scope: { ...scope, pushScope: `branch:${scope.head}` } }, ['--approve', 'draft-pr']);
  const publication = { url: 'https://example.invalid/pull/42', repository: scope.repository, base: scope.base, head: scope.head, draft: true };
  run = advance(root, run, { expectedRevision: run.revision, attemptId: run.next.attemptId, step: 'draft-pr', status: 'uncertain', reason: 'Simulated lost response; no real provider contacted' });
  assert.match(command(root, ['workflow', 'advance', run.runId, '--retry', 'draft-pr', '--expected-revision', String(run.revision)], 1), /reconcile before retry/);
  run = advance(root, run, { ...result(root, run), outcome: 'performed', publication, reconciliation: write(root, 'reconciled.txt', 'Fake provider export confirms exactly one draft') }, ['--reconcile', 'draft-pr']);
  assert.equal(run.status, 'completed');
  assert.equal(run.next, null);
  assert.match(command(root, ['workflow', 'advance', run.runId, '--retry', 'fix', '--expected-revision', String(run.revision)], 1), /Publication already recorded/);
  assert.equal(fs.existsSync(path.join(root, '.git')), false);
  for (const folder of ['.codex', '.github', '.mcp.json', '.aigile-core']) assert.equal(fs.existsSync(path.join(root, folder)), false);
});

test('two CLI advances cannot both accept one revision; stale submission is byte-stable', async context => {
  const root = fixture(context);
  command(root, ['workflow', 'create', 'ordered', '--steps', 'dev,qa']);
  const run = command(root, ['workflow', 'run', 'ordered']);
  write(root, 'result.json', result(root, run));
  const launch = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'workflow', 'advance', run.runId, '--result', 'result.json'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    child.on('error', reject);
    child.on('close', status => resolve({ status, output }));
  });
  const outcomes = await Promise.all([launch(), launch()]);
  assert.deepEqual(outcomes.map(value => value.status).sort(), [0, 1], JSON.stringify(outcomes));
  assert.match(outcomes.find(value => value.status === 1).output, /EEXIST|already exists|expectedRevision/);
  const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  const before = fs.readFileSync(filename);
  command(root, ['workflow', 'advance', run.runId, '--result', 'result.json'], 1);
  assert.deepEqual(fs.readFileSync(filename), before);
  assert.equal(command(root, ['workflow', 'status', run.runId]).revision, 1);
});

test('CLI arbitrary definition inputs and workspace-bound submissions reject traversal and junctions', context => {
  const root = fixture(context);
  const definition = { schemaVersion: 1, workflow: { id: 'review', name: 'Review', description: 'Independent custom review', inputs: { topic: { type: 'string', required: true, description: 'Topic' } }, snapshotPaths: [], sequence: [{ id: 'review', agent: 'qa', instructions: 'Review the approved topic', requires: ['input:topic'], creates: ['report'], capabilities: ['manual-review'], guard: 'evidence', approval: 'none', maxRetries: 1, binding: 'none' }] } };
  write(root, 'custom.yaml', definition);
  const created = command(root, ['workflow', 'create', 'custom-review', '--definition', 'custom.yaml']);
  assert.equal(created.created, '.aigile-workflows/custom/custom-review.yaml');
  write(root, 'inputs.json', { topic: 'Public API' });
  const run = command(root, ['workflow', 'run', 'custom-review', '--inputs', 'inputs.json', '--host', 'codex']);
  assert.equal(run.next.delegationTarget, 'aigile-qa');
  const before = fs.readFileSync(path.join(root, `.aigile-workflows/runs/${run.runId}.json`));
  for (const relative of ['../result.json', 'C:/result.json', '/tmp/result.json']) assert.match(command(root, ['workflow', 'advance', run.runId, '--result', relative], 1), /Unsafe workspace path/);
  fs.mkdirSync(path.join(root, 'external'));
  fs.symlinkSync(path.join(root, 'external'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(command(root, ['workflow', 'advance', run.runId, '--result', 'linked/result.json'], 1), /symlink\/junction/);
  assert.deepEqual(fs.readFileSync(path.join(root, `.aigile-workflows/runs/${run.runId}.json`)), before);
});

test('custom definitions and runs survive install update uninstall; creator is discoverable on native clients', context => {
  const root = fixture(context);
  command(root, ['workflow', 'create', 'keep', '--steps', 'dev,qa']);
  fs.renameSync(path.join(root, '.aigile-workflows/custom/keep.yaml'), path.join(root, '.aigile-workflows/keep.yaml'));
  const legacyRun = command(root, ['workflow', 'run', 'keep']);
  assert.equal(legacyRun.source.path, '.aigile-workflows/keep.yaml');
  command(root, ['workflow', 'create', 'keep', '--steps', 'qa']);
  assert.equal(command(root, ['workflow', 'validate', 'keep']).source.path, '.aigile-workflows/custom/keep.yaml');
  const run = command(root, ['workflow', 'run', 'keep']);
  assert.equal(run.next.role, 'qa');
  assert.equal(command(root, ['workflow', 'status', legacyRun.runId]).next.role, 'dev');
  const saved = ['.aigile-workflows/custom/keep.yaml', '.aigile-workflows/keep.yaml', `.aigile-workflows/runs/${run.runId}.json`, `.aigile-workflows/runs/${legacyRun.runId}.json`, '.aigile-workflows/.gitignore'].map(relative => [relative, fs.readFileSync(path.join(root, relative))]);
  command(root, ['install', '--for-codex', '--for-copilot', '--for-claude', '--yes'], 0, true);
  for (const relative of ['.codex/agents/aigile-workflow-creator.toml', '.github/agents/workflow-creator.agent.md', '.claude/agents/workflow-creator.md', '.agents/skills/aigile-codex-workflow-creator/SKILL.md', '.github/skills/aigile-copilot-workflow-creator/SKILL.md']) assert.ok(fs.existsSync(path.join(root, relative)), relative);
  const creator = frontmatter(fs.readFileSync(path.join(root, '.github/agents/workflow-creator.agent.md'), 'utf8'));
  assert.equal(creator.metadata.name, 'Workflow Creator');
  assert.equal(creator.metadata['user-invocable'], true);
  assert.notEqual(creator.metadata['disable-model-invocation'], true);
  assert.match(creator.metadata.description, /workflow/i);
  assert.match(creator.body, /\.aigile-workflows\/custom\//);
  assert.deepEqual(creator.metadata.tools, ['read', 'search', 'edit', 'execute', 'vscode/askQuestions']);
  assert.deepEqual(creator.metadata.agents, []);
  const claudeCreator = frontmatter(fs.readFileSync(path.join(root, '.claude/agents/workflow-creator.md'), 'utf8'));
  assert.equal(claudeCreator.metadata.tools, 'Read, Glob, Grep, Write, Edit, Bash, AskUserQuestion');
  const agents = fs.readdirSync(path.join(root, '.github/agents')).map(filename => frontmatter(fs.readFileSync(path.join(root, '.github/agents', filename), 'utf8')));
  const names = new Set(agents.map(agent => agent.metadata.name));
  for (const [alias, target] of Object.entries(canonicalRoles(undefined, 'copilot'))) {
    const installed = frontmatter(fs.readFileSync(path.join(root, '.github/agents', `${alias}.agent.md`), 'utf8'));
    assert.equal(target, installed.metadata.name, alias);
    assert.equal(canonicalRoles(undefined, 'codex')[alias], `aigile-${alias.replace(/^aigile-/, '')}`);
  }
  command(root, ['workflow', 'create', 'security-check', '--steps', 'dev,qa,security']);
  let securityRun = command(root, ['workflow', 'run', 'security-check']);
  securityRun = advance(root, securityRun, result(root, securityRun));
  securityRun = advance(root, securityRun, result(root, securityRun));
  assert.equal(command(root, ['workflow', 'status', securityRun.runId, '--host', 'copilot']).next.delegationTarget, 'Security Engineer');
  for (const agent of agents) {
    for (const target of [...(agent.metadata.agents || []), ...(agent.metadata.handoffs || []).map(handoff => handoff.agent)]) assert.ok(names.has(target), `${agent.metadata.name}: ${target}`);
    if (/Orchestrator/.test(agent.metadata.name)) {
      assert.deepEqual(agent.metadata.tools, ['agent', 'todo', 'vscode/askQuestions']);
      assert.ok(agent.metadata.agents.includes('Workflow Creator'));
    }
  }
  command(root, ['update', '--for-codex', '--for-copilot', '--for-claude', '--yes'], 0, true);
  command(root, ['uninstall', '--for-codex', '--for-copilot', '--for-claude'], 0, true);
  for (const [relative, original] of saved) assert.deepEqual(fs.readFileSync(path.join(root, relative)), original);
});

test('installed Kiro creator grants only authoring tools and never overrides canonical nondelegation', context => {
  const root = fixture(context);
  command(root, ['install', '--for-copilot', '--for-codex', '--for-claude', '--for-kiro', '--for-antigravity', '--yes'], 0, true);
  const creator = frontmatter(fs.readFileSync(path.join(root, '.kiro/agents/workflow-creator.md'), 'utf8'));
  assert.deepEqual(creator.metadata.tools, ['read', 'write', 'shell']);
  assert.equal(creator.metadata.includeMcpJson, false);
  assert.equal(creator.metadata.includePowers, false);
  assert.equal(creator.metadata.allowedTools, undefined);
  assert.match(creator.body, /do not spawn agents/);
  assert.doesNotMatch(creator.body, /Delegate specialized work|Run the matching agent|This section wins|## Subagent Delegation/);
  assert.match(creator.body, /workflow validate/);
  const copilot = frontmatter(fs.readFileSync(path.join(root, '.github/agents/workflow-creator.agent.md'), 'utf8'));
  assert.deepEqual(copilot.metadata.tools, ['read', 'search', 'edit', 'execute', 'vscode/askQuestions']);
  assert.deepEqual(copilot.metadata.agents, []);
  const claude = frontmatter(fs.readFileSync(path.join(root, '.claude/agents/workflow-creator.md'), 'utf8'));
  assert.equal(claude.metadata.tools, 'Read, Glob, Grep, Write, Edit, Bash, AskUserQuestion');
  const codex = TOML.parse(fs.readFileSync(path.join(root, '.codex/agents/aigile-workflow-creator.toml'), 'utf8'));
  assert.deepEqual(Object.keys(codex).sort(), ['description', 'developer_instructions', 'name']);
  const antigravity = fs.readFileSync(path.join(root, '.agent/rules/workflow-creator.md'), 'utf8');
  for (const body of [creator.body, copilot.body, claude.body, codex.developer_instructions, antigravity]) {
    assert.match(body, /do not spawn agents/);
    assert.match(body, /workflow validate/);
    assert.doesNotMatch(body, /Delegate specialized work|Run the matching agent|This section wins|## Subagent Delegation/);
  }
});

test('creator plugin uses bundled resources without inventing Claude display-name routing', context => {
  const root = fixture(context);
  const sourceRoot = path.resolve(path.dirname(cli), '..');
  fs.cpSync(path.join(sourceRoot, 'core'), path.join(root, 'core'), { recursive: true });
  fs.cpSync(path.join(sourceRoot, 'tools'), path.join(root, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, 'package.json'), path.join(root, 'package.json'));
  fs.symlinkSync(path.join(sourceRoot, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const bundled = spawnSync(process.execPath, [path.join(root, 'tools/cli.js'), 'bundle'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(bundled.status, 0, bundled.stdout + bundled.stderr);
  const creator = fs.readFileSync(path.join(root, 'plugin/agents/workflow-creator.md'), 'utf8');
  assert.ok(creator.includes('${CLAUDE_PLUGIN_ROOT}/core/workflows/deterministic/bug-resolve.yaml'));
  assert.ok(!creator.includes('Claude Code: Full Stack Developer'));
  assert.ok(creator.includes('Copilot: Full Stack Developer'));
  for (const name of ['bug-resolve', 'feature-delivery', 'security-remediation', 'pr-quality-gate']) {
    assert.ok(fs.existsSync(path.join(root, `plugin/core/workflows/deterministic/${name}.yaml`)), name);
  }
});

test('CLI workflow list graph scaffold-result and doctor inspect bundled templates and active runs', context => {
  const root = fixture(context);
  write(root, 'src/index.js', 'export const ok = true;\n');
  const listing = command(root, ['workflow', 'list', '--host', 'copilot']);
  assert.deepEqual(listing.bundled.map(item => item.id), ['bug-resolve', 'feature-delivery', 'pr-quality-gate', 'security-remediation']);
  assert.ok(listing.bundled.every(item => item.valid));
  const graph = command(root, ['workflow', 'graph', 'feature-delivery']);
  assert.equal(graph.id, 'feature-delivery');
  assert.match(graph.mermaid, /stateDiagram-v2/);
  assert.match(graph.mermaid, /verify --> implement: verdict=fail/);
  write(root, 'inputs.json', { feature: 'FEAT-42' });
  const run = command(root, ['workflow', 'run', 'feature-delivery', '--inputs', 'inputs.json', '--host', 'copilot']);
  assert.equal(run.next.step, 'story');
  assert.equal(run.next.delegationTarget, 'Product Owner');
  const specArtifact = write(root, 'evidence/story-spec.txt', 'Story spec content');
  const criteriaArtifact = write(root, 'evidence/acceptance-criteria.txt', 'Acceptance criteria content');
  const scaffolded = command(root, ['workflow', 'scaffold-result', run.runId, '--out', 'evidence/story-result.json', '--host', 'copilot']);
  assert.equal(scaffolded.written, 'evidence/story-result.json');
  assert.equal(scaffolded.template.outputs['story-spec'].sha256, specArtifact.sha256);
  assert.equal(scaffolded.template.outputs['acceptance-criteria'].sha256, criteriaArtifact.sha256);
  const advanced = command(root, ['workflow', 'advance', run.runId, '--result', 'evidence/story-result.json', '--host', 'copilot']);
  assert.equal(advanced.next.step, 'design');
  assert.equal(advanced.next.delegationTarget, 'Architect');
  const doctor = command(root, ['doctor', '--strict']);
  assert.equal(doctor.healthy, true);
  assert.equal(doctor.workflows.activeRuns, 1);
  assert.deepEqual(doctor.workflows.bundledTemplates, ['bug-resolve', 'feature-delivery', 'pr-quality-gate', 'security-remediation']);
});