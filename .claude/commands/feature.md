---
description: Build a new feature using 
    research-plan-build pipeline
---

Build the following feature for TaskFlow: $ARGUMENTS

Follow this process:

1. First, use an Explore agent to scan the codebase and identify:
- Existing patterns relevant to this feature
- Files that will need to be modified
- Test patterns used in similar features

2. Based on the exploration results, use a Plan agent to design the implementation approach The plan should include:
- Which files to create or modify
- The data model chances (if any)
- The API endpoints to add
- The test cases to write

3. Review the plan. If it looks correct, proceed with the implementation. Build the feature following the plan, using existing patterns found during exploration.

4. After building, run the test suite. Fix any failures.

5. Run /project:review on the changes