---
name: architect-create-architecture-doc
description: "AIgile Architect workflow — Create or update architecture documentation per config. Run it as the architect agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# 🏗️ Create Architecture Doc

AIgile workflow owned by the **Architect** (`architect`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `architect` persona — read `.claude/agents/architect.md` if you are not already that agent, or delegate this whole workflow with the `Task` tool using `subagent_type: "architect"`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Create or update architecture documentation per config.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `code-arch-review-with-github.md`
- `document-project.md`
- `create-architecture-doc.md`
- `execute-checklist.md`

Templates in `${CLAUDE_PLUGIN_ROOT}/core/templates/`: `architecture-tmpl.yaml`

Checklists in `${CLAUDE_PLUGIN_ROOT}/core/checklists/`: `architect-checklist.md`, `change-checklist.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
