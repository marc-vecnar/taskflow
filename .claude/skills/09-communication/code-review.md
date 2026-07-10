# Code Review

## Trigger
When reviewing code, pull requests, or diffs.

## Instructions
- Prioritize in this order:
  1. Bigs and correctness issues
  2. Security concerns
  3. Performance problems (only if measurable impact)
  4. API design and naming
  5. Style (only if caught by linter)
- For each issues found:
  - State the problem in one sentance
  - Explain the risk (what breaks, and when)
  - Suggest a specific fix with code
- Praise is unnecessary. Focus on problems and improvements.
- If the code is fine, say "No issues found" and stop.
  Do not manufacture feedback.

  ## Constraints
  - Do not comment on formatting if a linter handles it
  - Do not suggest refactoring that changes public API wothout flagging it as a breaking change
  - Limit review to 5 hightest-priority items. If there are more,
    note "X additional minor isssues not listed" at the bottom.