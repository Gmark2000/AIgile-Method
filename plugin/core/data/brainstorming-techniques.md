# Brainstorming Techniques (Company)

Clear, time-boxed facilitation patterns your Analyst, PM/PO, and Architect can run. Always capture raw ideas and synthesize outcomes into decisions, risks, and next steps.

## How to pick a technique
- Use Round-robin when you need equal participation with low facilitation overhead.
- Use Crazy 8s to diverge quickly on UI/flow concepts or solution shapes.
- Use SCAMPER to systematically transform an existing idea/process.
- Use Assumption Busting to de-risk bold initiatives or legacy rewrites.
- Use Worst Idea Wins to surface hidden risks and anti-patterns playfully.

## Techniques (numbered for quick reference)
1) Round-robin ideation
	 - Goal: Ensure every voice contributes at least one idea per round.
	 - Timebox: 10–20 minutes, 2–3 rounds.
	 - Steps:
		 1. State the prompt and constraints in one sentence.
		 2. Go around the group one by one; each person shares 1 idea (max 30s).
		 3. Write all ideas verbatim; no discussion or critique.
		 4. After rounds, cluster similar ideas and dot-vote top 3.
	 - Outputs: Ranked idea list, clusters/themes, top 3 for refinement.

2) Crazy 8s (adapted for product/UX and flows)
	 - Goal: Rapid divergence; 8 variations in 8 minutes per person.
	 - Timebox: 10–15 minutes ideation + 10 minutes share-out.
	 - Steps:
		 1. Provide the scenario (e.g., onboarding flow, dashboard layout).
		 2. Each participant sketches 8 variations (1 per minute). Bulleted text is fine if sketching isn’t feasible.
		 3. 60–90 seconds per person to present their strongest 1–2 variants.
		 4. Collect patterns and shortlist 2–3 concepts for prototype/spike.
	 - Outputs: Photo/scan of variations, shortlist of concepts, next prototype task.

3) SCAMPER prompts (adapted)
	 - Substitute, Combine, Adapt, Modify/Magnify/Minify, Put to other uses, Eliminate, Reverse/Rearrange.
	 - Timebox: 20–30 minutes.
	 - Steps:
		 1. Take a current solution or process.
		 2. Walk through each SCAMPER lens; generate at least 1 idea per lens.
		 3. Mark ideas that reduce complexity/cost or increase user value.
	 - Outputs: SCAMPER idea set with annotations on impact/effort.

4) Assumption busting
	 - Goal: Identify and test risky assumptions early.
	 - Timebox: 25–40 minutes.
	 - Steps:
		 1. List top 10 assumptions underpinning the idea or system.
		 2. Score each assumption by impact if wrong (High/Med/Low) and confidence (High/Med/Low).
		 3. Target High-impact, Low-confidence assumptions for spikes/experiments.
	 - Outputs: Assumption register with experiment/spike backlog.

5) Worst idea wins (to surface risks)
	 - Goal: Elicit failure modes and anti-patterns safely.
	 - Timebox: 15–25 minutes.
	 - Steps:
		 1. Prompt: “What’s the WORST way to solve this?” Encourage humor.
		 2. Extract implicit risks/anti-patterns from the worst ideas.
		 3. Convert to mitigations, guardrails, or acceptance criteria.
	 - Outputs: Risk list with mitigations and DoD/AC updates.

## Facilitator checklist
- Clarify the single prompt and constraints.
- Enforce timeboxes strictly; keep critique out during divergence.
- Capture everything in the raw; synthesize only after divergence.
- End with decisions, named owners, and next steps.

## Anti-patterns to avoid
- Open-ended sessions without a timebox or a clear prompt.
- Premature critique shutting down contributions.
- No synthesis or next steps.

## References in this repository
- Use with Analyst commands: brainstorm, create-project-brief, perform-market-research.
- See also: `core/data/elicitation-methods.md` for follow-up interviews/workshops.
