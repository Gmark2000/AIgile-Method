# Test Levels Framework (Company)

Establish a shared mental model for test scope and the entry/exit criteria per level.

## Levels
- Unit: fast (<100ms), isolated, logic correctness, mock I/O.
- Component: UI or service component in isolation with fakes.
- Integration: contracts across modules/services and persistence.
- E2E: critical user journeys across the stack.
- Non-functional: performance, security, reliability, accessibility.
- Release validation: smoke checks and rollback readiness post-deploy.

## Selection criteria
- Risk: High-risk changes demand broader coverage (integration/E2E).
- Visibility: User-facing/critical flows need E2E checks.
- Coupling: Tightly coupled modules benefit from integration tests.
- Cost: Prefer unit/component until risk justifies higher levels.

## Entry/Exit (per level)
- Unit
	- Entry: functions/classes with defined behavior.
	- Exit: branches and edge cases covered; no external I/O.
- Integration
	- Entry: APIs/contracts between modules or DB access present.
	- Exit: happy path + 2 failure modes; DB migrations verified.
- E2E
	- Entry: stable UI/API endpoints and data; flake budget defined.
	- Exit: top journeys pass; screenshots/traces captured.
- Non-functional
	- Entry: target SLO/SLI, workload profile, and environment ready.
	- Exit: results documented vs baseline; actions filed for regressions.
- Release validation
	- Entry: artifact deployed to staging/prod; feature flags configured.
	- Exit: smoke suite pass; rollback plan verified.

## Example mapping
- Change: pricing algorithm logic → Unit + Integration (pricing service ↔ DB).
- Change: login UI → Component + E2E (happy path + lockout edge case).
- Change: DB migration → Integration + Release validation.

## References in this repository
- Use with QA tasks: test-design, gate, verify-jira-story-e2e.
- Use with Dev tasks: run-tests, implement-unit-tests.
