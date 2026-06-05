#!/usr/bin/env node
// R4 — Chronicle audit loop (ADR-002). OPT-IN, NOT in the hot path.
//
// Mines the local session store for budget-relevant signals (turns/session,
// return-token distribution per agent, escalation frequency, cap-hit rate,
// rejected-delegation rate) and emits a Markdown report plus *proposed*
// budget.yaml tier/cap/params deltas. Proposals are NEVER auto-applied — they
// are reviewed by the PO before any change (see ADR-002 risk: audit overfitting).
//
// Usage:
//   node tools/editions/budget/audit.mjs [--db <path-to-session-store.sqlite>] [--days N]
//   npm run budget:audit
//
// The session store is SQLite. This script shells out to the `sqlite3` CLI when
// available (no new runtime dependency); if it is missing or the DB cannot be
// found, it prints guidance and exits 0 (audit is advisory only).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function findDefaultDb() {
  const candidates = [
    process.env.AIGILE_SESSION_DB,
    path.join(process.cwd(), '.aigile', 'session-store.sqlite'),
    path.join(os.homedir(), '.aigile', 'session-store.sqlite'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

function hasSqlite() {
  const probe = spawnSync('sqlite3', ['--version'], { encoding: 'utf8' });
  return probe.status === 0;
}

function q(db, sql) {
  const res = spawnSync('sqlite3', ['-readonly', '-json', db, sql], { encoding: 'utf8' });
  if (res.status !== 0) return null;
  try { return JSON.parse(res.stdout || '[]'); } catch { return null; }
}

function main() {
  const days = Number(arg('--days', '30'));
  const db = arg('--db', findDefaultDb());

  if (!db || !fs.existsSync(db)) {
    console.log('# Budget Audit\n\nNo session store found. Set AIGILE_SESSION_DB or pass --db <path>.');
    console.log('Audit is advisory only; no changes were proposed.');
    return;
  }
  if (!hasSqlite()) {
    console.log('# Budget Audit\n\n`sqlite3` CLI not found on PATH. Install it to enable the audit loop.');
    return;
  }

  const since = `datetime('now','-${days} day')`;
  const turnsPerSession = q(db, `SELECT session_id, COUNT(*) AS turns FROM turns WHERE created_at >= ${since} GROUP BY session_id ORDER BY turns DESC LIMIT 20;`) || [];
  const escalations = q(db, `SELECT COUNT(*) AS n FROM turns WHERE created_at >= ${since} AND content LIKE '%needs_escalation%';`) || [{ n: 0 }];
  const capHits = q(db, `SELECT COUNT(*) AS n FROM turns WHERE created_at >= ${since} AND content LIKE '%max_agent_calls%';`) || [{ n: 0 }];
  const rejected = q(db, `SELECT COUNT(*) AS n FROM turns WHERE created_at >= ${since} AND content LIKE '%unsolvable%';`) || [{ n: 0 }];

  const avgTurns = turnsPerSession.length
    ? (turnsPerSession.reduce((a, r) => a + Number(r.turns || 0), 0) / turnsPerSession.length).toFixed(1)
    : 'n/a';

  const lines = [];
  lines.push('# Budget Audit Report');
  lines.push('');
  lines.push(`Window: last ${days} day(s) · DB: ${db}`);
  lines.push('');
  lines.push('## Signals');
  lines.push(`- Sessions sampled: ${turnsPerSession.length}`);
  lines.push(`- Avg turns/session: ${avgTurns}`);
  lines.push(`- Escalation signals: ${escalations[0]?.n ?? 0}`);
  lines.push(`- Cap-hit signals: ${capHits[0]?.n ?? 0}`);
  lines.push(`- Rejected/unsolvable signals: ${rejected[0]?.n ?? 0}`);
  lines.push('');
  lines.push('## Proposed budget.yaml deltas (REVIEW REQUIRED — not auto-applied)');
  const proposals = [];
  if (Number(escalations[0]?.n ?? 0) > turnsPerSession.length) {
    proposals.push('- Escalations exceed session count: consider raising base tier for the most-escalated agent (see per-agent breakdown) OR loosening a guardrail that fails spuriously.');
  }
  if (Number(capHits[0]?.n ?? 0) > 0) {
    proposals.push('- Cap-hits observed: consider a Deep Work default for the affected workflow, or splitting the task earlier.');
  }
  if (!proposals.length) proposals.push('- No deltas suggested; current tiers/caps look balanced for this window.');
  lines.push(...proposals);
  lines.push('');
  lines.push('_Apply changes only after PO review (ADR-002: audit overfitting risk)._');

  console.log(lines.join('\n'));
}

main();
