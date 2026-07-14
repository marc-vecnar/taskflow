#!/usr/bin/env bash
# PreToolUse hook: block Write/Edit/MultiEdit when the incoming file content
# contains anything that looks like a credential.
#
# Reads the hook payload as JSON on stdin, extracts the text that would be
# written to disk (differs per tool), and greps it for credential keywords.
# On a match it emits a PreToolUse "deny" decision so the operation never runs.

set -euo pipefail

input="$(cat)"

# Collect the text that this tool would introduce into the file:
#   Write     -> .tool_input.content
#   Edit      -> .tool_input.new_string
#   MultiEdit -> every .tool_input.edits[].new_string
content="$(printf '%s' "$input" | jq -r '
  .tool_input as $ti
  | [ $ti.content, $ti.new_string, ($ti.edits[]?.new_string) ]
  | map(select(. != null))
  | join("\n")
')"

# Case-sensitive match on the exact keywords requested.
pattern='API_KEY|SECRET|PASSWORD|PRIVATE_KEY'

if printf '%s' "$content" | grep -qE "$pattern"; then
  matched="$(printf '%s' "$content" | grep -oE "$pattern" | sort -u | paste -sd', ' -)"
  file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // "the file"')"
  reason="Blocked: content written to ${file} contains credential-like token(s): ${matched}. Remove the secret (use an env var / .env instead) and retry."

  # permissionDecision "deny" stops the tool; systemMessage surfaces the warning.
  jq -n --arg reason "$reason" '{
    systemMessage: ("⛔ Credential scan blocked this write. " + $reason),
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

exit 0
