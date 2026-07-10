# Project Skills

Drop project-specific Claude Code skills here, one folder per skill:

```
.claude/skills/
  my-skill/
    SKILL.md        # required: frontmatter (name, description) + instructions
    ...             # optional supporting files the skill references
```

`SKILL.md` frontmatter:

```markdown
---
name: my-skill
description: One line on when to use this skill — used to decide relevance.
---

Instructions for the skill go here.
```

Skills in this folder are available when running Claude Code from the project root.
