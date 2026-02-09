<!-- Aligns with BMAD review-story approach for clarity and testability -->

# PO Task: Groom Jira Story

Ensure a Jira story is clear, testable, and ready for development with linked context and unambiguous acceptance criteria.

## Inputs

```yaml
required:
  - urlOrId: 'ENG-123' | 'https://your.atlassian.net/browse/ENG-123'
optional:
  - confluenceLinks: []
  - relatedIssues: []
	- savePrompt: true
```

## Process (Sequential)

1. Clarify Objective
	- Restate in one sentence: who, what, why
	- Ensure scope and constraints are explicit (out-of-scope listed)
2. Author Acceptance Criteria (AC)
	- Use Given/When/Then
	- Include at least: happy path, negative, and boundary case
3. Link Context
	- Confluence specs, designs, architecture references
	- Dependencies and blockers (and their owners)
4. Ready-for-Dev Check
	- Estimable? Testable? Valuable? Small enough? No major unknowns?
	- Labels/components set; Definition of Ready satisfied
5. Status Update
	- Move to “Ready for Dev” when all criteria are met
	- If Jira write is not available, provide the updated story markdown for manual update

## Outputs

- Updated Jira story or markdown with:
  - Clear objective
  - AC in GWT format
  - Links (Confluence/design/related)
  - Labels/components/estimate (if used)
  - Status: Ready for Dev (if applicable)
	- Optional: local file saved under docs/stories/story-{key-or-slug}.md

## Quality Checklist

- [ ] Objective is crisp and user-focused
- [ ] AC cover happy, negative, and boundary
- [ ] Links to required context are present
- [ ] Dependencies identified with owners
- [ ] Meets Definition of Ready
