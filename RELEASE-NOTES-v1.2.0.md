# AIgile Development Method - Version 1.2.0 Release Notes

**Release Date**: March 18, 2026  
**Version**: 1.2.0  
**Previous Version**: 1.1.0  
**Type**: Minor (Feature Expansion)

---

## Summary

Version 1.2.0 delivers a consolidated release that combines multi-platform installation support and expanded specialist agent coverage for secure delivery, infrastructure automation, and end-to-end quality validation.

---

## Consolidated Highlights

### 1) New Specialist Agents

Added three specialist agents with focused responsibilities and workflows:

- **Security Engineer** (`security`)
- **DevOps Engineer** (`devops`)
- **Automation Tester** (`automation-tester`)

These additions extend role coverage for security review, deployment/infrastructure operations, and automated testing.

### 2) GitHub Copilot + Google Antigravity Platform Support

The installer and generation flow now supports both target platforms:

- **GitHub Copilot** custom agents (`.github/agents/`)
- **Google Antigravity** rules/workflows (`.agent/rules/`, `.agent/workflows/`, `GEMINI.md`)

Installation flow includes interactive platform selection and platform-specific output generation.

### 3) Installer/CLI Consolidation

`tools/cli.js` logic has been consolidated to preserve:

- full tool coverage for generated agents,
- specialist delegation/handoff targets,
- and consistent generation behavior after branch integration.

---

## Merge and Release Notes

- Release branch strategy completed as requested:
  - merged `antigravity-feature` into `main` before release
- Package metadata bumped to `1.2.0`
- Changelog updated with consolidated highlights

---

## Upgrade

```bash
npm install @mark-gozner/aigile-method@1.2.0
npx @mark-gozner/aigile-method install --yes
```

---

## Files Updated in This Release

- `package.json` (version bump to `1.2.0`)
- `CHANGELOG.md` (new `1.2.0` entry)
- `RELEASE-NOTES-v1.2.0.md` (this document)

---

**Version**: 1.2.0  
**Status**: Stable / latest
