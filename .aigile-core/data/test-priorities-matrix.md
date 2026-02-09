# Test Priorities Matrix (Company)

Prioritize what to test first by Risk = Probability × Impact. Default heuristics below; calibrate per project.

## Priority bands
- P0 (Blocker): Critical path breakage, security exposure, data loss, compliance.
- P1 (High): High-usage features, SLA/SLO-affecting issues, money flows.
- P2 (Medium): Secondary flows, uncommon states, degraded UX.
- P3 (Low): Cosmetic issues, low-usage admin screens.

## Quick scoring
- Probability: 1 (unlikely) – 5 (very likely) considering change area, churn, complexity.
- Impact: 1 (minimal) – 5 (severe) considering user, financial, compliance, ops.
- Risk score = P × I. Map 20–25 → P0, 12–19 → P1, 6–11 → P2, 1–5 → P3.

## How to apply in a story
1. List scenarios (happy path, alt paths, error states).
2. Score each scenario; pick top-3 by risk for immediate coverage.
3. Map P0/P1 to E2E or integration; P2 to component/unit; P3 opportunistic.
4. Record rationale in story test notes; align with test-levels-framework.

## Anti-patterns
- Equal priority for all tests; E2E-only mindset; skipping risk rationale.

## References in this repository
- Use with QA tasks: test-design, gate; Dev: run-tests, implement-unit-tests.
