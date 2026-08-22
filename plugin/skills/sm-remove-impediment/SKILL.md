---
name: sm-remove-impediment
description: "AIgile Scrum Master workflow — Identify and resolve team blockers. Run it as the sm agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# ⏱️ Remove Impediment

AIgile workflow owned by the **Scrum Master** (`sm`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `sm` persona — read `.claude/agents/sm.md` if you are not already that agent, or delegate this whole workflow with the `Agent` tool using `subagent_type: "sm"`, or address it directly with `@agent-sm`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Identify and resolve team blockers.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `standup-digest.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
