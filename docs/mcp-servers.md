# MCP Servers Guide

This guide summarizes available MCP servers for AIgile, how to configure them, and where to get required API keys and tokens.

Note: Do not paste confidential tokens in source. Prefer VS Code Inputs in `.vscode/mcp.json` or environment variables.

---

## Available MCP Servers

### Copilot MCP Hosts

These additions are unpublished source changes at version 1.5.0, not available in the current npm release. From a target project, use the checkout now:

```bash
node C:/Users/mark.gozner/GM/AI/public-req2code/tools/cli.js install --for-copilot --with-mcp --copilot-mcp-host=native
```

After release, the public form is `npx @mark-gozner/aigile-method install --for-copilot --with-mcp --copilot-mcp-host=native`. Omit the host flag, or choose `vscode`, for `.vscode/mcp.json` with `servers`. Choose `native` for `.mcp.json` with `mcpServers`. Both `--copilot-mcp-host=native` and `--copilot-mcp-host native` are accepted. Invalid values, other targets without Copilot, missing MCP opt-in, and host flags on uninstall fail before destination writes. A prior managed Copilot MCP opt-in also permits the flag on update.

The native renderer accepts documented equivalent stdio/HTTP/SSE fields, retaining explicitly supplied `tools` arrays exactly, including `[]` (no tools). An omitted catalog `tools` field becomes `tools: ["*"]`, preserving the VS Code host's default tool availability. This is NOT auto-approval: runtime tool invocations still require permissions under the user's existing policy. No skill `allowed-tools`, trust, sandbox, autopilot, or approval settings change.

The bundled JSON catalog installs three native entries: `playwright` (`npx @playwright/mcp@latest`), `memory` (`npx -y @modelcontextprotocol/server-memory`), and `sequentialthinking` (`npx -y @modelcontextprotocol/server-sequential-thinking`, with `SEQUENTIAL_THINKING_MAX_STEPS: "8"`). Atlassian, GitHub, and Context7 are skipped with three actionable diagnostics because they require interactive credentials; Context7's JSON entry passes an API-key argument, even though the YAML catalog differs. Configure reviewed native authentication manually. The installer never drops credentials, invents replacement environment variables, or starts a server. Unsupported fields also cause that server to be skipped. If nothing can be rendered, no empty native file is created, but an existing explicitly requested configuration is still validated before destination writes.

Native `env` and HTTP `headers` support `$VAR`, `${VAR}`, and `${VAR:-default}` references. VS Code `${env:VAR}` references in those fields are translated to `${VAR}` without reading the environment or embedding secrets. Variable expressions in command, arguments, URL, or cwd are conservatively skipped. VS Code configuration retains its interactive input definitions. Agent Host does not read `.vscode/mcp.json` directly: VS Code forwards configured servers except those requiring interactive input. Do not assume all VS Code MCP servers are unsupported or that credential prompts are forwarded.

`update --for-copilot` remembers the opt-in and host. Switch explicitly with `update --for-copilot --copilot-mcp-host=vscode` (or `native`); obsolete unchanged owned entries are removed only when no other target owns them. `uninstall --for-copilot` removes unchanged owned servers/inputs and retains user data. JSON is structurally merged and may be reformatted; comments/JSONC are not supported. Unowned matching entries are not acquired or deleted. Collisions and edited owned entries fail preflight on install/update, before any actual destination writes. Uninstall reports and retains edited entries. Older unchanged whole-file MCP ownership is converted to per-entry ownership during update; edited legacy files require manual resolution.

No HOME/global migration, secret resolution, trust changes, approval changes, or automatic server startup occurs. Required client binaries, server commands, credentials, and folder trust are the user's responsibility. Copilot CLI workspace MCP loading requires trust; do not opt into prompt-mode workspace MCP merely to validate installation. Before attempting discovery, check `copilot --version` and `copilot --help` with a temporary `COPILOT_HOME` and auto-update disabled. Only use `copilot plugins list --json` if that installed version's subcommand help advertises both the command and `--json`. Independent QA found that CLI 1.0.4 supports isolated version/help checks but rejects this discovery option as `UNKNOWNOPTION`, despite the latest documentation. Otherwise review generated files manually; live `/env` inspection is an optional user-run fallback in an already authorized session, not an installer validation step. No live authentication, agent, hook, or MCP runtime compatibility is claimed.

Surviving edited or unowned servers keep any referenced managed inputs during host changes and partial uninstall, including references in nested argument, environment, or header values. Retained input ownership hashes remain unchanged, so user edits are not adopted and inputs remain eligible for later removal when no surviving server needs them. User inputs and ownership shared with other targets are preserved.

Sources: [Agent Host forwarding](https://code.visualstudio.com/docs/agents/concepts/agent-host), [Copilot CLI native MCP schema, environment syntax, and discovery](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#mcp-server-configuration), [default tool selection](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers), [VS Code live tool discovery](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/common/mcpServer.ts). Checked September 9, 2026.

### OpenAI Codex Project Configuration

For the current unpublished source implementation (package version still 1.5.0), run `node C:/Users/mark.gozner/GM/AI/public-req2code/tools/cli.js install --for-codex --with-mcp` from your target project to opt in (adjust the checkout path). The equivalent public `npx @mark-gozner/aigile-method install --for-codex --with-mcp` applies when these changes are released, not to the current npm release. Without this flag, a new Codex install does not create or modify configuration. Once enabled, subsequent updates retain the managed MCP integration.

The installer parses existing `.codex/config.toml` and adds a hash-managed block containing namespaced `[mcp_servers."aigile-..."]` tables. Existing comments, user server definitions, credentials, model, sandbox, approvals and trust settings remain unchanged. Invalid TOML, duplicate/malformed markers, edited blocks and server-name collisions fail before generated outputs are installed. Remove the target with `uninstall --for-codex` to remove unchanged managed content while retaining user configuration.

Normal server tables and appendable dotted keys are supported. A top-level inline `mcp_servers = { ... }` table is sealed by TOML and cannot accept appended server tables. The installer rejects it with migration guidance and leaves all workspace bytes unchanged. Convert it manually to explicit `[mcp_servers."server-name"]` tables, preserving every setting, then retry; alternatively omit `--with-mcp` and configure MCP manually. The installer does not reserialize user configuration because that would lose comments and formatting.

Stdio entries retain command/argument arrays and forward secrets from environment variables using `env_vars`; HTTP entries support `url` and `bearer_token_env_var`. The installer does not interpolate secrets, emit VS Code `${input:...}` placeholders, or introduce shell wrappers. Set the required environment variables outside the repository before starting Codex.

The catalog's Context7 entry passes a credential in arguments and is deliberately skipped with a warning. Entries with unsupported headers or interpolation also require verified manual configuration. No MCP server is launched by installation or tests.

Codex may disable project configuration in untrusted workspaces. Review trust through Codex itself; AIgile never changes trust or global configuration. Compatibility baseline: Codex CLI 0.153.4; runtime access is environment-dependent.

Native `/goal` enablement is separate from MCP installation: see [Codex and Copilot workflows](../README.md#codex-and-copilot-workflows) for the verified CLI launch override and portable workflow fallback. The installer does not enable native goals or experimental features.

References: [Codex configuration](https://developers.openai.com/codex/config-reference/), [released CLI source](https://github.com/openai/codex/tree/rust-v0.153.4), [native goal dispatch](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/tui/src/chatwidget/slash_dispatch.rs).

Below are commonly used servers with typical setup patterns. Adjust to your environment and access.

### Atlassian (Jira + Confluence)
- Purpose: Query Jira issues, boards, sprints; Confluence pages, spaces (read access by default)
- Requires: Atlassian API token and your instance URL
- API Tokens: https://id.atlassian.com/manage-profile/security/api-tokens

### GitHub.com MCP
- Purpose: Read repos, issues, PRs, releases, users
- Requires: GitHub Personal Access Token (PAT)
- PAT Creation: https://github.com/settings/tokens

### SonarQube
- Purpose: Code quality and security hotspots
- Requires: Server URL and token with read permissions
- Token: Generate in your profile on the SonarQube server

### Playwright MCP
- Purpose: UI automation and browser testing
- No special tokens required; runs locally via npx

### Memory / Sequential Thinking
- Purpose: Long-lived notes, planning and multi-step orchestration
- Enable and configure per team preference

### Context7 (Documentation Retriever)
- Purpose: Retrieve up-to-date, version-specific docs with examples.
- Requires: CONTEXT7_API_KEY
- Env:
  - CONTEXT7_API_KEY: Your Context7 API key
  - CONTEXT7_DEFAULT_KB: default knowledge base (e.g., `general`)
- VS Code mcp.json:
```json
{
  "servers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp",
        "--api-key",
        "${input:context7_api_key}"
      ]
    }
  },
  "inputs": [
    { "id": "context7_api_key", "type": "promptString", "description": "Context7 API key" }
  ]
}
```
- Docker alternative:
```json
{
  "servers": {
    "context7": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "CONTEXT7_API_KEY",
        "-e", "CONTEXT7_DEFAULT_KB",
        "node:20-alpine",
        "npx", "-y", "@context7/mcp-server"
      ],
      "env": {
        "CONTEXT7_API_KEY": "${input:context7_api_key}",
        "CONTEXT7_DEFAULT_KB": "general"
      }
    }
  },
  "inputs": [
    { "id": "context7_api_key", "type": "promptString", "description": "Context7 API key" }
  ]
}
```

---

## Where to Get API Keys and Tokens

- **Context7**: Create or retrieve an API key from your Context7 account dashboard.
- **Atlassian Cloud**: Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens
- **GitHub**: Create a PAT at https://github.com/settings/tokens or fine-grained tokens at https://github.com/settings/personal-access-tokens
- **SonarQube**: Generate tokens in your profile on the SonarQube server.

---

## Tips
- Prefer VS Code `inputs` in `.vscode/mcp.json` to avoid hardcoding secrets.
- Use Docker `-e` to pass env securely from the host/VS Code prompt.
- Avoid positional arguments to MCP servers unless explicitly documented; use env vars instead.
- Corporate networks: if NODE_EXTRA_CA_CERTS is set, ensure it points to a valid PEM bundle to avoid TLS errors.
