<!-- PM/PO create a Product Requirements Document based on core-config prd settings -->

# PM Task: Create PRD Document

Create or update a Product Requirements Document (PRD) for the project following core/core-config.yaml prd settings. Supports monolithic docs/prd.md or sharded docs/prd/*.

## Inputs

```yaml
required: []
optional:
  - forceSharded: null   # true|false|null; null = follow config
  - savePrompt: true
```

## Process (Sequential)

1. Read Configuration
   - prd.prdSharded, prdFile, prdShardedLocation from core-config.yaml
2. Gather Inputs
   - Vision, Personas, Use cases, High-level features/Epics, Non-functional requirements, Constraints
3. Draft Content
   - If monolithic: docs/prd.md using core/templates/prd-tmpl.yaml as structure guidance
   - If sharded: create/update files under docs/prd/: vision.md, personas.md, use-cases.md, epics.md, nfr.md, constraints.md
4. Preview
   - Present the outline and key sections for confirmation
5. Save Files
   - Write to target locations per config

## Outputs

- PRD documentation created or updated in the repository

### Output (Structured)

```yaml
prd:
  mode: monolithic|sharded
  files:
    - docs/prd.md
    - docs/prd/vision.md
    - docs/prd/personas.md
    - docs/prd/use-cases.md
    - docs/prd/epics.md
    - docs/prd/nfr.md
    - docs/prd/constraints.md
```

## Quality Checklist

- [ ] Clear problem statement and goals
- [ ] Personas and use cases documented
- [ ] NFRs explicit and testable
- [ ] Constraints and dependencies listed
