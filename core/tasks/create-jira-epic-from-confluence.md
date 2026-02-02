<!-- BMAD-style PO epic creation with Jira fallback and save-to-docs option -->

# PO Task: Create Jira Epic from Confluence Doc

Create a Jira Epic from a Confluence page, preview before creation, and optionally save a local markdown copy under docs/epics with cross-links.

## Inputs

```yaml
required:
  - confluenceUrl: 'https://your.atlassian.net/wiki/spaces/PROJ/pages/12345'
optional:
  - projectKey: 'ENG'
  - labels: []
  - components: []
  - summaryOverride: ''
  - savePrompt: true   # Always ask to save docs; if headless, treat as true
```

## Process (Sequential)

1. Parse Source Document
   - Extract purpose, problem/opportunity, scope, constraints, explicit exclusions.
   - Identify initial success metrics and high-level acceptance themes.
2. Draft Epic
   - Title: concise, outcome-focused; use summaryOverride if provided.
   - Description sections: Context, Goals/Non-Goals, Scope/Out-of-Scope, Constraints, Initial Risks, Success Metrics.
   - Metadata: projectKey, labels, components.
3. Preview and Confirm
   - Present the epic draft to the user for confirmation or edits.
4. Create in Jira (if available)
   - If an Atlassian MCP tool supports write, create the epic in Jira and capture key and URL.
   - If write is not available, DO NOT fail: return the full epic content as output for manual creation.
5. Offer to Save Locally (docs/epics)
   - Ask: “Save a local copy under docs/epics and cross-link later stories to this epic?”
   - If yes, write docs/epics/epic-{key-or-slug}.md with frontmatter and content.
6. Cross-link Guidance
   - Provide snippet to link from stories to this epic: “Epic: [ENG-123](https://…/browse/ENG-123)” or local file link if no Jira key.

## Output

- Jira Epic created (key and URL), or a complete epic markdown for manual creation
- Optional local file saved under docs/epics/epic-{key-or-slug}.md
- Link snippet for downstream stories

### Output (Structured)

```yaml
epic:
  summary: "<title>"
  description: |
    <markdown body>
  jira:
    created: true|false
    key: ENG-123 | null
    url: https://your.atlassian.net/browse/ENG-123 | null
  files:
    saved: true|false
    path: docs/epics/epic-eng-123.md | docs/epics/epic-new-foo.md | null
  linkSnippet: |
    Epic: [ENG-123](https://your.atlassian.net/browse/ENG-123)
```

## Quality Checklist

- [ ] Clear goal(s) and success metrics
- [ ] Scope and explicit out-of-scope listed
- [ ] Constraints/risks captured
- [ ] Labels/components added if used
- [ ] Preview validated with stakeholders
