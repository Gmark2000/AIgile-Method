# Dev Task: Help

Use these commands with the Dev agent:

- implement-story-from-jira {urlOrId}
  - Implement a Jira issue with a test-first, small-steps plan.
- explain-story-from-jira {urlOrId}
  - Produce a crisp, testable summary and plan for the issue.
- implement-work-item {freeform}
  - Implement a pasted mini-story/task with acceptance criteria.
- check-story-implemented {urlOrId}
  - Assess completeness vs AC; report gaps and next actions.
- implement-unit-tests {pathOrScope}
  - Add or improve unit tests in a target module.
- review-qa
  - Apply QA feedback efficiently and safely.
- develop-story
  - Execute an approved story end-to-end with validations.
- run-tests
  - Run lint and tests; summarize failures and next steps.
- exit
  - End the session.

Tips
- Start with sequentialthinking for a short plan.
- Update story records under docs/stories when working on Jira items.
- Prefer smallest change that satisfies AC; commit in small chunks.
