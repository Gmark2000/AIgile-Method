#!/usr/bin/env node
// D3 — Minimal budget schema smoke test.
//
// Proves that ajv + the budget JSON Schemas actually execute end-to-end by
// invoking filters/schema-validate.mjs on a known-good and a known-bad PLAN
// artifact. A valid artifact must pass (exit 0, valid:true); an invalid one
// must fail closed (exit 1, valid:false). This guards the R6 path so a broken
// ajv install or malformed schema is caught loudly instead of silently.
//
// Exit 0 = smoke test passed; exit 1 = failed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const validatorPath = path.join(__dirname, 'filters', 'schema-validate.mjs');

function runValidator(kind, artifact) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-schema-smoke-'));
  const artifactPath = path.join(tmp, 'artifact.json');
  fs.writeFileSync(artifactPath, JSON.stringify(artifact));
  try {
    return spawnSync(process.execPath, [validatorPath, kind, artifactPath], {
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const validPlan = {
    artifact_id: 'PLAN-2026-05-29-001',
    scope: 'budget schema smoke test',
    acceptance_criteria: ['ajv compiles and validates a conforming artifact'],
    handoff_target: 'dev',
  };
  const invalidPlan = {
    // missing required artifact_id + acceptance_criteria -> must fail closed
    scope: 'malformed artifact',
    handoff_target: 'dev',
  };

  const okRun = runValidator('plan', validPlan);
  if (okRun.status === 2) {
    console.error(`schema-smoke: validator could not run (ajv missing?): ${okRun.stderr.trim()}`);
    process.exit(1);
  }
  if (okRun.status !== 0 || !/"valid":true/.test(okRun.stdout)) {
    console.error(`schema-smoke: valid PLAN artifact was rejected. exit=${okRun.status} out=${okRun.stdout.trim()} err=${okRun.stderr.trim()}`);
    process.exit(1);
  }

  const badRun = runValidator('plan', invalidPlan);
  if (badRun.status !== 1 || !/"valid":false/.test(badRun.stderr)) {
    console.error(`schema-smoke: invalid PLAN artifact was NOT rejected. exit=${badRun.status} out=${badRun.stdout.trim()} err=${badRun.stderr.trim()}`);
    process.exit(1);
  }

  console.log('schema-smoke ok: ajv + budget schemas execute (valid PLAN passes, malformed PLAN fails closed)');
}

main();
