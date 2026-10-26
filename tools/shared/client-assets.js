import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import TOML from '@iarna/toml';
import { blockRange, hash } from './managed-install.js';

export function frontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  return match ? { metadata: YAML.parse(match[1]) || {}, body: match[2], header: match[1] } : { metadata: {}, body: content };
}

export function modernizeAgent(content) {
  const parsed = frontmatter(content);
  if (!parsed.header) throw new Error('Native agent is missing YAML frontmatter');
  const document = YAML.parseDocument(parsed.header);
  if (document.errors.length) throw document.errors[0];
  const tools = document.get('tools')?.toJSON();
  if (tools !== undefined && !Array.isArray(tools)) throw new Error('Agent tools must be an array');
  if (tools?.some(tool => typeof tool !== 'string' || !tool.trim())) throw new Error('Agent tools must contain nonempty strings');
  if (tools) document.set('tools', [...new Set(tools.map(tool => tool === 'askQuestions' ? 'vscode/askQuestions' : tool))]);
  const invocation = document.get('user-invocable') ?? document.get('user-invokable') ?? true;
  document.delete('user-invokable');
  if (document.has('infer')) {
    if (!document.has('disable-model-invocation')) document.set('disable-model-invocation', !document.get('infer'));
    document.delete('infer');
  }
  document.set('user-invocable', invocation);
  return `---\n${document.toString()}---\n${parsed.body}`;
}

export function modernizePrompt(content) {
  const parsed = frontmatter(content);
  if (!parsed.header || !Object.hasOwn(parsed.metadata, 'mode')) return content;
  const document = YAML.parseDocument(parsed.header);
  if (document.errors.length) throw document.errors[0];
  if (!document.has('agent')) document.set('agent', document.get('mode'));
  document.delete('mode');
  return `---\n${document.toString()}---\n${parsed.body}`;
}

export function collectSources(directory, nativeFirst = false) {
  const sources = new Map();
  for (const filename of fs.readdirSync(directory).filter(filename => filename.endsWith('.md')).sort()) {
    const native = filename.endsWith('.agent.md');
    const id = filename.replace(/(?:\.agent)?\.md$/, '');
    if (!sources.has(id) || native === nativeFirst) sources.set(id, filename);
  }
  return sources;
}

function portableProse(content, host) {
  return content
    .replace(/GitHub Copilot Chat|Claude Code|Kiro(?: IDE)?/g, host === 'codex' ? 'Codex' : 'Copilot')
    .replace(/#tool:runSubagent|#runSubagent/g, 'available native agent delegation')
    .replace(/Copilot Chat built-in TODOs/g, 'a visible task checklist')
    .replace(/\.kiro\/specs/g, 'docs/specs')
    .replace(/\.kiro\/steering/g, '.aigile-core')
    .replace(/#tool:([\w/-]+)/g, '$1 (only if available)')
    .replace(/Use handoff button[^\n]*/gi, host === 'codex' ? 'Request an independent specialist review using available native delegation.' : '$&');
}

function markdownContainerContent(line) {
  let remaining = line;
  let ambiguous = false;
  while (true) {
    const quote = remaining.match(/^ {0,3}>[ \t]?/);
    if (quote) {
      ambiguous ||= quote[0].includes('\t');
      remaining = remaining.slice(quote[0].length);
      continue;
    }
    const list = remaining.match(/^ {0,3}(?:[-+*]|\d{1,9}[.)])([ \t]+)(?=\S)/);
    if (!list) return { text: remaining, ambiguous };
    const padding = list[1].length;
    const tabbed = list[1].includes('\t');
    ambiguous ||= tabbed;
    remaining = remaining.slice(list[0].length - (!tabbed && padding > 4 ? padding - 1 : 0));
  }
}

function portableText(content, host) {
  const inline = text => {
    const literals = /(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)|\\(?:#tool:[\w/-]+|#runSubagent|[^\w\s])/g;
    let output = '';
    let start = 0;
    for (const match of text.matchAll(literals)) {
      output += portableProse(text.slice(start, match.index), host) + match[0];
      start = match.index + match[0].length;
    }
    return output + portableProse(text.slice(start), host);
  };
  let fence;
  let prose = '';
  let output = '';
  for (const line of content.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const containerContent = markdownContainerContent(line);
    const marker = containerContent.text.match(/^[ \t]*(`{3,}|~{3,})([^\r\n]*)/);
    if (fence || marker || containerContent.ambiguous || /^(?: {4}| *\t)/.test(containerContent.text)) {
      output += inline(prose) + line;
      prose = '';
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      } else if (marker) fence = marker[1];
    } else prose += line;
  }
  return output + inline(prose);
}

const contract = host => `Resolve all .aigile-core paths from the workspace root. Load only the task or reference needed for the current request. Follow task steps and elicit=true checkpoints exactly; never invent missing requirements. Read the project's applicable instructions first. Preserve user edits and ask before destructive actions. Use only tools actually available in ${host}; shared references describe intent, not executable tool registrations. Missing MCP access is a blocker to report, not permission to fabricate results. Delegation and tool limits are instructions, not a sandbox policy. Inherit the user's model, approvals, trust and sandbox settings.`;

export function codexRole({ id, filename, content, tasks = [], dependencies = {} }) {
  const parsed = frontmatter(content);
  const fenced = content.match(/```ya?ml\r?\n([\s\S]*?)\r?\n```/);
  const definition = {};
  if (!parsed.header && fenced) {
    for (const section of fenced[1].split(/\r?\n(?=[a-zA-Z][\w-]*:)/)) {
      try {
        Object.assign(definition, YAML.parse(section));
      } catch {
        if (/^(agent|persona):/.test(section)) throw new Error(`Invalid role identity in ${filename}`);
      }
    }
  }
  const metadata = definition?.agent || {};
  const name = `aigile-${id.replace(/^aigile-/, '')}`;
  const title = metadata.title || metadata.role || parsed.metadata.name || id;
  const description = metadata.whenToUse || parsed.metadata.description || `Use for ${title} tasks.`;
  const lines = [`You are ${title}, the ${name} specialist.`, contract('Codex'), ''];
  if (id.includes('orchestrator')) {
    lines.push('Coordinate by delegating to native aigile-* specialist roles; do not implement, execute commands or inspect project files yourself. If delegation is unavailable, stop and report that limitation. Route requirements to aigile-analyst and aigile-po, design to aigile-architect, approved implementation to aigile-dev, independent quality review to aigile-qa. Parallelize only independent work. Synthesize evidence and blockers.');
    if (id.includes('manual')) lines.push('Ask for explicit user confirmation before EVERY delegation and each phase transition. Never skip elicitation.');
    lines.push('For custom deterministic workflows, delegate authoring/validation to aigile-workflow-creator and workflow CLI run/status/advance to aigile-dev. Relay only the current scheduler brief and explicit approval requests. The scheduler never executes agents. Workers lacking nested delegation return the brief and questions to their parent. Do not change native /goal behavior.');
  } else if (parsed.header) {
    lines.push(portableText(parsed.body, 'codex'));
  } else {
    for (const [key, value] of Object.entries(definition?.persona || {})) lines.push(`${key}: ${value}`);
    const text = value => typeof value === 'string' ? value : JSON.stringify(value);
    lines.push(...(definition?.['core-principles'] || []).map(text), ...(definition?.['operational-discipline'] || []).map(text));
    if (definition?.commands) lines.push('Supported work requests:', ...definition.commands.map(command => typeof command === 'string' ? command : JSON.stringify(command)));
    lines.push(...(definition?.notes || []));
  }
  lines.push('', 'Shared resources:');
  for (const task of tasks) lines.push(`- .aigile-core/tasks/${task}`);
  for (const [kind, values] of Object.entries({ ...definition?.dependencies, ...dependencies })) {
    for (const value of values || []) lines.push(`- .aigile-core/${kind}/${value}`);
  }
  lines.push(`- .aigile-core/agents/${filename} (persona reference only; do not adopt editor-specific tool YAML or handoff syntax)`);
  lines.push('- .aigile-core/workflows/ (delivery sequences)', '- .aigile-core/checklists/ (quality checks)', '- .aigile-core/templates/ (artifact formats)');
  const output = { name, description: portableText(String(description), 'codex'), developer_instructions: portableText(lines.join('\n'), 'codex') };
  const serialized = TOML.stringify(output);
  for (const key of ['name', 'description', 'developer_instructions']) if (!TOML.parse(serialized)[key]?.trim()) throw new Error(`Empty Codex role ${key}: ${id}`);
  return { name, title, content: serialized };
}

function invocationMetadata(metadata, source) {
  const result = {};
  for (const field of ['user-invocable', 'disable-model-invocation', 'argument-hint']) {
    if (!Object.hasOwn(metadata, field)) continue;
    const expected = field === 'argument-hint' ? 'string' : 'boolean';
    if (typeof metadata[field] !== expected) throw new Error(`${source}: ${field} must be a ${expected}`);
    result[field] = metadata[field];
  }
  return result;
}

function skill(name, description, body, metadata = {}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error(`Invalid skill name: ${name}`);
  if (typeof description !== 'string' || !description.trim()) throw new Error(`${name}: description must be a nonempty string`);
  return `---\n${YAML.stringify({ name, description: description.replace(/\s+/g, ' ').trim().slice(0, 1024), ...metadata })}---\n\n${body.trim()}\n`;
}

function promptContext(metadata, source) {
  for (const field of ['agent', 'mode']) {
    if (Object.hasOwn(metadata, field) && (typeof metadata[field] !== 'string' || !metadata[field].trim())) throw new Error(`${source}: ${field} must be a nonempty string`);
  }
  for (const field of ['model', 'tools']) {
    if (!Object.hasOwn(metadata, field)) continue;
    const value = metadata[field];
    if (!(field === 'model' && typeof value === 'string' && value.trim()) && !(Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim()) && (field === 'tools' || value.length))) throw new Error(`${source}: ${field} must be ${field === 'model' ? 'a nonempty string or ' : ''}an array of nonempty strings`);
  }
  const lines = ['## Adapted Prompt Execution Context', `Native prompt: ${source.replace('.aigile-core/prompts/', '.github/prompts/')}. This skill does not select an agent, model, or permission policy.`];
  const agent = metadata.agent ?? metadata.mode;
  if (agent) lines.push(`Source agent: ${JSON.stringify(agent)}. ${agent === 'agent' ? 'Use the current host agent only within its existing permissions.' : 'This is required native execution context. Before executing, verify the selected agent or an explicitly equivalent restricted context. For ask or plan, do not edit project files or run mutating commands. If this context cannot be honored, STOP and direct the user to the native prompt in an extension-host session.'}`);
  if (Object.hasOwn(metadata, 'tools')) lines.push(`Source tools: ${JSON.stringify(metadata.tools)}. This explicit availability boundary overrides source agent tools in VS Code. Do not use tools outside it. If the host cannot honor an equivalent boundary, STOP and direct the user to the native prompt; never fall back to unrestricted edit-capable execution. These are NOT skill allowed-tools and grant no approvals.`);
  if (metadata.model) lines.push(`Source model preference: ${JSON.stringify(metadata.model)}. Retain the current model if this optional hint is unavailable and disclose the fallback. If the task explicitly requires that model or a model-specific capability, STOP and ask for the required context instead.`);
  lines.push('Resolve required VS Code context tokens such as ${selection}, ${file}, ${workspaceFolder}, ${input:name} and #file: references from supplied context or permitted file access. Ask for missing inputs before proceeding; never invent editor state or blindly expand strings. Preserve literal examples (including code containing ${...} or #file:) unchanged. When running as a worker, return missing inputs, consent requests, and unavailable capabilities to the parent.');
  return lines.join('\n\n');
}

export function clientSkills(root, host) {
  const entries = [];
  const directory = host === 'codex' ? '.agents/skills' : '.github/skills';
  const prefix = `aigile-${host}-`;
  function resolvedName(suffix) {
    const fullName = prefix + suffix;
    return fullName.length <= 64 ? fullName : `${fullName.slice(0, 55).replace(/-$/, '')}-${hash(fullName).slice(0, 8)}`;
  }
  function add(suffix, description, body, metadata = {}) {
    const name = resolvedName(suffix);
    entries.push({ path: `${directory}/${name}/SKILL.md`, content: skill(name, description, `${contract(host)}\n\n${body}`, metadata) });
  }
  const goal = fs.readFileSync(path.join(root, 'core', 'skills-portable', 'goal.md'), 'utf8');
  add('goal', 'Use when asked to deliver a goal end-to-end: clarify acceptance, research, design, implement, and request independent QA with evidence.', goal + (host === 'codex' ? '\nCodex owns native /goal. Bare /goal displays the current goal; /goal <objective> sets it. The controls are /goal edit, /goal pause, /goal resume, /goal clear. Words status and view are objective text, not controls. This skill does not mutate persistent goal state. CLI behavior is verified for Codex 0.153.4; IDE parity is unverified.' : '\nInvoke /aigile-copilot-goal in a skill-capable Copilot session. This workflow does not register a native /goal command. Copilot CLI owns /goal [OBJECTIVE], an alias for /autopilot that starts or refocuses autonomous work. Without an objective it infers intent from context. These are not Codex goal controls; do not claim editor-native /goal support or enter autopilot automatically.'));
  for (const item of fs.readdirSync(path.join(root, 'core', 'skills'), { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const override = path.join(root, 'core', 'skills-portable', item.name, 'SKILL.md');
    const folder = fs.existsSync(override) ? path.dirname(override) : path.join(root, 'core', 'skills', item.name);
    const parsed = frontmatter(fs.readFileSync(path.join(folder, 'SKILL.md'), 'utf8'));
    const suffix = item.name.replace(/^aigile-/, '');
    const source = path.join(folder, 'SKILL.md');
    if (typeof parsed.metadata.description !== 'string' || !parsed.metadata.description.trim()) throw new Error(`${source}: description must be a nonempty string`);
    add(suffix, portableText(parsed.metadata.description, host), portableText(parsed.body, host), invocationMetadata(parsed.metadata, source));
    function extras(source, relative = '') {
      for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        if (!relative && entry.name === 'SKILL.md') continue;
        if (entry.isSymbolicLink()) throw new Error(`Refusing skill symlink: ${entry.name}`);
        const next = path.posix.join(relative, entry.name);
        if (entry.isDirectory()) extras(path.join(source, entry.name), next);
        else entries.push({ path: `${directory}/${resolvedName(suffix)}/${next}`, content: fs.readFileSync(path.join(source, entry.name)) });
      }
    }
    extras(folder);
  }
  for (const [bucket, category, extension] of [['tasks', 'task', '.md'], ['prompts', 'prompt', '.prompt.md'], ['workflows', 'workflow', '.yaml']]) {
    function sources(directory, prefix = '') {
      return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (entry.isSymbolicLink()) throw new Error(`Refusing asset symlink: ${entry.name}`);
        const relative = path.posix.join(prefix, entry.name);
        return entry.isDirectory() ? sources(path.join(directory, entry.name), relative) : entry.name.endsWith(extension) ? [relative] : [];
      });
    }
    for (const filename of sources(path.join(root, 'core', bucket)).sort()) {
      const source = `.aigile-core/${bucket}/${filename}`;
      const content = fs.readFileSync(path.join(root, 'core', bucket, filename), 'utf8');
      const parsed = frontmatter(content);
      const title = filename.slice(0, -extension.length).replace(/\//g, '-');
      if (Object.hasOwn(parsed.metadata, 'description') && (typeof parsed.metadata.description !== 'string' || !parsed.metadata.description.trim())) throw new Error(`${source}: description must be a nonempty string`);
      const description = parsed.metadata.description ?? `Use when asked to ${title.replace(/-/g, ' ')} using the AIgile ${category}.`;
      const body = category === 'prompt'
        ? `${promptContext(parsed.metadata, source)}\n\nUse the user's request as arguments only after the execution context checks above. Source: ${source}\n\n${portableText(parsed.body, host)}`
        : `Read ${source} and follow its ${category === 'workflow' ? 'ordered phases, owner roles, conditions and human checkpoints' : 'steps and elicitation rules'}. Resolve dependent checklists, templates and data under .aigile-core. Report the resulting artifacts, validation evidence, and unresolved blockers.`;
      add(`${category}-${title}`, description, body, invocationMetadata(parsed.metadata, source));
    }
  }
  add('resources', 'Use when choosing an AIgile checklist, template, instruction, task, or delivery workflow for an artifact.', 'Browse .aigile-core/checklists/, .aigile-core/templates/, .aigile-core/data/, .aigile-core/instructions/ and .aigile-core/workflows/. Select by artifact and role; read only the relevant files. Apply technology instructions only to matching code. Preserve template sections and required user elicitation. Do not treat source agent tool lists as client configuration.');
  return entries;
}

export const codexGuidance = {
  path: 'AGENTS.md', markers: ['<!-- AIGILE:CODEX:START -->', '<!-- AIGILE:CODEX:END -->'],
  content: `<!-- AIGILE:CODEX:START -->
## AIgile Codex Integration

Shared resources live in .aigile-core/; native specialist roles in .codex/agents/;
discoverable workflows in .agents/skills/aigile-codex-*/SKILL.md.
Use $aigile-codex-goal <objective> for requirements, design, implementation and independent QA.
Read only the required task, workflow, checklist or template. Honor elicit=true and human checkpoints.
Use native aigile-* roles for delegation when available; report unavailable capabilities.
Native /goal belongs to Codex: bare displays, objective text sets; edit, pause, resume, clear are controls.
The skill does not set persistent goal state. CLI baseline: 0.153.4; IDE command parity is unverified.
Respect project instructions, user edits, sandbox and approvals. Never change trust automatically.
<!-- AIGILE:CODEX:END -->`
};

export const mcpMarkers = ['# AIGILE:CODEX:MCP:START', '# AIGILE:CODEX:MCP:END'];
function nativeServerError(server) {
  if (!server || typeof server !== 'object' || Array.isArray(server)) return 'server must be an object';
  const type = Object.hasOwn(server, 'type') ? server.type : 'local';
  const local = ['local', 'stdio'].includes(type);
  if (!local && !['http', 'sse', 'streamable-http'].includes(type)) return 'unsupported transport type';
  const allowed = local ? ['type', 'command', 'args', 'env', 'cwd', 'tools', 'timeout', 'deferTools', 'disableToolCache', 'oidc', 'filterMapping'] : ['type', 'url', 'headers', 'tools', 'timeout', 'deferTools', 'oauthClientId', 'oauthPublicClient', 'oauthGrantType', 'oidc', 'filterMapping'];
  const unsupported = Object.keys(server).filter(key => !allowed.includes(key));
  if (unsupported.length) return `unsupported native fields: ${unsupported.join(', ')}`;
  for (const field of local ? ['command'] : ['url']) {
    if (typeof server[field] !== 'string') return `${field} must be a string`;
  }
  for (const field of local ? ['args', 'tools'] : ['tools']) {
    if (!Array.isArray(server[field]) || server[field].some(value => typeof value !== 'string')) return `${field} must be a string array`;
  }
  for (const field of ['env', 'headers']) {
    if (Object.hasOwn(server, field) && (!server[field] || typeof server[field] !== 'object' || Array.isArray(server[field]) || Object.values(server[field]).some(value => typeof value !== 'string'))) return `${field} must map names to strings`;
  }
  for (const field of ['cwd', 'oauthClientId']) {
    if (Object.hasOwn(server, field) && typeof server[field] !== 'string') return `${field} must be a string`;
  }
  if (Object.hasOwn(server, 'timeout') && (typeof server.timeout !== 'number' || !Number.isFinite(server.timeout))) return 'timeout must be a number';
  for (const field of ['disableToolCache', 'oauthPublicClient', 'oidc']) {
    if (Object.hasOwn(server, field) && typeof server[field] !== 'boolean') return `${field} must be a boolean`;
  }
  for (const [field, values] of Object.entries({ deferTools: ['auto', 'never'], oauthGrantType: ['authorization_code', 'client_credentials'], filterMapping: ['none', 'markdown', 'hidden_characters'] })) {
    if (Object.hasOwn(server, field) && !values.includes(server[field])) return `unsupported ${field}`;
  }
}

export function validateNativeMcp(content) {
  const document = JSON.parse(content);
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Native MCP configuration must be an object');
  if (!Object.hasOwn(document, 'mcpServers')) return;
  if (!document.mcpServers || typeof document.mcpServers !== 'object' || Array.isArray(document.mcpServers)) throw new Error('Native mcpServers must be an object');
  for (const [name, server] of Object.entries(document.mcpServers)) {
    const error = nativeServerError(server);
    if (error) throw new Error(`Invalid native MCP ${name}: ${error}`);
  }
}

export function copilotMcp(catalog, host = 'vscode') {
  if (!['vscode', 'native'].includes(host)) throw new Error('Copilot MCP host must be vscode or native');
  const filename = host === 'native' ? '.mcp.json' : '.vscode/mcp.json';
  const section = host === 'native' ? 'mcpServers' : 'servers';
  const entries = [];
  const warnings = [];
  const inputIds = new Set();
  for (const [name, source] of Object.entries(catalog.servers || {})) {
    let server = structuredClone(source);
    if (host === 'native') {
      const skip = reason => warnings.push(`Skipped MCP ${name}: ${reason}. Configure it manually in .mcp.json with explicit tool filters; no server was started.`);
      if (!server || typeof server !== 'object' || Array.isArray(server)) { skip('server must be an object'); continue; }
      if (!Object.hasOwn(server, 'tools')) server.tools = ['*'];
      const error = nativeServerError(server);
      if (error) { skip(error); continue; }
      const local = ['local', 'stdio'].includes(server.type ?? 'local');
      let invalid = false;
      for (const [field, value] of Object.entries(server)) {
        if (field === 'env' || field === 'headers') {
          for (const [key, text] of Object.entries(value || {})) {
            const translated = text.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, '${$1}');
            if (/\$\{/.test(translated.replace(/\$\{[A-Za-z_][A-Za-z0-9_]*(?::-[^{}]*)?\}/g, ''))) invalid = true;
            server[field][key] = translated;
          }
        } else if (/\$\{|\$[A-Za-z_]/.test(JSON.stringify(value))) invalid = true;
      }
      if (invalid) { skip('unsupported interpolation (including interactive ${input:...}); supply inherited env references in env/headers'); continue; }
      server = { ...server, type: local ? 'stdio' : server.type === 'streamable-http' ? 'http' : server.type };
    } else {
      for (const match of JSON.stringify(server).matchAll(/\$\{input:([^}]+)\}/g)) inputIds.add(match[1]);
      if (/\$\{input:/.test(JSON.stringify(server))) warnings.push(`MCP ${name}: interactive inputs work in the VS Code extension host but are not forwarded to Agent Host. Use reviewed native configuration for that host.`);
    }
    entries.push({ path: filename, jsonPath: [section, name], content: JSON.stringify(server) });
  }
  if (host === 'vscode') {
    for (const id of inputIds) {
      const input = (catalog.inputs || []).find(input => input.id === id);
      if (!input) throw new Error(`MCP input ${id} has no catalog definition`);
      entries.push({ path: filename, jsonPath: ['inputs', id], content: JSON.stringify(input) });
    }
  }
  return { entries, warnings };
}

export function codexMcp(catalog, existing = '') {
  TOML.parse(existing);
  const range = blockRange(existing, mcpMarkers);
  const outside = range ? existing.slice(0, range.start) + existing.slice(range.end) : existing;
  const parsed = TOML.parse(outside);
  const servers = {};
  const warnings = [];
  for (const [id, server] of Object.entries(catalog.servers || {})) {
    const name = `aigile-${id}`;
    if (Object.hasOwn(parsed.mcp_servers || {}, name)) throw new Error(`Existing MCP server collision: ${name}`);
    if (server.command && !(server.args || []).some(value => /\$\{/.test(value))) {
      const env = {};
      const envVars = [];
      for (const [key, value] of Object.entries(server.env || {})) {
        if (/^\$\{input:[^}]+\}$/.test(value)) envVars.push(key);
        else if (/\$\{/.test(value)) throw new Error(`Unsupported MCP interpolation: ${id}.${key}`);
        else env[key] = value;
      }
      servers[name] = { command: server.command, args: server.args || [], ...(envVars.length ? { env_vars: envVars } : {}), ...(Object.keys(env).length ? { env } : {}) };
    } else if (server.url && !/\$\{/.test(server.url) && !server.headers) {
      servers[name] = { url: server.url, ...(server.bearer_token_env_var ? { bearer_token_env_var: server.bearer_token_env_var } : {}) };
    } else warnings.push(`Skipped MCP ${id}: credential arguments, headers or transport require a verified manual configuration.`);
  }
  const content = `${mcpMarkers[0]}\n${TOML.stringify({ mcp_servers: servers })}${mcpMarkers[1]}`;
  try {
    TOML.parse(outside + '\n' + content);
  } catch (error) {
    throw new Error('Cannot safely append AIgile MCP tables to this TOML layout. No files were changed. Convert the top-level mcp_servers inline table or dotted-key definitions to explicit [mcp_servers."server-name"] tables, preserving each server setting, then retry --with-mcp. Alternatively install without --with-mcp and configure MCP manually.', { cause: error });
  }
  return { path: '.codex/config.toml', content, markers: mcpMarkers, warnings };
}