# execute-checklist

```yaml
id: execute-checklist
role: dev
whenToUse: Run a defined checklist to ensure Definition of Done or role-specific quality criteria are satisfied.
elicit: true
outcome: Completed checklist with PASS/FAIL per item and remediation notes
```

## Objective
Execute a named checklist (e.g., story-dod-checklist.md) and capture gaps before marking work complete.

## Preconditions
- Target checklist file exists under `.aigile-core/checklists/`
- Work item (story/task) is in a state ready for validation

## Steps
1. Ask user which checklist to execute (suggest defaults based on role).
2. Load the checklist file content (do not load other files yet).
3. Present each item as a numbered list and for each:
   - Ask: PASS, FAIL, or N/A
   - If FAIL: request remediation plan or immediate fix steps
4. Summarize failed items and propose concrete next actions.
5. If all required items PASS, produce a READY-FOR-REVIEW summary including:
   - Scope validated
   - Evidence (tests, docs updated)
   - Remaining risks
6. Ask user to confirm closure or request further refinement.

## Outputs
- A structured summary (Checklist Result Table + Next Actions)
- Optional inline remediation plan if failures present

## Guidance
- Never silently assume PASS—always confirm.
- If checklist references artifacts (tests, docs), verify existence or ask user to provide them.
