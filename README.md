# AIgile Development Method

A pragmatic, agent-driven agile method designed for IDE-native AI assistants. It ships with ready-to-run agents, executable tasks, MCP server wiring, and docs/templates to bootstrap product delivery.

Supported platforms: **OpenAI Codex**, **Claude Code**, **GitHub Copilot**, **Google Antigravity**, and **Kiro**. One installer adapts the same team to each client's native assets.

Roles covered: Analyst, Architect, Dev, React Engineer, DevOps, Security, QA, Automation Tester, PM, PO, SM, UX-Expert, UI-Expert, Code Tour, plus two orchestrators (automatic and human-in-the-loop).

---

## Installation

### Quick Start (npm)

Prereqs: Node.js 18+ (20+ recommended)

Release status: the Codex/Copilot changes described here are local source changes, not yet published; the package version remains **1.5.0**. The public `npx` examples describe these features when released, not availability in the current npm release. To try this implementation now, run `node C:/Users/mark.gozner/GM/AI/public-req2code/tools/cli.js install --for-codex --for-copilot --yes` from your target project (adjust the checkout path).

Install AIgile into your project:

```bash
npx @mark-gozner/aigile-method install
```

The installer detects `.codex/`, `.kiro/`, `.github/`, `.agent/`, `.claude/`, `GEMINI.md`, `CLAUDE.md`, and Kiro/Claude session signals. Shared `AGENTS.md` or `.agents/` alone does not select Codex. Explicit target flags win; projects without markers default to Copilot. Unknown `--for-*` flags fail.

The interactive installer offers all five platforms in any combination. You can skip selection with flags:

```bash
npx @mark-gozner/aigile-method install --for-codex --yes         # OpenAI Codex only
npx @mark-gozner/aigile-method install --for-claude --yes        # Claude Code only
npx @mark-gozner/aigile-method install --for-copilot --yes       # GitHub Copilot only
npx @mark-gozner/aigile-method install --for-antigravity --yes   # Antigravity only
npx @mark-gozner/aigile-method install --for-kiro --yes          # Kiro only
npx @mark-gozner/aigile-method install --for-copilot --for-antigravity --for-kiro --for-claude --yes
```

### Codex and Copilot Workflows

Codex gets native `.codex/agents/aigile-<role>.toml` roles, discoverable `.agents/skills/aigile-codex-*/SKILL.md` skills, and a managed root `AGENTS.md` block pointing to `.aigile-core/`. No configuration file is needed for role discovery. `codex` is an installer alias; `init`, `install`, `update`, and `auth-install` accept `--for-codex`. Integration lifecycle commands are workspace-local and reject `--global`.

In Codex, invoke `$aigile-codex-goal <objective>` to clarify acceptance, research, design, implement an approved work item, and request independent QA. Task elicitation and human approval checkpoints remain mandatory. Tasks, prompts (including nested prompts), workflows, reusable skills and reference libraries are exposed through namespaced skill adapters.

Native Codex **`/goal` is not overridden**. On the documented CLI baseline **0.153.4**, bare `/goal` displays the goal, `/goal <objective>` sets it, and `edit`, `pause`, `resume`, `clear` are controls. `status` and `view` are objective text, not controls. The AIgile skill cannot programmatically set persistent goal state. Older-client support, IDE `/goal` parity, runtime discovery and delegation require separate client QA; the installer does not install or upgrade Codex.

On that CLI baseline, the native `goals` feature is stable and enabled by default. To explicitly enable it for one launch, run `codex --enable goals` (equivalent to `codex -c features.goals=true`), then use `/goal` inside the CLI. This launch override does not write persistent configuration; the installer never enables it automatically. If native goals are unavailable, use `$aigile-codex-goal <objective>` as the portable workflow, without native persistent goal state or a promise of IDE `/goal` support. Verified against official tagged source: [Goals feature](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/features/src/lib.rs#L1544), [CLI enable override](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/cli/src/main.rs), [goal dispatch](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/tui/src/chatwidget/slash_dispatch.rs).

Copilot keeps extension-host prompt files and adds `.github/skills/aigile-copilot-*` adapters, including `/aigile-copilot-goal`, for skill-capable sessions such as Agent Host. Native `.agent.md` definitions take precedence; tool arrays retain granular grants, invocation metadata uses `user-invocable`, and prompt metadata uses `agent`. This does not promise full Agent Host feature parity.

Copilot CLI native `/goal [OBJECTIVE]` is an alias for `/autopilot`: it starts or refocuses autonomous work, inferring intent from context when no objective is supplied. These are not Codex goal controls. AIgile does not register an editor-native `/goal`; use `/aigile-copilot-goal <objective>` for the portable delivery workflow.

Skills retain typed `user-invocable`, `disable-model-invocation`, and `argument-hint` metadata, including explicit `false`. Long skill names and nested resources share one resolved directory. Prompt adapters preserve the source agent, tool boundary, and model preference in their execution instructions. Required agent context or permissions that cannot be honored cause a stop and referral to the native prompt in an extension-host session. Optional model hints may fall back with disclosure. Missing `${...}` inputs and `#file:` context must be requested, while literal examples remain literal. Prompt tool restrictions never become skill `allowed-tools`, which would auto-approve tools in Copilot CLI.

Portable prose conversion protects indented and fenced code after repeated blockquote and list prefixes, including mixed nesting and blank continuations. Literal lines retain their original bytes. This is a conservative prefix recognizer, not a complete CommonMark parser: ambiguous tab padding and four-space indentation are left untranslated, and an unmatched fence protects the remaining text. It does not resolve every container lifetime or lazy paragraph continuation; ordinary unambiguous prose still converts.

For Copilot MCP, the default opt-in remains `--for-copilot --with-mcp` for VS Code. Add `--copilot-mcp-host=native` for workspace `.mcp.json` instead. The host is remembered on updates; no opt-in means no MCP changes on a fresh install. Native output requires explicit catalog tool filters; the current catalog lacks them, so its entries are skipped with diagnostics rather than inventing unrestricted filters. See [MCP host requirements and lifecycle](docs/mcp-servers.md#copilot-mcp-hosts).

Documentation baseline checked September 9, 2026: [VS Code 1.136](https://code.visualstudio.com/updates/v1_136), released September 2, including the 1.136.2 security update; [Agent Host](https://code.visualstudio.com/docs/agents/concepts/agent-host); [skills](https://code.visualstudio.com/docs/agent-customization/agent-skills); [prompt tool priority](https://code.visualstudio.com/docs/agent-customization/prompt-files); [subagents](https://code.visualstudio.com/docs/agents/run/subagents); [Copilot CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference). Plugin 1.0 GA migration is deferred; existing plugin output remains supported. Preview hooks, forked skill context, user-profile migration, and automatic nested-delegation settings are out of scope.

Installer tests validate generated contracts and temporary-workspace lifecycle, not live agent execution. Before optional discovery, use a temporary `COPILOT_HOME` with `COPILOT_AUTO_UPDATE=false` and check `copilot --version` and `copilot --help`. Use `copilot plugins list --json` only when that version's subcommand help advertises the command and option. Independent QA found CLI 1.0.4 rejects this option as `UNKNOWNOPTION`; the latest documentation is not proof of installed capability. Otherwise review generated files manually. Live-session `/env` is a user-run fallback in an already authorized session, not verified here; custom agents and session hooks are not covered by `plugins list`. Do not start an autonomous session or live MCP server just to validate installation.

### Custom Deterministic Workflows

The local CLI supports `workflow create`, `validate`, `run`, `status`, and `advance`. Start with `aigile workflow create bug-resolve-wf --from bug-resolve`, then `aigile workflow run bug-resolve-wf --issue PROJ-123`. Use `--steps pm,dev,qa,devops` or `--definition FILE` for custom sequences, or ask **Workflow Creator** to author and validate one. See [the complete workflow guide](docs/workflows.md) for checkout commands, strict YAML, structured inputs, result/approval templates, retries and reconciliation.

In VS Code, select **Workflow Creator** from the Chat agent picker; its workspace definition is `.github/agents/workflow-creator.agent.md`. It creates and validates definitions, shows a preview and waits for approval before handing off execution. Coordinators route to this exact agent name.

New definitions live in `.aigile-workflows/custom/`; run state stays in `.aigile-workflows/runs/`, outside installer ownership. Name lookup prefers custom definitions, then legacy `.aigile-workflows/NAME.yaml`, then bundled templates; validation/status show the selected source path. Existing definitions are never silently moved or overwritten. Scheduling is deterministic; agent work is not. The CLI never executes agents or external actions. Hash-backed evidence and approvals are attestations, not proof of test execution or authentic consent. The bug template gates scope before development, independent snapshot-bound QA and an explicitly scoped draft PR action. These changes are unreleased and do not override native `/goal`.

For a custom two-writer pipeline: `aigile workflow create delivery --steps dev,dev,qa,devops --snapshot-paths lib`, then `aigile workflow validate delivery` and `aigile workflow run delivery --host copilot`. Use existing code paths (`src` is the default), complete each current worker brief, refresh `workflow status RUNID`, fill its `next.resultTemplate` with actual evidence paths/hashes, and submit `workflow advance RUNID --result FILE`. Repeat until completed; no publication is authorized by this scaffold. Retry requires `--retry STEP --expected-revision INTEGER`. The [workflow guide](docs/workflows.md) includes every result, approval and reconciliation command.

Code-writing steps explicitly declare `writesCode: true` (only with code binding and evidence guard), independent of role. Nonwriters and QA bind to the latest contribution; any later writer invalidates publication review eligibility, even for identical bytes. Saved-state consistency is validated on read and write. Windows local NTFS commits preserve exact owner/group/DACL and inheritance via protected staging; unsupported preservation fails closed. POSIX preserves owner/group/mode or refuses. These are single-file guarantees, not a sandbox or proof of external actions.

New workflow release assets are explicitly selected by the synchronizer even before Git staging. Unrelated untracked agents remain excluded. The real-root/staged/extracted package gate also runs workflow CLI tests.

### Safe Updates and Removal

Installation renders into staging, checks conflicts, and records hashes and target owners in a v2 manifest. Reinstall is byte-stable; unchanged owned files can be updated. Modified or unowned conflicting files are preserved and cause a nonzero result, even with `--yes`. Back up and move each reported conflict, or restore its last generated contents, before retrying. Legacy count-only manifests and identical bytes do not establish ownership: matching pre-existing files stay unowned and are never deleted by target removal.

Commit failures roll back created, updated and deleted files together with the manifest. Originals are backed up before commit; if restoration fails, the error lists retained `.bak` files for manual recovery. Preserve those backups and restore before retrying. This is recoverable rollback, not full filesystem atomicity or automatic crash recovery. Concurrent changes detected during rollback are not overwritten.

On POSIX, replacements and rollback/uninstall rewrites preserve existing ordinary permission bits. New managed files (including config, roles and manifests) use `0600`; backups keep only the original owner's read/write bits, never group/other access. Private stage files receive their destination mode before rename, independently of umask. This does not preserve ownership, ACLs or special mode bits. On Windows, writes request restrictive modes and read-only destinations are refused without clearing the attribute, but Node mode bits do not enforce POSIX privacy or preserve Windows ACLs. Use an appropriately restricted destination directory; Windows ACL preservation is not guaranteed or tested. Real POSIX mode tests are conditional and are skipped on Windows.

```bash
npx @mark-gozner/aigile-method update --for-codex --for-copilot
npx @mark-gozner/aigile-method uninstall --for-codex
```

`update` uses the executing package, without fetching a package or upgrading clients. `uninstall` requires explicit targets and removes only unchanged owned outputs; edited files and resources shared with another target remain. Codex managed blocks preserve surrounding text. Copilot MCP uses structured per-server/input ownership, preserving unrelated JSON keys and servers (not whitespace). Other conflicting shared configurations are conservatively reported rather than overwritten. Automatic legacy pruning is disabled. Installation no longer changes consumer package scripts or VS Code delegation settings automatically.

The v2 target ledger is authoritative for implicit installs and updates, including an empty ledger after uninstall. Leftover client directories do not reactivate removed targets. Legacy installations without a v2 ledger still use client detection; explicitly pass `--for-*` to add a target.

Maintainer checks: `npm test` runs unit and isolated CLI tests. `npm run sync:clients` refreshes canonical metadata, mirrors and release bundles from staged inputs and generates the explicit `package.json` release-file allowlist. Review this list when adding release assets; new canonical agents must be tracked in Git. Untracked source agents and stale generated extras remain on disk but are not packaged. `npm run check:clients` checks drift. Supported release packaging is `npm pack` from a dependency-installed Git checkout: `prepack` synchronizes and runs the package gate. `npm run test:package` compares the staged gate with actual root `npm pack --dry-run --ignore-scripts --json` file paths and source bytes, packs the root with scripts disabled to avoid recursion, and reruns CLI tests from the extracted tarball in a path with spaces. The checked-in allowlist also constrains `--ignore-scripts` packaging, but bypassing scripts skips freshness validation. Git, tar and npm are required; set `AIGILE_NPM_CLI` if npm is not next to Node. No publishing or live MCP calls occur.

### Claude Code plugin (no npm install)

Claude Code can install the whole agent team straight from this repository:

```
/plugin marketplace add Gmark2000/AIgile-Method
/plugin install aigile@aigile-method
```

That gives you the 17 subagents plus every workflow namespaced under `/aigile:` — `/aigile:method` for routing help, `/aigile:dev-develop-story`, `/aigile:qa-quality-gate`, `/aigile:workflow-greenfield-fullstack`, and so on. The plugin carries its own copy of the task, template, and checklist library, so there is nothing else to install. Use the npm installer instead when you want the framework files checked into your repo as `.aigile-core/`, or when you want `.mcp.json` wiring.

Add MCP config (optional):
```bash
npx @mark-gozner/aigile-method install --with-mcp
```

Bundle (optional text bundles to `dist/`):
```bash
npx @mark-gozner/aigile-method bundle
```

What this gives you in the project:
- `.aigile-core/` – roles, tasks, templates, checklists, data, workflows
- `.github/agents/` – GitHub Copilot custom agents (`--for-copilot`)
- `.codex/agents/`, `.agents/skills/aigile-codex-*/`, `AGENTS.md` - Codex roles, skills and managed guidance (`--for-codex`)
- `.agent/rules/`, `.agent/workflows/`, `GEMINI.md` – Google Antigravity (`--for-antigravity`)
- `.kiro/agents/`, `.kiro/steering/`, `.kiro/skills/` – Kiro custom agents, steering, and Agent Skills (`--for-kiro`)
- `.claude/agents/`, `.claude/skills/`, `CLAUDE.md`, `.claude/settings.json` – Claude Code subagents, skill workflows, and project context (`--for-claude`)
- `.vscode/mcp.json`, `.kiro/settings/mcp.json`, or `.mcp.json` – only if you pass `--with-mcp`
- `.aigile-manifest.json` - owned-file hashes, target owners and per-client capabilities

To update later (e.g., after a version bump):
```bash
npx @mark-gozner/aigile-method install --yes
```

### Clone-and-Run (No npm Install Needed)

```bash
# 1) Clone the repository once
git clone https://github.com/Gmark2000/AIgile-Method.git ~/aigile-method

# 2) In any target project
cd /path/to/your/project
node ~/aigile-method/tools/cli.js install

# Optional: include MCP config
node ~/aigile-method/tools/cli.js install --with-mcp

# Bundle (team + agents)
node ~/aigile-method/tools/cli.js bundle
```

Optional convenience:
- Bash: `export AIGILE_HOME="$HOME/aigile-method"` then `node "$AIGILE_HOME/tools/cli.js" install`
- PowerShell: `$env:AIGILE_HOME = "$HOME/aigile-method"` then `node "$env:AIGILE_HOME/tools/cli.js" install`

---

### Custom Agents

Every supported platform gets the full AIgile agent team out of the box, generated from the same source definitions in `core/agents/`.

**Claude Code** (`.claude/agents/`, `.claude/skills/`, `CLAUDE.md`)
- One [subagent](https://code.claude.com/docs/en/sub-agents) per role, delegated to with the `Agent` tool (`subagent_type: "qa"`) or addressed directly as `@agent-qa`
- Specialists inherit the full session toolset, including whatever MCP servers you have configured — only the two orchestrators are restricted, to `Read, Glob, Grep, Agent, TodoWrite, AskUserQuestion, WebFetch, WebSearch`, so "delegation-only" is enforced by the toolset and not just by the prompt
- Role-relevant AIgile skills are preloaded per agent via the `skills:` frontmatter field
- Copilot/VS Code tool names in the source definitions are translated to their Claude Code equivalents (`runSubagent` → `Agent`, `vscode_askQuestions` → `AskUserQuestion`, `manage_todo_list` → `TodoWrite`)
- `CLAUDE.md` includes AIgile project context; pre-existing or edited conflicting files are preserved and reported for manual resolution
- `.claude/settings.json` supplies read permissions for `.aigile-core/`; user settings are never silently replaced
- `.mcp.json` when combined with `--with-mcp`

**GitHub Copilot** (`.github/agents/*.agent.md`)
- Strong system directives for persona maintenance
- YAML frontmatter with tools, handoffs, and model configuration
- Subagent delegation support via `runSubagent`

**Google Antigravity** (`.agent/rules/`, `.agent/workflows/`, `GEMINI.md`)
- One rule file per agent plus one workflow file per agent command
- `GEMINI.md` as the project-level agent index

**Kiro** (`.kiro/agents/`, `.kiro/steering/`, `.kiro/skills/`)
- One [custom agent](https://kiro.dev/docs/custom-agents/) per role, so the whole team shows up in Kiro's agent selector and is available for subagent delegation
- Tool access declared with Kiro tool categories (`read`, `write`, `shell`, `web`, `context`, `subagent`, `spec`) plus `@builtin` and `includeMcpJson: true`, so subagent delegation works across Kiro builds
- Orchestrators are delegation-only by prompt, not by tool restriction — they need `@builtin` for the subagent tool to be reliably present
- `.kiro/steering/aigile-method.md` — always-included framework context
- `.kiro/steering/aigile-<agent>-workflows.md` — manual [steering files](https://kiro.dev/docs/steering/) that show up as slash commands (e.g. `/aigile-dev-workflows`)
- `.kiro/skills/` — AIgile [Agent Skills](https://kiro.dev/docs/skills/) (see below)
- `.kiro/settings/mcp.json` when combined with `--with-mcp`

Generated agents retain source references or appendices for transparency. Restore an edited output to its last generated content before reinstalling, or back it up and move it aside; reinstall never silently discards edits.

---

### Agent Skills (Kiro and Claude Code)

`--for-kiro` and `--for-claude` install four AIgile skills (into `.kiro/skills/` and `.claude/skills/`), following the open [Agent Skills](https://agentskills.io/) standard. They load on demand when a request matches their description, and each generated agent lists the skills relevant to its role.

| Skill | What it covers |
|-------|----------------|
| `aigile-orchestration` | Routing matrix for the whole team, delegation protocol, sequencing rules, when to escalate |
| `aigile-story-delivery` | Story readiness, task breakdown, implementation loop, definition of done, QA handoff |
| `aigile-quality-gate` | Evidence gathering, risk scoring, and PASS / CONCERNS / FAIL / WAIVED decisions |
| `aigile-spec-bridge` | Mapping spec phases (requirements, design, tasks) onto AIgile artifacts and roles |

Two of these describe platform mechanics rather than pure process, so Claude Code gets hand-written versions from `core/skills-claude/` instead of a machine translation of the Kiro wording.

#### Workflow skills (Claude Code)

`--for-claude` additionally turns every agent command and every delivery workflow into its own invocable skill, so the whole method is reachable from the `/` menu:

| Skill | What it does |
|-------|--------------|
| `/aigile` | Routing index — which agent, which workflow, and the sequencing rules |
| `/aigile-<agent>-<command>` | One per agent command (33 of them): `/aigile-dev-develop-story`, `/aigile-po-create-story`, `/aigile-qa-quality-gate`, ... |
| `/aigile-workflow-<name>` | One per delivery workflow (6): the greenfield and brownfield sequences, rendered as a step table with the agent, artifact, and preconditions for each step |

Each workflow skill sets `disable-model-invocation: true` — they run when you ask for them, not on Claude's initiative — and accepts free-form context as `$ARGUMENTS`.

#### Community skills

AIgile also ships a curated registry of third-party skills. Nothing third-party is bundled in the npm package — `skills:add` downloads each skill from its source repository at your request and writes an `ATTRIBUTION.md` recording source, author, license, and retrieval date.

```bash
npx @mark-gozner/aigile-method skills:list                  # browse the registry
npx @mark-gozner/aigile-method skills:add                   # recommended set
npx @mark-gozner/aigile-method skills:add caveman grill-me  # specific skills
npx @mark-gozner/aigile-method skills:add --all --global    # everything, into ~/.kiro/skills
npx @mark-gozner/aigile-method install --for-kiro --with-community-skills --yes
```

The registry currently covers [caveman](https://github.com/JuliusBrussee/caveman) (token-thrifty replies), [grill-me, junior-to-senior, loop-factory, context-canary, interface-kit](https://github.com/JuliusBrussee/skills) (all MIT, by Julius Brussee), and [webapp-testing, mcp-builder, skill-creator, frontend-design](https://github.com/anthropics/skills) from Anthropic's public skills repo. Set `GITHUB_TOKEN` if you hit GitHub API rate limits. These are third-party instructions that will steer your agent — review them before use.

---

## Using AIgile in your IDE

**Claude Code**
1) Run `/aigile` for routing help, or ask directly ("use the po subagent to draft stories for FEAT-12")
2) Pin a specific specialist with `@agent-dev`, `@agent-qa`, … when you do not want Claude choosing for you
3) Type `/aigile-` to browse the workflows, e.g. `/aigile-dev-develop-story STORY-142`
4) Hand a whole piece of work to a coordinator by starting the session as one:
   ```bash
   claude --agent aigile-orchestrator          # coordinates autonomously
   claude --agent aigile-manual-orchestrator   # asks before every delegation
   ```
   Or pin it for the project with `"agent": "aigile-orchestrator"` in `.claude/settings.json`. Spawning an orchestrator as a subagent also works — subagents nest up to three layers below the main conversation — but you only see its final summary
5) Run `/agents` to inspect or tweak the installed team

**GitHub Copilot**
1) Pick an agent for a role (e.g., PO, PM, Architect) from the Agents dropdown in Copilot Chat
2) Ask for help with a specific command (e.g., "\*help" or "\*create-epic")

**Kiro**
1) Open the workspace and trust it when prompted (required for `.kiro/agents/` to load)
2) Choose a role from the agent selector, or ask Kiro to run one as a subagent ("Use the `po` subagent to draft stories")
2b) Run `aigile-orchestrator` / `aigile-manual-orchestrator` as the **main** agent when you want it to coordinate the team. They declare the `subagent` tool, but a subagent cannot spawn further subagents, so an orchestrator launched as a subagent can only hand briefs back
3) Type `/` in chat to pull in a workflow or skill (e.g. `/aigile-qa-workflows`, `/aigile-quality-gate`)
4) Manage everything from the Agent Steering & Skills panel in the Kiro side bar

**Antigravity**
1) Open the project — rules and workflows are picked up from `.agent/`

In all cases, when you execute a task the agent loads the exact file from `.aigile-core/tasks/...` and follows it step by step.

Key principles:
- Tasks are executable instructions; follow them exactly.
- Elicitation steps are mandatory; agents will ask for missing inputs.
- Save-to-docs prompts help persist artifacts under `docs/` for traceability.

---

## CLI Commands

After installation you can use:

| Command | Purpose |
|---------|---------|
| `npx @mark-gozner/aigile-method install --yes` | Re-install / regenerate agents |
| `npx @mark-gozner/aigile-method install --for-claude --yes` | Install the agent team for Claude Code |
| `npx @mark-gozner/aigile-method install --for-kiro --yes` | Install the agent team for Kiro |
| `npx @mark-gozner/aigile-method install --for-antigravity --yes` | Install the agent team for Antigravity |
| `npx @mark-gozner/aigile-method install --with-mcp --yes` | Include MCP config (`.vscode/mcp.json`, `.kiro/settings/mcp.json`, or `.mcp.json` for Claude Code) |
| `npx @mark-gozner/aigile-method bundle` | Build text bundles and regenerate the Claude Code plugin in `plugin/` |
| `npx @mark-gozner/aigile-method status` | Show installed version, agents, agent count, skills, MCP info |
| `npx @mark-gozner/aigile-method list:agents` | List installed agent IDs |
| `npx @mark-gozner/aigile-method skills:list` | List AIgile skills and the curated community registry |
| `npx @mark-gozner/aigile-method skills:add [ids]` | Fetch community skills into `.kiro/skills/` |

Consumer `package.json` helper scripts are auto-added (unless `AIGILE_ADD_SCRIPTS=0`) for convenience:
```json
"scripts": {
  "aigile:install": "aigile-method install --yes",
  "aigile:bundle": "aigile-method bundle",
  "aigile:status": "aigile-method status",
  "aigile:list": "aigile-method list:agents"
}
```
Remove or customize as needed.

The installer writes an `.aigile-manifest.json` summarizing what was installed (version, agents, agent count, MCP components). Re-running install updates it.

---

## Publishing (npm)

This package is configured to publish to the public npm registry.

### 1. Authentication

Use standard npm authentication:

```bash
npm login
```

Or set `NPM_TOKEN` environment variable for CI/CD.

### 2. Build & Validate

```bash
npm install
npm run validate   # builds bundles and validates
npm run pack:dry-run  # view what would be published
```

### 3. Publish

Patch / minor / major helpers are available:

```bash
npm run release:patch   # bump patch + publish
# or
npm run release:minor
npm run release:major
```

Alternatively run manually:

```bash
npm version patch   # or minor / major
npm publish
```

The prepublishOnly script automatically runs the bundle build.

---

## MCP Servers (optional)

AIgile can use local or remote MCP servers set up via `mcp/servers.json`. See the dedicated guide: `docs/mcp-servers.md`.

This repository includes examples for:
- Atlassian (Jira + Confluence): read-only defaults with tokens via prompts
- GitHub.com
- Playwright (browser automation and testing)
- Memory (long-lived notes)
- Sequential Thinking (multi-step orchestration)
- Context7 (external knowledge grounding)

Your IDE may translate these into tool lists automatically. Provide tokens/URLs when prompted.

---

## Where to get API keys and tokens

- Context7: Create or retrieve an API key from your Context7 account dashboard.
- Atlassian Cloud: Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens
- GitHub: Create a PAT at https://github.com/settings/tokens or fine-grained tokens at https://github.com/settings/personal-access-tokens
- SonarQube: Generate tokens in your profile on the SonarQube server.

---

## Core Configuration (core/core-config.yaml)

Important keys used by tasks:
- devStoryLocation: docs/stories
- qa.qaLocation: docs/qa
- prd: prdFile, prdSharded, prdShardedLocation
- architecture: architectureFile, architectureSharded, architectureShardedLocation

Tasks and scaffolding respect these paths for saving outputs and docs.

---

## Output Docs Conventions

- Epics → `docs/epics/epic-{key-or-slug}.md`
- Stories → `docs/stories/story-{key-or-slug}.md`
- Tasks → `docs/tasks/task-{key-or-slug}.md`

Each file includes cross-links:
- Stories link back to their epic and to related stories.
- Tasks link to their parent story and epic (when available).

---

## Task Catalog by Role

Below are representative task files you can run via an agent:

### Analyst
- `core/tasks/analyst/facilitate-brainstorming-session.md`
- `core/tasks/analyst/market-research-from-context7.md`
- `core/templates/project-brief-tmpl.yaml` (template)
- `core/templates/market-research-tmpl.yaml` (template)

### Architect
- `core/tasks/architect/code-arch-review-with-github.md`
- `core/tasks/architect/document-project.md`
- `core/tasks/architect/create-architecture-doc.md`

### Dev
- `core/tasks/dev/check-story-implemented.md`
- `core/tasks/dev/explain-story-from-jira.md`
- `core/tasks/dev/implement-freeform-work-item.md`
- `core/tasks/dev/implement-story-from-jira.md`
- `core/tasks/dev/implement-unit-tests.md`
- `core/tasks/dev/execute-checklist.md`
- `core/tasks/dev/validate-next-story.md`

### PM
- `core/tasks/pm/sync-jira-backlog.md`
- `core/tasks/pm/create-prd-doc.md`
- `core/tasks/pm/create-next-story.md`

### PO
- `core/tasks/po/create-jira-epic-from-confluence.md`
- `core/tasks/po/create-stories-from-epic.md`
- `core/tasks/po/create-tasks-for-story.md`
- `core/tasks/po/create-jira-story-from-confluence.md`
- `core/tasks/po/create-jira-story-from-text.md`
- `core/tasks/po/groom-jira-story.md`
- `core/tasks/po/create-prd-doc.md`

### QA
- `core/tasks/qa/gate.md`
- `core/tasks/qa/sonarqube-hotspot-review.md`
- `core/tasks/qa/test-design.md`
- `core/tasks/qa/verify-jira-story-e2e.md`
- `core/tasks/qa/review-story.md`

### SM
- `core/tasks/sm/standup-digest.md`

### UI / UX
- `core/tasks/ui/figma-audit-design-system.md`
- `core/tasks/ux/front-end-spec-from-design.md`

---

## Try it Now

```bash
# 1) Install into your repo
npx @mark-gozner/aigile-method install --with-mcp

# 2) Open a PO agent in your IDE and run a flow
# Example: create an Epic from Confluence, then generate stories and tasks
#   *create-epic
#   *create-stories
#   *create-tasks

# 3) Check generated docs
#   docs/epics/*.md
#   docs/stories/*.md
#   docs/tasks/*.md

# 4) Bundle for external use (optional)
npx @mark-gozner/aigile-method bundle
```

---

## Contributing, Security, and License

- Contributing: see `CONTRIBUTING.md`
- Code of Conduct: see `CODE_OF_CONDUCT.md`
- Security policy and private reporting: see `SECURITY.md`
- Roadmap and priorities: see `ROADMAP.md`
- Changelog: see `CHANGELOG.md`
- License: see `LICENSE.md`
