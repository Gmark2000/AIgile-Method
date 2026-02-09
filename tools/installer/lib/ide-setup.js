import path from 'node:path';
import fs from 'fs-extra';

/**
 * Full tool list for all agents (except orchestrator)
 * Uses VS Code prefix/toolName format and MCP wildcards
 */
const FULL_AGENT_TOOLS = [
  // vscode tools
  'vscode/extensions', 'vscode/getProjectSetupInfo', 'vscode/installExtension',
  'vscode/newWorkspace', 'vscode/openSimpleBrowser', 'vscode/runCommand', 'vscode/vscodeAPI',
  // execute tools
  'execute/getTerminalOutput', 'execute/runTask', 'execute/createAndRunTask',
  'execute/runInTerminal', 'execute/runNotebookCell', 'execute/testFailure', 'execute/runTests',
  // read tools
  'read/terminalSelection', 'read/terminalLastCommand', 'read/getTaskOutput',
  'read/getNotebookSummary', 'read/problems', 'read/readFile', 'read/readNotebookCellOutput',
  // agent tools
  'agent/runSubagent',
  // edit tools
  'edit/createDirectory', 'edit/createFile', 'edit/createJupyterNotebook',
  'edit/editFiles', 'edit/editNotebook',
  // search tools
  'search/changes', 'search/codebase', 'search/fileSearch', 'search/listDirectory',
  'search/searchResults', 'search/textSearch', 'search/usages',
  // web tools
  'web/fetch', 'web/githubRepo',
  // other built-in
  'todo',
  // MCP servers (wildcard includes all tools from each server)
  'atlassian/*',
  'context7/*',
  'sequentialthinking/*',
  'github.com/*',
  'github.vscode-pull-request-github/*'
];

/**
 * Agent metadata extracted from legacy YAML blocks
 */
const AGENT_METADATA = {
  'aigile-orchestrator': {
    description: 'PURE COORDINATOR - I have NO implementation tools. I can ONLY delegate via runSubagent.',
    tools: ['read/readFile', 'agent', 'search/codebase', 'search/fileSearch', 'search/textSearch', 'search/listDirectory', 'sequentialthinking/*'],
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '🏗️ Architecture Review', agent: 'Architect', prompt: 'Analyze the architecture and provide recommendations.', send: false },
      { label: '💻 Start Implementation', agent: 'Full Stack Developer', prompt: 'Implement the plan using test-driven development.', send: false },
      { label: '🧪 Run QA Gate', agent: 'Test Architect & Quality Advisor', prompt: 'Review and test the implementation for quality.', send: false },
      { label: '📋 Refine Backlog', agent: 'Product Owner', prompt: 'Refine the backlog items based on discussion.', send: false },
      { label: '🧠 Analyze Requirements', agent: 'Business Analyst', prompt: 'Analyze requirements and provide breakdown.', send: false },
    ],
    'user-invokable': true,
    'disable-model-invocation': true
  },
  'dev': {
    description: 'Full Stack Developer - code implementation, debugging, refactoring, and test-driven development.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '🧪 Request QA Review', agent: 'Test Architect & Quality Advisor', prompt: 'Review the implementation above for quality.', send: false },
      { label: '🏗️ Architecture Check', agent: 'Architect', prompt: 'Verify architecture compliance.', send: false },
    ],
    'user-invokable': true
  },
  'architect': {
    description: 'Software Architect - architecture analysis, code review, documentation, and system design.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '💻 Start Implementation', agent: 'Full Stack Developer', prompt: 'Implement the architecture recommendations.', send: false },
      { label: '📋 Create Stories', agent: 'Product Owner', prompt: 'Create backlog items for architecture changes.', send: false },
    ],
    'user-invokable': true
  },
  'po': {
    description: 'Product Owner - story creation, backlog management, and Jira integration.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '💻 Implement Story', agent: 'Full Stack Developer', prompt: 'Implement the story defined above.', send: false },
      { label: '🧠 Analyze Further', agent: 'Business Analyst', prompt: 'Provide deeper analysis of requirements.', send: false },
    ],
    'user-invokable': true
  },
  'qa': {
    description: 'QA Engineer - testing, quality gates, E2E verification, and test automation.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '💻 Fix Issues', agent: 'Full Stack Developer', prompt: 'Fix the issues identified in QA review.', send: false },
      { label: '📋 Update Stories', agent: 'Product Owner', prompt: 'Update stories based on QA findings.', send: false },
    ],
    'user-invokable': true
  },
  'analyst': {
    description: 'Business Analyst - requirements analysis, brainstorming, research, and elicitation.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '📋 Create Stories', agent: 'Product Owner', prompt: 'Create stories from analysis findings.', send: false },
      { label: '🏗️ Architecture Review', agent: 'Architect', prompt: 'Review architecture implications.', send: false },
    ],
    'user-invokable': true
  },
  'pm': {
    description: 'Project Manager - project planning, backlog sync, PRDs, and roadmap management.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '📋 Refine Stories', agent: 'Product Owner', prompt: 'Refine the stories in the plan.', send: false },
    ],
    'user-invokable': true
  },
  'sm': {
    description: 'Scrum Master - sprint ceremonies, standup facilitation, and team coordination.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [],
    'user-invokable': true
  },
  'ui-expert': {
    description: 'UI Expert - design system audit, Figma integration, and component specifications.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '💻 Implement UI', agent: 'Full Stack Developer', prompt: 'Implement the UI specifications.', send: false },
    ],
    'user-invokable': true
  },
  'ux-expert': {
    description: 'UX Expert - user experience design, frontend specs, and user journey mapping.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.6',
    handoffs: [
      { label: '🖌️ Design System', agent: 'UI Expert', prompt: 'Create design system components.', send: false },
      { label: '💻 Implement UX', agent: 'Full Stack Developer', prompt: 'Implement the UX recommendations.', send: false },
    ],
    'user-invokable': true
  },
};

/**
 * Extract agent ID from filename
 */
function getAgentId(filename) {
  return filename
    .replace(/\.agent\.md$/, '')
    .replace(/\.md$/, '');
}

/**
 * Check if file is already in new agent format
 */
function isNewAgentFormat(filename) {
  return filename.endsWith('.agent.md');
}

/**
 * Generate YAML frontmatter for custom agent
 */
function generateFrontmatter(id, metadata) {
  const lines = ['---'];
  
  if (metadata.name) lines.push(`name: ${metadata.name}`);
  lines.push(`description: "${metadata.description || `Activates the ${id} agent persona (AIgile).`}"`);
  if (metadata.argumentHint) lines.push(`argument-hint: "${metadata.argumentHint}"`);
  
  if (metadata.tools && metadata.tools.length > 0) {
    lines.push('tools:');
    for (const tool of metadata.tools) {
      lines.push(`  - ${tool}`);
    }
  }
  
  // Always add model - default to Claude Opus 4.6
  lines.push(`model: ${metadata.model || 'Claude Opus 4.6'}`);
  if (metadata['user-invokable'] !== undefined) lines.push(`user-invokable: ${metadata['user-invokable']}`);
  if (metadata['disable-model-invocation'] !== undefined) lines.push(`disable-model-invocation: ${metadata['disable-model-invocation']}`);
  
  if (metadata.handoffs && metadata.handoffs.length > 0) {
    lines.push('handoffs:');
    for (const handoff of metadata.handoffs) {
      lines.push(`  - label: "${handoff.label}"`);
      lines.push(`    agent: ${handoff.agent}`);
      lines.push(`    prompt: "${handoff.prompt}"`);
      lines.push(`    send: ${handoff.send}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

/**
 * Setup GitHub Copilot custom agents (new format)
 * Creates .agent.md files in .github/agents/ folder
 * 
 * @deprecated destChatmodesDir parameter - now creates agents in .github/agents/
 */
export function setupGithubCopilot({ srcAgentsDir, destChatmodesDir, destAgentsDir }){
  // Use new agents directory, fallback to chatmodes for backward compatibility
  const targetDir = destAgentsDir || destChatmodesDir?.replace('chatmodes', 'agents') || destChatmodesDir;
  
  fs.mkdirpSync(targetDir);
  if(!srcAgentsDir || !fs.existsSync(srcAgentsDir)) return;

  const processedAgents = [];

  for(const name of fs.readdirSync(srcAgentsDir)){
    if(!name.endsWith('.md')) continue;
    
    const id = getAgentId(name);
    const srcPath = path.join(srcAgentsDir, name);
    const agentMd = fs.readFileSync(srcPath, 'utf8');
    
    // If already in new .agent.md format, copy directly
    if (isNewAgentFormat(name)) {
      fs.copyFileSync(srcPath, path.join(targetDir, name));
      processedAgents.push({ id, format: 'native' });
      continue;
    }

    // Convert legacy format to new custom agent format
    const metadata = AGENT_METADATA[id] || {
      description: `Activates the ${id} agent persona (AIgile).`,
      tools: ['search', 'fetch', 'codebase', 'problems'],
      handoffs: [],
      'user-invokable': true
    };
    
    const frontmatter = generateFrontmatter(id, metadata);
    
    // Transform the content - remove old activation notice if present
    let content = agentMd;
    
    // Add activation context header
    const header = [
      '',
      '# Activation Notice',
      '',
      'This agent is part of the AIgile framework. The instructions below define your operating guidelines.',
      'Use `#tool:runSubagent` to delegate specialized tasks to other agents when appropriate.',
      '',
    ].join('\n');

    const out = `${frontmatter}${header}${content}`;
    const destFile = path.join(targetDir, `${id}.agent.md`);
    fs.writeFileSync(destFile, out, 'utf8');
    processedAgents.push({ id, format: 'converted' });
  }

  return processedAgents;
}

/**
 * Setup legacy chatmodes (deprecated - for backward compatibility)
 * @deprecated Use setupGithubCopilot with destAgentsDir instead
 */
export function setupLegacyChatmodes({ srcAgentsDir, destChatmodesDir }){
  console.warn('Warning: chatmodes are deprecated. Use custom agents (.github/agents/) instead.');
  fs.mkdirpSync(destChatmodesDir);
  if(!srcAgentsDir || !fs.existsSync(srcAgentsDir)) return;

  for(const name of fs.readdirSync(srcAgentsDir)){
    if(!name.endsWith('.md')) continue;
    const id = getAgentId(name);
    const agentMd = fs.readFileSync(path.join(srcAgentsDir, name), 'utf8');

    const header = [
      '---',
      `description: "Activates the ${id} agent persona (AIgile)."`,
      '---',
      '',
      '# Activation Notice',
      'This file contains the full agent operating guidelines for GitHub Copilot Chat.',
      'Follow the YAML inside to assume this role and operate within these constraints.',
      '',
    ].join('\n');

    const out = `${header}${agentMd}`;
    fs.writeFileSync(path.join(destChatmodesDir, `${id}.chatmode.md`), out, 'utf8');
  }
}
