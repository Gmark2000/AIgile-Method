# AIgile Development Method - Version 1.0.1 Release Notes

**Release Date**: February 9, 2026  
**Version**: 1.0.1  
**Previous Version**: 1.0.0  
**Type**: Patch (Model Upgrade & Agent Configuration)

---

## Summary

Version 1.0.1 upgrades all custom agents to **Claude Opus 4.6** and modernizes agent frontmatter to use the latest VS Code custom agents specification, replacing deprecated properties.

---

## Changes

### Agent Model Upgrade

All `.agent.md` files now use **Claude Opus 4.6** (previously Claude Opus 4.5):

- `aigile-orchestrator.agent.md`
- `dev.agent.md`
- `code-tour.agent.md`
- `expert-react-frontend-engineer.agent.md`

### Agent Configuration Modernization

- **`user-invokable: true`** replaces the deprecated `infer: true` property
- **Orchestrator** now sets `disable-model-invocation: true` for deterministic routing
- Streamlined tool lists — removed deprecated `vscode/switchAgent` and `vscode/memory` references
- CLI `generateCustomAgent()` updated to emit the new frontmatter keys

---

## Breaking Changes

**None** — This is a backward-compatible patch release. Existing installations will work after update.

---

## Upgrade Guide

```bash
npm install @mark-gozner/aigile-method@1.0.1
npx @mark-gozner/aigile-method install --yes
```

This will regenerate your `.github/agents/` files with the updated model and configuration.

---

## Files Changed

| File | Change |
|------|--------|
| `core/agents/aigile-orchestrator.agent.md` | Model → Opus 4.6, new frontmatter keys, streamlined tools |
| `core/agents/dev.agent.md` | Model → Opus 4.6, `user-invokable: true` |
| `core/agents/code-tour.agent.md` | Model → Opus 4.6, removed deprecated tool refs |
| `core/agents/expert-react-frontend-engineer.agent.md` | Model → Opus 4.6, removed deprecated tool refs |
| `tools/cli.js` | Updated `generateCustomAgent()` output |
| `package.json` | Version bump 1.0.0 → 1.0.1 |
| `CHANGELOG.md` | Added v1.0.1 entry |

---

**Version**: 1.0.1  
**Status**: Stable  
