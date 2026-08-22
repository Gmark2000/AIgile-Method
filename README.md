# AIgile Development Method

A pragmatic, agent-driven agile method designed for IDE-native AI assistants. It ships with ready-to-run agents, executable tasks, MCP server wiring, and docs/templates to bootstrap product delivery.

Supported platforms: **GitHub Copilot**, **Google Antigravity**, and **Kiro** — one installer, the same agent team everywhere.

Roles covered: Analyst, Architect, Dev, React Engineer, DevOps, Security, QA, Automation Tester, PM, PO, SM, UX-Expert, UI-Expert, Code Tour, plus two orchestrators (automatic and human-in-the-loop).

---

## Installation

### Quick Start (npm)

Prereqs: Node.js 18+ (20+ recommended)

Install AIgile into your project:

```bash
npx @mark-gozner/aigile-method install
```

The installer detects which IDEs your project already uses (`.kiro/`, `.github/`, `.agent/`, or being run from a Kiro terminal) and pre-selects those targets. In a Kiro workspace you get the Kiro agent team, steering, and skills without passing any flags. Projects with none of those markers default to GitHub Copilot, as before.

The interactive installer asks which platforms to target: GitHub Copilot, Google Antigravity, Kiro (any combination). You can also skip the prompt with flags:

```bash
npx @mark-gozner/aigile-method install --for-copilot --yes       # GitHub Copilot only
npx @mark-gozner/aigile-method install --for-antigravity --yes   # Antigravity only
npx @mark-gozner/aigile-method install --for-kiro --yes          # Kiro only
npx @mark-gozner/aigile-method install --for-copilot --for-antigravity --for-kiro --yes
```

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
- `.agent/rules/`, `.agent/workflows/`, `GEMINI.md` – Google Antigravity (`--for-antigravity`)
- `.kiro/agents/`, `.kiro/steering/`, `.kiro/skills/` – Kiro custom agents, steering, and Agent Skills (`--for-kiro`)
- `.vscode/mcp.json` or `.kiro/settings/mcp.json` – only if you pass `--with-mcp`
- `.aigile-manifest.json` – manifest summary

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

Each generated agent keeps a collapsible appendix with the original agent source for transparency. If an agent stops behaving according to its role, re-run the installer to regenerate it.

---

### Agent Skills (Kiro)

`--for-kiro` also installs four AIgile skills into `.kiro/skills/`, following the open [Agent Skills](https://agentskills.io/) standard. They load on demand when a request matches their description, and each generated agent lists the skills relevant to its role.

| Skill | What it covers |
|-------|----------------|
| `aigile-orchestration` | Routing matrix for the whole team, delegation protocol, sequencing rules, when to escalate |
| `aigile-story-delivery` | Story readiness, task breakdown, implementation loop, definition of done, QA handoff |
| `aigile-quality-gate` | Evidence gathering, risk scoring, and PASS / CONCERNS / FAIL / WAIVED decisions |
| `aigile-spec-bridge` | Mapping Kiro spec phases (requirements, design, tasks) onto AIgile artifacts and roles |

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
| `npx @mark-gozner/aigile-method install --for-kiro --yes` | Install the agent team for Kiro |
| `npx @mark-gozner/aigile-method install --for-antigravity --yes` | Install the agent team for Antigravity |
| `npx @mark-gozner/aigile-method install --with-mcp --yes` | Include MCP config (`.vscode/mcp.json`, or `.kiro/settings/mcp.json` for Kiro) |
| `npx @mark-gozner/aigile-method bundle` | Build text bundles |
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
