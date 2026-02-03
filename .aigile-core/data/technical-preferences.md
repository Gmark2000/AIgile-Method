# Technical Preferences (Organization Profile)

Purpose: a single source of truth for default technology choices, standards, and guardrails. Agents use this to bias recommendations and templates. Teams may override with project-specific addenda.

Update policy: treat this like a living ADR. Keep concise and actionable.

## Frontend
- Primary frameworks: [...]
- Language/TS policy: [...]
- Testing: Unit (e.g., Vitest/Jest), Component (e.g., Testing Library), E2E (e.g., Playwright)
- Documentation: Storybook/MDX preferred; architecture decisions recorded under docs/architecture.
- Accessibility: WCAG 2.2 AA baseline; axe checks in CI.

## Backend
- Languages/runtimes: [...]
- Frameworks: [...]
- Service style: Prefer modular monolith → move to microservices when justified by scale/team topology.
- API: REST first; GraphQL by exception (document rationale); gRPC for internal high-throughput services.
- AuthN/Z: Centralized via SSO/IAM; zero trust principles.

## Data
- Primary databases: [...]
- Caching/message bus: [...]
- Object storage: [...]
- Migration/versioning: [...]
- Backup/restore objectives: RPO/RTO targets [...]

## CI/CD
- CI: [...]
- Strategy: trunk-based with feature flags; short-lived branches; protected main.
- Quality gates: lint, unit, integration, security scan before merge; release validation suite before deploy.

## Cloud & Infra
- Target environments: [...]
- IaC: [...]; environments as code; immutable artifacts.
- Secrets: central secret manager; never in repo; rotate quarterly.

## Observability
- Logging/metrics/tracing stack: [...]
- SLOs/SLIs: define for top user journeys; alert on burn rate.

## Security
- Baseline: OWASP ASVS Level 2; OWASP Top 10 policy in CI.
- SSO/IAM: [...]; least privilege; periodic access reviews.

## Anti-patterns to avoid
- Accidental polyglot without ownership; bespoke frameworks; duplicated CI pipelines per repo.

## How agents use this file
- Architect: bias solution options and ADRs; reference in architecture-tmpl sections.
- Dev/QA: reference for test tooling and gates.
- PO/PM: use to set non-functional acceptance criteria.
