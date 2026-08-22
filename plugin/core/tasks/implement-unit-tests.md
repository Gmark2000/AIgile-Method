<!-- BMAD-style unit test implementation guidance -->

# Dev Task: Implement Unit Tests

Add or improve unit tests for a module/feature to lock behavior and reduce regressions.

## Inputs

```yaml
required:
  - pathOrScope: 'src/module' | 'src/utils/date.ts'
```

## Process (Sequential)

1. Identify Behaviors and Edge Cases
   - Enumerate Given/When/Then scenarios and invariants
2. Follow Project Conventions
   - Test framework, directory structure, naming
3. Write Tests
   - Happy path, at least one negative, boundary cases
   - Stub/mock external services; keep deterministic
4. Run and Iterate
   - Make tests fast; avoid global state; ensure isolation
5. Coverage as a Guide
   - Prioritize critical logic over line count
6. Document Results
   - Short summary of covered scenarios and intentional exclusions

## Outputs

- New/updated tests with passing state
- Brief test plan summary for story or module docs

## Checklist

- [ ] Deterministic (no network/time flakiness; use fakes)
- [ ] Clear AAA structure and naming
- [ ] Fast execution; no leaks
- [ ] Edge cases included

## Examples

- price-module → rounding, currency edge cases, invalid inputs
- orders-service → retry backoff and cancellation
