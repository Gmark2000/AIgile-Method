# Web Agent Bundle Instructions

This header is included at the top of each generated AIgile bundle (team and per-agent) to provide context for downstream tooling and validation.

Purpose:
- Identify the file as a structured AIgile bundle
- Provide quick usage guidance
- Ensure automated validators can assert presence (looks for the phrase: Web Agent Bundle Instructions)

Usage Guidance:
1. Each subsequent section is wrapped with START/END markers of the form:
   ==================== START: .aigile-core/<relative-path> ====================
   (content)
   ==================== END: .aigile-core/<relative-path> ====================
2. Tools parsing this file should iterate over marker pairs to reconstruct original source files under `.aigile-core/`.
3. Do not edit marker lines manually—regenerate bundles instead (`npm run build`).
4. Additional metadata or future headers can be appended below this notice.

Notes:
- Missing this header triggers validation failure.
- Keep this concise; large instructions inflate bundle size.
