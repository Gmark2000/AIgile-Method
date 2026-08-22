# review-story

```yaml
id: review-story
role: qa
whenToUse: Perform QA-oriented review of an implemented story before or during formal testing.
elicit: false
outcome: PASS/NEEDS-WORK assessment with concrete gaps.
```

## Objective
Evaluate whether an implemented story meets acceptance, quality, and risk criteria.

## Steps
1. Request story identifier or content if not already loaded.
2. Identify implemented changes (scan file list, code diffs if accessible, or ask user).
3. Map Acceptance Criteria → Observed Implementation / Tests.
4. Check negative/error paths & edge cases.
5. Evaluate non-functional aspects (performance, logging, security hints) if relevant.
6. Produce findings table: Criterion | Status | Notes.
7. Provide overall recommendation with prioritized fix suggestions.

## Outputs
- Findings table
- Recommendation (PASS or NEEDS-WORK)
- Top 3 risk or quality concerns

## Guidance
- Be evidence-driven; avoid generic statements.
- Suggest smallest viable fixes.
