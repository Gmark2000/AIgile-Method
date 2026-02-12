# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

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
