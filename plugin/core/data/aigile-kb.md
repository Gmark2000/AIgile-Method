<!-- Powered by AIgile™ Core -->

# AIgile Knowledge Base

## Overview

AIgile (AI-assisted Agile Development Method) provides a lean, role-focused agent system, reusable tasks/templates/checklists, and MCP-enabled integrations to deliver software with clear handoffs and strong quality gates.

### Key Features

- Role-specialized agents (Analyst, PM, PO, Architect, Dev, QA, UX/UI, SM)
- Reusable resources: tasks, templates, checklists, and data
- IDE-first flow with optional web bundle for planning
- MCP-ready: GitHub, Atlassian, SonarQube, Playwright, Memory, Sequential Thinking, Context7
- Clean dependency mapping for precise, minimal context

### When to Use AIgile

- Greenfield projects: PRD → Architecture → Stories → Implementation
- Brownfield work: Document current system → Focused epics/stories → Incremental improvements
- Team collaboration: Clear per-role workflows and quality checks

## How AIgile Works

### Core Method

You direct specialized agents through executable tasks. Each agent focuses on its discipline, uses declared dependencies only when needed, and hands off work cleanly to the next role.

1. You set the goal and provide decisions.
2. Agents execute via tasks and checklists, loading only referenced dependencies.
3. Clean, fresh chats between roles preserve context quality.

### Two-Phase Approach

- Planning (often Web UI): Create PRD/Architecture efficiently; multi-agent ideation and research.
- Development (IDE): Shard docs, implement stories sequentially, validate with QA before Done.

### Development Loop

```
1. SM → create next story from sharded docs
2. You review/approve
3. Dev → implement story with tests
4. QA → review and validate
5. You verify completion
6. Repeat
```

### Why This Works

- Role clarity and specialization
- Minimal necessary context at each step
- Strong gates and explicit acceptance criteria

## Getting Started

- Web bundle: use `dist/teams/team-company.txt` in large-context web models for planning.
- IDE install: `aigile install` to copy `.aigile-core`, generate chatmodes, and optional MCP configuration.

Required docs: save planning outputs to `docs/prd.md` and `docs/architecture.md`; shard to `docs/prd/` and `docs/architecture/` for development.

## Core Configuration

`core/core-config.yaml` defines where docs live and what the dev agent should always load (devLoadAlwaysFiles). It enables gradual adoption and custom layouts.

## Reusable Resources

- Templates: PRD, architecture, story, QA gate, front-end spec
- Tasks: shard-doc, create-next-story, implement-story-from-jira, test-design, gate
- Checklists: story DoD, PO master, architect review, change checklist
- Data: brainstorming techniques, elicitation methods, technical preferences, test levels, test priorities

## Agent System (Quick Reference)

| Agent | Primary Functions |
| --- | --- |
| analyst | brainstorming, research, project documentation |
| pm | PRD creation, backlog sync, planning |
| po | story creation, grooming, validation |
| architect | architecture design/review, ADRs |
| dev | story implementation, tests, code quality |
| qa | test design, quality gates, E2E validation |
| ux/ui | research, journey mapping, design system compliance |
| sm | story creation, facilitation |

## IDE Usage Principles

- Use fresh chats when switching roles.
- Only load dependency files during task execution.
- Tasks with elicit=true require user interaction.
- Keep Dev agent lean; planning agents can be richer in web contexts.

## Brownfield Guidance (Condensed)

- Document first (analyst document-project), then PRD/architecture.
- Shard docs; implement one story at a time.
- Emphasize compatibility, migration, and risk mitigation; prefer incremental rollout.

## Success Tips

- Keep the technical preferences current.
- Tie AC to test levels and priorities.
- Maintain decision logs and risks for visibility.
- Prefer smallest viable change; validate early.

## See Also

- `core/data/technical-preferences.md`
- `core/data/test-levels-framework.md`
- `core/data/test-priorities-matrix.md`
- `core/data/brainstorming-techniques.md`
- `core/data/elicitation-methods.md`
