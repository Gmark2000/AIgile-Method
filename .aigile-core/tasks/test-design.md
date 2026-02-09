<!-- Based on BMAD test-design; simplified for AIgile -->

# QA Task: Test Design

Create comprehensive test scenarios with appropriate test level recommendations for story implementation.

## Inputs

```yaml
required:
	- story_id: '{epic}.{story}' # e.g., "1.3"
	- story_path: '{devStoryLocation}/{epic}.{story}.*.md' # From core-config.yaml
optional:
	- story_title: '{title}'
	- story_slug: '{slug}'
```

## Process (Sequential)

1. Analyze Story Requirements
	 - Break down each acceptance criterion (AC) into testable behaviors
	 - Identify error paths and boundary cases per AC
2. Choose Test Levels
	 - Unit: pure logic and deterministic behaviors
	 - Integration: module/service interactions, DB/IO boundaries
	 - E2E: core user journeys and compliance flows
3. Assign Priorities (Risk-Based)
	 - P0: security, payments, data loss, revenue-critical
	 - P1: core flows used daily
	 - P2: secondary flows/admin
4. Design Scenarios
	 - For each AC, produce 1+ scenarios with: ID, level, priority, description, justification
	 - Ensure at least one negative case and one boundary case overall
5. Validate Coverage
	 - Every AC has coverage; no redundant testing across levels
	 - Critical flows have multiple levels where helpful

## Outputs

### Output 1: Test Design Summary

- Scenario table grouped by AC with level and priority
- Recommended execution order (P0s first, then P1, etc.)
- Gaps list (if any) and suggested remediation

### Output 2: Gate YAML Block (for QA Gate)

```yaml
test_design:
	scenarios_total: X
	by_level:
		unit: Y
		integration: Z
		e2e: W
	by_priority:
		p0: A
		p1: B
		p2: C
	coverage_gaps: []
```

## Quality Checklist

- [ ] Each AC has at least one scenario
- [ ] Levels chosen match the risk and behavior
- [ ] Includes at least one negative and one boundary case
- [ ] No duplicated coverage across levels
- [ ] IDs follow `{epic}.{story}-{LEVEL}-{SEQ}`
