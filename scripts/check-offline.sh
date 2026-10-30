#!/usr/bin/env bash
# Offline checks for this lab. No AWS. Touches nothing outside this folder.
#
#   ./scripts/check-offline.sh
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/.." && pwd)"
fail=0
summary=()
record() { summary+=("$(printf '  %-8s %s' "$1" "$2")"); [ "$1" = FAILED ] && fail=$((fail + 1)); }

command -v node >/dev/null 2>&1 || { echo "STOPPED: 'node' is not installed. In PowerShell run:  winget install OpenJS.NodeJS.LTS  then reopen."; exit 1; }
record PASS "Tools: node is installed"

echo "== Syntax"
if node --check "$here/lens.mjs" && node --check "$here/selftest.mjs"; then record PASS "Script syntax"; else record FAILED "Script syntax"; fi

echo "== Self-test against a pretend AWS"
if node "$here/selftest.mjs"; then record PASS "Self-test (dry runs, apply, repeat, bank guard, flow, categories)"; else record FAILED "Self-test (dry runs, apply, repeat, bank guard, flow, categories)"; fi

echo
echo "== Secret scan (files in this folder)"
if grep -rInE --exclude-dir=.git --exclude-dir=node_modules \
     'AKIA[0-9A-Z]{16}|BEGIN (RSA|PRIVATE)|dev[0-9]{6}|ghp_[A-Za-z0-9]{20}|github_pa[t]_|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|arn:aws:[a-z]+:[a-z0-9-]*:[0-9]{12}' "$repo"; then
  record FAILED "No keys, tokens, account ids or instance ids in files"
else
  record PASS "No keys, tokens, account ids or instance ids in files"
fi

echo
echo "================ SUMMARY ================"
printf '%s\n' "${summary[@]}"
echo
if [ "$fail" -eq 0 ]; then echo "All stages passed. Nothing was sent to AWS."; else echo "$fail stage(s) FAILED. Scroll up to the first FAILED output and send me that part."; fi
[ "$fail" -eq 0 ]
