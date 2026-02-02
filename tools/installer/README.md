# AIgile Installer (GitHub Copilot Only)

Usage:

- Interactive (via your existing CLI):
  - `npx aigile-method install`
  - `npm run install:aigile`
  - Add MCP templates: `npx aigile-method install --with-mcp`
  - Add mock VS Code MCP settings: `npx aigile-method install --with-mcp-settings`
  - Interactive prompts will ask about MCP options; use `--yes` to accept defaults quickly

What it does:
- Copies `core/` into `.aigile-core/` in your current project
- Generates GitHub Copilot chat modes from your agents into `.github/chatmodes/*.chatmode.md`
- Leaves your repo otherwise untouched
 - Prints a friendly ASCII banner during installation
 - Optional: generates `.vscode/mcp.json` with template servers and input prompts
 - Optional: updates `.vscode/settings.json` with mock MCP endpoints (for demos)
 - Shows a small “Created by GM” banner and a short summary on completion

Notes:
- This installer is intentionally scoped to GitHub Copilot compatibility.
- MCP/other IDEs can be added later as separate options.
 - After generating `.vscode/mcp.json`, open VS Code and fill in the prompted API keys.
