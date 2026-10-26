---
name: aigile-copilot-orchestration
description: Route multi-role requests to AIgile specialists, prepare complete
  delegation briefs, sequence approved delivery phases and verify independent
  quality evidence.
---

Resolve all .aigile-core paths from the workspace root. Load only the task or reference needed for the current request. Follow task steps and elicit=true checkpoints exactly; never invent missing requirements. Read the project's applicable instructions first. Preserve user edits and ask before destructive actions. Use only tools actually available in copilot; shared references describe intent, not executable tool registrations. Missing MCP access is a blocker to report, not permission to fabricate results. Delegation and tool limits are instructions, not a sandbox policy. Inherit the user's model, approvals, trust and sandbox settings.


# AIgile Orchestration

For custom deterministic workflows, route definition authoring and local creation/validation to Workflow Creator (Copilot) or aigile-workflow-creator (Codex), and workflow CLI run/status/advance to Full Stack Developer or aigile-dev respectively. Pure coordinators never read files or run commands. Use the workflow-creator skill for strict YAML in `.aigile-workflows/custom/`, validation, preview and explicit approval before run. Legacy root-level definitions remain readable; report the resolved source path when names collide. Relay the scheduler's current brief only; it does not execute agents or grant tool authority. Workers without nested delegation return briefs/questions to their parent. Native /goal behavior remains unchanged.

Route by the artifact owner: analyst for requirements and research, pm for product scope, po for stories and acceptance, architect for design, dev for approved implementation, qa for independent quality gates, automation-tester for browser tests, security for risk review, devops for infrastructure, ux-expert for interaction design, ui-expert for visual design, sm for facilitation and code-tour for walkthroughs.

Use the native role names exposed by the current client. Codex roles use the aigile- prefix, for example aigile-dev and aigile-qa. Copilot uses its installed agent names. Do not assume a particular delegation tool, concurrency limit, nesting capability or editor-specific permission category.

1. Restate the objective and name the artifact, inputs, constraints, approved decisions and acceptance criteria in each brief. Delegated contexts may not include the current conversation.
2. Research and requirements precede design; approved design and ready stories precede implementation. Reuse existing approvals. Honor every elicit=true and human approval checkpoint.
3. Delegate to the native specialist if available. Parallelize only independent briefs within actual client limits. Manual orchestration requires user confirmation before each delegation and phase transition.
4. Verify returned artifacts and validation evidence. The developer's self-tests do not replace independent QA. If delegation is unavailable, return actionable briefs and report the missing review; do not fabricate completion or take over specialist work as an orchestrator.
5. Escalate conflicting decisions, missing requirements, scope changes and destructive operations to the user. Report concrete results and blockers.

Read shared tasks, workflows, templates and checklists from .aigile-core/ only as needed. Host-prefixed task and workflow skills expose those resources. Native role and skill discovery varies by client; report unavailable capabilities rather than borrowing another editor's tool syntax.
