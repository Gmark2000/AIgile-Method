import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_EDITION, EDITION_FULL } from './editions.js';

const DEFAULT_CONFIG = {
  editions: {
    default: DEFAULT_EDITION,
    profiles: {
      [EDITION_FULL]: {
        modelProfile: 'full-2026-06',
        mcpProfile: 'full',
        promptProfile: 'full',
        maxToolResultTokens: null,
        subagentReturnTokens: null,
      },
      // Budget edition config lives behind the edition boundary
      // (core/editions/budget.yaml + tools/editions/budget/defaults.js) and is
      // merged in only when the budget edition is selected. Keeping it out of
      // here guarantees budget changes cannot alter full-power output.
    },
  },
  models: {
    profiles: {
      // Public full-power profile: every agent resolves to Claude Opus 4.6, the
      // model the public edition has always shipped. Keeping this as the full
      // profile guarantees the full-power install stays byte-for-byte identical
      // to the pre-edition public build. Budget routing lives behind the edition
      // boundary (tools/editions/budget/budget.yaml + defaults.js) and is merged
      // in only when the budget edition is selected.
      'full-2026-06': {
        default: 'Claude Opus 4.6',
      },
    },
  },
};

function parseScalar(value) {
  const raw = String(value || '').trim();
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

export function parseYamlMapping(yaml) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = String(yaml || '').split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s*-\s+/.test(line)) continue;
    const match = line.match(/^(\s*)([^:#]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2].trim();
    const hasInlineValue = typeof match[3] === 'string' && match[3].trim().length > 0;

    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].value;

    if (hasInlineValue) {
      parent[key] = parseScalar(match[3]);
    } else {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    }
  }

  return root;
}

export function deepMerge(base, overlay) {
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function readCoreConfig(rootDir) {
  const configPath = path.join(rootDir, 'core', 'core-config.yaml');
  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;
  const parsed = parseYamlMapping(fs.readFileSync(configPath, 'utf8'));
  return deepMerge(DEFAULT_CONFIG, parsed);
}

export function readLocalModelOverrides(dest) {
  const localPath = path.join(dest, '.aigile-core', 'core-config.local.yaml');
  if (!fs.existsSync(localPath)) return {};
  const parsed = parseYamlMapping(fs.readFileSync(localPath, 'utf8'));
  return parsed?.models?.overrides || parsed?.models?.agentOverrides || {};
}

export function resolveEditionProfile(config, edition, overrides = {}) {
  const effectiveEdition = edition || config?.editions?.default || DEFAULT_EDITION;
  const profile = config?.editions?.profiles?.[effectiveEdition] || config?.editions?.profiles?.[DEFAULT_EDITION] || DEFAULT_CONFIG.editions.profiles[DEFAULT_EDITION];
  return {
    edition: effectiveEdition,
    modelProfile: overrides.modelProfile || profile.modelProfile,
    mcpProfile: overrides.mcpProfile || profile.mcpProfile || effectiveEdition,
    promptProfile: profile.promptProfile || effectiveEdition,
    maxToolResultTokens: profile.maxToolResultTokens ?? null,
    subagentReturnTokens: profile.subagentReturnTokens ?? null,
    compressionSkill: profile.compressionSkill || null,
  };
}

export function canonicalAgentId(agentId) {
  const id = String(agentId || '').trim().toLowerCase().replace(/_/g, '-');
  if (id === 'ui') return 'ui-expert';
  if (id === 'ux') return 'ux-expert';
  return id;
}

function envKeyForAgent(agentId) {
  return `AIGILE_AGENT_MODEL_${canonicalAgentId(agentId).replace(/-/g, '_').toUpperCase()}`;
}

export function resolveAgentModel({ agentId, config, editionProfile, cliAgentModelOverrides = {}, env = {}, localModelOverrides = {} }) {
  const id = canonicalAgentId(agentId);
  if (cliAgentModelOverrides[id]) return { model: cliAgentModelOverrides[id], source: 'cli-agent' };

  const envSpecific = env[envKeyForAgent(id)];
  if (envSpecific) return { model: envSpecific, source: envKeyForAgent(id) };

  if (localModelOverrides[id]) return { model: localModelOverrides[id], source: 'local-config' };

  const profileName = editionProfile.modelProfile;
  const profile = config?.models?.profiles?.[profileName];
  const profileModel = profile?.overrides?.[id] || profile?.default;
  if (profileModel) return { model: profileModel, source: profileName };

  if (env.AIGILE_AGENT_MODEL) return { model: env.AIGILE_AGENT_MODEL, source: 'AIGILE_AGENT_MODEL' };

  return { model: null, source: null };
}

export function resolveEscalationModel(config, editionProfile) {
  const profile = config?.models?.profiles?.[editionProfile.modelProfile];
  return profile?.escalation?.premium || null;
}

export function modelMetadataLines({ agentId, config, editionProfile, cliAgentModelOverrides = {}, env = {}, localModelOverrides = {} }) {
  const model = resolveAgentModel({ agentId, config, editionProfile, cliAgentModelOverrides, env, localModelOverrides });
  const escalationModel = resolveEscalationModel(config, editionProfile);
  const lines = [];
  if (model.model) lines.push(`model: ${JSON.stringify(model.model)}`);
  lines.push(`x-aigile-edition: ${editionProfile.edition}`);
  lines.push(`x-aigile-model-profile: ${editionProfile.modelProfile}`);
  if (escalationModel) lines.push(`x-aigile-escalate-to: ${JSON.stringify(escalationModel)}`);
  if (editionProfile.subagentReturnTokens) lines.push(`x-aigile-max-return-tokens: ${editionProfile.subagentReturnTokens}`);
  return lines;
}
