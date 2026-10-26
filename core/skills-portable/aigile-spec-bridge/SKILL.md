---
name: aigile-spec-bridge
description: Use when mapping requirements, design and task specifications to AIgile stories, ownership and quality gates before implementing a feature.
---

# Spec Bridge

1. Keep requirements, design and task documents under the project's existing documentation convention, commonly docs/specs/<feature>/. Do not require another editor's spec mode or directories.
2. Analyst and product owner establish value, constraints and independently testable acceptance criteria. Elicit missing requirements; do not invent them.
3. Architect connects design decisions to requirement IDs, alternatives, external contracts and migration risks. Request security review for authorization, permissions or retention changes.
4. Product owner and developer split approved work into independently verifiable tasks with requirement references and tests. Do not start implementation on an unready story.
5. Developer implements and tests; QA independently checks evidence against acceptance criteria. Use available native delegation. Report unavailable review as pending.
6. Update the specification and corresponding story together when scope changes. Keep tasks and validation evidence synchronized without changing protected story sections.

Resources: .aigile-core/templates/story-tmpl.yaml, .aigile-core/templates/architecture-tmpl.yaml, .aigile-core/tasks/ and .aigile-core/checklists/.