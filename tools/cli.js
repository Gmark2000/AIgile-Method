#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface, emitKeypressEvents } from 'node:readline';
import { printInstallBanner } from './shared/bannerArt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// --- npm registry constants (public npm.js registry is the default) ------------------
const AIGILE_SCOPE = '@mark-gozner';
const AIGILE_PACKAGE = '@mark-gozner/aigile-method';

// Lazy-load package version (works when installed as dependency)
let cachedPkgVersion = null;
function getPackageVersion() {
  if (cachedPkgVersion) return cachedPkgVersion;
  const pkgPath = path.join(root, 'package.json');
  try {
    const raw = read(pkgPath);
    const json = JSON.parse(raw);
    cachedPkgVersion = json.version || '0.0.0';
  } catch {
    cachedPkgVersion = '0.0.0';
  }
  return cachedPkgVersion;
}

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, c) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); }

function copyDir(src, dest, filter) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const sp = path.join(src, e.name);
    const dp = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyDir(sp, dp, filter);
    } else {
      if (!filter || filter(sp)) {
        write(dp, read(sp));
      }
    }
  }
}

function listFilesRecursive(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(p));
    else files.push(p);
  }
  return files;
}

function bundle() {
  // Attempt to read optional startup header; fall back to a minimal banner if missing
  const headerPath = path.join(root, 'tools', 'md-assets', 'web-agent-startup-instructions.md');
  let header = '# AIgile Bundle\n\n';
  if (fs.existsSync(headerPath)) {
    try { header = read(headerPath); } catch { /* ignore and use fallback */ }
  } else {
    header += 'Default header (web-agent-startup-instructions.md not found).';
  }
  const SEP = '====================';
  const bundleRoot = '.aigile-core';

  // Helper to wrap content with START/END markers using dot-prefixed bundle root
  const wrap = (absPath, content) => {
    const rel = path.relative(root, absPath).replace(/\\/g, '/');
    const mapped = `${bundleRoot}/${rel.replace(/^core\//, '')}`; // map core/* -> .aigile-core/*
    return [
      `${SEP} START: ${mapped} ${SEP}`,
      content.trim(),
      `${SEP} END: ${mapped} ${SEP}`,
      ''
    ].join('\n');
  };

  // 1) Build TEAM bundle like BMAD's dist/teams/*.txt
  const teamPath = path.join(root, 'core', 'agent-teams', 'team-company.yaml');
  const teamOut = [header];
  if (fs.existsSync(teamPath)) {
    teamOut.push(wrap(teamPath, read(teamPath)));
  }
  const buckets = ['agents', 'tasks', 'templates', 'checklists', 'data', 'workflows', 'skills'];
  for (const b of buckets) {
    const dir = path.join(root, 'core', b);
    for (const p of listFilesRecursive(dir)) {
      teamOut.push(wrap(p, read(p)));
    }
  }
  write(path.join(root, 'dist', 'teams', 'team-company.txt'), teamOut.join('\n'));
  console.log('✅ Wrote dist/teams/team-company.txt');

  // 2) Per-agent bundles like BMAD's dist/agents/*.txt
  const agentsDir = path.join(root, 'core', 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      const p = path.join(agentsDir, f);
      if (fs.statSync(p).isFile() && f.endsWith('.md')) {
        const agentOut = [header, wrap(p, read(p))];
        write(path.join(root, 'dist', 'agents', f.replace(/\.md$/, '.txt')), agentOut.join('\n'));
      }
    }
    console.log('✅ Wrote dist/agents/*.txt');
  }

  // 3) Dev-focused bundle (agent + dev tasks)
  const devFile = path.join(agentsDir, 'dev.md');
  if (fs.existsSync(devFile)) {
    const devOut = [header, wrap(devFile, read(devFile))];
    const devTasks = path.join(root, 'core', 'tasks', 'dev');
    for (const p of listFilesRecursive(devTasks)) {
      devOut.push(wrap(p, read(p)));
    }
    write(path.join(root, 'dist', 'dev-agent-bundle.txt'), devOut.join('\n'));
    console.log('✅ Wrote dist/dev-agent-bundle.txt');
  }

  // 4) Distributable Claude Code plugin + marketplace entry
  buildClaudePlugin();
}

// ---------------------------------------------------------------------------
// Auth helpers (new simplified bootstrap)
// ---------------------------------------------------------------------------

function getUserHome() {
  return process.env.HOME || process.env.USERPROFILE || process.env.USERDIR || process.cwd();
}

function readUserNpmrc() {
  const home = getUserHome();
  const npmrcPath = path.join(home, '.npmrc');
  if (!fs.existsSync(npmrcPath)) return { path: npmrcPath, lines: [] };
  try { return { path: npmrcPath, lines: fs.readFileSync(npmrcPath, 'utf8').split(/\r?\n/) }; }
  catch { return { path: npmrcPath, lines: [] }; }
}

function writeUserNpmrc(npmrcPath, lines) {
  const content = lines.filter(l => l.trim().length).join('\n') + '\n';
  fs.writeFileSync(npmrcPath, content, 'utf8');
}

async function promptHidden(question) {
  if (!process.stdin.isTTY) return null; // cannot prompt
  return await new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    const onData = (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.pause();
          break;
        default:
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(question + ' ' + '*'.repeat(buffer.length));
          break;
      }
    };
    let buffer = '';
    process.stdout.write(question + ' ');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', (char) => {
      char = char + '';
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        rl.close();
        process.stdout.write('\n');
        resolve(buffer.trim());
      } else if (char === '\u0003') { // ctrl+c
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        rl.close();
        process.stdout.write('\n');
        resolve(null);
      } else if (char === '\u0008' || char === '\u007f') { // backspace
        buffer = buffer.slice(0, -1);
        process.stdout.clearLine(0); process.stdout.cursorTo(0);
        process.stdout.write(question + ' ' + '*'.repeat(buffer.length));
      } else {
        buffer += char;
        process.stdout.clearLine(0); process.stdout.cursorTo(0);
        process.stdout.write(question + ' ' + '*'.repeat(buffer.length));
      }
    });
  });
}

async function ensureAuthConfigured({ tokenFromFlags = null, nonInteractive = false } = {}) {
  const { path: npmrcPath, lines } = readUserNpmrc();
  let changed = false;

  // For public npm, no special registry configuration is needed
  // Users can optionally set NPM_TOKEN for publishing
  return { configured: true, changed: false, npmrcPath };
}

function pruneLegacy(dest) {
  // Remove artifacts that earlier installer versions created
  // - docs/ (skeleton docs)
  // - .aigile (marker file)
  const targets = [
    path.join(dest, 'docs'),
    path.join(dest, '.aigile')
  ];
  let removed = [];
  for (const p of targets) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
        else fs.rmSync(p, { force: true });
        removed.push(p);
      }
    } catch { /* no-op */ }
  }
  if (removed.length) {
    const color = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
    const yellow = color(33);
    console.log(yellow(`Pruned legacy artifacts:`));
    for (const p of removed) console.log(`  - ${p}`);
  }
}

async function askYesNo(question, def = true) {
  return new Promise((resolve) => {
    const rl = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;
    const q = `${question} ${def ? '[Y/n]' : '[y/N]'} `;
    if (!rl) {
      resolve(def);
      return;
    }
    rl.question(q, (ans) => {
      rl.close();
      const a = (ans || '').trim().toLowerCase();
      if (!a) return resolve(def);
      resolve(a.startsWith('y'));
    });
  });
}

async function multiSelectPrompt({ title, options, defaults = [] }) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(defaults);
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    emitKeypressEvents(process.stdin, rl);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const state = new Set(defaults);
    let index = 0;

    const render = () => {
      const lines = [];
      lines.push(`\n${title}`);
      lines.push('Use Up/Down to move, Space to toggle, Enter to confirm');
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        const cursor = i === index ? '>' : ' ';
        const checked = state.has(o.value) ? '[x]' : '[ ]';
        lines.push(` ${cursor} ${checked} ${o.label}`);
      }
      // Clear and re-render
      rl.output.write('\x1b[2J\x1b[0f');
      rl.output.write(lines.join('\n'));
    };

    const onKey = (_str, key) => {
      if (key.name === 'down') { index = (index + 1) % options.length; render(); }
      else if (key.name === 'up') { index = (index - 1 + options.length) % options.length; render(); }
      else if (key.name === 'space') {
        const val = options[index].value;
        if (state.has(val)) state.delete(val); else state.add(val);
        render();
      }
      else if (key.name === 'return' || (key.ctrl && key.name === 'm')) {
        cleanup();
        resolve([...state]);
      }
      else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(defaults);
      }
    };

    const cleanup = () => {
      process.stdin.off('keypress', onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
      console.log();
    };

    process.stdin.on('keypress', onKey);
    render();
  });
}

/**
 * Detect which platforms a project is already set up for, so a plain
 * `install` / `install --yes` targets the IDE the user actually works in.
 * Falls back to Copilot when nothing is detected (historical default).
 */
function detectPlatforms(dest) {
  const found = [];
  if (fs.existsSync(path.join(dest, '.kiro'))) found.push('kiro');
  if (fs.existsSync(path.join(dest, '.github'))) found.push('copilot');
  if (fs.existsSync(path.join(dest, '.agent')) || fs.existsSync(path.join(dest, 'GEMINI.md'))) found.push('antigravity');
  if (fs.existsSync(path.join(dest, '.claude')) || fs.existsSync(path.join(dest, 'CLAUDE.md'))) found.push('claude');
  // Kiro sets its own terminal identity; treat that as a strong signal
  const termProgram = (process.env.TERM_PROGRAM || '').toLowerCase();
  if ((termProgram.includes('kiro') || process.env.KIRO_HOME) && !found.includes('kiro')) found.push('kiro');
  // Claude Code exports these when the installer runs from inside a session
  if ((process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) && !found.includes('claude')) found.push('claude');
  return found.length ? found : ['copilot'];
}

/**
 * Resolve target platforms for the non-interactive code paths.
 * Explicit flags always win; otherwise fall back to workspace detection.
 */
function resolvePlatforms(dest, { copilot = false, antigravity = false, kiro = false, claude = false } = {}) {
  if (copilot || antigravity || kiro || claude) return { copilot, antigravity, kiro, claude, detected: false };
  const detected = detectPlatforms(dest);
  return {
    copilot: detected.includes('copilot'),
    antigravity: detected.includes('antigravity'),
    kiro: detected.includes('kiro'),
    claude: detected.includes('claude'),
    detected: true,
  };
}

/** Human-readable list of the platforms a resolved target covers. */
function describePlatforms(target) {
  return [
    target.copilot && 'copilot',
    target.antigravity && 'antigravity',
    target.kiro && 'kiro',
    target.claude && 'claude',
  ].filter(Boolean).join(', ');
}

async function installInteractive({ autoYes = false }) {
  const dest = process.cwd();
  printInstallBanner({ showGMSignature: true });

  // ── CLI flag overrides ──
  const forcedCopilot = process.argv.includes('--for-copilot');
  const forcedAntigravity = process.argv.includes('--for-antigravity');
  const forcedKiro = process.argv.includes('--for-kiro');
  const forcedClaude = process.argv.includes('--for-claude');
  const forcedJavaInstructions = process.argv.includes('--with-java-instructions');

  // ── Platform selector ──
  let platforms = [];
  if (forcedCopilot || forcedAntigravity || forcedKiro || forcedClaude) {
    // Explicit flags take precedence
    if (forcedCopilot) platforms.push('copilot');
    if (forcedAntigravity) platforms.push('antigravity');
    if (forcedKiro) platforms.push('kiro');
    if (forcedClaude) platforms.push('claude');
  } else if (autoYes) {
    platforms = detectPlatforms(dest); // match the IDEs this project already uses
    console.log(`Detected target platform(s): ${platforms.join(', ')}`);
  } else {
    const detected = detectPlatforms(dest);
    const platformSelections = await multiSelectPrompt({
      title: 'Select target platforms:',
      options: [
        { label: 'GitHub Copilot (.github/agents/)', value: 'copilot' },
        { label: 'Google Antigravity (.agent/ + GEMINI.md)', value: 'antigravity' },
        { label: 'Kiro (.kiro/agents/ + .kiro/steering/ + .kiro/skills/)', value: 'kiro' },
        { label: 'Claude Code (.claude/agents/ + .claude/skills/ + CLAUDE.md)', value: 'claude' },
      ],
      defaults: detected,
    });
    platforms = platformSelections.length > 0 ? platformSelections : detected;
  }

  const installCopilot = platforms.includes('copilot');
  const installAntigravityFlag = platforms.includes('antigravity');
  const installKiroFlag = platforms.includes('kiro');
  const installClaudeFlag = platforms.includes('claude');

  // ── Optional components (only shown in interactive mode) ──
  let addMcpJson = false;
  let addMcpSettings = false;
  let addJavaInstructions = forcedJavaInstructions;
  let addCommunitySkillsFlag = process.argv.includes('--with-community-skills');
  if (autoYes) {
    addMcpJson = false;
    addMcpSettings = false;
  } else {
    const mcpTargets = [
      (installCopilot || installAntigravityFlag) && '.vscode/mcp.json',
      installKiroFlag && '.kiro/settings/mcp.json',
      installClaudeFlag && '.mcp.json',
    ].filter(Boolean).join(' + ');
    const componentOptions = [
      { label: `Install MCP servers (${mcpTargets} from mcp/servers.json)`, value: 'mcpJson' },
    ];
    if (installCopilot) {
      // VS Code specific extras
      componentOptions.push({ label: 'Add mock .vscode/settings.json MCP endpoints', value: 'mcpSettings' });
      componentOptions.push({ label: 'Include Java contributor instructions (.github/instructions/java.instructions.md)', value: 'javaInstructions' });
    }
    if (installKiroFlag) {
      componentOptions.push({
        label: 'Fetch recommended community skills for Kiro (downloads from GitHub)',
        value: 'communitySkills',
      });
    }
    const selections = await multiSelectPrompt({
      title: 'Select optional components:',
      options: componentOptions,
      defaults: forcedJavaInstructions ? ['mcpJson', 'javaInstructions'] : ['mcpJson'],
    });
    addMcpJson = selections.includes('mcpJson');
    addMcpSettings = selections.includes('mcpSettings');
    if (!forcedJavaInstructions) addJavaInstructions = selections.includes('javaInstructions');
    addCommunitySkillsFlag = selections.includes('communitySkills');
  }

  // ── Run platform-specific installers ──
  let antigravityResult = null;
  let kiroResult = null;
  let claudeResult = null;
  if (installCopilot) {
    installGithubCopilot(dest, { addJavaInstructions });
  }
  if (installAntigravityFlag) {
    antigravityResult = installAntigravity(dest);
  }
  if (installKiroFlag) {
    kiroResult = installKiro(dest);
  }
  if (installClaudeFlag) {
    claudeResult = installClaudeCode(dest);
  }
  let communitySkillsResult = null;
  if (installKiroFlag && addCommunitySkillsFlag) {
    communitySkillsResult = await addCommunitySkills([], { dest });
  }

  // ── Post-install shared steps ──
  maybeAddConsumerScripts(dest);
  if (process.argv.includes('--prune-legacy')) pruneLegacy(dest);
  if (addMcpSettings) writeMockMcp(dest);
  if (addMcpJson) {
    if (installCopilot || installAntigravityFlag) writeMcpJson(dest);
    if (installKiroFlag) writeKiroMcpJson(dest);
    if (installClaudeFlag) writeClaudeMcpJson(dest);
  }
  if (installCopilot) writeVscodeSettings(dest);
  writeManifest(dest, { addMcpJson, addMcpSettings, addJavaInstructions, forAntigravity: installAntigravityFlag, forKiro: installKiroFlag, forClaude: installClaudeFlag });

  // ── Print summary ──
  try {
    const coreDir = path.join(dest, '.aigile-core');
    const coreFiles = listFilesRecursive(coreDir).length;
    const color = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
    const green = color(32);
    const cyan = color(36);
    const yellow = color(33);
    console.log(`\n${green('Summary:')}`);
    console.log(`  - .aigile-core files: ${cyan(String(coreFiles))}`);

    if (installCopilot) {
      const agentsDir = path.join(dest, '.github', 'agents');
      const agentCount = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.agent.md')).length : 0;
      console.log(`  - Copilot custom agents: ${cyan(String(agentCount))}`);
    }

    if (installAntigravityFlag && antigravityResult) {
      console.log(`  - Antigravity rules: ${cyan(String(antigravityResult.rules))}`);
      console.log(`  - Antigravity workflows: ${cyan(String(antigravityResult.workflows))}`);
      console.log(`  - ${yellow('GEMINI.md')} generated`);
    }

    if (installKiroFlag && kiroResult) {
      console.log(`  - Kiro custom agents: ${cyan(String(kiroResult.agents))}`);
      console.log(`  - Kiro steering files: ${cyan(String(kiroResult.steering))}`);
      console.log(`  - Kiro AIgile skills: ${cyan(String(kiroResult.skills))}`);
    }

    if (installClaudeFlag && claudeResult) {
      console.log(`  - Claude Code subagents: ${cyan(String(claudeResult.agents))}`);
      console.log(`  - Claude Code skills: ${cyan(String(claudeResult.skills.total))} (${claudeResult.skills.commandSkills} agent workflows, ${claudeResult.skills.workflowSkills} delivery workflows)`);
      console.log(`  - ${yellow('CLAUDE.md')} AIgile section written`);
    }

    if (communitySkillsResult) {
      console.log(`  - Community skills fetched: ${cyan(String(communitySkillsResult.added.length))}${communitySkillsResult.failed.length ? ` (${communitySkillsResult.failed.length} failed)` : ''}`);
    }

    if (addMcpJson) console.log(`  - ${yellow('.vscode/mcp.json')} generated (fill API keys)`);
    if (addMcpSettings) console.log(`  - ${yellow('.vscode/settings.json')} updated with mock MCP servers`);
    if (addJavaInstructions) console.log(`  - ${yellow('.github/instructions/java.instructions.md')} copied`);

    console.log(`\n${green('Next steps:')}`);
    let step = 1;
    if (installCopilot) {
      console.log(`  ${step++}) Open VS Code and select an agent from the ${yellow('Agents dropdown')} in Copilot Chat`);
    }
    if (installAntigravityFlag) {
      console.log(`  ${step++}) Open Antigravity IDE — agent rules and workflows are ready in ${yellow('.agent/')}`);
    }
    if (installKiroFlag) {
      console.log(`  ${step++}) Open Kiro, trust the workspace, then pick an agent from the ${yellow('agent selector')}`);
      console.log(`  ${step++}) Type ${yellow('/')} in chat for AIgile workflows and skills (e.g. /aigile-dev-workflows)`);
      console.log(`  ${step++}) Browse more skills with ${yellow('npx @mark-gozner/aigile-method skills:list')}`);
    }
    if (installClaudeFlag) {
      console.log(`  ${step++}) Open Claude Code here and run ${yellow('/aigile')} for routing help`);
      console.log(`  ${step++}) Type ${yellow('/aigile-')} to browse workflows (e.g. /aigile-dev-develop-story)`);
      console.log(`  ${step++}) Delegate to a specialist by asking, e.g. ${yellow('"use the qa subagent to design tests"')}`);
    }
    if (addMcpJson) console.log(`  ${step++}) When prompted, provide the required API keys for MCP servers`);
  } catch { }
}

function kebabCaseName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function extractAgentTitle(agentMd) {
  // Best effort: find `title:` inside the first ```yaml block
  const m = agentMd.match(/```ya?ml\r?\n([\s\S]*?)\r?\n```/);
  if (!m) return null;
  const yamlBlock = m[1];
  const t = yamlBlock.match(/\btitle\s*:\s*(.+)/);
  return t ? t[1].trim() : null;
}

function toTitleCase(str) {
  return str.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(read(p)); } catch { return null; }
}

function buildMcpCatalog() {
  const serversJson = path.join(root, 'mcp', 'servers.json');
  const doc = readJsonIfExists(serversJson);
  if (!doc || !doc.servers) return [];
  const catalog = [];
  for (const [id, cfg] of Object.entries(doc.servers)) {
    const lower = id.toLowerCase();
    const item = { id, hints: [] };
    if (lower.includes('github') || id === 'github.com') {
      item.hints.push('Search repos, issues, code, and pull requests');
      item.hints.push('Summarize diffs and review PRs');
      item.hints.push('List branches, files, commit history');
    }
    if (lower.includes('atlassian')) {
      item.hints.push('Query Jira issues, transitions, and comments');
      item.hints.push('Search Confluence pages and spaces');
    }
    if (lower.includes('sonarqube')) {
      item.hints.push('Get code quality metrics and hotspots');
      item.hints.push('List vulnerabilities and code smells');
    }
    if (lower.includes('playwright')) {
      item.hints.push('Generate and run browser tests');
      item.hints.push('Record traces and produce reports');
    }
    if (lower.includes('memory')) {
      item.hints.push('Store and recall project notes across sessions');
    }
    if (lower.includes('toolkit')) {
      item.hints.push('Access gateway-provided tools (project-specific)');
    }
    if (lower.includes('sequentialthinking')) {
      item.hints.push('Plan multi-step tasks and maintain checklists');
    }
    if (lower.includes('context7')) {
      item.hints.push('Search knowledge bases and ground responses');
    }
    if (item.hints.length === 0) item.hints.push('General purpose server');
    catalog.push(item);
  }
  return catalog;
}

function listTasksForAgent(agentId) {
  // Return specific tasks per agent based on BMAD approach
  // Only include agent-specific tasks, plus selective common tasks
  const agentTaskMappings = {
    'aigile-orchestrator': [
      'help.md'
      // Orchestrator doesn't execute tasks directly - it coordinates agents
    ],
    'aigile-master': [
      'document-project.md',
      'create-architecture-doc.md',
      'create-prd-doc.md',
      'execute-checklist.md',
      'advanced-elicitation.md',
      'facilitate-brainstorming-session.md',
      'help.md'
      // Master can execute any task, but these are commonly used
    ],
    analyst: [
      'facilitate-brainstorming-session.md',
      'market-research-from-context7.md',
      'advanced-elicitation.md'
    ],
    architect: [
      'code-arch-review-with-github.md',
      'document-project.md',
      'create-architecture-doc.md',
      'execute-checklist.md'
    ],
    dev: [
      'check-story-implemented.md',
      'explain-story-from-jira.md',
      'implement-freeform-work-item.md',
      'implement-story-from-jira.md',
      'implement-unit-tests.md',
      'execute-checklist.md',
      'validate-next-story.md'
    ],
    pm: [
      'sync-jira-backlog.md',
      'create-next-story.md',
      'create-prd-doc.md'
    ],
    po: [
      'create-jira-epic-from-confluence.md',
      'create-stories-from-epic.md',
      'create-tasks-for-story.md',
      'create-jira-story-from-confluence.md',
      'create-jira-story-from-text.md',
      'groom-jira-story.md',
      'create-prd-doc.md',
      'create-next-story.md'
    ],
    qa: [
      'gate.md',
      'sonarqube-hotspot-review.md',
      'test-design.md',
      'verify-jira-story-e2e.md',
      'review-story.md'
    ],
    sm: [
      'standup-digest.md'
    ],
    'ui-expert': [
      'figma-audit-design-system.md'
    ],
    'ux-expert': [
      'front-end-spec-from-design.md'
    ],
    devops: [
      'execute-checklist.md'
    ],
    'automation-tester': [
      'verify-jira-story-e2e.md',
      'test-design.md',
      'execute-checklist.md'
    ],
    security: [
      'code-arch-review-with-github.md',
      'sonarqube-hotspot-review.md',
      'execute-checklist.md'
    ]
  };

  // Handle both ui-expert and ui folder mapping
  if (agentId === 'ui') agentId = 'ui-expert';
  if (agentId === 'ux') agentId = 'ux-expert';

  return agentTaskMappings[agentId] || [];
}

function generateTurboChatmode({ agentId, agentTitle, agentMd, mcpCatalog, tasks }) {
  // Deprecated: replaced by generateStructuredChatmode
  return agentMd;
}

function extractAgentMeta(agentMd) {
  const meta = { name: null, title: null, whenToUse: null, persona: {}, corePrinciples: [] };
  const m = agentMd.match(/```ya?ml\r?\n([\s\S]*?)\r?\n```/);
  if (!m) {
    // Try unfenced YAML
    const directRole = agentMd.match(/^\s*role\s*:\s*"?([^"\r\n]+)"?/m);
    const directTitle = agentMd.match(/^\s*title\s*:\s*"?([^"\r\n]+)"?/m);
    if (directRole) meta.agentRole = directRole[1].trim();
    if (directTitle) meta.title = directTitle[1].trim();
    return meta;
  }
  const yaml = m[1];

  const name = yaml.match(/\bname\s*:\s*(.+)/);
  const title = yaml.match(/\btitle\s*:\s*(.+)/);
  const wtu = yaml.match(/\bwhenToUse\s*:\s*([\s\S]*?)(?:\r?\n\s*[a-zA-Z_][\w-]*\s*:|$)/);
  if (name) meta.name = name[1].trim();
  if (title) meta.title = title[1].trim();
  const agentRole = yaml.match(/^\s*role\s*:\s*"?([^"\r\n]+)"?/m);
  if (agentRole) meta.agentRole = agentRole[1].trim();
  if (wtu) meta.whenToUse = wtu[1].trim().replace(/^\|\s*\r?\n?/, '').replace(/^"|"$/g, '');

  // persona fields (best-effort global matches inside YAML block)
  const role = yaml.match(/\bpersona:\s*[\s\S]*?\brole\s*:\s*([^\r\n]+)/);
  const style = yaml.match(/\bpersona:\s*[\s\S]*?\bstyle\s*:\s*([^\r\n]+)/);
  const identity = yaml.match(/\bpersona:\s*[\s\S]*?\bidentity\s*:\s*([^\r\n]+)/);
  const focus = yaml.match(/\bpersona:\s*[\s\S]*?\bfocus\s*:\s*([^\r\n]+)/);
  if (role) meta.persona.role = role[1].trim();
  if (style) meta.persona.style = style[1].trim();
  if (identity) meta.persona.identity = identity[1].trim();
  if (focus) meta.persona.focus = focus[1].trim();

  // core_principles list under persona:
  // Find start of 'core_principles:' within persona and collect '- ' lines
  const cpStart = yaml.match(/\bpersona:\s*[\s\S]*?\bcore_principles\s*:\s*\r?\n/);
  if (cpStart) {
    // Slice from match index to end and iterate lines
    const startIdx = cpStart.index + cpStart[0].length;
    const rest = yaml.slice(startIdx).split(/\r?\n/);
    for (const line of rest) {
      if (/^\s*-\s+/.test(line)) {
        meta.corePrinciples.push(line.replace(/^\s*-\s+/, '').trim());
      } else if (/^\S/.test(line)) {
        // Reached next top-level key
        break;
      }
    }
  }
  return meta;
}

/**
 * Extract any explicit MCP allow-lists declared in a source agent's YAML under
 * `mcp-tools:`. Recognizes any key matching `<server>-allow:` (e.g.
 * `figma-allow:`, `playwright-allow:`) whose value is a YAML list of MCP tool
 * strings already in `serverName/toolName` form. Returns a flat string array.
 * Generic — not coupled to any specific server.
 */
function extractMcpAllowLists(agentMd) {
  const out = [];
  const m = agentMd.match(/```ya?ml\r?\n([\s\S]*?)\r?\n```/);
  const yaml = m ? m[1] : agentMd;
  if (!yaml) return out;
  // Capture the indented body of the top-level `mcp-tools:` mapping. The block
  // ends at the next line that starts with a non-whitespace char (next
  // top-level YAML key) or end of input.
  const block = yaml.match(/^mcp-tools\s*:[ \t]*\r?\n([\s\S]*?)(?=^\S|\Z)/m);
  if (!block) return out;
  const body = block[1];
  // Find each `<server>-allow:` sub-key and gather its `- item` entries.
  const re = /^[ \t]+([A-Za-z0-9_.-]+)-allow\s*:[ \t]*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/gm;
  let mm;
  while ((mm = re.exec(body)) !== null) {
    const items = mm[2].split(/\r?\n/);
    for (const line of items) {
      let v = line.replace(/^\s*-\s*/, '');
      if (!v.trim()) continue;
      // Prefer the value inside surrounding quotes if present (handles trailing
      // `# comment` cleanly); otherwise strip an inline comment.
      const quoted = v.match(/^['"]([^'"]+)['"]/);
      if (quoted) {
        out.push(quoted[1].trim());
      } else {
        const noComment = v.split('#')[0].trim();
        if (noComment) out.push(noComment);
      }
    }
  }
  return out;
}

function relevantDependencies(agentId) {
  const result = { templates: [], data: [], checklists: [] };

  // Agent-specific template mappings based on BMAD approach
  const templateMappings = {
    'aigile-orchestrator': [], // Orchestrator doesn't use templates directly
    'aigile-master': ['architecture-tmpl.yaml', 'prd-tmpl.yaml', 'project-brief-tmpl.yaml', 'story-tmpl.yaml', 'qa-gate-tmpl.yaml', 'front-end-spec-tmpl.yaml', 'market-research-tmpl.yaml'], // Master has access to all templates
    analyst: ['project-brief-tmpl.yaml', 'market-research-tmpl.yaml'],
    architect: ['architecture-tmpl.yaml'],
    po: ['story-tmpl.yaml', 'prd-tmpl.yaml'],
    qa: ['qa-gate-tmpl.yaml', 'story-tmpl.yaml'],
    'ui-expert': ['front-end-spec-tmpl.yaml'],
    'ux-expert': ['front-end-spec-tmpl.yaml'],
    devops: [],
    'automation-tester': ['qa-gate-tmpl.yaml'],
    security: []
  };

  // Agent-specific data file mappings
  const dataMappings = {
    'aigile-orchestrator': ['aigile-kb.md'], // Orchestrator has access to knowledge base
    'aigile-master': ['aigile-kb.md', 'brainstorming-techniques.md', 'elicitation-methods.md', 'technical-preferences.md', 'test-levels-framework.md', 'test-priorities-matrix.md'], // Master has access to all data files
    analyst: ['brainstorming-techniques.md', 'elicitation-methods.md', 'aigile-kb.md'],
    architect: ['technical-preferences.md', 'aigile-kb.md'],
    qa: ['test-levels-framework.md', 'test-priorities-matrix.md', 'technical-preferences.md', 'aigile-kb.md'],
    dev: ['technical-preferences.md', 'test-levels-framework.md', 'test-priorities-matrix.md', 'aigile-kb.md'],
    pm: ['aigile-kb.md'],
    po: ['aigile-kb.md'],
    sm: ['aigile-kb.md'],
    'ui-expert': ['aigile-kb.md'],
    'ux-expert': ['aigile-kb.md'],
    devops: ['technical-preferences.md', 'aigile-kb.md'],
    'automation-tester': ['test-levels-framework.md', 'test-priorities-matrix.md', 'aigile-kb.md'],
    security: ['technical-preferences.md', 'aigile-kb.md']
  };

  // Agent-specific checklist mappings based on role responsibilities
  const checklistMappings = {
    'aigile-orchestrator': [], // Orchestrator doesn't execute checklists directly
    'aigile-master': ['architect-checklist.md', 'change-checklist.md', 'pm-checklist.md', 'po-master-checklist.md', 'story-dod-checklist.md', 'story-draft-checklist.md'], // Master has access to all checklists
    analyst: ['change-checklist.md'], // For impact analysis and requirements changes
    architect: ['architect-checklist.md', 'change-checklist.md'], // Architecture decisions and technical changes
    pm: ['pm-checklist.md', 'change-checklist.md'], // Project management and change coordination
    po: ['po-master-checklist.md', 'story-draft-checklist.md'], // Product ownership and story creation
    dev: ['story-dod-checklist.md'], // Development completion criteria
    qa: ['story-dod-checklist.md'], // Quality validation of completed stories
    sm: [], // Scrum Master focuses on process facilitation, no specific checklists
    'ui-expert': ['story-dod-checklist.md'], // UI deliverables completion
    'ux-expert': ['story-draft-checklist.md'], // UX requirements and story preparation
    devops: ['change-checklist.md'],
    'automation-tester': ['story-dod-checklist.md'],
    security: ['change-checklist.md']
  };

  // Handle both ui-expert and ui folder mapping
  if (agentId === 'ui') agentId = 'ui-expert';
  if (agentId === 'ux') agentId = 'ux-expert';

  result.templates = templateMappings[agentId] || [];
  result.data = dataMappings[agentId] || [];
  result.checklists = checklistMappings[agentId] || [];

  return result;
}

function listAllTaskFiles(agentId) {
  // DEPRECATED: Use listTasksForAgent instead for more precise control
  const result = [];
  for (const bucket of [agentId, 'common']) {
    const dir = path.join(root, 'core', 'tasks', bucket);
    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir)) {
        const p = path.join(dir, entry);
        if (fs.statSync(p).isFile()) result.push(entry);
      }
    }
  }
  return Array.from(new Set(result)).sort();
}

function listAllChecklists() {
  const dir = path.join(root, 'core', 'checklists');
  const out = [];
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (fs.statSync(p).isFile()) out.push(entry);
    }
  }
  return out.sort();
}

function baseTools() {
  // Base toolset available to ALL agents (official GitHub Copilot MCP tools + a few helpful extras)
  return [
    // Official Copilot tools requested
    'extensions',
    'todos',
    'codebase',
    'usages',
    'vscodeAPI',
    'think',
    'problems',
    'changes',
    'testFailure',
    'openSimpleBrowser',
    'fetch',
    'findTestFiles',
    'searchResults',
    'githubRepo',
    'runCommands',
    'runTasks',
    'editFiles',
    'runNotebooks',
    'search',
    'new',
    // Helpful extras already supported in this CLI integration
    'terminalSelection',
    'terminalLastCommand'
  ];
}

// Catalog of official MCP tool names for known servers
const TOOL_CATALOG = {
  github: [
    // Repository operations
    'search_repositories', 'get_repository', 'list_repositories', 'fork_repository',
    // File operations  
    'get_file', 'create_file', 'update_file', 'delete_file', 'search_code',
    // Branch operations
    'list_branches', 'create_branch', 'get_branch',
    // Commit operations
    'list_commits', 'get_commit',
    // Issue operations
    'search_issues', 'list_issues', 'get_issue', 'create_issue', 'update_issue', 'add_comment',
    // Pull request operations
    'list_pull_requests', 'get_pull_request', 'create_pull_request', 'update_pull_request',
    // Release operations
    'list_releases', 'get_release', 'get_latest_release',
    // User operations
    'get_user', 'search_users', 'get_authenticated_user'
  ],
  atlassian: [
    // Jira read-only operations (official MCP tool names)
    'jira_search',
    'jira_get_issue',
    'jira_get_all_projects',
    'jira_get_project_issues',
    'jira_get_transitions',
    'jira_search_fields',
    'jira_get_agile_boards',
    'jira_get_board_issues',
    'jira_get_sprints_from_board',
    'jira_get_sprint_issues',
    'jira_get_issue_link_types',
    'jira_get_user_profile',
    'jira_get_project_versions',
    // Confluence read-only operations (official MCP tool names)
    'confluence_search',
    'confluence_get_page',
    'confluence_get_page_children',
    'confluence_get_comments',
    'confluence_get_labels',
    'confluence_search_user'
  ],
  playwright: [
    // Navigation
    'navigate', 'reload', 'go_back', 'go_forward',
    // Interaction
    'click', 'type', 'press_key', 'fill', 'select_option',
    // Waiting
    'wait_for_selector', 'wait_for_load_state', 'wait_for_timeout',
    // Extraction
    'get_text', 'get_attribute', 'get_property', 'screenshot',
    // Browser management
    'new_page', 'close_page', 'set_viewport_size'
  ],
  memory: [
    'create_entities', 'create_relations', 'add_observations', 'delete_entities', 'delete_observations', 'delete_relations', 'read_graph', 'search_nodes', 'open_nodes'
  ],
  sequentialthinking: [
    'sequentialthinking'
  ],
  context7: [
    'get-library-docs', 'resolve-library-id'
  ]
};

function mcpToolsForAgent(agentId) {
  // Return minimal MCP tool list per agent based on their tasks
  const serverMappings = {
    'aigile-orchestrator': ['memory', 'sequentialthinking'], // Orchestrator coordinates agents
    'aigile-master': ['context7', 'atlassian', 'github.com', 'sonarqube', 'playwright', 'figma', 'memory', 'sequentialthinking'], // Master has access to all tools
    analyst: ['context7', 'memory', 'sequentialthinking'],
    architect: ['github.com', 'context7', 'memory', 'sequentialthinking'],
    dev: ['atlassian', 'github.com', 'sonarqube', 'memory', 'sequentialthinking'],
    pm: ['atlassian', 'sequentialthinking'],
    po: ['atlassian', 'memory', 'sequentialthinking'],
    qa: ['sonarqube', 'playwright', 'atlassian', 'memory', 'sequentialthinking'],
    sm: ['atlassian', 'memory', 'sequentialthinking'],
    ui: ['memory', 'sequentialthinking'], // Note: figma not available in servers.json
    ux: ['memory', 'sequentialthinking'],
    'ui-expert': ['memory', 'sequentialthinking'],
    'ux-expert': ['memory', 'sequentialthinking']
  };

  const agentServers = serverMappings[agentId] || ['sequentialthinking'];
  const tools = new Set();

  // Map server names to actual tools from TOOL_CATALOG
  for (const serverName of agentServers) {
    const serverKey = serverName.toLowerCase();
    if (serverKey.includes('github') || serverKey === 'github.com') {
      for (const tool of TOOL_CATALOG.github) tools.add(tool);
    } else if (serverKey.includes('atlassian')) {
      for (const tool of TOOL_CATALOG.atlassian) tools.add(tool);
    } else if (serverKey.includes('playwright')) {
      for (const tool of TOOL_CATALOG.playwright) tools.add(tool);
    } else if (serverKey.includes('memory')) {
      for (const tool of TOOL_CATALOG.memory) tools.add(tool);
    } else if (serverKey.includes('sequentialthinking')) {
      for (const tool of TOOL_CATALOG.sequentialthinking) tools.add(tool);
    } else if (serverKey.includes('context7')) {
      for (const tool of TOOL_CATALOG.context7) tools.add(tool);
    }
    // For servers not in TOOL_CATALOG (sonarqube, toolkit), add server name as fallback
    else if (['sonarqube', 'toolkit'].includes(serverKey)) {
      tools.add(serverKey); // known servers without explicit tool catalog
    } else {
      tools.add(serverName); // fallback for unknown servers
    }
  }

  return Array.from(tools);
}

function mcpServersForAgent(agentId) {
  // Return MCP server list per agent - all non-orchestrator agents get the core 3 MCPs
  const coreMcpServers = ['github.com', 'sequentialthinking', 'context7'];

  // Orchestrator has NO MCP tools - only runSubagent
  if (agentId === 'aigile-orchestrator') {
    return [];
  }

  return coreMcpServers;
}

function mcpToolsFromServers() {
  const serversJson = path.join(root, 'mcp', 'servers.json');
  const doc = readJsonIfExists(serversJson);
  if (!doc || !doc.servers) return [];

  const detectedToolNames = new Set();

  for (const [id, cfg] of Object.entries(doc.servers)) {
    const idLower = id.toLowerCase();
    const args = Array.isArray(cfg?.args) ? cfg.args.map(String) : [];
    const command = String(cfg?.command || '');
    const joined = `${command} ${args.join(' ')}`.toLowerCase();

    // Heuristics to match known servers
    const isGithub = joined.includes('github-mcp-server') || idLower.includes('github') || idLower === 'github.com' || (cfg?.env && ('GITHUB_HOST' in cfg.env));
    const isAtlassian = joined.includes('mcp-atlassian') || idLower.includes('atlassian');
    const isPlaywright = joined.includes('@playwright/mcp') || idLower.includes('playwright');
    const isMemory = joined.includes('server-memory') || idLower.includes('memory');
    const isSequential = joined.includes('server-sequential-thinking') || idLower.includes('sequentialthinking');

    if (isGithub) {
      for (const t of TOOL_CATALOG.github) detectedToolNames.add(t);
      continue;
    }
    if (isAtlassian) {
      for (const t of TOOL_CATALOG.atlassian) detectedToolNames.add(t);
      continue;
    }
    if (isPlaywright) {
      for (const t of TOOL_CATALOG.playwright) detectedToolNames.add(t);
      continue;
    }
    if (isMemory) {
      for (const t of TOOL_CATALOG.memory) detectedToolNames.add(t);
      continue;
    }
    if (isSequential) {
      for (const t of TOOL_CATALOG.sequentialthinking) detectedToolNames.add(t);
      continue;
    }

    // Unknown server types (e.g., context7, sonarqube, toolkit) -> skip explicit tools (host will discover)
  }

  return Array.from(detectedToolNames);
}

function agentIcon(agentId) {
  const map = {
    'aigile-orchestrator': '🎭',
    'aigile-master': '🧙',
    dev: '💻',
    qa: '🧪',
    pm: '📋',
    po: '🧭',
    sm: '⏱️',
    analyst: '🧠',
    architect: '🏗️',
    'ux-expert': '🎨',
    'ui-expert': '🖌️',
    'aigile-manual-orchestrator': '🎬',
    devops: '⚙️',
    security: '🔐',
    'automation-tester': '🤖',
    'code-tour': '🧭',
    'expert-react-frontend-engineer': '⚛️'
  };
  return map[agentId] || '🤖';
}

function personaFor(agentId) {
  const overrides = {
    dev: {
      role: 'Expert Senior Software Engineer & Implementation Specialist',
      style: 'Systematic, test-driven, documentation-focused, methodical',
      identity: 'Implements stories by executing tasks sequentially with comprehensive testing and validation',
      focus: 'Code quality, test coverage, story implementation, and technical debt management'
    },
    qa: {
      role: 'Senior Quality Engineer & Test Architect',
      style: 'Risk-focused, systematic, thorough, evidence-based',
      identity: 'Ensures quality through comprehensive testing strategies and automated validation',
      focus: 'Test design, quality gates, risk assessment, and defect prevention'
    },
    pm: {
      role: 'Technical Project Manager & Delivery Lead',
      style: 'Organized, tracking-focused, stakeholder-oriented, results-driven',
      identity: 'Coordinates delivery through planning, tracking, and impediment resolution',
      focus: 'Sprint planning, backlog management, delivery tracking, and team coordination'
    },
    po: {
      role: 'Product Owner & Requirements Authority',
      style: 'User-focused, value-driven, prioritization-expert, clear communicator',
      identity: 'Defines product direction through story creation, grooming, and acceptance criteria',
      focus: 'Backlog grooming, story quality, acceptance criteria, and stakeholder alignment'
    },
    sm: {
      role: 'Scrum Master & Agile Coach',
      style: 'Facilitative, process-focused, team-oriented, impediment-removing',
      identity: 'Enables team effectiveness through agile practices and continuous improvement',
      focus: 'Sprint facilitation, team health, process improvement, and impediment resolution'
    },
    analyst: {
      role: 'Senior Business Analyst & Requirements Engineer',
      style: 'Analytical, detail-oriented, stakeholder-focused, methodical',
      identity: 'Bridges business and technical domains through requirements elicitation and analysis',
      focus: 'Requirements gathering, stakeholder analysis, process modeling, and solution design'
    },
    architect: {
      role: 'Software Architect & Technical Design Authority',
      style: 'Strategic, pattern-focused, scalability-minded, standards-driven',
      identity: 'Defines technical direction through architecture decisions and design reviews',
      focus: 'System architecture, design patterns, technical decisions, and architectural reviews'
    },
    'ux-expert': {
      role: 'UX Research Specialist & User Advocate',
      style: 'User-centered, research-driven, empathetic, evidence-based',
      identity: 'Advocates for users through research, journey mapping, and experience design',
      focus: 'User research, journey mapping, usability testing, and experience optimization'
    },
    'ui-expert': {
      role: 'UI Design Specialist & Visual Design Authority',
      style: 'Visual-focused, systematic, brand-conscious, detail-oriented',
      identity: 'Creates compelling interfaces through design systems and visual specifications',
      focus: 'Design systems, UI specifications, visual consistency, and interaction design'
    },
  };
  // Handle both ui-expert and ui folder mapping
  if (agentId === 'ui') agentId = 'ui-expert';
  if (agentId === 'ux') agentId = 'ux-expert';

  const base = {
    role: 'Expert practitioner for this discipline',
    style: 'Concise, pragmatic, detail-oriented, solution-focused',
    identity: 'Operates via executable tasks and evidence-backed decisions',
    focus: 'Executing tasks with precision and minimal context overhead'
  };
  return { ...base, ...(overrides[agentId] || {}) };
}

function principlesFor(agentId) {
  const base = [
    'CRITICAL: Only load dependency files when explicitly executing a task; do not pre-load entire docs.',
    'CRITICAL: Follow task instructions exactly; they are executable workflows.',
    'MANDATORY: Tasks with elicit=true require user interaction; never skip elicitation.',
    'Numbered Options: Always present choices as numbered lists for easy selection.'
  ];

  const agentSpecific = {
    dev: [
      'CRITICAL: Do not begin development until a story is approved and ready.',
      'CRITICAL: Only update designated sections in story files as instructed by tasks.',
      'TESTING: All code changes require corresponding unit tests.',
      'VALIDATION: Run tests and quality checks before marking tasks complete.',
      'DOCUMENTATION: Update technical documentation for architectural changes.'
    ],
    qa: [
      'QUALITY GATES: Block releases that do not meet defined quality standards.',
      'RISK ASSESSMENT: Always evaluate potential impact before approving changes.',
      'TEST COVERAGE: Ensure comprehensive test coverage across all test levels.',
      'DEFECT TRACKING: Document and track all identified issues to resolution.'
    ],
    pm: [
      'DELIVERY FOCUS: Prioritize actions that directly impact sprint delivery.',
      'STAKEHOLDER COMMUNICATION: Keep stakeholders informed of progress and blockers.',
      'RESOURCE MANAGEMENT: Optimize team capacity and workload distribution.',
      'SCOPE CONTROL: Prevent scope creep through proper change management.'
    ],
    po: [
      'USER VALUE: Every story must deliver clear business or user value.',
      'ACCEPTANCE CRITERIA: All stories require clear, testable acceptance criteria.',
      'BACKLOG HEALTH: Maintain a well-groomed, prioritized product backlog.',
      'STAKEHOLDER ALIGNMENT: Ensure stories align with business objectives.'
    ],
    sm: [
      'TEAM EMPOWERMENT: Enable team self-organization and decision-making.',
      'IMPEDIMENT REMOVAL: Actively identify and resolve team blockers.',
      'PROCESS IMPROVEMENT: Continuously refine team practices and workflows.',
      'FACILITATION: Guide meetings and ceremonies for maximum effectiveness.'
    ],
    analyst: [
      'REQUIREMENTS CLARITY: Ensure all requirements are clear, complete, and testable.',
      'STAKEHOLDER ENGAGEMENT: Actively involve stakeholders in elicitation sessions.',
      'SOLUTION ALIGNMENT: Verify proposed solutions meet business needs.',
      'CHANGE IMPACT: Assess impact of changes on existing processes and systems.'
    ],
    architect: [
      'ARCHITECTURAL INTEGRITY: Maintain consistency with established architectural principles.',
      'SCALABILITY FOCUS: Design for future growth and changing requirements.',
      'TECHNICAL DEBT: Balance feature delivery with technical debt management.',
      'STANDARDS COMPLIANCE: Ensure all designs adhere to enterprise standards.'
    ],
    'ux-expert': [
      'USER ADVOCACY: Always prioritize user needs and experience quality.',
      'RESEARCH-DRIVEN: Base decisions on user research and behavioral data.',
      'ACCESSIBILITY: Ensure designs are accessible to all users.',
      'USABILITY TESTING: Validate designs through user testing and feedback.'
    ],
    'ui-expert': [
      'DESIGN CONSISTENCY: Maintain visual consistency across all interfaces.',
      'DESIGN SYSTEM: Leverage and contribute to the established design system.',
      'RESPONSIVE DESIGN: Ensure designs work across all device types and sizes.',
      'VISUAL HIERARCHY: Create clear information hierarchy and user flow.'
    ]
  };

  // Handle both ui-expert and ui folder mapping  
  if (agentId === 'ui') agentId = 'ui-expert';
  if (agentId === 'ux') agentId = 'ux-expert';

  return [...base, ...(agentSpecific[agentId] || [])];
}

function commandsFor(agentId) {
  const cmds = [
    { help: 'Show numbered list of commands to select from' },
    { explain: 'Explain in detail what and why you did the last action' },
    { exit: 'Say goodbye and exit this persona' },
  ];

  const agentSpecific = {
    dev: [
      {
        'develop-story': [
          'order-of-execution: "Read (first or next) task→Implement→Write tests→Validate→Mark complete"',
          'blocking: "HALT for missing deps, ambiguity, repeated failures, or failing regression"',
          'ready-for-review: "All validations pass and standards met"',
          'completion: "All tasks checked, tests/regression pass, update file list and DoD checklist"'
        ]
      },
      { 'run-tests': 'Execute unit tests and integration tests for current work' },
      { 'quality-check': 'Run code quality analysis and resolve issues' }
    ],
    qa: [
      { 'test-story': 'Design and execute comprehensive tests for a story' },
      { 'quality-gate': 'Evaluate if story meets quality standards for release' },
      { 'risk-assess': 'Analyze potential risks and impacts of changes' }
    ],
    pm: [
      { 'sync-backlog': 'Synchronize and update project backlog from Jira' },
      { 'create-prd': 'Create or update PRD based on templates and config' },
      { 'track-progress': 'Review and report on sprint progress' },
      { 'plan-sprint': 'Plan upcoming sprint capacity and commitments' }
    ],
    po: [
      { 'groom-backlog': 'Review and refine backlog items for upcoming sprints' },
      { 'create-epic': 'Create an epic from a Confluence page (with save-to-docs)' },
      { 'create-stories': 'Generate stories from an epic (with Jira fallback)' },
      { 'create-tasks': 'Generate implementation tasks for a story' },
      { 'create-story': 'Create new user story with acceptance criteria' },
      { 'create-prd': 'Create or update PRD based on templates and config' },
      { 'prioritize': 'Re-prioritize backlog based on business value' }
    ],
    sm: [
      { 'facilitate-standup': 'Generate standup digest and facilitate meeting' },
      { 'remove-impediment': 'Identify and resolve team blockers' },
      { 'improve-process': 'Suggest process improvements based on team feedback' }
    ],
    analyst: [
      { 'elicit-requirements': 'Conduct requirements gathering session' },
      { 'analyze-process': 'Analyze current state process and identify improvements' },
      { 'research-market': 'Conduct market research using available data sources' }
    ],
    architect: [
      { 'review-architecture': 'Conduct architecture review of code or design' },
      { 'design-solution': 'Create architectural solution for business requirements' },
      { 'create-architecture-doc': 'Create or update architecture documentation per config' },
      { 'document-decisions': 'Document architectural decisions and rationale' }
    ],
    'ux-expert': [
      { 'research-users': 'Conduct user research and analysis' },
      { 'map-journey': 'Create user journey maps and experience flows' },
      { 'test-usability': 'Design and conduct usability testing sessions' }
    ],
    'ui-expert': [
      { 'audit-design': 'Audit design system compliance and consistency' },
      { 'create-specs': 'Create detailed UI specifications from designs' },
      { 'review-interface': 'Review interface design for usability and standards' }
    ]
  };

  // Handle both ui-expert and ui folder mapping
  if (agentId === 'ui') agentId = 'ui-expert';
  if (agentId === 'ux') agentId = 'ux-expert';

  return [...cmds, ...(agentSpecific[agentId] || [])];
}

function generateStructuredChatmode({ agentId, agentMeta, agentMd, tools, tasks, checklists }) {
  // Enhanced Copilot-focused structured chat mode inspired by BMAD approach
  const title = agentMeta.title || toTitleCase(agentId);
  const description = agentMeta.whenToUse || `Use for ${title} responsibilities and workflows.`;

  // Collect tools (dedupe) including MCP tool names so Copilot can expose them when available
  const agentMcpTools = mcpToolsForAgent(agentId);
  // Add browser built-in tools for automation-tester only
  const browserTools = agentId === 'automation-tester' ? [
    'browser/openBrowserPage', 'browser/readPage', 'browser/screenshotPage',
    'browser/navigatePage', 'browser/clickElement', 'browser/dragElement',
    'browser/hoverElement', 'browser/typeInPage', 'browser/runPlaywrightCode',
    'browser/handleDialog'
  ] : [];
  const toolList = Array.from(new Set([...baseTools(), ...tools, ...agentMcpTools, ...browserTools])).sort();

  // Front matter: include name & title (BMAD style adds more semantic cues). Copilot currently
  // keyes on description/tools; adding name/title is future-proof and clarifies mode list.
  const fm = [
    '---',
    `name: ${agentId}`,
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `tools: ${JSON.stringify(toolList)}`,
    'version: 1',
    '---',
    ''
  ].join('\n');

  const metaName = agentMeta.name || title;
  const person = { ...personaFor(agentId), ...(agentMeta.persona || {}) };
  const combinedPrinciples = (agentMeta.corePrinciples && agentMeta.corePrinciples.length)
    ? agentMeta.corePrinciples
    : principlesFor(agentId);
  const deps = relevantDependencies(agentId);
  const allChecklists = Array.from(new Set([...(deps.checklists || []), ...(checklists || [])])).sort();

  // Build the core SYSTEM directives first (outside YAML code fence) so Copilot treats it as high-priority.
  const out = [];
  out.push(`# ${title} (Agent Mode)`);
  out.push('');
  out.push('SYSTEM DIRECTIVES: You are activating a specialized software delivery role. Adopt the exact persona, principles, and constrained command workflow defined below. Do not revert to a generic assistant unless explicitly told to exit this mode. Always announce uncertainties, request clarifications for ambiguous tasks, and prefer incremental, testable outputs.');
  out.push('');
  out.push('Use *help at any time to list commands. Commands ALWAYS start with * (asterisk).');
  out.push('');
  out.push('---');
  out.push('## COMPLETE AGENT DEFINITION (YAML)');
  out.push('```yaml');
  out.push('activation-instructions:');
  out.push('  - Read this entire file BEFORE responding.');
  out.push('  - Adopt persona + principles immediately.');
  out.push('  - Greet user with your role + offer *help.');
  out.push('  - Only load dependency file content from APPENDIX when executing a specific command/task referencing it.');
  out.push('  - For multi-step work: Plan → Ask clarifying questions (if needed) → Execute iteratively.');
  out.push('agent:');
  out.push(`  id: ${agentId}`);
  out.push(`  name: ${metaName}`);
  out.push(`  title: ${title}`);
  out.push(`  icon: ${agentIcon(agentId)}`);
  out.push(`  whenToUse: ${JSON.stringify(description)}`);
  out.push('persona:');
  out.push(`  role: ${person.role}`);
  out.push(`  style: ${person.style}`);
  out.push(`  identity: ${person.identity}`);
  out.push(`  focus: ${person.focus}`);
  out.push('core_principles:');
  for (const p of combinedPrinciples) out.push(`  - ${p}`);
  out.push('commands:');
  for (const c of commandsFor(agentId)) {
    const key = Object.keys(c)[0];
    const val = c[key];
    if (Array.isArray(val)) {
      out.push(`  - ${key}:`);
      for (const el of val) out.push(`      - ${el}`);
    } else {
      out.push(`  - ${key}: ${val}`);
    }
  }
  out.push('dependencies:');
  if (tasks.length) {
    out.push('  tasks:');
    for (const t of tasks) out.push(`    - ${t}`);
  }
  if (deps.templates.length) {
    out.push('  templates:');
    for (const t of deps.templates) out.push(`    - ${t}`);
  }
  if (allChecklists.length) {
    out.push('  checklists:');
    for (const c of allChecklists) out.push(`    - ${c}`);
  }
  if (deps.data.length) {
    out.push('  data:');
    for (const d of deps.data) out.push(`    - ${d}`);
  }
  out.push('```');
  out.push('');
  out.push('---');
  out.push('## RUNTIME BEHAVIOR');
  out.push('- Always reflect briefly before large actions.');
  out.push('- When using a command that maps to a task file, load only that task content (from appendix) and follow it verbatim.');
  out.push('- If user asks for something outside your scope, explain limitation and suggest appropriate agent (if known).');
  out.push('');
  out.push('## COMMAND → DEPENDENCY RESOLUTION EXAMPLES');
  out.push('These are illustrative; match flexibly:');
  out.push('- "draft story" → tasks/create-next-story.md or tasks/create-jira-story-from-text.md');
  out.push('- "architecture doc" → templates/architecture-tmpl.yaml');
  out.push('- "front-end spec" → templates/front-end-spec-tmpl.yaml');
  out.push('');
  out.push('## APPENDIX: ORIGINAL AGENT SOURCE (REFERENCE ONLY)');
  out.push('<agent-source>');
  out.push(agentMd.trim());
  out.push('</agent-source>');

  // NOTE: We intentionally do NOT inline every dependency file to keep prompt weight lean.
  // Copilot can open referenced files from the workspace (.aigile-core) when needed.

  return fm + out.join('\n');
}

/**
 * Generate a custom agent file (.agent.md) for the new GitHub Copilot custom agents format
 * See: https://code.visualstudio.com/docs/copilot/customization/custom-agents
 */
function canonicalAgentId(id) {
  if (id === 'ui') return 'ui-expert';
  if (id === 'ux') return 'ux-expert';
  return id;
}

// --- Custom Agent tools frontmatter (new VS Code + Copilot format) ---------
// Canonical granular sub-tools per top-level namespace, derived from the
// reference custom-agent example. Keep this list authoritative — input tool
// names are normalized into namespaces and the bracketed second line is
// emitted from these canonical sets.
const NAMESPACE_GRANULAR_TOOLS = {
  vscode: [
    'vscode/extensions',
    'vscode/askQuestions',
    'vscode/memory',
    'vscode/newWorkspace',
    'vscode/runCommand',
    'vscode/switchAgent',
    'vscode/vscodeAPI',
  ],
  execute: [
    'execute/getTerminalOutput',
    'execute/killTerminal',
    'execute/createAndRunTask',
    'execute/runInTerminal',
    'execute/runNotebookCell',
  ],
  read: [
    'read/terminalSelection',
    'read/terminalLastCommand',
    'read/getNotebookSummary',
    'read/problems',
    'read/readFile',
  ],
  agent: ['agent/runSubagent'],
  browser: [], // no granular sub-tools known; only top-level namespace is emitted
  edit: [
    'edit/createDirectory',
    'edit/createFile',
    'edit/createJupyterNotebook',
    'edit/editFiles',
    'edit/editNotebook',
  ],
  search: [
    'search/changes',
    'search/codebase',
    'search/fileSearch',
    'search/listDirectory',
    'search/textSearch',
    'search/searchSubagent',
  ],
  web: ['web/fetch'],
  todo: ['todo'],
};

// Stable order of top-level namespaces on the inline `tools:` line. MCP entries
// (any qualified name not in this set) are inserted between `browser` and `edit`
// to match the reference example.
const NAMESPACE_ORDER = ['vscode', 'execute', 'read', 'agent', 'browser', 'edit', 'search', 'web', 'todo'];
const KNOWN_NAMESPACES = new Set(NAMESPACE_ORDER);

// Legacy short tool names (used in source agent YAML) that map to a namespace.
const SHORT_NAME_TO_NAMESPACE = {
  askQuestions: 'vscode',
};

/**
 * Format a tool list into the new two-line custom-agent frontmatter format:
 *   tools:vscode, execute, read, agent, browser, 'org/server/*', edit, search, web, todo
 *   [vscode/extensions, vscode/askQuestions, ..., todo]
 *
 * - Top-level line lists deduplicated namespaces in canonical order plus any
 *   MCP entries (anything containing `/` whose prefix is not a known namespace),
 *   single-quoted and inserted between `browser` and `edit`.
 * - Bracketed line enumerates the canonical granular sub-tools for each
 *   namespace present (MCP entries are NOT expanded).
 */
function formatToolsFrontmatter(toolList) {
  const namespaces = new Set();
  const mcpEntries = [];
  const seenMcp = new Set();

  for (const raw of Array.isArray(toolList) ? toolList : [toolList]) {
    const t = String(raw || '').trim();
    if (!t) continue;
    if (t.includes('/')) {
      const ns = t.split('/')[0];
      if (KNOWN_NAMESPACES.has(ns)) {
        namespaces.add(ns);
      } else if (!seenMcp.has(t)) {
        seenMcp.add(t);
        mcpEntries.push(`'${t}'`);
      }
    } else if (KNOWN_NAMESPACES.has(t)) {
      namespaces.add(t);
    } else if (SHORT_NAME_TO_NAMESPACE[t]) {
      namespaces.add(SHORT_NAME_TO_NAMESPACE[t]);
    }
    // Unknown bare names are silently dropped — only known namespaces or
    // qualified MCP entries are emitted.
  }

  // Wildcard dedup: if `<ns>/*` is present for an MCP namespace, drop sibling
  // explicit `<ns>/<specific>` entries (already granted by the wildcard).
  // Only applies within the SAME namespace and only to MCP entries (the
  // bracketed granular line for KNOWN_NAMESPACES is untouched).
  const wildcardMcpNs = new Set();
  for (const e of mcpEntries) {
    const inner = e.slice(1, -1); // strip surrounding single quotes
    const slash = inner.indexOf('/');
    if (slash !== -1 && inner.slice(slash + 1) === '*') {
      wildcardMcpNs.add(inner.slice(0, slash));
    }
  }
  const dedupedMcpEntries = mcpEntries.filter((e) => {
    const inner = e.slice(1, -1);
    const slash = inner.indexOf('/');
    if (slash === -1) return true;
    const ns = inner.slice(0, slash);
    const rest = inner.slice(slash + 1);
    if (rest === '*') return true; // keep the wildcard itself
    return !wildcardMcpNs.has(ns);
  });

  const topLevel = [];
  let mcpInserted = false;
  for (const ns of NAMESPACE_ORDER) {
    if (ns === 'edit' && dedupedMcpEntries.length && !mcpInserted) {
      topLevel.push(...dedupedMcpEntries);
      mcpInserted = true;
    }
    if (namespaces.has(ns)) topLevel.push(ns);
  }
  if (dedupedMcpEntries.length && !mcpInserted) topLevel.push(...dedupedMcpEntries);

  const granular = [];
  for (const ns of NAMESPACE_ORDER) {
    if (!namespaces.has(ns)) continue;
    granular.push(...NAMESPACE_GRANULAR_TOOLS[ns]);
  }

  return `tools:${topLevel.join(', ')}\n[${granular.join(', ')}]`;
}

/**
 * Rewrite the `tools:` block of an agent markdown file's YAML frontmatter to
 * the new two-line format. Used for the verbatim-copy path (orchestrators)
 * where the rest of the frontmatter must be preserved exactly.
 */
function rewriteAgentFrontmatterTools(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return content;
  const fm = fmMatch[1];
  // Match `tools:` followed by an indented `- item` YAML list block.
  const toolsBlockRe = /^tools:[ \t]*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/m;
  const toolsMatch = fm.match(toolsBlockRe);
  if (!toolsMatch) return content;
  const items = toolsMatch[1]
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  const replacement = formatToolsFrontmatter(items) + '\n';
  const newFm = fm.replace(toolsMatch[0], replacement);
  return content.replace(fmMatch[0], `---\n${newFm}\n---`);
}

function generateCustomAgent({ agentId, agentMeta, agentMd, tools, tasks, checklists }) {
  const title = agentMeta.title || agentMeta.agentRole || toTitleCase(agentId);
  const description = agentMeta.whenToUse || `Use for ${title} responsibilities and workflows.`;
  const metaName = agentMeta.name || title;

  // Full tool list for all agents (except orchestrator)
  // Uses VS Code prefix/toolName format and MCP wildcards
  const FULL_AGENT_TOOLS = [
    // vscode tools
    'vscode/extensions', 'vscode/getProjectSetupInfo', 'vscode/installExtension',
    'vscode/newWorkspace', 'vscode/openSimpleBrowser', 'vscode/runCommand', 'vscode/vscodeAPI',
    // execute tools
    'execute/getTerminalOutput', 'execute/runTask', 'execute/createAndRunTask',
    'execute/runInTerminal', 'execute/runNotebookCell', 'execute/testFailure', 'execute/runTests',
    // read tools
    'read/terminalSelection', 'read/terminalLastCommand', 'read/getTaskOutput',
    'read/getNotebookSummary', 'read/problems', 'read/readFile', 'read/readNotebookCellOutput',
    // agent tools
    'agent/runSubagent',
    // edit tools
    'edit/createDirectory', 'edit/createFile', 'edit/createJupyterNotebook',
    'edit/editFiles', 'edit/editNotebook',
    // search tools
    'search/changes', 'search/codebase', 'search/fileSearch', 'search/listDirectory',
    'search/searchResults', 'search/textSearch', 'search/usages',
    // web tools
    'web/fetch', 'web/githubRepo',
    // other built-in
    'todo',
    // MCP servers (wildcard includes all tools from each server)
    'atlassian/*',
    'context7/*',
    'sequentialthinking/*',
    'github.com/*',
    'github.vscode-pull-request-github/*'
  ];

  // Browser built-in tools scoped to automation-tester only
  const BROWSER_TOOLS = [
    'browser/openBrowserPage', 'browser/readPage', 'browser/screenshotPage',
    'browser/navigatePage', 'browser/clickElement', 'browser/dragElement',
    'browser/hoverElement', 'browser/typeInPage', 'browser/runPlaywrightCode',
    'browser/handleDialog'
  ];

  // Use full tool list for all agents except orchestrator
  const agentSpecificTools = agentId === 'automation-tester' ? BROWSER_TOOLS : [];
  // Merge any explicit MCP allow-lists declared in the source agent YAML under
  // `mcp-tools.<server>-allow:` (e.g. figma-allow) into the resolved tool list.
  const mcpAllowExtras = extractMcpAllowLists(agentMd || '');
  const toolList = agentId === 'aigile-orchestrator' 
    ? ['read/readFile', 'agent', 'search/codebase', 'search/fileSearch', 'search/textSearch', 'search/listDirectory', 'sequentialthinking/*'] 
    : [...new Set([...FULL_AGENT_TOOLS, ...agentSpecificTools, ...tools, ...mcpAllowExtras])].sort();
  // Generate handoffs based on agent role
  const handoffs = generateHandoffsFor(agentId);

  // Build YAML frontmatter in new custom agents format
  const fmLines = [
    '---',
    `name: ${title}`,
    `description: "${description}"`,
    `argument-hint: "Describe your ${agentId} task"`,
    formatToolsFrontmatter(toolList)
  ];
  fmLines.push('model: Claude Opus 4.6');
  fmLines.push('user-invokable: true');

  if (handoffs.length > 0) {
    fmLines.push('handoffs:');
    for (const h of handoffs) {
      fmLines.push(`  - label: "${h.label}"`);
      fmLines.push(`    agent: ${h.agent}`);
      fmLines.push(`    prompt: "${h.prompt}"`);
      fmLines.push(`    send: ${h.send}`);
    }
  }
  fmLines.push('---');
  fmLines.push('');

  // Build the agent body
  const person = { ...personaFor(agentId), ...(agentMeta.persona || {}) };
  const combinedPrinciples = (agentMeta.corePrinciples && agentMeta.corePrinciples.length)
    ? agentMeta.corePrinciples
    : principlesFor(agentId);
  const deps = relevantDependencies(agentId);

  const body = [];
  body.push(`# ${title}`);
  body.push('');
  body.push(`You are the **${title}** - a specialized AIgile framework agent.`);
  body.push('');
  body.push('## Core Identity');
  body.push('');
  body.push(`- **Role**: ${person.role}`);
  body.push(`- **Style**: ${person.style}`);
  body.push(`- **Focus**: ${person.focus}`);
  body.push('');
  body.push('## Operating Principles');
  body.push('');
  for (const p of combinedPrinciples) {
    body.push(`- ${p}`);
  }
  body.push('');
  const delegationTargets = [
    { id: 'dev', label: 'Full Stack Developer', specialty: 'Code implementation, debugging, TDD' },
    { id: 'architect', label: 'Architect', specialty: 'Architecture review, documentation' },
    { id: 'po', label: 'Product Owner', specialty: 'Story creation, backlog management' },
    { id: 'qa', label: 'Test Architect & Quality Advisor', specialty: 'Testing, quality gates' },
    { id: 'analyst', label: 'Business Analyst', specialty: 'Requirements analysis' },
    { id: 'pm', label: 'Product Manager', specialty: 'Project planning' },
    { id: 'sm', label: 'Scrum Master', specialty: 'Scrum facilitation, ceremonies' },
    { id: 'ui-expert', label: 'UI Expert', specialty: 'UI design, design systems' },
    { id: 'ux-expert', label: 'UX Expert', specialty: 'UX research, interaction flows' },
    { id: 'devops', label: 'DevOps Engineer', specialty: 'CI/CD, infrastructure, deployments' },
    { id: 'automation-tester', label: 'Automation Tester', specialty: 'E2E testing, Playwright, visual regression' },
    { id: 'security', label: 'Security Engineer', specialty: 'Security review, OWASP, threat modeling' },
  ];
  const canonicalId = canonicalAgentId(agentId);
  body.push('## Subagent Delegation');
  body.push('');
  body.push('Use `#tool:runSubagent` to delegate specialized tasks to other agents when appropriate:');
  body.push('');
  body.push('| Agent | Specialty |');
  body.push('|-------|-----------|');
  for (const t of delegationTargets) {
    if (t.id !== canonicalId) {
      body.push(`| \`${t.id}\` | ${t.specialty} |`);
    }
  }
  body.push('');
  if (tasks.length > 0) {
    body.push('## Available Tasks');
    body.push('');
    for (const t of tasks) {
      body.push(`- \`${t}\``);
    }
    body.push('');
  }

  if (deps.templates.length > 0) {
    body.push('## Templates');
    body.push('');
    body.push('Reference templates in `.aigile-core/templates/`:');
    body.push('');
    for (const t of deps.templates) {
      body.push(`- ${t}`);
    }
    body.push('');
  }

  body.push('## Original Agent Definition');
  body.push('');
  body.push('<details>');
  body.push('<summary>Expand for full agent configuration</summary>');
  body.push('');
  body.push(agentMd.trim());
  body.push('');
  body.push('</details>');

  return fmLines.join('\n') + body.join('\n');
}

/**
 * Generate handoff buttons for a given agent
 */
function generateHandoffsFor(agentId) {
  const handoffMappings = {
    'aigile-orchestrator': [
      { label: '🏗️ Architecture Review', agent: 'Architect', prompt: 'Analyze the architecture and provide recommendations.', send: false },
      { label: '💻 Start Implementation', agent: 'Full Stack Developer', prompt: 'Implement the plan using test-driven development.', send: false },
      { label: '🧪 Run QA Gate', agent: 'Test Architect & Quality Advisor', prompt: 'Review and test the implementation for quality.', send: false },
      { label: '📋 Refine Backlog', agent: 'Product Owner', prompt: 'Refine the backlog items based on discussion.', send: false },
      { label: '🚀 Delegate DevOps', agent: 'DevOps Engineer', prompt: 'Handle CI/CD, infrastructure, containerization, and deployment tasks.', send: false },
      { label: '🤖 Delegate Automated Testing', agent: 'Automation Tester', prompt: 'Execute end-to-end browser tests, visual regression, and cross-browser validation.', send: false },
      { label: '🔒 Delegate Security Review', agent: 'Security Engineer', prompt: 'Perform security assessment, vulnerability scanning, and threat modeling.', send: false },
    ],
    dev: [
      { label: '🧪 Request QA Review', agent: 'Test Architect & Quality Advisor', prompt: 'Review the implementation above for quality.', send: false },
      { label: '🏗️ Architecture Check', agent: 'Architect', prompt: 'Verify architecture compliance.', send: false },
    ],
    architect: [
      { label: '💻 Start Implementation', agent: 'Full Stack Developer', prompt: 'Implement the architecture recommendations.', send: false },
      { label: '📋 Create Stories', agent: 'Product Owner', prompt: 'Create backlog items for architecture changes.', send: false },
    ],
    po: [
      { label: '💻 Implement Story', agent: 'Full Stack Developer', prompt: 'Implement the story defined above.', send: false },
      { label: '🧠 Analyze Further', agent: 'Business Analyst', prompt: 'Provide deeper analysis of requirements.', send: false },
    ],
    qa: [
      { label: '💻 Fix Issues', agent: 'Full Stack Developer', prompt: 'Fix the issues identified in QA review.', send: false },
      { label: '📋 Update Stories', agent: 'Product Owner', prompt: 'Update stories based on QA findings.', send: false },
    ],
    analyst: [
      { label: '📋 Create Stories', agent: 'Product Owner', prompt: 'Create stories from analysis findings.', send: false },
      { label: '🏗️ Architecture Review', agent: 'Architect', prompt: 'Review architecture implications.', send: false },
    ],
    pm: [
      { label: '📋 Refine Stories', agent: 'Product Owner', prompt: 'Refine the stories in the plan.', send: false },
    ],
    sm: [],
    'ui-expert': [
      { label: '💻 Implement UI', agent: 'Full Stack Developer', prompt: 'Implement the UI specifications.', send: false },
    ],
    'ux-expert': [
      { label: '🖌️ Design System', agent: 'UI Expert', prompt: 'Create design system components.', send: false },
      { label: '💻 Implement UX', agent: 'Full Stack Developer', prompt: 'Implement the UX recommendations.', send: false },
    ],
    devops: [
      { label: '💻 Dev Implementation', agent: 'Full Stack Developer', prompt: 'Implement the application code changes needed for this infrastructure work.', send: false },
      { label: '🏗️ Architecture Review', agent: 'Architect', prompt: 'Review the infrastructure architecture for scalability and design issues.', send: false },
      { label: '🔒 Security Review', agent: 'Security Engineer', prompt: 'Review infrastructure and deployment configuration for security issues.', send: false },
    ],
    'automation-tester': [
      { label: '💻 Fix Implementation', agent: 'Full Stack Developer', prompt: 'Fix the bugs found during testing with reproduction steps and evidence.', send: false },
      { label: '🧪 QA Strategy', agent: 'Test Architect & Quality Advisor', prompt: 'Review the test strategy and coverage for missing scenarios.', send: false },
      { label: '✨ UX Validation', agent: 'UX Expert', prompt: 'Validate UX findings from testing.', send: false },
    ],
    security: [
      { label: '💻 Fix Vulnerability', agent: 'Full Stack Developer', prompt: 'Fix the security vulnerabilities found with severity and remediation steps.', send: false },
      { label: '🏗️ Architecture Security', agent: 'Architect', prompt: 'Review the security architecture for concerns needing architectural changes.', send: false },
      { label: '🚀 Infra Security', agent: 'DevOps Engineer', prompt: 'Fix infrastructure security issues and hardening recommendations.', send: false },
      { label: '🧪 Security Testing', agent: 'Test Architect & Quality Advisor', prompt: 'Create security test cases for vulnerabilities found.', send: false },
    ],
  };

  return handoffMappings[agentId] || [];
}

// ---------------------------------------------------------------------------
// Antigravity / Gemini CLI generation
// ---------------------------------------------------------------------------

/**
 * Generate an Antigravity-compatible rules file for an agent.
 * Antigravity uses plain markdown rules in .agent/rules/ — no YAML frontmatter,
 * no tools declarations, no handoffs (handled differently in Antigravity).
 */
function generateAntigravityAgent({ agentId, agentMeta, agentMd, tools, tasks, checklists }) {
  const title = agentMeta.title || toTitleCase(agentId);
  const description = agentMeta.whenToUse || `Use for ${title} responsibilities and workflows.`;
  const person = { ...personaFor(agentId), ...(agentMeta.persona || {}) };
  const combinedPrinciples = (agentMeta.corePrinciples && agentMeta.corePrinciples.length)
    ? agentMeta.corePrinciples
    : principlesFor(agentId);
  const deps = relevantDependencies(agentId);

  const lines = [];
  lines.push(`# ${title} — AIgile Agent Rule`);
  lines.push('');
  lines.push(`> ${description}`);
  lines.push('');
  lines.push('## Core Identity');
  lines.push('');
  lines.push(`- **Role**: ${person.role}`);
  lines.push(`- **Style**: ${person.style}`);
  lines.push(`- **Focus**: ${person.focus}`);
  lines.push('');
  lines.push('## Operating Principles');
  lines.push('');
  for (const p of combinedPrinciples) {
    lines.push(`- ${p}`);
  }
  lines.push('');

  // Agent coordination guidance (replaces Copilot handoffs/runSubagent)
  lines.push('## Agent Coordination');
  lines.push('');
  lines.push('This agent is part of the AIgile framework. Other specialist agents are available:');
  lines.push('');
  lines.push('| Agent | Specialty |');
  lines.push('|-------|-----------|');
  lines.push('| `dev` | Code implementation, debugging, TDD |');
  lines.push('| `architect` | Architecture review, documentation |');
  lines.push('| `po` | Story creation, backlog management |');
  lines.push('| `qa` | Testing, quality gates |');
  lines.push('| `analyst` | Requirements analysis |');
  lines.push('| `pm` | Project planning |');
  lines.push('');

  if (tasks.length > 0) {
    lines.push('## Available Tasks');
    lines.push('');
    lines.push('Task files are located in `.aigile-core/tasks/`. Load and follow them exactly when executing a command:');
    lines.push('');
    for (const t of tasks) {
      lines.push(`- \`${t}\``);
    }
    lines.push('');
  }

  if (deps.templates.length > 0) {
    lines.push('## Templates');
    lines.push('');
    lines.push('Reference templates in `.aigile-core/templates/`:');
    lines.push('');
    for (const t of deps.templates) {
      lines.push(`- ${t}`);
    }
    lines.push('');
  }

  if (deps.data.length > 0) {
    lines.push('## Data References');
    lines.push('');
    lines.push('Reference data files in `.aigile-core/data/`:');
    lines.push('');
    for (const d of deps.data) {
      lines.push(`- ${d}`);
    }
    lines.push('');
  }

  lines.push('## Original Agent Definition');
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Expand for full agent configuration</summary>');
  lines.push('');
  lines.push(agentMd.trim());
  lines.push('');
  lines.push('</details>');

  return lines.join('\n');
}

/**
 * Generate Antigravity workflow files from an agent's commands.
 * Each workflow is a .md file with YAML frontmatter (description) and step instructions.
 * Returns an array of { filename, content } objects.
 */
function generateAntigravityWorkflows(agentId) {
  const commands = commandsFor(agentId);
  const workflows = [];

  for (const cmd of commands) {
    const key = Object.keys(cmd)[0];
    const val = cmd[key];
    // Skip meta commands
    if (key === 'help' || key === 'exit') continue;

    const slug = `aigile-${agentId}-${key}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    const wfLines = [];
    wfLines.push('---');
    wfLines.push(`description: ${typeof val === 'string' ? val : `AIgile ${agentId}: ${key}`}`);
    wfLines.push('---');
    wfLines.push('');
    wfLines.push(`# ${toTitleCase(key)}`);
    wfLines.push('');
    wfLines.push(`This workflow is part of the **${toTitleCase(agentId)}** agent in the AIgile framework.`);
    wfLines.push('');

    if (Array.isArray(val)) {
      wfLines.push('## Steps');
      wfLines.push('');
      let step = 1;
      for (const el of val) {
        wfLines.push(`${step}. ${el}`);
        step++;
      }
    } else if (typeof val === 'string') {
      wfLines.push(`**Goal:** ${val}`);
    } else {
      wfLines.push(`**Goal:** Execute the ${key} command.`);
    }

    wfLines.push('');
    wfLines.push('## Resources');
    wfLines.push('');
    wfLines.push('- Agent definition: `.aigile-core/agents/`');
    wfLines.push('- Task files: `.aigile-core/tasks/`');
    wfLines.push('- Templates: `.aigile-core/templates/`');
    wfLines.push('');

    workflows.push({ filename: `${slug}.md`, content: wfLines.join('\n') });
  }

  return workflows;
}

/**
 * Generate the GEMINI.md project-level instructions file for Antigravity.
 */
function generateGeminiMd(agentIds) {
  const lines = [];
  lines.push('# AIgile Development Method');
  lines.push('');
  lines.push('This project uses the **AIgile Development Method** — a pragmatic, agent-driven agile framework.');
  lines.push('');
  lines.push('## Agent Rules');
  lines.push('');
  lines.push('Specialist agent personas are defined in `.agent/rules/`. Each rule file defines a role with specific');
  lines.push('expertise, operating principles, and task references. When asked to assume a role, load the corresponding');
  lines.push('rule file from `.agent/rules/`.');
  lines.push('');
  lines.push('### Available Agents');
  lines.push('');
  lines.push('| Agent | File | Specialty |');
  lines.push('|-------|------|-----------|');
  for (const id of agentIds) {
    const title = toTitleCase(id);
    const icon = agentIcon(id);
    lines.push(`| ${icon} ${title} | \`.agent/rules/${id}.md\` | ${title} responsibilities |`);
  }
  lines.push('');
  lines.push('## Workflows');
  lines.push('');
  lines.push('On-demand workflows are available in `.agent/workflows/`. Use them as slash commands');
  lines.push('to trigger specific development activities (e.g., create stories, run QA gate, brainstorm).');
  lines.push('');
  lines.push('## Core Assets');
  lines.push('');
  lines.push('The `.aigile-core/` directory contains all framework resources:');
  lines.push('');
  lines.push('- **`tasks/`** — Executable task instructions (follow them exactly)');
  lines.push('- **`templates/`** — Output templates (YAML-based)');
  lines.push('- **`checklists/`** — Quality and process checklists');
  lines.push('- **`data/`** — Reference data (brainstorming techniques, test frameworks, etc.)');
  lines.push('- **`core-config.yaml`** — Project paths and preferences');
  lines.push('');
  lines.push('## Key Principles');
  lines.push('');
  lines.push('- Tasks are executable instructions; follow them exactly.');
  lines.push('- Elicitation steps are mandatory; always ask for missing inputs.');
  lines.push('- Save artifacts under `docs/` for traceability.');
  lines.push('- Prefer small, safe, testable changes.');
  lines.push('');
  return lines.join('\n');
}

/**
 * Install AIgile for Google Antigravity / Gemini CLI.
 * Creates .agent/rules/, .agent/workflows/, and GEMINI.md.
 */
function installAntigravity(dest) {
  // 1) Copy core to .aigile-core (shared with Copilot path)
  const srcCore = path.join(root, 'core');
  const dstCore = path.join(dest, '.aigile-core');
  if (fs.existsSync(srcCore)) {
    copyDir(srcCore, dstCore);
  }

  // 2) Generate agent rules in .agent/rules/
  const agentsDir = path.join(srcCore, 'agents');
  const rulesDir = path.join(dest, '.agent', 'rules');
  const workflowsDir = path.join(dest, '.agent', 'workflows');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.mkdirSync(workflowsDir, { recursive: true });

  const generatedRules = [];
  const allAgentIds = [];

  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    const agentMap = new Map(); // id -> filename

    // First pass: identify all agents and prioritize source format (.md) over native (.agent.md)
    for (const f of files) {
      const isNativeAgent = f.endsWith('.agent.md');
      const agentId = isNativeAgent ? f.replace(/\.agent\.md$/, '') : f.replace(/\.[^/.]+$/, '');

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, f);
      } else {
        // If we already have an entry, override ONLY if current file is source format (and previous was native)
        const currentIsSource = !isNativeAgent;
        const existingIsNative = agentMap.get(agentId).endsWith('.agent.md');
        if (currentIsSource && existingIsNative) {
          agentMap.set(agentId, f);
        }
      }
    }

    // Sort by agentId for consistent output
    const sortedIds = Array.from(agentMap.keys()).sort();

    for (const agentId of sortedIds) {
      const f = agentMap.get(agentId);
      const agentPath = path.join(agentsDir, f);
      const agentMd = read(agentPath);
      const agentMeta = extractAgentMeta(agentMd);
      const allTasks = listTasksForAgent(agentId);

      allAgentIds.push(agentId);

      // Generate Antigravity rule file
      const ruleContent = generateAntigravityAgent({
        agentId,
        agentMeta,
        agentMd,
        tools: [],
        tasks: allTasks,
        checklists: [],
      });
      write(path.join(rulesDir, `${agentId}.md`), ruleContent);
      generatedRules.push(agentId);

      // Generate workflows for this agent
      const workflows = generateAntigravityWorkflows(agentId);
      for (const wf of workflows) {
        write(path.join(workflowsDir, wf.filename), wf.content);
      }
    }
  }

  // 3) Generate GEMINI.md at project root
  const geminiMdContent = generateGeminiMd(allAgentIds);
  write(path.join(dest, 'GEMINI.md'), geminiMdContent);

  const color = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
  const green = color(32);
  console.log(`✅ Created ${generatedRules.length} agent rules in .agent/rules/`);
  const wfCount = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md')).length;
  console.log(`✅ Created ${wfCount} workflows in .agent/workflows/`);
  console.log(green('✅ Generated GEMINI.md'));
  console.log(green('✅ Installed AIgile for Google Antigravity into'), dest);

  return { rules: generatedRules.length, workflows: wfCount };
}

// ---------------------------------------------------------------------------
// Kiro (kiro.dev) support
// Kiro reads custom agents from `.kiro/agents/*.md` (markdown + YAML frontmatter)
// and persistent project context from `.kiro/steering/*.md`.
// Docs: https://kiro.dev/docs/custom-agents/ , https://kiro.dev/docs/steering/
// ---------------------------------------------------------------------------

/** Collapse arbitrary text into a safe single-line double-quoted YAML scalar. */
function yamlSingleLine(str) {
  return String(str || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/"/g, "'")
    .trim();
}

/**
 * Kiro tool categories for an agent.
 * Categories auto-expand as Kiro ships new tools: read | write | shell | web |
 * subagent | context | spec. MCP tools come in via `includeMcpJson`.
 */
function kiroToolsFor(agentId) {
  if (agentId === 'aigile-orchestrator' || agentId === 'aigile-manual-orchestrator') {
    // Orchestrators MUST be able to delegate. Kiro requires the `subagent` tool for that,
    // but that tag is newer than some builds — where it is unknown it is silently dropped,
    // leaving the orchestrator with no way to spawn subagents. `@builtin` grants every
    // built-in tool (including subagent delegation) on every build, so delegation always
    // works. Delegation-only discipline is enforced by the agent prompt instead of by the
    // tool list, and Kiro still asks before any write or shell call.
    return ['@builtin', 'subagent'];
  }
  return ['read', 'write', 'shell', 'web', 'context', 'subagent', 'spec', '@builtin'];
}

/**
 * Rewrite a source agent definition so it describes Kiro instead of VS Code / Copilot.
 * The source agents were authored for GitHub Copilot and name tools that do not exist in
 * Kiro (`vscode_askQuestions`, `runSubagent`, Copilot Chat TODOs, `.github/agents`, ...).
 * Leaving those names in the embedded appendix makes Kiro agents announce missing tools,
 * so they are translated to their Kiro equivalents.
 */
function kiroifyText(text) {
  let out = String(text || '');
  const replacements = [
    // Confirmation gate: Kiro has no askQuestions tool; the agent asks in chat instead.
    [/\bfresh `?vscode[_/]askQuestions`? answer/g, 'fresh confirmation answer'],
    [/`?vscode[_/]askQuestions`?/g, 'the confirmation question in chat'],
    [/`?\bmanage_todo_list\b`?/g, 'a task checklist'],
    [/`?\baskQuestions\b`?/g, 'the confirmation question in chat'],
    // Delegation: Kiro launches subagents instead of Copilot's runSubagent tool.
    [/#tool:runSubagent/g, 'subagent delegation'],
    [/#runSubagent/g, 'subagent delegation'],
    [/`?\brunSubagent\b`?/g, 'subagent delegation'],
    // Copilot chat / TODO features.
    [/GitHub Copilot Chat built-in TODOs/g, 'a task checklist in Kiro chat'],
    [/GitHub Copilot Chat TODOs/g, 'a task checklist in Kiro chat'],
    [/Copilot Chat TODOs/g, 'a task checklist in Kiro chat'],
    [/Copilot Chat/g, 'Kiro chat'],
    [/GitHub Copilot/g, 'Kiro'],
    [/\bCopilot\b/g, 'Kiro'],
    // Paths and file formats.
    [/\.github\/chatmodes/g, '.kiro/agents'],
    [/\.github\/agents/g, '.kiro/agents'],
    [/\bchatmodes\b/g, 'custom agents'],
    [/\bchatmode\b/g, 'custom agent'],
    // Remaining editor references.
    [/\bVS ?Code\b/gi, 'Kiro'],
    [/#tool:([A-Za-z0-9_.-]+)/g, 'the `$1` tool'],
    [/`?\bvscode_([A-Za-z0-9_]+)`?/g, 'the `$1` capability'],
  ];
  for (const [pattern, value] of replacements) out = out.replace(pattern, value);
  return out.trim();
}

function kiroifyAgentSource(md) {
  // Drop the Copilot custom-agent frontmatter (tools/handoffs/agents lists). The Kiro
  // frontmatter generated by this installer is the authoritative one.
  return kiroifyText(String(md || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''));
}

/**
 * Read `name` and `description` from a native `.agent.md` YAML frontmatter block.
 * Those agents have no fenced YAML block, so `extractAgentMeta` finds nothing for them.
 */
function extractFrontmatterMeta(md) {
  const meta = {};
  const m = String(md || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return meta;
  const fm = m[1];
  const name = fm.match(/^name\s*:\s*(.+)$/m);
  const description = fm.match(/^description\s*:\s*(.+)$/m);
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, '').trim();
  if (name) meta.title = unquote(name[1]);
  if (description) meta.description = unquote(description[1]);
  return meta;
}

/**
 * AIgile skills (installed into .kiro/skills/) that are most relevant to an agent.
 */
function kiroSkillsFor(agentId) {
  const map = {
    'aigile-orchestrator': ['aigile-orchestration', 'aigile-spec-bridge'],
    'aigile-manual-orchestrator': ['aigile-orchestration', 'aigile-spec-bridge'],
    'aigile-master': ['aigile-orchestration', 'aigile-story-delivery', 'aigile-quality-gate', 'aigile-spec-bridge'],
    dev: ['aigile-story-delivery', 'aigile-spec-bridge'],
    'expert-react-frontend-engineer': ['aigile-story-delivery'],
    qa: ['aigile-quality-gate', 'aigile-story-delivery'],
    'automation-tester': ['aigile-quality-gate'],
    security: ['aigile-quality-gate'],
    po: ['aigile-story-delivery', 'aigile-spec-bridge'],
    pm: ['aigile-orchestration', 'aigile-spec-bridge'],
    sm: ['aigile-orchestration'],
    analyst: ['aigile-spec-bridge'],
    architect: ['aigile-spec-bridge'],
    devops: ['aigile-quality-gate'],
  };
  return map[agentId] || [];
}

/**
 * Generate a Kiro custom agent file (.kiro/agents/<id>.md).
 */
function generateKiroAgent({ agentId, agentMeta, agentMd, tasks }) {
  const title = kiroifyText(agentMeta.title || agentMeta.agentRole || toTitleCase(agentId));
  const description = agentMeta.whenToUse || `Use for ${title} responsibilities and workflows.`;
  const person = { ...personaFor(agentId), ...(agentMeta.persona || {}) };
  const combinedPrinciples = (agentMeta.corePrinciples && agentMeta.corePrinciples.length)
    ? agentMeta.corePrinciples
    : principlesFor(agentId);
  const deps = relevantDependencies(agentId);
  const commands = commandsFor(agentId);
  const canonicalId = canonicalAgentId(agentId);

  const fm = [];
  fm.push('---');
  fm.push(`name: ${agentId}`);
  fm.push(`description: "${yamlSingleLine(kiroifyText(description))}"`);
  fm.push(`tools: [${kiroToolsFor(agentId).map(t => `"${t}"`).join(', ')}]`);
  fm.push('includeMcpJson: true');
  fm.push('---');
  fm.push('');

  const body = [];
  body.push(`# ${agentIcon(agentId)} ${title}`);
  body.push('');
  body.push(`You are the **${title}** — a specialized agent of the AIgile Development Method.`);
  body.push('');
  body.push('## Core Identity');
  body.push('');
  body.push(`- **Role**: ${person.role}`);
  body.push(`- **Style**: ${person.style}`);
  body.push(`- **Identity**: ${person.identity}`);
  body.push(`- **Focus**: ${person.focus}`);
  body.push('');
  body.push('Stay in this persona for the whole session. If the user asks for work that belongs to');
  body.push('another role, say so and suggest the matching AIgile agent.');
  body.push('');
  body.push('## Environment: Kiro');
  body.push('');
  body.push('You run inside **Kiro**. Use Kiro capabilities only. There is no VS Code, no GitHub Copilot,');
  body.push('and no Copilot tooling here — never tell the user a Copilot tool is unavailable, just use the');
  body.push('Kiro equivalent below and carry on.');
  body.push('');
  body.push('| Need | Use in Kiro |');
  body.push('|------|-------------|');
  body.push('| Ask the user to confirm or choose ("the confirmation question in chat") | Put the question and its numbered options directly in your reply, then stop and wait for the answer |');
  body.push('| Delegate to another role ("subagent delegation") | Run the matching agent from `.kiro/agents/` as a Kiro subagent |');
  body.push('| Persistent project context | Steering files in `.kiro/steering/` |');
  body.push('| Reusable procedures | Agent Skills in `.kiro/skills/` |');
  body.push('| Multi-step feature work | A Kiro spec session (`requirements` → `design` → `tasks`) |');
  body.push('| Event automation | Kiro hooks |');
  body.push('| External systems (Jira, GitHub, Figma, ...) | MCP servers from `.kiro/settings/mcp.json` |');
  body.push('| Track progress on a long task | A task checklist in your reply, or spec tasks |');
  body.push('');
  body.push('The appendix at the end of this file is the original cross-platform definition. Treat its');
  body.push('intent as authoritative and its tool names, `tools:` lists, and handoff blocks as historical —');
  body.push('they describe other IDEs. This section wins on any conflict.');
  body.push('');
  body.push('## Operating Principles');
  body.push('');
  for (const p of combinedPrinciples) body.push(`- ${p}`);
  body.push('');

  if (commands.length) {
    body.push('## Commands');
    body.push('');
    body.push('Users address you with `*command` (e.g. `*help`). Supported commands:');
    body.push('');
    for (const cmd of commands) {
      const key = Object.keys(cmd)[0];
      const val = cmd[key];
      if (Array.isArray(val)) {
        body.push(`- \`*${key}\``);
        for (const el of val) body.push(`  - ${el}`);
      } else {
        body.push(`- \`*${key}\` — ${val}`);
      }
    }
    body.push('');
  }

  // Kiro delegates work to subagents; custom agents in .kiro/agents are usable as subagents.
  const delegationTargets = [
    { id: 'dev', specialty: 'Code implementation, debugging, TDD' },
    { id: 'architect', specialty: 'Architecture review, documentation' },
    { id: 'po', specialty: 'Story creation, backlog management' },
    { id: 'qa', specialty: 'Testing, quality gates' },
    { id: 'analyst', specialty: 'Requirements analysis' },
    { id: 'pm', specialty: 'Project planning' },
    { id: 'sm', specialty: 'Scrum facilitation, ceremonies' },
    { id: 'ui-expert', specialty: 'UI design, design systems' },
    { id: 'ux-expert', specialty: 'UX research, interaction flows' },
    { id: 'devops', specialty: 'CI/CD, infrastructure, deployments' },
    { id: 'automation-tester', specialty: 'E2E testing, Playwright, visual regression' },
    { id: 'security', specialty: 'Security review, OWASP, threat modeling' },
  ];
  const isOrchestrator = agentId === 'aigile-orchestrator' || agentId === 'aigile-manual-orchestrator';
  body.push('## Subagent Delegation');
  body.push('');
  if (isOrchestrator) {
    body.push('Delegation is your primary capability. Your `tools` list includes `@builtin`, so the');
    body.push('subagent tool is always available to you — use it. Never claim you cannot delegate.');
    body.push('');
    body.push('You also technically hold editing and shell tools through `@builtin`. **Do not use them.**');
    body.push('You are delegation-only by design: read to understand, then delegate the work.');
    body.push('');
    if (agentId === 'aigile-manual-orchestrator') {
      body.push('- **Gate first.** Never spawn a subagent until the user has answered your confirmation');
      body.push('  question in chat for that specific delegation. Holding the `subagent` tool does not');
      body.push('  license you to use it unprompted — ask, wait, then dispatch what was approved.');
    }
    body.push('- Spawn an AIgile agent by name (for example the `qa` agent) and give it a self-contained brief:');
    body.push('  goal, target artifact, file paths, constraints, and definition of done. The subagent has its');
    body.push('  own context window and cannot see this conversation.');
    body.push('- Up to four subagents run at once. Parallelize independent briefs; sequence dependent ones.');
    body.push('- Each subagent returns a summary to you. Verify the artifact against the stated done');
    body.push('  criteria before continuing, and synthesize the results yourself.');
    body.push('- **If you cannot spawn subagents** (you were launched as a subagent yourself, so nested');
    body.push('  delegation is unavailable), do not start doing the work. Say so plainly and return the');
    body.push('  numbered briefs you would have dispatched, so the main agent or the user can run them.');
    body.push('  Tell the user that running you from the agent selector as the main agent restores delegation.');
    body.push('');
    body.push('Available specialists:');
    body.push('');
  } else {
    body.push('Delegate specialized work by asking Kiro to run the matching subagent');
    body.push('(e.g. "Use the `qa` subagent to design tests for this story"):');
    body.push('');
  }
  body.push('| Subagent | Specialty |');
  body.push('|----------|-----------|');
  for (const t of delegationTargets) {
    if (t.id !== canonicalId) body.push(`| \`${t.id}\` | ${t.specialty} |`);
  }
  body.push('');

  const relevantSkills = kiroSkillsFor(agentId);
  if (relevantSkills.length) {
    body.push('## Skills');
    body.push('');
    body.push('These Agent Skills in `.kiro/skills/` apply to your work. They activate automatically when the');
    body.push('request matches, and you can invoke them from chat with `/`:');
    body.push('');
    for (const s of relevantSkills) body.push(`- \`${s}\``);
    body.push('');
  }

  if (tasks.length) {
    body.push('## Available Tasks');
    body.push('');
    body.push('Task files live in `.aigile-core/tasks/`. Load and follow them exactly when running a command:');
    body.push('');
    for (const t of tasks) body.push(`- \`${t}\``);
    body.push('');
  }

  if (deps.templates.length) {
    body.push('## Templates');
    body.push('');
    body.push('Reference templates in `.aigile-core/templates/`:');
    body.push('');
    for (const t of deps.templates) body.push(`- ${t}`);
    body.push('');
  }

  if (deps.checklists.length) {
    body.push('## Checklists');
    body.push('');
    body.push('Reference checklists in `.aigile-core/checklists/`:');
    body.push('');
    for (const c of deps.checklists) body.push(`- ${c}`);
    body.push('');
  }

  if (deps.data.length) {
    body.push('## Data References');
    body.push('');
    body.push('Reference data files in `.aigile-core/data/`:');
    body.push('');
    for (const d of deps.data) body.push(`- ${d}`);
    body.push('');
  }

  body.push('## Original Agent Definition');
  body.push('');
  body.push('<details>');
  body.push('<summary>Expand for full agent configuration (adapted for Kiro)</summary>');
  body.push('');
  body.push(kiroifyAgentSource(agentMd));
  body.push('');
  body.push('</details>');

  return fm.join('\n') + body.join('\n');
}

/**
 * Generate a manual-inclusion steering file holding one agent's workflows.
 * Manual steering files show up as slash commands in Kiro chat
 * (e.g. `/aigile-dev-workflows`).
 */
function generateKiroWorkflowSteering(agentId) {
  const commands = commandsFor(agentId).filter(c => {
    const k = Object.keys(c)[0];
    return k !== 'help' && k !== 'exit';
  });
  if (!commands.length) return null;

  const title = toTitleCase(agentId);
  const lines = [];
  lines.push('---');
  lines.push('inclusion: manual');
  lines.push('---');
  lines.push('');
  lines.push(`# ${agentIcon(agentId)} ${title} Workflows (AIgile)`);
  lines.push('');
  lines.push(`On-demand workflows for the AIgile **${title}** agent. Pick one and follow it step by step.`);
  lines.push(`For the full persona, switch to the \`${agentId}\` agent in the agent selector.`);
  lines.push('');

  for (const cmd of commands) {
    const key = Object.keys(cmd)[0];
    const val = cmd[key];
    lines.push(`## ${toTitleCase(key)} (\`*${key}\`)`);
    lines.push('');
    if (Array.isArray(val)) {
      let step = 1;
      for (const el of val) lines.push(`${step++}. ${el}`);
    } else if (typeof val === 'string') {
      lines.push(`**Goal:** ${val}`);
    } else {
      lines.push(`**Goal:** Execute the ${key} command.`);
    }
    lines.push('');
  }

  lines.push('## Resources');
  lines.push('');
  lines.push('- Agent definitions: `.kiro/agents/`');
  lines.push('- Source agents: `.aigile-core/agents/`');
  lines.push('- Task files: `.aigile-core/tasks/`');
  lines.push('- Templates: `.aigile-core/templates/`');
  lines.push('- Checklists: `.aigile-core/checklists/`');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate the always-included steering file describing the AIgile framework.
 * This is the Kiro counterpart to GEMINI.md / copilot instructions.
 */
function generateKiroSteering(agents) {
  const lines = [];
  lines.push('---');
  lines.push('inclusion: always');
  lines.push('---');
  lines.push('');
  lines.push('# AIgile Development Method');
  lines.push('');
  lines.push('This workspace uses the **AIgile Development Method** — a pragmatic, agent-driven agile framework.');
  lines.push('');
  lines.push('## Agent Team');
  lines.push('');
  lines.push('Specialist agents are installed as Kiro custom agents in `.kiro/agents/`. Pick one from the');
  lines.push('agent selector, or ask Kiro to run it as a subagent (e.g. "Use the `po` subagent to draft stories").');
  lines.push('');
  lines.push('Run `aigile-orchestrator` or `aigile-manual-orchestrator` as the **main** agent (select it in the');
  lines.push('agent selector) when you want it to coordinate the team. They delegate with the `subagent` tool,');
  lines.push('and a subagent cannot spawn further subagents — so an orchestrator launched as a subagent can only');
  lines.push('hand back briefs instead of dispatching them.');
  lines.push('');
  lines.push('| Agent | Role | When to use |');
  lines.push('|-------|------|-------------|');
  for (const a of agents) {
    lines.push(`| ${agentIcon(a.id)} \`${a.id}\` | ${a.title} | ${a.description} |`);
  }
  lines.push('');
  lines.push('## Workflows');
  lines.push('');
  lines.push('Per-agent workflows are manual steering files in `.kiro/steering/`. Type `/` in chat and pick');
  lines.push('`aigile-<agent>-workflows` (e.g. `/aigile-dev-workflows`) to pull a workflow into the conversation.');
  lines.push('');
  lines.push('## Skills');
  lines.push('');
  lines.push('AIgile ships Agent Skills in `.kiro/skills/`. They activate automatically when a request matches');
  lines.push('their description, or on demand via `/`:');
  lines.push('');
  lines.push('- `aigile-orchestration` — route work to the right agent and coordinate multi-agent delivery');
  lines.push('- `aigile-story-delivery` — story readiness, task breakdown, implementation loop, definition of done');
  lines.push('- `aigile-quality-gate` — evidence-backed PASS / CONCERNS / FAIL / WAIVED decisions');
  lines.push('- `aigile-spec-bridge` — map Kiro spec phases onto AIgile artifacts and roles');
  lines.push('');
  lines.push('More curated community skills can be added with `npx @mark-gozner/aigile-method skills:add`.');
  lines.push('');
  lines.push('## Core Assets');
  lines.push('');
  lines.push('The `.aigile-core/` directory holds all framework resources:');
  lines.push('');
  lines.push('- **`agents/`** — Source agent definitions');
  lines.push('- **`tasks/`** — Executable task instructions (follow them exactly)');
  lines.push('- **`templates/`** — Output templates (YAML-based)');
  lines.push('- **`checklists/`** — Quality and process checklists');
  lines.push('- **`data/`** — Reference data (brainstorming techniques, test frameworks, etc.)');
  lines.push('- **`core-config.yaml`** — Project paths and preferences');
  lines.push('');
  lines.push('## Key Principles');
  lines.push('');
  lines.push('- Tasks are executable instructions; follow them exactly.');
  lines.push('- Elicitation steps are mandatory; always ask for missing inputs.');
  lines.push('- Save artifacts under `docs/` for traceability.');
  lines.push('- Prefer small, safe, testable changes.');
  lines.push('- Use Spec sessions for multi-step features; keep Vibe sessions for focused edits.');
  lines.push('');
  return lines.join('\n');
}

/**
 * Convert the repo MCP catalog (VS Code format) into Kiro's `.kiro/settings/mcp.json`
 * format: `{ "mcpServers": { "<id>": { command, args, env, disabled, autoApprove } } }`.
 * VS Code `${input:foo}` placeholders become `${FOO}` environment references.
 */
function writeKiroMcpJson(dest) {
  const target = path.join(dest, '.kiro', 'settings', 'mcp.json');
  const doc = readJsonIfExists(path.join(root, 'mcp', 'servers.json'));
  if (!doc || !doc.servers) {
    console.warn('⚠️ mcp/servers.json not found — skipped .kiro/settings/mcp.json');
    return false;
  }
  const toEnvRef = (v) => typeof v === 'string'
    ? v.replace(/\$\{input:([A-Za-z0-9_.-]+)\}/g, (_m, id) => `\${${id.replace(/[.-]/g, '_').toUpperCase()}}`)
    : v;

  const existing = readJsonIfExists(target) || {};
  const mcpServers = { ...(existing.mcpServers || {}) };
  for (const [id, cfg] of Object.entries(doc.servers)) {
    const next = {};
    if (cfg.command) next.command = cfg.command;
    if (Array.isArray(cfg.args)) next.args = cfg.args.map(toEnvRef);
    if (cfg.url) next.url = toEnvRef(cfg.url);
    if (cfg.env) {
      next.env = {};
      for (const [k, v] of Object.entries(cfg.env)) next.env[k] = toEnvRef(v);
    }
    next.disabled = false;
    next.autoApprove = [];
    mcpServers[id] = { ...(mcpServers[id] || {}), ...next };
  }
  write(target, JSON.stringify({ ...existing, mcpServers }, null, 2));
  console.log('✅ Installed MCP servers into .kiro/settings/mcp.json (set the referenced env vars)');
  return true;
}

// ---------------------------------------------------------------------------
// Claude Code (code.claude.com) support
// Claude Code reads subagents from `.claude/agents/*.md`, skills (which is also
// how custom slash commands are authored now) from `.claude/skills/<name>/SKILL.md`,
// always-on project context from `CLAUDE.md`, project MCP servers from `.mcp.json`
// and project settings from `.claude/settings.json`.
// Docs: https://code.claude.com/docs/en/sub-agents , https://code.claude.com/docs/en/skills
// ---------------------------------------------------------------------------

/**
 * Naming and path conventions differ between the two ways AIgile reaches Claude Code:
 *
 *  - `project` — files written into a workspace by `aigile install --for-claude`.
 *    Skills live at `.claude/skills/aigile-<name>/` so they are self-namespacing
 *    in the `/` menu, and framework resources are read from `.aigile-core/`.
 *  - `plugin`  — files baked into the distributable Claude Code plugin by
 *    `aigile bundle`. Claude Code already namespaces plugin skills as
 *    `/<plugin>:<skill>`, so the `aigile-` prefix would double up; resources are
 *    read from the plugin's own copy of `core/` via `${CLAUDE_PLUGIN_ROOT}`.
 */
function claudeTarget(kind = 'project') {
  if (kind === 'plugin') {
    return {
      kind,
      ns: '',
      resourceRoot: '${CLAUDE_PLUGIN_ROOT}/core',
      ref: (n) => `/aigile:${n}`,
      indexSkill: 'method',
      indexRef: '/aigile:method',
    };
  }
  return {
    kind: 'project',
    ns: 'aigile-',
    resourceRoot: '.aigile-core',
    ref: (n) => `/aigile-${n}`,
    indexSkill: 'aigile',
    indexRef: '/aigile',
  };
}

/**
 * Tools for a Claude Code subagent.
 *
 * Returning `null` means "omit the `tools:` key", which makes the subagent
 * inherit every tool the session has — including MCP tools, whose names depend
 * on which servers the user actually configured. That is deliberately the
 * default: an explicit allow-list here would silently strip capabilities
 * whenever a user wires up a server AIgile does not know about.
 *
 * The orchestrators are the exception. They are pure coordinators, so they get
 * a read-and-delegate allow-list with no Write/Edit/Bash.
 */
function claudeToolsFor(agentId) {
  if (claudeIsOrchestrator(agentId)) {
    return ['Read', 'Glob', 'Grep', 'Task', 'TodoWrite', 'AskUserQuestion', 'WebFetch', 'WebSearch'];
  }
  return null;
}

/** Subagent list colour, so the AIgile team is visually distinguishable in `/agents`. */
function claudeColorFor(agentId) {
  const map = {
    'aigile-orchestrator': 'purple',
    'aigile-manual-orchestrator': 'purple',
    'aigile-master': 'purple',
    analyst: 'cyan',
    pm: 'blue',
    po: 'blue',
    sm: 'blue',
    architect: 'orange',
    dev: 'green',
    'expert-react-frontend-engineer': 'green',
    qa: 'yellow',
    'automation-tester': 'yellow',
    security: 'red',
    devops: 'orange',
    'ux-expert': 'pink',
    'ui-expert': 'pink',
    'code-tour': 'cyan',
  };
  return map[agentId] || 'cyan';
}

/**
 * Agents whose subject genuinely is another editor. Rewriting "VS Code" to
 * "Claude Code" in these would turn a correct statement into a false one — the
 * CodeTour agent authors `.tour` files for the VS Code extension of that name.
 */
const CLAUDE_KEEP_EDITOR_NAMES = new Set(['code-tour']);

/**
 * Rewrite a source agent definition so it describes Claude Code instead of
 * VS Code / GitHub Copilot. The source agents name tools that do not exist here
 * (`runSubagent`, `vscode_askQuestions`, `manage_todo_list`, `.github/agents`, ...).
 * Left alone, the agents announce missing tools instead of using the equivalent.
 */
function claudeifyText(text, { keepEditorNames = false } = {}) {
  let out = String(text || '');
  const replacements = [
    // Confirmation gate: Claude Code has a first-class equivalent.
    [/\bfresh `?vscode[_/]askQuestions`? answer/g, 'fresh AskUserQuestion answer'],
    [/`?vscode[_/]askQuestions`?/g, 'the `AskUserQuestion` tool'],
    [/`?\baskQuestions\b`?/g, 'the `AskUserQuestion` tool'],
    // Task tracking.
    [/`?\bmanage_todo_list\b`?/g, 'the `TodoWrite` tool'],
    [/GitHub Copilot Chat built-in TODOs/g, 'the `TodoWrite` tool'],
    [/GitHub Copilot Chat TODOs/g, 'the `TodoWrite` tool'],
    [/Copilot Chat TODOs/g, 'the `TodoWrite` tool'],
    // Delegation: Claude Code spawns subagents with the Task tool.
    [/#tool:runSubagent/g, 'the `Task` tool'],
    [/#runSubagent/g, 'the `Task` tool'],
    [/`?\brunSubagent\b`?/g, 'the `Task` tool'],
    // Paths and file formats.
    [/\.github\/chatmodes/g, '.claude/agents'],
    [/\.github\/agents/g, '.claude/agents'],
    [/\bchatmodes\b/g, 'subagents'],
    [/\bchatmode\b/g, 'subagent'],
    [/#tool:([A-Za-z0-9_.-]+)/g, 'the `$1` tool'],
    [/`?\bvscode_([A-Za-z0-9_]+)`?/g, 'the `$1` capability'],
  ];
  // Product names are rewritten only where the agent is not *about* another editor.
  const editorNames = [
    [/Copilot Chat/g, 'Claude Code'],
    [/GitHub Copilot/g, 'Claude Code'],
    [/\bCopilot\b/g, 'Claude Code'],
    [/\bVS ?Code\b/gi, 'Claude Code'],
  ];
  for (const [pattern, value] of replacements) out = out.replace(pattern, value);
  if (!keepEditorNames) {
    for (const [pattern, value] of editorNames) out = out.replace(pattern, value);
  }
  return out.trim();
}

function claudeifyAgentSource(md, opts) {
  // Drop the Copilot custom-agent frontmatter (tools/handoffs/model lists). The
  // Claude Code frontmatter generated by this installer is the authoritative one.
  return claudeifyText(String(md || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''), opts);
}

/**
 * Skills here replace the same-named skill in core/skills for the Claude Code
 * targets. Used where a shared skill describes another platform's mechanics
 * (spec sessions, delegation tooling) closely enough that translating it would
 * produce nonsense.
 */
const CLAUDE_SKILL_OVERRIDES_DIR = path.join('core', 'skills-claude');

/** AIgile-authored skills that should be preloaded into a given subagent. */
function claudeSkillsFor(agentId) {
  return kiroSkillsFor(agentId);
}

/**
 * Skill name for one of the AIgile-authored core skills under the given target.
 * Plugin skills are already namespaced as `/aigile:<skill>` by Claude Code, so the
 * `aigile-` prefix is dropped there to avoid `/aigile:aigile-orchestration`.
 */
function claudeCoreSkillName(skill, target) {
  return target.ns ? skill : skill.replace(/^aigile-/, '');
}

/**
 * Adapt an AIgile-authored skill for Claude Code. Only mechanical, unambiguous
 * substitutions belong here: paths, and the resource root when the skill ships
 * inside the plugin. A skill whose *subject* is another platform cannot be fixed
 * by search-and-replace — give it a hand-written override in core/skills-claude/
 * instead (see CLAUDE_SKILL_OVERRIDES_DIR).
 */
function claudeifySkill(text, target) {
  let out = String(text || '')
    .replace(/`?\.kiro\/skills`?/g, '`.claude/skills`')
    .replace(/`?\.kiro\/agents`?/g, '`.claude/agents`')
    .replace(/`?\.kiro\/steering`?/g, '`CLAUDE.md`');
  if (target.resourceRoot !== '.aigile-core') {
    out = out.replace(/\.aigile-core\//g, `${target.resourceRoot}/`);
  }
  return out;
}

/** Turn any string into a safe skill/directory slug. */
function claudeSlug(str) {
  return String(str || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** The delegation roster shown to every Claude Code subagent. */
const CLAUDE_DELEGATION_TARGETS = [
  { id: 'analyst', specialty: 'Requirements elicitation, brainstorming, market research' },
  { id: 'pm', specialty: 'Product scope, PRDs, roadmap, sprint planning' },
  { id: 'po', specialty: 'Epics, stories, acceptance criteria, backlog grooming' },
  { id: 'architect', specialty: 'System design, ADRs, architecture review' },
  { id: 'dev', specialty: 'Implementation, debugging, refactoring, TDD' },
  { id: 'expert-react-frontend-engineer', specialty: 'React/frontend component architecture' },
  { id: 'qa', specialty: 'Test strategy, test design, quality gates' },
  { id: 'automation-tester', specialty: 'E2E and browser automation, visual regression' },
  { id: 'security', specialty: 'Threat modelling, OWASP review, dependency audit' },
  { id: 'devops', specialty: 'CI/CD, infrastructure, deployments, observability' },
  { id: 'ux-expert', specialty: 'User journeys, interaction flows, frontend specs' },
  { id: 'ui-expert', specialty: 'Visual design, design systems, tokens, Figma' },
  { id: 'sm', specialty: 'Ceremonies, impediments, process health' },
  { id: 'code-tour', specialty: 'Codebase walkthroughs and onboarding tours' },
];

/**
 * Commands that become their own invocable workflow skill. `help` and `exit` are
 * chat conventions rather than procedures, and `explain` is identical for every
 * agent — none of them earn a slot in the `/` menu.
 */
function claudeWorkflowCommands(agentId) {
  return commandsFor(agentId).filter((c) => {
    const key = Object.keys(c)[0];
    return key !== 'help' && key !== 'exit' && key !== 'explain';
  });
}

/**
 * Routing descriptions for agents whose source definition carries no `whenToUse`
 * and whose persona falls back to the generic default. Without these, Claude Code
 * would be choosing between several agents that all describe themselves as
 * "executing tasks with precision".
 */
const CLAUDE_AGENT_DESCRIPTIONS = {
  'automation-tester': 'Use for end-to-end and browser test automation, Playwright suites, visual regression, cross-browser validation, and API test coverage.',
  devops: 'Use for CI/CD pipelines, infrastructure as code, deployments, release automation, containerization, and observability.',
  security: 'Use for threat modelling, OWASP review, dependency and secret audits, secure design review, and security sign-off on a change.',
};

/** The two delegation-only coordinators, which get a restricted toolset. */
function claudeIsOrchestrator(agentId) {
  return agentId === 'aigile-orchestrator' || agentId === 'aigile-manual-orchestrator';
}

/**
 * The subagent `description`, which is what Claude Code matches against when it
 * decides who to delegate to — so a generic "X responsibilities and workflows"
 * fallback actively hurts routing. Prefer the source `whenToUse`, then a curated
 * description, then the persona's focus, and only then the generic form.
 */
function claudeAgentDescription(agentId, agentMeta, title, person) {
  if (agentMeta.whenToUse) return agentMeta.whenToUse;
  const curated = CLAUDE_AGENT_DESCRIPTIONS[canonicalAgentId(agentId)];
  if (curated) return curated;
  if (person && person.focus) return `Use for ${person.focus.charAt(0).toLowerCase()}${person.focus.slice(1)}.`;
  return `Use for ${title} responsibilities and workflows.`;
}

/**
 * Generate a Claude Code subagent file (.claude/agents/<id>.md).
 */
function generateClaudeAgent({ agentId, agentMeta, agentMd, tasks, target }) {
  const t = target;
  const opts = { keepEditorNames: CLAUDE_KEEP_EDITOR_NAMES.has(agentId) };
  const title = claudeifyText(agentMeta.title || agentMeta.agentRole || toTitleCase(agentId), opts);
  const person = { ...personaFor(agentId), ...(agentMeta.persona || {}) };
  const description = claudeAgentDescription(agentId, agentMeta, title, person);
  const combinedPrinciples = (agentMeta.corePrinciples && agentMeta.corePrinciples.length)
    ? agentMeta.corePrinciples
    : principlesFor(agentId);
  const deps = relevantDependencies(agentId);
  const workflowCommands = claudeWorkflowCommands(agentId);
  const canonicalId = canonicalAgentId(agentId);
  const tools = claudeToolsFor(agentId);
  const skills = claudeSkillsFor(agentId);
  const isOrchestrator = claudeIsOrchestrator(agentId);

  const fm = [];
  fm.push('---');
  fm.push(`name: ${agentId}`);
  fm.push(`description: "${yamlSingleLine(claudeifyText(description, opts))}"`);
  if (tools) fm.push(`tools: ${tools.join(', ')}`);
  if (skills.length) fm.push(`skills: [${skills.map((s) => claudeCoreSkillName(s, t)).join(', ')}]`);
  fm.push(`color: ${claudeColorFor(agentId)}`);
  fm.push('---');
  fm.push('');
  fm.push('');

  const body = [];
  body.push(`# ${agentIcon(agentId)} ${title}`);
  body.push('');
  body.push(`You are the **${title}** — a specialized agent of the AIgile Development Method.`);
  body.push('');
  body.push('## Core Identity');
  body.push('');
  body.push(`- **Role**: ${person.role}`);
  body.push(`- **Style**: ${person.style}`);
  body.push(`- **Identity**: ${person.identity}`);
  body.push(`- **Focus**: ${person.focus}`);
  body.push('');
  body.push('Stay in this persona for the whole session. If the user asks for work that belongs to');
  body.push('another role, say so and name the matching AIgile agent instead of doing it yourself.');
  body.push('');
  body.push('## Environment: Claude Code');
  body.push('');
  body.push('You run inside **Claude Code**. Use Claude Code capabilities only. There is no VS Code and');
  body.push('no GitHub Copilot here — never tell the user a Copilot tool is unavailable, just use the');
  body.push('equivalent below and carry on.');
  body.push('');
  body.push('| Need | Use in Claude Code |');
  body.push('|------|--------------------|');
  body.push('| Ask the user to confirm or choose | The `AskUserQuestion` tool |');
  body.push('| Delegate to another role | The `Task` tool with the matching `subagent_type` |');
  body.push('| Track progress on a long task | The `TodoWrite` tool |');
  body.push('| Persistent project context | `CLAUDE.md` at the project root |');
  body.push('| Reusable procedures | Agent Skills, invoked from chat with `/` |');
  if (isOrchestrator) {
    body.push('| Read and search the codebase | `Read`, `Glob`, `Grep` |');
    body.push('| Edit code, run commands, call MCP servers | You hold none of those tools — delegate instead |');
  } else {
    body.push('| Read, search and edit code | `Read`, `Glob`, `Grep`, `Edit`, `Write` |');
    body.push('| Run commands and tests | `Bash` |');
    body.push('| External systems (Jira, GitHub, Figma, ...) | MCP tools named `mcp__<server>__<tool>` |');
  }
  body.push('');
  body.push('The appendix at the end of this file is the original cross-platform definition. Treat its');
  body.push('intent as authoritative and its tool names, `tools:` lists and handoff blocks as historical —');
  body.push('they describe other IDEs. This section wins on any conflict.');
  body.push('');
  body.push('## Operating Principles');
  body.push('');
  for (const p of combinedPrinciples) body.push(`- ${claudeifyText(p, opts)}`);
  body.push('');

  if (workflowCommands.length) {
    body.push('## Workflows');
    body.push('');
    body.push('Each of your commands is installed as an invocable skill. Run one yourself when the user');
    body.push('asks for it by name, or tell the user to type it:');
    body.push('');
    body.push('| Command | Skill | Purpose |');
    body.push('|---------|-------|---------|');
    for (const cmd of workflowCommands) {
      const key = Object.keys(cmd)[0];
      const val = cmd[key];
      const purpose = Array.isArray(val) ? `Run the ${key.replace(/-/g, ' ')} procedure` : String(val);
      body.push(`| \`*${key}\` | \`${t.ref(`${canonicalId}-${key}`)}\` | ${yamlSingleLine(purpose).replace(/\.*$/, '')} |`);
    }
    body.push('');
    body.push('`*help` lists these back to the user; `*explain` walks through what you just did and why.');
    body.push('');
  }

  body.push('## Delegation');
  body.push('');
  if (isOrchestrator) {
    body.push('Delegation is your primary capability. You hold `Task` and no editing or shell tools —');
    body.push('that is by design. Read to understand, then delegate the work.');
    body.push('');
    if (agentId === 'aigile-manual-orchestrator') {
      body.push('- **Gate first.** Never call `Task` until the user has answered your `AskUserQuestion`');
      body.push('  confirmation for that specific delegation. Holding the tool does not license you to');
      body.push('  use it unprompted — ask, wait, then dispatch exactly what was approved.');
    }
    body.push('- Spawn an AIgile specialist with `Task` and its `subagent_type` (for example');
    body.push('  `subagent_type: "qa"`), and give it a self-contained brief: goal, target artifact,');
    body.push('  file paths, constraints and definition of done. The subagent has its own context');
    body.push('  window and cannot see this conversation.');
    body.push('- Send independent briefs in a single message so they run concurrently; sequence');
    body.push('  dependent ones.');
    body.push('- Verify each returned artifact against the stated done criteria before continuing.');
    body.push('  Do not accept a summary in place of the artifact.');
    body.push('- **If you cannot spawn subagents** — you were launched as a subagent yourself, and');
    body.push('  Claude Code does not nest delegation — do not start doing the work. Say so plainly and');
    body.push('  return the numbered briefs you would have dispatched. Tell the user that running you');
    body.push('  from the main session restores delegation.');
    body.push('');
    body.push('Available specialists:');
    body.push('');
  } else {
    body.push('Delegate specialized work with the `Task` tool, passing the specialist as `subagent_type`');
    body.push('(for example `subagent_type: "qa"` to design tests for a story):');
    body.push('');
  }
  body.push('| `subagent_type` | Specialty |');
  body.push('|-----------------|-----------|');
  for (const d of CLAUDE_DELEGATION_TARGETS) {
    if (d.id !== canonicalId) body.push(`| \`${d.id}\` | ${d.specialty} |`);
  }
  body.push('');

  if (skills.length) {
    body.push('## Skills');
    body.push('');
    body.push('These AIgile skills are preloaded for you and also apply automatically when a request');
    body.push('matches their description:');
    body.push('');
    for (const s of skills) body.push(`- \`${t.ref(claudeCoreSkillName(s, t).replace(/^aigile-/, ''))}\``);
    body.push('');
  }

  if (tasks.length) {
    body.push('## Available Tasks');
    body.push('');
    body.push(`Task files live in \`${t.resourceRoot}/tasks/\`. Read and follow them exactly when running a command:`);
    body.push('');
    for (const task of tasks) body.push(`- \`${task}\``);
    body.push('');
  }

  if (deps.templates.length) {
    body.push('## Templates');
    body.push('');
    body.push(`Reference templates in \`${t.resourceRoot}/templates/\`:`);
    body.push('');
    for (const x of deps.templates) body.push(`- ${x}`);
    body.push('');
  }

  if (deps.checklists.length) {
    body.push('## Checklists');
    body.push('');
    body.push(`Reference checklists in \`${t.resourceRoot}/checklists/\`:`);
    body.push('');
    for (const x of deps.checklists) body.push(`- ${x}`);
    body.push('');
  }

  if (deps.data.length) {
    body.push('## Data References');
    body.push('');
    body.push(`Reference data files in \`${t.resourceRoot}/data/\`:`);
    body.push('');
    for (const x of deps.data) body.push(`- ${x}`);
    body.push('');
  }

  body.push('## Original Agent Definition');
  body.push('');
  body.push('<details>');
  body.push('<summary>Expand for the full cross-platform agent configuration (adapted for Claude Code)</summary>');
  body.push('');
  body.push(claudeifyAgentSource(agentMd, opts));
  body.push('');
  body.push('</details>');

  return fm.join('\n') + body.join('\n') + '\n';
}

/**
 * Generate one workflow skill per agent command
 * (.claude/skills/aigile-<agent>-<command>/SKILL.md).
 */
function generateClaudeCommandSkill({ agentId, command, target, agentTitle }) {
  const t = target;
  const key = Object.keys(command)[0];
  const val = command[key];
  const canonicalId = canonicalAgentId(agentId);
  const title = agentTitle || toTitleCase(agentId);
  const purpose = Array.isArray(val)
    ? `run the ${key.replace(/-/g, ' ')} procedure`
    : String(val);
  // `commandsFor` values are fragments, not sentences — normalise before use.
  const purposeSentence = yamlSingleLine(claudeifyText(purpose)).replace(/\.*$/, '');

  const lines = [];
  lines.push('---');
  lines.push(`name: ${t.ns}${canonicalId}-${key}`);
  lines.push(`description: "AIgile ${title} workflow — ${purposeSentence}. Run it as the ${canonicalId} agent."`);
  lines.push('argument-hint: "[context — story id, ticket key, file path, ...]"');
  lines.push('disable-model-invocation: true');
  lines.push('---');
  lines.push('');
  lines.push(`# ${agentIcon(agentId)} ${toTitleCase(key)}`);
  lines.push('');
  lines.push(`AIgile workflow owned by the **${title}** (\`${canonicalId}\`) agent.`);
  lines.push('');
  lines.push('**Context for this run:** $ARGUMENTS');
  lines.push('');
  lines.push('## Before you start');
  lines.push('');
  lines.push(`1. Adopt the \`${canonicalId}\` persona — read \`.claude/agents/${canonicalId}.md\` if you are not already that agent, or delegate this whole workflow with the \`Task\` tool using \`subagent_type: "${canonicalId}"\`.`);
  lines.push('2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.');
  lines.push('3. Track multi-step progress with `TodoWrite`.');
  lines.push('');

  if (Array.isArray(val)) {
    lines.push('## Procedure');
    lines.push('');
    let step = 1;
    for (const el of val) lines.push(`${step++}. ${claudeProcedureStep(el)}`);
    lines.push('');
  } else {
    lines.push('## Goal');
    lines.push('');
    lines.push(`${claudeifyText(String(val)).replace(/\.*$/, '')}.`);
    lines.push('');
  }

  const tasks = listTasksForAgent(canonicalId);
  const deps = relevantDependencies(canonicalId);
  if (tasks.length || deps.templates.length || deps.checklists.length) {
    lines.push('## Resources');
    lines.push('');
    if (tasks.length) {
      lines.push(`Task definitions in \`${t.resourceRoot}/tasks/\` — follow the matching one exactly:`);
      lines.push('');
      for (const task of tasks) lines.push(`- \`${task}\``);
      lines.push('');
    }
    if (deps.templates.length) {
      lines.push(`Templates in \`${t.resourceRoot}/templates/\`: ${deps.templates.map((x) => `\`${x}\``).join(', ')}`);
      lines.push('');
    }
    if (deps.checklists.length) {
      lines.push(`Checklists in \`${t.resourceRoot}/checklists/\`: ${deps.checklists.map((x) => `\`${x}\``).join(', ')}`);
      lines.push('');
    }
  }

  lines.push('## Definition of done');
  lines.push('');
  lines.push('- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.');
  lines.push('- Every applicable checklist item above is satisfied or explicitly waived with a reason.');
  lines.push('- You state what you produced, where it lives, and what the next AIgile role should pick up.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Some command steps are authored as `key: "value"` YAML fragments rather than
 * prose. Render those as a bolded label plus the sentence so the procedure reads
 * as instructions instead of as leaked configuration.
 */
function claudeProcedureStep(step) {
  const text = claudeifyText(String(step));
  const m = text.match(/^([a-z][a-z0-9-]*)\s*:\s*"?(.+?)"?$/i);
  if (!m) return text;
  return `**${toTitleCase(m[1])}** — ${m[2]}`;
}

/**
 * Minimal reader for the AIgile delivery workflow YAML files in core/workflows/.
 * Deliberately narrow: it pulls out the header fields and a flat step list, and
 * the full source YAML is embedded in the generated skill so nothing is lost if
 * a construct falls outside what this understands.
 */
function parseAigileWorkflow(text) {
  const src = String(text || '');
  const out = { id: null, name: null, description: '', type: null, projectTypes: [], steps: [] };

  const scalar = (key) => {
    const m = src.match(new RegExp(`^\\s{2}${key}\\s*:\\s*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  out.id = scalar('id');
  out.name = scalar('name');
  out.type = scalar('type');

  const desc = src.match(/^\s{2}description\s*:\s*(>-|>|\|-|\|)?\s*\r?\n((?:\s{4}.*\r?\n?)+)/m);
  if (desc) {
    out.description = desc[2].split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' ');
  } else {
    out.description = scalar('description') || '';
  }

  const pt = src.match(/^\s{2}project_types\s*:\s*\r?\n((?:\s{4}-\s*.*\r?\n?)+)/m);
  if (pt) {
    out.projectTypes = pt[1].split(/\r?\n/)
      .map((l) => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  }

  const seq = src.match(/^\s{2}sequence\s*:\s*\r?\n([\s\S]*?)(?=^\s{2}\S|\Z)/m);
  if (!seq) return out;

  // Split the sequence body on its list markers (4-space indent + "- ").
  const body = seq[1];
  const chunks = [];
  let current = null;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s{4}-\s/.test(line)) {
      if (current) chunks.push(current);
      current = [line.replace(/^\s{4}-\s/, '      ')];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) chunks.push(current);

  for (const chunk of chunks) {
    const step = {};
    for (let i = 0; i < chunk.length; i++) {
      const m = chunk[i].match(/^\s{6}([a-z_]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      let value = rawValue.trim();
      if (value === '|' || value === '>' || value === '|-' || value === '>-') {
        // Block scalar: consume the more-indented lines that follow.
        const collected = [];
        for (let j = i + 1; j < chunk.length; j++) {
          if (/^\s{8}/.test(chunk[j])) collected.push(chunk[j].trim());
          else if (!chunk[j].trim()) collected.push('');
          else break;
        }
        value = collected.join(' ').replace(/\s+/g, ' ').trim();
      } else if (!value) {
        // Nested list (e.g. `requires:` with list items).
        const collected = [];
        for (let j = i + 1; j < chunk.length; j++) {
          const li = chunk[j].match(/^\s{8}-\s*(.+)$/);
          if (li) collected.push(li[1].trim());
          else if (chunk[j].trim()) break;
        }
        value = collected.join(', ');
      }
      value = value.replace(/^["']|["']$/g, '');
      if (value) step[key] = value;
    }
    if (Object.keys(step).length) out.steps.push(step);
  }
  return out;
}

/**
 * Generate a delivery-workflow skill from core/workflows/<id>.yaml
 * (.claude/skills/aigile-workflow-<id>/SKILL.md).
 */
function generateClaudeWorkflowSkill({ file, yamlText, target }) {
  const t = target;
  const wf = parseAigileWorkflow(yamlText);
  const id = wf.id || file.replace(/\.ya?ml$/, '');
  const name = wf.name || toTitleCase(id);
  const description = wf.description || `Run the AIgile ${name} workflow end to end.`;

  const lines = [];
  lines.push('---');
  lines.push(`name: ${t.ns}workflow-${claudeSlug(id)}`);
  lines.push(`description: "AIgile delivery workflow — ${yamlSingleLine(description)}"`);
  lines.push('argument-hint: "[what you are building]"');
  lines.push('disable-model-invocation: true');
  lines.push('---');
  lines.push('');
  lines.push(`# 🔁 ${name}`);
  lines.push('');
  lines.push(description);
  lines.push('');
  if (wf.projectTypes.length) {
    lines.push(`**Fits:** ${wf.projectTypes.join(', ')}`);
    lines.push('');
  }
  lines.push('**This run:** $ARGUMENTS');
  lines.push('');
  lines.push('## How to run it');
  lines.push('');
  lines.push('This is a multi-agent sequence, not a single task. Drive it as the orchestrator:');
  lines.push('');
  lines.push('1. Put the whole sequence into `TodoWrite` before starting, one entry per step below.');
  lines.push('2. For each step, delegate with the `Task` tool using the listed agent as `subagent_type`.');
  lines.push('   Give each subagent a self-contained brief — it cannot see this conversation.');
  lines.push('3. Check every produced artifact against the step\'s stated output before advancing.');
  lines.push('   Save documents under `docs/` so later steps can read them.');
  lines.push('4. Steps marked optional or conditional need a decision first — use `AskUserQuestion`');
  lines.push('   rather than silently skipping or silently running them.');
  lines.push('5. If scope changes mid-flight, stop and go back to `pm`/`po` instead of absorbing it.');
  lines.push('');

  if (wf.steps.length) {
    lines.push('## Sequence');
    lines.push('');
    lines.push('| # | Agent | Produces | Requires | Notes |');
    lines.push('|---|-------|----------|----------|-------|');
    let n = 1;
    for (const step of wf.steps) {
      const agent = step.agent ? `\`${step.agent}\`` : (step.step ? `_${step.step.replace(/_/g, ' ')}_` : '—');
      const produces = step.creates || step.updates || step.validates || step.action || '—';
      const requires = step.requires || '—';
      const flags = [];
      if (step.optional === 'true' || step.optional === true) flags.push('optional');
      if (step.condition) flags.push(`if ${step.condition}`);
      if (step.repeats) flags.push(`repeats ${step.repeats}`);
      if (step.uses) flags.push(`uses ${step.uses}`);
      const note = [flags.length ? `**${flags.join(', ')}** —` : '', step.notes || ''].join(' ').trim() || '—';
      lines.push(`| ${n++} | ${agent} | ${produces} | ${requires} | ${yamlSingleLine(note)} |`);
    }
    lines.push('');
  }

  lines.push('## Source definition');
  lines.push('');
  lines.push(`The authoritative definition is \`${t.resourceRoot}/workflows/${file}\`. Read it when a step`);
  lines.push('needs detail the table above does not carry (decision guidance, handoff prompts, flow diagram).');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate the AIgile index skill — the one entry point that explains the
 * framework and routes to an agent or a workflow.
 */
function generateClaudeIndexSkill({ agents, workflows, target }) {
  const t = target;
  const lines = [];
  lines.push('---');
  lines.push(`name: ${t.indexSkill}`);
  lines.push('description: "AIgile Development Method — pick the right specialist agent or delivery workflow. Use when a request spans several roles, when unsure which AIgile agent should act, or when the user asks what AIgile offers."');
  lines.push('---');
  lines.push('');
  lines.push('# AIgile Development Method');
  lines.push('');
  lines.push('An agent-driven agile framework: specialist subagents, per-role workflows, and delivery');
  lines.push('sequences that run them in the right order.');
  lines.push('');
  lines.push('## Agents');
  lines.push('');
  lines.push('Delegate with the `Task` tool, passing the id as `subagent_type`.');
  lines.push('');
  lines.push('| Agent | Role | When to use |');
  lines.push('|-------|------|-------------|');
  for (const a of agents) {
    lines.push(`| ${agentIcon(a.id)} \`${a.id}\` | ${a.title} | ${a.description} |`);
  }
  lines.push('');
  lines.push('## Delivery workflows');
  lines.push('');
  if (workflows.length) {
    lines.push('| Workflow | Covers |');
    lines.push('|----------|--------|');
    for (const w of workflows) {
      lines.push(`| \`${t.ref(`workflow-${claudeSlug(w.id)}`)}\` | ${yamlSingleLine(w.description)} |`);
    }
    lines.push('');
  }
  lines.push('## Routing rules');
  lines.push('');
  lines.push('- Pick the role that owns the **artifact being produced**, not the one that consumes it.');
  lines.push('  A story is `po` work even though `dev` implements it.');
  lines.push('- Requirements before design, design before implementation, implementation before the');
  lines.push('  quality gate. Never jump to `dev` for work that has no acceptance criteria.');
  lines.push('- `qa` runs the gate; `dev` does not self-certify a story.');
  lines.push('- Architecture changes go through `architect` before `dev` starts, not after.');
  lines.push('- When scope grows mid-flight, return to `po`/`pm` instead of absorbing the change.');
  lines.push('');
  lines.push('## Per-role workflows');
  lines.push('');
  lines.push(`Type \`${t.ref('')}\` in chat to see every AIgile workflow, or run the one you want directly —`);
  lines.push(`for example \`${t.ref('dev-develop-story')}\`, \`${t.ref('po-create-story')}\`, \`${t.ref('qa-quality-gate')}\`.`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Read one source agent and resolve the identity fields both Claude Code targets
 * need. Native `.agent.md` sources carry their identity in YAML frontmatter
 * rather than in a fenced YAML block, so the two are merged.
 */
function claudeAgentSummary(agentId, agentMd) {
  const opts = { keepEditorNames: CLAUDE_KEEP_EDITOR_NAMES.has(agentId) };
  const agentMeta = extractAgentMeta(agentMd);
  const fmMeta = extractFrontmatterMeta(agentMd);
  if (!agentMeta.title && fmMeta.title) agentMeta.title = fmMeta.title;
  if (!agentMeta.whenToUse && fmMeta.description) agentMeta.whenToUse = fmMeta.description;
  const title = claudeifyText(agentMeta.title || agentMeta.agentRole || toTitleCase(agentId), opts);
  const person = { ...personaFor(agentId), ...(agentMeta.persona || {}) };
  return {
    id: agentId,
    title,
    description: yamlSingleLine(claudeifyText(claudeAgentDescription(agentId, agentMeta, title, person), opts)),
    agentMeta,
  };
}

/**
 * Resolve the source agent definitions in core/agents, preferring the portable
 * `<id>.md` variant over the Copilot-native `<id>.agent.md` when both exist.
 * Returns a Map of agentId -> filename, sorted by id.
 */
function collectAgentSources(agentsSrcDir) {
  const agentMap = new Map();
  if (!fs.existsSync(agentsSrcDir)) return agentMap;
  for (const f of fs.readdirSync(agentsSrcDir).filter((n) => n.endsWith('.md'))) {
    const isNativeAgent = f.endsWith('.agent.md');
    const agentId = isNativeAgent ? f.replace(/\.agent\.md$/, '') : f.replace(/\.[^/.]+$/, '');
    if (!agentMap.has(agentId)) agentMap.set(agentId, f);
    else if (!isNativeAgent && agentMap.get(agentId).endsWith('.agent.md')) agentMap.set(agentId, f);
  }
  return new Map(Array.from(agentMap.keys()).sort().map((k) => [k, agentMap.get(k)]));
}

/** Read the AIgile delivery workflows from core/workflows, parsed and sorted. */
function collectAigileWorkflows() {
  const dir = path.join(root, 'core', 'workflows');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((file) => {
      const yamlText = read(path.join(dir, file));
      const parsed = parseAigileWorkflow(yamlText);
      return {
        file,
        yamlText,
        id: parsed.id || file.replace(/\.ya?ml$/, ''),
        name: parsed.name || toTitleCase(file.replace(/\.ya?ml$/, '')),
        description: parsed.description || `The AIgile ${file.replace(/\.ya?ml$/, '')} workflow.`,
      };
    });
}

/**
 * Copy the AIgile-authored skills (core/skills/<name>/SKILL.md) to a Claude Code
 * skills directory, adapting Kiro-specific wording and (for the plugin build)
 * the skill name. Returns the number of skills written.
 */
function writeClaudeCoreSkills(skillsDir, target) {
  const srcSkills = path.join(root, 'core', 'skills');
  const overrideSkills = path.join(root, CLAUDE_SKILL_OVERRIDES_DIR);
  if (!fs.existsSync(srcSkills)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(srcSkills, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // A Claude Code override replaces the shared skill wholesale. Use it for any
    // skill whose subject is platform-specific rather than mangling the shared one.
    const overrideDir = path.join(overrideSkills, entry.name);
    const skillDir = fs.existsSync(path.join(overrideDir, 'SKILL.md')) ? overrideDir : path.join(srcSkills, entry.name);
    const srcFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(srcFile)) continue;
    const outName = claudeCoreSkillName(entry.name, target);
    const raw = read(srcFile);
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let outContent;
    if (fmMatch) {
      const fm = fmMatch[1]
        .replace(/^name\s*:\s*.+$/m, `name: ${outName}`)
        .split(/\r?\n/)
        .map((line) => (/^description\s*:/.test(line) ? claudeifySkill(line, target) : line))
        .join('\n');
      outContent = `---\n${fm}\n---\n\n${claudeifySkill(fmMatch[2], target)}\n`;
    } else {
      outContent = `${claudeifySkill(raw, target)}\n`;
    }
    write(path.join(skillsDir, outName, 'SKILL.md'), outContent);
    // Carry over any supporting files the skill ships alongside SKILL.md.
    for (const extra of fs.readdirSync(skillDir)) {
      if (extra === 'SKILL.md') continue;
      const from = path.join(skillDir, extra);
      const to = path.join(skillsDir, outName, extra);
      if (fs.statSync(from).isDirectory()) copyDir(from, to);
      else write(to, read(from));
    }
    count++;
  }
  return count;
}

/**
 * Write every generated skill (core + per-command workflows + delivery workflows
 * + index) into `skillsDir`. Returns counts per category.
 */
function writeClaudeSkills({ skillsDir, agents, agentSources, workflows, target, prune = false }) {
  // Drop AIgile-generated skills from a previous install so a renamed or removed
  // command does not linger in the `/` menu. Only `aigile`-namespaced directories
  // are touched — anything the user authored is left alone.
  let pruned = 0;
  if (prune && fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      if (d.name !== target.indexSkill && !d.name.startsWith('aigile-')) continue;
      fs.rmSync(path.join(skillsDir, d.name), { recursive: true, force: true });
      pruned++;
    }
  }

  const core = writeClaudeCoreSkills(skillsDir, target);

  const titles = new Map(agents.map((a) => [a.id, a.title]));
  let commandSkills = 0;
  for (const agentId of agentSources.keys()) {
    const canonicalId = canonicalAgentId(agentId);
    for (const command of claudeWorkflowCommands(agentId)) {
      const key = Object.keys(command)[0];
      const name = `${target.ns}${canonicalId}-${key}`;
      write(
        path.join(skillsDir, name, 'SKILL.md'),
        generateClaudeCommandSkill({
          agentId,
          command,
          target,
          agentTitle: titles.get(agentId) || titles.get(canonicalId),
        })
      );
      commandSkills++;
    }
  }

  let workflowSkills = 0;
  for (const wf of workflows) {
    const name = `${target.ns}workflow-${claudeSlug(wf.id)}`;
    write(
      path.join(skillsDir, name, 'SKILL.md'),
      generateClaudeWorkflowSkill({ file: wf.file, yamlText: wf.yamlText, target })
    );
    workflowSkills++;
  }

  write(
    path.join(skillsDir, target.indexSkill, 'SKILL.md'),
    generateClaudeIndexSkill({ agents, workflows, target })
  );

  return { core, commandSkills, workflowSkills, index: 1, pruned, total: core + commandSkills + workflowSkills + 1 };
}

/**
 * Generate the AIgile section for the project's CLAUDE.md.
 */
function generateClaudeMdSection({ agents, workflows, target }) {
  const t = target;
  const lines = [];
  lines.push('## AIgile Development Method');
  lines.push('');
  lines.push('This workspace uses the **AIgile Development Method** — a pragmatic, agent-driven agile');
  lines.push('framework. Specialist subagents live in `.claude/agents/`, their workflows are skills in');
  lines.push('`.claude/skills/`, and the shared task/template/checklist library is in `.aigile-core/`.');
  lines.push('');
  lines.push('### Agent team');
  lines.push('');
  lines.push('Delegate with the `Task` tool, passing the id as `subagent_type` (for example');
  lines.push('`subagent_type: "po"` to draft stories). Route work to the agent that owns the artifact');
  lines.push('being produced, not the one that consumes it.');
  lines.push('');
  lines.push('| Agent | Role | When to use |');
  lines.push('|-------|------|-------------|');
  for (const a of agents) {
    lines.push(`| ${agentIcon(a.id)} \`${a.id}\` | ${a.title} | ${a.description} |`);
  }
  lines.push('');
  lines.push('Run `aigile-orchestrator` or `aigile-manual-orchestrator` from the **main** session when you');
  lines.push('want one of them to coordinate the team. Claude Code does not nest delegation, so an');
  lines.push('orchestrator launched as a subagent can only hand back briefs instead of dispatching them.');
  lines.push('The manual orchestrator additionally asks for confirmation before every delegation.');
  lines.push('');
  lines.push('### Workflows');
  lines.push('');
  lines.push(`Start with \`${t.indexRef}\` for routing help. Per-role workflows are skills — type \`${t.ref('')}\` in`);
  lines.push('chat to browse them, or run one directly:');
  lines.push('');
  lines.push(`- \`${t.ref('po-create-story')}\` — write a story with acceptance criteria`);
  lines.push(`- \`${t.ref('dev-develop-story')}\` — implement the next story test-first`);
  lines.push(`- \`${t.ref('qa-quality-gate')}\` — run the gate and issue a PASS/CONCERNS/FAIL decision`);
  lines.push('');
  if (workflows.length) {
    lines.push('End-to-end delivery sequences (multi-agent, orchestrator-driven):');
    lines.push('');
    for (const w of workflows) lines.push(`- \`${t.ref(`workflow-${claudeSlug(w.id)}`)}\``);
    lines.push('');
  }
  lines.push('### Working agreements');
  lines.push('');
  lines.push('- Requirements before design, design before implementation, implementation before the');
  lines.push('  quality gate. Never start `dev` work that has no acceptance criteria.');
  lines.push('- `qa` runs the gate; `dev` does not self-certify a story.');
  lines.push('- Architecture changes go through `architect` before implementation, not after.');
  lines.push('- Save produced documents under `docs/` so later steps and agents can read them.');
  lines.push('- When scope grows mid-flight, stop and return to `po`/`pm` instead of absorbing it.');
  lines.push('');
  return lines.join('\n');
}

const AIGILE_MD_START = '<!-- AIGILE:START -->';
const AIGILE_MD_END = '<!-- AIGILE:END -->';

/**
 * Write the AIgile block into CLAUDE.md without disturbing anything the user
 * wrote around it. Re-running the installer replaces only the marked block.
 */
function writeClaudeMd(dest, section) {
  const target = path.join(dest, 'CLAUDE.md');
  const block = `${AIGILE_MD_START}\n${section}${AIGILE_MD_END}`;
  if (!fs.existsSync(target)) {
    write(target, `# Project instructions\n\n${block}\n`);
    console.log('✅ Created CLAUDE.md with the AIgile section');
    return 'created';
  }
  const existing = read(target);
  const startIdx = existing.indexOf(AIGILE_MD_START);
  const endIdx = existing.indexOf(AIGILE_MD_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const next = existing.slice(0, startIdx) + block + existing.slice(endIdx + AIGILE_MD_END.length);
    write(target, next);
    console.log('✅ Updated the AIgile section in CLAUDE.md');
    return 'updated';
  }
  write(target, `${existing.replace(/\s*$/, '')}\n\n${block}\n`);
  console.log('✅ Appended the AIgile section to CLAUDE.md');
  return 'appended';
}

/**
 * Convert mcp/servers.json into a project-scoped .mcp.json for Claude Code.
 * Claude Code uses the `mcpServers` key and has no VS Code style `${input:...}`
 * prompts, so those become plain environment-variable references.
 */
function writeClaudeMcpJson(dest) {
  const target = path.join(dest, '.mcp.json');
  const doc = readJsonIfExists(path.join(root, 'mcp', 'servers.json'));
  if (!doc || !doc.servers) {
    console.warn('⚠️ mcp/servers.json not found — skipped .mcp.json');
    return false;
  }
  const toEnvRef = (v) => typeof v === 'string'
    ? v.replace(/\$\{input:([A-Za-z0-9_.-]+)\}/g, (_m, id) => `\${${id.replace(/[.-]/g, '_').toUpperCase()}}`)
    : v;

  const existing = readJsonIfExists(target) || {};
  const mcpServers = { ...(existing.mcpServers || {}) };
  const referencedVars = new Set();
  const noteVars = (value) => {
    if (typeof value !== 'string') return;
    for (const m of value.matchAll(/\$\{([A-Z0-9_]+)\}/g)) referencedVars.add(m[1]);
  };

  for (const [id, cfg] of Object.entries(doc.servers)) {
    const next = {};
    if (cfg.url) {
      next.type = cfg.type === 'sse' ? 'sse' : 'http';
      next.url = toEnvRef(cfg.url);
      noteVars(next.url);
    } else {
      next.type = 'stdio';
      if (cfg.command) next.command = cfg.command;
      if (Array.isArray(cfg.args)) {
        next.args = cfg.args.map(toEnvRef);
        next.args.forEach(noteVars);
      }
    }
    if (cfg.env) {
      next.env = {};
      for (const [k, v] of Object.entries(cfg.env)) {
        next.env[k] = toEnvRef(v);
        noteVars(next.env[k]);
      }
    }
    if (cfg.headers) {
      next.headers = {};
      for (const [k, v] of Object.entries(cfg.headers)) {
        next.headers[k] = toEnvRef(v);
        noteVars(next.headers[k]);
      }
    }
    mcpServers[id] = { ...(mcpServers[id] || {}), ...next };
  }

  write(target, JSON.stringify({ ...existing, mcpServers }, null, 2) + '\n');
  console.log('✅ Installed MCP servers into .mcp.json');
  if (referencedVars.size) {
    console.log(`   Set these before starting Claude Code: ${Array.from(referencedVars).sort().join(', ')}`);
  }
  console.log('   Claude Code asks once per project before it trusts .mcp.json servers.');
  return true;
}

/**
 * Merge AIgile's settings into .claude/settings.json without removing anything
 * already there. Deliberately conservative: it only pre-approves reads of the
 * framework's own files so agents stop prompting for their task definitions.
 */
function writeClaudeSettings(dest) {
  const target = path.join(dest, '.claude', 'settings.json');
  const existing = readJsonIfExists(target) || {};
  const wanted = [
    'Read(./.aigile-core/**)',
    'Glob(./.aigile-core/**)',
    'Grep(./.aigile-core/**)',
  ];
  const permissions = { ...(existing.permissions || {}) };
  const allow = Array.isArray(permissions.allow) ? [...permissions.allow] : [];
  let added = 0;
  for (const rule of wanted) {
    if (!allow.includes(rule)) { allow.push(rule); added++; }
  }
  permissions.allow = allow;
  write(target, JSON.stringify({ ...existing, permissions }, null, 2) + '\n');
  console.log(`✅ Updated .claude/settings.json (${added} permission rule${added === 1 ? '' : 's'} added)`);
  return added;
}

/**
 * Install AIgile for Claude Code.
 * Creates .aigile-core/, .claude/agents/, .claude/skills/, CLAUDE.md and
 * .claude/settings.json.
 */
function installClaudeCode(dest) {
  const target = claudeTarget('project');

  // 1) Copy core to .aigile-core (shared with the other platforms)
  const srcCore = path.join(root, 'core');
  const dstCore = path.join(dest, '.aigile-core');
  if (fs.existsSync(srcCore)) copyDir(srcCore, dstCore);

  // 2) Subagents
  const agentsSrcDir = path.join(srcCore, 'agents');
  const agentsDir = path.join(dest, '.claude', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  const agentSources = collectAgentSources(agentsSrcDir);
  const allAgents = [];

  for (const [agentId, file] of agentSources) {
    const agentMd = read(path.join(agentsSrcDir, file));
    const summary = claudeAgentSummary(agentId, agentMd);
    allAgents.push({ id: summary.id, title: summary.title, description: summary.description });
    write(path.join(agentsDir, `${agentId}.md`), generateClaudeAgent({
      agentId,
      agentMeta: summary.agentMeta,
      agentMd,
      tasks: listTasksForAgent(agentId),
      target,
    }));
  }
  console.log(`✅ Created ${allAgents.length} subagents in .claude/agents/`);

  // 3) Skills — AIgile core skills, per-command workflows, delivery workflows, index
  const workflows = collectAigileWorkflows();
  const skills = writeClaudeSkills({
    skillsDir: path.join(dest, '.claude', 'skills'),
    agents: allAgents,
    agentSources,
    workflows,
    target,
    prune: true,
  });
  console.log(`✅ Created ${skills.total} skills in .claude/skills/ (${skills.core} AIgile, ${skills.commandSkills} agent workflows, ${skills.workflowSkills} delivery workflows, 1 index)`);

  // 4) Always-on project context
  writeClaudeMd(dest, generateClaudeMdSection({ agents: allAgents, workflows, target }));

  // 5) Project settings
  writeClaudeSettings(dest);

  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  console.log(green('✅ Installed AIgile for Claude Code into'), dest);

  return { agents: allAgents.length, skills, workflows: workflows.length };
}

// ---------------------------------------------------------------------------
// Claude Code plugin build
// A plugin is the zero-install path: users add this repo as a marketplace and
// install `aigile`, which brings the agents and skills with it. Everything under
// plugin/ is generated — edit core/ and re-run `aigile bundle`.
// ---------------------------------------------------------------------------

const CLAUDE_PLUGIN_DIR = 'plugin';
const CLAUDE_PLUGIN_NAME = 'aigile';
const CLAUDE_MARKETPLACE_NAME = 'aigile-method';

function generateClaudePluginReadme({ agentCount, skills, workflows }) {
  return [
    '# AIgile Method — Claude Code plugin',
    '',
    '> Generated by `aigile bundle`. Do not edit by hand — the source of truth is `core/`',
    '> in the [AIgile Method repository](https://github.com/Gmark2000/AIgile-Method).',
    '',
    '## Install',
    '',
    '```',
    `/plugin marketplace add Gmark2000/AIgile-Method`,
    `/plugin install ${CLAUDE_PLUGIN_NAME}@${CLAUDE_MARKETPLACE_NAME}`,
    '```',
    '',
    '## What you get',
    '',
    `- **${agentCount} specialist subagents** — delegate with the \`Task\` tool, e.g. \`subagent_type: "po"\`.`,
    `- **${skills.commandSkills} per-role workflows** — \`/aigile:dev-develop-story\`, \`/aigile:qa-quality-gate\`, ...`,
    `- **${workflows} delivery workflows** — \`/aigile:workflow-greenfield-fullstack\` and friends.`,
    `- **${skills.core} AIgile skills** that activate automatically when a request matches.`,
    '- `/aigile:method` — routing help when you are not sure who should do the work.',
    '',
    '## MCP servers',
    '',
    'The plugin ships no MCP servers, so nothing tries to start Docker behind your back.',
    'To wire up Jira, Confluence, GitHub, Figma or Playwright for the AIgile agents, run:',
    '',
    '```',
    'npx @mark-gozner/aigile-method install --for-claude --with-mcp',
    '```',
    '',
    'That writes a project `.mcp.json` alongside the framework resources in `.aigile-core/`.',
    '',
  ].join('\n');
}

/**
 * Build the distributable Claude Code plugin and the marketplace entry that
 * points at it. Called from `bundle()`.
 */
function buildClaudePlugin() {
  const target = claudeTarget('plugin');
  const pluginRoot = path.join(root, CLAUDE_PLUGIN_DIR);

  // Everything below is generated; clear it so deletions in core/ propagate.
  for (const sub of ['agents', 'skills', 'core', '.claude-plugin']) {
    fs.rmSync(path.join(pluginRoot, sub), { recursive: true, force: true });
  }

  const srcCore = path.join(root, 'core');
  const agentSources = collectAgentSources(path.join(srcCore, 'agents'));
  const allAgents = [];

  for (const [agentId, file] of agentSources) {
    const agentMd = read(path.join(srcCore, 'agents', file));
    const summary = claudeAgentSummary(agentId, agentMd);
    allAgents.push({ id: summary.id, title: summary.title, description: summary.description });
    write(path.join(pluginRoot, 'agents', `${agentId}.md`), generateClaudeAgent({
      agentId,
      agentMeta: summary.agentMeta,
      agentMd,
      tasks: listTasksForAgent(agentId),
      target,
    }));
  }

  const workflows = collectAigileWorkflows();
  const skills = writeClaudeSkills({
    skillsDir: path.join(pluginRoot, 'skills'),
    agents: allAgents,
    agentSources,
    workflows,
    target,
  });

  // The plugin carries its own copy of the framework resources, reached from
  // skills and agents through ${CLAUDE_PLUGIN_ROOT}.
  for (const bucket of ['tasks', 'templates', 'checklists', 'data', 'workflows']) {
    const from = path.join(srcCore, bucket);
    if (fs.existsSync(from)) copyDir(from, path.join(pluginRoot, 'core', bucket));
  }

  const version = getPackageVersion();
  const pluginJson = {
    name: CLAUDE_PLUGIN_NAME,
    version,
    description: 'AIgile Development Method — specialist agents, per-role workflows, and end-to-end delivery sequences.',
    author: { name: 'Mark Gozner', url: 'https://github.com/Gmark2000' },
    homepage: 'https://github.com/Gmark2000/AIgile-Method',
    repository: 'https://github.com/Gmark2000/AIgile-Method',
    license: 'SEE LICENSE',
    keywords: ['agile', 'agents', 'scrum', 'workflow', 'qa', 'architecture', 'product'],
  };
  write(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), JSON.stringify(pluginJson, null, 2) + '\n');
  write(path.join(pluginRoot, 'README.md'), generateClaudePluginReadme({
    agentCount: allAgents.length,
    skills,
    workflows: workflows.length,
  }));

  const marketplace = {
    name: CLAUDE_MARKETPLACE_NAME,
    owner: { name: 'Mark Gozner', url: 'https://github.com/Gmark2000' },
    metadata: {
      description: 'The AIgile Development Method for Claude Code.',
      version: version,
    },
    plugins: [
      {
        name: CLAUDE_PLUGIN_NAME,
        source: `./${CLAUDE_PLUGIN_DIR}`,
        description: pluginJson.description,
        version,
        author: pluginJson.author,
        homepage: pluginJson.homepage,
        license: pluginJson.license,
        keywords: pluginJson.keywords,
      },
    ],
  };
  write(path.join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify(marketplace, null, 2) + '\n');

  console.log(`✅ Wrote ${CLAUDE_PLUGIN_DIR}/ Claude Code plugin (${allAgents.length} agents, ${skills.total} skills)`);
  console.log('✅ Wrote .claude-plugin/marketplace.json');
  return { agents: allAgents.length, skills, workflows: workflows.length };
}

// ---------------------------------------------------------------------------
// Agent Skills (https://agentskills.io) — Kiro reads them from .kiro/skills/
// ---------------------------------------------------------------------------

/** Load the curated third-party skill registry shipped with AIgile. */
function loadSkillsRegistry() {
  const doc = readJsonIfExists(path.join(root, 'core', 'skills-registry.json'));
  return Array.isArray(doc?.skills) ? doc.skills : [];
}

/**
 * Copy the AIgile-authored skills (core/skills/<name>/SKILL.md) into .kiro/skills/.
 * Returns the number of skills installed.
 */
function installKiroSkills(dest) {
  const srcSkills = path.join(root, 'core', 'skills');
  if (!fs.existsSync(srcSkills)) return 0;
  const dstSkills = path.join(dest, '.kiro', 'skills');
  let count = 0;
  for (const entry of fs.readdirSync(srcSkills, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!fs.existsSync(path.join(srcSkills, entry.name, 'SKILL.md'))) continue;
    copyDir(path.join(srcSkills, entry.name), path.join(dstSkills, entry.name));
    count++;
  }
  if (count) console.log(`✅ Created ${count} AIgile skills in .kiro/skills/`);
  return count;
}

/** Fetch (and memoize) a repo file tree from the GitHub API. */
const githubTreeCache = new Map();
async function fetchGithubTree(repo, ref) {
  const key = `${repo}@${ref}`;
  if (githubTreeCache.has(key)) return githubTreeCache.get(key);
  const url = `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aigile-method-installer',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${repo}@${ref}${res.status === 403 ? ' (rate limited — set GITHUB_TOKEN)' : ''}`);
  }
  const json = await res.json();
  const tree = Array.isArray(json.tree) ? json.tree : [];
  githubTreeCache.set(key, tree);
  return tree;
}

const SKILL_MAX_FILE_BYTES = 1024 * 1024; // 1 MB
const SKILL_MAX_FILES = 80;

/**
 * Download one registry skill from its source repository into `skillsDir`.
 * Writes an ATTRIBUTION.md next to the skill recording source, author, and license.
 */
async function fetchCommunitySkill(entry, skillsDir) {
  const folder = path.basename(entry.path);
  const tree = await fetchGithubTree(entry.repo, entry.ref || 'main');
  const prefix = `${entry.path.replace(/\/+$/, '')}/`;
  const blobs = tree.filter(n => n.type === 'blob' && n.path.startsWith(prefix));
  if (!blobs.length) throw new Error(`no files found at ${entry.repo}/${entry.path}`);
  if (!blobs.some(b => b.path === `${prefix}SKILL.md`)) throw new Error(`no SKILL.md at ${entry.repo}/${entry.path}`);
  if (blobs.length > SKILL_MAX_FILES) throw new Error(`skill has ${blobs.length} files (limit ${SKILL_MAX_FILES})`);

  const targetDir = path.join(skillsDir, folder);
  let written = 0;
  for (const blob of blobs) {
    if (typeof blob.size === 'number' && blob.size > SKILL_MAX_FILE_BYTES) {
      console.warn(`   ⚠️ skipped oversized file ${blob.path} (${blob.size} bytes)`);
      continue;
    }
    const rel = blob.path.slice(prefix.length);
    // Defend against path traversal from a hostile tree listing
    const outPath = path.join(targetDir, rel);
    if (!path.resolve(outPath).startsWith(path.resolve(targetDir) + path.sep)) {
      console.warn(`   ⚠️ skipped suspicious path ${blob.path}`);
      continue;
    }
    const rawUrl = `https://raw.githubusercontent.com/${entry.repo}/${entry.ref || 'main'}/${blob.path.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(rawUrl, { headers: { 'User-Agent': 'aigile-method-installer' } });
    if (!res.ok) throw new Error(`download failed (${res.status}) for ${blob.path}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buf);
    written++;
  }

  const attribution = [
    `# ${entry.title || folder} — attribution`,
    '',
    `This skill is **not** part of AIgile. It was downloaded from its source repository by`,
    '`aigile skills:add` and is redistributed here only inside your workspace.',
    '',
    `- Source: ${entry.homepage || `https://github.com/${entry.repo}`}`,
    `- Repository path: \`${entry.repo}@${entry.ref || 'main'}:${entry.path}\``,
    `- Author: ${entry.author || 'see repository'}`,
    `- License: ${entry.license || 'see repository'}`,
    `- Retrieved: ${new Date().toISOString()}`,
    '',
    'Review the upstream license before redistributing. Update with `aigile skills:add ' + entry.id + '`.',
    '',
  ].join('\n');
  write(path.join(targetDir, 'ATTRIBUTION.md'), attribution);

  return { id: entry.id, folder, files: written };
}

/**
 * Add community skills by registry id. `ids` may be ['--all'] or ['--recommended'].
 */
async function addCommunitySkills(ids, { dest = process.cwd(), globalScope = false } = {}) {
  const registry = loadSkillsRegistry();
  if (!registry.length) {
    console.warn('⚠️ No skills registry found (core/skills-registry.json).');
    return { added: [], failed: [] };
  }
  let selected;
  if (!ids.length || ids.includes('--recommended')) {
    selected = registry.filter(s => s.recommended);
  } else if (ids.includes('--all')) {
    selected = registry;
  } else {
    selected = [];
    for (const id of ids) {
      const found = registry.find(s => s.id === id);
      if (found) selected.push(found);
      else console.warn(`⚠️ Unknown skill id: ${id} (run \`aigile skills:list\`)`);
    }
  }
  if (!selected.length) return { added: [], failed: [] };

  const skillsDir = globalScope
    ? path.join(getUserHome(), '.kiro', 'skills')
    : path.join(dest, '.kiro', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  console.log(`\nFetching ${selected.length} community skill(s) into ${skillsDir}`);
  console.log(yellow('These are third-party skills fetched from public GitHub repositories. Review them before use.'));

  const added = [];
  const failed = [];
  for (const entry of selected) {
    try {
      const result = await fetchCommunitySkill(entry, skillsDir);
      added.push(result);
      console.log(`  ✅ ${entry.id} (${result.files} files) — ${entry.license || 'see repository'}, ${entry.author || 'see repository'}`);
    } catch (e) {
      failed.push({ id: entry.id, error: e.message });
      console.warn(`  ⚠️ ${entry.id}: ${e.message}`);
    }
  }
  return { added, failed };
}

function skillsListCommand() {
  const registry = loadSkillsRegistry();
  const bundledDir = path.join(root, 'core', 'skills');
  const bundled = fs.existsSync(bundledDir)
    ? fs.readdirSync(bundledDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    : [];

  console.log('\nAIgile skills (installed with --for-kiro into .kiro/skills/):');
  for (const name of bundled) console.log(`  - ${name}`);

  console.log('\nCommunity skills (fetch with `aigile skills:add <id>`):');
  for (const s of registry) {
    const star = s.recommended ? '*' : ' ';
    console.log(`  ${star} ${s.id.padEnd(22)} ${s.title} — ${s.license || 'see repository'} (${s.author || 'see repository'})`);
    console.log(`    ${s.description}`);
    console.log(`    ${s.homepage || `https://github.com/${s.repo}`}`);
  }
  console.log('\n  * = fetched by `aigile skills:add` with no arguments, and by `install --with-community-skills`');
  console.log('  Flags: --all (every registry skill), --global (install into ~/.kiro/skills)');
}

/**
 * Install AIgile for Kiro.
 * Creates .aigile-core/, .kiro/agents/, .kiro/steering/ and .kiro/skills/.
 */
function installKiro(dest) {
  // 1) Copy core to .aigile-core (shared with the other platforms)
  const srcCore = path.join(root, 'core');
  const dstCore = path.join(dest, '.aigile-core');
  if (fs.existsSync(srcCore)) copyDir(srcCore, dstCore);

  // 2) Generate Kiro custom agents
  const agentsSrcDir = path.join(srcCore, 'agents');
  const kiroAgentsDir = path.join(dest, '.kiro', 'agents');
  const kiroSteeringDir = path.join(dest, '.kiro', 'steering');
  fs.mkdirSync(kiroAgentsDir, { recursive: true });
  fs.mkdirSync(kiroSteeringDir, { recursive: true });

  const allAgents = [];
  let steeringCount = 0;

  if (fs.existsSync(agentsSrcDir)) {
    const files = fs.readdirSync(agentsSrcDir).filter(f => f.endsWith('.md'));
    // Prefer the source `.md` definition over the native `.agent.md` variant
    const agentMap = new Map();
    for (const f of files) {
      const isNativeAgent = f.endsWith('.agent.md');
      const agentId = isNativeAgent ? f.replace(/\.agent\.md$/, '') : f.replace(/\.[^/.]+$/, '');
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, f);
      } else if (!isNativeAgent && agentMap.get(agentId).endsWith('.agent.md')) {
        agentMap.set(agentId, f);
      }
    }

    for (const agentId of Array.from(agentMap.keys()).sort()) {
      const agentMd = read(path.join(agentsSrcDir, agentMap.get(agentId)));
      const agentMeta = extractAgentMeta(agentMd);
      // Native `.agent.md` sources carry their identity in YAML frontmatter, not in a
      // fenced YAML block, so fill the gaps from there.
      const fmMeta = extractFrontmatterMeta(agentMd);
      if (!agentMeta.title && fmMeta.title) agentMeta.title = fmMeta.title;
      if (!agentMeta.whenToUse && fmMeta.description) agentMeta.whenToUse = fmMeta.description;
      const agentTitle = kiroifyText(agentMeta.title || agentMeta.agentRole || toTitleCase(agentId));
      allAgents.push({
        id: agentId,
        title: agentTitle,
        description: yamlSingleLine(kiroifyText(agentMeta.whenToUse || `${agentTitle} responsibilities and workflows.`)),
      });

      write(path.join(kiroAgentsDir, `${agentId}.md`), generateKiroAgent({
        agentId,
        agentMeta,
        agentMd,
        tasks: listTasksForAgent(agentId),
      }));

      const workflowSteering = generateKiroWorkflowSteering(agentId);
      if (workflowSteering) {
        // Avoid `aigile-aigile-*` slash commands for the aigile-prefixed agents
        const slug = `aigile-${agentId.replace(/^aigile-/, '')}-workflows`;
        write(path.join(kiroSteeringDir, `${slug}.md`), workflowSteering);
        steeringCount++;
      }
    }
  }

  // 3) Always-on framework steering
  write(path.join(kiroSteeringDir, 'aigile-method.md'), generateKiroSteering(allAgents));
  steeringCount++;

  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  console.log(`✅ Created ${allAgents.length} custom agents in .kiro/agents/`);
  console.log(`✅ Created ${steeringCount} steering files in .kiro/steering/`);

  // 4) AIgile-authored Agent Skills
  const skills = installKiroSkills(dest);

  console.log(green('✅ Installed AIgile for Kiro into'), dest);

  return { agents: allAgents.length, steering: steeringCount, skills };
}

function installGithubCopilot(dest, { addJavaInstructions = false, useLegacyFormat = false } = {}) {
  // 1) Copy core to .aigile-core (clean, IDE-friendly)
  const srcCore = path.join(root, 'core');
  const dstCore = path.join(dest, '.aigile-core');
  if (fs.existsSync(srcCore)) {
    copyDir(srcCore, dstCore);
  }
  // 2) Generate GitHub Copilot custom agents in .github/agents/ (new format)
  //    Or legacy chatmodes in .github/chatmodes/ if explicitly requested
  const agentsDir = path.join(srcCore, 'agents');
  const outputDir = useLegacyFormat
    ? path.join(dest, '.github', 'chatmodes')
    : path.join(dest, '.github', 'agents');
  fs.mkdirSync(outputDir, { recursive: true });
  const mcpCatalog = buildMcpCatalog();
  const generatedAgents = [];
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const agentPath = path.join(agentsDir, f);
      const agentMd = read(agentPath);
      // Handle both new .agent.md and legacy .md formats
      const isNativeAgent = f.endsWith('.agent.md');
      const agentId = isNativeAgent ? f.replace(/\.agent\.md$/, '') : f.replace(/\.[^/.]+$/, '');
      const agentMeta = extractAgentMeta(agentMd);
      const tools = [];
      const allTasks = listTasksForAgent(agentId);
      const allChecklists = []; // Use only agent-specific checklists from relevantDependencies()

      // If already in native .agent.md format, copy directly (rewriting the
      // `tools:` block to the new two-line format for the orchestrator pair so
      // its block-style YAML list becomes the canonical custom-agent format).
      if (isNativeAgent && !useLegacyFormat) {
        const outName = f;
        const needsRewrite = (agentId === 'aigile-orchestrator' || agentId === 'aigile-manual-orchestrator');
        const finalContent = needsRewrite ? rewriteAgentFrontmatterTools(agentMd) : agentMd;
        write(path.join(outputDir, outName), finalContent);
        generatedAgents.push({ id: agentId, format: 'native' });
        continue;
      }

      // Generate structured agent/chatmode file
      const outContent = useLegacyFormat
        ? generateStructuredChatmode({
          agentId,
          agentMeta,
          agentMd,
          tools,
          tasks: allTasks,
          checklists: allChecklists,
        })
        : generateCustomAgent({
          agentId,
          agentMeta,
          agentMd,
          tools,
          tasks: allTasks,
          checklists: allChecklists,
        });
      const outName = useLegacyFormat
        ? `${kebabCaseName(f)}.chatmode.md`
        : `${kebabCaseName(f)}.agent.md`;
      write(path.join(outputDir, outName), outContent);
      generatedAgents.push({ id: agentId, format: useLegacyFormat ? 'chatmode' : 'agent' });
    }
  }
  console.log(`✅ Created ${generatedAgents.length} custom ${useLegacyFormat ? 'chatmodes' : 'agents'} in ${useLegacyFormat ? '.github/chatmodes' : '.github/agents'}/`);
  // Copy core prompts into consumer .github/prompts for convenience (if provided in repo)
  try {
    const promptsSrc = path.join(root, 'core', 'prompts');
    const promptsDst = path.join(dest, '.github', 'prompts');
    if (fs.existsSync(promptsSrc)) {
      copyDir(promptsSrc, promptsDst);
      console.log('✅ Copied prompts to .github/prompts');
    }
  } catch (e) { /* non-fatal */ }
  let javaInstructionsCopied = false;
  if (addJavaInstructions) {
    try {
      const javaSrc = path.join(root, 'core', 'instructions', 'java.instructions.md');
      if (fs.existsSync(javaSrc)) {
        const instructionsDir = path.join(dest, '.github', 'instructions');
        fs.mkdirSync(instructionsDir, { recursive: true });
        fs.copyFileSync(javaSrc, path.join(instructionsDir, 'java.instructions.md'));
        javaInstructionsCopied = true;
      } else {
        console.warn('⚠️ Java instructions template not found at core/instructions/java.instructions.md');
      }
    } catch (e) {
      console.warn('⚠️ Failed to copy Java instructions:', e.message);
    }
  }
  const color = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
  const green = color(32);
  if (javaInstructionsCopied) console.log(green('✅ Added Java instructions to .github/instructions'));
  console.log(green('✅ Installed AIgile for GitHub Copilot into'), dest);
}

function maybeAddConsumerScripts(dest) {
  if (process.env.AIGILE_ADD_SCRIPTS === '0') return;
  const pkgPath = path.join(dest, 'package.json');
  if (!fs.existsSync(pkgPath)) return; // consumer has no package.json
  try {
    const pkg = JSON.parse(read(pkgPath));
    pkg.scripts = pkg.scripts || {};
    let changed = false;
    const additions = {
      'aigile:install': 'aigile-method install --yes',
      'aigile:bundle': 'aigile-method bundle',
      'aigile:status': 'aigile-method status',
      'aigile:list': 'aigile-method list:agents'
    };
    for (const [k, v] of Object.entries(additions)) {
      if (!pkg.scripts[k]) { pkg.scripts[k] = v; changed = true; }
    }
    if (changed) write(pkgPath, JSON.stringify(pkg, null, 2));
  } catch { /* ignore */ }
}

function writeManifest(dest, { addMcpJson = false, addMcpSettings = false, addJavaInstructions = false, forAntigravity = false, forKiro = false, forClaude = false } = {}) {
  try {
    const manifest = {
      name: '@mark-gozner/aigile-method',
      version: getPackageVersion(),
      installedAt: new Date().toISOString(),
      format: 'agents', // New format indicator
      agents: [],
      customAgents: 0,
      chatModes: 0, // Legacy
      prompts: 0,
      mcp: { serversJson: !!addMcpJson, mockSettings: !!addMcpSettings },
      instructions: { java: !!addJavaInstructions },
      features: {
        customAgents: true,
        handoffs: true,
        runSubagent: true,
        mcp: !!addMcpJson
      }
    };
    const agentsDir = path.join(dest, '.aigile-core', 'agents');
    if (fs.existsSync(agentsDir)) {
      // `<id>.md` and `<id>.agent.md` are two source formats for the same agent.
      manifest.agents = Array.from(new Set(
        fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.agent\.md$/, '').replace(/\.md$/, ''))
      )).sort();
    }
    // Count new custom agents format
    const customAgentsDir = path.join(dest, '.github', 'agents');
    if (fs.existsSync(customAgentsDir)) {
      manifest.customAgents = fs.readdirSync(customAgentsDir).filter(f => f.endsWith('.agent.md')).length;
    }
    // Count legacy chatmodes
    const chatModesDir = path.join(dest, '.github', 'chatmodes');
    if (fs.existsSync(chatModesDir)) {
      manifest.chatModes = fs.readdirSync(chatModesDir).filter(f => f.endsWith('.chatmode.md')).length;
    }
    const promptsDir = path.join(dest, '.github', 'prompts');
    if (fs.existsSync(promptsDir)) {
      manifest.prompts = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md') || f.endsWith('.prompt.md') || f.endsWith('.txt')).length;
    }
    // Antigravity output tracking
    if (forAntigravity) {
      const rulesDir = path.join(dest, '.agent', 'rules');
      const workflowsDir = path.join(dest, '.agent', 'workflows');
      manifest.antigravity = {
        rules: fs.existsSync(rulesDir) ? fs.readdirSync(rulesDir).filter(f => f.endsWith('.md')).length : 0,
        workflows: fs.existsSync(workflowsDir) ? fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md')).length : 0,
        geminiMd: fs.existsSync(path.join(dest, 'GEMINI.md'))
      };
    }
    // Kiro output tracking
    if (forKiro) {
      const kiroAgentsDir = path.join(dest, '.kiro', 'agents');
      const kiroSteeringDir = path.join(dest, '.kiro', 'steering');
      const kiroSkillsDir = path.join(dest, '.kiro', 'skills');
      const skillDirs = fs.existsSync(kiroSkillsDir)
        ? fs.readdirSync(kiroSkillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
        : [];
      manifest.kiro = {
        agents: fs.existsSync(kiroAgentsDir) ? fs.readdirSync(kiroAgentsDir).filter(f => f.endsWith('.md')).length : 0,
        steering: fs.existsSync(kiroSteeringDir) ? fs.readdirSync(kiroSteeringDir).filter(f => f.startsWith('aigile-') && f.endsWith('.md')).length : 0,
        skills: skillDirs.length,
        aigileSkills: skillDirs.filter(n => n.startsWith('aigile-')).length,
        communitySkills: skillDirs.filter(n => !n.startsWith('aigile-')).length,
        mcpJson: fs.existsSync(path.join(dest, '.kiro', 'settings', 'mcp.json'))
      };
    }
    // Claude Code output tracking
    if (forClaude) {
      const claudeAgentsDir = path.join(dest, '.claude', 'agents');
      const claudeSkillsDir = path.join(dest, '.claude', 'skills');
      const skillDirs = fs.existsSync(claudeSkillsDir)
        ? fs.readdirSync(claudeSkillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
        : [];
      // The AIgile-authored skills keep their source names, so anything else with
      // the `aigile-` prefix is a generated per-role workflow.
      const coreSkillDir = path.join(root, 'core', 'skills');
      const coreSkillNames = fs.existsSync(coreSkillDir)
        ? fs.readdirSync(coreSkillDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
        : [];
      manifest.claude = {
        agents: fs.existsSync(claudeAgentsDir) ? fs.readdirSync(claudeAgentsDir).filter(f => f.endsWith('.md')).length : 0,
        skills: skillDirs.length,
        aigileSkills: skillDirs.filter(nm => coreSkillNames.includes(nm)).length,
        agentWorkflows: skillDirs.filter(nm => nm.startsWith('aigile-') && !nm.startsWith('aigile-workflow-') && !coreSkillNames.includes(nm)).length,
        deliveryWorkflows: skillDirs.filter(nm => nm.startsWith('aigile-workflow-')).length,
        claudeMd: fs.existsSync(path.join(dest, 'CLAUDE.md')),
        settings: fs.existsSync(path.join(dest, '.claude', 'settings.json')),
        mcpJson: fs.existsSync(path.join(dest, '.mcp.json'))
      };
    }
    write(path.join(dest, '.aigile-manifest.json'), JSON.stringify(manifest, null, 2));
  } catch { /* ignore */ }
}

function showStatus(cwd) {
  const manifestPath = path.join(cwd, '.aigile-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('No AIgile installation manifest found in this directory. Run `aigile-method install --yes` to initialize.');
    return;
  }
  try {
    const data = JSON.parse(read(manifestPath));
    console.log('\nAIgile Installation Status');
    console.log('---------------------------');
    console.log(`Version:        ${data.version}`);
    console.log(`Installed At:   ${data.installedAt}`);
    console.log(`Format:         ${data.format || 'legacy'}`);
    console.log(`Agents:         ${data.agents?.length || 0}`);
    console.log(`Custom Agents:  ${data.customAgents || 0}`);
    if (data.chatModes > 0) console.log(`Chat Modes:     ${data.chatModes} (legacy)`);
    if (typeof data.prompts !== 'undefined') console.log(`Prompts:        ${data.prompts}`);
    console.log(`MCP Servers:    ${data.mcp?.serversJson ? 'yes' : 'no'}`);
    console.log(`MCP Mock Sets:  ${data.mcp?.mockSettings ? 'yes' : 'no'}`);
    if (data.instructions) {
      console.log(`Java Instructions: ${data.instructions.java ? 'yes' : 'no'}`);
    }
    if (data.features) {
      console.log('\nFeatures:');
      console.log(`  - Custom Agents: ${data.features.customAgents ? 'yes' : 'no'}`);
      console.log(`  - Handoffs: ${data.features.handoffs ? 'yes' : 'no'}`);
      console.log(`  - runSubagent: ${data.features.runSubagent ? 'yes' : 'no'}`);
    }
    if (data.antigravity) {
      console.log('\nAntigravity:');
      console.log(`  - Rules: ${data.antigravity.rules || 0}`);
      console.log(`  - Workflows: ${data.antigravity.workflows || 0}`);
      console.log(`  - GEMINI.md: ${data.antigravity.geminiMd ? 'yes' : 'no'}`);
    }
    if (data.kiro) {
      console.log('\nKiro:');
      console.log(`  - Custom Agents: ${data.kiro.agents || 0}`);
      console.log(`  - Steering Files: ${data.kiro.steering || 0}`);
      console.log(`  - Skills: ${data.kiro.skills || 0} (AIgile: ${data.kiro.aigileSkills || 0}, community: ${data.kiro.communitySkills || 0})`);
      console.log(`  - MCP Config: ${data.kiro.mcpJson ? 'yes' : 'no'}`);
    }
    if (data.claude) {
      console.log('\nClaude Code:');
      console.log(`  - Subagents: ${data.claude.agents || 0}`);
      console.log(`  - Skills: ${data.claude.skills || 0} (AIgile: ${data.claude.aigileSkills || 0}, agent workflows: ${data.claude.agentWorkflows || 0}, delivery workflows: ${data.claude.deliveryWorkflows || 0})`);
      console.log(`  - CLAUDE.md: ${data.claude.claudeMd ? 'yes' : 'no'}`);
      console.log(`  - Project settings: ${data.claude.settings ? 'yes' : 'no'}`);
      console.log(`  - MCP Config: ${data.claude.mcpJson ? 'yes' : 'no'}`);
    }
    if (data.agents?.length) {
      console.log('\nAgents:');
      console.log('  ' + data.agents.join(', '));
    }
  } catch (e) {
    console.log('Corrupt manifest file. Re-run install to regenerate.');
  }
}

function listAgentsCommand(cwd) {
  const agentsDir = path.join(cwd, '.aigile-core', 'agents');
  if (!fs.existsSync(agentsDir)) {
    console.log('No .aigile-core/agents directory found. Run install first.');
    return;
  }
  const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
  if (!agents.length) { console.log('No agents installed.'); return; }
  console.log('Installed agents:');
  for (const a of agents) console.log('  - ' + a);
}

function parseFlags(argv) {
  const flags = new Set();
  const args = [];
  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a);
    else args.push(a);
  }
  return { flags, args };
}

function writeMockMcp(dest) {
  // Always also write VS Code settings for MCP endpoints
  const vscodeDir = path.join(dest, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  const vscodeSettingsPath = path.join(vscodeDir, 'settings.json');
  let settings = {};
  if (fs.existsSync(vscodeSettingsPath)) {
    try { settings = JSON.parse(read(vscodeSettingsPath)); } catch { }
  }
  // Enable custom agent as subagent (experimental) - required for orchestrator delegation
  settings['chat.customAgentInSubagent.enabled'] = true;
  settings['aigile.mcp.enabled'] = true;
  settings['aigile.mcp.servers'] = {
    sequentialthinking: {
      enabled: true,
      url: 'https://mock.sequentialthinking.local',
      apiKey: 'MOCK_SEQ_KEY'
    },
    context7: {
      enabled: true,
      url: 'https://mock.context7.local',
      apiKey: 'MOCK_CTX_KEY'
    },
    atlassian: {
      enabled: true,
      url: 'https://mock.atlassian.local',
      email: 'user@example.com',
      apiToken: 'MOCK_ATL_TOKEN',
      products: ['jira', 'confluence'],
      jira: {
        cloudBaseUrl: 'https://yourcompany.atlassian.net',
        projectKeysAllowlist: ['ENG']
      },
      confluence: {
        cloudBaseUrl: 'https://yourcompany.atlassian.net/wiki',
        spacesAllowlist: ['ENG']
      }
    },
    github: {
      enabled: true,
      url: 'https://mock.github-mcp.local',
      token: 'MOCK_GH_TOKEN',
      orgAllowlist: ['your-org'],
      repoReadAllowlist: ['your-org/*']
    },
    figma: {
      enabled: true,
      url: 'https://mock.figma-mcp.local',
      personalAccessToken: 'MOCK_FIGMA_TOKEN',
      teamAllowlist: ['Design Systems']
    }
  };
  write(vscodeSettingsPath, JSON.stringify(settings, null, 2));
  console.log('✅ Updated .vscode/settings.json with mock MCP servers');
}

function writeMcpJson(dest) {
  // Install MCP servers by copying from repo mcp/servers.json into .vscode/mcp.json (preferred)
  const vscodeDir = path.join(dest, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  const mcpPath = path.join(vscodeDir, 'mcp.json');
  const repoServersJson = path.join(root, 'mcp', 'servers.json');
  if (fs.existsSync(repoServersJson)) {
    write(mcpPath, read(repoServersJson));
    console.log('✅ Installed MCP servers from mcp/servers.json into .vscode/mcp.json');
    return;
  }
  // Fallback minimal template if repo JSON is missing
  const tpl = {
    servers: {
      "github.com": {
        command: "docker",
        args: [
          "run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "-e", "GITHUB_DYNAMIC_TOOLSETS", "ghcr.io/github/github-mcp-server"
        ],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: "${input:github_com_personal_access_token}",
          GITHUB_DYNAMIC_TOOLSETS: "1"
        }
      },
      sequentialthinking: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        env: { SEQUENTIAL_THINKING_MAX_STEPS: "8" }
      },
      context7: {
        command: "npx",
        args: ["-y", "@context7/mcp-server"],
        env: { CONTEXT7_API_KEY: "${input:context7_api_key}", CONTEXT7_DEFAULT_KB: "general" }
      }
    },
    inputs: [
      { id: "github_com_personal_access_token", type: "promptString", description: "GitHub.com PAT" },
      { id: "context7_api_key", type: "promptString", description: "Context7 API key" }
    ]
  };
  write(mcpPath, JSON.stringify(tpl, null, 2));
  console.log('✅ Wrote .vscode/mcp.json (template) — update API keys via VS Code prompts');
}

/**
 * Write essential VS Code settings for AIgile orchestrator functionality
 * This is always called during installation to enable custom agent as subagent
 */
function writeVscodeSettings(dest) {
  const vscodeDir = path.join(dest, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  const vscodeSettingsPath = path.join(vscodeDir, 'settings.json');
  let settings = {};
  if (fs.existsSync(vscodeSettingsPath)) {
    try { settings = JSON.parse(read(vscodeSettingsPath)); } catch { }
  }

  // Enable custom agent as subagent (experimental) - required for orchestrator delegation
  // This allows runSubagent calls to use the target agent's toolset
  settings['chat.customAgentInSubagent.enabled'] = true;

  write(vscodeSettingsPath, JSON.stringify(settings, null, 2));
  console.log('✅ Configured VS Code settings for orchestrator subagent delegation');
}

const cmd = process.argv[2];
const { flags } = parseFlags(process.argv.slice(3));
if (cmd === 'bundle') bundle();
else if (cmd === 'install') {
  const autoYes = flags.has('--yes') || flags.has('-y');
  const addMcpJsonFlag = flags.has('--with-mcp');
  const addMcpSettingsFlag = flags.has('--with-mcp-settings');
  const addJavaInstructionsFlag = flags.has('--with-java-instructions');
  const addCommunitySkillsFlag = flags.has('--with-community-skills');
  const forAntigravityFlag = flags.has('--for-antigravity');
  const forKiroFlag = flags.has('--for-kiro');
  const forCopilotFlag = flags.has('--for-copilot');
  const forClaudeFlag = flags.has('--for-claude');
  // If flags explicitly provided, skip prompts and just do what flags request
  if (addMcpJsonFlag || addMcpSettingsFlag || addJavaInstructionsFlag || addCommunitySkillsFlag || forAntigravityFlag || forKiroFlag || forCopilotFlag || forClaudeFlag) {
    printInstallBanner({ showGMSignature: true });
    const dest = process.cwd();
    // Explicit platform flags win; otherwise target the IDEs this project already uses
    const target = resolvePlatforms(dest, { copilot: forCopilotFlag, antigravity: forAntigravityFlag, kiro: forKiroFlag, claude: forClaudeFlag });
    if (target.detected) {
      console.log(`Detected target platform(s): ${describePlatforms(target)}`);
    }
    if (target.copilot) {
      installGithubCopilot(dest, { addJavaInstructions: addJavaInstructionsFlag });
    }
    if (target.antigravity) {
      installAntigravity(dest);
    }
    if (target.kiro) {
      installKiro(dest);
      if (addCommunitySkillsFlag) await addCommunitySkills([], { dest });
    } else if (addCommunitySkillsFlag) {
      console.warn('⚠️ --with-community-skills applies to Kiro; add --for-kiro (or run `aigile skills:add`).');
    }
    if (target.claude) {
      installClaudeCode(dest);
    }
    maybeAddConsumerScripts(dest);
    if (flags.has('--prune-legacy')) pruneLegacy(dest);
    if (addMcpSettingsFlag) writeMockMcp(dest);
    if (addMcpJsonFlag) {
      if (target.copilot || target.antigravity) writeMcpJson(dest);
      if (target.kiro) writeKiroMcpJson(dest);
      if (target.claude) writeClaudeMcpJson(dest);
    }
    if (target.copilot) writeVscodeSettings(dest);
    writeManifest(dest, { addMcpJson: addMcpJsonFlag, addMcpSettings: addMcpSettingsFlag, addJavaInstructions: addJavaInstructionsFlag, forAntigravity: target.antigravity, forKiro: target.kiro, forClaude: target.claude });
  } else {
    await installInteractive({ autoYes });
  }
}
else if (cmd === 'status') {
  showStatus(process.cwd());
}
else if (cmd === 'list:agents') {
  listAgentsCommand(process.cwd());
}
else if (cmd === 'skills:list' || cmd === 'list:skills') {
  skillsListCommand();
}
else if (cmd === 'skills:add') {
  const { flags: skillFlags, args: skillArgs } = parseFlags(process.argv.slice(3));
  const ids = [...skillArgs];
  if (skillFlags.has('--all')) ids.push('--all');
  const result = await addCommunitySkills(ids, {
    dest: process.cwd(),
    globalScope: skillFlags.has('--global'),
  });
  if (result.added.length) {
    console.log(`\n✅ Added ${result.added.length} skill(s). Kiro picks them up on save; check the Agent Steering & Skills panel.`);
  }
  if (result.failed.length) {
    console.log(`⚠️ ${result.failed.length} skill(s) failed. Re-run, or set GITHUB_TOKEN if you hit API rate limits.`);
    process.exitCode = 1;
  }
  if (!result.added.length && !result.failed.length) {
    console.log('Nothing added. Run `aigile skills:list` to see available skill ids.');
    process.exitCode = 1;
  }
}
else if (cmd === 'auth') {
  // For public npm, auth is handled via `npm login` or NPM_TOKEN environment variable
  console.log('For public npm registry, use `npm login` or set NPM_TOKEN environment variable.');
  console.log('No additional auth configuration is needed for @mark-gozner/aigile-method.');
}
else if (cmd === 'init' || !cmd) {
  // Unified, easiest path for new users: ensure auth then install.
  // Flags: --token <value>, --with-mcp, --with-mcp-settings, --prune-legacy, --yes
  const argvRest = process.argv.slice(2); // may include 'init'
  const passThrough = new Set();
  for (let i = 0; i < argvRest.length; i++) {
    const a = argvRest[i];
    if (a === 'init') continue;
    if (a === '--token' && argvRest[i + 1]) { i++; continue; } // skip legacy token flag
    if (a.startsWith('--token=')) { continue; } // skip legacy token flag
    passThrough.add(a);
  }
  // Proceed with install (non-interactive by default)
  printInstallBanner({ showGMSignature: true });
  const dest = process.cwd();
  const addMcpJson = passThrough.has('--with-mcp');
  const addMcpSettings = passThrough.has('--with-mcp-settings');
  const addJavaInstructions = passThrough.has('--with-java-instructions');
  const target = resolvePlatforms(dest, {
    copilot: passThrough.has('--for-copilot'),
    antigravity: passThrough.has('--for-antigravity'),
    kiro: passThrough.has('--for-kiro'),
    claude: passThrough.has('--for-claude'),
  });
  if (target.detected) {
    console.log(`Detected target platform(s): ${describePlatforms(target)}`);
  }
  if (target.copilot) installGithubCopilot(dest, { addJavaInstructions });
  if (target.antigravity) installAntigravity(dest);
  if (target.kiro) {
    installKiro(dest);
    if (passThrough.has('--with-community-skills')) await addCommunitySkills([], { dest });
  } else if (passThrough.has('--with-community-skills')) {
    console.warn('⚠️ --with-community-skills applies to Kiro; add --for-kiro (or run `aigile skills:add`).');
  }
  if (target.claude) installClaudeCode(dest);
  maybeAddConsumerScripts(dest);
  if (passThrough.has('--prune-legacy')) pruneLegacy(dest);
  if (addMcpSettings) writeMockMcp(dest);
  if (addMcpJson) {
    if (target.copilot || target.antigravity) writeMcpJson(dest);
    if (target.kiro) writeKiroMcpJson(dest);
    if (target.claude) writeClaudeMcpJson(dest);
  }
  if (target.copilot) writeVscodeSettings(dest);
  writeManifest(dest, { addMcpJson, addMcpSettings, addJavaInstructions, forAntigravity: target.antigravity, forKiro: target.kiro, forClaude: target.claude });
  console.log('✅ Init complete');
}
else if (cmd === 'auth-install') {
  // Deprecated: For public npm, just use init or install directly
  console.log('Note: auth-install is deprecated for public npm. Running install instead...');
  printInstallBanner({ showGMSignature: true });
  const dest = process.cwd();
  const argvRest = process.argv.slice(3);
  const addMcpJson = argvRest.includes('--with-mcp');
  const addMcpSettings = argvRest.includes('--with-mcp-settings');
  const addJavaInstructions = argvRest.includes('--with-java-instructions');
  const target = resolvePlatforms(dest, {
    copilot: argvRest.includes('--for-copilot'),
    antigravity: argvRest.includes('--for-antigravity'),
    kiro: argvRest.includes('--for-kiro'),
    claude: argvRest.includes('--for-claude'),
  });
  if (target.copilot) installGithubCopilot(dest, { addJavaInstructions });
  if (target.antigravity) installAntigravity(dest);
  if (target.kiro) {
    installKiro(dest);
    if (argvRest.includes('--with-community-skills')) await addCommunitySkills([], { dest });
  } else if (argvRest.includes('--with-community-skills')) {
    console.warn('⚠️ --with-community-skills applies to Kiro; add --for-kiro (or run `aigile skills:add`).');
  }
  if (target.claude) installClaudeCode(dest);
  maybeAddConsumerScripts(dest);
  if (argvRest.includes('--prune-legacy')) pruneLegacy(dest);
  if (addMcpSettings) writeMockMcp(dest);
  if (addMcpJson) {
    if (target.copilot || target.antigravity) writeMcpJson(dest);
    if (target.kiro) writeKiroMcpJson(dest);
    if (target.claude) writeClaudeMcpJson(dest);
  }
  if (target.copilot) writeVscodeSettings(dest);
  writeManifest(dest, { addMcpJson, addMcpSettings, addJavaInstructions, forAntigravity: target.antigravity, forKiro: target.kiro, forClaude: target.claude });
  console.log('✅ Install complete');
}
else {
  console.log('Usage: aigile <command> [flags]\n');
  console.log('Commands:');
  console.log('  init                Install .aigile-core and custom agents (default)');
  console.log('  install             Install/update .aigile-core and custom agents');
  console.log('                      Target IDEs are auto-detected (.kiro/, .github/, .agent/, .claude/, or the running IDE)');
  console.log('                      unless you pass explicit --for-* flags');
  console.log('  bundle              Build dist/ text bundles and the Claude Code plugin (plugin/)');
  console.log('  status              Show installation manifest summary');
  console.log('  list:agents         List installed agent IDs');
  console.log('  skills:list         List AIgile skills and the curated community skill registry');
  console.log('  skills:add [ids]    Fetch community skills into .kiro/skills (no ids = recommended)');
  console.log('\nHelpful flags:');
  console.log('  --with-mcp          Include MCP config (.vscode/mcp.json, .kiro/settings/mcp.json, .mcp.json)');
  console.log('  --with-mcp-settings Include mock .vscode/settings.json MCP endpoints');
  console.log('  --with-java-instructions  Copy Java instructions into .github/instructions');
  console.log('  --for-copilot       Install for GitHub Copilot (.github/agents/)');
  console.log('  --for-antigravity   Install for Google Antigravity (.agent/ + GEMINI.md)');
  console.log('  --for-kiro          Install for Kiro (.kiro/agents/ + .kiro/steering/ + .kiro/skills/)');
  console.log('  --for-claude        Install for Claude Code (.claude/agents/ + .claude/skills/ + CLAUDE.md)');
  console.log('  --with-community-skills  Also fetch recommended community skills (Kiro, needs network)');
  console.log('  --prune-legacy      Remove legacy artifacts (old .aigile, docs skeleton, chatmodes)');
  console.log('  --use-legacy-format Use deprecated .chatmode.md format instead of .agent.md');
  console.log('  --yes               Skip interactive component selection for install');
  console.log('\nExamples:');
  console.log('  npx @mark-gozner/aigile-method                         # installs agents and core (Copilot)');
  console.log('  npx @mark-gozner/aigile-method install --for-antigravity --yes  # Antigravity only');
  console.log('  npx @mark-gozner/aigile-method install --for-kiro --yes         # Kiro only');
  console.log('  npx @mark-gozner/aigile-method install --for-claude --yes       # Claude Code only');
  console.log('  npx @mark-gozner/aigile-method install --for-copilot --for-antigravity --for-kiro --for-claude --yes  # all platforms');
  console.log('  npx @mark-gozner/aigile-method init --with-mcp');
  console.log('\nFeatures:');
  console.log('  - GitHub Copilot: Custom agents (.agent.md), handoffs, runSubagent');
  console.log('  - Google Antigravity: Agent rules, workflows, GEMINI.md');
  console.log('  - Kiro: Custom agents, steering files, slash-command workflows, Agent Skills, MCP config');
  console.log('  - Claude Code: Subagents, skill workflows, delivery workflows, CLAUDE.md, MCP config');
  console.log('\nClaude Code plugin (no npm install needed):');
  console.log('  /plugin marketplace add Gmark2000/AIgile-Method');
  console.log('  /plugin install aigile@aigile-method');
  console.log('\nSkills examples:');
  console.log('  npx @mark-gozner/aigile-method skills:list');
  console.log('  npx @mark-gozner/aigile-method skills:add caveman grill-me');
  console.log('  npx @mark-gozner/aigile-method skills:add --all --global');
}
