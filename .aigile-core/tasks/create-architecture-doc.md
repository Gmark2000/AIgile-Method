<!-- Architect produce architecture documentation based on core-config, with sharded/monolithic output -->

# Architect Task: Create Architecture Doc

Produce or update the architecture documentation following core/core-config.yaml settings. Supports monolithic docs/architecture.md or sharded docs/architecture/*.md.

## Inputs

```yaml
required: []
optional:
  - forceSharded: null   # true|false|null; null = follow config
  - savePrompt: true     # always ask to write files
```

## Process (Sequential)

1. Read Configuration
   - core-config.yaml → architecture.architectureSharded, architectureFile, architectureShardedLocation
2. Discover Context
   - Source tree, tech stack, coding standards (see devLoadAlwaysFiles), ADRs if present
3. Draft Structure
   - If monolithic: sections = Overview, Context, Architecture Diagrams, Modules, Data, Integrations, Quality Attributes, Decisions (ADRs), Risks
   - If sharded: create/update files under docs/architecture/: tech-stack.md, source-tree.md, coding-standards.md, decisions.md, overview.md, integrations.md, data.md
4. Preview
   - Present outline and key sections to confirm
5. Save Files
   - Write docs/architecture.md (monolithic) or update/create sharded files under docs/architecture

## Outputs

- Updated architecture documentation according to config

### Output (Structured)

```yaml
architecture:
  mode: monolithic|sharded
  files:
    - docs/architecture.md
    - docs/architecture/overview.md
    - docs/architecture/tech-stack.md
    - docs/architecture/source-tree.md
    - docs/architecture/coding-standards.md
    - docs/architecture/integrations.md
    - docs/architecture/data.md
    - docs/architecture/decisions.md
```

## Quality Checklist

- [ ] Architecture reflects the current code reality (brownfield first)
- [ ] Key quality attributes and risks are documented
- [ ] Diagrams or references included where helpful
- [ ] ADRs or decisions are logged
