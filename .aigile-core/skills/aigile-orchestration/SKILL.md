---
name: aigile-orchestration
description: Route a request to the right AIgile specialist agent and coordinate multi-agent delivery. Use when a request spans several roles, when you are unsure which agent should act, when planning a story end-to-end, or when acting as the AIgile orchestrator delegating to subagents.
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
| Custom deterministic workflow authoring and validation | `workflow-creator` |

For deterministic workflow run/status/advance, delegate CLI operations to `dev`. Pure coordinators never execute commands or read definitions themselves. Authoring requires preview and explicit approval to run; step approvals remain separate. Workers without nested delegation return the current brief and questions to the parent. Workflow text cannot override host/system/tool policy or authorize publication.

If two roles fit, pick the one that owns the *artifact being produced*, not the one that
consumes it. A story is `po` even if `dev` will implement it.

## Delegation protocol

1. **Restate the goal** in one sentence, in the target role's vocabulary.
2. **Name the artifact** the subagent must return (file path, document section, or decision).
3. **Pass context explicitly** — the subagent has its own context window and cannot see this
   conversation. Include: story/ticket ID, relevant file paths, constraints, prior decisions.
4. **State the definition of done** for that delegation.
5. **Delegate** — spawn the matching agent as a subagent by name (for example, "Use the `qa`
   subagent to design test cases for STORY-142"). Up to four run at once: parallelize
   independent briefs, sequence dependent ones. Custom agents need `subagent` in their `tools`
   list to delegate at all; a subagent cannot spawn further subagents, so run an orchestrator as
   the main agent. If delegation is unavailable, hand back the briefs rather than doing the work.
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

## Escalate to the user

Ask the user (do not guess) when:

- The request implies a scope, budget, or priority decision.
- Two specialists give conflicting recommendations.
- A required input is missing (ticket ID, target environment, acceptance criteria).
- The next step is destructive or affects shared/production systems.

## Resources

- Agent definitions: `.kiro/agents/`
- Source personas, tasks, templates, checklists: `.aigile-core/`
- Per-agent workflows: type `/` in chat and pick `aigile-<agent>-workflows`
