# AIgile Orchestrator & Master Agent Guide

## 🎭 Welcome to Enhanced AIgile

AIgile Development Method now includes **two powerful meta-agents** that make working with the framework easier and more efficient:

1. **AIgile Orchestrator** 🎭 - Your intelligent coordinator
2. **AIgile Master** 🧙 - Your universal task executor

---

## 🎭 AIgile Orchestrator

### What is it?

The **Orchestrator** is your intelligent coordinator that helps you:
- Choose the right specialist agent for your task
- Coordinate multi-agent workflows
- Track project progress and state
- Learn the AIgile methodology

Think of it as your **team lead** who knows every agent's strengths and helps orchestrate complex workflows.

### When to Use

✅ **Perfect for**:
- You're new to AIgile and want guidance
- Multi-phase workflows (design → implement → test)
- Complex projects requiring multiple agents
- Learning AIgile methodology
- Coordinating team activities

❌ **Not needed for**:
- Quick one-off tasks (use Master or specialist agent)
- Deep expertise in single domain (use specialist agent directly)

### How to Use

**1. Activate the Orchestrator**
```
@aigile-orchestrator
```

**2. Get Help**
```
*help
```
Shows all available commands, agents, and workflows.

**3. Transform to Specialist Agent**
```
*agent dev          # Become the Developer
*agent qa           # Become QA Engineer
*agent po           # Become Product Owner
```

**4. Get Workflow Guidance**
```
*workflow-guidance
```
Helps you select the right workflow for your goal.

**5. Enable Knowledge Base Mode**
```
*kb-mode
```
Ask questions about AIgile methodology:
- "How should I structure a user story?"
- "What's the difference between an epic and a story?"
- "Best practices for test automation?"

**6. Party Mode (Multi-Agent Discussion)**
```
*party-mode
```
Get input from ALL agents simultaneously:
```
User: Should we refactor this module?

🏗️ Architect: Refactor now - debt compounds
💻 Dev: Incremental improvement works
🧪 QA: Add tests first
📋 PM: Sprint 3 has capacity

Orchestrator: [Synthesizes consensus]
```

### Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `*help` | Show all commands | `*help` |
| `*agent [name]` | Transform to agent | `*agent dev` |
| `*workflow [name]` | Start workflow | `*workflow enterprise-feature-delivery` |
| `*workflow-guidance` | Get workflow help | `*workflow-guidance` |
| `*task [name]` | Run task (needs agent) | After transforming: `*task implement-story` |
| `*checklist [name]` | Execute checklist | `*checklist story-dod-checklist` |
| `*kb-mode` | Toggle knowledge base | `*kb-mode` |
| `*party-mode` | Multi-agent discussion | `*party-mode` |
| `*status` | Show current state | `*status` |
| `*plan` | Create workflow plan | `*plan` |
| `*plan-status` | Show plan progress | `*plan-status` |
| `*yolo` | Toggle fast mode | `*yolo` |
| `*exit` | Return/exit | `*exit` |

### Example Workflows

#### Scenario 1: New User Learning
```
@aigile-orchestrator

User: I'm new to AIgile. How do I get started?
Orchestrator: Welcome! Let me help...
              *kb-mode

User: What's the best way to create a Jira story?
Orchestrator: [Explains process, then suggests]
              I can transform into the Product Owner agent
              Type: *agent po
```

#### Scenario 2: Feature Development
```
@aigile-orchestrator

User: I need to implement a new login feature from Jira
Orchestrator: This is a development task. I recommend:
              *agent dev

[Transforms to Developer]

Dev: Ready to implement! What's the Jira story ID?
User: PROJ-123

Dev: *task implement-story-from-jira PROJ-123
```

#### Scenario 3: Architecture Decision
```
@aigile-orchestrator

User: Should we use microservices or monolith?
Orchestrator: This requires architecture expertise.
              *party-mode

🏗️ Architect: Consider team size and deployment needs
💻 Dev: Microservices add complexity but scale better
📋 PM: Timeline matters - monolith is faster initially
🧪 QA: Testing strategy differs significantly

Orchestrator: Let me transform to Architect for deep dive
              *agent architect
```

---

## 🧙 AIgile Master

### What is it?

The **Master** is a universal task executor that can run ANY AIgile task without switching personas. It's like having an expert generalist who knows how to do everything.

### When to Use

✅ **Perfect for**:
- Quick one-off tasks
- Multi-domain work (spanning several areas)
- Experienced users who know what they want
- Rapid execution with YOLO mode
- Tasks that don't fit a single specialist

❌ **Not needed for**:
- Deep coding sessions (use `dev` agent)
- Extensive QA campaigns (use `qa` agent)
- Complex persona-driven workflows

### How to Use

**1. Activate the Master**
```
@aigile-master
```

**2. Get Help**
```
*help
```

**3. Execute Any Task**
```
*task                              # List all tasks
*task implement-story-from-jira    # Execute specific task
*task 15                           # Execute by number
```

**4. Execute Checklist**
```
*execute-checklist                 # List all checklists
*execute-checklist story-dod-checklist
```

**5. Create Document**
```
*create-doc                        # List all templates
*create-doc prd-tmpl               # Create PRD
*create-doc architecture-tmpl      # Create architecture doc
```

**6. Enable YOLO Mode (Fast)**
```
*yolo                              # Toggle fast mode
*task sync-jira-backlog            # Executes without confirmations
```

### Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `*help` | Show commands | `*help` |
| `*task [name]` | Execute task | `*task document-project` |
| `*execute-checklist [name]` | Run checklist | `*execute-checklist architect-checklist` |
| `*create-doc [template]` | Create document | `*create-doc prd-tmpl` |
| `*doc-out` | Save document | `*doc-out` |
| `*document-project` | Full project docs | `*document-project` |
| `*kb` | Toggle KB mode | `*kb` |
| `*yolo` | Toggle fast mode | `*yolo` |
| `*exit` | Exit | `*exit` |

### Available Tasks (31 Total)

**Implementation**:
- implement-story-from-jira
- implement-freeform-work-item
- implement-unit-tests
- check-story-implemented

**Jira Management**:
- create-jira-epic-from-confluence
- create-jira-story-from-confluence
- create-stories-from-epic
- groom-jira-story
- sync-jira-backlog
- create-next-story
- create-tasks-for-story
- explain-story-from-jira
- validate-next-story

**Documentation**:
- document-project
- create-architecture-doc
- create-prd-doc

**Testing**:
- test-design
- verify-jira-story-e2e
- gate
- review-story

**Analysis**:
- code-arch-review-with-github
- sonarqube-hotspot-review
- market-research-from-context7
- advanced-elicitation

**Design**:
- front-end-spec-from-design
- figma-audit-design-system

**Collaboration**:
- facilitate-brainstorming-session
- standup-digest

**Utilities**:
- execute-checklist
- help

### Example Workflows

#### Scenario 1: Quick Documentation
```
@aigile-master

*create-doc architecture-tmpl
[Follow prompts to create doc]
*doc-out
```

#### Scenario 2: Experienced User - Fast Path
```
@aigile-master

*yolo                             # Enable fast mode
*task sync-jira-backlog           # No confirmations
*task create-next-story           # Auto-proceeds
*execute-checklist story-draft-checklist
```

#### Scenario 3: Multi-Domain Task
```
@aigile-master

User: I need to review SonarQube hotspots and create a plan
Master: *task sonarqube-hotspot-review
        [Analyzes hotspots]
        Creating remediation document...
        *create-doc architecture-tmpl
        [Documents fixes]
        *doc-out
```

#### Scenario 4: Knowledge Base Q&A
```
@aigile-master

*kb                               # Enable KB mode

User: What are the AIgile test levels?
Master: [Loads aigile-kb.md]
        AIgile defines 4 test levels:
        1. Unit Tests
        2. Integration Tests
        3. E2E Tests
        4. Acceptance Tests
        [Provides detailed explanation]
```

---

## 🤔 Which One Should I Use?

### Use **Orchestrator** when:
- 🆕 You're new to AIgile
- 🔄 You need workflow coordination
- 🤝 Task requires multiple agents
- 📚 You want to learn methodology
- 🎯 You're not sure which agent to use
- 🎭 You want multi-agent discussions

### Use **Master** when:
- ⚡ You know exactly what you want
- 🎯 Quick one-off task
- 🔧 Multi-domain work
- 💨 You want rapid execution
- 🧠 You're an experienced user
- 🔄 Task doesn't fit a single agent

### Use **Specialist Agent** when:
- 💻 Deep coding session → `@dev`
- 🧪 Extensive testing → `@qa`
- 🧭 Story grooming session → `@po`
- 🏗️ Architecture design → `@architect`

---

## 🎮 Command System

All meta-agents and specialists now support the `*` command prefix:

### Universal Commands
- `*help` - Show available commands
- `*exit` - Exit or return to orchestrator

### Mode Toggles
- `*kb` / `*kb-mode` - Toggle knowledge base mode
- `*yolo` - Toggle fast mode (skip confirmations)
- `*party-mode` - Enable multi-agent discussion (orchestrator only)

### Execution Commands
- `*task [name]` - Execute task
- `*agent [name]` - Transform to agent (orchestrator only)
- `*workflow [name]` - Start workflow (orchestrator only)
- `*checklist [name]` - Execute checklist
- `*create-doc [template]` - Create document (master)

### Planning Commands (Orchestrator)
- `*workflow-guidance` - Get workflow help
- `*plan` - Create workflow plan
- `*plan-status` - Show plan progress
- `*status` - Show current state

---

## 🏢 Enterprise Integration

Both meta-agents support full enterprise MCP integrations:

### Atlassian (Jira/Confluence)
```
*task create-jira-epic-from-confluence
*task sync-jira-backlog
*task groom-jira-story
```

### GitHub/GitLab
```
*task code-arch-review-with-github
```

### SonarQube
```
*task sonarqube-hotspot-review
```

### Playwright (E2E Testing)
```
*task verify-jira-story-e2e
```

### Figma
```
*task figma-audit-design-system
*task front-end-spec-from-design
```

### Context7 (Research)
```
*task market-research-from-context7
```

---

## 📚 Learning Path

### Week 1: Getting Started
1. Start with `@aigile-orchestrator`
2. Use `*help` to explore
3. Enable `*kb-mode` and ask questions
4. Try transforming: `*agent dev`

### Week 2: Task Execution
1. Try `@aigile-master`
2. Execute tasks: `*task document-project`
3. Create docs: `*create-doc prd-tmpl`
4. Run checklists: `*execute-checklist story-dod-checklist`

### Week 3: Workflows
1. Use orchestrator for workflows
2. Try `*workflow-guidance`
3. Coordinate multi-agent tasks
4. Experiment with `*party-mode`

### Week 4: Mastery
1. Enable `*yolo` mode for speed
2. Direct specialist agent access: `@dev`, `@qa`
3. Custom workflows
4. Advanced enterprise integration

---

## 🎯 Quick Reference Card

### Getting Started
```
@aigile-orchestrator     # Start with orchestrator
*help                    # See all options
*kb-mode                 # Learn methodology
```

### Quick Task
```
@aigile-master           # Universal executor
*task [name]             # Execute task
*yolo                    # Fast mode
```

### Specialist Work
```
@dev                     # Deep coding
@qa                      # Extensive testing
@po                      # Story management
```

### Workflows
```
@aigile-orchestrator     # Coordinator
*workflow-guidance       # Get help
*agent dev               # Transform
```

---

## 🆘 Troubleshooting

**Q: Agent not responding correctly?**
A: Use `*help` to reset and see available commands

**Q: Not sure which agent to use?**
A: Start with `@aigile-orchestrator` and use `*workflow-guidance`

**Q: Want faster execution?**
A: Use `@aigile-master` with `*yolo` mode

**Q: Need multi-agent input?**
A: Use `@aigile-orchestrator` and enable `*party-mode`

**Q: Want to learn methodology?**
A: Use any meta-agent and enable `*kb-mode`

---

## 🎉 Summary

**AIgile Orchestrator** 🎭
- Your intelligent coordinator
- Helps choose right agent
- Coordinates workflows
- Perfect for beginners

**AIgile Master** 🧙
- Universal task executor
- Runs any task quickly
- No persona switching
- Perfect for experienced users

**Commands start with** `*`
- Consistent interface
- Easy to discover
- Works everywhere

**Get Started Now!**
```
@aigile-orchestrator
*help
```

Happy coding! 🚀
