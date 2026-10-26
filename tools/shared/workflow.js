import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { collectSources, frontmatter, codexRole } from './client-assets.js';
import { isIdentifier, insist, keys, text, relativePath, externalPath, parseStructured, validateWorkflow, independentReview } from './workflow-schema.js';
import { workflowLock, writeWorkflowFile } from './workflow-file.js';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const digest = value => hash(JSON.stringify(value));
const store = '.aigile-workflows';
const maxFile = 16 * 1024 * 1024;

export function workspacePath(root, relative) {
  relativePath(relative);
  let current = path.resolve(root);
  for (const part of [null, ...relative.split('/')]) {
    if (part) current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    insist(!stat?.isSymbolicLink(), `Refusing symlink/junction: ${relative}`);
  }
  return current;
}
function content(root, relative, limit = maxFile) {
  const filename = workspacePath(root, relative);
  const stat = fs.lstatSync(filename);
  insist(stat.isFile() && stat.size <= limit, `Expected regular file <= ${limit} bytes: ${relative}`);
  return fs.readFileSync(filename);
}
function jsonFile(root, relative) {
  return parseStructured(content(root, externalPath(relative), 1024 * 1024).toString());
}
function privateWrite(root, relative, value, replace = false, expected) {
  insist(Buffer.byteLength(value) <= 1024 * 1024, 'Persisted workflow exceeds 1 MiB');
  const filename = workspacePath(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  workspacePath(root, relative);
  if (replace) {
    const mode = fs.statSync(filename).mode;
    insist((mode & 0o200) !== 0, `Refusing read-only state: ${relative}`);
  }
  writeWorkflowFile(filename, value, replace, expected);
}
export function canonicalRoles(root = packageRoot, host = 'manual') {
  const directory = path.join(root, 'core/agents');
  return Object.fromEntries([...collectSources(directory, host === 'copilot')].map(([id, filename]) => {
    const source = fs.readFileSync(path.join(directory, filename), 'utf8');
    const metadata = frontmatter(source).metadata;
    const role = codexRole({ id, filename, content: source });
    const identity = /^agent:\s*\r?\n/.test(source) ? YAML.parse(source).agent : null;
    const title = host === 'codex' ? role.name : host === 'copilot' ? metadata.name || identity?.title || identity?.role || (role.title !== id ? role.title : null) : host === 'claude' ? id : null;
    return [id, title];
  }));
}
function validate(definition) {
  return validateWorkflow(definition, Object.keys(canonicalRoles()));
}
export function loadWorkflow(root, name) {
  insist(isIdentifier(name), 'Workflow name must be a lowercase identifier');
  const local = [`${store}/custom/${name}.yaml`, `${store}/${name}.yaml`]
    .find(relative => fs.existsSync(workspacePath(root, relative)));
  const source = local ? { kind: 'local', path: local } : { kind: 'bundled', path: `core/workflows/deterministic/${name}.yaml` };
  const sourceRoot = source.kind === 'local' ? root : packageRoot;
  const bytes = content(sourceRoot, source.path, 1024 * 1024);
  return { definition: validate(parseStructured(bytes.toString(), 'yaml')), source: { ...source, sha256: hash(bytes) } };
}
export function createWorkflow(root, name, options) {
  insist(isIdentifier(name), 'Workflow name must be a lowercase identifier');
  insist([options.from, options.steps, options.definition].filter(value => value !== undefined).length === 1, 'create requires exactly one of --from, --steps, --definition');
  let definition;
  if (options.definition) definition = parseStructured(content(root, externalPath(options.definition), 1024 * 1024).toString(), 'yaml');
  else if (options.from) {
    insist(isIdentifier(options.from), 'Invalid template name');
    definition = parseStructured(content(packageRoot, `core/workflows/deterministic/${options.from}.yaml`, 1024 * 1024).toString(), 'yaml');
  } else {
    const roles = options.steps.split(',');
    const implementation = agent => ['dev', 'expert-react-frontend-engineer'].includes(agent);
    const codeBound = roles.some(implementation);
    const sequence = [];
    for (const [index, agent] of roles.entries()) {
      const reviewed = sequence.findLast(step => step.guard === 'reviewed-code');
      const guard = agent === 'qa' && sequence.some(step => step.writesCode) ? 'reviewed-code' : agent === 'devops' && reviewed ? 'qa-pass' : 'evidence';
      sequence.push({ id: `${agent}-${index + 1}`, agent, instructions: `Perform the approved ${agent} work; submit an evidence artifact.`, requires: index ? [`evidence-${index}`, ...(guard === 'qa-pass' && !sequence.at(-1).creates.includes(reviewed.creates[0]) ? reviewed.creates : [])] : [], creates: [`evidence-${index + 1}`], capabilities: ['manual-work'], guard, approval: 'none', maxRetries: 2, binding: codeBound ? 'code' : 'none', writesCode: implementation(agent) });
    }
    definition = { schemaVersion: 1, workflow: { id: name, name, description: 'Custom ordered workflow. Review instructions before running.', inputs: {}, snapshotPaths: codeBound ? ['src'] : [], sequence } };
  }
  validate(definition);
  definition.workflow.id = name;
  if (options['snapshot-paths']) definition.workflow.snapshotPaths = options['snapshot-paths'].split(',');
  validate(definition);
  const relative = `${store}/custom/${name}.yaml`;
  privateWrite(root, relative, YAML.stringify(definition));
  return { created: relative, source: options.from || options.definition || 'ordered roles', definition };
}
function artifact(root, relative) {
  externalPath(relative);
  return { path: relative, sha256: hash(content(root, relative)) };
}
function verifyArtifact(root, entry) {
  keys(entry, ['path', 'sha256'], 'artifact');
  insist(typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256), 'artifact.sha256 must be a SHA256');
  insist(artifact(root, entry.path).sha256 === entry.sha256, `Artifact hash mismatch: ${entry.path}`);
}
export function codeSnapshot(root, paths) {
  const files = [];
  let total = 0;
  function visit(relative) {
    externalPath(relative);
    insist(files.length < 10000, 'Code snapshot exceeds 10000 files');
    const filename = workspacePath(root, relative);
    const stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      files.push([`${relative}/`, null]);
      for (const child of fs.readdirSync(filename).sort()) visit(`${relative}/${child}`);
    } else {
      total += stat.size;
      insist(total <= 64 * 1024 * 1024, 'Code snapshot exceeds 64 MiB');
      files.push([relative, hash(content(root, relative))]);
    }
  }
  for (const relative of [...paths].sort()) visit(relative);
  return digest(files);
}
function runPath(id) {
  insist(typeof id === 'string' && /^run-[a-f0-9-]{36}$/.test(id), 'Invalid run ID');
  return `${store}/runs/${id}.json`;
}
function immutable(state) {
  return digest({ definition: state.definition, source: state.source, inputs: state.inputs, inputArtifacts: state.inputArtifacts });
}
function readState(root, id) {
  const state = parseStructured(content(root, runPath(id), 4 * 1024 * 1024).toString());
  validateState(state, id);
  return state;
}
function required(value, names, label) {
  keys(value, names, label);
  insist(names.every(name => Object.hasOwn(value, name)), `Missing ${label} fields`);
}
function sha(value) { insist(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'Invalid SHA256'); }
function artifactShape(entry) {
  required(entry, ['path', 'sha256'], 'artifact');
  externalPath(entry.path);
  sha(entry.sha256);
}
function outputShape(outputs, step) {
  required(outputs, step.creates, `${step.id} outputs`);
  for (const entry of Object.values(outputs)) artifactShape(entry);
}
function reviewFor(state, step, before) {
  const sequence = state.definition.workflow.sequence;
  const prior = sequence.slice(0, before).filter(candidate => state.results[candidate.id]?.status === 'succeeded');
  const writer = prior.findLast(candidate => candidate.writesCode);
  const review = prior.findLast(candidate => candidate.guard === 'reviewed-code' && candidate.agent !== step.agent && candidate.creates.some(name => step.requires.includes(name)));
  insist(review && (!writer || sequence.indexOf(review) > sequence.indexOf(writer)) && state.results[review.id].verdict === 'pass', 'Passing review must follow the latest writer');
  independentReview(prior, review, prior.indexOf(review));
  return state.results[review.id].codeSnapshot;
}
function approvalShape(state, approval, step, lowerRevision, upperRevision, snapshot) {
  required(approval, ['scope', 'attemptId', 'revision', 'codeSnapshot'], 'approval');
  insist(step.approval !== 'none' && approval.attemptId === attempt(state, step), 'Invalid approval attempt');
  scopeCheck(approval.scope, step.approval === 'publish');
  insist(Number.isSafeInteger(approval.revision) && approval.revision > lowerRevision && approval.revision <= upperRevision, 'Invalid approval revision');
  if (state.definition.workflow.snapshotPaths.length) sha(approval.codeSnapshot);
  else insist(approval.codeSnapshot === null, 'Unexpected approval snapshot');
  if (snapshot !== undefined) insist(approval.codeSnapshot === snapshot, 'Invalid approval snapshot binding');
}
function publicationShape(publication, approval) {
  required(publication, ['url', 'repository', 'base', 'head', 'draft'], 'publication');
  text(publication.url, 'publication.url');
  const url = new URL(publication.url);
  insist(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && publication.draft === true, 'Invalid draft publication URL');
  for (const name of ['repository', 'base', 'head']) insist(publication[name] === approval.scope[name], `Publication ${name} differs from approved scope`);
}
function validateJournal(state) {
  insist(Array.isArray(state.journal) && state.journal.length === state.revision, 'Invalid revision journal length');
  const replay = { ...state, revision: 0, current: 0, status: 'ready', results: {}, approval: null,
    attempts: Object.fromEntries(state.definition.workflow.sequence.map(step => [step.id, 1])),
    retries: Object.fromEntries(state.definition.workflow.sequence.map(step => [step.id, 0])) };
  for (const event of state.journal) {
    required(event, ['revision', 'action', 'step', 'result', 'approval'], 'journal event');
    insist(event.revision === replay.revision + 1, 'Invalid journal revision sequence');
    insist(['approve', 'result', 'reconcile', 'retry'].includes(event.action), 'Invalid journal action');
    const step = currentStep(replay);
    if (event.action === 'retry') {
      insist(event.result === null && event.approval === null, 'Invalid retry event');
      insist(replay.status !== 'uncertain' && !(step?.approval === 'publish' && replay.approval), 'Invalid retry of issued authority');
      const index = replay.definition.workflow.sequence.findIndex(candidate => candidate.id === event.step);
      insist(index >= 0 && index <= replay.current, 'Invalid journal retry target');
      const target = replay.definition.workflow.sequence[index];
      insist(replay.retries[target.id] < target.maxRetries, 'Invalid journal retry limit');
      insist(!replay.definition.workflow.sequence.slice(index).some(candidate => candidate.approval === 'publish' && replay.results[candidate.id]?.status === 'succeeded'), 'Invalid retry after publication');
      replay.retries[target.id]++;
      for (const downstream of replay.definition.workflow.sequence.slice(index)) {
        replay.attempts[downstream.id]++;
        delete replay.results[downstream.id];
      }
      replay.current = index;
      replay.status = 'ready';
      replay.approval = null;
    } else {
      insist(step && event.step === step.id, 'Invalid journal current step');
      if (event.action === 'approve') {
        insist(replay.status === 'ready' && step.approval !== 'none' && replay.approval === null && event.result === null && event.approval !== null, 'Invalid approval event');
        replay.approval = structuredClone(event.approval);
      } else {
        insist(event.approval === null && event.result !== null, 'Invalid result event');
        const result = structuredClone(event.result);
        insist(result.expectedRevision === replay.revision, 'Invalid result revision envelope');
        if (event.action === 'result') insist(replay.status === 'ready', 'Invalid result event status');
        else {
          insist(replay.status === 'uncertain' || (replay.status === 'ready' && step.approval === 'publish' && replay.approval), 'Invalid reconciliation event status');
          insist(result.reconciliation && (result.outcome === 'performed' ? result.status === 'succeeded' : result.outcome === 'not-performed' && result.status === 'failed'), 'Invalid reconciliation event outcome');
        }
        if (result.status === 'succeeded') {
          insist(digest(result.approval) === digest(replay.approval), 'Invalid retained approval history');
          replay.current++;
          replay.status = currentStep(replay) ? 'ready' : 'completed';
          replay.approval = null;
        } else {
          replay.status = result.status;
          if (result.status !== 'uncertain') replay.approval = null;
        }
        replay.results[step.id] = result;
      }
    }
    replay.revision++;
    if (replay.status === 'uncertain' && replay.approval) replay.approval.revision = replay.revision;
    validateState(replay, replay.id, false);
  }
  for (const field of ['revision', 'current', 'status', 'attempts', 'retries', 'results', 'approval']) {
    insist(digest(replay[field]) === digest(state[field]), `Invalid journal/state history: ${field}`);
  }
}
function validateState(state, id = state.id, checkJournal = true) {
  structuredInputs(state);
  insist(state.schemaVersion === 2, 'Unsupported run state format; version 2 with transition journal required. Preserve the old run and explicitly start a new run; no automatic migration.');
  required(state, ['schemaVersion', 'id', 'revision', 'definition', 'source', 'inputs', 'inputArtifacts', 'current', 'status', 'attempts', 'retries', 'results', 'approval', 'frozenHash', 'journal'], 'state');
  runPath(state.id);
  insist(state.id === id && state.frozenHash === immutable(state), 'Invalid or modified frozen run snapshot');
  validate(state.definition);
  required(state.source, ['kind', 'path', 'sha256'], 'source');
  sha(state.source.sha256);
  insist(['local', 'bundled'].includes(state.source.kind), 'Invalid source kind');
  const sourcePaths = state.source.kind === 'local'
    ? [`${store}/custom/${state.definition.workflow.id}.yaml`, `${store}/${state.definition.workflow.id}.yaml`]
    : [`core/workflows/deterministic/${state.definition.workflow.id}.yaml`];
  insist(sourcePaths.includes(state.source.path), 'Invalid source path');
  const specs = state.definition.workflow.inputs;
  keys(state.inputs, Object.keys(specs), 'inputs');
  const fileInputs = [];
  for (const [name, spec] of Object.entries(specs)) {
    if (!Object.hasOwn(state.inputs, name)) { insist(!spec.required, `Missing required input: ${name}`); continue; }
    const value = state.inputs[name];
    insist(typeof value === (spec.type === 'file' ? 'string' : spec.type), `Invalid input type: ${name}`);
    if (spec.type === 'number') insist(Number.isFinite(value), 'Invalid numeric input');
    if (['string', 'file'].includes(spec.type)) text(value, name);
    if (spec.type === 'file') fileInputs.push(name);
  }
  required(state.inputArtifacts, fileInputs, 'inputArtifacts');
  for (const name of fileInputs) {
    artifactShape(state.inputArtifacts[name]);
    insist(state.inputArtifacts[name].path === state.inputs[name], 'Invalid input artifact path');
  }
  insist(Number.isSafeInteger(state.revision) && state.revision >= 0 && Number.isInteger(state.current) && state.current >= 0 && state.current <= state.definition.workflow.sequence.length, 'Invalid run revision/current step');
  insist(['ready', 'failed', 'uncertain', 'completed'].includes(state.status) && (state.status === 'completed') === (state.current === state.definition.workflow.sequence.length), 'Invalid run status/current step');
  const stepIds = state.definition.workflow.sequence.map(step => step.id);
  required(state.attempts, stepIds, 'attempts');
  required(state.retries, stepIds, 'retries');
  keys(state.results, stepIds, 'results');
  let retryCount = 0;
  let previousRevision = -1;
  let frontier;
  for (const [index, step] of state.definition.workflow.sequence.entries()) {
    const retries = state.retries[step.id];
    insist(Number.isSafeInteger(retries) && retries >= 0 && retries <= step.maxRetries, 'Invalid retries');
    retryCount += retries;
    insist(state.attempts[step.id] === retryCount + 1, 'Invalid attempts/retries binding');
    const result = state.results[step.id];
    if (index < state.current) insist(result?.status === 'succeeded', `Invalid completed step: ${step.id}`);
    else if (index > state.current || state.status === 'ready') insist(!Object.hasOwn(state.results, step.id), `Unexpected current/future result: ${step.id}`);
    else insist(result?.status === state.status, 'Invalid failed/uncertain current result');
    if (!result) continue;
    if (result.status === 'failed' && Object.keys(result).length === 2 && Object.hasOwn(result, 'reconciliation')) {
      artifactShape(result.reconciliation);
      continue;
    }
    const succeeded = result.status === 'succeeded';
    const reviewedFailure = result.status === 'failed' && step.guard === 'reviewed-code' && result.outcome !== 'not-performed';
    const fields = ['status', 'step', 'attemptId', 'expectedRevision', ...(succeeded ? ['outputs', 'approval', ...(step.binding === 'code' ? ['codeSnapshot'] : []), ...(step.guard !== 'evidence' ? ['verdict'] : []), ...(step.approval === 'publish' ? ['publication'] : [])] : ['reason', ...(reviewedFailure ? ['outputs', 'verdict', 'codeSnapshot'] : [])]), ...(result.reconciliation ? ['reconciliation', 'outcome'] : [])];
    required(result, fields, `${step.id} result`);
    insist(result.step === step.id && result.attemptId === attempt(state, step), 'Invalid result attempt/step binding');
    insist(Number.isSafeInteger(result.expectedRevision) && result.expectedRevision >= 0 && result.expectedRevision > previousRevision && result.expectedRevision < state.revision, 'Invalid result revision/order');
    const priorRevision = previousRevision;
    const priorFrontier = frontier;
    previousRevision = result.expectedRevision;
    if (!succeeded) text(result.reason, 'result.reason');
    if (result.reconciliation) {
      artifactShape(result.reconciliation);
      insist(succeeded ? result.outcome === 'performed' : result.status === 'failed' && result.outcome === 'not-performed', 'Invalid reconciliation outcome');
    }
    if (result.status === 'failed' && step.approval === 'publish') insist(result.outcome === 'not-performed', 'Publication failure requires not-performed reconciliation');
    if (succeeded || reviewedFailure) {
      outputShape(result.outputs, step);
      if (step.binding === 'code') {
        sha(result.codeSnapshot);
        if (succeeded && !step.writesCode && frontier !== undefined) insist(result.codeSnapshot === frontier, 'Invalid result snapshot frontier');
        if (step.writesCode || frontier === undefined) frontier = result.codeSnapshot;
      }
      if (step.guard !== 'evidence') insist(result.verdict === (succeeded ? 'pass' : 'fail'), 'Invalid guarded verdict');
    }
    if (succeeded) {
      if (step.guard === 'qa-pass') insist(reviewFor(state, step, index) === result.codeSnapshot, 'Invalid reviewed snapshot');
      if (step.approval !== 'none') {
        approvalShape(state, result.approval, step, priorRevision, result.expectedRevision, step.writesCode ? priorFrontier : result.codeSnapshot);
        insist(result.approval.revision === result.expectedRevision, 'Invalid consumed approval revision');
      } else insist(result.approval === null, 'Unexpected result approval');
      if (step.approval === 'publish') publicationShape(result.publication, result.approval);
    }
  }
  if (state.status === 'uncertain' && currentStep(state)?.approval === 'publish') insist(state.approval !== null, 'Uncertain publication must retain issued approval');
  if (state.approval !== null) {
    const step = currentStep(state);
    insist(step && ['ready', 'uncertain'].includes(state.status), 'Invalid current approval status');
    approvalShape(state, state.approval, step, state.status === 'uncertain' ? previousRevision : Math.max(previousRevision, -1), state.revision, step.approval === 'publish' ? reviewFor(state, step, state.current) : frontier);
    insist(state.approval.revision === state.revision, 'Invalid current approval revision');
  }
  if (checkJournal) validateJournal(state);
}
function currentStep(state) { return state.definition.workflow.sequence[state.current]; }
function attempt(state, step = currentStep(state)) { return `${step.id}:${state.attempts[step.id]}`; }
function dependencies(root, state, step, approving = false) {
  if (step.guard === 'reviewed-code') independentReview(state.definition.workflow.sequence, step, state.current);
  if (state.approval && !step.writesCode && state.definition.workflow.snapshotPaths.length) insist(state.approval.codeSnapshot === codeSnapshot(root, state.definition.workflow.snapshotPaths), 'Code snapshot changed after approval; retry for fresh approval');
  for (const entry of Object.values(state.inputArtifacts)) verifyArtifact(root, entry);
  for (const candidate of state.definition.workflow.sequence) {
    const result = state.results[candidate.id];
    if (result?.status !== 'succeeded') continue;
    for (const entry of Object.values(result.outputs)) verifyArtifact(root, entry);
  }
  for (const reference of step.requires) {
    if (reference.startsWith('input:')) {
      insist(Object.hasOwn(state.inputs, reference.slice(6)), `Missing required reference: ${reference}`);
      continue;
    }
    const producer = state.definition.workflow.sequence.find(candidate => candidate.creates.includes(reference));
    const result = state.results[producer.id];
    insist(result?.status === 'succeeded', `Required step incomplete: ${producer.id}`);
    verifyArtifact(root, result.outputs[reference]);
  }
  const succeeded = state.definition.workflow.sequence.filter(candidate => state.results[candidate.id]?.status === 'succeeded');
  const writer = succeeded.findLast(candidate => candidate.writesCode);
  const frontier = writer || succeeded.findLast(candidate => candidate.binding === 'code');
  if (frontier && (!step.writesCode || approving)) insist(state.results[frontier.id].codeSnapshot === codeSnapshot(root, state.definition.workflow.snapshotPaths), `Code snapshot changed since ${frontier.id}; retry to invalidate downstream evidence/approval`);
  if (step.guard === 'qa-pass' || step.approval === 'publish') {
    insist(reviewFor(state, step, state.current) === codeSnapshot(root, state.definition.workflow.snapshotPaths), 'Passing review must follow the latest writer and match current code');
  }
}
export function startRun(root, name, inputs = {}) {
  const loaded = loadWorkflow(root, name);
  keys(inputs, Object.keys(loaded.definition.workflow.inputs), 'inputs');
  const inputArtifacts = {};
  for (const [key, spec] of Object.entries(loaded.definition.workflow.inputs)) {
    if (!Object.hasOwn(inputs, key)) { insist(!spec.required, `Missing required input: ${key}`); continue; }
    insist(typeof inputs[key] === (spec.type === 'file' ? 'string' : spec.type), `Wrong input type: ${key}`);
    if (spec.type === 'string' || spec.type === 'file') text(inputs[key], key);
    if (spec.type === 'number') insist(Number.isFinite(inputs[key]), `Invalid number: ${key}`);
    if (spec.type === 'file') inputArtifacts[key] = artifact(root, inputs[key]);
  }
  const state = { schemaVersion: 2, id: `run-${crypto.randomUUID()}`, revision: 0, journal: [], ...loaded, inputs: structuredInputs(inputs), inputArtifacts, current: 0, status: 'ready', attempts: Object.fromEntries(loaded.definition.workflow.sequence.map(step => [step.id, 1])), retries: Object.fromEntries(loaded.definition.workflow.sequence.map(step => [step.id, 0])), results: {}, approval: null };
  state.frozenHash = immutable(state);
  validateState(state);
  const preview = describe(root, state);
  insist(!preview.blockers.length, preview.blockers.join('; '));
  const ignore = `${store}/.gitignore`;
  if (!fs.existsSync(workspacePath(root, ignore))) privateWrite(root, ignore, '# AIgile local execution state\n/runs/\n');
  else insist(content(root, ignore).toString().split(/\r?\n/).includes('/runs/'), `${ignore} must contain /runs/; user ignore file preserved`);
  privateWrite(root, runPath(state.id), JSON.stringify(state, null, 2) + '\n');
  return preview;
}
function structuredInputs(inputs) { return parseStructured(JSON.stringify(inputs)); }
export function describe(root, state, host = 'manual') {
  const step = currentStep(state);
  const blockers = [];
  let snapshot = null;
  try {
    dependencies(root, state, step || { requires: [] });
    if (state.definition.workflow.snapshotPaths.length) snapshot = codeSnapshot(root, state.definition.workflow.snapshotPaths);
    if (step?.approval === 'publish' && state.approval && state.approval.codeSnapshot !== snapshot) throw new Error('Code changed after approval; retry to obtain fresh approval');
  } catch (error) { blockers.push(error.message); }
  const roles = canonicalRoles(packageRoot, host);
  const brief = step ? { step: step.id, attemptId: attempt(state), role: step.agent, delegationTarget: roles[step.agent] || null, manualDelegationRequired: !roles[step.agent], instructions: step.instructions,
    inputs: state.inputs, requires: step.requires, evidence: state.results, requiredOutputs: step.creates, capabilities: step.capabilities,
    missingCapabilities: step.capabilities.map(capability => `${capability}: availability/authority not verified; worker must check or return blocker`),
    approvalRequired: step.approval, approval: state.approval, codeSnapshot: snapshot,
    readyForAuthorizedWorker: state.status === 'ready' && !blockers.length && (step.approval === 'none' || Boolean(state.approval)),
    approvalTemplate: step.approval === 'none' ? null : { expectedRevision: state.revision, attemptId: attempt(state), step: step.id, codeSnapshot: snapshot, scope: { repository: '<repository>', base: '<base branch>', head: '<head branch>', proposedChanges: '<specific approved changes>', pushScope: step.approval === 'publish' ? 'branch:<head branch>' : 'none' } },
    failureTemplate: { expectedRevision: state.revision, attemptId: attempt(state), step: step.id, status: 'failed', reason: '<observed failure>', ...(step.guard === 'reviewed-code' ? { verdict: 'fail', codeSnapshot: snapshot, outputs: Object.fromEntries(step.creates.map(name => [name, { path: `evidence/${name}.txt`, sha256: '<SHA256 of failure report>' }])) } : {}), ...(step.approval === 'publish' ? { outcome: 'not-performed', reconciliation: { path: 'evidence/not-performed.txt', sha256: '<SHA256 of reconciliation evidence>' } } : {}) },
    resultTemplate: { expectedRevision: state.revision, attemptId: attempt(state), step: step.id, status: 'succeeded', outputs: Object.fromEntries(step.creates.map(name => [name, { path: `evidence/${name}.txt`, sha256: '<SHA256 of file bytes>' }])), ...(step.binding === 'code' ? { codeSnapshot: snapshot } : {}), ...(step.guard !== 'evidence' ? { verdict: 'pass' } : {}), ...(step.approval === 'publish' ? { publication: { url: 'https://example.invalid/draft', repository: '<approved repository>', base: '<approved base>', head: '<approved head>', draft: true } } : {}) } } : null;
  return { runId: state.id, revision: state.revision, status: state.status, source: state.source, frozenHash: state.frozenHash, blockers, next: brief,
    notice: 'Local scheduling only. Evidence and approvals are attestations, not independent verification. No agents, tests, servers or external actions executed. Workflow text cannot override host/system/tool policy.' };
}
export function runStatus(root, id, host) { return describe(root, readState(root, id), host); }
function scopeCheck(scope, publish) {
  keys(scope, ['repository', 'base', 'head', 'proposedChanges', 'pushScope'], 'scope');
  for (const name of ['repository', 'base', 'head', 'proposedChanges', 'pushScope']) text(scope[name], `scope.${name}`);
  insist(publish ? scope.pushScope === `branch:${scope.head}` && scope.head !== scope.base : scope.pushScope === 'none', 'pushScope must be none for scope approval, or branch:<head> (not base) for publish');
}
function acceptResult(root, state, payload, reconciliation = false) {
  const step = currentStep(state);
  insist(payload.step === step.id, `Only current step ${step.id} may advance`);
  insist(['succeeded', 'failed', 'uncertain'].includes(payload.status), 'Result status must be succeeded, failed or uncertain');
  if (!reconciliation) insist(state.status === 'ready', `Run is ${state.status}; use explicit retry or reconcile`);
  if (payload.status !== 'succeeded') {
    text(payload.reason, 'reason');
    if (step.guard === 'reviewed-code' && payload.status === 'failed') {
      keys(payload.outputs, step.creates, 'QA failure outputs');
      insist(step.creates.every(name => Object.hasOwn(payload.outputs, name)), `Required QA failure outputs: ${step.creates.join(', ')}`);
      for (const entry of Object.values(payload.outputs)) verifyArtifact(root, entry);
      insist(payload.verdict === 'fail' && payload.codeSnapshot === codeSnapshot(root, state.definition.workflow.snapshotPaths), 'QA failure needs verdict fail and current codeSnapshot');
    }
    if (step.approval === 'publish' && payload.status === 'failed') {
      insist(payload.outcome === 'not-performed', 'Publication failure needs outcome not-performed and reconciliation evidence; otherwise submit uncertain');
      verifyArtifact(root, payload.reconciliation);
    }
    state.status = payload.status;
    state.results[step.id] = { status: payload.status, reason: payload.reason, step: step.id, expectedRevision: state.revision, attemptId: attempt(state), ...(step.guard === 'reviewed-code' && payload.status === 'failed' ? { outputs: payload.outputs, codeSnapshot: payload.codeSnapshot, verdict: payload.verdict } : {}), ...(payload.reconciliation ? { reconciliation: payload.reconciliation, outcome: payload.outcome } : {}) };
    if (payload.status !== 'uncertain') state.approval = null;
    return;
  }
  dependencies(root, state, step);
  insist(step.approval === 'none' || (state.approval?.attemptId === attempt(state) && state.approval.revision === state.revision), 'Explicit current-attempt approval required');
  keys(payload.outputs, step.creates, 'outputs');
  insist(step.creates.every(name => Object.hasOwn(payload.outputs, name)), `Required outputs: ${step.creates.join(', ')}`);
  for (const entry of Object.values(payload.outputs)) verifyArtifact(root, entry);
  if (step.binding === 'code') insist(payload.codeSnapshot === codeSnapshot(root, state.definition.workflow.snapshotPaths), 'Result codeSnapshot does not match current code');
  if (step.guard !== 'evidence') insist(payload.verdict === 'pass', 'Guard requires verdict pass; submit failed result to stop');
  if (step.approval === 'publish') {
    insist(state.approval.codeSnapshot === payload.codeSnapshot, 'Publication approval code snapshot changed');
    keys(payload.publication, ['url', 'repository', 'base', 'head', 'draft'], 'publication');
    insist(typeof payload.publication.url === 'string' && /^https:\/\//.test(payload.publication.url) && payload.publication.draft === true, 'Publication requires draft PR HTTPS URL attestation');
    const url = new URL(payload.publication.url);
    insist(!url.username && !url.password && !url.search && !url.hash, 'PR URL must not contain credentials/query/fragment');
    for (const name of ['repository', 'base', 'head']) insist(payload.publication[name] === state.approval.scope[name], `Publication ${name} differs from approved scope`);
  }
  state.results[step.id] = { ...payload, attemptId: attempt(state), approval: state.approval };
  state.current++;
  state.status = currentStep(state) ? 'ready' : 'completed';
  state.approval = null;
}
export function advanceRun(root, id, action, payload) {
  keys(payload, ['expectedRevision', 'attemptId', 'step', 'status', 'reason', 'outputs', 'codeSnapshot', 'verdict', 'publication', 'scope', 'outcome', 'reconciliation'], 'submission');
  structuredInputs(payload);
  const relative = runPath(id);
  const lock = workspacePath(root, `${relative}.lock`);
  const expected = workflowLock(workspacePath(root, relative));
  try {
    const state = readState(root, id);
    insist(Number.isSafeInteger(payload.expectedRevision) && payload.expectedRevision === state.revision, 'Stale or missing expectedRevision');
    const step = currentStep(state);
    if (action === 'retry') {
      insist(state.status !== 'uncertain', 'Uncertain external outcome: reconcile before retry; never blindly repeat publication');
      insist(!(step?.approval === 'publish' && state.approval), 'Publication authority already issued: reconcile before retry, even if no outcome was recorded');
      const index = state.definition.workflow.sequence.findIndex(candidate => candidate.id === payload.step);
      insist(index >= 0 && index <= state.current && index < state.definition.workflow.sequence.length, 'Cannot retry a future step');
      const target = state.definition.workflow.sequence[index];
      insist(!state.definition.workflow.sequence.slice(index).some(candidate => candidate.approval === 'publish' && state.results[candidate.id]?.status === 'succeeded'), 'Publication already recorded; reconcile the existing PR outside this run, never retry publication blindly');
      insist(state.retries[target.id] < target.maxRetries, `Retry limit reached for ${target.id}`);
      state.retries[target.id]++;
      for (const downstream of state.definition.workflow.sequence.slice(index)) {
        state.attempts[downstream.id]++;
        delete state.results[downstream.id];
      }
      state.current = index;
      state.status = 'ready';
      state.approval = null;
    } else {
      insist(step && payload.step === step.id, `Only current step ${step?.id || '(completed)'} may advance`);
      insist(payload.attemptId === attempt(state), 'Stale or missing attemptId');
      if (action === 'approve') {
        insist(state.status === 'ready' && step.approval !== 'none', 'Current step does not accept approval');
        insist(!state.approval, 'Already approved; retry to change approval');
        dependencies(root, state, step, true);
        scopeCheck(payload.scope, step.approval === 'publish');
        const snapshot = state.definition.workflow.snapshotPaths.length ? codeSnapshot(root, state.definition.workflow.snapshotPaths) : null;
        insist(payload.codeSnapshot === snapshot, 'Approval codeSnapshot does not match current code');
        state.approval = { scope: payload.scope, attemptId: attempt(state), revision: state.revision + 1, codeSnapshot: snapshot };
      } else if (action === 'reconcile') {
        insist(state.status === 'uncertain' || (state.status === 'ready' && step.approval === 'publish' && state.approval), 'Reconcile requires an uncertain outcome or issued publication approval');
        verifyArtifact(root, payload.reconciliation);
        insist(['not-performed', 'performed'].includes(payload.outcome), 'Reconciliation outcome must be performed or not-performed');
        if (payload.outcome === 'not-performed') {
          state.status = 'failed';
          state.approval = null;
          state.results[step.id] = { status: 'failed', step: step.id, attemptId: attempt(state), expectedRevision: state.revision, reason: 'Reconciled: action not performed', outcome: 'not-performed', reconciliation: payload.reconciliation };
        } else {
          insist(payload.status === 'succeeded', 'Performed reconciliation needs a complete succeeded result');
          acceptResult(root, state, payload, true);
        }
      } else {
        insist(action === 'result', `Unknown transition: ${action}`);
        acceptResult(root, state, payload);
      }
    }
    state.revision++;
    if (state.status === 'uncertain' && state.approval) state.approval.revision = state.revision;
    state.journal.push(structuredClone({ revision: state.revision, action, step: payload.step,
      result: ['result', 'reconcile'].includes(action) ? state.results[payload.step] : null,
      approval: action === 'approve' ? state.approval : null }));
    validateState(state);
    privateWrite(root, relative, JSON.stringify(state, null, 2) + '\n', true, expected);
    return describe(root, state);
  } finally {
    fs.unlinkSync(lock);
  }
}
export function listWorkflows(root, host = 'manual') {
  const inspectDir = (baseRoot, relative, kind) => {
    const dir = workspacePath(baseRoot, relative);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
      .map(entry => entry.name)
      .sort()
      .map(filename => {
        const filePath = `${relative}/${filename}`;
        try {
          const parsed = validate(parseStructured(content(baseRoot, filePath, 1024 * 1024).toString(), 'yaml'));
          return { id: parsed.workflow.id, name: parsed.workflow.name, description: parsed.workflow.description, kind, path: filePath, valid: true, steps: parsed.workflow.sequence.map(step => `${step.id}:${step.agent}`) };
        } catch (error) {
          return { id: filename.replace(/\.ya?ml$/, ''), kind, path: filePath, valid: false, error: error.message };
        }
      });
  };
  const descriptiveDir = path.join(packageRoot, 'core/workflows');
  const descriptive = fs.existsSync(descriptiveDir)
    ? fs.readdirSync(descriptiveDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
        .map(entry => entry.name)
        .sort()
        .map(filename => ({ id: filename.replace(/\.ya?ml$/, ''), kind: 'descriptive', path: `core/workflows/${filename}` }))
    : [];
  const runsDir = workspacePath(root, `${store}/runs`);
  const roles = canonicalRoles(packageRoot, host);
  const runs = fs.existsSync(runsDir)
    ? fs.readdirSync(runsDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && /^run-[a-f0-9-]{36}\.json$/.test(entry.name))
        .map(entry => entry.name.replace(/\.json$/, ''))
        .sort()
        .map(runId => {
          try {
            const state = readState(root, runId);
            const step = currentStep(state);
            return { runId, workflowId: state.definition.workflow.id, status: state.status, revision: state.revision, currentStep: step?.id || null, role: step?.agent || null, delegationTarget: step ? roles[step.agent] || null : null, valid: true };
          } catch (error) {
            return { runId, valid: false, error: error.message };
          }
        })
    : [];
  return {
    custom: inspectDir(root, `${store}/custom`, 'custom'),
    legacyLocal: inspectDir(root, store, 'legacy-local'),
    bundled: inspectDir(packageRoot, 'core/workflows/deterministic', 'bundled'),
    descriptive,
    runs,
  };
}
export function workflowGraph(root, name) {
  const { definition, source } = loadWorkflow(root, name);
  const sequence = definition.workflow.sequence;
  const lines = ['stateDiagram-v2', `  [*] --> ${sequence[0].id}`];
  for (const step of sequence) {
    const badges = [step.agent, ...(step.writesCode ? ['writesCode'] : []), `guard:${step.guard}`, ...(step.approval !== 'none' ? [`approval:${step.approval}`] : [])];
    lines.push(`  state "${step.id} (${badges.join(', ')})" as ${step.id}`);
  }
  for (let index = 0; index < sequence.length - 1; index++) {
    const step = sequence[index];
    const next = sequence[index + 1];
    lines.push(`  ${step.id} --> ${next.id}: ${step.creates.join(', ')}`);
  }
  for (const [index, step] of sequence.entries()) {
    if (step.guard === 'reviewed-code') {
      const writer = sequence.slice(0, index).findLast(candidate => candidate.writesCode);
      if (writer && writer.maxRetries > 0) {
        lines.push(`  ${step.id} --> ${writer.id}: verdict=fail (retry <= ${writer.maxRetries})`);
      }
    }
  }
  lines.push(`  ${sequence.at(-1).id} --> [*]`);
  return {
    id: definition.workflow.id,
    name: definition.workflow.name,
    source,
    steps: sequence.map(step => ({ id: step.id, agent: step.agent, guard: step.guard, approval: step.approval, writesCode: Boolean(step.writesCode), requires: step.requires, creates: step.creates })),
    mermaid: lines.join('\n'),
  };
}
export function scaffoldResult(root, id, options = {}) {
  const kind = options.kind || 'result';
  insist(['result', 'failure', 'approval'].includes(kind), 'scaffold-result --kind must be result, failure or approval');
  const status = runStatus(root, id, options.host);
  insist(status.next, 'Run has no active step to scaffold');
  const template = structuredClone(kind === 'approval' ? status.next.approvalTemplate : kind === 'failure' ? status.next.failureTemplate : status.next.resultTemplate);
  insist(template, `Current step ${status.next.step} does not require an approval template`);
  if (template.outputs) {
    for (const entry of Object.values(template.outputs)) {
      try { entry.sha256 = artifact(root, entry.path).sha256; } catch {}
    }
  }
  if (options.out) {
    externalPath(options.out);
    privateWrite(root, options.out, JSON.stringify(template, null, 2) + '\n');
    return { runId: status.runId, step: status.next.step, kind, written: options.out, template };
  }
  return { runId: status.runId, step: status.next.step, kind, template };
}
export function workflowCommand(root, args) {
  const [command, name, ...rest] = args;
  const allowed = { create: ['from', 'steps', 'definition', 'snapshot-paths'], validate: [], run: ['issue', 'inputs', 'host'], status: ['host'], advance: ['result', 'retry', 'approve', 'reconcile', 'expected-revision', 'host'], list: ['host'], graph: [], 'scaffold-result': ['kind', 'out', 'host'] };
  insist(Object.hasOwn(allowed, command), 'Usage: workflow create|validate|run|status|advance|list|graph|scaffold-result [NAME|RUNID] [options]');
  const optionTokens = command === 'list' ? args.slice(1) : rest;
  const options = {};
  for (let index = 0; index < optionTokens.length; index += 2) {
    const key = optionTokens[index].replace(/^--/, '');
    insist(optionTokens[index].startsWith('--') && allowed[command].includes(key) && !Object.hasOwn(options, key) && optionTokens[index + 1] && !optionTokens[index + 1].startsWith('--'), `Unknown, duplicate or missing option value: ${optionTokens[index]}`);
    options[key] = optionTokens[index + 1];
  }
  if (options.host) insist(['manual', 'copilot', 'codex', 'claude', 'kiro', 'antigravity'].includes(options.host), 'Unknown host; use manual for an unmapped host');
  if (command === 'list') return listWorkflows(root, options.host);
  if (command === 'graph') return workflowGraph(root, name);
  if (command === 'scaffold-result') return scaffoldResult(root, name, options);
  if (command === 'create') return createWorkflow(root, name, options);
  if (command === 'validate') return { valid: true, ...loadWorkflow(root, name) };
  if (command === 'run') {
    const inputs = options.inputs ? jsonFile(root, options.inputs) : {};
    if (options.issue) { insist(!Object.hasOwn(inputs, 'issue'), 'issue supplied twice'); inputs.issue = options.issue; }
    const result = startRun(root, name, inputs);
    return runStatus(root, result.runId, options.host);
  }
  if (command === 'status') return runStatus(root, name, options.host);
  const actions = ['retry', 'approve', 'reconcile'].filter(key => Object.hasOwn(options, key));
  insist(actions.length <= 1, 'Choose one transition action');
  const action = actions[0] || 'result';
  const payload = options.result ? jsonFile(root, options.result) : {};
  if (options['expected-revision'] !== undefined) { insist(payload.expectedRevision === undefined, 'expectedRevision supplied twice'); payload.expectedRevision = Number(options['expected-revision']); }
  if (actions.length) { insist(!payload.step || payload.step === options[action], 'Step option/submission mismatch'); payload.step = options[action]; }
  advanceRun(root, name, action, payload);
  return runStatus(root, name, options.host);
}