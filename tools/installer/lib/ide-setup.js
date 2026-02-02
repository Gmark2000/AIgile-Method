import path from 'node:path';
import fs from 'fs-extra';

/**
 * Full tool list for all agents (except orchestrator)
 */
const FULL_AGENT_TOOLS = [
  // VS Code tools
  'vscode/getProjectSetupInfo', 'vscode/installExtension', 'vscode/newWorkspace', 
  'vscode/openSimpleBrowser', 'vscode/runCommand', 'vscode/vscodeAPI', 'vscode/extensions',
  // Execute tools
  'execute/runNotebookCell', 'execute/testFailure', 'execute/getTerminalOutput',
  'execute/runTask', 'execute/createAndRunTask', 'execute/runInTerminal', 'execute/runTests',
  // Read tools
  'read/getNotebookSummary', 'read/problems', 'read/readFile', 'read/readNotebookCellOutput',
  'read/terminalSelection', 'read/terminalLastCommand', 'read/getTaskOutput',
  // Agent tools
  'agent/runSubagent',
  // Edit tools
  'edit/createDirectory', 'edit/createFile', 'edit/createJupyterNotebook', 
  'edit/editFiles', 'edit/editNotebook',
  // Search tools
  'search/changes', 'search/codebase', 'search/fileSearch', 'search/listDirectory',
  'search/searchResults', 'search/textSearch', 'search/usages', 'search/searchSubagent',
  // Web tools
  'web/fetch', 'web/githubRepo',
  // Context7 MCP
  'upstash/context7/query-docs', 'upstash/context7/resolve-library-id',
  // GitHub MCP
  'github/add_comment_to_pending_review', 'github/add_issue_comment', 'github/assign_copilot_to_issue',
  'github/create_branch', 'github/create_or_update_file', 'github/create_pull_request',
  'github/create_repository', 'github/delete_file', 'github/fork_repository', 'github/get_commit',
  'github/get_file_contents', 'github/get_label', 'github/get_latest_release', 'github/get_me',
  'github/get_release_by_tag', 'github/get_tag', 'github/get_team_members', 'github/get_teams',
  'github/issue_read', 'github/issue_write', 'github/list_branches', 'github/list_commits',
  'github/list_issue_types', 'github/list_issues', 'github/list_pull_requests', 'github/list_releases',
  'github/list_tags', 'github/merge_pull_request', 'github/pull_request_read', 
  'github/pull_request_review_write', 'github/push_files', 'github/request_copilot_review',
  'github/search_code', 'github/search_issues', 'github/search_pull_requests',
  'github/search_repositories', 'github/search_users', 'github/sub_issue_write',
  'github/update_pull_request', 'github/update_pull_request_branch',
  // Other tools
  'askQuestions', 'todo',
  // GitHub PR extension tools
  'github.vscode-pull-request-github/issue_fetch', 'github.vscode-pull-request-github/suggest-fix',
  'github.vscode-pull-request-github/searchSyntax', 'github.vscode-pull-request-github/doSearch',
  'github.vscode-pull-request-github/renderIssues', 'github.vscode-pull-request-github/activePullRequest',
  'github.vscode-pull-request-github/openPullRequest'
];

/**
 * Agent metadata extracted from legacy YAML blocks
 */
const AGENT_METADATA = {
  'aigile-orchestrator': {
    description: 'PURE COORDINATOR - I have NO implementation tools. I can ONLY delegate via runSubagent.',
    tools: ['agent/runSubagent'],
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '🏗️ Architecture Review', agent: 'architect', prompt: 'Analyze the architecture and provide recommendations.', send: false },
      { label: '💻 Start Implementation', agent: 'dev', prompt: 'Implement the plan using test-driven development.', send: false },
      { label: '🧪 Run QA Gate', agent: 'qa', prompt: 'Review and test the implementation for quality.', send: false },
      { label: '📋 Refine Backlog', agent: 'po', prompt: 'Refine the backlog items based on discussion.', send: false },
      { label: '🧠 Analyze Requirements', agent: 'analyst', prompt: 'Analyze requirements and provide breakdown.', send: false },
    ],
    infer: false
  },
  'dev': {
    description: 'Full Stack Developer - code implementation, debugging, refactoring, and test-driven development.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '🧪 Request QA Review', agent: 'qa', prompt: 'Review the implementation above for quality.', send: false },
      { label: '🏗️ Architecture Check', agent: 'architect', prompt: 'Verify architecture compliance.', send: false },
    ],
    infer: true
  },
  'architect': {
    description: 'Software Architect - architecture analysis, code review, documentation, and system design.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '💻 Start Implementation', agent: 'dev', prompt: 'Implement the architecture recommendations.', send: false },
      { label: '📋 Create Stories', agent: 'po', prompt: 'Create backlog items for architecture changes.', send: false },
    ],
    infer: true
  },
  'po': {
    description: 'Product Owner - story creation, backlog management, and Jira integration.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '💻 Implement Story', agent: 'dev', prompt: 'Implement the story defined above.', send: false },
      { label: '🧠 Analyze Further', agent: 'analyst', prompt: 'Provide deeper analysis of requirements.', send: false },
    ],
    infer: true
  },
  'qa': {
    description: 'QA Engineer - testing, quality gates, E2E verification, and test automation.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '💻 Fix Issues', agent: 'dev', prompt: 'Fix the issues identified in QA review.', send: false },
      { label: '📋 Update Stories', agent: 'po', prompt: 'Update stories based on QA findings.', send: false },
    ],
    infer: true
  },
  'analyst': {
    description: 'Business Analyst - requirements analysis, brainstorming, research, and elicitation.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '📋 Create Stories', agent: 'po', prompt: 'Create stories from analysis findings.', send: false },
      { label: '🏗️ Architecture Review', agent: 'architect', prompt: 'Review architecture implications.', send: false },
    ],
    infer: true
  },
  'pm': {
    description: 'Project Manager - project planning, backlog sync, PRDs, and roadmap management.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '📋 Refine Stories', agent: 'po', prompt: 'Refine the stories in the plan.', send: false },
    ],
    infer: true
  },
  'sm': {
    description: 'Scrum Master - sprint ceremonies, standup facilitation, and team coordination.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [],
    infer: true
  },
  'ui-expert': {
    description: 'UI Expert - design system audit, Figma integration, and component specifications.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '💻 Implement UI', agent: 'dev', prompt: 'Implement the UI specifications.', send: false },
    ],
    infer: true
  },
  'ux-expert': {
    description: 'UX Expert - user experience design, frontend specs, and user journey mapping.',
    tools: FULL_AGENT_TOOLS,
    model: 'Claude Opus 4.5',
    handoffs: [
      { label: '🖌️ Design System', agent: 'ui-expert', prompt: 'Create design system components.', send: false },
      { label: '💻 Implement UX', agent: 'dev', prompt: 'Implement the UX recommendations.', send: false },
    ],
    infer: true
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
  
  // Always add model - default to Claude Opus 4.5
  lines.push(`model: ${metadata.model || 'Claude Opus 4.5'}`);
  if (metadata.infer !== undefined) lines.push(`infer: ${metadata.infer}`);
  
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
      infer: true
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
