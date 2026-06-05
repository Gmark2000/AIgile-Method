import fs from 'node:fs';
import path from 'node:path';

const VALID_MCP_PROFILES = new Set(['budget', 'full']);
const BUDGET_DEFAULT_SERVERS = [
  'sequentialthinking',
  'context7',
  'memory',
];

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function catalogForServers(fullCatalog, serverIds) {
  const selected = {};
  const serializedInputs = new Set();
  for (const id of serverIds) {
    if (!fullCatalog?.servers?.[id]) continue;
    selected[id] = fullCatalog.servers[id];
    const raw = JSON.stringify(selected[id]);
    for (const input of fullCatalog.inputs || []) {
      if (raw.includes(`input:${input.id}`)) serializedInputs.add(input.id);
    }
  }
  return {
    servers: selected,
    inputs: (fullCatalog.inputs || []).filter((input) => serializedInputs.has(input.id)),
  };
}

export function normalizeMcpProfile(profile) {
  const normalized = String(profile || 'full').trim().toLowerCase();
  if (!VALID_MCP_PROFILES.has(normalized)) {
    throw new Error(`Invalid MCP profile "${profile}". Expected "budget" or "full".`);
  }
  return normalized;
}

export function readMcpCatalog(rootDir, profile) {
  const normalized = normalizeMcpProfile(profile);
  const profilePath = path.join(rootDir, 'mcp', `servers.${normalized}.json`);
  const compatibilityPath = path.join(rootDir, 'mcp', 'servers.json');
  const profileCatalog = readJsonIfExists(profilePath);
  if (profileCatalog) return filterOptIn(profileCatalog);

  const fullCatalog = readJsonIfExists(compatibilityPath) || { servers: {}, inputs: [] };
  if (normalized === 'full') return filterOptIn(fullCatalog);
  return catalogForServers(fullCatalog, BUDGET_DEFAULT_SERVERS);
}

function filterOptIn(catalog) {
  if (!catalog?.servers) return catalog;
  const serverIds = Object.entries(catalog.servers)
    .filter(([, v]) => v.gallery !== false)
    .map(([id]) => id);
  return catalogForServers(catalog, serverIds);
}
