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
  const buckets = ['agents', 'tasks', 'templates', 'checklists', 'data', 'workflows'];
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

async function installInteractive({ autoYes = false }) {
  const dest = process.cwd();
  printInstallBanner({ showGMSignature: true });

  // ── CLI flag overrides ──
  const forcedCopilot = process.argv.includes('--for-copilot');
  const forcedAntigravity = process.argv.includes('--for-antigravity');
  const forcedJavaInstructions = process.argv.includes('--with-java-instructions');

  // ── Platform selector ──
  let platforms = [];
  if (forcedCopilot || forcedAntigravity) {
    // Explicit flags take precedence
    if (forcedCopilot) platforms.push('copilot');
    if (forcedAntigravity) platforms.push('antigravity');
  } else if (autoYes) {
    platforms = ['copilot']; // default for --yes
  } else {
    const platformSelections = await multiSelectPrompt({
      title: 'Select target platforms:',
      options: [
        { label: 'GitHub Copilot (.github/agents/)', value: 'copilot' },
        { label: 'Google Antigravity (.agent/ + GEMINI.md)', value: 'antigravity' },
      ],
      defaults: ['copilot'],
    });
    platforms = platformSelections.length > 0 ? platformSelections : ['copilot'];
  }

  const installCopilot = platforms.includes('copilot');
  const installAntigravityFlag = platforms.includes('antigravity');

  // ── Optional components (only shown in interactive mode) ──
  let addMcpJson = false;
  let addMcpSettings = false;
  let addJavaInstructions = forcedJavaInstructions;
  if (autoYes) {
    addMcpJson = false;
    addMcpSettings = false;
  } else {
    const componentOptions = [
      { label: 'Install MCP servers (.vscode/mcp.json from mcp/servers.json)', value: 'mcpJson' },
      { label: 'Add mock .vscode/settings.json MCP endpoints', value: 'mcpSettings' },
      { label: 'Include Java contributor instructions (.github/instructions/java.instructions.md)', value: 'javaInstructions' },
    ];
    const selections = await multiSelectPrompt({
      title: 'Select optional components:',
      options: componentOptions,
      defaults: forcedJavaInstructions ? ['mcpJson', 'javaInstructions'] : ['mcpJson'],
    });
    addMcpJson = selections.includes('mcpJson');
    addMcpSettings = selections.includes('mcpSettings');
    if (!forcedJavaInstructions) addJavaInstructions = selections.includes('javaInstructions');
  }

  // ── Run platform-specific installers ──
  let antigravityResult = null;
  if (installCopilot) {
    installGithubCopilot(dest, { addJavaInstructions });
  }
  if (installAntigravityFlag) {
    antigravityResult = installAntigravity(dest);
  }

  // ── Post-install shared steps ──
  maybeAddConsumerScripts(dest);
  if (process.argv.includes('--prune-legacy')) pruneLegacy(dest);
  if (addMcpSettings) writeMockMcp(dest);
  if (addMcpJson) writeMcpJson(dest);
  if (installCopilot) writeVscodeSettings(dest);
  writeManifest(dest, { addMcpJson, addMcpSettings, addJavaInstructions, forAntigravity: installAntigravityFlag });

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
    'ui-expert': '🖌️'
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
  const toolList = agentId === 'aigile-orchestrator' 
    ? ['read/readFile', 'agent', 'search/codebase', 'search/fileSearch', 'search/textSearch', 'search/listDirectory', 'sequentialthinking/*'] 
    : [...new Set([...FULL_AGENT_TOOLS, ...agentSpecificTools, ...tools])].sort();
  // Generate handoffs based on agent role
  const handoffs = generateHandoffsFor(agentId);

  // Build YAML frontmatter in new custom agents format
  const fmLines = [
    '---',
    `name: ${title}`,
    `description: "${description}"`,
    `argument-hint: "Describe your ${agentId} task"`,
    'tools:'
  ];
  for (const t of toolList) {
    fmLines.push(`  - ${t}`);
  }
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

      // If already in native .agent.md format, copy directly
      if (isNativeAgent && !useLegacyFormat) {
        const outName = f;
        write(path.join(outputDir, outName), agentMd);
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

function writeManifest(dest, { addMcpJson = false, addMcpSettings = false, addJavaInstructions = false, forAntigravity = false } = {}) {
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
      manifest.agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).map(f => f.replace(/\\.agent\\.md$/, '').replace(/\\.md$/, ''));
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
    console.log('\\nAIgile Installation Status');
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
      console.log('\\nFeatures:');
      console.log(`  - Custom Agents: ${data.features.customAgents ? 'yes' : 'no'}`);
      console.log(`  - Handoffs: ${data.features.handoffs ? 'yes' : 'no'}`);
      console.log(`  - runSubagent: ${data.features.runSubagent ? 'yes' : 'no'}`);
    }
    if (data.agents?.length) {
      console.log('\\nAgents:');
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
  const forAntigravityFlag = flags.has('--for-antigravity');
  const forCopilotFlag = flags.has('--for-copilot');
  // If flags explicitly provided, skip prompts and just do what flags request
  if (addMcpJsonFlag || addMcpSettingsFlag || addJavaInstructionsFlag || forAntigravityFlag || forCopilotFlag) {
    printInstallBanner({ showGMSignature: true });
    const dest = process.cwd();
    const doCopilot = forCopilotFlag || !forAntigravityFlag; // default to copilot unless only antigravity is requested
    if (doCopilot) {
      installGithubCopilot(dest, { addJavaInstructions: addJavaInstructionsFlag });
    }
    if (forAntigravityFlag) {
      installAntigravity(dest);
    }
    maybeAddConsumerScripts(dest);
    if (flags.has('--prune-legacy')) pruneLegacy(dest);
    if (addMcpSettingsFlag) writeMockMcp(dest);
    if (addMcpJsonFlag) writeMcpJson(dest);
    if (doCopilot) writeVscodeSettings(dest);
    writeManifest(dest, { addMcpJson: addMcpJsonFlag, addMcpSettings: addMcpSettingsFlag, addJavaInstructions: addJavaInstructionsFlag, forAntigravity: forAntigravityFlag });
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
  const forAntigravity = passThrough.has('--for-antigravity');
  const forCopilot = passThrough.has('--for-copilot') || !forAntigravity;
  if (forCopilot) installGithubCopilot(dest, { addJavaInstructions });
  if (forAntigravity) installAntigravity(dest);
  maybeAddConsumerScripts(dest);
  if (passThrough.has('--prune-legacy')) pruneLegacy(dest);
  if (addMcpSettings) writeMockMcp(dest);
  if (addMcpJson) writeMcpJson(dest);
  if (forCopilot) writeVscodeSettings(dest);
  writeManifest(dest, { addMcpJson, addMcpSettings, addJavaInstructions, forAntigravity });
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
  const forAntigravity = argvRest.includes('--for-antigravity');
  const forCopilot = argvRest.includes('--for-copilot') || !forAntigravity;
  if (forCopilot) installGithubCopilot(dest, { addJavaInstructions });
  if (forAntigravity) installAntigravity(dest);
  maybeAddConsumerScripts(dest);
  if (argvRest.includes('--prune-legacy')) pruneLegacy(dest);
  if (addMcpSettings) writeMockMcp(dest);
  if (addMcpJson) writeMcpJson(dest);
  if (forCopilot) writeVscodeSettings(dest);
  writeManifest(dest, { addMcpJson, addMcpSettings, addJavaInstructions, forAntigravity });
  console.log('✅ Install complete');
}
else {
  console.log('Usage: aigile <command> [flags]\\n');
  console.log('Commands:');
  console.log('  init                Install .aigile-core and custom agents (default)');
  console.log('  install             Install/update .aigile-core and custom agents');
  console.log('  bundle              Build dist/ text bundles');
  console.log('  status              Show installation manifest summary');
  console.log('  list:agents         List installed agent IDs');
  console.log('\\nHelpful flags:');
  console.log('  --with-mcp          Include .vscode/mcp.json');
  console.log('  --with-mcp-settings Include mock .vscode/settings.json MCP endpoints');
  console.log('  --with-java-instructions  Copy Java instructions into .github/instructions');
  console.log('  --for-copilot       Install for GitHub Copilot (.github/agents/)');
  console.log('  --for-antigravity   Install for Google Antigravity (.agent/ + GEMINI.md)');
  console.log('  --prune-legacy      Remove legacy artifacts (old .aigile, docs skeleton, chatmodes)');
  console.log('  --use-legacy-format Use deprecated .chatmode.md format instead of .agent.md');
  console.log('  --yes               Skip interactive component selection for install');
  console.log('\\nExamples:');
  console.log('  npx @mark-gozner/aigile-method                         # installs agents and core (Copilot)');
  console.log('  npx @mark-gozner/aigile-method install --for-antigravity --yes  # Antigravity only');
  console.log('  npx @mark-gozner/aigile-method install --for-copilot --for-antigravity --yes  # both platforms');
  console.log('  npx @mark-gozner/aigile-method init --with-mcp');
  console.log('\\nFeatures:');
  console.log('  - GitHub Copilot: Custom agents (.agent.md), handoffs, runSubagent');
  console.log('  - Google Antigravity: Agent rules, workflows, GEMINI.md');
}
