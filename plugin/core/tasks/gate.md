<!-- Modeled after BMAD qa-gate with AIgile paths -->

# QA Task: Gate Story

Create or update a quality gate decision for a story with clear PASS/CONCERNS/FAIL/WAIVED status and actionable findings.

## Inputs

```yaml
required:
  - story_id: '{epic}.{story}'
  - story_path: '{devStoryLocation}/{epic}.{story}.*.md' # From core-config.yaml
optional:
  - story_title: '{title}'
  - story_slug: '{slug}'
```

## Process (Sequential)

1. Review Story
	- Read objective and AC; restate expected behaviors
	- Verify Dev Agent Record updated and tests passing
2. Inspect Evidence
	- Map AC → tests; note gaps or over-testing
	- Review SonarQube issues related to the change set
	- Spot NFR concerns (security/perf/reliability/maintainability)
3. Determine Gate
	- PASS if AC met and no high-severity issues
	- CONCERNS for non-blocking gaps or missing P1 tests
	- FAIL for unmet AC or high-severity risks (security/data loss)
	- WAIVED only with explicit approval and rationale
4. Create Gate File
	- Save to `qa.qaLocation/gates/{epic}.{story}-{slug}.yml`
	- Use fixed severity scale: low | medium | high
5. Update Story (QA Results section only)
	- Append gate status line and brief rationale

## Gate File Schema (minimal)

```yaml
schema: 1
story: '{epic}.{story}'
story_title: '{title}'
gate: PASS|CONCERNS|FAIL|WAIVED
status_reason: '1-2 sentence explanation'
reviewer: 'Quinn (Test Architect)'
updated: '{ISO-8601 timestamp}'
top_issues: []
waiver: { active: false }
```

## Story Update Snippet

```text
Gate: {STATUS} → qa.qaLocation/gates/{epic}.{story}-{slug}.yml
```

## Quality Checklist

- [ ] AC mapped to tests; gaps documented
- [ ] Severity values use only: low/medium/high
- [ ] NFR concerns captured (security, performance, reliability, maintainability)
- [ ] Gate file written to configured path
- [ ] Story updated under QA Results only
