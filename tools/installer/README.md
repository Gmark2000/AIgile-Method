# Legacy installer modules (unused)

> **Status: superseded.** `tools/cli.js` is the only installer that runs. Nothing in the
> repository imports `installer.js` or `ide-setup.js`, and they are excluded from the published
> npm package. They are kept here for reference only — do not extend them.

The live installer supports three platforms:

| Platform | Output |
|----------|--------|
| GitHub Copilot | `.github/agents/*.agent.md`, `.github/prompts/` |
| Google Antigravity | `.agent/rules/`, `.agent/workflows/`, `GEMINI.md` |
| Kiro | `.kiro/agents/`, `.kiro/steering/`, `.kiro/skills/`, optional `.kiro/settings/mcp.json` |

All platforms share `.aigile-core/` (a copy of `core/`) for tasks, templates, checklists, and data.

Use the CLI directly:

```bash
node tools/cli.js install                    # interactive, auto-detects the target IDEs
node tools/cli.js install --for-kiro --yes   # single platform
node tools/cli.js skills:list                # Agent Skills registry
node tools/cli.js --help                     # all commands and flags
```

See the [root README](../../README.md) for the full documentation.
