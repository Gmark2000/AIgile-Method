---
name: pm-plan-sprint
description: "AIgile Product Manager workflow — Plan upcoming sprint capacity and commitments. Run it as the pm agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# 📋 Plan Sprint

AIgile workflow owned by the **Product Manager** (`pm`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `pm` persona — read `.claude/agents/pm.md` if you are not already that agent, or delegate this whole workflow with the `Task` tool using `subagent_type: "pm"`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Plan upcoming sprint capacity and commitments.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `sync-jira-backlog.md`
- `create-next-story.md`
- `create-prd-doc.md`

Checklists in `${CLAUDE_PLUGIN_ROOT}/core/checklists/`: `pm-checklist.md`, `change-checklist.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
