<!-- BMAD-style architecture review via GitHub context -->

# Architect Task: Code Architecture Review (GitHub)

Assess architecture concerns using GitHub code search, discussions, and historical patterns; recommend targeted refactors with minimal disruption.

## Inputs

```yaml
required:
  - target_areas: ['path/to/module', 'path/to/service']
optional:
  - concerns: ['coupling', 'performance', 'testability']
  - related_issues: []
```

## Process (Sequential)

1. Define Scope
	- Clarify specific concerns (e.g., coupling, boundaries, layering)
	- Identify modules/services in scope
2. Evidence Gathering
	- Use GitHub search to find usages, cycles, divergence from conventions
	- Review PR history and discussions for context and constraints
3. Analysis
	- Evaluate layering, dependency direction, and module boundaries
	- Identify anti-patterns (God objects, feature envy, excessive mocks)
	- Note performance and resilience hotspots
4. Recommendations
	- Propose small, incremental refactors aligned with current patterns
	- Include risks, alternatives, and expected impact
5. Next Steps
	- Link recommended changes to stories/PRs
	- Suggest test adjustments to lock behavior

## Outputs

- Short review document with: scope, findings, recommendations
- Links to code locations and prior PRs/issues for context
- Optional: ADR or doc snippet to `docs/architecture` if decisions are made
