<!-- Create multiple stories from an epic (Jira or local), with Jira fallback and save-to-docs prompts -->

# PO Task: Create Stories from Epic

Generate a set of user stories from an epic (Jira epic key/URL or local epic markdown), and optionally save stories under docs/stories with cross-links. Create in Jira when possible; otherwise return ready-to-paste story markdown.

## Inputs

```yaml
required:
  - epicRef: 'ENG-100' | 'https://your.atlassian.net/browse/ENG-100' | 'docs/epics/epic-foo.md'
optional:
  - projectKey: 'ENG'
  - defaultLabels: []
  - components: []
  - howMany: auto | 3
  - savePrompt: true
```

## Process (Sequential)

1. Resolve Epic
   - If Jira URL/key: fetch epic summary/description via Atlassian MCP (read-only is sufficient)
   - If local file: parse sections (Goals, Scope, Constraints, Risks)
2. Story Breakdown
   - Derive capabilities and group into coherent stories
   - For each story: one-sentence objective, rationale, dependencies
3. Author Acceptance Criteria
   - Use Given/When/Then with happy, negative, and boundary cases where applicable
4. Preview and Edit
   - Present the list and allow edits (rename, merge/split, re-order)
5. Create in Jira (if available)
   - If write tools exist, create stories under the epic (issue link) and capture keys/URLs
   - If not, produce full story markdown for manual creation
6. Offer to Save Locally
   - Ask to save each story under devStoryLocation (core-config: docs/stories) as story-{key-or-slug}.md
   - Insert cross-links: Epic link, related stories, and future tasks area

## Outputs

- A set of stories created in Jira or returned as markdown
- Optional files saved under docs/stories/story-*.md with cross-links to the epic

### Output (Structured)

```yaml
stories:
  - summary: "<title>"
    ac: ["Given … When … Then …", "…"]
    jira:
      created: true|false
      key: ENG-101 | null
      url: https://your.atlassian.net/browse/ENG-101 | null
    files:
      saved: true|false
      path: docs/stories/story-eng-101.md | docs/stories/story-add-login.md | null
    links:
      epic: "ENG-100" | "docs/epics/epic-foo.md"
```

## Quality Checklist

- [ ] Each story is independently valuable, testable, and small enough
- [ ] AC include happy, negative, and boundary cases when relevant
- [ ] Stories link back to the epic and each other where appropriate
- [ ] Labels/components applied consistently
