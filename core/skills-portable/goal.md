# Goal Delivery

1. Establish the objective, acceptance criteria, constraints, out-of-scope work and evidence required for completion. Reuse approved requirements; ask only for genuinely missing decisions. Tasks with elicit=true always require user interaction.
2. Route research and requirements to the analyst and product owner. Record sources, assumptions and unresolved questions. Research current official documentation when framework or tool behavior is uncertain.
3. Route architecture decisions to the architect and UI/UX specialists when applicable. Obtain required human approval before implementation. Keep changes proportional to the objective.
4. Give the developer an approved, testable work item. Implement in small reversible steps with corresponding tests. Run a focused check after each change; fix local failures before expanding scope. Preserve unrelated user edits.
5. Request an independent QA review against the acceptance criteria. A developer's self-tests are evidence, not independent certification. If delegation is unavailable, report QA as pending instead of inventing a review.
6. Report changed artifacts, exact validation results, unmet criteria and blockers. Stop at required approval checkpoints. Never publish, deploy, commit or alter permissions without authorization.

Use available native specialist delegation, not another editor's tool syntax. Maintain a visible checklist for multi-step work. Shared task instructions are in .aigile-core/tasks/, quality checklists in .aigile-core/checklists/, artifact templates in .aigile-core/templates/ and delivery sequences in .aigile-core/workflows/.