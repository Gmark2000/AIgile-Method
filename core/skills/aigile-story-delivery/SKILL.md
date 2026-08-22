---
name: aigile-story-delivery
description: Take a user story from grooming through implementation to done using the AIgile flow. Use when implementing a story or ticket, breaking a story into tasks, checking a story is ready to start, or deciding whether a story is complete.
license: SEE LICENSE IN LICENSE
metadata:
  author: Mark Gozner
  framework: AIgile Development Method
---

# AIgile Story Delivery

The path from a groomed story to a story that is actually done. Follow it in order; do not
start coding on an unready story.

## 1. Readiness check

A story is ready to start only when all of these hold:

- Business value is stated in one sentence.
- Acceptance criteria are testable — each one can be checked pass/fail without interpretation.
- Dependencies are identified and unblocked.
- Test approach is known at least at the level of "unit, integration, or E2E".
- Non-functional constraints are captured (performance, security, accessibility) when relevant.

If any fail, hand back to `po` (criteria, value, scope) or `architect` (design dependency).
Say what is missing; do not silently fill the gap yourself.

## 2. Task breakdown

Split into tasks that are each independently verifiable and small enough to review in one
sitting. For each task, note the files or modules it touches and the test that proves it.
Order tasks so the system stays working after each one.

## 3. Implementation loop

For each task, in this order:

1. Read the surrounding code first; match existing patterns, libraries, and conventions.
2. Implement the smallest change that satisfies the task.
3. Write or update tests covering the new behavior and the edge cases you can name.
4. Run the project's build and the relevant tests.
5. Fix failures before starting the next task. Never leave the tree broken between tasks.

Halt and ask when you hit: a missing dependency, an ambiguous requirement, the same failure
twice in a row, or a regression in unrelated tests.

## 4. Definition of done

- All acceptance criteria demonstrably met, each mapped to a test or a manual verification note.
- Build passes; new and existing tests pass.
- No debug leftovers, commented-out code, or temporary files.
- Errors handled and logged at the right level; no swallowed exceptions.
- Inputs validated; no secrets, tokens, or credentials in code or config.
- Docs updated when behavior, API surface, or setup changed.
- Story file updated: file list, task checkboxes, and completion notes.

## 5. Handoff to QA

Report: what changed (file list), how it was verified, what was *not* covered, and any known
risk. Then let `qa` run the gate. Do not mark a story done on your own signature.

## Resources

- Task instructions: `.aigile-core/tasks/`
- Story template: `.aigile-core/templates/story-tmpl.yaml`
- Definition-of-done checklist: `.aigile-core/checklists/story-dod-checklist.md`
