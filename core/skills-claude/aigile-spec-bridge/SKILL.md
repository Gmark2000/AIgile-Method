---
name: aigile-spec-bridge
description: Map a spec-driven flow (requirements, design, tasks) onto AIgile artifacts and agent roles. Use when planning a feature before implementing it, writing requirements or design documents under docs/, or connecting a task breakdown to AIgile stories, epics, and quality gates.
license: SEE LICENSE IN LICENSE
metadata:
  author: Mark Gozner
  framework: AIgile Development Method
---

# AIgile Spec Bridge

A spec and the AIgile artifacts describe the same delivery in two places. Keep them aligned so
neither becomes stale.

In Claude Code the spec is a set of markdown documents you write before implementing — commonly
`docs/specs/<feature>/requirements.md`, `design.md` and `tasks.md`. Plan mode is where the
design gets argued out; the documents are what survives the session.

## Phase mapping

| Spec phase | AIgile owner | AIgile artifact |
|------------|--------------|-----------------|
| `requirements.md` | `analyst` → `po` | Elicited requirements, epic, acceptance criteria |
| `design.md` | `architect` (with `ux-expert`/`ui-expert` when there is UI) | Architecture decisions, ADRs, front-end spec |
| `tasks.md` | `po` → `dev` | Story task breakdown |
| Task execution | `dev` | Implementation plus tests |
| Post-execution | `qa` | Quality gate decision |

Delegate each phase with the `Task` tool using that owner as `subagent_type`, and mirror the
task list into `TodoWrite` so progress is visible while the phase runs.

## Writing requirements

- One capability per requirement, with a user-visible outcome.
- Acceptance criteria must be independently testable; avoid "works correctly" phrasing.
- Capture non-functional constraints explicitly (performance budget, security, accessibility).
- Record what is explicitly out of scope — it prevents scope creep later.
- Elicit missing inputs from the user with `AskUserQuestion`; never invent a requirement to
  fill a gap.

## Writing design

- Start from the requirements, and reference them by ID so traceability survives edits.
- State the decision, the alternatives considered, and why the alternatives lost.
- Call out data model changes, migrations, and external contracts separately — they are the
  expensive parts to reverse.
- Flag anything that changes auth, permissions, or data retention for `security` review.

## Writing tasks

- Each task independently verifiable, ordered so the system stays working after each one.
- Reference the requirement IDs each task satisfies.
- Include the test that proves the task, not just the code change.
- Keep tasks implementation-shaped: a task is something you can finish and check in.

## Keeping both in sync

When a spec document changes, update the corresponding AIgile artifact under `docs/` (or the
tracker) in the same pass, and note the change in the story. When the tracker changes first,
reflect it back into the spec before starting implementation. Whichever side you edit second is
the one that goes stale, so never leave the pass half-done.

## Resources

- Templates: `.aigile-core/templates/` (`prd-tmpl.yaml`, `architecture-tmpl.yaml`, `story-tmpl.yaml`)
- Tasks: `.aigile-core/tasks/`
- Checklists: `.aigile-core/checklists/`
