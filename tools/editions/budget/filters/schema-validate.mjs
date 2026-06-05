#!/usr/bin/env node
// R6 — Dependency-light guardrail: artifact schema validation (ajv).
// Validates a budget R/P/I/QA handoff artifact against its JSON Schema so a
// malformed handoff fails closed (in ms) instead of being escalated to a model.
//
// Usage:
//   node schema-validate.mjs <research|plan|implementation|qa> <artifact.json>
//   cat artifact.json | node schema-validate.mjs plan
//
// Exit 0 = valid; exit 1 = invalid (errors printed as JSON); exit 2 = usage.
//
// ajv is a budget-tooling devDependency. It is intentionally NOT imported by
// validate-editions.js, so the edition validators run with zero extra installs.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILES = {
  research: 'request.schema.json',
  request: 'request.schema.json',
  plan: 'plan.schema.json',
  implementation: 'implementation.schema.json',
  impl: 'implementation.schema.json',
  qa: 'qa.schema.json',
};

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const kind = (process.argv[2] || '').toLowerCase();
  const file = process.argv[3];
  const schemaName = SCHEMA_FILES[kind];
  if (!schemaName) {
    console.error('schema-validate.mjs: usage: schema-validate.mjs <research|plan|implementation|qa> [artifact.json]');
    process.exit(2);
  }

  let Ajv;
  try {
    ({ default: Ajv } = await import('ajv'));
  } catch {
    console.error('schema-validate.mjs: ajv not installed. Run `npm i -D ajv` (budget tooling only).');
    process.exit(2);
  }

  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', schemaName), 'utf8'));
  const raw = file ? fs.readFileSync(file, 'utf8') : await readStdin();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(JSON.stringify({ valid: false, error: `invalid JSON: ${err.message}` }));
    process.exit(1);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (validate(data)) {
    console.log(JSON.stringify({ valid: true, kind }));
    process.exit(0);
  }
  console.error(JSON.stringify({ valid: false, kind, errors: validate.errors }));
  process.exit(1);
}

main();
