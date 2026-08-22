---
marp: true
theme: default
paginate: true
size: 16:9
header: 'AIgile Method · Requirements2Code'
footer: 'v1.3.0 · @one-ai/aigile-method'
---

<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

# AIgile Development Method
## Requirements2Code

**From a sentence of intent to working, traceable software.**

Created by **Mark Gozner**
`@one-ai/aigile-method`

<!--
Welcome everyone. In the next 15 minutes I'll show you how we go from a written requirement to working code — with the whole team in the loop, not just engineers.
-->

---

## The problem we all share

- Requirements get **lost in translation** between BAs, designers, devs, QA
- AI tools write code fast — but **skip the thinking** that makes it correct
- Every role uses **different tools** (Jira, Figma, GitHub, Confluence…) that don't talk
- "Done" means different things to a PM, a tester, and a developer
- Audits, traceability, and "who decided this?" become detective work

<!--
This isn't a developer problem. It's a company problem. Everyone in this room has lived at least three of these bullets this month.
-->

---

## What AIgile is — in one sentence

> **A structured way to turn requirements into code, using a team of AI specialists that follow our process, pause for human approval, and leave a paper trail.**

- Think of it as **a virtual delivery team** living inside your editor
- Each AI plays a **clear role** (BA, PM, Dev, QA, Designer…)
- The **human is always in charge** — the AI proposes, you decide
- Every step produces a **file in your repo** you can review later

<!--
If you remember one slide, remember this one. AIgile = structured AI teamwork with humans in the driver's seat.
-->

---

## Honest credit: built on BMAD

- Inspired by **BMAD-METHOD** (bmad-code-org, ~48k stars on GitHub)
- We preserved their **proven v4 model**: agents, tasks, templates, checklists
- BMAD focuses on **community breadth** — web bundles, expansion packs, many IDEs
- AIgile focuses on **enterprise depth** — control, traceability, tool integration
- **Same DNA. Different goal.** We stand on their shoulders and credit them openly.

<!--
We didn't invent this from scratch. BMAD is excellent. We took what worked and tightened it for how a real company actually delivers.
-->

---

## 17 AI specialists — grouped by what they DO

| **Discover & Define** | **Design & Build** | **Verify & Ship** |
|---|---|---|
| Analyst | Architect | QA |
| PM (Product Manager) | Dev | Automation Tester |
| PO (Product Owner) | UX Expert | Security |
| SM (Scrum Master) | UI Expert | DevOps |
|  | Expert React Engineer | Code Tour |

Plus **3 meta-agents** (orchestrators) — see next slide.

<!--
Look for your own role on this slide. There's an AI counterpart that speaks your language and produces the artifacts you expect.
-->

---

## The 3 orchestrators — our crown jewel

> An **orchestrator** = a "coach" agent that picks the right specialist for the job, so you don't have to.

- **`aigile-orchestrator`** — pure coordinator. Never writes code itself. Always delegates to a specialist. *(Clean separation of thinking and doing.)*
- **`aigile-manual-orchestrator`** *(new in v1.3.0)* — **hard-stop mode**. The AI literally cannot move to the next step without your explicit OK. *(Maximum human control.)*
- **`aigile-master`** — all-in-one expert. One agent that can do everything. *(Fastest mode, for power users.)*

**Three control modes: autopilot · human-approves-every-step · all-in-one expert.**

<!--
This is the most innovative piece. You pick how much control you want. Same method, three speeds.
-->

---

## Connects to the tools you already use

8 built-in integrations, no custom plumbing:

- **Jira** — read backlog, sync stories, update status
- **Confluence** — pull specs, publish decisions
- **Figma** — read designs straight from the source
- **GitHub** — PRs, issues, code review
- **Playwright** — generate and run end-to-end tests
- **SonarQube** — code quality gates
- Plus **Context7** (live docs), **Memory**, **Sequential Thinking**

> **MCP** *(Model Context Protocol)* = the standard plug that lets AI safely talk to these tools.

<!--
The AI doesn't live in a silo. It works inside your existing stack, with your existing permissions.
-->

---

## Install — one command

```bash
npx @one-ai/aigile-method install --with-mcp
```

Works in **VS Code (GitHub Copilot Custom Agents)** and **Google Antigravity**.

Creates in your repo:
- `.aigile-core/` — the method (agents, tasks, templates)
- `.github/agents/` — the AI specialists, ready to use
- `.vscode/mcp.json` — the tool connections
- `docs/{prd, architecture, stories, qa}/` — where artifacts live

<!--
One command. No infra. No accounts to create. You're ready in under a minute.
-->

---

## What's in the box

- **17 agents** — 14 specialists + 3 orchestrators
- **31 executable tasks** — concrete workflows like "create-prd", "review-story"
- **12 templates** — PRDs, architectures, stories, test plans
- **6 checklists** — definition-of-done, story quality, architecture review
- **6 workflows** — end-to-end recipes (greenfield, brownfield, bugfix…)
- **5 team bundles** — pick your team shape (minimal, fullstack, enterprise…)

<!--
This isn't a toy. It's a complete delivery kit, version-controlled in your repo.
-->

---

## A day in the life: Requirements → Code

1. **BA** opens chat → `@analyst` drafts a brief from a Jira ticket
2. **PM** runs `@pm create-prd` → PRD lands in `docs/prd/`
3. **Designer** points `@ux-expert` at the Figma file → flows documented
4. **Architect** produces the design → `docs/architecture/`
5. **PO** slices into stories → one click **handoff button** to Dev
6. **Dev** implements → **manual orchestrator** pauses for your OK at each step
7. **QA + Automation Tester** generate tests via Playwright → PR opened on GitHub

> Every step = a file in the repo. Fully auditable.

<!--
Notice no one was "left out". The BA, designer, dev, and tester all touched the same flow with the same tool.
-->

---

## Why AIgile is different

- **Pure-delegation orchestrator** — the coach never plays the game, so roles stay clean
- **Manual hard-stop mode** — the AI cannot move forward without your explicit OK
- **Handoff buttons** — one click to pass work to the next specialist
- **Executable checkpoints** — the method **pauses to ask you**, not generates blindly
- **Filesystem traceability** — every decision lands as a file in your repo, so it's auditable
- **Enterprise specialists BMAD doesn't have** — DevOps, Security, Automation Tester, UI Expert

<!--
These six bullets are the story. If a colleague asks "what's new about it?", read these out loud.
-->

---

## Who benefits, and how

- **BAs & PMs** — structured PRDs and stories, generated from your notes
- **Designers** — your Figma flows become living architecture docs
- **Developers** — context-aware code, with the spec right next to it
- **Testers** — auto-generated test plans + Playwright suites
- **Managers** — full traceability from requirement → commit → test → release
- **Everyone** — one shared method, one shared vocabulary

<!--
Pick the line that matches your role. If you don't see yourself here, come find me — I'll show you where you fit.
-->

---

## Call to action

1. **Install it today** on a real project — `npx @one-ai/aigile-method install --with-mcp`
2. **Pick your orchestrator** — start with manual mode if you're cautious
3. **Bring one requirement** to next week's demo session
4. **Share feedback** — this is *our* method, it evolves with us

> Internal package, free for all teams: **`@one-ai/aigile-method` v1.3.0**

<!--
The ask is small: one requirement, one project, one week. That's all it takes to feel the difference.
-->

---

<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

# Requirements2Code.
## Less translation. More delivery.

**AIgile Development Method · v1.3.0**
Created by **Mark Gozner** · `@one-ai/aigile-method`

*Questions?*

<!--
Thank you. The method is yours now — let's go build something with it.
-->
