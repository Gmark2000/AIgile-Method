---
name: analyst-elicit-requirements
description: "AIgile Business Analyst workflow — Conduct requirements gathering session. Run it as the analyst agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# 🧠 Elicit Requirements

AIgile workflow owned by the **Business Analyst** (`analyst`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `analyst` persona — read `.claude/agents/analyst.md` if you are not already that agent, or delegate this whole workflow with the `Task` tool using `subagent_type: "analyst"`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Conduct requirements gathering session.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `facilitate-brainstorming-session.md`
- `market-research-from-context7.md`
- `advanced-elicitation.md`

Templates in `${CLAUDE_PLUGIN_ROOT}/core/templates/`: `project-brief-tmpl.yaml`, `market-research-tmpl.yaml`

Checklists in `${CLAUDE_PLUGIN_ROOT}/core/checklists/`: `change-checklist.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
