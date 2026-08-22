---
name: aigile-spec-bridge
description: Map a Kiro spec session (requirements, design, tasks) onto AIgile artifacts and agent roles. Use when starting a Kiro spec, writing requirements or design docs in .kiro/specs, or connecting spec tasks to AIgile stories, epics, and quality gates.
license: SEE LICENSE IN LICENSE
metadata:
  author: Mark Gozner
  framework: AIgile Development Method
---

# AIgile Spec Bridge

Kiro specs and AIgile artifacts describe the same delivery in two places. Keep them aligned so
neither becomes stale.

## Phase mapping

| Kiro spec phase | AIgile owner | AIgile artifact |
|-----------------|--------------|-----------------|
| `requirements.md` | `analyst` → `po` | Elicited requirements, epic, acceptance criteria |
| `design.md` | `architect` (with `ux-expert`/`ui-expert` when there is UI) | Architecture decisions, ADRs, front-end spec |
| `tasks.md` | `po` → `dev` | Story task breakdown |
| Task execution | `dev` | Implementation plus tests |
| Post-execution | `qa` | Quality gate decision |

## Writing requirements

- One capability per requirement, with a user-visible outcome.
- Acceptance criteria must be independently testable; avoid "works correctly" phrasing.
- Capture non-functional constraints explicitly (performance budget, security, accessibility).
- Record what is explicitly out of scope — it prevents scope creep later.
- Elicit missing inputs from the user; never invent a requirement to fill a gap.

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
