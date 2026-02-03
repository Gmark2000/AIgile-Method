# Product Owner (PO) Master Validation Checklist

This checklist serves as a comprehensive framework for the Product Owner to validate project plans before development execution. It adapts intelligently based on project type (greenfield vs brownfield) and includes UI/UX considerations when applicable.

[[LLM: INITIALIZATION INSTRUCTIONS - PO MASTER CHECKLIST

PROJECT TYPE DETECTION:
First, determine the project type by checking:

1. Is this a GREENFIELD project (new from scratch)?
   - Look for: New project initialization, no existing codebase references
   - Check for: prd.md, architecture.md, new project setup stories

2. Is this a BROWNFIELD project (enhancing existing system)?
   - Look for: References to existing codebase, enhancement/modification language
   - Check for: brownfield-prd.md, brownfield-architecture.md, existing system analysis

3. Does the project include UI/UX components?
   - Check for: frontend-architecture.md, UI/UX specifications, design files
   - Look for: Frontend stories, component specifications, user interface mentions

DOCUMENT REQUIREMENTS:
Based on project type, ensure you have access to:

For GREENFIELD projects:
- prd.md - The Product Requirements Document
- architecture.md - The system architecture
- frontend-architecture.md - If UI/UX is involved
- All epic and story definitions

For BROWNFIELD projects:
- brownfield-prd.md - The brownfield enhancement requirements
- brownfield-architecture.md - The enhancement architecture
- Existing project codebase access (CRITICAL - cannot proceed without this)
- Current deployment configuration and infrastructure details

SKIP INSTRUCTIONS:
- Skip sections marked [[BROWNFIELD ONLY]] for greenfield projects
- Skip sections marked [[GREENFIELD ONLY]] for brownfield projects
- Skip sections marked [[UI/UX ONLY]] for backend-only projects
- Note all skipped sections in your final report

VALIDATION APPROACH:
1. Deep Analysis - Thoroughly analyze each item against documentation
2. Evidence-Based - Cite specific sections when validating
3. Critical Thinking - Question assumptions and identify gaps
4. Risk Assessment - Consider what could go wrong with each decision

EXECUTION MODE:
Ask the user if they want to work through the checklist:
- Section by section (interactive mode) - Review each section, get confirmation before proceeding
- All at once (comprehensive mode) - Complete full analysis and present report at end]]

## 1. PROJECT SETUP & INITIALIZATION

[[LLM: Project setup is the foundation. For greenfield, ensure clean start. For brownfield, ensure safe integration with existing system. Verify setup matches project type.]]

### 1.1 Project Scaffolding [[GREENFIELD ONLY]]

- [ ] Epic 1 includes explicit steps for project creation/initialization
- [ ] If using a starter template, steps for cloning/setup are included
- [ ] If building from scratch, all necessary scaffolding steps are defined
- [ ] Initial README or documentation setup is included
- [ ] Repository setup and initial commit processes are defined

### 1.2 Existing System Integration [[BROWNFIELD ONLY]]

- [ ] Existing project analysis has been completed and documented
- [ ] Integration points with current system are identified
- [ ] Development environment preserves existing functionality
- [ ] Local testing approach validated for existing features
- [ ] Rollback procedures defined for each integration point

### 1.3 Development Environment

- [ ] Local development environment setup is clearly defined
- [ ] Required tools and versions are specified
- [ ] Steps for installing dependencies are included
- [ ] Configuration files are addressed appropriately
- [ ] Development server setup is included

### 1.4 Core Dependencies

- [ ] All critical packages/libraries are installed early
- [ ] Package management is properly addressed
- [ ] Version specifications are appropriately defined
- [ ] Dependency conflicts or special requirements are noted
- [ ] [[BROWNFIELD ONLY]] Version compatibility with existing stack verified

## 2. INFRASTRUCTURE & DEPLOYMENT

[[LLM: Infrastructure must exist before use. For brownfield, must integrate with existing infrastructure without breaking it.]]

### 2.1 Database & Data Store Setup

- [ ] Database selection/setup occurs before any operations
- [ ] Schema definitions are created before data operations
- [ ] Migration strategies are defined if applicable
- [ ] Seed data or initial data setup is included if needed
- [ ] [[BROWNFIELD ONLY]] Database migration risks identified and mitigated
- [ ] [[BROWNFIELD ONLY]] Backward compatibility ensured

### 2.2 API & Service Configuration

- [ ] API frameworks are set up before implementing endpoints
- [ ] Service architecture is established before implementing services
- [ ] Authentication framework is set up before protected routes
- [ ] Middleware and common utilities are created before use
- [ ] [[BROWNFIELD ONLY]] API compatibility with existing system maintained
- [ ] [[BROWNFIELD ONLY]] Integration with existing authentication preserved

### 2.3 Deployment Pipeline

- [ ] CI/CD pipeline is established before deployment actions
- [ ] Infrastructure as Code (IaC) is set up before use
- [ ] Environment configurations are defined early
- [ ] Deployment strategies are defined before implementation
- [ ] [[BROWNFIELD ONLY]] Deployment minimizes downtime
- [ ] [[BROWNFIELD ONLY]] Blue-green or canary deployment implemented

### 2.4 Testing Infrastructure

- [ ] Testing frameworks are installed before writing tests
- [ ] Test environment setup precedes test implementation
- [ ] Mock services or data are defined before testing
- [ ] [[BROWNFIELD ONLY]] Regression testing covers existing functionality
- [ ] [[BROWNFIELD ONLY]] Integration testing validates new-to-existing connections

## 3. EXTERNAL DEPENDENCIES & INTEGRATIONS

[[LLM: External dependencies often block progress. For brownfield, ensure new dependencies don't conflict with existing ones.]]

### 3.1 Third-Party Services

- [ ] Account creation steps are identified for required services
- [ ] API key acquisition processes are defined
- [ ] Steps for securely storing credentials are included
- [ ] Fallback or offline development options are considered
- [ ] [[BROWNFIELD ONLY]] Compatibility with existing services verified
- [ ] [[BROWNFIELD ONLY]] Impact on existing integrations assessed

### 3.2 External APIs

- [ ] Integration points with external APIs are clearly identified
- [ ] Authentication with external services is properly sequenced
- [ ] API limits or constraints are acknowledged
- [ ] Backup strategies for API failures are considered
- [ ] [[BROWNFIELD ONLY]] Existing API dependencies maintained

### 3.3 Infrastructure Services

- [ ] Cloud resource provisioning is properly sequenced
- [ ] DNS or domain registration needs are identified
- [ ] Email or messaging service setup is included if needed
- [ ] CDN or static asset hosting setup precedes their use
- [ ] [[BROWNFIELD ONLY]] Existing infrastructure services preserved

## 4. UI/UX CONSIDERATIONS [[UI/UX ONLY]]

[[LLM: Only evaluate this section if the project includes user interface components. Skip entirely for backend-only projects.]]

### 4.1 Design System Setup

- [ ] UI framework and libraries are selected and installed early
- [ ] Design system or component library is established
- [ ] Styling approach (CSS modules, styled-components, etc.) is defined
- [ ] Responsive design strategy is established
- [ ] Accessibility requirements are defined upfront

### 4.2 Frontend Infrastructure

- [ ] Frontend build pipeline is configured before development
- [ ] Asset optimization strategy is defined
- [ ] Frontend testing framework is set up
- [ ] Component development workflow is established
- [ ] [[BROWNFIELD ONLY]] UI consistency with existing system maintained

### 4.3 User Experience Flow

- [ ] User journeys are mapped before implementation
- [ ] Navigation patterns are defined early
- [ ] Error states and loading states are planned
- [ ] Form validation patterns are established
- [ ] [[BROWNFIELD ONLY]] Existing user workflows preserved or migrated

## 5. USER/AGENT RESPONSIBILITY

[[LLM: Clear ownership prevents confusion. Ensure tasks are assigned appropriately based on what only humans can do.]]

### 5.1 User Actions

- [ ] User responsibilities limited to human-only tasks
- [ ] Account creation on external services assigned to users
- [ ] Purchasing or payment actions assigned to users
- [ ] Credential provision appropriately assigned to users

### 5.2 Developer Agent Actions

- [ ] All code-related tasks assigned to developer agents
- [ ] Automated processes identified as agent responsibilities
- [ ] Configuration management properly assigned
- [ ] Testing and validation assigned to appropriate agents

## 6. FEATURE SEQUENCING & DEPENDENCIES

[[LLM: Dependencies create the critical path. For brownfield, ensure new features don't break existing ones.]]

### 6.1 Functional Dependencies

- [ ] Features depending on others are sequenced correctly
- [ ] Shared components are built before their use
- [ ] API endpoints are created before frontend consumption
- [ ] Database schemas are established before data operations
- [ ] Authentication is set up before protected features

### 6.2 Epic Sequencing

- [ ] Epic dependencies are clearly mapped
- [ ] Epic sequence supports incremental value delivery
- [ ] High-risk or complex epics are appropriately positioned
- [ ] Learning and validation opportunities are maximized
- [ ] [[BROWNFIELD ONLY]] Integration complexity is managed across epics

### 6.3 Story Dependencies

- [ ] Cross-story dependencies are identified and documented
- [ ] Stories within epics are appropriately sequenced
- [ ] Blocking dependencies are highlighted
- [ ] Optional dependencies are clearly marked
- [ ] Circular dependencies are avoided

## 7. QUALITY & VALIDATION

[[LLM: Quality gates ensure we ship working software. For brownfield, ensure we don't break what's working.]]

### 7.1 Testing Strategy

- [ ] Testing approach is defined for each story type
- [ ] Unit testing requirements are clear
- [ ] Integration testing approach is specified
- [ ] End-to-end testing strategy is defined (if applicable)
- [ ] [[BROWNFIELD ONLY]] Regression testing covers critical paths

### 7.2 Quality Gates

- [ ] Definition of done criteria are established
- [ ] Code review processes are defined
- [ ] Automated quality checks are specified
- [ ] Performance benchmarks are established (if applicable)
- [ ] Security validation requirements are defined

### 7.3 Acceptance Criteria

- [ ] All stories have clear acceptance criteria
- [ ] Acceptance criteria are testable and specific
- [ ] Edge cases are addressed in acceptance criteria
- [ ] Error handling requirements are specified
- [ ] Performance criteria are included where relevant

## FINAL PO VALIDATION

[[LLM: FINAL PO VALIDATION REPORT

After completing the checklist, provide a comprehensive validation report:

1. Project Readiness
   - Overall readiness: READY / NEEDS REVISION / BLOCKED
   - Risk level: LOW / MEDIUM / HIGH
   - Complexity assessment: SIMPLE / MODERATE / COMPLEX

2. Critical Issues (if any)
   - List any items that MUST be resolved before development
   - Specify the impact of each issue
   - Recommend specific actions

3. Epic & Story Assessment
   - Are epics properly sequenced?
   - Are stories sufficiently detailed?
   - Are dependencies clear and manageable?

4. Recommendations
   - Suggested improvements or optimizations
   - Areas requiring special attention during development
   - Risk mitigation strategies

Be thorough but practical - perfect planning doesn't exist, but the plan must be sufficient for successful execution.]]

- [ ] All critical project components have been validated
- [ ] Epic and story structure supports successful delivery
- [ ] Dependencies are identified and manageable
- [ ] Quality gates are established and appropriate
