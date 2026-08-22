---
name: quality-gate
description: Run the AIgile quality gate on a story or change and issue a PASS, CONCERNS, FAIL, or WAIVED decision with evidence. Use when reviewing a story for release, assessing risk of a change, deciding if work meets quality standards, or asked for a quality gate or go/no-go.
license: SEE LICENSE IN LICENSE
metadata:
  author: Mark Gozner
  framework: AIgile Development Method
---


# AIgile Quality Gate

A gate is a documented, evidence-backed decision — not an opinion. Gather evidence first,
decide second, and always state what you could not verify.

## Evidence to gather

| Area | What to check |
|------|---------------|
| Requirements | Every acceptance criterion traced to a test or a verification note |
| Tests | Build passes; unit/integration/E2E run; new behavior covered; no skipped tests hiding failures |
| Risk | Blast radius of the change, reversibility, data migrations, auth/permission surface |
| Security | Input validation, secret handling, dependency changes, authorization paths |
| Non-functional | Performance-sensitive paths, accessibility, observability of new failure modes |
| Regression | Existing suites still green; adjacent features spot-checked |
| Debt | New shortcuts recorded, not hidden |

## Risk scoring

Score probability (low/medium/high) against impact (low/medium/high) for each finding. Anything
high impact plus medium-or-higher probability is a blocker regardless of test results.

## Decisions

- **PASS** — all criteria met, evidence present, no unresolved high or medium finding.
- **CONCERNS** — ships, but with named residual risk, an owner, and a follow-up item. Use when
  findings are real but neither high impact nor likely.
- **FAIL** — an acceptance criterion is unmet, the build or tests fail, or a high-impact finding
  is unresolved. State exactly what must change to reach PASS.
- **WAIVED** — a known failure is accepted by an explicit human decision. Record who waived it,
  why, the expiry or follow-up, and the compensating control. Never self-waive.

## Output format

```
Gate: <PASS|CONCERNS|FAIL|WAIVED>
Scope: <story/change id and what was reviewed>

Evidence
- <check> → <result>

Findings
- [<severity>] <finding> → <required action / owner>

Not verified
- <what you could not check and why>
```

## Rules

- Never issue PASS on unverified claims. If you did not run it, say so.
- Quote the failing output rather than paraphrasing it.
- Separate "must fix to ship" from "should improve later"; do not inflate style nits to blockers.
- The gate is advisory to a human decision maker on release; be direct about the recommendation.

## Resources

- Gate template: `${CLAUDE_PLUGIN_ROOT}/core/templates/qa-gate-tmpl.yaml`
- Test level guidance: `${CLAUDE_PLUGIN_ROOT}/core/data/test-levels-framework.md`
- Test priorities: `${CLAUDE_PLUGIN_ROOT}/core/data/test-priorities-matrix.md`

