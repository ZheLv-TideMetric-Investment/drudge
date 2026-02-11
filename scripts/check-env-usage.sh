#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Allowed direct env access:
# 1. shared/common/utils/env.js: centralized env loading and parsing.
ALLOWLIST_REGEX='^(shared/common/utils/env\.js)$'

RAW_MATCHES="$(
  rg -n \
    "process\\.env|dotenv\\.config|DOTENV_CONFIG_PATH" \
    packages \
    shared \
    --glob '!**/tests/**' \
    --glob '!**/node_modules/**' \
    --glob '!**/dist/**' \
    --glob '!**/.next/**' \
    || true
)"

if [[ -z "$RAW_MATCHES" ]]; then
  echo "✅ env usage check passed (no direct env access found)."
  exit 0
fi

VIOLATIONS=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file="${line%%:*}"
  if [[ ! "$file" =~ $ALLOWLIST_REGEX ]]; then
    VIOLATIONS+="$line"$'\n'
  fi
done <<< "$RAW_MATCHES"

if [[ -n "$VIOLATIONS" ]]; then
  echo "❌ Disallowed direct env access detected."
  echo "$VIOLATIONS"
  exit 1
fi

echo "✅ env usage check passed (only allowlisted files use direct env access)."
