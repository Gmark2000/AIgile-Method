# create-next-story

```yaml
id: create-next-story
role: pm
whenToUse: Need to produce the next ready story from roadmap / epic context.
elicit: true
outcome: Draft story with acceptance criteria and initial sizing.
```

## Objective
Generate the next logical story derived from a roadmap item, epic, or product goal.

## Preconditions
- Provide epic reference, goal statement, or backlog context.

## Steps
1. Ask for: Epic/Goal, Target user persona, Desired outcome, Constraints.
2. Derive a succinct story statement: As a <user> I want <capability> so that <benefit>.
3. Draft initial Acceptance Criteria in Given/When/Then format (numbered).
4. Identify dependencies, assumptions, risks.
5. Propose thin-slice alternatives if scope too large.
6. Provide sizing guidance (e.g., S/M/L or T-shirt) and rationale.
7. Ask user to confirm or request refinement.

## Outputs
- Story draft:
  - Story statement
  - Acceptance Criteria (GWT)
  - Dependencies / Risks / Assumptions
  - Suggested Size

## Guidance
- Keep AC testable and outcome-focused, not implementation-focused.
- Offer at least one smaller alternative if story seems large.
