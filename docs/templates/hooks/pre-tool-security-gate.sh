#!/usr/bin/env bash
# harness-boot: PreToolUse(Bash) hook
# Blocks destructive commands and secret-file access. Language-independent.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[[ "$TOOL" != "Bash" ]] && exit 0
[[ -z "$COMMAND" ]] && exit 0

block() {
  echo "BLOCKED by security-gate: $1" >&2
  echo "Command: $COMMAND" >&2
  exit 2
}

# Destructive filesystem operations
echo "$COMMAND" | grep -qE '(^|[[:space:]])rm[[:space:]]+(-[A-Za-z]*[rRf][A-Za-z]*[[:space:]]+)+/($|[[:space:]])' \
  && block "rm -rf / (or equivalent root wipe)"

echo "$COMMAND" | grep -qE 'git[[:space:]]+push[[:space:]]+.*(--force|-f([[:space:]]|$))' \
  && echo "$COMMAND" | grep -qE '(main|master|release|prod)' \
  && block "git push --force to protected branch"

# Pipe-to-shell
echo "$COMMAND" | grep -qE '(curl|wget)[[:space:]].*\|[[:space:]]*(sh|bash|zsh)' \
  && block "curl|sh or wget|sh (remote code execution)"

# Secret file access (generic patterns + language-specific patterns appended by /setup)
echo "$COMMAND" | grep -qE '(cat|less|more|head|tail|vim|nano|emacs)[[:space:]]+.*\.env($|[[:space:]]|\.)' \
  && block ".env file access"

echo "$COMMAND" | grep -qE '(cat|less|more|head|tail|vim|nano|emacs)[[:space:]]+.*(credentials\.json|id_rsa|\.pem|\.key($|[[:space:]]))' \
  && block "secret/credentials file access"

# History/shell dotfile tampering
echo "$COMMAND" | grep -qE '(rm|mv|>|>>)[[:space:]]+.*\.(bash_history|zsh_history|bashrc|zshrc|profile)' \
  && block "shell history/config tampering"

exit 0
