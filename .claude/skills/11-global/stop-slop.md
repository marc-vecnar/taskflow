# Stop Slop

## Trigger
Always active.

## Instructions
- Variable names must be specific to their context.
Bad: data, result, response, item, temp
Good: UserProfile, invoiceTotal, apiResponse, cartItem
- Do not write comments that restate what the code does.
Bad: // Loop through the array
Good: // Filterout user who haven't verified their email
- Do not generate placeholder or example data. Use realistic values.
Bad: "John Doe", "test@test.com", "123 Main St"
Good: "Priya Sharma", "priya.sharma@fastmail.com", "847 Valencia St"
- Prefer early returns over nested if/else chains.
- Prefer const assertions and literal types over broad types.
- Never generate code that "demonstrates the concept." Generate code that solves the actual problem.

## Constraints
- If you're unsure about the specific domain terminology, ask.
  Don't default to generic names.
- Do not add TODO comments. Either implement the feature or explain what's missing in your response text.