---
description: Run a focused code review on recent changes
---

Review the staged changes in this project. Check for: 
1. Type safety issues (any 'any' types that should be specific)
2. Error handling (uncaught promises, missing try/catch)
3. Test coverage (new functions without corresponding tests)
4. Secutiry (user input reaching queries without validation)


Show findings as a numbered list with file:line references.

If everything looks clean, say so in one sentance.