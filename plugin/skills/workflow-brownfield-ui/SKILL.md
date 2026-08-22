---
name: workflow-brownfield-ui
description: "AIgile delivery workflow — Agent workflow for enhancing existing frontend applications with new features, modernization, or design improvements. Handles existing UI analysis and safe integration."
argument-hint: "[what you are building]"
disable-model-invocation: true
---

# 🔁 Brownfield UI/Frontend Enhancement

Agent workflow for enhancing existing frontend applications with new features, modernization, or design improvements. Handles existing UI analysis and safe integration.

**Fits:** ui-modernization, framework-migration, design-refresh, frontend-enhancement

**This run:** $ARGUMENTS

## How to run it

This is a multi-agent sequence, not a single task. Drive it as the orchestrator:

1. Put the whole sequence into `TodoWrite` before starting, one entry per step below.
2. For each step, delegate with the `Agent` tool using the listed agent as `subagent_type`.
   Give each subagent a self-contained brief — it cannot see this conversation.
3. Check every produced artifact against the step's stated output before advancing.
   Save documents under `docs/` so later steps can read them.
4. Steps marked optional or conditional need a decision first — use `AskUserQuestion`
   rather than silently skipping or silently running them.
5. If scope changes mid-flight, stop and go back to `pm`/`po` instead of absorbing it.

## Sequence

| # | Agent | Produces | Requires | Notes |
|---|-------|----------|----------|-------|
| 1 | `architect` | multiple documents per the document-project template | — | Review existing frontend application, user feedback, analytics data, and identify improvement areas. |
| 2 | `pm` | prd.md | existing_ui_analysis | **uses brownfield-prd-tmpl** — Creates comprehensive PRD focused on UI enhancement with existing system analysis. SAVE OUTPUT: Copy final prd.md to your project's docs/ folder. |
| 3 | `ux-expert` | front-end-spec.md | prd.md | **uses front-end-spec-tmpl** — Creates UI/UX specification that integrates with existing design patterns. SAVE OUTPUT: Copy final front-end-spec.md to your project's docs/ folder. |
| 4 | `architect` | architecture.md | prd.md, front-end-spec.md | **uses brownfield-architecture-tmpl** — Creates frontend architecture with component integration strategy and migration planning. SAVE OUTPUT: Copy final architecture.md to your project's docs/ folder. |
| 5 | `po` | all_artifacts | — | **uses po-master-checklist** — Validates all documents for UI integration safety and design consistency. May require updates to any document. |
| 6 | `various` | any_flagged_documents | — | **if po_checklist_issues** — If PO finds issues, return to relevant agent to fix and re-export updated documents to docs/ folder. |
| 7 | `po` | sharded_docs | all_artifacts_in_project | Shard documents for IDE development: - Option A: Use PO agent to shard: @po then ask to shard docs/prd.md - Option B: Manual: Drag shard-doc task + docs/prd.md into chat - Creates docs/prd/ and docs/architecture/ folders with sharded content |
| 8 | `sm` | story.md | sharded_docs | **repeats for_each_epic** — Story creation cycle: - SM Agent (New Chat): @sm → *create - Creates next story from sharded docs - Story starts in 'Draft' status |
| 9 | `analyst/pm` | story.md | story.md | **optional, if user_wants_story_review** — OPTIONAL: Review and approve draft story - NOTE: story-review task coming soon - Review story completeness and alignment - Update story status: Draft → Approved |
| 10 | `dev` | implementation_files | story.md | Dev Agent (New Chat): @dev - Implements approved story - Updates File List with all changes - Marks story as 'Review' when complete |
| 11 | `qa` | implementation_files | implementation_files | **optional** — OPTIONAL: QA Agent (New Chat): @qa → review-story - Senior dev review with refactoring ability - Fixes small issues directly - Leaves checklist for remaining items - Updates story status (Review → Done or stays Review) |
| 12 | `dev` | implementation_files | — | **if qa_left_unchecked_items** — If QA left unchecked items: - Dev Agent (New Chat): Address remaining items - Return to QA for final approval |
| 13 | _repeat development cycle_ | continue_for_all_stories | — | Repeat story cycle (SM → Dev → QA) for all epic stories Continue until all stories in PRD are complete |
| 14 | `po` | epic-retrospective.md | — | **optional, if epic_complete** — OPTIONAL: After epic completion - NOTE: epic-retrospective task coming soon - Validate epic was completed correctly - Document learnings and improvements |
| 15 | _workflow end_ | project_complete | — | All stories implemented and reviewed! Project development phase complete. Reference: .bmad-core/data/bmad-kb.md#IDE Development Workflow |

## Source definition

The authoritative definition is `${CLAUDE_PLUGIN_ROOT}/core/workflows/brownfield-ui.yaml`. Read it when a step
needs detail the table above does not carry (decision guidance, handoff prompts, flow diagram).
