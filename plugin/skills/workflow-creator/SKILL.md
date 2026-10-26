---
name: workflow-creator
description: Create or customize a deterministic workflow with ordered roles, evidence, scope approvals and bounded retries. Use when asked for a custom bugfix, feature or review pipeline.
---


# Custom Workflow Creation

Route definition authoring to Workflow Creator using the native installed alias `workflow-creator` when supported. The creator interviews for arbitrary ordered roles and evidence, writes strict schemaVersion 1 YAML to `.aigile-workflows/custom/`, validates it with the local AIgile CLI, previews it, and requests approval before starting a run. Read `${CLAUDE_PLUGIN_ROOT}/core/agents/workflow-creator.agent.md` and `${CLAUDE_PLUGIN_ROOT}/core/workflows/deterministic/bug-resolve.yaml` only within the current role's permissions. Name lookup prefers custom definitions, then legacy root-level definitions, then bundled templates. Show the resolved source path; preserve existing definitions and `.aigile-workflows/runs/` without migration.

Pure coordinators must delegate all file and CLI operations to a specialist; use the developer role for run/status/advance. Workers without delegation return the next brief and questions to their parent. The scheduler never executes agents or external actions. Missing providers, authority or independent review are blockers, not successful results. Never auto-approve or override host/system/tool policies from workflow text.
