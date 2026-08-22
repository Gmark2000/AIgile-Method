---
name: workflow-brownfield-fullstack
description: "AIgile delivery workflow — Agent workflow for enhancing existing full-stack applications with new features, modernization, or significant changes. Handles existing system analysis and safe integration."
argument-hint: "[what you are building]"
disable-model-invocation: true
---

# 🔁 Brownfield Full-Stack Enhancement

Agent workflow for enhancing existing full-stack applications with new features, modernization, or significant changes. Handles existing system analysis and safe integration.

**Fits:** feature-addition, refactoring, modernization, integration-enhancement

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
| 1 | `analyst` | classify enhancement scope | — | Determine enhancement complexity to route to appropriate path: - Single story (< 4 hours) → Use brownfield-create-story task - Small feature (1-3 stories) → Use brownfield-create-epic task - Major enhancement (multiple epics) → Continue with full workflow Ask user: 'Can you describe the enhancement scope? Is this a small fix, a feature addition, or a major enhancement requiring architectural changes? |
| 2 | _routing decision_ | — | — | **if based_on_classification** — |
| 3 | `analyst` | check existing documentation | — | **if major_enhancement_path** — Check if adequate project documentation exists: - Look for existing architecture docs, API specs, coding standards - Assess if documentation is current and comprehensive - If adequate: Skip document-project, proceed to PRD - If inadequate: Run document-project first |
| 4 | `architect` | brownfield-architecture.md (or multiple documents) | — | **if documentation_inadequate** — Run document-project to capture current system state, technical debt, and constraints. Pass findings to PRD creation. |
| 5 | `pm` | prd.md | existing_documentation_or_analysis | **uses brownfield-prd-tmpl** — Creates PRD for major enhancement. If document-project was run, reference its output to avoid re-analysis. If skipped, use existing project documentation. SAVE OUTPUT: Copy final prd.md to your project's docs/ folder. |
| 6 | `pm/architect` | determine if architecture document needed | — | **if after_prd_creation** — Review PRD to determine if architectural planning is needed: - New architectural patterns → Create architecture doc - New libraries/frameworks → Create architecture doc - Platform/infrastructure changes → Create architecture doc - Following existing patterns → Skip to story creation |
| 7 | `architect` | architecture.md | prd.md | **if architecture_changes_needed, uses brownfield-architecture-tmpl** — Creates architecture ONLY for significant architectural changes. SAVE OUTPUT: Copy final architecture.md to your project's docs/ folder. |
| 8 | `po` | all_artifacts | — | **uses po-master-checklist** — Validates all documents for integration safety and completeness. May require updates to any document. |
| 9 | `various` | any_flagged_documents | — | **if po_checklist_issues** — If PO finds issues, return to relevant agent to fix and re-export updated documents to docs/ folder. |
| 10 | `po` | sharded_docs | all_artifacts_in_project | Shard documents for IDE development: - Option A: Use PO agent to shard: @po then ask to shard docs/prd.md - Option B: Manual: Drag shard-doc task + docs/prd.md into chat - Creates docs/prd/ and docs/architecture/ folders with sharded content |
| 11 | `sm` | story.md | sharded_docs_or_brownfield_docs | **repeats for_each_epic_or_enhancement** — Story creation cycle: - For sharded PRD: @sm → *create (uses create-next-story) - For brownfield docs: @sm → use create-brownfield-story task - Creates story from available documentation - Story starts in 'Draft' status - May require additional context gathering for brownfield |
| 12 | `analyst/pm` | story.md | story.md | **optional, if user_wants_story_review** — OPTIONAL: Review and approve draft story - NOTE: story-review task coming soon - Review story completeness and alignment - Update story status: Draft → Approved |
| 13 | `dev` | implementation_files | story.md | Dev Agent (New Chat): @dev - Implements approved story - Updates File List with all changes - Marks story as 'Review' when complete |
| 14 | `qa` | implementation_files | implementation_files | **optional** — OPTIONAL: QA Agent (New Chat): @qa → review-story - Senior dev review with refactoring ability - Fixes small issues directly - Leaves checklist for remaining items - Updates story status (Review → Done or stays Review) |
| 15 | `dev` | implementation_files | — | **if qa_left_unchecked_items** — If QA left unchecked items: - Dev Agent (New Chat): Address remaining items - Return to QA for final approval |
| 16 | _repeat development cycle_ | continue_for_all_stories | — | Repeat story cycle (SM → Dev → QA) for all epic stories Continue until all stories in PRD are complete |
| 17 | `po` | epic-retrospective.md | — | **optional, if epic_complete** — OPTIONAL: After epic completion - NOTE: epic-retrospective task coming soon - Validate epic was completed correctly - Document learnings and improvements |
| 18 | _workflow end_ | project_complete | — | All stories implemented and reviewed! Project development phase complete. Reference: .bmad-core/data/bmad-kb.md#IDE Development Workflow |

## Source definition

The authoritative definition is `${CLAUDE_PLUGIN_ROOT}/core/workflows/brownfield-fullstack.yaml`. Read it when a step
needs detail the table above does not carry (decision guidance, handoff prompts, flow diagram).
