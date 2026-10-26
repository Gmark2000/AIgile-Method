import fs from 'node:fs';
import path from 'node:path';
import TOML from '@iarna/toml';
import { frontmatter } from './client-assets.js';
import { safePath, hash, blockRange } from './managed-install.js';
import { listWorkflows } from './workflow.js';

export function doctorCommand(root, args = []) {
  const strict = args.includes('--strict');
  for (const arg of args) {
    if (arg !== '--strict') throw new Error(`Unknown doctor option: ${arg}`);
  }
  const issues = [];
  const manifestReport = { present: false, schemaVersion: null, version: null, targets: [], totalRecords: 0, modifiedOrMissing: [] };
  const manifestFile = safePath(root, '.aigile-manifest.json');
  if (fs.existsSync(manifestFile)) {
    manifestReport.present = true;
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      manifestReport.schemaVersion = parsed.schemaVersion ?? null;
      manifestReport.version = parsed.version ?? null;
      manifestReport.targets = Object.keys(parsed.targets || {});
      const files = Array.isArray(parsed.files) ? parsed.files : [];
      manifestReport.totalRecords = files.length;
      for (const record of files) {
        try {
          const targetPath = safePath(root, record.path);
          if (!fs.existsSync(targetPath)) {
            manifestReport.modifiedOrMissing.push({ path: record.path, status: 'missing' });
            continue;
          }
          const raw = fs.readFileSync(targetPath);
          if (record.markers) {
            const text = raw.toString('utf8');
            const range = blockRange(text, record.markers);
            const normalized = range ? text.slice(range.start, range.end).replace(/\r\n/g, '\n') : null;
            if (!normalized || hash(Buffer.from(normalized)) !== record.sha256) {
              manifestReport.modifiedOrMissing.push({ path: record.path, status: 'modified-block' });
            }
          } else if (record.jsonPath) {
            const doc = JSON.parse(raw.toString('utf8'));
            const [section, key] = record.jsonPath;
            const container = doc?.[section];
            const entry = section === 'inputs' && Array.isArray(container)
              ? container.find(item => item?.id === key)
              : container?.[key];
            if (entry === undefined || hash(Buffer.from(JSON.stringify(entry))) !== record.sha256) {
              manifestReport.modifiedOrMissing.push({ path: record.path, jsonPath: record.jsonPath, status: 'modified-json-entry' });
            }
          } else if (hash(raw) !== record.sha256) {
            manifestReport.modifiedOrMissing.push({ path: record.path, status: 'modified' });
          }
        } catch (error) {
          issues.push(`Manifest record check failed (${record.path}): ${error.message}`);
        }
      }
    } catch (error) {
      issues.push(`Invalid .aigile-manifest.json: ${error.message}`);
    }
  }

  const agentsReport = { copilot: 0, codex: 0, claude: 0, kiro: 0 };
  const copilotDir = safePath(root, '.github/agents');
  if (fs.existsSync(copilotDir)) {
    const entries = fs.readdirSync(copilotDir).filter(name => name.endsWith('.agent.md')).sort();
    agentsReport.copilot = entries.length;
    const parsedAgents = [];
    for (const filename of entries) {
      try {
        const parsed = frontmatter(fs.readFileSync(path.join(copilotDir, filename), 'utf8'));
        if (!parsed.metadata.name || !parsed.metadata.description) {
          issues.push(`Copilot agent missing name or description: .github/agents/${filename}`);
        }
        parsedAgents.push({ filename, metadata: parsed.metadata });
      } catch (error) {
        issues.push(`Invalid Copilot agent frontmatter (.github/agents/${filename}): ${error.message}`);
      }
    }
    const knownNames = new Set(parsedAgents.map(item => item.metadata.name).filter(Boolean));
    for (const item of parsedAgents) {
      const targets = [
        ...(Array.isArray(item.metadata.agents) ? item.metadata.agents : []),
        ...(Array.isArray(item.metadata.handoffs) ? item.metadata.handoffs.map(handoff => handoff?.agent).filter(Boolean) : []),
      ];
      for (const target of targets) {
        if (!knownNames.has(target)) {
          issues.push(`Unresolved Copilot delegation target "${target}" in .github/agents/${item.filename}`);
        }
      }
    }
  }

  const codexDir = safePath(root, '.codex/agents');
  if (fs.existsSync(codexDir)) {
    const entries = fs.readdirSync(codexDir).filter(name => name.endsWith('.toml')).sort();
    agentsReport.codex = entries.length;
    for (const filename of entries) {
      try {
        const parsed = TOML.parse(fs.readFileSync(path.join(codexDir, filename), 'utf8'));
        if (!parsed.name || !parsed.description || !parsed.developer_instructions) {
          issues.push(`Codex role missing required fields: .codex/agents/${filename}`);
        }
      } catch (error) {
        issues.push(`Invalid Codex role TOML (.codex/agents/${filename}): ${error.message}`);
      }
    }
  }

  for (const [target, folder] of [['claude', '.claude/agents'], ['kiro', '.kiro/agents']]) {
    const dir = safePath(root, folder);
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir).filter(name => name.endsWith('.md')).sort();
      agentsReport[target] = entries.length;
      for (const filename of entries) {
        try {
          frontmatter(fs.readFileSync(path.join(dir, filename), 'utf8'));
        } catch (error) {
          issues.push(`Invalid ${target} agent frontmatter (${folder}/${filename}): ${error.message}`);
        }
      }
    }
  }

  const mcpReport = {};
  for (const [label, relative, section] of [
    ['vscode', '.vscode/mcp.json', 'servers'],
    ['native', '.mcp.json', 'mcpServers'],
    ['kiro', '.kiro/settings/mcp.json', 'mcpServers'],
  ]) {
    const file = safePath(root, relative);
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        const servers = parsed?.[section];
        if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
          issues.push(`Invalid MCP servers object in ${relative}`);
        } else {
          mcpReport[label] = { path: relative, servers: Object.keys(servers).sort() };
        }
      } catch (error) {
        issues.push(`Invalid MCP JSON (${relative}): ${error.message}`);
      }
    }
  }
  const codexConfig = safePath(root, '.codex/config.toml');
  if (fs.existsSync(codexConfig)) {
    try {
      const parsed = TOML.parse(fs.readFileSync(codexConfig, 'utf8'));
      const servers = parsed?.mcp_servers && typeof parsed.mcp_servers === 'object' ? Object.keys(parsed.mcp_servers).sort() : [];
      mcpReport.codex = { path: '.codex/config.toml', servers };
    } catch (error) {
      issues.push(`Invalid Codex TOML (.codex/config.toml): ${error.message}`);
    }
  }

  const workflows = listWorkflows(root);
  for (const group of [workflows.custom, workflows.legacyLocal, workflows.bundled]) {
    for (const item of group) {
      if (!item.valid) issues.push(`Invalid workflow (${item.path}): ${item.error}`);
    }
  }
  for (const run of workflows.runs) {
    if (!run.valid) issues.push(`Invalid workflow run (${run.runId}): ${run.error}`);
  }

  return {
    healthy: issues.length === 0,
    strict,
    manifest: manifestReport,
    agents: agentsReport,
    mcp: mcpReport,
    workflows: {
      customCount: workflows.custom.length,
      legacyLocalCount: workflows.legacyLocal.length,
      bundledTemplates: workflows.bundled.map(item => item.id),
      activeRuns: workflows.runs.length,
    },
    issues,
  };
}
