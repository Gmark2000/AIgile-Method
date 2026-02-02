# Security Policy

## Reporting a Vulnerability
If you believe you've found a security issue or a sensitive data exposure risk, please report it privately:

- Open a GitHub issue with the "security" label, or
- Contact the maintainer via GitHub
- Do not open a public issue with detailed vulnerability information.

Provide as much detail as possible:
- Description of the issue and potential impact
- Steps to reproduce
- Affected files or configurations (if known)
- Any logs or screenshots that can help us reproduce

We will acknowledge receipt within 3 business days and provide an estimated timeline for remediation.

## Handling Sensitive Information
- Never commit secrets (tokens, API keys, passwords) to the repository.
- Use environment variables or your IDE's MCP secret store.
- Redact internal URLs and personal data in examples.

## Supported Versions
This is a content-first project. Security issues generally relate to CLI packaging or MCP configuration notes; we aim to backport critical fixes to the latest minor release.
