---
name: workflow-greenfield-fullstack
description: "AIgile delivery workflow — Agent workflow for building full-stack applications from concept to development. Supports both comprehensive planning for complex projects and rapid prototyping for simple ones."
argument-hint: "[what you are building]"
disable-model-invocation: true
---

# 🔁 Greenfield Full-Stack Application Development

Agent workflow for building full-stack applications from concept to development. Supports both comprehensive planning for complex projects and rapid prototyping for simple ones.

**Fits:** web-app, saas, enterprise-app, prototype, mvp

**This run:** $ARGUMENTS

## How to run it

This is a multi-agent sequence, not a single task. Drive it as the orchestrator:

1. Put the whole sequence into `TodoWrite` before starting, one entry per step below.
2. For each step, delegate with the `Task` tool using the listed agent as `subagent_type`.
   Give each subagent a self-contained brief — it cannot see this conversation.
3. Check every produced artifact against the step's stated output before advancing.
   Save documents under `docs/` so later steps can read them.
4. Steps marked optional or conditional need a decision first — use `AskUserQuestion`
   rather than silently skipping or silently running them.
5. If scope changes mid-flight, stop and go back to `pm`/`po` instead of absorbing it.

## Sequence

| # | Agent | Produces | Requires | Notes |
|---|-------|----------|----------|-------|
| 1 | `analyst` | project-brief.md | — | Can do brainstorming first, then optional deep research before creating project brief. SAVE OUTPUT: Copy final project-brief.md to your project's docs/ folder. |
| 2 | `pm` | prd.md | project-brief.md | Creates PRD from project brief using prd-tmpl. SAVE OUTPUT: Copy final prd.md to your project's docs/ folder. |
| 3 | `ux-expert` | front-end-spec.md | prd.md | Creates UI/UX specification using front-end-spec-tmpl. SAVE OUTPUT: Copy final front-end-spec.md to your project's docs/ folder. |
| 4 | `ux-expert` | v0_prompt (optional) | front-end-spec.md | **if user_wants_ai_generation** — OPTIONAL BUT RECOMMENDED: Generate AI UI prompt for tools like v0, Lovable, etc. Use the generate-ai-frontend-prompt task. User can then generate UI in external tool and download project structure. |
| 5 | `architect` | fullstack-architecture.md | prd.md, front-end-spec.md | Creates comprehensive architecture using fullstack-architecture-tmpl. If user generated UI with v0/Lovable, can incorporate the project structure into architecture. May suggest changes to PRD stories or new stories. SAVE OUTPUT: Copy final fullstack-architecture.md to your project's docs/ folder. |
| 6 | `pm` | prd.md (if needed) | fullstack-architecture.md | **if architecture_suggests_prd_changes** — If architect suggests story changes, update PRD and re-export the complete unredacted prd.md to docs/ folder. |
| 7 | `po` | all_artifacts | — | **uses po-master-checklist** — Validates all documents for consistency and completeness. May require updates to any document. |
| 8 | `various` | any_flagged_documents | — | **if po_checklist_issues** — If PO finds issues, return to relevant agent to fix and re-export updated documents to docs/ folder. |
| 9 | _project setup guidance_ | guide_project_structure | — | **if user_has_generated_ui** — If user generated UI with v0/Lovable: For polyrepo setup, place downloaded project in separate frontend repo alongside backend repo. For monorepo, place in apps/web or packages/frontend directory. Review architecture document for specific guidance. |
| 10 | _development order guidance_ | guide_development_sequence | — | Based on PRD stories: If stories are frontend-heavy, start with frontend project/directory first. If backend-heavy or API-first, start with backend. For tightly coupled features, follow story sequence in monorepo setup. Reference sharded PRD epics for development order. |
| 11 | `po` | sharded_docs | all_artifacts_in_project | Shard documents for IDE development: - Option A: Use PO agent to shard: @po then ask to shard docs/prd.md - Option B: Manual: Drag shard-doc task + docs/prd.md into chat - Creates docs/prd/ and docs/architecture/ folders with sharded content |
| 12 | `sm` | story.md | sharded_docs | **repeats for_each_epic** — Story creation cycle: - SM Agent (New Chat): @sm → *create - Creates next story from sharded docs - Story starts in 'Draft' status |
| 13 | `analyst/pm` | story.md | story.md | **optional, if user_wants_story_review** — OPTIONAL: Review and approve draft story - NOTE: story-review task coming soon - Review story completeness and alignment - Update story status: Draft → Approved |
| 14 | `dev` | implementation_files | story.md | Dev Agent (New Chat): @dev - Implements approved story - Updates File List with all changes - Marks story as 'Review' when complete |
| 15 | `qa` | implementation_files | implementation_files | **optional** — OPTIONAL: QA Agent (New Chat): @qa → review-story - Senior dev review with refactoring ability - Fixes small issues directly - Leaves checklist for remaining items - Updates story status (Review → Done or stays Review) |
| 16 | `dev` | implementation_files | — | **if qa_left_unchecked_items** — If QA left unchecked items: - Dev Agent (New Chat): Address remaining items - Return to QA for final approval |
| 17 | _repeat development cycle_ | continue_for_all_stories | — | Repeat story cycle (SM → Dev → QA) for all epic stories Continue until all stories in PRD are complete |
| 18 | `po` | epic-retrospective.md | — | **optional, if epic_complete** — OPTIONAL: After epic completion - NOTE: epic-retrospective task coming soon - Validate epic was completed correctly - Document learnings and improvements |
| 19 | _workflow end_ | project_complete | — | All stories implemented and reviewed! Project development phase complete. Reference: .bmad-core/data/bmad-kb.md#IDE Development Workflow |

## Source definition

The authoritative definition is `${CLAUDE_PLUGIN_ROOT}/core/workflows/greenfield-fullstack.yaml`. Read it when a step
needs detail the table above does not carry (decision guidance, handoff prompts, flow diagram).
