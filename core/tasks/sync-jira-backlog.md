<!-- BMAD-style PM backlog curation with deterministic outputs -->

# PM Task: Sync Jira Backlog

Curate and align the Jira backlog with current priorities, readiness, and sprint plans.

## Inputs

```yaml
optional:
  - boards: ['TEAM']
  - filters: ['project = TEAM AND status in (Backlog, Ready) ORDER BY priority DESC']
```

## Process (Sequential)

1. Pull Prioritized Items
	- Apply filters; confirm priority, labels, components
2. Ensure Readiness
	- Definition of Ready: clear objective, AC, links, estimate
3. Sprint Planning
	- Propose next-sprint candidates based on capacity
4. Update Status
	- Move items to appropriate columns (Backlog/Ready/Selected)
5. Communicate Summary
	- Share changes, blockers, and asks with PO/Team

## Outputs

- Backlog delta report: items added/updated/moved
- List of Ready items and next-sprint candidates
- Blockers with owners
