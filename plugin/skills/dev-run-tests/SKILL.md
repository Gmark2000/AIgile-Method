---
name: dev-run-tests
description: "AIgile Full Stack Developer workflow — Execute unit tests and integration tests for current work. Run it as the dev agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# 💻 Run Tests

AIgile workflow owned by the **Full Stack Developer** (`dev`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `dev` persona — read `.claude/agents/dev.md` if you are not already that agent, or delegate this whole workflow with the `Task` tool using `subagent_type: "dev"`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Execute unit tests and integration tests for current work.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `check-story-implemented.md`
- `explain-story-from-jira.md`
- `implement-freeform-work-item.md`
- `implement-story-from-jira.md`
- `implement-unit-tests.md`
- `execute-checklist.md`
- `validate-next-story.md`

Checklists in `${CLAUDE_PLUGIN_ROOT}/core/checklists/`: `story-dod-checklist.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
