---
name: orchestration
description: Route a request to the right AIgile specialist agent and coordinate multi-agent delivery in Claude Code. Use when a request spans several roles, when you are unsure which agent should act, when planning a story end-to-end, or when acting as the AIgile orchestrator delegating with the Task tool.
license: SEE LICENSE IN LICENSE
metadata:
  author: Mark Gozner
  framework: AIgile Development Method
---


# AIgile Orchestration

Decide who does the work, delegate with a complete brief, and verify the handoff. Never do
specialist work yourself when a specialist agent exists for it.

## Routing matrix

| Request signal | Route to |
|----------------|----------|
| Vague idea, market question, competitor scan, brainstorming | `analyst` |
| Product scope, PRD, roadmap, release framing | `pm` |
| Epic breakdown, story writing, acceptance criteria, backlog grooming | `po` |
| System design, API/infra decisions, ADRs, architecture review | `architect` |
| Implement a story, fix a bug, refactor, write unit tests | `dev` |
| React/frontend implementation detail, component architecture | `expert-react-frontend-engineer` |
| Test strategy, test design, quality gate, risk assessment | `qa` |
| E2E/browser automation, visual regression | `automation-tester` |
| Threat model, OWASP review, dependency/secret audit | `security` |
| Pipeline, deployment, infra automation, observability | `devops` |
| Interaction flows, user research, journey maps | `ux-expert` |
| Visual design, design system, tokens, Figma | `ui-expert` |
| Ceremony facilitation, impediments, process health | `sm` |
| Codebase walkthrough, onboarding tour | `code-tour` |

If two roles fit, pick the one that owns the *artifact being produced*, not the one that
consumes it. A story is `po` even if `dev` will implement it.

## Delegation protocol

1. **Restate the goal** in one sentence, in the target role's vocabulary.
2. **Name the artifact** the subagent must return (file path, document section, or decision).
3. **Pass context explicitly** — the subagent has its own context window and cannot see this
   conversation. Include: story/ticket ID, relevant file paths, constraints, prior decisions.
4. **State the definition of done** for that delegation.
5. **Delegate** — call the `Task` tool with the AIgile agent as `subagent_type` (for example
   `subagent_type: "qa"` to design test cases for STORY-142). Send independent briefs in a
   single message so they run concurrently; sequence dependent ones. Claude Code does not nest
   delegation, so a subagent cannot spawn further subagents — if you are running as a subagent
   yourself, hand back the numbered briefs rather than doing the work.
6. **Verify on return** — check the artifact exists and satisfies the stated done criteria
   before moving on. Do not accept a summary in place of the artifact.

## Sequencing rules

- Requirements before design, design before implementation, implementation before quality gate.
- Never skip straight to `dev` for work that has no acceptance criteria. Get `po` to define them.
- Architecture changes go through `architect` before `dev` starts, not after.
- `qa` runs the gate; `dev` does not self-certify a story.
- When scope grows mid-flight, stop and return to `po`/`pm` instead of absorbing the change.

## Parallel vs sequential

Parallelize when outputs are independent: security review and test design on the same story,
or research across several tickets. Serialize when one output is the other's input: story
creation then task breakdown then implementation.

Track the whole sequence in `TodoWrite` before dispatching the first brief, so a long
delivery survives a compaction.

## Escalate to the user

Ask with the `AskUserQuestion` tool (do not guess) when:

- The request implies a scope, budget, or priority decision.
- Two specialists give conflicting recommendations.
- A required input is missing (ticket ID, target environment, acceptance criteria).
- The next step is destructive or affects shared/production systems.

## Resources

- Agent definitions: `.claude/agents/`
- Source personas, tasks, templates, checklists: `${CLAUDE_PLUGIN_ROOT}/core/`
- Per-role workflows: type `/aigile-` in chat, or start from `/aigile`

