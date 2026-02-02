---
description: Analyze the project structure, architecture, and design patterns.
mode: agent
---

Your goal is to produce a comprehensive, actionable analysis of the codebase structure, architecture, and dependencies.


# Primary objectives:

Repository scanning — produce a navigable map of the codebase (file tree, module/package boundaries, important files).
Architecture visualization — produce diagrams showing components, services, key modules, data flows, and integration points.
Dependency analysis — enumerate external (third-party) and internal dependencies, versions where available, license risks, and high-level vulnerability pointers.

# Deliverables (formats required):
`docs/architecture.md` human-readable explanation of components, responsibilities, and integration points.
`docs/file-tree.md` — machine-readable tree (paths, sizes, lines).
`docs/internal-dependencies.mmd`. — Mermaid diagram of internal dependencies (packages/modules).
`docs/external-dependencies.mmd`. — Mermaid diagram of external dependencies (third-party services).

# Required output constraints:
JSON must be valid and include confidence scores (0.0–1.0) for inferred relationships.
Diagrams must be Mermaid syntax

# Permissions & safety:

Only read the code (no changes unless explicitly authorized).
Do not attempt to access external private services unless credentials are provided.
If execution environment differs from CI (e.g., Windows vs Linux), note differences and adapt commands.

# TODO checklist (actionable items) (agent must follow these steps):

- [ ] Run `.github/prompts/file-tree-generator.prompt.md` with VISUALIZATION_STYLE = Markdown List; produce `docs/file-tree.md` as output
- [ ] Run `.github/prompts/architecture-blueprint-generator.prompt.md` with appropriate parameters; produce `docs/architecture.md` as output
- [ ] Generate an internal dependency graph (internal packages/modules) and export as Mermaid to `docs/internal-dependencies.mmd`.
- [ ] Generate an external dependency graph (third-party services) and export as Mermaid to `docs/external-dependencies.mmd`.


# Behavior rules:
- MUST follow the TODO checklist step-by-step.
- NEVER modify existing files.
- NEVER hallucinate missing sections—if absent, report them.
- KEEP findings deterministic: if rerun without changes, produce consistent IDs and counts.