<!-- BMAD-style SonarQube hotspot triage -->

# QA Task: SonarQube Hotspot Review

Triage SonarQube security hotspots and code issues related to the change set, classify severity, and propose actionable fixes.

## Inputs

```yaml
optional:
  - scope: 'repo|module|path' # default: changed files only
  - branch: 'current'
```

## Process (Sequential)

1. Select Scope
	- Prefer changed files in current branch; expand if needed
2. Retrieve Hotspots and Issues
	- Filter to security hotspots and high-impact code smells
3. Classify Findings
	- Use fixed severity: low | medium | high
	- Note CWE/OWASP mapping if available
4. Recommend Actions
	- Immediate fixes vs follow-up tickets with owners
	- Link to files and lines; suggest tests if applicable
5. Output Summary
	- Provide concise report and optional gate-ready snippet

## Outputs

- Hotspot review report: findings by severity, recommended actions, owners
- Optional gate snippet for inclusion under `top_issues` in QA Gate file

## Severity Scale (Fixed)

- low: minor improvement, not risky
- medium: should fix soon, potential risk area
- high: critical security or correctness risk; blocks release unless waived
