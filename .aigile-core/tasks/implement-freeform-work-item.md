# Dev Task: Implement Work Item (Freeform)

Intent
- Implement a user-provided task/mini-story pasted into chat, using a plan-first approach.

Inputs
- freeform: plain text containing objective, acceptance, constraints (if any)

Outputs
- Code + tests implementing the request
- Short summary: changes made, risks, test results

Workflow
1) Parse the input
   - Extract: objective, acceptance, constraints, done criteria
2) Plan with sequentialthinking
   - Bullet tasks (5–9), impacted files, tests, risks, rollback
3) Implement in small steps with tests
4) Validate (lint, unit, integration if relevant)
5) Summarize results and next steps

Checklists
- Inputs validated and sanitized where applicable
- Backward-compat maintained
- Logging + error handling included
- Tests cover happy path and 1–2 edge cases

Examples
- "Refactor date utility to add toZonedTime() with IANA support; AC: DST safe, UTC fallback"
- "Add feature flag for new pricing calc; AC: disabled by default, config-driven"
