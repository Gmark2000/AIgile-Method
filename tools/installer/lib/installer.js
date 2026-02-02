import path from 'node:path';
import fs from 'fs-extra';
import { fileURLToPath } from 'node:url';
import { setupGithubCopilot, setupLegacyChatmodes } from './ide-setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function copyDir(src, dest){
  if(!fs.existsSync(src)) return;
  fs.mkdirpSync(dest);
  for(const entry of fs.readdirSync(src, {withFileTypes:true})){
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if(entry.isDirectory()) copyDir(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

// legacy helper kept for compatibility; now defers to setupGithubCopilot
function makeChatModesFromAgents(srcAgentsDir, destChatmodesDir){
  setupGithubCopilot({ srcAgentsDir, destChatmodesDir });
}

export async function runInstall({ withMcp=false, includeJavaInstructions=false, useLegacyChatmodes=false } = {}){
  const cwd = process.cwd();

  // 1) Copy core -> .aigile-core
  const coreSrc = path.join(projectRoot, 'core');
  const coreDest = path.join(cwd, '.aigile-core');
  copyDir(coreSrc, coreDest);

  // 2) Generate GitHub Copilot custom agents (new format: .github/agents/*.agent.md)
  //    Or legacy chatmodes if explicitly requested
  const srcAgentsDir = path.join(coreSrc, 'agents');
  let outputDir;
  
  if (useLegacyChatmodes) {
    // Deprecated: Use legacy chatmodes format
    outputDir = path.join(cwd, '.github', 'chatmodes');
    setupLegacyChatmodes({ srcAgentsDir, destChatmodesDir: outputDir });
    console.log('⚠️  Warning: Using legacy chatmodes format. Consider upgrading to custom agents.');
  } else {
    // New format: Custom agents with handoffs and runSubagent support
    outputDir = path.join(cwd, '.github', 'agents');
    const agents = setupGithubCopilot({ srcAgentsDir, destAgentsDir: outputDir });
    console.log(`✅ Created ${agents?.length || 0} custom agents in .github/agents/`);
  }

  // 3) Create copilot-instructions.md for workspace-wide settings
  const instructionsDir = path.join(cwd, '.github');
  fs.mkdirpSync(instructionsDir);
  const copilotInstructionsPath = path.join(instructionsDir, 'copilot-instructions.md');
  if (!fs.existsSync(copilotInstructionsPath)) {
    const copilotInstructions = `# AIgile Copilot Instructions

This project uses the AIgile framework for AI-assisted development.

## Custom Agents

Custom agents are available in \`.github/agents/\`. Use them by selecting from the agent dropdown in Copilot Chat.

### Available Agents
- **aigile-orchestrator**: Master orchestrator - coordinates workflows and delegates to specialists
- **dev**: Full Stack Developer - implementation, debugging, TDD
- **architect**: Software Architect - architecture review, documentation
- **po**: Product Owner - story creation, backlog management
- **qa**: QA Engineer - testing, quality gates
- **analyst**: Business Analyst - requirements analysis
- **pm**: Project Manager - project planning
- **sm**: Scrum Master - ceremonies, team coordination
- **ui-expert**: UI Expert - design systems, Figma
- **ux-expert**: UX Expert - user experience design

## Subagent Delegation

The orchestrator and specialist agents can delegate tasks using \`#tool:runSubagent\`.
This enables autonomous multi-step workflows where complex tasks are broken down
and routed to the appropriate specialist.

## Handoffs

Agents support handoffs - use the handoff buttons after a response to transition
to another specialist with context preserved.

## Project Configuration

See \`.aigile-core/core-config.yaml\` for project-specific settings.
`;
    fs.writeFileSync(copilotInstructionsPath, copilotInstructions, 'utf8');
  }

  // 4) Optional MCP scaffolding into .vscode (disabled by default for Copilot-only)
  if(withMcp){
    const vsSettingsDir = path.join(cwd, '.vscode');
    fs.mkdirpSync(vsSettingsDir);
    const settingsPath = path.join(vsSettingsDir, 'settings.json');
    if(!fs.existsSync(settingsPath)){
      fs.writeFileSync(settingsPath, JSON.stringify({ 
        "aigile.mcp": { enabled: true },
        "github.copilot.chat.customAgents.showOrganizationAndEnterpriseAgents": true
      }, null, 2));
    }
  }

  if(includeJavaInstructions){
    const javaInstructionsSrc = path.join(projectRoot, 'core', 'instructions', 'java.instructions.md');
    if(fs.existsSync(javaInstructionsSrc)){
      const instructionsDest = path.join(cwd, '.github', 'instructions');
      fs.mkdirpSync(instructionsDest);
      fs.copyFileSync(javaInstructionsSrc, path.join(instructionsDest, 'java.instructions.md'));
    }
  }

  // Marker file with version info
  const markerContent = JSON.stringify({
    version: '0.3.0',
    format: useLegacyChatmodes ? 'chatmodes' : 'agents',
    installedAt: new Date().toISOString(),
    features: {
      customAgents: !useLegacyChatmodes,
      handoffs: !useLegacyChatmodes,
      runSubagent: !useLegacyChatmodes,
      mcp: withMcp
    }
  }, null, 2);
  fs.writeFileSync(path.join(cwd, '.aigile'), markerContent, 'utf8');

  return { coreDest, agentsDir: outputDir, chatmodesDir: useLegacyChatmodes ? outputDir : null };
}
