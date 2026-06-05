#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYamlMapping, deepMerge } from './shared/modelProfiles.js';
import { buildBudgetOrchestrator, CACHE_BOUNDARY } from './editions/budget/orchestrator.js';
import { BUDGET_CONFIG_DEFAULTS } from './editions/budget/defaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const cliPath = path.join(root, 'tools', 'cli.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function tempWorkspace(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `aigile-${name}-`));
}

function runInstall(cwd, args = [], env = {}) {
  execFileSync(process.execPath, [cliPath, 'install', '--yes', '--non-interactive', ...args], {
    cwd,
    env: { ...process.env, ...env, AIGILE_ADD_SCRIPTS: '0' },
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

function runConflict(cwd) {
  return spawnSync(process.execPath, [cliPath, 'install', '--yes', '--non-interactive', '--budget', '--full'], {
    cwd,
    env: { ...process.env, AIGILE_ADD_SCRIPTS: '0' },
    encoding: 'utf8',
  });
}

function runPipedInstall(cwd, args = [], env = {}) {
  return spawnSync(process.execPath, [cliPath, 'install', ...args], {
    cwd,
    env: { ...process.env, ...env, AIGILE_ADD_SCRIPTS: '0' },
    encoding: 'utf8',
    input: '',
    timeout: 30000,
  });
}

function lineCount(text) {
  return text.trimEnd().split(/\r?\n/).length;
}

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

function assertNoForbiddenBudgetModelLabels(text, label) {
  const forbiddenPattern = new RegExp(`\\b${['Ki', 'mi'].join('')}\\b|\\b${['K', '2'].join('')}\\b`, 'i');
  assert(!forbiddenPattern.test(text), `${label} must not reference forbidden budget model labels`);
}

// Minimal structural YAML helpers (no external dependency — consistent with project style)
function yamlSection(text, key) {
  const re = new RegExp(`^([ ]*)${key}\\s*:\\s*\\r?\\n`, 'm');
  const m = text.match(re);
  if (!m) return '';
  const baseIndent = m[1].length;
  const lines = text.slice(m.index + m[0].length).split(/\r?\n/);
  const out = [];
  for (const l of lines) {
    if (!l.trim()) { out.push(l); continue; }
    if (l.length - l.trimStart().length <= baseIndent) break;
    out.push(l);
  }
  return out.join('\n');
}

function yamlScalar(text, key) {
  const m = text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)`, 'm'));
  return m ? m[1].trim() : undefined;
}

const fullDir = tempWorkspace('full');
runInstall(fullDir, []);
const fullManifest = readJson(path.join(fullDir, '.aigile-manifest.json'));
assert(fullManifest.edition === 'full', 'default install should resolve to full edition');
assert(fullManifest.modelProfile === 'full-2026-06', 'full install should use full model profile');
assert(fs.existsSync(path.join(fullDir, '.github', 'agents', 'aigile-master.agent.md')), 'full install should include AIgile Master');
assert(readText(path.join(fullDir, '.github', 'agents', 'dev.agent.md')).includes('model: Claude Opus 4.6'), 'full dev agent should keep the frozen full-power model (Claude Opus 4.6)');

const pipedDir = tempWorkspace('piped-default');
const pipedInstall = runPipedInstall(pipedDir);
const pipedOutput = `${pipedInstall.stdout || ''}${pipedInstall.stderr || ''}`;
assert(pipedInstall.status === 0, `piped non-TTY install should complete without prompting: ${pipedOutput}`);
assert(readJson(path.join(pipedDir, '.aigile-manifest.json')).edition === 'full', 'piped non-TTY install should default to full edition');
assert(!pipedOutput.includes('Select AIgile edition:'), 'piped non-TTY install should not render edition prompt');
assert(!pipedOutput.includes('Select optional components:'), 'piped non-TTY install should not render optional component prompt');

const budgetDir = tempWorkspace('budget');
runInstall(budgetDir, ['--budget', '--with-mcp']);
const budgetManifest = readJson(path.join(budgetDir, '.aigile-manifest.json'));
assert(budgetManifest.edition === 'budget', 'budget flag should resolve to budget edition');
assert(budgetManifest.modelProfile === 'budget-2026-06', 'budget install should use budget model profile');
assert(budgetManifest.mcpProfile === 'budget', 'budget install should use budget MCP profile');
assert(!fs.existsSync(path.join(budgetDir, '.github', 'agents', 'aigile-master.agent.md')), 'budget team should omit AIgile Master by default');

const budgetDev = readText(path.join(budgetDir, '.github', 'agents', 'dev.agent.md'));
assert(budgetDev.includes('model: "GPT-5.4 mini"'), 'budget dev agent should receive beast-mode 1x model metadata (GPT-5.4 mini)');
assert(budgetDev.includes('x-aigile-edition: budget'), 'budget agents should record edition metadata');
assertNoForbiddenBudgetModelLabels(budgetDev, 'budget dev agent');

// Beast-mode anti-leak: no installed budget agent may carry a Powerful-tier or
// premium Claude model as its default. Spot-check the cheap-tier routing.
const budgetUx = readText(path.join(budgetDir, '.github', 'agents', 'ux-expert.agent.md'));
assert(budgetUx.includes('model: "GPT-5 mini"'), 'budget ux-expert should use included-tier GPT-5 mini (not GPT-5.5)');
for (const installedAgent of ['dev.agent.md', 'ux-expert.agent.md', 'po.agent.md', 'architect.agent.md', 'security.agent.md', 'code-tour.agent.md']) {
  const agentText = readText(path.join(budgetDir, '.github', 'agents', installedAgent));
  const modelLine = agentText.match(/^model:\s*"([^"]+)"/m)?.[1] || '';
  assert(modelLine && modelLine !== 'GPT-5.5', `${installedAgent} must not default to GPT-5.5 (Powerful tier is escalation-only)`);
  assert(!/opus|sonnet|haiku/i.test(modelLine), `${installedAgent} must not default to a Claude model (premium is escalation-only)`);
}

const budgetOrchestrator = readText(path.join(budgetDir, '.github', 'agents', 'aigile-budget-orchestrator.agent.md'));
const budgetOrchestratorFrontmatter = frontmatter(budgetOrchestrator);
const budgetOrchestratorToolItems = (budgetOrchestratorFrontmatter.match(/^tools:\s*\r?\n((?:\s+-[^\n]*\r?\n?)+)/m)?.[1] || '')
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*-\s*/, '').trim())
  .filter(Boolean);
assert(budgetOrchestratorFrontmatter.includes('name: AIgile Budget Orchestrator'), 'budget install should generate AIgile Budget Orchestrator as a first-class agent');
assert(budgetOrchestratorFrontmatter.includes('disable-model-invocation: true'), 'budget orchestrator must disable direct model invocation');
for (const requiredTool of ['agent', 'todo', 'vscode/askQuestions']) {
  assert(budgetOrchestratorToolItems.includes(requiredTool), `budget orchestrator tools must include ${requiredTool}`);
}
for (const forbiddenTool of ['execute', 'read', 'edit', 'search', 'browser', 'web', 'vscode/runCommand', 'vscode/newWorkspace', 'vscode/vscodeAPI']) {
  assert(!budgetOrchestratorToolItems.some((tool) => tool === forbiddenTool || tool.startsWith(`${forbiddenTool}/`)), `budget orchestrator must not expose broad tool ${forbiddenTool}`);
}
for (const marker of [
  'HARD STOP',
  'vscode_askQuestions',
  'Manual Confirmation Protocol',
  'USER-CONFIRMED DELEGATION',
  'Pre-Delegation Deterministic Gate',
  'max_agent_calls',
  'max_rounds',
  'stop_early_contract',
  'R/P/I/QA Compact Schemas',
  'unit_tests',
  'lint',
  'security_scan',
  'schema_validation',
  'diff_sanity',
  'Self-solving',
  'Recursive orchestration',
  'MCP-load-all',
]) {
  assert(budgetOrchestrator.includes(marker), `budget orchestrator must include marker: ${marker}`);
}
assert(budgetOrchestrator.includes('You DO have tools'), 'budget orchestrator must explicitly state it has delegation tools');
assert(!budgetOrchestrator.includes('APPENDIX: ORIGINAL AGENT SOURCE'), 'budget orchestrator must not bury its contract in the generated wrapper appendix');
assertNoForbiddenBudgetModelLabels(budgetOrchestrator, 'budget orchestrator');

const manual = readText(path.join(budgetDir, '.github', 'agents', 'aigile-manual-orchestrator.agent.md'));
assert(manual.includes('disable-model-invocation: true'), 'budget manual orchestrator must preserve disable-model-invocation');
assert(manual.includes('vscode_askQuestions'), 'budget manual orchestrator must require vscode_askQuestions');
assert(manual.includes('No runSubagent unless last user response came from vscode_askQuestions for this exact delegation.'), 'budget manual orchestrator must include the machine-checkable ask gate');
assert(lineCount(manual) <= 150, 'budget manual orchestrator should stay token-lean');
assertNoForbiddenBudgetModelLabels(manual, 'budget manual orchestrator');

const mcp = readJson(path.join(budgetDir, '.vscode', 'mcp.json'));
const budgetMcpServerIds = new Set(Object.keys(mcp.servers));
for (const required of ['sequentialthinking', 'context7', 'memory']) {
  assert(budgetMcpServerIds.has(required), `budget MCP profile must include ${required}`);
}
for (const prunedDefault of ['atlassian', 'github.com', 'sonarqube', 'playwright', 'figma']) {
  assert(!budgetMcpServerIds.has(prunedDefault), `budget MCP profile must prune ${prunedDefault} by default`);
}
assert(JSON.stringify((mcp.inputs || []).map((input) => input.id)) === JSON.stringify(['context7_api_key']), 'budget MCP profile should include only inputs required by default servers');

// D2 — Budget-only additive assets (R2/R6/R7) must actually land in the install.
const budgetCore = path.join(budgetDir, '.aigile-core');
assert(fs.existsSync(path.join(budgetCore, 'filters')), 'budget install must copy filters/ into .aigile-core');
assert(fs.existsSync(path.join(budgetCore, 'schemas')), 'budget install must copy schemas/ into .aigile-core');
const installedManifestPath = path.join(budgetCore, 'budget-manifest.json');
assert(fs.existsSync(installedManifestPath), 'budget install must copy budget-manifest.json into .aigile-core');
// Spot-check the filter/schema executables actually shipped (not just the dirs).
for (const filterFile of ['gh-fields.sh', 'grep-scoped.sh', 'project.mjs', 'schema-validate.mjs', 'test-impact.mjs', 'test-summary.mjs']) {
  assert(fs.existsSync(path.join(budgetCore, 'filters', filterFile)), `budget install must copy filters/${filterFile}`);
}
for (const schemaFile of ['request.schema.json', 'plan.schema.json', 'implementation.schema.json', 'qa.schema.json']) {
  assert(fs.existsSync(path.join(budgetCore, 'schemas', schemaFile)), `budget install must copy schemas/${schemaFile}`);
}
// Every JIT manifest path (31 tasks + 4 instructions) must resolve to a real
// file in the installed .aigile-core tree — fail loudly on a dead reference.
const installedBudgetManifest = readJson(installedManifestPath);
const manifestEntries = [...(installedBudgetManifest.tasks || []), ...(installedBudgetManifest.instructions || [])];
assert(manifestEntries.length === 35, `budget-manifest.json should reference 35 entries (31 tasks + 4 instructions), found ${manifestEntries.length}`);
for (const entry of manifestEntries) {
  const resolved = path.join(budgetCore, entry.path);
  assert(fs.existsSync(resolved), `budget-manifest.json references missing file: ${entry.path} (id: ${entry.id})`);
}

const envDir = tempWorkspace('env');
runInstall(envDir, [], { AIGILE_EDITION: 'budget' });
assert(readJson(path.join(envDir, '.aigile-manifest.json')).edition === 'budget', 'AIGILE_EDITION should resolve edition when no CLI flag is present');

const editionArgDir = tempWorkspace('edition-arg');
runInstall(editionArgDir, ['--edition', 'budget']);
assert(readJson(path.join(editionArgDir, '.aigile-manifest.json')).edition === 'budget', '--edition budget should resolve to budget edition');

const reuseDir = tempWorkspace('reuse');
runInstall(reuseDir, ['--budget']);
runInstall(reuseDir, []);
assert(readJson(path.join(reuseDir, '.aigile-manifest.json')).edition === 'budget', 'reinstall with no explicit edition should reuse manifest edition');

const overrideDir = tempWorkspace('override');
runInstall(overrideDir, ['--budget', '--agent-model', 'po=Custom Budget PO']);
assert(readText(path.join(overrideDir, '.github', 'agents', 'po.agent.md')).includes('model: "Custom Budget PO"'), 'CLI per-agent model override should win');

const switchDir = tempWorkspace('switch');
runInstall(switchDir, ['--full', '--with-mcp']);
runInstall(switchDir, ['--budget', '--with-mcp']);
const switchedManifest = readJson(path.join(switchDir, '.aigile-manifest.json'));
assert(switchedManifest.edition === 'budget', 'explicit switch should update manifest edition');
assert(switchedManifest.previousEdition === 'full', 'explicit switch should record previous edition');
assert(!fs.existsSync(path.join(switchDir, '.github', 'agents', 'aigile-master.agent.md')), 'switch to budget should prune previous managed full-only agents');

const conflictDir = tempWorkspace('conflict');
const conflict = runConflict(conflictDir);
assert(conflict.status !== 0, 'conflicting edition flags should fail');
assert((conflict.stderr + conflict.stdout).includes('Conflicting edition options'), 'conflict error should be clear');
assert(!fs.existsSync(path.join(conflictDir, '.aigile-manifest.json')), 'conflict should not write manifest');

// --- invalid input rejection ---
const badEditionDir = tempWorkspace('bad-edition');
const badEdition = spawnSync(process.execPath, [cliPath, 'install', '--yes', '--non-interactive', '--edition', 'invalid'], {
  cwd: badEditionDir, env: { ...process.env, AIGILE_ADD_SCRIPTS: '0' }, encoding: 'utf8',
});
assert(badEdition.status !== 0, 'invalid --edition should fail');
assert((badEdition.stderr + badEdition.stdout).includes('Invalid --edition value'), 'invalid --edition error should be clear');

const badEnvEditionDir = tempWorkspace('bad-env-edition');
const badEnvEdition = spawnSync(process.execPath, [cliPath, 'install', '--yes', '--non-interactive'], {
  cwd: badEnvEditionDir, env: { ...process.env, AIGILE_ADD_SCRIPTS: '0', AIGILE_EDITION: 'invalid' }, encoding: 'utf8',
});
assert(badEnvEdition.status !== 0, 'invalid AIGILE_EDITION should fail');
assert((badEnvEdition.stderr + badEnvEdition.stdout).includes('Invalid AIGILE_EDITION value'), 'invalid AIGILE_EDITION error should be clear');

const badMcpDir = tempWorkspace('bad-mcp-profile');
const badMcp = spawnSync(process.execPath, [cliPath, 'install', '--yes', '--non-interactive', '--mcp-profile', 'invalid'], {
  cwd: badMcpDir, env: { ...process.env, AIGILE_ADD_SCRIPTS: '0' }, encoding: 'utf8',
});
assert(badMcp.status !== 0, 'invalid --mcp-profile should fail');
assert((badMcp.stderr + badMcp.stdout).includes('Invalid MCP profile'), 'invalid --mcp-profile error should be clear');

const badModelDir = tempWorkspace('bad-model-profile');
const badModel = spawnSync(process.execPath, [cliPath, 'install', '--yes', '--non-interactive', '--model-profile', 'nonexistent-profile-xyz'], {
  cwd: badModelDir, env: { ...process.env, AIGILE_ADD_SCRIPTS: '0' }, encoding: 'utf8',
});
assert(badModel.status !== 0, 'unknown --model-profile should fail');
assert((badModel.stderr + badModel.stdout).includes('Unknown model profile'), 'unknown --model-profile error should be clear');

// --- static source assertions ---
const teamBudgetYaml = readText(path.join(root, 'core', 'agent-teams', 'team-budget.yaml'));
for (const agent of ['ui-expert', 'ux-expert', 'automation-tester', 'code-tour', 'expert-react-frontend-engineer']) {
  assert(teamBudgetYaml.includes(`- ${agent}`), `team-budget.yaml must include agent: ${agent}`);
}

const coreConfigText = readText(path.join(root, 'core', 'core-config.yaml'));
const cliSrc = readText(cliPath);
const editionPromptIndex = cliSrc.indexOf("title: 'Select AIgile edition:'");
const optionalPromptIndex = cliSrc.indexOf("title: 'Select optional components:'");
assert(editionPromptIndex !== -1, 'CLI should define the interactive edition prompt');
assert(optionalPromptIndex !== -1, 'CLI should define the optional component prompt');
assert(editionPromptIndex < optionalPromptIndex, 'edition prompt should be defined before optional component selection');
assert(cliSrc.includes('shouldPromptForEdition(context, { autoYes })'), 'interactive installer should gate the edition prompt through shouldPromptForEdition');
const budgetOverrides = yamlSection(yamlSection(yamlSection(yamlSection(coreConfigText, 'models'), 'profiles'), 'budget-2026-06'), 'overrides');
const budgetOverrideValues = Object.values(budgetOverrides.match(/^\s+\S+:\s+(.+)$/mg)?.map(l => l.trim().replace(/^[^:]+:\s+/, '')) ?? []);
assert(!budgetOverrideValues.some(v => v === 'GPT-5.4-mini'), 'budget-2026-06 overrides must not contain GPT-5.4-mini');
assert(!budgetOverrideValues.some(v => /haiku/i.test(v)), 'budget-2026-06 overrides must not contain Claude Haiku');

// --- budget edition separation boundary + beast-mode source-of-truth ---
// The budget config lives OUTSIDE core/ so it is never copied into .aigile-core,
// keeping the full edition byte-for-byte unchanged. Effective budget model
// routing is resolved from this file, not from the frozen core-config.yaml.
const budgetYamlPath = path.join(root, 'tools', 'editions', 'budget', 'budget.yaml');
assert(fs.existsSync(budgetYamlPath), 'budget edition config must live at tools/editions/budget/budget.yaml (separation boundary)');
const budgetYamlText = readText(budgetYamlPath);
const budgetProfile = yamlSection(yamlSection(yamlSection(budgetYamlText, 'models'), 'profiles'), 'budget-2026-06');
const budgetSrcOverrides = yamlSection(budgetProfile, 'overrides');
assert(yamlScalar(budgetProfile, 'default') === 'GPT-5 mini', 'budget default model must be GPT-5 mini (cheapest included tier)');
assert(yamlScalar(budgetSrcOverrides, 'ux-expert') === 'GPT-5 mini', 'budget ux-expert must be GPT-5 mini (beast-mode, not GPT-5.5)');
assert(yamlScalar(budgetSrcOverrides, 'dev') === 'GPT-5.4 mini', 'budget dev must be GPT-5.4 mini (1x tier)');
assert(yamlScalar(budgetSrcOverrides, 'code-tour') === 'GPT-5.4 nano', 'budget code-tour must be GPT-5.4 nano (cheapest output)');
const budgetSrcValues = (budgetSrcOverrides.match(/^\s+\S+:\s+(.+)$/mg) ?? []).map(l => l.trim().replace(/^[^:]+:\s+/, ''));
assert(!budgetSrcValues.some(v => v === 'GPT-5.5'), 'no budget agent may default to GPT-5.5 (Powerful tier is escalation-only)');
assert(!budgetSrcValues.some(v => /opus|sonnet|haiku/i.test(v)), 'no budget agent may default to a Claude model (premium is escalation-only)');
assert(!budgetSrcValues.some(v => v === 'GPT-5.4-mini'), 'budget overrides must not contain hyphenated GPT-5.4-mini');
const budgetEscalation = yamlSection(budgetProfile, 'escalation');
assert(yamlScalar(budgetEscalation, 'premium') === 'Claude Opus 4.6', 'budget premium escalation must be Claude Opus 4.6 (escalation-only)');

const fullOverrides = yamlSection(yamlSection(yamlSection(yamlSection(coreConfigText, 'models'), 'profiles'), 'full-2026-06'), 'overrides');
for (const agent of ['ux-expert', 'sm', 'devops']) {
  assert(yamlScalar(fullOverrides, agent) !== 'Claude Opus 4.6', `full-2026-06 overrides.${agent} must not be Claude Opus 4.6 (Gap C regression guard)`);
}

const budgetMcpJson = readJson(path.join(root, 'mcp', 'servers.budget.json'));
for (const defaultServer of ['sequentialthinking', 'context7', 'memory']) {
  assert(defaultServer in budgetMcpJson.servers, `servers.budget.json must include ${defaultServer}`);
}
// The public budget catalog must stay lean and self-contained: no Docker-based
// heavy servers and no remote/internal hosts leak into the budget profile.
for (const heavyServer of ['atlassian', 'github.com', 'sonarqube', 'playwright', 'figma']) {
  assert(!(heavyServer in budgetMcpJson.servers), `servers.budget.json must not ship heavy server ${heavyServer}`);
}
const budgetMcpRaw = readText(path.join(root, 'mcp', 'servers.budget.json'));
assert(!/\.bt\.wan|git01cj001|confluencebt|jirabt|nexus/i.test(budgetMcpRaw), 'servers.budget.json must not reference any internal/private hosts');
assert(!/"command":\s*"docker"/.test(budgetMcpRaw), 'public budget MCP catalog must avoid Docker-based servers (lean npx only)');
assert(JSON.stringify((budgetMcpJson.inputs || []).map((input) => input.id)) === JSON.stringify(['context7_api_key']), 'servers.budget.json inputs must only require context7_api_key');

const mcpProfilesSrc = readText(path.join(root, 'tools', 'shared', 'mcpProfiles.js'));
const budgetDefaultServersBody = mcpProfilesSrc.match(/const BUDGET_DEFAULT_SERVERS = \[([\s\S]*?)\];/)?.[1] || '';
for (const defaultServer of ['sequentialthinking', 'context7', 'memory']) {
  assert(
    budgetDefaultServersBody.includes(`'${defaultServer}'`) || budgetDefaultServersBody.includes(`"${defaultServer}"`),
    `${defaultServer} must appear in BUDGET_DEFAULT_SERVERS in mcpProfiles.js`,
  );
}
for (const nonDefaultServer of ['atlassian', 'github.com', 'sonarqube', 'playwright', 'figma']) {
  assert(!budgetDefaultServersBody.includes(`'${nonDefaultServer}'`) && !budgetDefaultServersBody.includes(`"${nonDefaultServer}"`), `${nonDefaultServer} must not appear in BUDGET_DEFAULT_SERVERS`);
}

// --- R1 (ADR-002): cache-native stable-prefix invariance ---
// The orchestrator body must be STATIC_PREFIX + CACHE_BOUNDARY + DYNAMIC_SUFFIX,
// where STATIC_PREFIX is byte-identical regardless of the per-turn volatile
// values (return-token cap, premium escalation label). A stray volatile byte in
// the prefix would invalidate the prompt cache and RAISE cost, so this gate is
// mandatory.
function prefixHash(agentId, returnTokens, escalationPremium) {
  const body = buildBudgetOrchestrator({
    agentId,
    metadataLines: [],
    editionProfile: { edition: 'budget', subagentReturnTokens: returnTokens },
    escalationPremium,
  });
  const idx = body.indexOf(CACHE_BOUNDARY);
  assert(idx !== -1, `${agentId} orchestrator must contain the cache-boundary marker`);
  const prefix = body.slice(0, idx);
  const suffix = body.slice(idx);
  return { prefixHash: crypto.createHash('sha256').update(prefix).digest('hex'), suffix };
}
for (const orchestratorId of ['aigile-budget-orchestrator', 'aigile-manual-orchestrator']) {
  const a = prefixHash(orchestratorId, 250, 'Claude Opus 4.6');
  const b = prefixHash(orchestratorId, 999, 'Some Other Premium Model');
  assert(a.prefixHash === b.prefixHash, `${orchestratorId} STATIC_PREFIX must be byte-identical across volatile values (prompt-cache invariance)`);
  assert(a.suffix !== b.suffix, `${orchestratorId} volatile values must live in the DYNAMIC_SUFFIX (after the cache boundary)`);
  const prefixText = buildBudgetOrchestrator({ agentId: orchestratorId, metadataLines: [], editionProfile: { edition: 'budget', subagentReturnTokens: 250 }, escalationPremium: 'Claude Opus 4.6' }).split(CACHE_BOUNDARY)[0];
  assert(!/Claude Opus 4\.6/.test(prefixText), `${orchestratorId} prefix must not hardcode the premium escalation label`);
}

// --- R3 (ADR-002): per-agent decoding tuning present & bounded ---
const effectiveBudget = deepMerge(BUDGET_CONFIG_DEFAULTS, parseYamlMapping(budgetYamlText));
const budgetProfileObj = effectiveBudget.models.profiles['budget-2026-06'];
const params = budgetProfileObj.params;
assert(params && typeof params === 'object', 'budget profile must define a params map (R3)');
const REASONING = new Set(['low', 'medium', 'high']);
const VERBOSITY = new Set(['low', 'medium', 'high']);
for (const [agent, cfg] of Object.entries(params)) {
  assert(REASONING.has(cfg.reasoning_effort), `params.${agent}.reasoning_effort must be low|medium|high`);
  assert(VERBOSITY.has(cfg.verbosity), `params.${agent}.verbosity must be low|medium|high`);
  const mot = Number(cfg.max_output_tokens);
  assert(Number.isFinite(mot) && mot >= 100 && mot <= 4000, `params.${agent}.max_output_tokens must be within [100,4000]`);
}
assert(params.security?.reasoning_effort === 'high', 'security must keep reasoning_effort: high (reasoning reserved)');
assert(params.architect?.reasoning_effort === 'high', 'architect must keep reasoning_effort: high (reasoning reserved)');
assert(params['aigile-budget-orchestrator']?.reasoning_effort === 'low', 'router orchestrator must use reasoning_effort: low (cheapest)');
// Mirror check: YAML param agent set must equal the defaults.js fallback set.
const yamlOnlyParams = parseYamlMapping(budgetYamlText)?.models?.profiles?.['budget-2026-06']?.params || {};
const defaultParams = BUDGET_CONFIG_DEFAULTS.models.profiles['budget-2026-06'].params;
assert(
  JSON.stringify(Object.keys(yamlOnlyParams).sort()) === JSON.stringify(Object.keys(defaultParams).sort()),
  'budget.yaml params agent set must mirror defaults.js params (R3 mirror)',
);

// --- R5 (ADR-002): model cascade policy present ---
const cascade = budgetProfileObj.cascade;
assert(cascade && typeof cascade === 'object', 'budget profile must define a cascade block (R5)');
assert(cascade.on_guardrail_fail === 'tier++', 'cascade.on_guardrail_fail must be tier++ (one tier per failure)');
assert(Number(cascade.max_auto_escalations) >= 1, 'cascade.max_auto_escalations must be >= 1');
assert(cascade.premium_requires_user === true, 'cascade.premium_requires_user must be true (ask-before-premium)');

console.log('validate-editions ok');