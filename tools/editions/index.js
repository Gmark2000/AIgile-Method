// Edition strategy dispatch — the single decision point for edition behavior.
//
// resolveEditionStrategy(edition) returns the budget strategy object for the
// budget edition, or null for the full ("Full Power") edition. A null result
// means "run today's literal full-power code path" — full is never refactored,
// it is the frozen passthrough/else branch (ADR-001).
import { EDITION_BUDGET } from '../shared/editions.js';
import { budgetStrategy } from './budget/index.js';

export function resolveEditionStrategy(edition) {
  const normalized = String(edition || '').trim().toLowerCase();
  if (normalized === EDITION_BUDGET) return budgetStrategy;
  return null;
}
