<!-- BMAD-style PO story creation from Confluence -->

# PO Task: Create Jira Story from Confluence Doc

Turn a Confluence document into a well-formed Jira story with clear AC.

## Inputs

```yaml
required:
  - confluenceUrl: 'https://your.atlassian.net/wiki/spaces/PROJ/pages/12345'
optional:
  - labels: []
  - components: []
	- projectKey: 'ENG'
	- epicKey: ''
	- savePrompt: true   # Offer to save to docs/stories
```

## Process (Sequential)

1. Parse the Document
	- Extract objective, scope, constraints, and key decisions
2. Draft Story and AC
	- Use GWT; include happy, negative, and boundary cases
3. Link Context
	- Source Confluence page and related docs
4. Metadata
	- Labels, components, priority, estimate (if used)
5. Review and Create
	- Share with PM/Dev/QA; then create in correct backlog
	- If Jira write is not available, DO NOT fail: return full story markdown for manual creation
6. Offer to Save Locally (docs/stories)
	- Ask to save as docs/stories/story-{key-or-slug}.md with cross-links (epic if provided)

## Outputs

- Jira story created with description, AC, links, and metadata; or full markdown for manual creation
- Optional local file saved under docs/stories/story-{key-or-slug}.md
