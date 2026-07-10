# Commit Messages

## Trigger
When creating commits or writing commit messages

## Instructions
- Format: conventional commits
  type(scope): short description
- Types: feat, fix, refactor, test, docs, chore, perf
- Scope: the module or feature area (e.g. auth, api, ui)
- Description: imperative mood, lowercase start, no period
- Maximum 72 characters total in subject line
- Body (if needed): blank line after subject, wrap at 72 chars,
  explain WHY not WHAT

## Constraints
- Never use these commit messages: 
  "update", "fix", "changes", "misc", "WIP", "various improvements", "minor fixes"
- Never include file lists in the commit subject line 
- If the change touches more than 3 unrelated areas, split it into seperate commits

## Example 
Bad: Updated user stuff and fixed some bugs
Good: fix(auth): reject expired refresh tokens on renewal