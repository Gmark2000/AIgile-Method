<!-- BMAD-informed end-to-end verification process; AIgile paths -->

# QA Task: Verify Jira Story End-to-End

Validate that a Jira story is implemented correctly with adequate tests and quality signals across functional and non-functional aspects.

## Inputs

```yaml
required:
  - urlOrId: 'ENG-123' | 'https://your.atlassian.net/browse/ENG-123'
optional:
  - story_path: '{devStoryLocation}/{epic}.{story}.*.md'
```

## Process (Sequential)

1. Load Story Context
	- Fetch issue; restate objective and AC in your own words
	- Cross-check with local story file if available
2. Map AC → Test Scenarios
	- Positive, negative, and boundary per critical AC
	- Identify NFR checks needed (security/perf/reliability/maintainability)
3. Execute Evidence Gathering
	- Run relevant tests (unit/integration/e2e)
	- Review SonarQube hotspots and issues touching changed code
	- Validate logs/telemetry if available
4. Findings and Verdict
	- Summarize PASS/CONCERNS/FAIL with evidence
	- Provide prioritized fix list and owners
5. Gate Integration (optional)
	- If acting as gate, produce gate file and story update per QA Gate task

## Outputs

- E2E verification report: verdict, evidence, gaps, and recommended fixes
- Optional: gate file under `docs/qa/gates` and story QA Results update

## Checklist

- [ ] Each AC validated (functional + edge cases)
- [ ] Critical NFRs assessed for this change
- [ ] SonarQube has no new high/critical findings
- [ ] Logs/telemetry show expected signals
- [ ] Clear next actions with owners
