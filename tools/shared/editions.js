export const EDITION_FULL = 'full';
export const EDITION_BUDGET = 'budget';
export const DEFAULT_EDITION = EDITION_FULL;

const EDITION_ALIASES = new Map([
  ['full', EDITION_FULL],
  ['full-power', EDITION_FULL],
  ['fullpower', EDITION_FULL],
  ['power', EDITION_FULL],
  ['budget', EDITION_BUDGET],
  ['cheap', EDITION_BUDGET],
]);

export function normalizeEdition(value, source = 'edition') {
  const raw = String(value || '').trim();
  const normalized = EDITION_ALIASES.get(raw.toLowerCase());
  if (!normalized) {
    throw new Error(`Invalid ${source} value "${raw}". Expected "budget" or "full".`);
  }
  return normalized;
}

export function editionDisplayName(edition) {
  return edition === EDITION_BUDGET ? 'Budget' : 'Full Power';
}

function readOptionValue(argv, index, optionName) {
  const current = argv[index];
  const eq = current.indexOf('=');
  if (eq !== -1) return { value: current.slice(eq + 1), nextIndex: index };
  const next = argv[index + 1];
  if (!next || next.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }
  return { value: next, nextIndex: index + 1 };
}

function parseAgentModelOverride(value) {
  const raw = String(value || '').trim();
  const eq = raw.indexOf('=');
  if (eq <= 0 || eq === raw.length - 1) {
    throw new Error(`--agent-model expects agent=model, received "${raw}".`);
  }
  const agentId = raw.slice(0, eq).trim().toLowerCase().replace(/_/g, '-');
  const model = raw.slice(eq + 1).trim();
  if (!agentId || !model) {
    throw new Error(`--agent-model expects agent=model, received "${raw}".`);
  }
  return { agentId, model };
}

export function parseEditionArgs(argv = [], env = {}, existingManifest = null) {
  const explicitEditions = [];
  const agentModelOverrides = {};
  let modelProfile = null;
  let modelProfileSource = null;
  let mcpProfile = null;
  let mcpProfileSource = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--budget') {
      explicitEditions.push({ edition: EDITION_BUDGET, source: '--budget' });
      continue;
    }
    if (arg === '--full') {
      explicitEditions.push({ edition: EDITION_FULL, source: '--full' });
      continue;
    }
    if (arg === '--edition' || arg.startsWith('--edition=')) {
      const read = readOptionValue(argv, i, '--edition');
      i = read.nextIndex;
      explicitEditions.push({ edition: normalizeEdition(read.value, '--edition'), source: '--edition' });
      continue;
    }
    if (arg === '--model-profile' || arg.startsWith('--model-profile=')) {
      const read = readOptionValue(argv, i, '--model-profile');
      i = read.nextIndex;
      modelProfile = read.value.trim();
      modelProfileSource = '--model-profile';
      continue;
    }
    if (arg === '--mcp-profile' || arg.startsWith('--mcp-profile=')) {
      const read = readOptionValue(argv, i, '--mcp-profile');
      i = read.nextIndex;
      mcpProfile = read.value.trim().toLowerCase();
      mcpProfileSource = '--mcp-profile';
      continue;
    }
    if (arg === '--agent-model' || arg.startsWith('--agent-model=')) {
      const read = readOptionValue(argv, i, '--agent-model');
      i = read.nextIndex;
      const override = parseAgentModelOverride(read.value);
      agentModelOverrides[override.agentId] = override.model;
    }
  }

  const uniqueEditions = Array.from(new Set(explicitEditions.map((item) => item.edition)));
  if (uniqueEditions.length > 1) {
    const sources = explicitEditions.map((item) => item.source).join(', ');
    throw new Error(`Conflicting edition options (${sources}). Choose either Budget or Full Power.`);
  }

  let edition = uniqueEditions[0] || null;
  let editionSource = uniqueEditions[0] ? 'cli' : null;
  const explicitEdition = !!edition;

  if (!edition && env.AIGILE_EDITION) {
    edition = normalizeEdition(env.AIGILE_EDITION, 'AIGILE_EDITION');
    editionSource = 'env';
  }

  if (!edition && existingManifest) {
    edition = existingManifest.edition
      ? normalizeEdition(existingManifest.edition, 'manifest edition')
      : EDITION_FULL;
    editionSource = existingManifest.edition ? 'manifest' : 'manifest-legacy';
  }

  if (!modelProfile && env.AIGILE_MODEL_PROFILE) {
    modelProfile = env.AIGILE_MODEL_PROFILE.trim();
    modelProfileSource = 'AIGILE_MODEL_PROFILE';
  }

  if (!mcpProfile && env.AIGILE_MCP_PROFILE) {
    mcpProfile = env.AIGILE_MCP_PROFILE.trim().toLowerCase();
    mcpProfileSource = 'AIGILE_MCP_PROFILE';
  }

  return {
    edition,
    editionSource,
    explicitEdition,
    modelProfile,
    modelProfileSource,
    mcpProfile,
    mcpProfileSource,
    agentModelOverrides,
  };
}
