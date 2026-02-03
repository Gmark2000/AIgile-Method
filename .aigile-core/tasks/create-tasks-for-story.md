<!-- Create implementation tasks from a story, with Jira fallback and save-to-docs prompts -->

# PO Task: Create Tasks for a Story

Create a set of implementable tasks for a given story (Jira or text), with optional local save under docs/tasks and cross-linking to the story and epic.

## Inputs

```yaml
required:
  - storyRef: 'ENG-123' | 'https://your.atlassian.net/browse/ENG-123' | inline-text
optional:
  - defaultAssignee: ''
  - components: []
  - taskTypes: ['dev', 'qa', 'docs']
  - savePrompt: true
```

## Process (Sequential)

1. Resolve Story
   - If Jira: fetch summary, description, AC; if local: parse story file sections
2. Derive Tasks
   - Break down into dev, qa, and docs tasks; ensure each is small, testable, and has a clear DoD
3. Preview and Edit
   - Present tasks, allow edits: add/remove, re-order, assign types/owners
4. Create in Jira (if available)
   - Create sub-tasks or linked tasks; capture keys/URLs; otherwise return markdown
5. Offer to Save Locally
   - Save docs/tasks/task-{key-or-slug}.md for each task with links to story and epic

## Outputs

- Tasks created in Jira or returned as markdown
- Optional files saved under docs/tasks with cross-links to the story

### Output (Structured)

```yaml
tasks:
  - summary: "Implement API endpoint"
    type: dev | qa | docs
    jira:
      created: true|false
      key: ENG-124 | null
      url: https://your.atlassian.net/browse/ENG-124 | null
    files:
      saved: true|false
      path: docs/tasks/task-eng-124.md | docs/tasks/task-implement-endpoint.md | null
    links:
      story: "ENG-123" | "docs/stories/story-add-login.md"
      epic: "ENG-100" | null
```

## Quality Checklist

- [ ] Tasks are small, clear, and testable
- [ ] Each task has an explicit Definition of Done
- [ ] Tasks link to the story (and epic if applicable)
- [ ] Task types cover dev, qa, and docs as needed
