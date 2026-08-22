---
name: qa-quality-gate
description: "AIgile Test Architect & Quality Advisor workflow — Evaluate if story meets quality standards for release. Run it as the qa agent."
argument-hint: "[context — story id, ticket key, file path, ...]"
disable-model-invocation: true
---

# 🧪 Quality Gate

AIgile workflow owned by the **Test Architect & Quality Advisor** (`qa`) agent.

**Context for this run:** $ARGUMENTS

## Before you start

1. Adopt the `qa` persona — read `.claude/agents/qa.md` if you are not already that agent, or delegate this whole workflow with the `Task` tool using `subagent_type: "qa"`.
2. If the context above is empty or ambiguous, ask for what you need with `AskUserQuestion` before doing any work.
3. Track multi-step progress with `TodoWrite`.

## Goal

Evaluate if story meets quality standards for release.

## Resources

Task definitions in `${CLAUDE_PLUGIN_ROOT}/core/tasks/` — follow the matching one exactly:

- `gate.md`
- `sonarqube-hotspot-review.md`
- `test-design.md`
- `verify-jira-story-e2e.md`
- `review-story.md`

Templates in `${CLAUDE_PLUGIN_ROOT}/core/templates/`: `qa-gate-tmpl.yaml`, `story-tmpl.yaml`

Checklists in `${CLAUDE_PLUGIN_ROOT}/core/checklists/`: `story-dod-checklist.md`

## Definition of done

- The artifact this workflow produces exists on disk (or the decision is written down), not just described in chat.
- Every applicable checklist item above is satisfied or explicitly waived with a reason.
- You state what you produced, where it lives, and what the next AIgile role should pick up.
