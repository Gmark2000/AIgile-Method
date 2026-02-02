# MCP Servers Guide

This guide summarizes available MCP servers for AIgile, how to configure them, and where to get required API keys and tokens.

Note: Do not paste confidential tokens in source. Prefer VS Code Inputs in `.vscode/mcp.json` or environment variables.

---

## Available MCP Servers

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
