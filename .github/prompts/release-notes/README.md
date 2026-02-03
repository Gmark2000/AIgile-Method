1. Make sure you have Atlassin MCP set up and connected to your Jira instance via your token.
2. Ensure that Github MCP is set up and connected to your GitHub account via personal access token.
3. Change the variables in the prompt files to match your project settings:

````
{PROJECT_NAME} = your project name
{JIRA_PROJECT_KEY} = your Jira project key
````

Place the prompt file (release-notes.prompt.md) in a directory accessible to VS Code and Copilot extension - under `.github/prompts` is recommended.
Open Copilot extension select 'Agent' mode and type "/release-notes" to trigger the prompt.