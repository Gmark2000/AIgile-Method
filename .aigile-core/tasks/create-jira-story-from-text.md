<!-- BMAD-style PO story creation from freeform text -->

# PO Task: Create Jira Story from Text

Convert a user-provided description into a Jira story with testable AC.

## Inputs

```yaml
required:
  - text: 'Freeform description of the need or change'
optional:
  - labels: []
  - components: []
	- projectKey: 'ENG'
	- epicKey: ''
	- savePrompt: true
```

## Process (Sequential)

1. Structure the Input
	- Extract objective, constraints, measurable outcomes
2. Draft AC in GWT
	- Include happy, negative, and boundary cases where relevant
3. Add Metadata
	- Labels, components, estimate, and dependencies
4. Create Story
	- In the correct project and backlog
	- If Jira write is not available, return a full story markdown for manual creation
5. Share and Iterate
	- Triage/refine with PM/Dev/QA as needed
6. Offer to Save Locally (docs/stories)
	- Ask to save as docs/stories/story-{key-or-slug}.md with cross-links (epic if provided)

## Outputs

- Jira story created or a full markdown for manual creation
- Optional local file saved under docs/stories/story-{key-or-slug}.md
