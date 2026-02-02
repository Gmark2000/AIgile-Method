# validate-next-story

```yaml
id: validate-next-story
role: dev
whenToUse: Before picking up a new story; validate readiness and clarify unknowns.
elicit: true
outcome: Readiness decision + clarified scope + initial implementation outline
```

## Objective
Assess whether the next candidate story is sufficiently refined to begin implementation.

## Preconditions
- A story reference (ID, URL, or pasted content) is available.

## Steps
1. Request story identifier or full content if not provided.
2. Extract: Title, Business Goal, Acceptance Criteria, Constraints, Dependencies.
3. Evaluate acceptance criteria quality (testability, completeness, ambiguity).
4. Identify missing info (environments, data impacts, non-functionals, error paths).
5. Ask clarifying questions (batch them) — wait for answers.
6. Propose a thin-slice implementation strategy (ordered list of work slices).
7. Recommend: READY or NEEDS-REFINEMENT with rationale.

## Outputs
- Structured assessment:
  - Summary
  - AC Review (Good / Needs Clarification)
  - Open Questions
  - Proposed Slices
  - Recommendation

## Guidance
- Prefer crisp bullet lists over prose.
- If AC ambiguous, do NOT recommend READY.
- Keep proposed slices implementation-agnostic when possible.
