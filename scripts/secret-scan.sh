#!/usr/bin/env bash
#
# Pre-push secret gate.
#
# Greps the git-tracked files for secret signatures (private keys, cloud tokens,
# and quoted literals assigned to secret-looking keys). Lockfiles and known dummy
# placeholders are ignored, and lines that only reference an environment variable
# (process.env, import.meta.env, os.environ, ${{ secrets.* }}) are not secrets.
# Exits 1 when a candidate is found so a push can be blocked; exits 0 when clean.
#
# Usage (from anywhere inside the repo):
#   bash scripts/secret-scan.sh

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Lockfiles carry high-entropy strings that are not secrets; exclude them.
EXCLUDES=(
  ":(exclude)**/*.lock"
  ":(exclude)**/bun.lockb"
  ":(exclude)**/package-lock.json"
  ":(exclude)**/pnpm-lock.yaml"
  ":(exclude)**/yarn.lock"
)

# Safe-by-construction lines: dummy placeholders and env-variable references.
DUMMY='postgres:postgres@localhost|dummy|example|changeme|placeholder|<[A-Za-z0-9_.-]+>|xxxx+|your[_-]|redacted|\$\{\{|process\.env|import\.meta\.env|os\.environ|getenv|secrets\.'

# Secret signatures. Quoted-literal rule requires a real value (>= 8 chars) so a
# bare key name or an env reference does not trip it.
PATTERNS=(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{20,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'AIza[0-9A-Za-z_-]{35}'
  '(api[_-]?key|secret|token|client[_-]?secret|password|passwd|senha)["'"'"' ]*[:=][ ]*["'"'"'][^"'"'"' ]{8,}["'"'"']'
  'Authorization["'"'"' ]*[:=][ ]*["'"'"']?[Bb]earer [A-Za-z0-9._-]{16,}'
)

hits=0
for pat in "${PATTERNS[@]}"; do
  # git grep exits 1 on no match; tolerate it and filter the safe lines out.
  matches="$(git grep -nIiE "$pat" -- . "${EXCLUDES[@]}" 2>/dev/null | grep -viE "$DUMMY" || true)"
  if [ -n "$matches" ]; then
    echo "secret-scan: candidate secret (pattern: $pat)" >&2
    echo "$matches" >&2
    hits=1
  fi
done

if [ "$hits" -ne 0 ]; then
  echo "secret-scan: potential secrets in tracked files; resolve before pushing." >&2
  exit 1
fi

echo "secret-scan: clean (no secret signatures in tracked files)."
exit 0
