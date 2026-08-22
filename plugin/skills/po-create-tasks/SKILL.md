---
name: po-create-tasks
description: "AIgile Product Owner workflow — Generate implementation tasks for a story. Run it as the po agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# 🧭 Create Tasks

AIgile workflow owned by the **Product Owner** (`po`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `po` persona — read `.claude/agents/po.md` if you are not already that agent, or delegate this whole workflow with the `Task` tool using `subagent_type: "po"`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Generate implementation tasks for a story.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `create-jira-epic-from-confluence.md`
- `create-stories-from-epic.md`
- `create-tasks-for-story.md`
- `create-jira-story-from-confluence.md`
- `create-jira-story-from-text.md`
- `groom-jira-story.md`
- `create-prd-doc.md`
- `create-next-story.md`

Templates in `${CLAUDE_PLUGIN_ROOT}/core/templates/`: `story-tmpl.yaml`, `prd-tmpl.yaml`

Checklists in `${CLAUDE_PLUGIN_ROOT}/core/checklists/`: `po-master-checklist.md`, `story-draft-checklist.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
