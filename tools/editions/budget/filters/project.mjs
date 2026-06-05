#!/usr/bin/env node
// R2 — Budget field-projection: generic JSON projector + hard truncation.
// "Think in code": collapse any JSON tool/API result to only the fields the
// orchestrator needs before it enters context.
//
// Usage:
//   <producer> | node project.mjs <field[,field...]> [--max-items N] [--max-chars N]
//   node project.mjs number,title,state --max-items 30 < payload.json
//
// Fields support dot paths (a.b.c) and a trailing [] to map over an array of
// objects (labels[].name -> [labels[].name]). Unknown fields are omitted.
import process from 'node:process';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
  });
}

function getPath(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (p.endsWith('[]')) {
      const key = p.slice(0, -2);
      const arr = key ? cur[key] : cur;
      if (!Array.isArray(arr)) return undefined;
      return arr; // caller maps remaining path
    }
    cur = cur[p];
  }
  return cur;
}

function project(obj, fields) {
  const out = {};
  for (const field of fields) {
    const segments = field.split('.');
    const arrIdx = segments.findIndex((s) => s.endsWith('[]'));
    if (arrIdx === -1) {
      const v = getPath(obj, segments);
      if (v !== undefined) out[segments[segments.length - 1]] = v;
      continue;
    }
    const before = segments.slice(0, arrIdx + 1);
    const after = segments.slice(arrIdx + 1);
    const arr = getPath(obj, before);
    const key = segments[arrIdx].slice(0, -2) || segments[arrIdx - 1] || 'items';
    if (Array.isArray(arr)) {
      out[key] = arr.map((item) => (after.length ? getPath(item, after) : item)).filter((v) => v !== undefined);
    }
  }
  return out;
}

function clampString(s, max) {
  return s.length > max ? `${s.slice(0, max)}…(+${s.length - max} chars)` : s;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('project.mjs: usage: project.mjs <field[,field...]> [--max-items N] [--max-chars N]');
    process.exit(2);
  }
  const fields = args[0].split(',').map((s) => s.trim()).filter(Boolean);
  const maxItems = Number(args[args.indexOf('--max-items') + 1]) || 50;
  const maxChars = Number(args[args.indexOf('--max-chars') + 1]) || 8000;

  let parsed;
  try {
    parsed = JSON.parse(await readStdin());
  } catch (err) {
    console.error(`project.mjs: invalid JSON on stdin: ${err.message}`);
    process.exit(1);
  }

  let result;
  if (Array.isArray(parsed)) {
    result = parsed.slice(0, maxItems).map((o) => project(o, fields));
  } else {
    result = project(parsed, fields);
  }
  process.stdout.write(clampString(JSON.stringify(result), maxChars) + '\n');
}

main();
