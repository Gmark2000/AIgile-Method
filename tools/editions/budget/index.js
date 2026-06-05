// Budget edition strategy object.
//
// All budget-specific install behavior is reachable through this single object
// so shared mechanics (cli.js, modelProfiles.js) stay edition-agnostic. The
// full edition has no strategy — it is the literal, frozen passthrough path.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITION_BUDGET } from '../../shared/editions.js';
import { deepMerge, parseYamlMapping } from '../../shared/modelProfiles.js';
import { buildBudgetOrchestrator, shouldUseBudgetVariant } from './orchestrator.js';
import { BUDGET_CONFIG_DEFAULTS } from './defaults.js';
import { loadBudgetContentFilter } from './content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBudgetYamlConfig() {
  const configPath = path.join(__dirname, 'budget.yaml');
  if (!fs.existsSync(configPath)) return BUDGET_CONFIG_DEFAULTS;
  const parsed = parseYamlMapping(fs.readFileSync(configPath, 'utf8'));
  return deepMerge(BUDGET_CONFIG_DEFAULTS, parsed);
}

export const budgetStrategy = {
  edition: EDITION_BUDGET,
  buildOrchestrator: buildBudgetOrchestrator,
  shouldUseVariant: shouldUseBudgetVariant,
  // Merge the budget config (YAML source of truth over JS fallback) onto the
  // shared base config. Only ever called for budget installs.
  mergeConfig(config, rootDir) {
    return deepMerge(config, readBudgetYamlConfig());
  },
  // Install-time content-selection overlay (no-op when no excludes configured).
  contentFilter(rootDir) {
    return loadBudgetContentFilter(rootDir);
  },
  // Budget-only additive install step (D1). Ships the budget-only filters/,
  // schemas/, and budget-manifest.json into the install's .aigile-core/ so the
  // R2/R6/R7 assets are actually present at runtime (ADR-002). The full edition
  // resolves no strategy (resolveEditionStrategy -> null) and therefore has no
  // installExtras, so full installs write nothing new and stay byte-for-byte
  // unchanged. This is purely additive: it never edits shared core/ output.
  installExtras({ dest }) {
    const dstCore = path.join(dest, '.aigile-core');
    const copyTree = (srcDir, dstDir) => {
      if (!fs.existsSync(srcDir)) return;
      fs.mkdirSync(dstDir, { recursive: true });
      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const sp = path.join(srcDir, entry.name);
        const dp = path.join(dstDir, entry.name);
        if (entry.isDirectory()) copyTree(sp, dp);
        else fs.copyFileSync(sp, dp);
      }
    };
    // filters/ and schemas/ are installed as siblings under .aigile-core/ so
    // filters/schema-validate.mjs resolves its '../schemas' sibling at runtime.
    copyTree(path.join(__dirname, 'filters'), path.join(dstCore, 'filters'));
    copyTree(path.join(__dirname, 'schemas'), path.join(dstCore, 'schemas'));
    // Budget-only instruction assets (e.g. agent-comms.skill.md) merge into the
    // shared .aigile-core/instructions/ tree so R7 manifest paths resolve at
    // runtime. Additive only; full installs never run installExtras.
    copyTree(path.join(__dirname, 'instructions'), path.join(dstCore, 'instructions'));
    const manifestSrc = path.join(__dirname, 'budget-manifest.json');
    if (fs.existsSync(manifestSrc)) {
      fs.mkdirSync(dstCore, { recursive: true });
      fs.copyFileSync(manifestSrc, path.join(dstCore, 'budget-manifest.json'));
    }
  },
};
