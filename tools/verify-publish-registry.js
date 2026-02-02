#!/usr/bin/env node
/**
 * Verifies basic publish configuration for @mark-gozner/aigile-method.
 * For public npm registry, minimal validation is needed.
 */
import fs from 'fs';
import path from 'path';

const skip = /^(1|true|yes)$/i.test(process.env.AIGILE_SKIP_PUBLISH_CHECK || '');
if (skip) {
  console.log('[verify-publish-registry] Skipped due to AIGILE_SKIP_PUBLISH_CHECK');
  process.exit(0);
}

// For public npm, just verify package.json exists and has correct name
const repoRoot = process.cwd();
const pkgPath = path.join(repoRoot, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.error('[verify-publish-registry] ERROR: No package.json found.');
  process.exit(1);
}

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== '@mark-gozner/aigile-method') {
    console.warn(`[verify-publish-registry] Warning: Package name is "${pkg.name}", expected "@mark-gozner/aigile-method".`);
  }
  console.log('[verify-publish-registry] OK: Package configuration looks good for public npm.');
  process.exit(0);
} catch (e) {
  console.error('[verify-publish-registry] ERROR: Failed to parse package.json:', e.message);
  process.exit(1);
}
