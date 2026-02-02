# Contributing to AIgile Development Method

Thanks for helping improve the AIgile Development Method. This project is a lightweight, role-driven framework for agentic, MCP-enabled teamwork. Keep contributions stack-agnostic and focused on pragmatic workflows.

## Principles
- Role-first, tool-agnostic: guidance should work across stacks and IDEs.
- Secure by default: never include secrets, internal URLs, or proprietary content.
- MCP-friendly: reference capabilities (e.g., Jira/Confluence, GitHub) rather than vendor-specific lock-in.
- Small, testable changes: favor incremental improvements with clear acceptance criteria.

## Ways to contribute
- Propose or refine tasks for a role (Analyst, Architect, Dev, PM, PO, QA, SM, UX, UI).
- Improve templates, checklists, or workflows.
- Clarify docs, fix typos, enhance examples.
- Add optional MCP integrations or usage notes.

## Getting started
1. Open an issue describing the change and the role(s) it affects.
2. Create a branch from `main` using: `feat/<area>-<short>` or `fix/<area>-<short>`.
3. Make focused commits with descriptive messages.
4. Update or add:
   - docs in `docs/`
   - tasks in `core/tasks/<role>/`
   - agent guidance in `core/agents/`
   - CLI/bundler changes in `tools/`
5. Add an entry to `CHANGELOG.md` under "Unreleased".
6. Open a Pull Request with:
   - Problem statement and rationale
   - What changed and why
   - Security/privacy considerations
   - Screenshots or samples when relevant

## Content guidelines
- Use plain language; keep examples concise and role-appropriate.
- Avoid hard-coding technologies unless essential; prefer patterns and outcomes.
- If you include commands, ensure Windows PowerShell examples are correct; POSIX equivalents optional.
- Parameterize credentials and internal URLs; do not commit secrets.

## Review checklist (for maintainers)
- [ ] Scope is clear; aligns with principles
- [ ] No secrets or proprietary content
- [ ] Tone/format consistent with existing materials
- [ ] Docs/tasks organized by role; links updated
- [ ] Changelog updated; version bump coordinated when releasing

## Code of conduct
Participation is governed by our Code of Conduct; see `CODE_OF_CONDUCT.md`.

## Security
For vulnerabilities or sensitive concerns, do not open a public issue. See `SECURITY.md` for private reporting.
