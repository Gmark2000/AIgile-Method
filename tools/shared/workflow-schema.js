import YAML from 'yaml';

export const identifier = /^[a-z][a-z0-9-]{0,63}$/;
export const isIdentifier = value => typeof value === 'string' && identifier.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
export function insist(condition, message) {
  if (!condition) throw new Error(message);
}
export function structured(value, depth = 0, budget = { count: 0 }) {
  insist(depth < 32 && ++budget.count < 20000, 'Structured data exceeds limits');
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      insist(!['__proto__', 'prototype', 'constructor'].includes(key), `Forbidden key: ${key}`);
      structured(value[key], depth + 1, budget);
    }
  }
  return value;
}
export function keys(value, allowed, label) {
  insist(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  for (const key of Object.keys(value)) insist(allowed.includes(key), `Unknown ${label} key: ${key}`);
}
export function text(value, label) {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= 8000, `${label} must be nonempty text (max 8000)`);
}
export function relativePath(relative) {
  insist(typeof relative === 'string' && relative.length <= 512 && !/[\\:\x00-\x1f]/.test(relative) && !relative.startsWith('/') &&
    relative.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)), `Unsafe workspace path: ${relative}`);
  return relative;
}
export function externalPath(relative) {
  relativePath(relative);
  insist(!relative.split('/').some(segment => ['.git', '.aigile-workflows'].includes(process.platform === 'win32' ? segment.toLowerCase() : segment)), 'Workspace metadata (.git or workflow state) is not an external input, artifact or snapshot');
  return relative;
}
export function parseStructured(content, format = 'json') {
  insist(Buffer.byteLength(content) <= 1024 * 1024, 'Input exceeds 1 MiB');
  let value;
  if (format === 'yaml') {
    const document = YAML.parseDocument(content, { uniqueKeys: true });
    insist(!document.errors.length && !document.warnings.length, `Invalid YAML: ${[...document.errors, ...document.warnings].map(error => error.message).join('; ')}`);
    value = document.toJS({ maxAliasCount: 0 });
  } else value = JSON.parse(content);
  return structured(value);
}
function strings(value, label) {
  insist(Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === 'string' && item.trim() && item.length <= 1000), `${label} must be an array of strings`);
  insist(new Set(value).size === value.length, `${label} contains duplicates`);
}
export function independentReview(sequence, step, before) {
  const prior = sequence.slice(0, before);
  const latestWriter = prior.findLast(candidate => candidate.writesCode);
  const previousReview = prior.findLastIndex(candidate => candidate.guard === 'reviewed-code');
  const contributors = prior.slice(previousReview + 1).filter(candidate => candidate.writesCode);
  if (latestWriter) contributors.push(latestWriter);
  insist(contributors.every(candidate => candidate.agent !== step.agent), 'Review must use an independent agent alias for the contribution frontier');
}
export function validateWorkflow(definition, roles) {
  structured(definition);
  keys(definition, ['schemaVersion', 'workflow'], 'definition');
  insist(definition.schemaVersion === 1, 'schemaVersion must be 1; legacy prose workflows are not executable');
  const workflow = definition.workflow;
  keys(workflow, ['id', 'name', 'description', 'inputs', 'snapshotPaths', 'sequence'], 'workflow');
  insist(isIdentifier(workflow.id), 'workflow.id must be a lowercase string identifier');
  text(workflow.name, 'workflow.name');
  text(workflow.description, 'workflow.description');
  keys(workflow.inputs, Object.keys(workflow.inputs || {}), 'workflow.inputs');
  insist(Object.keys(workflow.inputs).length <= 32, 'At most 32 inputs');
  for (const [name, input] of Object.entries(workflow.inputs)) {
    insist(isIdentifier(name), `Invalid input name: ${name}`);
    keys(input, ['type', 'required', 'description'], `input ${name}`);
    insist(['string', 'number', 'boolean', 'file'].includes(input.type), `Unknown input type: ${input.type}`);
    insist(typeof input.required === 'boolean', `input ${name}.required must be boolean`);
    text(input.description, `input ${name}.description`);
  }
  strings(workflow.snapshotPaths, 'snapshotPaths');
  for (const relative of workflow.snapshotPaths) {
    externalPath(relative);
  }
  insist(Array.isArray(workflow.sequence) && workflow.sequence.length > 0 && workflow.sequence.length <= 50, 'sequence needs 1..50 ordered steps');
  const seen = new Set();
  const evidence = new Map();
  for (const step of workflow.sequence) {
    keys(step, ['id', 'agent', 'instructions', 'requires', 'creates', 'capabilities', 'guard', 'approval', 'maxRetries', 'binding', 'writesCode'], 'step');
    insist(isIdentifier(step.id) && !seen.has(step.id), `Invalid or duplicate step id: ${step.id}`);
    seen.add(step.id);
    insist(roles.includes(step.agent), `Unknown agent alias: ${step.agent}; available: ${roles.join(', ')}`);
    text(step.instructions, `${step.id}.instructions`);
    for (const name of ['requires', 'creates', 'capabilities']) strings(step[name], `${step.id}.${name}`);
    insist(['evidence', 'reviewed-code', 'qa-pass'].includes(step.guard), `Unknown guard: ${step.guard}; use evidence, reviewed-code, qa-pass`);
    insist(['none', 'scope', 'publish'].includes(step.approval), `Unknown approval: ${step.approval}`);
    insist(['none', 'code'].includes(step.binding), `Unknown binding: ${step.binding}`);
    insist(step.writesCode === undefined || typeof step.writesCode === 'boolean', 'writesCode must be boolean (default false)');
    insist(!step.writesCode || (step.binding === 'code' && step.guard === 'evidence'), 'writesCode requires code binding and evidence guard');
    insist(Number.isInteger(step.maxRetries) && step.maxRetries >= 0 && step.maxRetries <= 5, 'maxRetries must be 0..5');
    for (const reference of step.requires) {
      if (reference.startsWith('input:')) insist(Object.hasOwn(workflow.inputs, reference.slice(6)), `Unknown input reference: ${reference}`);
      else insist(evidence.has(reference), `Evidence must be created by an earlier step: ${reference}`);
    }
    insist(step.creates.length > 0 && step.creates.every(name => isIdentifier(name) && !evidence.has(name)), `${step.id}.creates needs unique evidence identifiers`);
    if (step.binding === 'code' || step.guard !== 'evidence' || step.approval === 'publish') insist(workflow.snapshotPaths.length > 0 && step.binding === 'code', `${step.id} needs code binding and snapshotPaths`);
    if (step.guard === 'reviewed-code') insist(step.requires.some(reference => evidence.get(reference)?.binding === 'code'), 'reviewed-code needs earlier code-bound evidence');
    if (step.guard === 'qa-pass') insist(step.requires.some(reference => evidence.get(reference)?.guard === 'reviewed-code' && evidence.get(reference)?.agent !== step.agent), 'qa-pass needs independent reviewed-code evidence');
    if (step.approval === 'publish') insist(step.guard === 'qa-pass', 'publish requires qa-pass guard');
    if (step.guard === 'reviewed-code') {
      independentReview(workflow.sequence, step, workflow.sequence.indexOf(step));
      insist(step.requires.filter(reference => evidence.has(reference)).every(reference => evidence.get(reference).agent !== step.agent), 'Review must use an independent agent alias');
    }
    for (const name of step.creates) evidence.set(name, step);
  }
  return definition;
}