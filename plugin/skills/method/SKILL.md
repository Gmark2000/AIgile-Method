---
name: method
description: "AIgile Development Method — pick the right specialist agent or delivery workflow. Use when a request spans several roles, when unsure which AIgile agent should act, or when the user asks what AIgile offers."
---

# AIgile Development Method

An agent-driven agile framework: specialist subagents, per-role workflows, and delivery
sequences that run them in the right order.

## Agents

Delegate with the `Agent` tool, passing the id as `subagent_type`, or address one directly
with `@agent-<id>`.

| Agent | Role | When to use |
|-------|------|-------------|
| 🎬 `aigile-manual-orchestrator` | AIgile Manual Orchestrator | Interactive delegation-only coordinator — confirms every step with |
| 🧙 `aigile-master` | AIgile Master Task Executor | Use when you need comprehensive expertise across all domains, running one-off tasks that do not require a persona, or just wanting to use the same agent for many things |
| 🎭 `aigile-orchestrator` | AIgile Orchestrator | Strict delegation-only coordinator — never executes, always |
| 🧠 `analyst` | Business Analyst | Market research, brainstorming, competitive analysis, briefs |
| 🏗️ `architect` | Architect | System/solution architecture, API and infra design |
| 🤖 `automation-tester` | Automation Tester | Use for end-to-end and browser test automation, Playwright suites, visual regression, cross-browser validation, and API test coverage. |
| 🧭 `code-tour` | VSCode Tour Expert | Expert agent for creating and maintaining VSCode CodeTour files |
| 💻 `dev` | Full Stack Developer | Use for code implementation, debugging, refactoring, test design, and developer best practices across the stack |
| ⚙️ `devops` | DevOps Engineer | Use for CI/CD pipelines, infrastructure as code, deployments, release automation, containerization, and observability. |
| ⚛️ `expert-react-frontend-engineer` | Expert React Frontend Engineer | Expert React 19.2 frontend engineer specializing in modern hooks, |
| 📋 `pm` | Product Manager | Planning, delivery tracking, stakeholder alignment |
| 🧭 `po` | Product Owner | Use for story clarity, AC quality, prioritization, stakeholder alignment. |
| 🧪 `qa` | Test Architect & Quality Advisor | Use for test design, quality gates, risk assessment, and defect prevention. |
| 🔐 `security` | Security Engineer | Use for threat modelling, OWASP review, dependency and secret audits, secure design review, and security sign-off on a change. |
| ⏱️ `sm` | Scrum Master | Use for ceremony facilitation, team health, and continuous improvement. |
| 🖌️ `ui-expert` | UI Expert | Advanced UI workflows, Figma operations, tokens & component libraries |
| 🎨 `ux-expert` | UX Expert | Use for research plans, journey mapping, and usability testing. |
| 🤖 `workflow-creator` | Workflow Creator | Use when creating or customizing workflows. Author ordered workflow |

## Delivery workflows

| Workflow | Covers |
|----------|--------|
| `/aigile:workflow-brownfield-fullstack` | Agent workflow for enhancing existing full-stack applications with new features, modernization, or significant changes. Handles existing system analysis and safe integration. |
| `/aigile:workflow-brownfield-service` | Agent workflow for enhancing existing backend services and APIs with new features, modernization, or performance improvements. Handles existing system analysis and safe integration. |
| `/aigile:workflow-brownfield-ui` | Agent workflow for enhancing existing frontend applications with new features, modernization, or design improvements. Handles existing UI analysis and safe integration. |
| `/aigile:workflow-greenfield-fullstack` | Agent workflow for building full-stack applications from concept to development. Supports both comprehensive planning for complex projects and rapid prototyping for simple ones. |
| `/aigile:workflow-greenfield-service` | Agent workflow for building backend services from concept to development. Supports both comprehensive planning for complex services and rapid prototyping for simple APIs. |
| `/aigile:workflow-greenfield-ui` | Agent workflow for building frontend applications from concept to development. Supports both comprehensive planning for complex UIs and rapid prototyping for simple interfaces. |

## Routing rules

- Pick the role that owns the **artifact being produced**, not the one that consumes it.
  A story is `po` work even though `dev` implements it.
- Requirements before design, design before implementation, implementation before the
  quality gate. Never jump to `dev` for work that has no acceptance criteria.
- `qa` runs the gate; `dev` does not self-certify a story.
- Architecture changes go through `architect` before `dev` starts, not after.
- When scope grows mid-flight, return to `po`/`pm` instead of absorbing the change.

## Per-role workflows

Type `/aigile:` in chat to see every AIgile workflow, or run the one you want directly —
for example `/aigile:dev-develop-story`, `/aigile:po-create-story`, `/aigile:qa-quality-gate`.
