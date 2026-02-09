---
description: 'Prompt for generating Confluence documentation in Markdown format.'
mode: 'agent'
---

Important: This prompt expects the host environment to provide a tool named `confluence_get_page` (an Atlassian MCP integration) that accepts a Confluence space key and page title or page id and returns the page content and metadata. If `confluence_get_page` is not available in the execution environment, STOP and report to the user that the tool is unavailable and that network/MCP access is required.

When a user provides a Confluence URL (for example: `https://your-company.atlassian.net/wiki/display/PROJ/Page+Title`), you MUST do the following before fetching content:

- Parse the URL and extract the space key and page title (or page id if the URL contains `pages/<id>`). Rules:
	- If the URL contains `/display/{SPACE}/{Page+Title}`, then `SPACE` is the space key and the page title is the portion after the space, with `+` decoded to spaces.
	- If the URL contains `/pages/{id}`, extract the numeric page id.
	- Normalize the page title by URL-decoding and trimming leading/trailing whitespace.

- Confirm back to the user the extracted values in one short line, for example: `Extracted space key: INV, page title: Flows for instruments` and then proceed.

- Use the `confluence_get_page` tool with the extracted identifiers. The call should request the page in Storage (HTML) format along with full metadata (title, id, space, url, version, created/updated timestamps, author, labels, attachments list).

- If the `confluence_get_page` tool returns an error indicating the page is restricted or inaccessible, report that to the user and do not attempt further fetches for that page unless explicit permission is granted.

- If the `confluence_get_page` tool is not available, do NOT attempt to call Confluence APIs directly. Immediately inform the user: "The required `confluence_get_page` tool is not available in this environment. I cannot fetch Confluence pages without MCP access. Please provide the page content or enable the tool."

Additional details:
- Assumptions the agent can rely on (must verify before running):
	- You have valid Confluence access and appropriate permissions to read pages and attachments.
	- The Confluence content format can be either Storage (HTML-like) or WYSIWYG; the agent must detect and handle both.
	- The user will provide either a page ID or space key + title
	- Network rate limits and transient HTTP errors can occur; implement retries with exponential backoff (3 attempts default).

1) Reasoning / Plan (required): 
	 - For each run, produce a 3–6 sentence plan describing inputs, scope, number of pages estimated, attachments expected, and any ambiguous items that require user confirmation. Wait for confirmation when key inputs are missing or ambiguous (e.g., both space_keys and page_ids absent).

2) Discovery:
	 - Resolve the list of pages to export based on scope.
	 - For space_keys: list pages via Confluence API (paginate). Respect include/exclude label filters.
	 - For root_page_id: traverse children up to configured depth.
	 - For page_ids: validate each id exists and record metadata.

3) Fetch content:
	 - For each resolved page id, fetch storage-format content (prefer Storage format via API).
	 - Also fetch page metadata: title, id, space, url, version, created/updated timestamps, author, labels, and list of attachments (name, id, mediaType, download link).

4) Conversion rules:
	 - Convert Storage/HTML content to GitHub-flavored Markdown.
	 - Preserve headings, lists, tables, code blocks, blockquotes.
	 - Convert Confluence-specific macros:
		 - Jira macros: replace with a short link or a placeholder with the referenced issue keys.
		 - Include/excerpt macros: inline the fetched content where possible; otherwise insert a clear placeholder with the source page id and URL.
		 - Other unsupported macros: insert a markdown placeholder with macro name and parameters.
	 - Convert internal Confluence links:
		 - If link_style == "relative": map to local markdown filenames using `page_name_template` and make links relative.
		 - If absolute: keep original Confluence URLs.
		 - Record broken or unresolvable links in a `links-report.json`.
	 - Images and attachments:
		 - If attachments==true and image_handling=="save_and_link": download attachments to `output_dir/assets/<page-id>/` and replace src with relative path.
		 - If "embed_base64": embed small images as data URIs (limit configurable; default 100KB).
		 - For attachments that are not images (PDFs, etc.), download and place in assets folder and link to them from the markdown.

5) Output file format per page:
	 - Each page must become one markdown file named per `page_name_template`. Filenames must be sanitized for filesystem compatibility.
	 - Prepend YAML frontmatter with the following fields:
		 - title: original page title
		 - confluence_id: page id
		 - space: space key
		 - confluence_url: canonical URL
		 - version: version number
		 - created_at: ISO timestamp
		 - updated_at: ISO timestamp
		 - author: name or account id
		 - labels: [list]
		 - attachments: [{ name, path_relative, mediaType }]
	 - After frontmatter, include a "source" section that contains a short provenance line: "Exported from Confluence space {space} page {id} on {export_date}".
	 - Then the converted markdown content.

6) Manifest and reports:
	 - Write `export-manifest.json` in `output_dir` listing all exported pages with metadata and file paths.
	 - Write `links-report.json` with unresolved links, mapped links, and any conversion warnings.
	 - Write `errors.log` with any pages skipped and error reasons.

7) Idempotency & safe runs:
	 - If a file already exists, compare Confluence page updated_at with a stored manifest_version; skip or overwrite based on `--force` flag (agent must ask the user if overwrite policy is not provided).
	 - Maintain a lightweight cache of page ids and etags to speed repeated runs.

8) Error handling:
	 - Retry HTTP requests up to 3 times with exponential backoff for 5xx errors and transient network failures.
	 - For 401/403, report authentication failure and stop.
	 - For rate limiting (429), honor Retry-After header.

Output Format (explicit):
- A directory at `output_dir` containing:
	- For each page: `{sanitized-filename}.md` with YAML frontmatter + content.
	- `assets/` subfolders organizing attachments by page id: `assets/<page-id>/...`
	- `export-manifest.json` (JSON array of page metadata and file paths)
	- `links-report.json` (JSON detailing internal link mappings and broken links)
	- `errors.log` (text log)
- All JSON outputs must be machine-parseable (UTF-8, newline-delimited pretty-print).

Examples (start and end markers; placeholders MUST be used):
- Example Input (placeholder):
	- confluence_base_url: [https://yourcompany.atlassian.net/wiki]
	- auth_method: [mcp_credential]
	- scope: { space_keys: ["REQ"], include_labels: ["requirements"], depth: 2 }
	- output_dir: [/tmp/confluence-requirements-export]
- Example Output (one per page):
	- File: `REQ-User-Login-12345.md`
	- YAML frontmatter:
		---
		title: "User Login"
		confluence_id: "12345"
		space: "REQ"
		confluence_url: "https://yourcompany.atlassian.net/wiki/spaces/REQ/pages/12345"
		version: 4
		created_at: "2023-05-01T12:00:00Z"
		updated_at: "2024-02-10T09:30:00Z"
		author: "Jane Doe"
		labels: ["requirements","auth"]
		attachments:
			- name: "login-flow.png"
				path_relative: "assets/12345/login-flow.png"
				mediaType: "image/png"
		---
		Exported from Confluence space REQ page 12345 on 2025-10-28T12:00:00Z
		# User Login
		...

Notes / Edge cases:
- Large pages: if converted markdown exceeds filesystem limits, warn and truncate title-based filename using `{id}` fallback.
- Attachment name collisions: deduplicate by appending numeric suffixes or use UUIDs; record original names in manifest.
- Confluence macros that render dynamic content (e.g., reports): include a placeholder and, when possible, fetch underlying data (e.g., Jira issue keys) to provide stable references.
- If conversion of complex tables or diagrams fails, include both a markdown placeholder and save the original HTML snippet into `assets/<page-id>/raw-<id>.html`.

User prompts & confirmations:
- If required inputs are missing, ask succinct clarifying questions before proceeding (e.g., "Provide Confluence base URL and either page_ids, space_keys, or root_page_id+depth.").
- If overwrite policy is not set and existing files are present, ask: "Existing files detected in {output_dir}. Overwrite? [yes/no/skip/backup]" and wait for explicit confirmation.

Success criteria (how to verify):
- Every requested page produces a `.md` file with YAML frontmatter and valid Markdown body.
- All in-page images and attachments referenced when attachments==true are downloaded into `assets/` and linked relative.
- `export-manifest.json` lists all pages and their output paths.
- `links-report.json` contains zero unresolved internal links (or a clear list if unresolved).
- No unhandled exceptions; all failures logged in `errors.log`.

Performance / Rate-limiting guidance:
- Use pagination and parallelize content fetches moderately (max 5 concurrent requests by default) to avoid rate limits; expose concurrency setting to the caller.

Security:
- Never print or include `auth_credentials` in the exported files or logs.
- Respect any data retention/export policies; if a page is marked restricted, do not export it unless explicit permission is confirmed.

# Output Format
- The agent must return JSON summarizing the run when finished (in addition to writing files). The JSON must include:
	{
		"exported_pages": N,
		"skipped_pages": [ { "id": "...", "reason":"..." } ],
		"output_dir": "[path]",
		"manifest_path": "output_dir/export-manifest.json",
		"links_report_path": "output_dir/links-report.json",
		"errors_log": "output_dir/errors.log",
		"warnings": [ ... ]
	}
- After the JSON summary, print a one-line human-friendly summary.

# Notes
- Always require explicit confirmation before performing write/overwrite actions on the filesystem.
- Favor fidelity of content and provenance over cosmetic formatting changes.
- If the agent cannot perform network calls (no MCP access), it must stop and clearly report that network access is unavailable and list the minimal manual steps to run the export offline (e.g., provide HTML exports to be converted).
- Keep logs structured and machine-readable where possible.
