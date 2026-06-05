// Budget edition content-selection overlay loader.
//
// Builds an install-time copy filter from core/editions/budget.content.yaml.
// SELECTION only — it never deletes shared source files. The full edition does
// not use this; full always copies everything unchanged.
//
// Capability-preservation policy (ADR-001 deviation): the budget edition ships
// the same tasks/workflows/templates/etc. as full power. Token savings come
// from model tiers, caps, compression and CLI-first MCP policy — not from
// dropping budget content. With empty exclude lists this filter is a no-op
// pass-through, so budget output stays at full content parity.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal list extractor for `excludeCore:` / `excludePrompts:` blocks.
function readExcludeList(text, key) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  let capturing = false;
  for (const line of lines) {
    if (new RegExp(`^${key}\\s*:`).test(line)) {
      // Inline empty array form: `key: []`
      if (/:\s*\[\s*\]\s*$/.test(line)) return [];
      capturing = true;
      continue;
    }
    if (capturing) {
      if (/^\s*-\s+/.test(line)) {
        out.push(line.replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        continue;
      }
      if (line.trim() === '' || /^\s+/.test(line)) continue;
      break;
    }
  }
  return out;
}

function globToRegExp(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function makeMatcher(globs, baseDir) {
  if (!globs.length) return null;
  const regexes = globs.map(globToRegExp);
  return (absPath) => {
    const rel = path.relative(baseDir, absPath).split(path.sep).join('/');
    return regexes.some((re) => re.test(rel));
  };
}

// Returns { coreFilter, promptFilter } where each is either null (copy all) or
// a function (absPath) => boolean returning true to INCLUDE the file.
export function loadBudgetContentFilter(rootDir) {
  const configPath = path.join(__dirname, 'content.yaml');
  let excludeCore = [];
  let excludePrompts = [];
  if (fs.existsSync(configPath)) {
    const text = fs.readFileSync(configPath, 'utf8');
    excludeCore = readExcludeList(text, 'excludeCore');
    excludePrompts = readExcludeList(text, 'excludePrompts');
  }
  const coreBase = path.join(rootDir, 'core');
  const promptBase = path.join(rootDir, 'core', 'prompts');
  const coreExclude = makeMatcher(excludeCore, coreBase);
  const promptExclude = makeMatcher(excludePrompts, promptBase);
  return {
    coreFilter: coreExclude ? (absPath) => !coreExclude(absPath) : null,
    promptFilter: promptExclude ? (absPath) => !promptExclude(absPath) : null,
  };
}
