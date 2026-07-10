# README Standards

## Trigger
When reviewing changes to exported functions.

## Instructions
- Compare hthe current README.md API section with teh exported functions in the changed files
- Flag any function that was added, removed, or had its signature changed but is not reflected in teh README
- Suggest specific README edits with the exact markdown to add or update.

## Constraints
- Only check exported/public functions
- Do not rewrite the entire README, only flag differences
- Do not suggest changes for internal helper functions
