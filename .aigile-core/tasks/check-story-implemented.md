<!-- BMAD-style verification tailored for Dev; pairs with QA Gate -->

# Dev Task: Check if Story is Implemented

Assess whether code and tests satisfy a Jira story's acceptance criteria and quality bar.

## Inputs

```yaml
required:
  - urlOrId: 'ENG-123' | 'https://your.atlassian.net/browse/ENG-123'
optional:
  - story_path: '{devStoryLocation}/{epic}.{story}.*.md'
```

## Process (Sequential)

1. Read Issue and AC
   - Fetch from Jira; restate AC in Given/When/Then
2. Locate Implementation
   - Search branches/commits/tags by issue key
   - Identify feature flags, migrations, config toggles
3. Compare AC vs Code/Tests
   - Verify positive, negative, and boundary behavior
   - Confirm error handling and logging
4. Run Tests
   - Unit first, then integration/E2E as relevant
   - Add missing unit tests if low-risk and straightforward
5. Non-Functional Pass
   - Check basics of performance, a11y, i18n, and security (as applicable)
6. Findings and Next Actions
   - Provide PASS/CONCERNS/FAIL with specific gaps and minimal-change fixes

## Outputs

- Short report with verdict and evidence
- Optional story note in `Dev Agent Record` with findings and follow-ups

## Checklist

- [ ] AC → Test traceability captured
- [ ] Edge and error handling verified
- [ ] No secrets in logs; logging level appropriate
- [ ] Docs or story record updated as needed
