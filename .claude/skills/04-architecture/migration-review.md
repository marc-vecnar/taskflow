# Migration Review

## Trigger
When reviewing database migration files.

## Insrtuctions
- Compare the migration SQL against the current database schema (available via the project-db MCP server)
- Check for: missing indexes on foreign key, columns that should have NOT NULL but don't, breaking changes to existing columns
- Flag any migration that drops a column without a data migration plan
- Verify that tghe migration has a corresponding down/rollback script

## Constraints
- Do not suggest schema changes beyond what the migration intends
- Do not run the migration. Only review it.