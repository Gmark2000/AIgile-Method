{PROJECT_NAME} = 
{JIRA_PROJECT_KEY} =

# Release Notes Generation Instructions for {PROJECT_NAME}

## 🤖 Automated Release Notes Generation (AI-Powered)

#### Step 1: Determine the Last Release Tag

Notes: examples include both Bash and Windows PowerShell variants — use the one that matches the environment running the prompt. Avoid shell chaining (like `||`) that may not be supported in older PowerShell versions. Keep the response concise and as short as possible. Focus on generating release note file rather than describing to the user what has been done. Make sure you use Atlassin mcp tools and GitHub mcp tools calls where appropriate.

Bash example (Linux/macOS/WSL):
```bash
# Use GitHub MCP to list all tags and find the most recent one
# Call: mcp_github81_list_tags(owner: "REPO_OWNER", repo: "REPO_NAME", perPage: 1)
# Extract the latest tag name (e.g., "v4.2.6")
git describe --tags --abbrev=0  # returns last tag or fails if none
```

PowerShell example (Windows PowerShell / PowerShell Core):
```powershell
# Run as separate commands rather than using bash-style chaining
git describe --tags --abbrev=0   # prints last tag (e.g., release-stage-v0.0.23)
# If the above fails (no tag), handle that as a separate branch in your automation
```

**Expected Output:** Latest semantic version tag
**Store as:** `LAST_RELEASE_TAG`

#### Step 2: Get Current Repository Information

Run the following commands (examples for both Bash and PowerShell). Keep commands separate to avoid shell compatibility issues.

Bash / PowerShell (same git commands apply):
```bash
# Get the most recent tag (may fail if no tag exists)
git describe --tags --abbrev=0

# Get the current branch name
git rev-parse --abbrev-ref HEAD

# Get the latest commit one-line summary
git log --oneline -1

# Count commits since the tag: replace {LAST_TAG} with the tag name returned earlier
git rev-list --count {LAST_TAG}..HEAD
```

If there is no tag (git describe exits non-zero), decide on a fallback (for example use `HEAD~0` as base, or treat the entire repo as the first release). Automation should detect the non-zero exit and switch to a fallback flow.

**Extract:** Current version, current branch name, commit count since last release

#### Step 3: Extract Commits Since Last Release

You can use the GitHub API (mcp_github81_list_commits) or run local git commands to extract commits. Local git commands are often faster and do not require API pagination for a small range.

Local git example (gives full hash, short hash, subject, author and ISO date):
```bash
git log --pretty=format:"%H|%h|%s|%an|%ad" --date=iso {LAST_TAG}..HEAD
```

PowerShell note: run the same git command in PowerShell — output is plain text and can be parsed with `-split`/`Select-String` or other text tooling.

To collect files changed and detailed commit body use:
```bash
git show --pretty=format:"%H|%h|%s|%an|%ad|%b" --name-status {COMMIT_HASH}
```

For each commit extract:
- full and short hash
- commit subject and full body
- author name and date
- PR references (look for examples like PR number 123 or the text "Merge pull request PR 123" in merge commits)
- JIRA keys (examples: {JIRA_PROJECT_KEY}-123) — adapt the pattern to your Jira project keys (for example {JIRA_PROJECT_KEY}-<number>).

Commit message parsing guidance:
- JIRA issue keys: search for tokens like {JIRA_PROJECT_KEY}-123 or other project-key patterns
- PR numbers: look for patterns like PR number 123 or the text 'Merge pull request PR 123' in merge commits
- Conventional commits: detect `feat:`, `fix:`, `chore:`, `docs:` prefixes where present

#### Step 4: Fetch Pull Requests for This Release

Prefer querying the GitHub API (mcp_github81_list_pull_requests) for authoritative PR metadata. If you prefer local git analysis, you can infer PR numbers and merge commits from commit messages (merge commits usually contain text like "Merge pull request PR 123").

GitHub API call (preferred):
```js
// mcp_github81_list_pull_requests(...)
// Filter closed/merged PRs and then keep those with merged_at between LAST_RELEASE_DATE and NOW
```

Local fallback (extract PR numbers from merge commits):
```bash
git log --merges --pretty=format:"%H|%s|%an|%ad" {LAST_TAG}..HEAD --date=iso
# then parse the output for strings like 'Merge pull request PR 123' to extract PR numbers
```

For each PR, extract number, title, merged date, merged by, and body (description). Cross-reference PRs with commits and JIRA keys.

#### Step 5: Extract JIRA Tickets from Commit Messages

For each unique JIRA key discovered in commits/PRs, attempt to retrieve issue details from Jira using the MCP tool. If Jira access is not possible in automation, leave placeholders in the release notes for manual enrichment and include the JIRA links so reviewers can expand them.

Example call (MCP):
```
# mcp_mcp-atlassian43_jira_get_issue(
#   issue_key: "PROJ-123",
#   fields: "summary,description,issuetype,priority,status,assignee,reporter,labels,parent,customfield_10014"
# )
```

For each JIRA issue extract:
- issue key and URL
- summary and full description
- issue type (Bug, Story, Task, Feature)
- priority and status
- assignee and reporter
- labels, parent/subtask relationship
- Epic Link / epic key (custom field name may vary by instance; `customfield_10014` is common but verify in your Jira)

If Jira is unreachable, include the found JIRA keys in the release notes and mark them for manual lookup.

#### Step 6: Fetch Epic Information

Use the same Jira API call to fetch epic-level information for any Epic keys discovered. Extract epic summary and description to present context in the release notes.

Example (MCP):
```
# mcp_mcp-atlassian43_jira_get_issue(issue_key: "PROJ-456", fields: "summary,description,status")
```

#### Step 7: Organize Issues by Epic
Group all resolved JIRA tickets by their Epic Link field. Tickets without an Epic go to a "General Improvements" section.

**Order Epics by:** Impact/importance to the release
**Order Issues Within Epic by:** Priority (Critical → Major → Normal → Minor)

#### Step 8: Calculate Statistics

Count the following from the extracted data. Use the GitHub API or local git commands.

Local examples:
```bash
# Count commits
git rev-list --count {LAST_TAG}..HEAD

# Count unique authors
git log --format='%an' {LAST_TAG}..HEAD | sort -u | wc -l

# Count PR numbers referenced in commits (Bash)
# Use `git log` and a text tool (grep/sed/awk) to find tokens that look like a hash followed by digits (example: '#123'), then deduplicate and count them.

# PowerShell equivalent for PR extraction
# Use `git log` and `Select-String` with an appropriate pattern to match PR references (e.g., '#123'), extract match values, deduplicate and count unique values.
```

From Jira data (if available) count types: Bug, Story/Feature, Task and priorities.

#### Step 9: Determine Release Date and Version

Release date: use the current date or infer from the merge date of the most recent merged PR included in the release.

Version bump guidance (automatable but often a manual decision):
- If commits include new features (stories/features) → minor bump
- If commits only include bugfixes → patch bump
- If there are breaking changes (API/DB/contract changes) → major bump

If your tags have prefixes (for example `release-stage-v0.0.23`), normalize or strip prefixes when calculating semantic increments, or adopt the repository convention (e.g., maintain `release-stage-` prefix and increment the numeric portion).

#### Step 10: Generate Release Notes Document
Using all the extracted information, generate the release notes following the structure defined in sections below. Fill in all template variables with actual data.

---

### Complete Workflow Summary for AI Agents

**Input:** Repository owner, repository name, target branch (optional)

**Process:**
1. List tags → find LAST_RELEASE_TAG
2. Get commits since last tag → extract JIRA keys and PR numbers
3. For each JIRA key → fetch issue details from JIRA
4. For each Epic → fetch epic details
5. Organize issues by Epic and Priority
6. Calculate release statistics
7. Generate formatted release notes document

**Output:** Complete release notes in markdown format

**Tools Required:**
- `mcp_github81_list_tags` - Get repository tags
- `mcp_github81_list_commits` - Get commits since last release
- `mcp_github81_list_pull_requests` - Get merged PRs
- `mcp_mcp-atlassian43_jira_get_issue` - Get JIRA issue details
- `mcp_mcp-atlassian43_jira_search` - Find related issues

---

## Overview
This document provides guidelines for generating comprehensive release notes for {PROJECT_NAME} releases. Follow these standards to ensure consistency, accuracy, and completeness across all release documentation.

## Document Structure

### 1. Header Section
```markdown
# Release Notes - {PROJECT_NAME} v{VERSION}

**Release Date:** {MONTH DAY, YEAR}  
**Branch:** release/{VERSION}  
**Base Version:** {PREVIOUS_VERSION}
```

**Guidelines:**
- Use format "Release Notes - {PROJECT_NAME} v{VERSION}"
- Release date format: "Month DD, YYYY" (e.g., "October 1, 2025")
- Branch name must match the actual git branch name
- Base version is the previous release version

### 2. What's New Section (🚀)
```markdown
## 🚀 What's New

This release focuses on {PRIMARY_FOCUS_AREAS}. The primary changes address {KEY_CHANGES} for better {BENEFITS}.
```

**Guidelines:**
- Provide 2-3 sentence executive summary
- Focus on business value and user impact
- Mention primary focus areas and key achievements
- Keep it high-level and accessible to non-technical stakeholders

### 3. Bug Fixes & Features Section (🔧)

#### Format for Each Epic:
```markdown
### 🎯 Epic: [EPIC_KEY] EPIC_TITLE
*Epic: EPIC_DESCRIPTION*

-- JIRA_KEY (link: https://your-jira.atlassian.net/browse/JIRA_KEY) TYPE | PRIORITY: TITLE
  - DESCRIPTION_POINT_1
  - DESCRIPTION_POINT_2
  - DESCRIPTION_POINT_3
  - **Pull Request**: PR PR_NUMBER
  - **Git Author**: AUTHOR_NAME
  - **Assignee**: ASSIGNEE_NAME
  - **Reporter**: REPORTER_NAME
  - **Status**: STATUS
  - **Labels**: LABELS (if applicable)
```

**Issue Type Icons:**
- 🐛 **Bug** - Defects and issues
- 📖 **Story** - User stories and features
- 🚀 **Feature** - New feature implementations
- 📋 **Task** - Technical tasks

**Priority Icons:**
- 🔴 **Critical** - Immediate attention required
- 🟠 **Major/High** - High priority issues
- 🔵 **Medium/Normal** - Standard priority
- 🟡 **Minor** - Low priority enhancements

**Status Icons:**
- ✅ **Done** - Completed and merged
- 🔄 **In Progress** - Actively being worked on
- 🔄 **In Review** - Under code review
- 🔄 **In Testing** - In testing phase
- ⏸️ **On Hold** - Temporarily paused
- ❌ **Canceled** - Cancelled or reverted

**Guidelines:**
- Group tickets by Epic for better context
  -- Include full JIRA URL template (plain text): https://your-jira.atlassian.net/browse/JIRA_KEY
- List all related pull request numbers
- Always include Git Author, Assignee, and Reporter
- Use bullet points for detailed descriptions (3-5 points recommended)
- Order Epics by importance/impact
- Within each Epic, order by priority (Critical → Major → Normal → Minor)

### 4. Configuration Updates Section (🔄)

```markdown
## 🔄 Configuration Updates

### {AREA_NAME} Enhancements
- **{CONFIG_TYPE}**: {DESCRIPTION}
- **{SETTING}**: {WHAT_CHANGED}
- **{PARAMETER}**: {NEW_BEHAVIOR}

### {ANOTHER_AREA} Improvements
- **{FEATURE_FLAG}**: {PURPOSE_AND_IMPACT}
- **{ENDPOINT}**: {MODIFICATION_DETAILS}
```

**Guidelines:**
- Group by functional area (e.g., Click2Pay, Alias Pay, Security)
- Document any new feature flags or configuration parameters
- Describe API endpoint changes
- Note any database schema changes
- Include environment-specific settings if applicable

### 5. Technical Improvements Section (🛠️)

```markdown
## 🛠️ Technical Improvements

### Enhanced Error Handling
- **{SERVICE_NAME}**: {IMPROVEMENT_DESCRIPTION}
- **{COMPONENT}**: {ENHANCEMENT_DETAILS}

### Code Quality Improvements
- **Testing**: {TEST_COVERAGE_IMPROVEMENTS}
- **Logging**: {LOGGING_ENHANCEMENTS}
- **Architecture**: {STRUCTURAL_IMPROVEMENTS}

### Performance Enhancements
- **{OPTIMIZATION_AREA}**: {PERFORMANCE_GAIN}
- **{SYSTEM_COMPONENT}**: {EFFICIENCY_IMPROVEMENT}
```

**Guidelines:**
- Focus on technical improvements not visible to end users
- Include testing, logging, and architecture improvements
- Mention performance optimizations
- Document code quality enhancements
- Describe refactoring efforts

### 6. Statistics Section (📊)

```markdown
## 📊 Statistics

- **Total Commits**: {NUMBER} commits in this release
- **Pull Requests Merged**: NUMBER (PR range: FIRST_PR - LAST_PR)
- **Files Modified**: {NUMBER} files
- **JIRA Tickets**: {NUMBER} tickets resolved
- **Bug Fixes**: {NUMBER} ({LIST_PRIORITIES})
- **Feature Enhancements**: {NUMBER} ({BRIEF_DESCRIPTION})
- **Services Enhanced**: {NUMBER} ({LIST_SERVICES})
```

**Guidelines:**
- Provide accurate counts from git analysis
- List PR number range if there are many PRs
- Break down tickets by type (bugs vs features)
- Include priority distribution
- Mention affected services/components

### 7. Testing Section (🧪)

```markdown
## 🧪 Testing

All changes have been thoroughly tested across multiple environments with special focus on:

### Integration Testing
- {INTEGRATION_TEST_SCENARIO_1}
- {INTEGRATION_TEST_SCENARIO_2}
- {INTEGRATION_TEST_SCENARIO_3}

### Error Scenario Testing
- {ERROR_SCENARIO_1}
- {ERROR_SCENARIO_2}
- {ERROR_SCENARIO_3}
```

**Guidelines:**
- Document key test scenarios executed
- Include integration testing details
- List error scenario testing coverage
- Mention any new test cases added
- Note testing environments used

### 8. Security & Compliance Section (🔒)

```markdown
## 🔒 Security & Compliance

### Enhanced Error Handling
- {SECURITY_IMPROVEMENT_1}
- {SECURITY_IMPROVEMENT_2}

### Integration Security
- {SECURITY_MEASURE_1}
- {SECURITY_MEASURE_2}
```

**Guidelines:**
- Document security enhancements
- Note compliance-related changes
- Describe data protection improvements
- Mention authentication/authorization changes
- Include audit logging improvements

### 9. Contributors Section (👥)

```markdown
## 👥 Contributors

- {NAME} (Git commits author, {PRIMARY_CONTRIBUTION})
- {NAME} (JIRA assignee, {PRIMARY_CONTRIBUTION})
- {NAME} (JIRA reporter, {ROLE_DESCRIPTION})
- {NAME} (JIRA reporter, {ROLE_DESCRIPTION})
```

**Guidelines:**
- List all team members who contributed
- Include their roles (git author, JIRA assignee, reporter)
- Add brief description of their primary contribution
- Maintain alphabetical order or order by contribution level
- Include both technical and non-technical contributors

### 10. Previous Release Reference (📋)

```markdown
## 📋 Previous Release

For details about the previous release, see [RELEASE_NOTES_{PREVIOUS_VERSION}.md](./RELEASE_NOTES_{PREVIOUS_VERSION}.md)
```

**Guidelines:**
- Always link to the previous release notes
- Use relative path format
- Ensure the link is valid

### 11. Next Steps Section (🚀)

```markdown
## 🚀 Next Steps

This release establishes {FOUNDATION_DESCRIPTION}. Future releases may include:
- {PLANNED_IMPROVEMENT_1}
- {PLANNED_IMPROVEMENT_2}
- {PLANNED_IMPROVEMENT_3}
- {PLANNED_IMPROVEMENT_4}
```

**Guidelines:**
- Describe the foundation this release establishes
- List 3-5 planned improvements for future releases
- Focus on natural evolution of current features
- Mention any ongoing work or dependencies
- Keep it aspirational but realistic

### 12. Footer

```markdown
---

For technical support or questions about this release, please contact the {PROJECT_NAME} development team.
```

## Data Collection Process

### 1. Git Commit Analysis

**Commands to Execute:**
```bash
# Check current branch
git branch

# Get commits since last release
git log --oneline {LAST_VERSION_TAG}..HEAD

# Get detailed commit information
git log --pretty=format:"%H|%s|%an|%ad" --date=short {LAST_VERSION_TAG}..HEAD

# Get file changes for specific commit
git show --name-only {COMMIT_HASH}

# Get commit statistics
git diff --shortstat {LAST_VERSION_TAG}..HEAD
```

**Extract from Commits:**
- Commit hashes (full and short)
- JIRA ticket numbers from commit messages
- PR numbers from commit messages
- Commit authors
- Commit dates
- Files modified

### 2. JIRA Integration

**Required JIRA Fields to Retrieve:**
- Issue Key (e.g., BTWDV001-12345)
- Summary/Title
- Description
- Issue Type (Bug, Story, Task, Feature)
- Priority (Critical, Major, Normal, Minor)
- Status (Done, In Progress, On Hold, etc.)
- Assignee
- Reporter
- Labels
- Epic Link
- Created Date
- Updated Date

**Use JIRA MCP Tool:**
```
f1e_jira_get_issue(issue_key: "{JIRA_KEY}")
```

### 3. Epic Organization

**Retrieve Epic Information:**
- Epic Key and Title
- Epic Description
- All tickets associated with the Epic
- Epic status and priority

**Guidelines:**
- Group tickets by their Epic affiliation
- Create clear Epic section headers
- Provide Epic context and description
- Order Epics by business impact

## Quality Checklist

### Before Publishing:
- [ ] All commit hashes are accurate and verifiable
- [ ] All JIRA tickets are linked and accessible
- [ ] All PR numbers are correct
- [ ] All contributors are credited appropriately
- [ ] Status icons match actual JIRA status
- [ ] Priority icons match JIRA priority
- [ ] Issue type icons match JIRA issue type
- [ ] Statistics are accurate and complete
- [ ] Links to previous release notes work
- [ ] Epic groupings are logical and complete
- [ ] Descriptions are clear and concise
- [ ] Technical improvements are documented
- [ ] Security changes are highlighted
- [ ] Testing coverage is described
- [ ] No duplicate information
- [ ] Consistent formatting throughout
- [ ] Proper markdown syntax
- [ ] Grammar and spelling checked

## Common Patterns

### For Bug Fixes:
```markdown
- **[{JIRA_KEY}]({JIRA_URL})** 🐛 **Bug** | {PRIORITY_ICON} **{PRIORITY}**: {TITLE}
  - {ROOT_CAUSE_DESCRIPTION}
  - {SYMPTOMS_ADDRESSED}
  - {SOLUTION_IMPLEMENTED}
  - {IMPACT_ON_USERS}
  - **Pull Request**: PR PR_NUMBER
  - **Git Author**: {AUTHOR}
  - **Assignee**: {ASSIGNEE}
  - **Reporter**: {REPORTER}
  - **Status**: ✅ Done
```

### For New Features:
```markdown
- **[{JIRA_KEY}]({JIRA_URL})** 📖 **Story** | {PRIORITY_ICON} **{PRIORITY}**: {TITLE}
  - {BUSINESS_VALUE}
  - {FEATURE_DESCRIPTION_1}
  - {FEATURE_DESCRIPTION_2}
  - {USER_BENEFIT}
  - {TECHNICAL_IMPLEMENTATION}
  - **Pull Request**: PR PR_NUMBER
  - **Git Author**: {AUTHOR}
  - **Assignee**: {ASSIGNEE}
  - **Reporter**: {REPORTER}
  - **Status**: ✅ Done
```

### For On Hold/Blocked Items:
```markdown
- **[{JIRA_KEY}]({JIRA_URL})** {TYPE_ICON} **{TYPE}** | {PRIORITY_ICON} **{PRIORITY}**: {TITLE}
  - {WORK_COMPLETED}
  - {BLOCKING_REASON}
  - {PENDING_DEPENDENCY}
  - {NEXT_STEPS}
  - **Pull Request**: PR PR_NUMBER
  - **Git Author**: {AUTHOR}
  - **Assignee**: {ASSIGNEE}
  - **Reporter**: {REPORTER}
  - **Status**: ⏸️ On Hold
```

## Examples of Well-Written Descriptions

### Good Example - Clear and Detailed:
```markdown
- **[BTWDV001-64607]** 🐛 **Bug** | 🟠 **Major**: Click2Pay enrollment and unenrollment issue resolution
  - Addressed multiple Click2Pay integration issues with VISA services
  - Phone number and email conflicts during enrollment ("already used in other profiles")
  - Timeout issues during unenrollment (15-second timeout exceeded)
  - Status synchronization problems (cards showing as unenrolled after successful enrollment)
  - Enhanced error handling for VISA API responses
  - Improved timeout management for long-running operations
```

### Poor Example - Too Vague:
```markdown
- Fixed Click2Pay issues
  - Some problems with VISA
  - Better error handling
```

## File Naming Convention

- Format: `RELEASE_NOTES_{VERSION}.md`
- Examples:
    - `RELEASE_NOTES_4.2.0.md`
    - `RELEASE_NOTES_4.2.6.md`
    - `RELEASE_NOTES_5.0.0.md`

## Version Control

- Store release notes in repository root directory
- Commit with message: `docs: Add release notes for version {VERSION}`
- Tag the release commit: `git tag -a {VERSION} -m "Release {VERSION}"`

## Automation Tips

### Using Git to Extract Information:
```bash
# Extract JIRA ticket numbers from commits
git log {LAST_TAG}..HEAD --oneline | grep -oE 'BTWDV001-[0-9]+' | sort -u

# Get contributor list
git log {LAST_TAG}..HEAD --format='%an' | sort -u

# Count commits
git rev-list --count {LAST_TAG}..HEAD

# Get PR numbers
git log {LAST_TAG}..HEAD --oneline | grep -oE '#[0-9]+' | sort -u
```

### Using JIRA MCP Tools:
```javascript
// Get issue details
f1e_jira_get_issue(issue_key: "BTWDV001-12345")

// Search for issues
f1e_jira_search(jql: "project = BTWDV001 AND fixVersion = 4.2.6")

// Get Epic information
f1e_jira_get_issue(issue_key: "BTWDV001-12345", fields: "epic")
```

## Best Practices

1. **Accuracy First**: Always verify commit hashes, PR numbers, and JIRA ticket information
2. **User-Centric**: Write for multiple audiences (developers, QA, product managers, stakeholders)
3. **Context Matters**: Provide enough context for someone unfamiliar with the work
4. **Be Specific**: Include concrete details, not vague statements
5. **Link Everything**: JIRA tickets, PRs, documentation - make it easy to drill down
6. **Group Logically**: Use Epics to provide business context
7. **Highlight Impact**: Always explain the user/business impact
8. **Document Gotchas**: Note any known issues, limitations, or pending work
9. **Credit Everyone**: Include all contributors, not just developers
10. **Keep Updated**: Update release notes as changes occur, don't wait until the end

## Review Process

1. **Technical Review**: Verify all technical details are accurate
2. **Business Review**: Ensure business value is clearly communicated
3. **QA Review**: Confirm test coverage is documented
4. **Product Review**: Validate feature descriptions and priorities
5. **Final Proofread**: Check grammar, spelling, and formatting

## Template Quick Reference

Use this minimal template to get started:

```markdown
# Release Notes - {PROJECT_NAME} v{VERSION}

**Release Date:** {DATE}  
**Branch:** release/{VERSION}  
**Base Version:** {PREVIOUS_VERSION}

## 🚀 What's New

{EXECUTIVE_SUMMARY}

## 🔧 Bug Fixes & Features

### 🎯 Epic: [{EPIC_KEY}] {EPIC_TITLE}

- **[{JIRA_KEY}]({URL})** {TYPE_ICON} **{TYPE}** | {PRIORITY_ICON} **{PRIORITY}**: {TITLE}
  - {DESCRIPTION}
  - **Pull Request**: PR PR_NUMBER
  - **Git Author**: {AUTHOR}
  - **Assignee**: {ASSIGNEE}
  - **Reporter**: {REPORTER}
  - **Status**: {STATUS}

## 🔄 Configuration Updates
## 🛠️ Technical Improvements
## 📊 Statistics
## 🧪 Testing
## 🔒 Security & Compliance
## 👥 Contributors
## 📋 Previous Release
## 🚀 Next Steps

---

For technical support or questions about this release, please contact the {PROJECT_NAME} development team.
```

## Troubleshooting

### Missing Information:
- **No Epic Link**: Place ticket in a general "Technical Improvements" or "Bug Fixes" section
- **No PR Number**: Check commit messages and git history
- **No JIRA Ticket**: Document based on commit message information
- **Conflicting Information**: Verify with git log and JIRA, prefer JIRA as source of truth

### Common Issues:
- **Duplicate Tickets**: Check if ticket appears in multiple commits, document only once
- **Reverted Changes**: Mark clearly with ❌ status and explain why
- **Partial Implementations**: Use 🔄 In Progress status and note what remains
- **External Dependencies**: Document in "On Hold" section with clear explanation

---