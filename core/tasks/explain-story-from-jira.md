<!-- BMAD-style story explanation with clear outputs -->

# Dev Task: Explain Story from Jira (by URL or ID)

Produce a crisp, testable explanation of a Jira story/task for reviewers and pair programming.

## Inputs

```yaml
required:
  - urlOrId: 'ENG-456' | 'https://your.atlassian.net/browse/ENG-456'
```

## Process (Sequential)

1. Read the Issue Thoroughly
  - Title, description, AC, subtasks, links
2. Clarify Objective and Constraints
  - Objective in one sentence; list constraints and assumptions
3. Translate AC → GWT Scenarios
  - Include at least one negative and one boundary case
4. Outline Implementation
  - Files/modules/data model changes; feature flags/configs
5. Test Approach
  - Levels (unit/integration/e2e), fixtures, mocks; focus on critical logic
6. Risks and Open Questions
  - Identify unknowns; propose mitigations and follow-ups

## Outputs

- One-page brief including: objective, constraints, GWT scenarios, implementation outline, test approach, and open questions

## Examples

- ENG-321 Add rate limiting to API endpoint
  - Objective: protect backend from bursts without breaking normal usage
  - GWT: Given N requests/sec ... When threshold exceeded ... Then 429 with Retry-After
  - Impl: middleware; shared limiter; config thresholds; logs; metrics
  - Tests: normal flow; throttled flow; headers present; burst with jitter; reset window

## Done Criteria

- Self-contained, test-focused, under ~1 page
- Includes at least one negative-path scenario
