# Dev Task: Implement Story from Jira (by URL or ID)

Intent
- Implement a Jira issue (story/task/bug) safely in small steps with tests, based on a key like ENG-123 or a full URL.

Prerequisites
- Atlassian MCP configured (jira scope). If not, paste the full issue body here.
- Local build is green; tests pass before starting (establish baseline).

Inputs
- urlOrId: Jira key (e.g., ENG-123) or full Jira URL.

Outputs
- Code and tests committed in small, reviewable chunks.
- Updated story record at docs/stories/{project}/{key}.md containing:
  - Dev Agent Record (date, approach, decisions, trade-offs)
  - File List (added/changed/removed)
  - Test Summary (scenarios covered; notable edge cases)
- PR preparation notes summarizing what changed and why.

Workflow
1) Fetch and read
   - Retrieve: title, description, Acceptance Criteria (AC), subtasks, links (Confluence/PRs/design).
   - Note ambiguities; suggest defaults and confirm with PO/PM if risky.
2) Translate AC → executable checks
   - Convert each AC to Given-When-Then (GWT) scenarios.
   - Identify non-functional constraints (perf, security, accessibility, i18n, durability).
3) Plan with sequentialthinking (5–9 bullets)
   - Minimal tasks, impacted files, data model changes.
   - Risk list and rollback path; validation steps (lint, unit, integration, exploratory).
4) Implement in slices
   - For each slice: code → tests → run → fix → commit with clear message.
   - Keep change radius small; avoid refactors unless enabling the story.
5) Validate
   - Run focused tests, then broader suite; verify AC coverage.
   - Add negative and boundary tests; verify logging and error handling.
6) Update story record and summarize
   - Record decisions, trade-offs, follow-ups; link commits/PR.

Checklists
- AC mapped 1:1 to tests or combined suites
- Input validation and error paths covered
- Feature flag/config toggles for risky changes
- Logs at correct levels; no secrets in logs
- Docs updated (README/migrations if needed)

Examples
- Example: ENG-123 Retry with jitter for Orders client
  - AC: up to 5 attempts; cap 2s; warn on final failure
  - Plan: introduce retry helper; inject into client; unit-test helper; integration-test client
  - Edges: non-retryable codes; cancellations; timeouts
- Example: ENG-987 SKU search filter
  - AC: prefix search; case-insensitive; limit 50
  - Plan: repo method; index; tests for case/prefix/pagination

Done Criteria
- All AC satisfied by passing tests; no lint/type errors; story record updated

---

Command usage
- implement-story-from-jira ENG-123
- implement-story-from-jira https://yourcompany.atlassian.net/browse/ENG-123
