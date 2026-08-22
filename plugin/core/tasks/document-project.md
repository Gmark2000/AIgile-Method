<!-- Inspired by BMAD™ Document Project; scoped to AIgile core-config -->

# Architect Task: Document Project (Brownfield Reality)

## Purpose

Create a concise, practical architecture document that reflects the system as it actually exists. Focus on the parts relevant to upcoming work; reference files instead of duplicating content. Optimize for AI and human contributors to quickly orient and make safe changes.

## Inputs

```yaml
config:
  architectureFile: docs/architecture.md
  architectureSharded: true
  architectureShardedLocation: docs/architecture
  devStoryLocation: docs/stories
```

## Preconditions

- Check if a PRD or specific enhancement goal exists; if yes, scope docs to impacted areas
- Confirm repository build/readme exists; note missing pieces as “gaps”

## Process (Sequential)

1. Scope the Work
	- If PRD/enhancement exists, list modules likely impacted and limit depth to those
	- If no scope, cover the essentials: tech stack, structure, key modules, constraints
2. Discover the Reality
	- Identify entry points, configuration, and environment setup
	- Map repository structure and naming conventions actually used
	- Note workarounds/legacy areas that cannot change
3. Capture Core Architecture
	- Tech Stack summary (runtime, frameworks, DB, queues)
	- Project structure overview with notable deviations from standards
	- Key modules and responsibilities (with file paths)
	- Integration points (internal and external) with locations
4. Constraints and Debt
	- Document technical debt, “gotchas,” and non-negotiable constraints
	- Link to ADRs if present; otherwise, add inline rationale bullets
5. Testing & Operations
	- Testing strategy status (unit/integration/e2e; coverage reality)
	- Build and deployment process as it actually works today
6. Deliverable
	- Create or update `docs/architecture.md` or sharded files under `docs/architecture/`
	- Keep sections short; link to source files and configs

## Suggested Sections (Sharded)

- tech-stack.md
- unified-project-structure.md (aka source-tree.md)
- coding-standards.md
- backend-architecture.md / frontend-architecture.md (if applicable)
- data-models.md / database-schema.md
- rest-api-spec.md / external-apis.md
- testing-strategy.md

## Outputs

- Updated architecture reference under `docs/architecture` aligned to the current codebase
- Clear notes on constraints, debt, and risky areas
- Links to key files and modules for rapid navigation

## Done Criteria

- Architecture docs reflect the current state, not the ideal
- Sections are navigable and reference real file paths
- If a PRD exists, impacted areas are highlighted
- Testing and operations sections state what actually works today
