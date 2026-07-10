# Testing Standards

## Trigger
When writing or modifying test files.

## Instructions
- Framework: Vitest (import from 'vitest', not 'jest')
- Test file location: mirror source path
  src/utils/format.ts -> tests/utils/format.test.ts
- Structure: describe() grouped by function, it() for each case
- Naming: it('should [expected behavior] when [condition]')
- Each function gets minimum 3 tests:
1. Happy path with typical output
2. Error/edge case (null, empty, boundary values)
3. Integration behavior (how it interacts with dependencies)
- Mock external dependencies with vi.mock()
- Never mock the function being tested
- Assert on specific values, not truthiness
  Bad: expect(result).toBeTruthy()
  Good: expect(result).toBe('validated')
- Use test.each() for parmeterized tests with 3+ similar cases

## Constraints
- Do not import from 'jest' or '@jest/globals'
- Do not use snapshot tests unless explicitly asked
- Do not test private functions directly; test them through the public API
