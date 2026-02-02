# AIgile Development Method - Optimization Plan

## Executive Summary

This document outlines a comprehensive plan to optimize AIgile-Development-Method by incorporating best practices from BMAD-METHOD while preserving AIgile's superior enterprise integrations and task library.

## Current State Analysis

### BMAD-METHOD Strengths
1. ✅ **Orchestrator Architecture** - bmad-orchestrator.md and bmad-master.md for agent coordination
2. ✅ **Command System** - `*` prefix for all commands (*help, *agent, *task, *kb, *yolo)
3. ✅ **Activation Instructions** - Detailed startup sequences in agent definitions
4. ✅ **Multiple Team Configs** - 4 team variations (all, fullstack, ide-minimal, no-ui)
5. ✅ **Web Bundle Builder** - Sophisticated DependencyResolver and WebBuilder classes
6. ✅ **Workflow Support** - Brownfield/Greenfield workflows
7. ✅ **Mode Toggles** - YOLO mode, KB mode, Party mode

### AIgile-Development-Method Strengths
1. ✅ **Enterprise MCP Integrations** - Atlassian, GitHub, SonarQube, Playwright, Figma
2. ✅ **Comprehensive Task Library** - 31 tasks vs BMAD's 21
3. ✅ **MCP Usage Documentation** - Detailed mcp-usage patterns per agent
4. ✅ **Technical Frameworks** - test-levels-framework.md, test-priorities-matrix.md
5. ✅ **Enterprise Workflows** - Jira/Confluence/SonarQube integration tasks

### Key Gaps in AIgile
1. ❌ No orchestrator or master agents
2. ❌ No command prefix system
3. ❌ Simple bundling vs sophisticated dependency resolution
4. ❌ Only 1 team configuration
5. ❌ No workflow files
6. ❌ No mode toggles (YOLO, KB, Party)
7. ❌ Less structured activation instructions

## Optimization Roadmap

### Phase 1: Agent Architecture Enhancement (Priority: Critical)

#### 1.1 Create Orchestrator Agent
**File**: `core/agents/aigile-orchestrator.md`

**Features**:
- Command system with `*` prefix
- Agent transformation capability (*agent <name>)
- Workflow guidance (*workflow, *workflow-guidance)
- Status tracking (*status, *plan, *plan-status)
- Mode toggles (*yolo, *kb-mode, *party-mode)
- Help system (*help)

**Commands to Implement**:
```yaml
commands:
  help: Show available commands, agents, and workflows
  agent: Transform into specialized agent (list if no name)
  chat-mode: Start conversational mode
  checklist: Execute checklist (list if no name)
  doc-out: Output full document
  kb-mode: Toggle knowledge base mode
  party-mode: Group chat with all agents
  status: Show current context and progress
  task: Run specific task (list if no name)
  workflow: Start workflow (list if no name)
  workflow-guidance: Get personalized workflow help
  plan: Create detailed workflow plan
  plan-status: Show workflow plan progress
  plan-update: Update workflow plan status
  yolo: Toggle skip confirmations mode
  exit: Exit or return to orchestrator
```

#### 1.2 Create Master Agent
**File**: `core/agents/aigile-master.md`

**Features**:
- Universal task executor without persona transformation
- Direct access to all resources
- Knowledge base toggle
- Document creation and sharding
- Checklist execution

**Commands to Implement**:
```yaml
commands:
  help: Show command list
  create-doc: Execute create-doc task with template
  doc-out: Output full document
  document-project: Execute document-project task
  execute-checklist: Run checklist
  kb: Toggle KB mode
  shard-doc: Run shard-doc task
  task: Execute any task
  yolo: Toggle YOLO mode
  exit: Exit session
```

#### 1.3 Update Existing Agents
**Files**: All agents in `core/agents/*.md`

**Enhancements**:
- Add activation-instructions section
- Add IDE-FILE-RESOLUTION instructions
- Add REQUEST-RESOLUTION guidance
- Implement command prefix system (*)
- Add customization field support
- Enhance persona definitions with core_principles

### Phase 2: Team Configuration Expansion (Priority: High)

#### 2.1 Create Multiple Team Configurations
**Files**: `core/agent-teams/*.yaml`

**New Team Files**:
1. `team-all.yaml` - All agents including orchestrator
2. `team-fullstack.yaml` - Full stack development team
3. `team-ide-minimal.yaml` - Minimal IDE setup
4. `team-enterprise.yaml` - Enterprise integration focused (Jira, Confluence, SonarQube)
5. `team-company.yaml` - Keep existing as company-specific

**Team Structure**:
```yaml
bundle:
  name: Team Name
  icon: 👥
  description: Team description
agents:
  - aigile-orchestrator  # Include in team-all
  - agent-id-1
  - agent-id-2
workflows:  # If applicable
  - workflow-name.yaml
```

### Phase 3: Build System Enhancement (Priority: High)

#### 3.1 Create WebBuilder System
**New Files**:
- `tools/builders/web-builder.js` - Main builder class
- `tools/lib/dependency-resolver.js` - Dependency resolution
- `tools/lib/yaml-utils.js` - YAML parsing utilities

**Features**:
- Automatic dependency resolution
- Web bundle generation with START/END markers
- Expansion pack support
- Multi-output directory support
- Validation system

#### 3.2 Update CLI
**File**: `tools/cli.js`

**New Commands**:
```javascript
// Add to CLI
program
  .command('build')
  .description('Build web bundles for agents and teams')
  .option('-a, --agents-only', 'Build only agent bundles')
  .option('-t, --teams-only', 'Build only team bundles')
  .option('--no-clean', 'Skip cleaning output directories')

program
  .command('list:agents')
  .description('List all available agents')

program
  .command('list:teams')
  .description('List all available teams')

program
  .command('validate')
  .description('Validate agent and team configurations')
```

### Phase 4: Workflow System (Priority: Medium)

#### 4.1 Create Workflow Files
**Files**: `core/workflows/*.yaml`

**Workflows to Create**:
1. `enterprise-feature-delivery.yaml` - Jira → Implementation → QA
2. `architecture-review.yaml` - Architecture documentation and review
3. `hotspot-remediation.yaml` - SonarQube hotspot fixing
4. `test-automation.yaml` - Test design and implementation
5. `documentation.yaml` - Project documentation workflow

**Workflow Structure**:
```yaml
workflow:
  name: Workflow Name
  description: Workflow description
  icon: 🔄
  phases:
    - phase: Phase Name
      agents: [agent-id-1, agent-id-2]
      tasks:
        - task-name.md
      deliverables:
        - Deliverable description
```

### Phase 5: CLI and Installation Enhancement (Priority: Medium)

#### 5.1 Update CLI Agent Registration
**File**: `tools/cli.js`

**Add Orchestrator and Master to Agent List**:
```javascript
function agentIcon(agentId) {
  const map = {
    'aigile-orchestrator': '🎭',
    'aigile-master': '🧙',
    dev: '💻',
    qa: '🧪',
    pm: '📋',
    po: '🧭',
    sm: '⏱️',
    analyst: '🧠',
    architect: '🏗️',
    'ux-expert': '🎨',
    'ui-expert': '🖌️'
  };
  return map[agentId] || '🤖';
}
```

#### 5.2 Update Task Mappings
Add orchestrator and master task mappings:
```javascript
function listTasksForAgent(agentId) {
  const agentTaskMappings = {
    'aigile-orchestrator': [
      'help.md',
      // Orchestrator doesn't execute tasks directly
    ],
    'aigile-master': [
      'document-project.md',
      'create-architecture-doc.md',
      'execute-checklist.md',
      'advanced-elicitation.md',
      'facilitate-brainstorming-session.md'
    ],
    // ... existing mappings
  };
  // ...
}
```

#### 5.3 Update MCP Tools
Add orchestrator-specific tool configurations:
```javascript
function mcpToolsForAgent(agentId) {
  const serverMappings = {
    'aigile-orchestrator': ['memory', 'sequentialthinking'],
    'aigile-master': ['context7', 'memory', 'sequentialthinking'],
    // ... existing mappings
  };
  // ...
}
```

### Phase 6: Documentation and Knowledge Base (Priority: Low)

#### 6.1 Update Documentation
**Files to Update**:
- `README.md` - Add orchestrator and master agent documentation
- `docs/mcp-servers.md` - Document MCP usage patterns
- Create `docs/agent-guide.md` - Detailed agent usage guide
- Create `docs/workflow-guide.md` - Workflow usage documentation

#### 6.2 Enhance Knowledge Base
**File**: `core/data/aigile-kb.md`

**Add Sections**:
- Orchestrator usage patterns
- Workflow selection guidance
- Team configuration guidelines
- Command reference guide

## Implementation Priority

### Immediate (Week 1)
1. ✅ Create `aigile-orchestrator.md`
2. ✅ Create `aigile-master.md`
3. ✅ Update `cli.js` with orchestrator/master support
4. ✅ Create additional team configurations

### Short Term (Week 2-3)
1. ⏳ Enhance existing agents with activation instructions
2. ⏳ Create workflow files
3. ⏳ Implement WebBuilder system
4. ⏳ Update CLI with build commands

### Medium Term (Week 4-6)
1. ⏳ Create comprehensive workflow library
2. ⏳ Enhance dependency resolution
3. ⏳ Add validation system
4. ⏳ Update documentation

### Long Term (Future)
1. ⏳ Expansion pack system (like BMAD)
2. ⏳ Upgrade scripts for future versions
3. ⏳ Advanced team customization
4. ⏳ Interactive setup wizard

## Success Metrics

1. **Agent Coverage**: 11+ agents (9 existing + orchestrator + master)
2. **Team Configurations**: 5+ team variations
3. **Workflow Support**: 5+ workflows
4. **Task Library**: Maintain 31+ tasks
5. **MCP Integration**: Maintain all existing integrations
6. **Build System**: Automated bundle generation
7. **Validation**: 100% config validation pass rate

## Backward Compatibility

All changes will be backward compatible:
- Existing agents will continue to work
- New command system is additive (agents support both old and new style)
- Existing team-company.yaml remains unchanged
- Current installation process preserved

## Migration Path

For existing users:
1. Run `npx @mark-gozner/aigile-method install` to get new agents
2. Optionally switch to orchestrator mode with `@aigile-orchestrator`
3. Existing workflows remain unchanged
4. New features are opt-in

## Next Steps

1. **Review and approve this plan**
2. **Begin Phase 1: Create orchestrator and master agents**
3. **Update cli.js with new agent mappings**
4. **Test orchestrator with existing agents**
5. **Create additional team configurations**
6. **Document new features**

---

**Status**: Draft for Review
**Last Updated**: 2025-10-10
**Owner**: AIgile Development Team
