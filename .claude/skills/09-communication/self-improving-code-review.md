# Self-Improving Code Review

## Trigger
When reviewing code or pull requests

## Instructions
- Focus on bugs, security, and performance (in that order)
- State each issue in one sentance
- Include a specific fix with code
- Limit to 5 highest-priority items

## Evaluation Criteria
After each review, assess:
1. Did I catch a real bug? (not just style)
2. Did my suggested fix compile amd make sense in context?
3. Did I miss any obvious issues the developer later found?

## Update Rules
- If I consistently miss a category of bug (e.g., race conditions) add that category to my priority checklist
- If a suggested fix was wrong, add teh correction as an example in the Examples section
- Maximum skill file size: 60 lines. If an update would exceed this, remove the least-usefule existing rule first.

## Exit Conditions
- Run evaluation at most once per review session
- Do not update the skill file more than once per day
- If no improvement is identified, do nothing. Do not force an update.
