# Architect Solution Validation Checklist

This checklist serves as a comprehensive framework for the Architect to validate the technical design and architecture before development execution. The Architect should systematically work through each item, ensuring the architecture is robust, scalable, secure, and aligned with the product requirements.

[[LLM: INITIALIZATION INSTRUCTIONS - REQUIRED ARTIFACTS

Before proceeding with this checklist, ensure you have access to:

1. architecture.md - The primary architecture document (check docs/architecture.md)
2. prd.md - Product Requirements Document for requirements alignment (check docs/prd.md)
3. frontend-architecture.md or fe-architecture.md - If this is a UI project (check docs/frontend-architecture.md)
4. Any system diagrams referenced in the architecture
5. API documentation if available
6. Technology stack details and version specifications

IMPORTANT: If any required documents are missing or inaccessible, immediately ask the user for their location or content before proceeding.

PROJECT TYPE DETECTION:
First, determine the project type by checking:

- Does the architecture include a frontend/UI component?
- Is there a frontend-architecture.md document?
- Does the PRD mention user interfaces or frontend requirements?

If this is a backend-only or service-only project:

- Skip sections marked with [[FRONTEND ONLY]]
- Focus extra attention on API design, service architecture, and integration patterns
- Note in your final report that frontend sections were skipped due to project type

VALIDATION APPROACH:
For each section, you must:

1. Deep Analysis - Don't just check boxes, thoroughly analyze each item against the provided documentation
2. Evidence-Based - Cite specific sections or quotes from the documents when validating
3. Critical Thinking - Question assumptions and identify gaps, not just confirm what's present
4. Risk Assessment - Consider what could go wrong with each architectural decision

EXECUTION MODE:
Ask the user if they want to work through the checklist:

- Section by section (interactive mode) - Review each section, present findings, get confirmation before proceeding
- All at once (comprehensive mode) - Complete full analysis and present comprehensive report at end]]

## 1. REQUIREMENTS ALIGNMENT

[[LLM: Before evaluating this section, take a moment to fully understand the product's purpose and goals from the PRD. What is the core problem being solved? Who are the users? What are the critical success factors? Keep these in mind as you validate alignment. For each item, don't just check if it's mentioned - verify that the architecture provides a concrete technical solution.]]

### 1.1 Functional Requirements Coverage

- [ ] Architecture supports all functional requirements in the PRD
- [ ] Technical approaches for all epics and stories are addressed
- [ ] Edge cases and performance scenarios are considered
- [ ] All required integrations are accounted for
- [ ] User journeys are supported by the technical architecture

### 1.2 Non-Functional Requirements Alignment

- [ ] Performance requirements are addressed with specific solutions
- [ ] Scalability considerations are documented with approach
- [ ] Security requirements have corresponding technical controls
- [ ] Reliability and resilience approaches are defined
- [ ] Compliance requirements have technical implementations

### 1.3 Technical Constraints Adherence

- [ ] All technical constraints from PRD are satisfied
- [ ] Platform/language requirements are followed
- [ ] Infrastructure constraints are accommodated
- [ ] Third-party service constraints are addressed
- [ ] Organizational technical standards are followed

## 2. ARCHITECTURE FUNDAMENTALS

[[LLM: Architecture clarity is crucial for successful implementation. As you review this section, visualize the system as if you were explaining it to a new developer. Are there any ambiguities that could lead to misinterpretation? Would an AI agent be able to implement this architecture without confusion? Look for specific diagrams, component definitions, and clear interaction patterns.]]

### 2.1 Architecture Clarity

- [ ] Architecture is documented with clear diagrams
- [ ] Major components and their responsibilities are defined
- [ ] Component interactions and dependencies are mapped
- [ ] Data flows are clearly illustrated
- [ ] Technology choices for each component are specified

### 2.2 Separation of Concerns

- [ ] Clear boundaries between UI, business logic, and data layers
- [ ] Responsibilities are cleanly divided between components
- [ ] Interfaces between components are well-defined
- [ ] Components adhere to single responsibility principle
- [ ] Cross-cutting concerns (logging, auth, etc.) are properly addressed

### 2.3 Design Patterns & Best Practices

- [ ] Appropriate design patterns are employed
- [ ] Industry best practices are followed
- [ ] Anti-patterns are avoided
- [ ] Consistent architectural style throughout
- [ ] Pattern usage is documented and explained

### 2.4 Modularity & Maintainability

- [ ] System is divided into cohesive, loosely-coupled modules
- [ ] Components can be developed and tested independently
- [ ] Changes can be localized to specific components
- [ ] Code organization promotes discoverability
- [ ] Architecture specifically designed for AI agent implementation

## 3. TECHNICAL STACK & DECISIONS

[[LLM: Technology choices have long-term implications. For each technology decision, consider: Is this the simplest solution that could work? Are we over-engineering? Will this scale? What are the maintenance implications? Are there security vulnerabilities in the chosen versions? Verify that specific versions are defined, not ranges.]]

### 3.1 Technology Selection

- [ ] Selected technologies meet all requirements
- [ ] Technology versions are specifically defined (not ranges)
- [ ] Technology choices are justified with clear rationale
- [ ] Alternatives considered are documented with pros/cons
- [ ] Selected stack components work well together

### 3.2 Frontend Architecture [[FRONTEND ONLY]]

[[LLM: Skip this entire section if this is a backend-only or service-only project. Only evaluate if the project includes a user interface.]]

- [ ] UI framework and libraries are specifically selected
- [ ] State management approach is defined
- [ ] Component structure and organization is specified
- [ ] Responsive/adaptive design approach is outlined
- [ ] Build and bundling strategy is determined

### 3.3 Backend Architecture

- [ ] API design and standards are defined
- [ ] Service organization and boundaries are clear
- [ ] Authentication and authorization approach is specified
- [ ] Error handling strategy is outlined
- [ ] Backend scaling approach is defined

### 3.4 Data Architecture

- [ ] Data models are fully defined
- [ ] Database technologies are selected with justification
- [ ] Data access patterns are documented
- [ ] Data migration/seeding approach is specified
- [ ] Data backup and recovery strategies are outlined

## 4. SECURITY & COMPLIANCE

[[LLM: Security cannot be an afterthought. For each security consideration, think: What could go wrong? How would an attacker exploit this? Are we following security best practices? Have we considered all attack vectors?]]

### 4.1 Security Controls

- [ ] Authentication mechanisms are properly designed
- [ ] Authorization controls are comprehensive and granular
- [ ] Data encryption at rest and in transit is addressed
- [ ] Input validation and sanitization approaches are defined
- [ ] Security headers and protections are specified

### 4.2 Data Protection

- [ ] Sensitive data handling procedures are defined
- [ ] Data privacy requirements are met
- [ ] Data retention and deletion policies are addressed
- [ ] Audit trails and logging approaches are specified
- [ ] Compliance requirements are satisfied

## 5. PERFORMANCE & SCALABILITY

[[LLM: Performance affects user experience and operational costs. Consider: What are the bottlenecks? How will this perform under load? What are the scaling limits? Are we optimizing the right things?]]

### 5.1 Performance Considerations

- [ ] Performance requirements are quantified and addressed
- [ ] Caching strategies are defined where appropriate
- [ ] Database optimization approaches are specified
- [ ] Asset optimization strategies are outlined
- [ ] Performance monitoring approaches are defined

### 5.2 Scalability Design

- [ ] Horizontal scaling approaches are documented
- [ ] Load balancing strategies are defined
- [ ] Resource scaling triggers and approaches are specified
- [ ] Database scaling considerations are addressed
- [ ] Microservices boundaries are appropriate (if applicable)

## 6. OPERATIONAL READINESS

[[LLM: The system must be operable in production. Consider: How will we deploy this? How will we monitor it? What happens when things go wrong? Can we recover from failures?]]

### 6.1 Deployment & Infrastructure

- [ ] Deployment strategies are clearly defined
- [ ] Infrastructure requirements are documented
- [ ] Environment configuration management is addressed
- [ ] Container/orchestration strategies are specified (if applicable)
- [ ] Infrastructure as Code approaches are outlined

### 6.2 Monitoring & Observability

- [ ] Logging strategies and standards are defined
- [ ] Metrics collection and monitoring approaches are specified
- [ ] Alerting strategies are documented
- [ ] Troubleshooting and debugging approaches are outlined
- [ ] Health check and status monitoring is addressed

### 6.3 Reliability & Recovery

- [ ] Backup and disaster recovery procedures are defined
- [ ] Fault tolerance and resilience strategies are specified
- [ ] Circuit breaker and retry patterns are implemented
- [ ] Rollback procedures are documented
- [ ] Service level objectives (SLOs) are defined

## FINAL VALIDATION

[[LLM: FINAL ARCHITECTURE VALIDATION REPORT

After completing the checklist, provide a comprehensive validation report:

1. Overall Assessment
   - Architecture readiness: APPROVED / NEEDS REVISION / BLOCKED
   - Risk level: LOW / MEDIUM / HIGH
   - Implementation complexity: SIMPLE / MODERATE / COMPLEX

2. Critical Issues (if any)
   - List any items that MUST be resolved before implementation
   - Specify the impact of each issue
   - Recommend specific actions

3. Recommendations
   - Suggested improvements or optimizations
   - Areas requiring special attention during implementation
   - Technical debt considerations

4. Implementation Readiness
   - Can development begin with current architecture?
   - What additional documentation is needed?
   - Are there any blocking dependencies?

Be thorough but practical - perfect architecture doesn't exist, but it must be sufficient for successful implementation.]]

- [ ] All critical architecture components have been validated
- [ ] Risk assessment completed for major decisions
- [ ] Architecture aligns with project goals and constraints
- [ ] Implementation guidance is sufficient for development team
