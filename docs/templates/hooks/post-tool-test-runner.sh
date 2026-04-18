#!/usr/bin/env bash
# harness-boot: PostToolUse(Write|Edit) hook
# Runs the test suite scoped to the edited file's module.
# Extension-dispatched; non-blocking (passes result to agent).
set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE" ]] && exit 0

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PROJECT_ROOT"

case "$FILE" in
  *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.spec.ts|*.spec.tsx|*.spec.js|*.spec.jsx)
    if [[ -f package.json ]]; then
      if jq -e '.devDependencies.vitest // .dependencies.vitest' package.json >/dev/null 2>&1; then
        npx vitest run "$FILE" --reporter=verbose 2>&1 || true
      elif jq -e '.devDependencies.jest // .dependencies.jest' package.json >/dev/null 2>&1; then
        npx jest "$FILE" 2>&1 || true
      fi
    fi
    ;;
  *.ts|*.tsx|*.js|*.jsx)
    # Source file: look for co-located test
    BASE="${FILE%.*}"
    EXT="${FILE##*.}"
    for CANDIDATE in "${BASE}.test.${EXT}" "${BASE}.spec.${EXT}"; do
      if [[ -f "$CANDIDATE" ]]; then
        if jq -e '.devDependencies.vitest // .dependencies.vitest' package.json >/dev/null 2>&1; then
          npx vitest run "$CANDIDATE" --reporter=verbose 2>&1 || true
        elif jq -e '.devDependencies.jest // .dependencies.jest' package.json >/dev/null 2>&1; then
          npx jest "$CANDIDATE" 2>&1 || true
        fi
        break
      fi
    done
    ;;
  test_*.py|*_test.py)
    command -v pytest >/dev/null 2>&1 && pytest -v "$FILE" 2>&1 || true
    ;;
  *.py)
    BASE=$(basename "$FILE" .py)
    DIR=$(dirname "$FILE")
    for CANDIDATE in "$DIR/test_${BASE}.py" "$DIR/${BASE}_test.py" "tests/test_${BASE}.py"; do
      if [[ -f "$CANDIDATE" ]]; then
        command -v pytest >/dev/null 2>&1 && pytest -v "$CANDIDATE" 2>&1 || true
        break
      fi
    done
    ;;
  *_test.go)
    command -v go >/dev/null 2>&1 && go test -v "$(dirname "$FILE")" 2>&1 || true
    ;;
  *.go)
    DIR=$(dirname "$FILE")
    if ls "$DIR"/*_test.go >/dev/null 2>&1; then
      command -v go >/dev/null 2>&1 && go test -v "$DIR" 2>&1 || true
    fi
    ;;
  *.rs)
    if [[ -f Cargo.toml ]]; then
      command -v cargo >/dev/null 2>&1 && cargo test --quiet 2>&1 || true
    fi
    ;;
  *.java)
    if [[ -f build.gradle || -f build.gradle.kts ]]; then
      [[ -x ./gradlew ]] && ./gradlew test --quiet 2>&1 || true
    elif [[ -f pom.xml ]]; then
      command -v mvn >/dev/null 2>&1 && mvn -q test 2>&1 || true
    fi
    ;;
esac

exit 0
