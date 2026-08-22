---
name: ux-expert-research-users
description: "AIgile UX Expert workflow — Conduct user research and analysis. Run it as the ux-expert agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# 🎨 Research Users

AIgile workflow owned by the **UX Expert** (`ux-expert`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `ux-expert` persona — read `.claude/agents/ux-expert.md` if you are not already that agent, or delegate this whole workflow with the `Task` tool using `subagent_type: "ux-expert"`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Conduct user research and analysis.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `front-end-spec-from-design.md`

Templates in `${CLAUDE_PLUGIN_ROOT}/core/templates/`: `front-end-spec-tmpl.yaml`

Checklists in `${CLAUDE_PLUGIN_ROOT}/core/checklists/`: `story-draft-checklist.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
