# AIgile Development Method - Version 0.2.0 Release Notes

**Release Date**: October 10, 2025  
**Version**: 0.2.0  
**Previous Version**: 0.1.1  
**Type**: Minor Version (Feature Release)

---

## 🎉 Major Release: Orchestrator Architecture

Version 0.2.0 introduces a **transformative orchestrator architecture** inspired by BMAD-METHOD best practices while maintaining AIgile's superior enterprise integrations and comprehensive task library.

---

## 🆕 What's New

### 1. Meta-Agent System

#### 🎭 AIgile Orchestrator
Your intelligent coordinator that helps you:
- **Choose the right agent** for any task
- **Coordinate workflows** across multiple agents
- **Transform** into specialist agents on demand
- **Learn** AIgile methodology with KB mode
- **Collaborate** with party mode (multi-agent discussions)

**Activate**: `@aigile-orchestrator`

#### 🧙 AIgile Master
Universal task executor that:
- **Runs any task** without persona switching
- **Access all 31 tasks** directly
- **Execute checklists** and create documents
- **YOLO mode** for rapid execution
- **Full enterprise tool access**

**Activate**: `@aigile-master`

### 2. Command System

All agents now support standardized `*` prefix commands:

**Core Commands**:
- `*help` - Show available commands
- `*agent [name]` - Transform to agent (orchestrator)
- `*task [name]` - Execute task
- `*checklist [name]` - Run checklist
- `*workflow [name]` - Start workflow

**Mode Toggles**:
- `*kb-mode` - Knowledge base Q&A
- `*yolo` - Skip confirmations (fast mode)
- `*party-mode` - Multi-agent discussion
- `*status` - Show current state
- `*exit` - Return/exit

### 3. Team Configurations (5 Total)

**New Team Bundles**:

1. **team-all.yaml** 👥
   - All 11 agents including orchestrator
   - Complete enterprise capability
   - Best for: Large projects, full workflows

2. **team-fullstack.yaml** 🚀
   - 6 agents: orchestrator, dev, qa, architect, ux, ui
   - Best for: Feature development cycles

3. **team-enterprise.yaml** 🏢
   - 6 agents: orchestrator, po, dev, qa, architect, pm
   - Best for: Corporate Jira/Confluence environments

4. **team-ide-minimal.yaml** 💡
   - 3 agents: master, dev, qa
   - Best for: Individual developers, small teams

5. **team-company.yaml** 🏢 (preserved)
   - Original configuration
   - Backward compatible

### 4. Enhanced Capabilities

**Workflow Coordination**:
- Multi-phase workflow orchestration
- Intelligent agent selection guidance
- Progress tracking with memory integration
- Workflow planning and status

**Mode Features**:
- **KB Mode**: Ask methodology questions, get best practice guidance
- **YOLO Mode**: Skip confirmations for experienced users
- **Party Mode**: Get input from all agents simultaneously

**Enterprise Integration**:
- All existing MCP tools maintained
- Coordinated access across agents
- Enhanced workflow support for:
  - Atlassian (Jira/Confluence)
  - GitHub/GitLab
  - SonarQube
  - Playwright
  - Figma
  - Context7

---

## 📊 Version Comparison

| Feature | v0.1.1 | v0.2.0 | Change |
|---------|--------|--------|--------|
| **Agents** | 9 | 11 | +2 meta-agents |
| **Team Configs** | 1 | 5 | +4 configurations |
| **Command System** | None | 12+ commands | ✨ New |
| **Workflow Coordination** | Manual | Automated | ✨ New |
| **Mode Toggles** | None | 3 modes | ✨ New |
| **Task Library** | 31 | 31 | ✅ Maintained |
| **MCP Integrations** | 7 | 7 | ✅ Maintained |
| **Templates** | 7 | 7 | ✅ Maintained |
| **Checklists** | 6 | 6 | ✅ Maintained |

---

## 🎯 Breaking Changes

**None** - This release is **fully backward compatible**.

All existing:
- Agents continue to work
- Tasks remain unchanged
- MCP integrations preserved
- Team configurations (team-company.yaml) maintained
- Templates and checklists unchanged

---

## 🚀 Upgrade Guide

### For New Users

Simply install as usual:
```powershell
npx @mark-gozner/aigile-method install
```

Then start with the orchestrator:
```
@aigile-orchestrator
*help
```

### For Existing Users

1. **Update package**:
   ```powershell
   npm install @mark-gozner/aigile-method@latest
   ```

2. **Reinstall** (regenerates chat modes with new agents):
   ```powershell
   npx @mark-gozner/aigile-method install
   ```

3. **Try new features**:
   - Use `@aigile-orchestrator` for guided experience
   - Use `@aigile-master` for rapid task execution
   - Your existing specialist agents still work as before

### Migration Path

No migration needed! New features are **additive and opt-in**:
- Continue using your existing agents
- Try orchestrator when you want workflow guidance
- Use master when you need quick task execution
- Switch to new team configurations when ready

---

## 📚 Documentation

### New Documentation Files

1. **OPTIMIZATION-PLAN.md**
   - Comprehensive roadmap comparing BMAD vs AIgile
   - Phase-by-phase implementation plan
   - Future enhancement roadmap

2. **ENHANCEMENT-SUMMARY.md**
   - Complete change log
   - Usage statistics
   - Before/after comparisons
   - Example workflows

3. **docs/orchestrator-guide.md**
   - Complete guide for meta-agents
   - Command reference
   - Usage examples
   - Troubleshooting

### Updated Documentation

- **CHANGELOG.md** - Detailed v0.2.0 changes
- **package.json** - Version updated to 0.2.0

---

## 🎓 Quick Start Examples

### Example 1: New User with Orchestrator
```
@aigile-orchestrator
*help
*kb-mode
"How do I create a Jira story?"
*agent po
```

### Example 2: Experienced User with Master
```
@aigile-master
*yolo
*task implement-story-from-jira PROJ-123
```

### Example 3: Multi-Agent Workflow
```
@aigile-orchestrator
*workflow-guidance
"I need to implement and test a feature"
*workflow enterprise-feature-delivery
```

### Example 4: Party Mode Discussion
```
@aigile-orchestrator
*party-mode
"Should we refactor this module now?"
[All agents provide perspectives]
```

---

## 🔧 Technical Details

### CLI Updates

**Modified**: `tools/cli.js`
- `agentIcon()` - Added orchestrator (🎭) and master (🧙) icons
- `listTasksForAgent()` - Added task mappings for meta-agents
- `relevantDependencies()` - Master has access to all resources
- `mcpToolsForAgent()` - Appropriate tool sets per agent

### New Agent Files

1. `core/agents/aigile-orchestrator.md` - 200+ lines
2. `core/agents/aigile-master.md` - 250+ lines

### New Team Files

1. `core/agent-teams/team-all.yaml`
2. `core/agent-teams/team-fullstack.yaml`
3. `core/agent-teams/team-enterprise.yaml`
4. `core/agent-teams/team-ide-minimal.yaml`

---

## 🐛 Known Issues

None at this time. If you encounter issues:
1. Re-run installer: `npx @mark-gozner/aigile-method install`
2. Clear chat mode cache in VS Code
3. Report issues to the maintainer

---

## 🔮 What's Next (v0.3.0)

Based on the optimization plan:

**Phase 2-3 (Short Term)**:
- [ ] Enhance existing agents with activation instructions
- [ ] Create workflow YAML files (5+ workflows)
- [ ] Implement WebBuilder system for bundling
- [ ] Add build commands to CLI

**Phase 4-6 (Medium Term)**:
- [ ] Comprehensive workflow library
- [ ] Advanced dependency resolution
- [ ] Configuration validation system
- [ ] Enhanced documentation

**Long Term**:
- [ ] Expansion pack system
- [ ] Version upgrade scripts
- [ ] Advanced team customization
- [ ] Interactive setup wizard

---

## 🙏 Acknowledgments

This release was inspired by **BMAD-METHOD** best practices while preserving AIgile's unique strengths:
- Superior enterprise MCP integrations
- Comprehensive task library
- Detailed technical frameworks
- Enterprise-focused workflows

Special thanks to the BMAD-METHOD team for pioneering the orchestrator architecture pattern.

---

## 📞 Support

For questions, issues, or feedback:
- Check `docs/orchestrator-guide.md` for usage guidance
- Review `ENHANCEMENT-SUMMARY.md` for examples
- Consult `OPTIMIZATION-PLAN.md` for roadmap

---

## 📝 Changelog Summary

**Added**:
- 2 meta-agents (orchestrator, master)
- 4 team configurations
- Command system with `*` prefix
- 3 mode toggles (KB, YOLO, Party)
- Workflow coordination
- 3 major documentation files

**Changed**:
- CLI updated for meta-agent support
- Agent roster: 9 → 11
- Team configs: 1 → 5

**Maintained**:
- All 31 tasks
- All 7 MCP integrations
- All templates and checklists
- Full backward compatibility

---

**Version**: 0.2.0  
**Release Date**: October 10, 2025  
**Status**: Stable  
**Recommended**: Yes

🎉 **Happy orchestrating!** 🎭🧙
