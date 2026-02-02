<!-- Inspired by BMAD™ Core style; adapted for AIgile Core Config -->

# Analyst Task: Facilitate Brainstorming Session

## Purpose

Lead an interactive ideation session to generate many options, synthesize themes, and select promising directions. Prioritize facilitation over idea provision—unlock the team's creativity and capture outcomes in a structured document for later decisions.

## Inputs

```yaml
optional:
  topic: "What are we brainstorming about?" # default: ask user
  constraints: ["time", "budget", "compliance"] # default: ask user
  output_document: true # if true, save to docs/brainstorming-session-results.md
```

## Prerequisites

- Confirm session timebox (e.g., 45–60 minutes)
- Confirm participants and roles (facilitator, note-taker if any)
- Load techniques list if available in project data (e.g., crazy 8s, SCAMPER, six thinking hats)

## Process (Sequential)

1. Session Setup (5 min)
	- Clarify topic and success criteria (what “good” looks like today)
	- Confirm constraints: scope, domain, compliance, tech boundaries
	- Choose a technique path: user-selected, facilitator-recommended, random, or progressive flow
2. Warm-up (3–5 min)
	- Light prompt to reduce blank-page effect (e.g., “List 5 wild ideas fast”)
3. Divergent Generation (15–25 min)
	- Run one technique at a time; timebox each round
	- Keep energy high; defer judgment; encourage quantity over quality
	- Prompt for variations, opposites, combinations
4. Convergent Synthesis (10–15 min)
	- Cluster ideas into themes; label groups
	- Identify patterns, constraints, and dependencies
5. Prioritization (5–10 min)
	- Pick 3–5 candidates for deeper exploration using a simple rubric (impact, feasibility, time)
6. Document Output (rolling)
	- If output_document is true, capture ideas by technique, themes, and top picks as you go

## Outputs

- Session summary with: topic, participants, techniques used, total ideas, key themes
- Prioritized shortlist (3–5) with rationale
- Open questions and follow-ups (owners, next steps)
- If configured: save to `docs/brainstorming-session-results.md` (path can be adjusted in repo conventions)

## Facilitation Principles

- You are a facilitator—draw ideas out with prompts; only contribute examples to unstick flow
- Use one technique at a time; switch only when energy dips or goals shift
- Keep it engaging and timeboxed; narrate transitions explicitly
- Capture in participants’ own words; avoid re-writing ideas in your voice

## Advanced Prompts (pick as needed)

- Constraint flip: “If we had to do this in 1 week/$1k/with no backend, how?”
- Perspective shift: “How would a first-time user approach this?”
- Extremes: “What’s a ‘moonshot’ vs. a 2-day quick win?”
- Combination: “Combine idea A + C—what emerges?”

## Done Criteria

- Techniques executed as planned (at least 1 divergent + 1 convergent)
- Shortlist with clear rationale and owners for next steps
- Document saved or posted back with clear sections (Summary, Techniques, Themes, Shortlist, Follow-ups)
