---
description: 'Validate and document the repository architecture and technology consistency.'
mode: 'agent'
---

Validate and document the repository architecture and technology consistency across the entire project.

Purpose
- Auto-detect technologies, manifests, and architectural patterns in the repository.
- Run deterministic checks for consistency, missing artifacts, and obvious risks.
- Produce both machine-readable findings (JSON) and a concise human-readable report (Markdown).

Constraints
- Only read repository files; do not perform network calls or modify files.
- If information is missing, mark it as unknown with low confidence and suggest exact local commands to run to resolve it.
- Be deterministic: same input repo must produce the same output.

Steps (agent must follow)
1. Walk the repository and collect files and metadata (path, size, file type, and first 20 lines where helpful).
2. Group files into components by folder/manifests.
3. For each component, infer language, package manager, build and test commands, runtime versions (if present), and whether CI is configured.
4. Run consistency checks (see below) and assign confidence scores (0.0-1.0) to inferred items.
5. Produce JSON findings and a Markdown summary as described in Output Format.

Checks to run per component (examples)
- Manifest presence: expected manifest exists (e.g., package.json for Node, pom.xml for Maven).
- Lockfile presence when expected (e.g., package-lock.json, yarn.lock, poetry.lock).
- Version coherence: runtime version declared in manifest matches other artifacts (e.g., Dockerfile FROM image tag).
- CI presence: workflow or pipeline config exists that builds/tests the component.
- Test presence: test folders or test dependencies are present.
- Mixed package managers in same component (flag as issue).
- Broken path references in docs/prompts (report path, line snippet).
- Potential secrets/secrets placeholders: detect obvious token patterns or files under mcp/ that reference tokens (do not show values).

Output Format (required)
1) JSON findings (single JSON object) with these top-level keys:
	- repo: { name, path }
	- summary: { components, languages, total_files, confidence }
	- components: [
			{ id, path, type, language, package_manager, manifests, inferred_runtime_versions, build_commands, test_commands, has_ci, checks, recommendations }
		]
	- global_checks: [ { id, description, pass, confidence, details } ]
	- recommendations: [ { id, description, priority, effort, affected_components } ]
	- metadata: { generated_at (ISO8601), tool, version }

Notes for JSON
- Use numeric confidence (0.0-1.0).
- Keep identifiers deterministic and stable (use normalized path strings).

2) Markdown summary (max ~1200 words):
- Title: "Architecture Validation — <repo name>"
- One-paragraph overview of inferred architecture and primary technologies.
- Bullet list of components: path, language, main status (OK / Issues).
- Top 5 prioritized recommendations (one line each).
- Checklist of failing high-severity checks.
- "How I inferred" short heuristics list.
- Minimal examples of how to fix the top 2 issues with PowerShell-compatible commands.
- Quality gates: Build, Lint/Typecheck, Tests (PASS/FAIL).

Quality gates
- Build: each code component must have at least one build command or CI pipeline (PASS/FAIL).
- Lint/Typecheck: evidence of lint or typecheck config for major languages (PASS/FAIL).
- Tests: presence of test folders or test manifests (PASS/FAIL).

Behavior
- Be concise. Use bullets and short sentences.
- Prioritize actionable remediation steps with estimated effort (Low/Medium/High).
- When recommending commands, use PowerShell-safe commands in fenced blocks.

Begin by listing detected top-level manifests and components (one-line each), then provide the full JSON findings object, followed by the Markdown summary and a final 3-step next-action plan.

