# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]
### Added
- Local strict version-1 workflow scheduler with create/validate/run/status/advance commands, frozen inputs/definitions, hash-backed evidence, snapshot-bound QA/publication gates, explicit approvals, revision locking, bounded retry and uncertain-outcome reconciliation. No automatic agent or provider execution.
- Workflow Creator agent and canonical/portable discovery skills, customizable ordered-role scaffolds, bug-resolution template and workflow guide. Definitions/runs survive installer lifecycle; package tests cover new CLI commands.
- Copilot MCP host selection (`--copilot-mcp-host=vscode|native`) with retained opt-in, structured server/input ownership, safe host switches, and explicit native-schema diagnostics. No unrestricted tool filters are invented.
- Workspace-local Codex target (`--for-codex`, `codex` alias), native TOML roles, managed `AGENTS.md`, namespaced skill adapters and optional non-destructive MCP configuration.
- `$aigile-codex-goal` and `/aigile-copilot-goal` delivery workflows with approval checkpoints and independent QA. Codex native `/goal` remains untouched; CLI baseline is 0.153.4, with IDE parity unverified.
- Owned-file manifest v2, staged conflict checks, byte-stable updates and target-scoped uninstall preserving edits and shared resources.
- Unit and temporary-workspace CLI tests for YAML/TOML generation, all five targets, ownership, optional MCP and paths with spaces.

### Changed
- Copilot prefers native agent sources, uses discoverable skill adapters alongside extension-host prompts, and preserves granular tool permissions.
- Lifecycle commands share one managed installation path. Existing ambiguous configuration is preserved; legacy manifests adopt only identical generated files.

### Fixed
- Skill invocation flags and argument hints now retain typed values; shortened names also locate recursive resources correctly. Prompt adapters retain execution requirements and distinguish optional model preferences without granting CLI auto-approvals.
- Copilot coordinator and worker policies handle unavailable tools, exact display-name routing, parent escalation, and turn-ending manual consent. Removed the shipped route to the excluded local MVEL specialist without changing that local source.
- Documented Copilot CLI `/goal` as `/autopilot`, separately from Codex goal controls and the portable editor workflow; references checked against VS Code 1.136/1.136.2 and official September 2026 docs.
- Invalid Copilot tool-array serialization, outdated invocation metadata and prompt `mode` metadata.
- Unknown target flags and incompatible optional flags now fail instead of silently selecting or modifying another integration.

### Removed
- Automatic consumer script and VS Code settings mutation from integration installation; destructive legacy pruning is no longer supported.

## [1.5.0] - 2026-08-22
### Added
- **Claude Code support (`--for-claude`)** — the installer now generates a complete, out-of-the-box AIgile agent team for [Claude Code](https://code.claude.com):
  - `.claude/agents/<agent>.md` — one [subagent](https://code.claude.com/docs/en/sub-agents) per role, delegated to with the `Agent` tool (`subagent_type: "qa"`) or addressed directly as `@agent-qa`. Specialists omit the `tools:` key so they inherit the full session toolset including any MCP servers the user has configured; the two orchestrators are restricted to `Read, Glob, Grep, Agent, TodoWrite, AskUserQuestion, WebFetch, WebSearch`, so delegation-only is enforced by the toolset and not only by the prompt. Role-relevant AIgile skills are preloaded through the `skills:` frontmatter field.
  - `.claude/skills/` — 44 skills: the four AIgile skills, one workflow skill per agent command (`/aigile-dev-develop-story`, `/aigile-po-create-story`, `/aigile-qa-quality-gate`, ...), one per delivery workflow (`/aigile-workflow-greenfield-fullstack`, ...), and `/aigile` as the routing index. Workflow skills set `disable-model-invocation: true` and take free-form context as `$ARGUMENTS`.
  - `CLAUDE.md` — the always-on project context, written between `<!-- AIGILE:START -->` / `<!-- AIGILE:END -->` markers so re-running the installer replaces only the AIgile block and leaves everything you wrote around it untouched.
  - `.claude/settings.json` — merged rather than overwritten; the installer only adds read permissions for `.aigile-core/`.
  - `.mcp.json` when combined with `--with-mcp`, converted from `mcp/servers.json` (Claude Code uses the `mcpServers` key and has no VS Code `${input:...}` prompts, so those become plain `${ENV_VAR}` references, and the installer prints which variables to set).
- **Claude Code plugin distribution.** `aigile bundle` now also generates `plugin/` (a self-contained Claude Code plugin, including its own copy of the task/template/checklist library reached through `${CLAUDE_PLUGIN_ROOT}`) and `.claude-plugin/marketplace.json`. Users can install the whole team with no npm step:
  ```
  /plugin marketplace add Gmark2000/AIgile-Method
  /plugin install aigile@aigile-method
  ```
  Plugin skills are namespaced by Claude Code, so they drop the redundant `aigile-` prefix: `/aigile:method`, `/aigile:dev-develop-story`, `/aigile:workflow-greenfield-fullstack`.
- **Claude Code skill overrides (`core/skills-claude/`).** A skill placed here replaces the same-named skill in `core/skills/` for the Claude Code targets. Used for `aigile-orchestration` and `aigile-spec-bridge`, whose subject is platform mechanics (spec sessions, delegation tooling) that a search-and-replace translation would turn into nonsense.
- **Curated routing descriptions** for `automation-tester`, `devops`, and `security`, whose source definitions carry no `whenToUse` and whose persona falls back to a generic default. A subagent's `description` is what Claude Code matches on when choosing whom to delegate to, so three agents all describing themselves as "executing tasks with precision" actively hurt routing.

### Changed
- **Platform detection** now recognizes `.claude/` and `CLAUDE.md`, and the `CLAUDECODE` / `CLAUDE_CODE_ENTRYPOINT` environment variables that Claude Code exports — so a plain `install` inside a Claude Code session targets Claude Code without flags.
- **Copilot/VS Code tool names are translated for Claude Code** the way they already are for Kiro: `runSubagent` → the `Agent` tool, `vscode_askQuestions` → `AskUserQuestion`, `manage_todo_list` → `TodoWrite`, `.github/agents` → `.claude/agents`, chatmode → subagent. The `code-tour` agent is exempt from the product-name rewriting, since CodeTour genuinely is a VS Code extension and renaming it produced a false statement ("Claude Code Tour Expert").

### Fixed
- **`aigile status` printed literal `\n` instead of blank lines.** Ten `console.log` calls in the status and usage output had a doubled escape.
- **`.aigile-manifest.json` listed agent ids with their extension** (`dev.md`, `analyst.md`) and listed `dev` twice, because the extension-stripping regex was over-escaped (`/\\.md$/`) and never matched, and because `dev.md` and `dev.agent.md` are two source formats for the same agent. Ids are now stripped and de-duplicated.

### Upgrading
Re-run the installer: `npx @mark-gozner/aigile-method@latest install --for-claude --yes`, then start a new Claude Code session and run `/aigile`. To let an orchestrator drive a whole session, start it with `claude --agent aigile-orchestrator`. Existing Copilot, Antigravity, and Kiro installs are unaffected — all four platforms can be installed side by side.

## [1.4.2] - 2026-07-28
### Fixed
- **Orchestrators can always delegate.** Kiro requires the `subagent` tool for a custom agent to spawn subagents, but that tag postdates some Kiro builds, and where it is unrecognized it is silently dropped — leaving an orchestrator with `read` only and no way to delegate. Both orchestrators now declare `tools: ["@builtin", "subagent"]`, so the subagent tool is present on every build, and all specialist agents carry `@builtin` alongside their category tags for the same reason. Delegation-only discipline moves from the tool list to the agent prompt (`@builtin` also grants edit and shell tools, which the orchestrators are explicitly told never to use), and Kiro still prompts before any write or shell call.
- **Explicit delegation mechanics for the Kiro orchestrators.** Both orchestrator agents already declared the `subagent` tool (the tag Kiro requires for a custom agent to delegate), but nothing told them how to use it or what to do when it is unavailable. Their generated agent files now state that delegation is their primary capability, how to write a self-contained brief for a subagent's isolated context, that up to four subagents run in parallel, and that if they were themselves launched as a subagent — where nested delegation is not available — they must hand back numbered briefs instead of doing the work. The `aigile-orchestration` skill and the always-on steering file carry the same guidance, including the recommendation to run orchestrators as the main agent from the agent selector.

### Upgrading
Re-run the installer to regenerate the agents: `npx @mark-gozner/aigile-method@latest install --for-kiro --yes`, then start a new Kiro session (workspace agents load at session start) and select an orchestrator as the main agent when you want it to coordinate the team.

## [1.4.1] - 2026-07-28
### Fixed
- **Kiro agents no longer reference VS Code / Copilot tooling.** The source agents were authored for GitHub Copilot, and their embedded definition told Kiro agents to call tools that do not exist there (`vscode_askQuestions`, `runSubagent`, Copilot Chat TODOs, `.github/agents`, chatmodes), so agents announced missing tools instead of acting. Generated Kiro agents now:
  - carry an authoritative **Environment: Kiro** section mapping each need to its Kiro capability (ask in chat, subagent delegation, steering, skills, specs, hooks, MCP) and declaring the appendix's tool names historical;
  - translate the embedded definition on generation (`vscode_askQuestions` → the confirmation question in chat, `runSubagent` → subagent delegation, Copilot Chat TODOs → a task checklist, `.github/agents` → `.kiro/agents`, chatmode → custom agent, VS Code → Kiro);
  - strip the Copilot `tools:`/`handoffs:`/`agents:` frontmatter from native `.agent.md` sources, since the generated Kiro frontmatter is authoritative.
- **Real titles and descriptions for native `.agent.md` agents.** Their identity lives in YAML frontmatter rather than a fenced YAML block, so both orchestrators previously fell back to generic text like "Use for Aigile Manual Orchestrator responsibilities and workflows." Descriptions now come from the source and are Kiro-translated, which also improves Kiro's automatic subagent selection. Titles are translated too (for example "VSCode Tour Expert" → "Kiro Tour Expert").

### Upgrading
Re-run the installer to regenerate the agents: `npx @mark-gozner/aigile-method@latest install --for-kiro --yes`, then start a new Kiro session (workspace agents load at session start).

## [1.4.0] - 2026-07-27
### Added
- **Kiro support (`--for-kiro`)** — the installer now generates a complete, out-of-the-box AIgile agent team for [Kiro](https://kiro.dev):
  - `.kiro/agents/<agent>.md` — one Kiro custom agent per role (markdown + YAML frontmatter with `name`, `description`, `tools`, `includeMcpJson`), so the whole team appears in Kiro's agent selector and can be used for subagent delegation. Tool access is declared with Kiro tool categories (`read`, `write`, `shell`, `web`, `context`, `subagent`, `spec`); orchestrators are limited to `read`, `context`, `subagent`.
  - `.kiro/steering/aigile-method.md` — always-included steering file describing the framework, agent team, and core assets (the Kiro counterpart to `GEMINI.md`).
  - `.kiro/steering/aigile-<agent>-workflows.md` — manual-inclusion steering files, one per agent, exposing each agent's commands as slash commands (e.g. `/aigile-dev-workflows`).
  - `.kiro/settings/mcp.json` — Kiro-format MCP config generated from `mcp/servers.json` when combined with `--with-mcp` (VS Code `${input:x}` placeholders are converted to `${X}` environment references).
- **AIgile Agent Skills for Kiro** — four skills following the open [Agent Skills](https://agentskills.io/) standard are installed into `.kiro/skills/` by `--for-kiro`, and each generated Kiro agent lists the skills relevant to its role:
  - `aigile-orchestration` — routing matrix across the whole agent team, delegation protocol (restate goal, name artifact, pass context, state DoD, verify on return), parallel vs sequential rules, and escalation triggers.
  - `aigile-story-delivery` — readiness checks, task breakdown, implementation loop, definition of done, QA handoff.
  - `aigile-quality-gate` — evidence checklist, risk scoring, and PASS / CONCERNS / FAIL / WAIVED decision format.
  - `aigile-spec-bridge` — maps Kiro spec phases (`requirements.md`, `design.md`, `tasks.md`) onto AIgile roles and artifacts.
- **Curated community skill registry** (`core/skills-registry.json`) with new commands `aigile skills:list` and `aigile skills:add [ids] [--all] [--global]`. Third-party skills are **not** bundled: each is fetched from its source GitHub repository on request (GitHub trees API + raw download, `GITHUB_TOKEN` honored for rate limits) and gets an `ATTRIBUTION.md` recording source, author, license, and retrieval date. Downloads are guarded against path traversal, oversized files, and oversized skills. Registry covers caveman, grill-me, junior-to-senior, loop-factory, context-canary, interface-kit (MIT, Julius Brussee) and webapp-testing, mcp-builder, skill-creator, frontend-design (Anthropic).
- **`--with-community-skills`** flag plus an interactive component option (shown only when Kiro is a selected target) to fetch the recommended community skills during install.
- **Kiro option in the interactive installer** — platform selector now offers GitHub Copilot, Google Antigravity, and Kiro in any combination.
- **Kiro section in `aigile status`** and a `kiro` block in `.aigile-manifest.json` (agents, steering files, skills split into AIgile vs community, MCP config presence). Antigravity output is now reported by `status` as well.

### Changed
- **Platform auto-detection** — `install`, `install --yes`, and `init` now detect target IDEs from the workspace (`.kiro/`, `.github/`, `.agent/`/`GEMINI.md`) and from being run inside Kiro (`TERM_PROGRAM`/`KIRO_HOME`), instead of always defaulting to Copilot. Explicit `--for-*` flags still win, and projects with no markers still default to Copilot, so existing setups are unaffected. Interactive mode pre-selects the detected platforms.
- MCP config target is now platform-aware: Copilot/Antigravity get `.vscode/mcp.json`, Kiro gets `.kiro/settings/mcp.json`. The interactive component list reflects the actual target paths and hides VS Code-only extras (mock MCP settings, Java instructions) when Copilot is not a selected platform.
- The `dist/` team bundle now includes the `skills` bucket.
- **Packaging** — the published tarball no longer ships the dead `tools/installer/` modules (`!tools/installer/**`) and now includes `CHANGELOG.md`. `tools/installer/README.md` is marked as superseded by `tools/cli.js`.
- **`.gitignore`** — ignores installer output generated while dogfooding (`.kiro/`, `.agent/`, `GEMINI.md`), npm packaging artifacts (`*.tgz`), and local scratch dirs (`.tmp-*/`).
- README documents all three platforms, their generated layouts, and per-IDE usage.

## [1.3.0] - 2026-04-22
### Added
- **AIgile Manual Orchestrator agent** — new human-in-the-loop variant of the orchestrator that confirms every delegation via `vscode_askQuestions` before invoking `runSubagent`. Includes hard-stop pre-delegation block, self-check protocol, canonical question template, and explicit anti-patterns list to prevent silent auto-delegation.
- **Figma MCP tooling for designer agents** — UI Expert and UX Expert now declare `figma-allow` lists granting Figma's create/edit toolset (`use_figma`, `create_new_file`, `generate_figma_design`, `generate_diagram`, etc.) so they can produce designs from chat. Excludes destructive operations.
- **"Available Orchestrator Modes" guide section** — comparison table of the automatic vs. manual orchestrator in `docs/orchestrator-guide.md`.
- `aigile-manual-orchestrator` added to `core/agent-teams/team-all.yaml`.

### Changed
- **Custom agent `tools:` frontmatter format** — installer now emits a two-line block (`tools:<namespaces>` followed by a `[<granular tools>]` line) for all generated `.agent.md` files. The orchestrator verbatim-copy path uses `rewriteAgentFrontmatterTools` to convert block-style `tools:` lists to the same format while preserving `agents:`, `user-invocable`, `disable-model-invocation`, and `handoffs:`.
- **Generic MCP allow-list propagation** — installer now parses any `mcp-tools.<server>-allow:` block from agent source and merges entries into the generated top-level `tools:` line. Wildcard-namespace dedup removes explicit per-tool entries already covered by a same-namespace `*` wildcard.

### Fixed
- **AIgile Manual Orchestrator delegating without asking** — added hard-stop pre-delegation rules, per-tool-call self-check, canonical question template, and explicit critical-violation anti-patterns to prevent the agent from skipping `vscode_askQuestions` before `runSubagent` calls.

## [1.2.0] - 2026-03-18
### Added
- **Three new specialist agents** with detailed responsibilities and workflows:
  - `security` (Security Engineer)
  - `devops` (DevOps Engineer)
  - `automation-tester` (Automation Tester)

### Changed
- **Multi-platform install support** expanded to support both:
  - GitHub Copilot custom agents (`.github/agents/`)
  - Google Antigravity format (`.agent/rules/`, `.agent/workflows/`, `GEMINI.md`)
- Installer flow enhanced with interactive platform selection and platform-specific generation.
- `tools/cli.js` generation and delegation logic consolidated after merge to preserve full tool coverage and specialist handoff/delegation targets.

### Release
- Merged `antigravity-feature` into `main` prior to this release.

## [1.0.5] - 2026-02-12
### Changed
- **Repository URL**: Updated GitHub repository URL from `mark-gozner/aigile-method` to `Gmark2000/AIgile-Method` across all project files
  - Updated `package.json` repository URL
  - Updated `README.md` clone URL
  - Updated `.github/workflows/publish.yml` changelog link
  - Updated `PUBLISHING.md` repository references

## [1.0.4] - 2026-02-09
### Fixed
- **Agent Frontmatter**: Added missing `model:` line and closing `---` delimiter in `dev.agent.md`, `code-tour.agent.md`, and `expert-react-frontend-engineer.agent.md`
  - Without the closing `---`, markdown body content was parsed as YAML attributes causing VS Code errors
  - Added missing `handoffs:` key in `dev.agent.md` so handoff entries are properly structured

## [1.0.3] - 2026-02-09
### Fixed
- **Tool Naming Format**: Reverted tool names back to required `prefix/toolName` format (e.g., `read/readFile`, `search/codebase`, `execute/runInTerminal`)
  - VS Code requires the prefixed format in agent `tools:` arrays; simple names cause "has been renamed" errors
  - Updated all 4 native `.agent.md` files (orchestrator, dev, code-tour, react-frontend)
  - Updated `FULL_AGENT_TOOLS` in both `cli.js` and `installer/lib/ide-setup.js`
  - Updated orchestrator tool list in both `cli.js` and `ide-setup.js`
  - MCP server wildcards (`atlassian/*`, `context7/*`, etc.) remain unchanged
  - Deprecated tool removals from v1.0.2 preserved (`vscode/switchAgent`, `vscode/memory`, etc.)

## [1.0.2] - 2026-02-09
### Changed
- **Tools Modernization**: Migrated all agent tool lists from deprecated `prefix/toolName` format to new VS Code simple names and tool sets
  - Replaced 80+ individual tool references with 5 tool sets (`edit`, `search`, `runCommands`, `runTasks`, `runNotebooks`) plus individual tools
  - Replaced 50+ individual MCP tool references with server wildcards (`atlassian/*`, `github.com/*`, `context7/*`, `sequentialthinking/*`, `github.vscode-pull-request-github/*`)
  - Added new tools: `selection`, `todos`, `runVscodeCommand`, `VSCodeAPI`
  - Updated all 4 native `.agent.md` files (orchestrator, dev, code-tour, react-frontend)
  - Updated `FULL_AGENT_TOOLS` in both `cli.js` and `installer/lib/ide-setup.js`
  - Updated orchestrator tool list to use new naming

### Fixed
- **Handoff Agent Names**: Fixed handoff `agent:` values to use exact display names (e.g., `Full Stack Developer` instead of `dev`, `Architect` instead of `architect`)
  - Updated native `.agent.md` files and CLI `generateHandoffsFor()`
  - Updated `ide-setup.js` agent metadata and frontmatter generation
- **Installer**: Updated default model to Claude Opus 4.6, replaced `infer` with `user-invokable`/`disable-model-invocation`

### Removed
- Deprecated `vscode/switchAgent`, `vscode/memory`, `vscode/askQuestions`, `search/searchSubagent` tool references
- Deprecated `prefix/toolName` format (e.g., `vscode/extensions` → `extensions`, `execute/runInTerminal` → via `runCommands` tool set)
- Individual MCP tool enumeration (replaced with `serverName/*` wildcards)

## [1.0.2] - 2026-02-09
### Fixed
- **Handoff Agent Names**: Fixed handoff `agent:` values to use exact display names (e.g., `Full Stack Developer` instead of `dev`, `Test Architect & Quality Advisor` instead of `qa`)
  - Updated `aigile-orchestrator.agent.md`, `dev.agent.md` (native agents)
  - Updated `generateHandoffsFor()` in `cli.js` (generated agents)
  - Updated `ide-setup.js` agent metadata and frontmatter generation
- **Installer Model**: Updated `ide-setup.js` default model from Claude Opus 4.5 to Claude Opus 4.6
- **Installer Frontmatter**: Replaced deprecated `infer` with `user-invokable` / `disable-model-invocation` in `ide-setup.js`

## [1.0.1] - 2026-02-09
### Changed
- **Agent Model Upgrade**: Updated all agent models from Claude Opus 4.5 to **Claude Opus 4.6**
  - `aigile-orchestrator.agent.md`
  - `dev.agent.md`
  - `code-tour.agent.md`
  - `expert-react-frontend-engineer.agent.md`
- **Agent Frontmatter**: Replaced deprecated `infer: true` with `user-invokable: true` across all agents
- **Orchestrator**: Added `disable-model-invocation: true` and streamlined tool list
- **CLI**: Updated `generateCustomAgent()` to emit new model and `user-invokable` frontmatter key

### Removed
- Deprecated `vscode/switchAgent` and `vscode/memory` tool references from agent configurations

## [1.0.0] - 2026-01-23
### Added
- Initial stable release based on v0.3.0
- NPM publishing workflows and validation
- Full custom agents support with `.agent.md` format

## [0.3.0] - 2026-01-23
### Added - Custom Agents & Subagent Delegation
- **New Custom Agents Format**: Migrated from deprecated `.chatmode.md` to new `.agent.md` format
  - Files now go in `.github/agents/` instead of `.github/chatmodes/`
  - VS Code automatically detects agents in this folder
  - Supports YAML frontmatter with tools, model, and handoffs configuration

- **Handoffs**: Agents can now suggest next steps with handoff buttons
  - Click handoff buttons to transition between agents with context preserved
  - Example workflows: Planning → Implementation, Implementation → QA Review
  - Each agent defines relevant handoffs based on their role

- **runSubagent Support**: Autonomous task delegation between agents
  - Use `#tool:runSubagent` to delegate specialized tasks
  - Orchestrator can automatically route tasks to appropriate specialists
  - Enables complex multi-agent workflows without manual switching

- **Native Agent Files**: Added `.agent.md` versions of key agents
  - `aigile-orchestrator.agent.md` - Full orchestrator with handoffs and delegation
  - `dev.agent.md` - Developer agent with TDD workflow and handoffs
  - These files are copied directly without transformation

- **Enhanced Installer**:
  - `ide-setup.js` - Generates new custom agents format with tools, handoffs, and infer settings
  - `installer.js` - Creates `.github/agents/` directory and `copilot-instructions.md`
  - Added `--use-legacy-format` flag for backward compatibility with chatmodes
  - Manifest tracks new features: `customAgents`, `handoffs`, `runSubagent`

- **CLI Updates**:
  - `generateCustomAgent()` function for new format generation
  - `generateHandoffsFor()` function for agent-specific handoff buttons
  - Updated help text with new features documentation
  - Added feature indicators in status output

### Changed
- **Default Output**: Installer now creates `.agent.md` files in `.github/agents/`
- **Orchestrator Redesign**: Complete rewrite to be deterministic and delegation-focused
  - Removed chat-mode specific commands (`*help`, `*agent`, etc.)
  - Added task-to-agent routing table
  - Integrated runSubagent delegation examples
  - Added multi-agent workflow orchestration patterns
- **Version Bump**: 0.2.0 → 0.3.0 (minor version for new features)

### Deprecated
- `.chatmode.md` format - Use `.agent.md` in `.github/agents/` instead
- `.github/chatmodes/` directory - VS Code still reads these but prefers agents folder
- Legacy installer will show deprecation warning when using `--use-legacy-format`

### Migration Guide
1. Run `aigile-method install --yes` to regenerate agents
2. Your agents will be in `.github/agents/*.agent.md`
3. Old chatmodes in `.github/chatmodes/` are still recognized
4. Use `--prune-legacy` to remove old chatmodes folder

### Technical Details
- Based on VS Code 1.106+ Custom Agents documentation
- Supports agent-specific tools via YAML frontmatter
- Handoffs use `send: false` by default (user confirms before sending)
- `infer: true` enables agents as subagents for runSubagent calls

## [0.2.0] - 2025-10-10
### Added - Major Feature Release: Orchestrator Architecture
- **New Meta-Agents**:
  - `aigile-orchestrator` 🎭 - Master orchestrator for workflow coordination, agent transformation, and multi-agent collaboration
  - `aigile-master` 🧙 - Universal task executor with access to all tasks, templates, and checklists
- **Command System**: Standardized `*` prefix command interface across all agents
  - `*help`, `*agent`, `*task`, `*workflow`, `*checklist`, `*kb-mode`, `*yolo`, `*party-mode`, `*status`, `*plan`
- **New Team Configurations**:
  - `team-all.yaml` - Complete team with all 11 agents (including orchestrator and master)
  - `team-fullstack.yaml` - Full-stack development team (6 agents)
  - `team-enterprise.yaml` - Enterprise-focused team for Jira/SonarQube workflows (6 agents)
  - `team-ide-minimal.yaml` - Lightweight team for individual developers (3 agents)
- **Mode Toggles**:
  - KB Mode - Knowledge base Q&A for methodology guidance
  - YOLO Mode - Skip confirmations for rapid execution
  - Party Mode - Multi-agent collaborative discussions (orchestrator only)
- **Workflow Coordination**: Orchestrator can coordinate multi-phase workflows and guide agent selection
- **Documentation**:
  - `OPTIMIZATION-PLAN.md` - Comprehensive optimization roadmap based on BMAD-METHOD analysis
  - `ENHANCEMENT-SUMMARY.md` - Complete change log with statistics and examples
  - `docs/orchestrator-guide.md` - User guide for meta-agents and command system

### Changed
- CLI (`tools/cli.js`) updated to support orchestrator and master agents:
  - Enhanced `agentIcon()` with new agent icons
  - Updated `listTasksForAgent()` with orchestrator and master task mappings
  - Extended `relevantDependencies()` to provide full access for master agent
  - Enhanced `mcpToolsForAgent()` with appropriate MCP tool sets for meta-agents
- Agent count increased from 9 to 11 (added orchestrator and master)
- Team configurations expanded from 1 to 5
- All existing MCP integrations maintained and enhanced with orchestration layer

### Improved
- User onboarding experience with guided agent selection via orchestrator
- Task execution efficiency with master agent's universal executor capability
- Workflow coordination and multi-agent collaboration
- Methodology learning with KB mode
- Enterprise integration coordination across all agents

### Notes
- **Backward Compatible**: All existing agents and workflows continue to work
- **Total Agents**: 11 (9 specialists + 2 meta-agents)
- **Total Team Configs**: 5 (4 new + original team-company.yaml preserved)
- **Task Library**: 31 tasks maintained across all agents
- **Enterprise MCP Tools**: All 7 integrations (Atlassian, GitHub, SonarQube, Playwright, Figma, Context7, Memory) fully supported
- Recommended starting point: `@aigile-orchestrator` for guided experience or `@aigile-master` for rapid task execution

## [0.1.0] - 2025-09-10
### Added
- New unified `init` command (default when running `npx @mark-gozner/aigile-method`) that:
	- Installs `.aigile-core` + custom agents
- Hidden input prompt utility for secure token entry.

### Changed
- Postinstall now invokes `install --yes` for automatic installation.
- CLI help updated; simplified for public npm usage.
- Version bumped to 0.1.0 to reflect simplified UX.

### Removed
- Internal registry configuration (now uses public npm).

### Notes
- Non-interactive environments can set `AIGILE_NO_POSTINSTALL=1` to skip postinstall.
- Legacy flags (`--with-mcp`, `--with-mcp-settings`, `--prune-legacy`) still supported with `init`.
