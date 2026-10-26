import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflow, parseStructured } from '../shared/workflow-schema.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { workflowLock } from '../shared/workflow-file.js';
import { createWorkflow, startRun, advanceRun, runStatus, canonicalRoles, codeSnapshot, workspacePath, loadWorkflow, describe } from '../shared/workflow.js';

function fixture(context, steps = 'dev,qa') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow tests '));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  createWorkflow(root, 'custom', { steps });
  return root;
}
function evidence(root, name = 'evidence.txt', value = 'actual local evidence') {
  fs.writeFileSync(path.join(root, name), value);
  return { path: name, sha256: crypto.createHash('sha256').update(value).digest('hex') };
}
function success(root, run) {
  return { ...run.next.resultTemplate, outputs: Object.fromEntries(run.next.requiredOutputs.map(name => [name, evidence(root, `${name}.txt`)])) };
}
function bytes(root, run) { return fs.readFileSync(path.join(root, `.aigile-workflows/runs/${run.runId}.json`)); }
function unchanged(root, run, callback, pattern) {
  const before = bytes(root, run);
  assert.throws(callback, pattern);
  assert.deepEqual(bytes(root, run), before);
}

test('strict workflows reject legacy prose and unknown schema keys', () => {
  assert.throws(() => validateWorkflow({ workflow: { id: 'legacy', sequence: [] } }, ['dev']), /schemaVersion/);
  assert.throws(() => validateWorkflow({ schemaVersion: 1, workflow: {}, execute: 'shell' }, ['dev']), /Unknown.*execute/);
});

test('strict identifiers and YAML tags reject before creating files', context => {
  const root = fixture(context);
  const valid = loadWorkflow(root, 'custom').definition;
  for (const value of [undefined, null, 123]) {
    for (const target of ['workflow', 'step']) {
      const definition = structuredClone(valid);
      (target === 'workflow' ? definition.workflow : definition.workflow.sequence[0]).id = value;
      assert.throws(() => validateWorkflow(definition, ['dev', 'qa']), /id/);
      evidence(root, 'bad.yaml', JSON.stringify(definition));
      assert.throws(() => createWorkflow(root, 'bad', { definition: 'bad.yaml' }), /id/);
      assert.equal(fs.existsSync(path.join(root, '.aigile-workflows/custom/bad.yaml')), false);
    }
  }
  for (const source of ['!UnrecognizedWorkflowTag\n' + JSON.stringify(valid), JSON.stringify(valid).replace('"custom"', '!NestedTag custom')]) {
    evidence(root, 'bad.yaml', source);
    assert.throws(() => createWorkflow(root, 'bad', { definition: 'bad.yaml' }), /tag|YAML/i);
    assert.equal(fs.existsSync(path.join(root, '.aigile-workflows/custom/bad.yaml')), false);
  }
  assert.equal(parseStructured('value: !!str normal', 'yaml').value, 'normal');
});

test('advance before dev completes rejects without changing persisted bytes; restart preserves next step', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow order '));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    createWorkflow(root, 'custom', { steps: 'dev,qa' });
    const run = startRun(root, 'custom');
    const filename = path.join(root, '.aigile-workflows/runs', `${run.runId}.json`);
    const before = fs.readFileSync(filename);
    assert.throws(() => advanceRun(root, run.runId, 'result', { expectedRevision: 0, attemptId: 'qa-2:1', step: 'qa-2', status: 'succeeded', outputs: {} }), /Only current step/);
    assert.deepEqual(fs.readFileSync(filename), before);
    assert.equal(runStatus(root, run.runId).next.step, 'dev-1');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('bug workflow enforces approvals, QA snapshot, scoped draft PR and local evidence end to end', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow bug '));
  const put = (name, value) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), value); return { path: name, sha256: crypto.createHash('sha256').update(value).digest('hex') }; };
  try {
    put('src/code.js', 'old');
    put('issue.json', '{"summary":"fake bug"}');
    createWorkflow(root, 'bug-resolve-wf', { from: 'bug-resolve' });
    let run = startRun(root, 'bug-resolve-wf', { issue: 'PROJ-123', 'issue-export': 'issue.json' });
    const submit = () => ({ ...run.next.resultTemplate, outputs: Object.fromEntries(run.next.requiredOutputs.map(name => [name, put(`evidence/${name}.txt`, `${name} attestation`)])) });
    run = advanceRun(root, run.runId, 'result', submit());
    assert.equal(run.next.step, 'fix');
    assert.throws(() => advanceRun(root, run.runId, 'result', submit()), /approval required/);
    const scope = { repository: 'example/repo', base: 'main', head: 'bug-123', proposedChanges: 'Fix bug only', pushScope: 'none' };
    run = advanceRun(root, run.runId, 'approve', { expectedRevision: run.revision, attemptId: run.next.attemptId, step: 'fix', codeSnapshot: run.next.codeSnapshot, scope });
    put('src/code.js', 'fixed');
    run = runStatus(root, run.runId);
    assert.deepEqual(run.blockers, []);
    run = advanceRun(root, run.runId, 'result', submit());
    assert.equal(run.next.step, 'review');
    run = advanceRun(root, run.runId, 'result', submit());
    assert.equal(run.next.step, 'draft-pr');
    assert.throws(() => advanceRun(root, run.runId, 'result', submit()), /approval required/);
    const approval = { expectedRevision: run.revision, attemptId: run.next.attemptId, step: 'draft-pr', codeSnapshot: run.next.codeSnapshot, scope: { ...scope, pushScope: 'branch:bug-123' } };
    assert.throws(() => advanceRun(root, run.runId, 'approve', { ...approval, scope: { ...scope, pushScope: '*' } }), /pushScope/);
    run = advanceRun(root, run.runId, 'approve', approval);
    const result = submit();
    result.publication = { url: 'https://example.invalid/pull/1', repository: scope.repository, base: scope.base, head: scope.head, draft: true };
    assert.throws(() => advanceRun(root, run.runId, 'result', { ...result, publication: { ...result.publication, base: 'other' } }), /differs from approved scope/);
    put('src/code.js', 'changed after QA');
    assert.throws(() => advanceRun(root, run.runId, 'result', result), /Code snapshot changed/);
    put('src/code.js', 'fixed');
    run = advanceRun(root, run.runId, 'result', result);
    assert.equal(run.status, 'completed');
    assert.equal(run.next, null);
    assert.deepEqual(Object.values(canonicalRoles(undefined, 'copilot')).filter(name => ['Product Manager', 'Full Stack Developer', 'Test Architect & Quality Advisor', 'DevOps Engineer'].includes(name)).sort(), ['Product Manager', 'Full Stack Developer', 'Test Architect & Quality Advisor', 'DevOps Engineer'].sort());
    assert.equal(canonicalRoles(undefined, 'codex').dev, 'aigile-dev');
    assert.equal(canonicalRoles(undefined, 'claude').dev, 'dev');
    assert.equal(typeof codeSnapshot(root, ['src']), 'string');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('strict validator rejects unknown roles, guards, references, duplicate steps and executable schema', context => {
  const root = fixture(context);
  const valid = loadWorkflow(root, 'custom').definition;
  const invalid = [
    [definition => definition.workflow.sequence[0].agent = 'invented', /Unknown agent alias/],
    [definition => definition.workflow.sequence[0].guard = 'eval()', /Unknown guard/],
    [definition => definition.workflow.sequence[0].requires = ['later'], /earlier step/],
    [definition => definition.workflow.sequence[1].id = definition.workflow.sequence[0].id, /duplicate step/],
    [definition => definition.workflow.sequence[0].execute = 'echo unsafe', /Unknown step key/],
    [definition => definition.workflow.snapshotPaths = ['../outside'], /Unsafe workspace path/],
    [definition => definition.workflow.sequence[0].approval = 'publish', /code binding|qa-pass/],
  ];
  for (const [mutate, pattern] of invalid) {
    const definition = structuredClone(valid);
    mutate(definition);
    assert.throws(() => validateWorkflow(definition, ['dev', 'qa']), pattern);
  }
  assert.throws(() => parseStructured('{"__proto__": {"polluted":true}}'), /Forbidden key/);
  assert.throws(() => parseStructured('key: &ref [1]\ncopy: *ref', 'yaml'), /alias/i);
  assert.throws(() => parseStructured(' '.repeat(1024 * 1024 + 1)), /1 MiB/);
  assert.equal({}.polluted, undefined);
});

test('custom folder takes precedence over legacy and bundled definitions without changing frozen runs', context => {
  const root = fixture(context);
  const legacy = loadWorkflow(root, 'custom').definition;
  legacy.workflow.id = 'bug-resolve';
  fs.writeFileSync(path.join(root, '.aigile-workflows/bug-resolve.yaml'), JSON.stringify(legacy));
  assert.equal(loadWorkflow(root, 'bug-resolve').source.path, '.aigile-workflows/bug-resolve.yaml');
  const legacyRun = startRun(root, 'bug-resolve');
  const created = createWorkflow(root, 'bug-resolve', { steps: 'qa' });
  assert.equal(created.created, '.aigile-workflows/custom/bug-resolve.yaml');
  assert.equal(loadWorkflow(root, 'bug-resolve').source.path, created.created);
  const customRun = startRun(root, 'bug-resolve');
  assert.equal(customRun.next.role, 'qa');
  assert.equal(customRun.source.path, created.created);
  assert.equal(runStatus(root, legacyRun.runId).next.role, 'dev');
  assert.equal(runStatus(root, legacyRun.runId).source.path, '.aigile-workflows/bug-resolve.yaml');
  assert.equal(fs.readFileSync(path.join(root, '.aigile-workflows/bug-resolve.yaml'), 'utf8'), JSON.stringify(legacy));
  fs.writeFileSync(path.join(root, created.created), 'invalid');
  assert.throws(() => loadWorkflow(root, 'bug-resolve'), /workflow|object/i);
  assert.equal(runStatus(root, customRun.runId).next.role, 'qa');
  fs.unlinkSync(path.join(root, created.created));
  assert.equal(loadWorkflow(root, 'bug-resolve').source.path, '.aigile-workflows/bug-resolve.yaml');
  fs.unlinkSync(path.join(root, '.aigile-workflows/bug-resolve.yaml'));
  assert.equal(loadWorkflow(root, 'bug-resolve').source.kind, 'bundled');
});

test('create never overwrites; local precedence and frozen source survive definition edits', context => {
  const root = fixture(context);
  createWorkflow(root, 'bug-resolve', { steps: 'dev' });
  assert.equal(loadWorkflow(root, 'bug-resolve').source.kind, 'local');
  assert.throws(() => createWorkflow(root, 'bug-resolve', { steps: 'qa' }), /EEXIST/);
  const run = startRun(root, 'bug-resolve');
  fs.writeFileSync(path.join(root, '.aigile-workflows/custom/bug-resolve.yaml'), 'invalid');
  assert.equal(runStatus(root, run.runId).next.role, 'dev');
  assert.deepEqual(runStatus(root, run.runId).source, run.source);
  assert.equal(fs.readFileSync(path.join(root, '.aigile-workflows/.gitignore'), 'utf8'), '# AIgile local execution state\n/runs/\n');
});

test('custom definition directory rejects junctions and unsafe names without writing outside', context => {
  const root = fixture(context);
  const directory = path.join(root, '.aigile-workflows/custom');
  fs.rmSync(directory, { recursive: true });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow outside '));
  context.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createWorkflow(root, 'linked', { steps: 'qa' }), /symlink\/junction/);
  assert.throws(() => loadWorkflow(root, 'bug-resolve'), /symlink\/junction/);
  assert.throws(() => createWorkflow(root, '../escape', { steps: 'qa' }), /identifier/);
  assert.throws(() => loadWorkflow(root, '../escape'), /identifier/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('typed required inputs and file evidence stay immutable; unknown submission fields reject', context => {
  const root = fixture(context);
  const definition = loadWorkflow(root, 'custom').definition;
  definition.workflow.inputs = { target: { type: 'file', required: true, description: 'Input artifact' }, count: { type: 'number', required: true, description: 'Number' } };
  fs.writeFileSync(path.join(root, 'definition.yaml'), JSON.stringify(definition));
  createWorkflow(root, 'typed', { definition: 'definition.yaml' });
  assert.throws(() => startRun(root, 'typed'), /Missing required input/);
  assert.throws(() => startRun(root, 'typed', { target: 'input.txt', count: 'two' }), /ENOENT|Wrong input type/);
  evidence(root, 'input.txt');
  assert.throws(() => startRun(root, 'typed', { target: 'input.txt', count: 'two' }), /Wrong input type/);
  const run = startRun(root, 'typed', { target: 'input.txt', count: 2 });
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', { ...success(root, run), inputs: { count: 3 } }), /Unknown submission key/);
  fs.writeFileSync(path.join(root, 'input.txt'), 'changed input');
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /Artifact hash mismatch/);
  assert.equal(runStatus(root, run.runId).blockers.length, 1);
});

test('required outputs, bad hashes, stale revisions and duplicate submissions preserve state', context => {
  const root = fixture(context);
  const run = startRun(root, 'custom');
  const payload = success(root, run);
  for (const [change, pattern] of [
    [{ outputs: {} }, /Required outputs/],
    [{ expectedRevision: 9 }, /expectedRevision/],
    [{ expectedRevision: undefined }, /expectedRevision/],
    [{ attemptId: 'dev-1:99' }, /attemptId/],
    [{ outputs: { 'evidence-1': { path: 'evidence-1.txt', sha256: '0'.repeat(64) } } }, /hash mismatch/],
  ]) unchanged(root, run, () => advanceRun(root, run.runId, 'result', { ...payload, ...change }), pattern);
  const next = advanceRun(root, run.runId, 'result', payload);
  unchanged(root, next, () => advanceRun(root, run.runId, 'result', payload), /expectedRevision/);
});

test('QA failure stops; explicit bounded retry invalidates downstream artifacts and attempt IDs', context => {
  const root = fixture(context);
  let run = startRun(root, 'custom');
  run = advanceRun(root, run.runId, 'result', success(root, run));
  run = advanceRun(root, run.runId, 'result', { ...success(root, run), status: 'failed', verdict: 'fail', reason: 'QA found regression' });
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /Run is failed/);
  run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'dev-1' });
  assert.equal(run.next.attemptId, 'dev-1:2');
  assert.deepEqual(run.next.evidence, {});
  run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'dev-1' });
  unchanged(root, run, () => advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'dev-1' }), /Retry limit/);
  unchanged(root, run, () => advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'qa-2' }), /future step/);
});

test('downstream invalidation changes attempt IDs without consuming that steps retry allowance', context => {
  const root = fixture(context);
  let run = startRun(root, 'custom');
  for (let iteration = 0; iteration < 2; iteration++) run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'dev-1' });
  run = advanceRun(root, run.runId, 'result', success(root, run));
  assert.equal(run.next.attemptId, 'qa-2:3');
  run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'qa-2' });
  assert.equal(run.next.attemptId, 'qa-2:4');
});

test('uncertain outcomes require artifact-backed reconciliation and never blind retry', context => {
  const root = fixture(context, 'dev');
  let run = startRun(root, 'custom');
  run = advanceRun(root, run.runId, 'result', { expectedRevision: run.revision, attemptId: run.next.attemptId, step: run.next.step, status: 'uncertain', reason: 'Worker lost response' });
  unchanged(root, run, () => advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: run.next.step }), /reconcile before retry/);
  const payload = { expectedRevision: run.revision, attemptId: run.next.attemptId, step: run.next.step, outcome: 'not-performed' };
  unchanged(root, run, () => advanceRun(root, run.runId, 'reconcile', payload), /artifact must be an object/);
  run = advanceRun(root, run.runId, 'reconcile', { ...payload, reconciliation: evidence(root, 'reconcile.txt', 'Confirmed no action performed') });
  assert.equal(run.status, 'failed');
  run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: run.next.step });
  run = advanceRun(root, run.runId, 'result', success(root, run));
  assert.equal(run.status, 'completed');
});

test('workspace paths, junctions, existing locks, read-only state and failed rename are rejected safely', context => {
  const root = fixture(context);
  for (const relative of ['../x', '/tmp/x', 'C:/x', 'src\\x', 'src/../x', 'src//x', 'NUL', 'x:stream', 'src. /x']) assert.throws(() => workspacePath(root, relative), /Unsafe workspace path/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow outside '));
  context.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => workspacePath(root, 'linked/file.json'), /symlink\/junction/);
  let run = startRun(root, 'custom');
  const statePath = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  const payload = success(root, run);
  fs.writeFileSync(`${statePath}.lock`, 'another operation');
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', payload), /EEXIST/);
  fs.unlinkSync(`${statePath}.lock`);
  fs.chmodSync(statePath, 0o400);
  try { unchanged(root, run, () => advanceRun(root, run.runId, 'result', payload), /read-only/); }
  finally { fs.chmodSync(statePath, 0o600); }
  const rename = fs.renameSync;
  const spawnSync = childProcess.spawnSync;
  if (process.platform === 'win32') childProcess.spawnSync = () => ({ status: 1, stderr: 'simulated failed rename' });
  else fs.renameSync = () => { throw new Error('simulated failed rename'); };
  try { unchanged(root, run, () => advanceRun(root, run.runId, 'result', payload), /simulated failed rename/); }
  finally { fs.renameSync = rename; childProcess.spawnSync = spawnSync; }
  assert.deepEqual(fs.readdirSync(path.dirname(statePath)), [`${run.runId}.json`]);
  run = advanceRun(root, run.runId, 'result', payload);
  assert.equal(run.revision, 1);
  if (process.platform !== 'win32') assert.equal(fs.statSync(statePath).mode & 0o777, 0o600);
});

test('changed earlier evidence blocks later success even when it is not a direct requirement', context => {
  const root = fixture(context, 'pm,dev,qa');
  let run = startRun(root, 'custom');
  run = advanceRun(root, run.runId, 'result', success(root, run));
  run = advanceRun(root, run.runId, 'result', success(root, run));
  fs.writeFileSync(path.join(root, 'evidence-1.txt'), 'mutated acceptance');
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /hash mismatch/);
});

test('contribution frontier allows two writers but invalidates review after any later writer', context => {
  const root = fixture(context, 'dev,dev,qa,devops');
  const definition = loadWorkflow(root, 'custom').definition;
  assert.equal(definition.workflow.sequence[0].writesCode, true);
  assert.equal(definition.workflow.sequence[1].writesCode, true);
  let run = startRun(root, 'custom');
  evidence(root, 'src/code.js', 'first contribution');
  run = runStatus(root, run.runId);
  run = advanceRun(root, run.runId, 'result', success(root, run));
  evidence(root, 'src/code.js', 'second contribution');
  run = runStatus(root, run.runId);
  assert.deepEqual(run.blockers, []);
  run = advanceRun(root, run.runId, 'result', success(root, run));
  evidence(root, 'src/code.js', 'changed during QA');
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /Code snapshot changed/);
  evidence(root, 'src/code.js', 'second contribution');
  run = advanceRun(root, run.runId, 'result', success(root, run));
  evidence(root, 'src/code.js', 'changed after QA');
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /Code snapshot changed/);
  evidence(root, 'src/code.js', 'second contribution');
  run = advanceRun(root, run.runId, 'result', success(root, run));
  assert.equal(run.status, 'completed');
  const writer = { ...definition.workflow.sequence[0], id: 'late-writer', agent: 'security', requires: ['evidence-3'], creates: ['late-change'] };
  definition.workflow.sequence.splice(3, 0, writer);
  definition.workflow.sequence.at(-1).approval = 'publish';
  evidence(root, 'late.yaml', JSON.stringify(definition));
  createWorkflow(root, 'late', { definition: 'late.yaml' });
  run = startRun(root, 'late');
  for (let index = 0; index < 4; index++) run = advanceRun(root, run.runId, 'result', success(root, run));
  assert.match(run.blockers.join('; '), /review.*latest writer/i);
  unchanged(root, run, () => advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope: { repository: 'repo', base: 'main', head: 'fix', proposedChanges: 'fix', pushScope: 'branch:fix' } }), /review.*latest writer/i);
  for (const mutation of [step => step.writesCode = 'true', step => step.binding = 'none', step => step.guard = 'reviewed-code']) {
    const invalid = structuredClone(definition);
    mutation(invalid.workflow.sequence[0]);
    assert.throws(() => validateWorkflow(invalid, Object.keys(canonicalRoles())), /writesCode/);
  }
});

test('review independence rejects cherry-picked older evidence after a security writer', context => {
  const root = fixture(context, 'dev,security,qa,devops');
  const definition = loadWorkflow(root, 'custom').definition;
  const sequence = definition.workflow.sequence;
  sequence[1].writesCode = true;
  sequence[2].agent = 'security';
  sequence[2].requires = sequence[0].creates;
  sequence[3].approval = 'publish';
  evidence(root, 'self-review.yaml', JSON.stringify(definition));
  assert.throws(() => createWorkflow(root, 'self-review', { definition: 'self-review.yaml' }), /independent.*contribution|contribution.*independent/i);
  assert.equal(fs.existsSync(path.join(root, '.aigile-workflows/custom/self-review.yaml')), false);
});

test('independent QA covers all contributors and corrupted chosen references cannot authorize publication', context => {
  const root = fixture(context, 'dev,security,qa,devops');
  const definition = loadWorkflow(root, 'custom').definition;
  definition.workflow.sequence[1].writesCode = true;
  definition.workflow.sequence[2].requires = ['evidence-1', 'evidence-2'];
  definition.workflow.sequence[3].approval = 'publish';
  for (const [agent, requires] of [['dev', ['evidence-2']], ['security', ['evidence-1']]]) {
    const invalid = structuredClone(definition);
    Object.assign(invalid.workflow.sequence[2], { agent, requires });
    assert.throws(() => validateWorkflow(invalid, Object.keys(canonicalRoles())), /independent.*contribution/);
  }
  evidence(root, 'independent.yaml', JSON.stringify(definition));
  createWorkflow(root, 'independent', { definition: 'independent.yaml' });
  let run = startRun(root, 'independent');
  for (const code of ['dev change', 'security change']) {
    evidence(root, 'src/code.js', code);
    run = runStatus(root, run.runId);
    run = advanceRun(root, run.runId, 'result', success(root, run));
  }
  run = advanceRun(root, run.runId, 'result', success(root, run));
  const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  const baseline = bytes(root, run);
  const corrupted = JSON.parse(baseline);
  Object.assign(corrupted.definition.workflow.sequence[2], { agent: 'security', requires: ['evidence-1'] });
  corrupted.frozenHash = crypto.createHash('sha256').update(JSON.stringify({ definition: corrupted.definition, source: corrupted.source, inputs: corrupted.inputs, inputArtifacts: corrupted.inputArtifacts })).digest('hex');
  assert.match(describe(root, corrupted).blockers.join('; '), /independent.*contribution/);
  fs.writeFileSync(filename, JSON.stringify(corrupted));
  unchanged(root, run, () => runStatus(root, run.runId), /independent.*contribution/);
  unchanged(root, run, () => advanceRun(root, run.runId, 'approve', run.next.approvalTemplate), /independent.*contribution/);
  fs.writeFileSync(filename, baseline);
  const scope = { repository: 'repo', base: 'main', head: 'fix', proposedChanges: 'dev and security changes', pushScope: 'branch:fix' };
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope });
  run = advanceRun(root, run.runId, 'result', { ...success(root, run), publication: { url: 'https://example.invalid/pull/1', repository: 'repo', base: 'main', head: 'fix', draft: true } });
  assert.equal(run.status, 'completed');
});

test('prior independent review never makes the latest writer eligible to self-review identical bytes', context => {
  const root = fixture(context, 'dev,qa,security,qa,devops');
  const definition = loadWorkflow(root, 'custom').definition;
  const sequence = definition.workflow.sequence;
  sequence[2].writesCode = true;
  sequence[3].agent = 'security';
  sequence[3].requires = ['evidence-2'];
  assert.throws(() => validateWorkflow(definition, Object.keys(canonicalRoles())), /independent.*contribution/);
  sequence[3].agent = 'dev';
  assert.doesNotThrow(() => validateWorkflow(definition, Object.keys(canonicalRoles())));
  sequence[3].agent = 'qa';
  sequence[3].requires = ['evidence-3'];
  sequence[4].requires = ['evidence-2'];
  evidence(root, 'prior.yaml', JSON.stringify(definition));
  createWorkflow(root, 'prior', { definition: 'prior.yaml' });
  let run = startRun(root, 'prior');
  for (let index = 0; index < 4; index++) run = advanceRun(root, run.runId, 'result', success(root, run));
  assert.match(run.blockers.join('; '), /review.*latest writer/i);
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /review.*latest writer/i);
});

test('metadata segments cannot enter snapshots evidence definitions or inputs', context => {
  const root = fixture(context);
  const names = process.platform === 'win32' ? ['.GIT', '.AiGiLe-WoRkFlOwS'] : ['.git', '.aigile-workflows'];
  const definition = loadWorkflow(root, 'custom').definition;
  for (const name of names) {
    fs.mkdirSync(path.join(root, name), { recursive: true });
    evidence(root, `${name}/definition.yaml`, JSON.stringify(definition));
    assert.throws(() => codeSnapshot(root, [name]), /metadata|state|\.git/);
    assert.throws(() => createWorkflow(root, 'forbidden', { definition: `${name}/definition.yaml` }), /metadata|state|\.git/);
    const run = startRun(root, 'custom');
    const payload = success(root, run);
    payload.outputs['evidence-1'] = evidence(root, `${name}/report.txt`);
    unchanged(root, run, () => advanceRun(root, run.runId, 'result', payload), /metadata|state|\.git/);
  }
  evidence(root, '.git-not-metadata.txt');
  assert.equal(typeof codeSnapshot(root, ['.git-not-metadata.txt']), 'string');
  if (process.platform !== 'win32') {
    fs.mkdirSync(path.join(root, '.GIT'));
    assert.equal(typeof codeSnapshot(root, ['.GIT']), 'string');
  }
});

test('revision accounting rejects a fresh run changed from zero to one without any event', context => {
  const root = fixture(context);
  const run = startRun(root, 'custom');
  const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  const state = JSON.parse(bytes(root, run));
  state.revision = 1;
  fs.writeFileSync(filename, JSON.stringify(state));
  unchanged(root, run, () => runStatus(root, run.runId), /revision|journal/i);
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', { ...success(root, run), expectedRevision: 1 }), /revision|journal/i);
});

test('revision journal rejects offsets in every lifecycle state and retains invalidated approvals and results', context => {
  const root = fixture(context);
  createWorkflow(root, 'journal', { from: 'bug-resolve' });
  let run = startRun(root, 'journal', { issue: 'LOCAL-1' });
  const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  let priorEvents = [];
  const check = label => {
    const baseline = bytes(root, run);
    const state = JSON.parse(baseline);
    assert.equal(state.revision, state.journal.length, label);
    assert.deepEqual(state.journal.slice(0, priorEvents.length), priorEvents, label);
    priorEvents = state.journal;
    for (const offset of [-1, 1]) {
      fs.writeFileSync(filename, JSON.stringify({ ...state, revision: state.revision + offset }));
      unchanged(root, run, () => runStatus(root, run.runId), /revision|journal/i);
    }
    fs.writeFileSync(filename, baseline);
    assert.equal(runStatus(root, run.runId).revision, run.revision, label);
  };
  const scope = { repository: 'repo', base: 'main', head: 'fix', proposedChanges: 'local work', pushScope: 'none' };
  const submit = () => { run = advanceRun(root, run.runId, 'result', success(root, run)); };
  check('fresh');
  submit();
  check('intermediate');
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope });
  check('approved');
  run = advanceRun(root, run.runId, 'result', { ...run.next.failureTemplate, reason: 'Failed implementation' });
  check('failed');
  run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'fix' });
  check('retried');
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope });
  submit();
  submit();
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope: { ...scope, pushScope: 'branch:fix' } });
  run = advanceRun(root, run.runId, 'result', { expectedRevision: run.revision, attemptId: run.next.attemptId, step: run.next.step, status: 'uncertain', reason: 'Lost response' });
  check('uncertain');
  run = advanceRun(root, run.runId, 'reconcile', { expectedRevision: run.revision, attemptId: run.next.attemptId, step: run.next.step, outcome: 'not-performed', reconciliation: evidence(root, 'not-performed.txt') });
  check('reconciled');
  run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: run.next.step });
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope: { ...scope, pushScope: 'branch:fix' } });
  run = advanceRun(root, run.runId, 'result', { ...success(root, run), publication: { url: 'https://example.invalid/pull/1', repository: 'repo', base: 'main', head: 'fix', draft: true } });
  check('completed');
  const baseline = bytes(root, run);
  const changes = [
    state => state.journal.splice(1, 1),
    state => state.journal.splice(1, 0, state.journal[1]),
    state => state.journal[0].revision++,
    state => state.journal[1].revision--,
    state => state.journal[1].approval.revision++,
    state => state.journal[1].approval.revision--,
    state => state.journal[2].result.expectedRevision++,
    state => state.journal[2].result.expectedRevision--,
    state => state.journal[0].action = 'invented',
    state => state.results.fix.expectedRevision++,
    state => state.results.fix.expectedRevision--,
    state => state.results.fix.approval.revision++,
    state => state.results.fix.approval.revision--,
  ];
  for (const corrupt of changes) {
    const state = JSON.parse(baseline);
    corrupt(state);
    fs.writeFileSync(filename, JSON.stringify(state));
    unchanged(root, run, () => runStatus(root, run.runId), /revision|journal|approval/i);
  }
  fs.writeFileSync(filename, baseline);
});

test('legacy runs are rejected explicitly without rewriting their state', context => {
  const root = fixture(context);
  const run = startRun(root, 'custom');
  const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  const state = JSON.parse(bytes(root, run));
  state.schemaVersion = 1;
  delete state.journal;
  fs.writeFileSync(filename, JSON.stringify(state));
  unchanged(root, run, () => runStatus(root, run.runId), /Unsupported run state format.*no automatic migration/);
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /Unsupported run state format/);
});

test('deep persisted consistency rejects individual corruptions without changing state', context => {
  const root = fixture(context);
  createWorkflow(root, 'guarded', { from: 'bug-resolve' });
  let run = startRun(root, 'guarded', { issue: 'LOCAL-1' });
  run = advanceRun(root, run.runId, 'result', success(root, run));
  const scope = { repository: 'local/repo', base: 'main', head: 'fix', proposedChanges: 'Local fix', pushScope: 'none' };
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope });
  run = advanceRun(root, run.runId, 'result', success(root, run));
  run = advanceRun(root, run.runId, 'result', success(root, run));
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope: { ...scope, pushScope: 'branch:fix' } });
  const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  const baseline = bytes(root, run);
  const corruptions = [
    state => state.results.review.verdict = 'fail',
    state => state.approval.attemptId = 'fix:0',
    state => state.approval.scope = {},
    state => state.approval.revision = 0,
    state => state.approval.codeSnapshot = '0'.repeat(64),
    state => delete state.results.review.outputs['qa-report'],
    state => state.results.review.outputs['qa-report'].sha256 = 'xyz',
    state => state.results.review.outputs['qa-report'].path = '../outside',
    state => state.results.review.expectedRevision = state.results.fix.expectedRevision,
    state => state.results.fix.attemptId = 'fix:0',
    state => state.results.fix.approval.scope = {},
    state => state.results.fix.approval.revision--,
    state => state.attempts.fix++,
    state => state.retries.unknown = 0,
    state => state.current = 2,
    state => state.schemaVersion = 999,
    state => state.revision = 1,
    state => state.revision = Number.MAX_SAFE_INTEGER,
    state => state.results.review.codeSnapshot = '0'.repeat(64),
  ];
  for (const corrupt of corruptions) {
    const state = JSON.parse(baseline);
    corrupt(state);
    fs.writeFileSync(filename, JSON.stringify(state));
    unchanged(root, run, () => runStatus(root, run.runId));
    unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)));
  }
  fs.writeFileSync(filename, baseline);
  let uncertain = advanceRun(root, run.runId, 'result', { expectedRevision: run.revision, attemptId: run.next.attemptId, step: run.next.step, status: 'uncertain', reason: 'Publication response unavailable' });
  const uncertainState = JSON.parse(bytes(root, uncertain));
  uncertainState.approval = null;
  fs.writeFileSync(filename, JSON.stringify(uncertainState));
  unchanged(root, uncertain, () => runStatus(root, uncertain.runId));
  fs.writeFileSync(filename, baseline);
  const payload = success(root, run);
  payload.publication = { url: 'https://example.invalid/pull/1', repository: scope.repository, base: scope.base, head: scope.head, draft: true };
  run = advanceRun(root, run.runId, 'result', payload);
  const completed = JSON.parse(bytes(root, run));
  completed.results['draft-pr'].publication.head = 'unapproved';
  fs.writeFileSync(filename, JSON.stringify(completed));
  unchanged(root, run, () => runStatus(root, run.runId));
});

test('Windows replacement preserves protected and inherited owner DACL exactly and helper failure is unchanged', { skip: process.platform !== 'win32' }, context => {
  const root = fixture(context);
  const inspect = (filename, protect = false, inherit = false) => {
    const result = childProcess.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('./workflow-acl-fixture.ps1', import.meta.url))], { input: JSON.stringify({ path: filename, protect, inherit }), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  };
  for (const protect of [false, true]) {
    let run = startRun(root, 'custom');
    const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
    const before = inspect(filename, protect, !protect);
    assert.equal(before.protected, protect);
    run = advanceRun(root, run.runId, 'result', success(root, run));
    assert.deepEqual(inspect(filename), before);
    const original = childProcess.spawnSync;
    childProcess.spawnSync = (executable, args, options) => JSON.parse(options.input).operation === 'write' ? { status: 1, stderr: 'injected security helper failure', stdout: '' } : original(executable, args, options);
    try { unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /security helper failure/); }
    finally { childProcess.spawnSync = original; }
    assert.deepEqual(inspect(filename), before);
    assert.deepEqual(fs.readdirSync(path.dirname(filename)).filter(name => /\.tmp$|\.lock$|\.bak$/.test(name)), []);
    context.diagnostic(`Windows ${protect ? 'protected' : 'inherited'} owner/DACL unchanged: ${JSON.stringify(before)}`);
  }
});

test('POSIX replacement preserves private mode owner and group', { skip: process.platform === 'win32' }, context => {
  const root = fixture(context);
  const run = startRun(root, 'custom');
  const filename = path.join(root, `.aigile-workflows/runs/${run.runId}.json`);
  fs.chmodSync(filename, 0o640);
  const before = fs.statSync(filename);
  advanceRun(root, run.runId, 'result', success(root, run));
  const after = fs.statSync(filename);
  for (const key of ['mode', 'uid', 'gid']) assert.equal(after[key], before[key]);
});

test('initial code-bound evidence and nonwriter scope approval remain snapshot bound', context => {
  const root = fixture(context, 'pm,qa');
  const definition = loadWorkflow(root, 'custom').definition;
  definition.workflow.snapshotPaths = ['src'];
  definition.workflow.sequence[0].binding = 'code';
  definition.workflow.sequence[0].approval = 'scope';
  definition.workflow.sequence[1].binding = 'code';
  definition.workflow.sequence[1].guard = 'reviewed-code';
  evidence(root, 'initial.yaml', JSON.stringify(definition));
  createWorkflow(root, 'initial', { definition: 'initial.yaml' });
  let run = startRun(root, 'initial');
  run = advanceRun(root, run.runId, 'approve', { ...run.next.approvalTemplate, scope: { repository: 'repo', base: 'main', head: 'work', proposedChanges: 'review only', pushScope: 'none' } });
  evidence(root, 'src/code.js', 'not authorized');
  assert.match(runStatus(root, run.runId).blockers.join('; '), /approval/i);
  unchanged(root, run, () => advanceRun(root, run.runId, 'result', success(root, run)), /approval/i);
  fs.unlinkSync(path.join(root, 'src/code.js'));
  run = advanceRun(root, run.runId, 'result', success(root, run));
  run = advanceRun(root, run.runId, 'result', success(root, run));
  assert.equal(run.status, 'completed');
});

test('live drift permits failure persistence and explicit recovery without certifying success', context => {
  const root = fixture(context);
  let run = startRun(root, 'custom');
  run = advanceRun(root, run.runId, 'result', success(root, run));
  fs.unlinkSync(path.join(root, 'evidence-1.txt'));
  evidence(root, 'src/code.js', 'unexpected change');
  run = runStatus(root, run.runId);
  assert.ok(run.blockers.length);
  run = advanceRun(root, run.runId, 'result', { ...success(root, run), codeSnapshot: codeSnapshot(root, ['src']), status: 'failed', verdict: 'fail', reason: 'Evidence disappeared and code drifted' });
  assert.equal(run.status, 'failed');
  assert.equal(runStatus(root, run.runId).status, 'failed');
  run = advanceRun(root, run.runId, 'retry', { expectedRevision: run.revision, step: 'dev-1' });
  assert.equal(run.next.attemptId, 'dev-1:2');
});

test('failed initial lock flush removes only its own lock and preserves original bytes', context => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow lock failure '));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filename = path.join(root, 'state.json');
  fs.writeFileSync(filename, 'unchanged original');
  if (process.platform === 'win32') {
    const source = fs.readFileSync(fileURLToPath(new URL('../shared/workflow-file.ps1', import.meta.url)), 'utf8');
    assert.ok(source.includes('$stream.Flush($true)'));
    const instrumented = path.join(root, 'fault helper.ps1');
    fs.writeFileSync(instrumented, source.replace('$stream.Flush($true)', 'throw "injected lock flush failure"'));
    const result = childProcess.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', instrumented], { input: JSON.stringify({ operation: 'lock', filename }), encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /injected lock flush failure/);
  } else {
    const original = fs.fsyncSync;
    fs.fsyncSync = () => { throw new Error('injected lock flush failure'); };
    try { assert.throws(() => workflowLock(filename), /injected lock flush failure/); }
    finally { fs.fsyncSync = original; }
  }
  assert.equal(fs.readFileSync(filename, 'utf8'), 'unchanged original');
  assert.equal(fs.existsSync(`${filename}.lock`), false);
});