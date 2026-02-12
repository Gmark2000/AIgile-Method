# AIgile Development Method

A pragmatic, agent-driven agile method designed for IDE-native AI assistants. It ships with ready-to-run agents, executable tasks, MCP server wiring, and docs/templates to bootstrap product delivery.

Roles covered: Analyst, Architect, Dev, PM, PO, QA, SM, UX-Expert, UI-Expert.

---

## Installation

### Quick Start (npm)

Prereqs: Node.js 20+

Install AIgile into your project:

```bash
npx @mark-gozner/aigile-method install
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
- `.github/agents/` – GitHub Copilot custom agents
- `.vscode/mcp.json` – only if you pass `--with-mcp`
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

The installer generates GitHub Copilot custom agents under `.github/agents/`. Each agent includes:

- Strong system directives for persona maintenance
- YAML frontmatter with tools, handoffs, and model configuration
- Subagent delegation support via `runSubagent`
- A lightweight appendix with the original agent source for transparency

If an agent stops behaving according to its role, simply re-run the installer to regenerate the agents.

After install, your project will have:
- `.aigile-core/`: agents, tasks, templates, checklists, data, workflows
- `.github/agents/`: generated custom agents for GitHub Copilot
- `.vscode/mcp.json`: optional MCP servers configuration (if using `--with-mcp`)

---

## Using AIgile in your IDE

1) Select an agent for a role (e.g., PO, PM, Architect) from `.github/agents/`
2) Ask for help with a specific command (e.g., "\*help" or "\*create-epic")
3) When you execute a task, the agent will load the exact file from `.aigile-core/tasks/...` and follow it step by step

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
| `npx @mark-gozner/aigile-method install --with-mcp --yes` | Include `.vscode/mcp.json` |
| `npx @mark-gozner/aigile-method bundle` | Build text bundles |
| `npx @mark-gozner/aigile-method status` | Show installed version, agents, agent count, MCP info |
| `npx @mark-gozner/aigile-method list:agents` | List installed agent IDs |

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
