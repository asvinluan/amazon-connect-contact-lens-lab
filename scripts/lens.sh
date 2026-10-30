#!/usr/bin/env bash
# Contact Lens lab helper (Git Bash, WSL, Linux, macOS).
#
#   ./scripts/lens.sh check
#   ./scripts/lens.sh check --user YOUR_LOGIN
#   ./scripts/lens.sh queue --user YOUR_LOGIN            (dry run)
#   ./scripts/lens.sh queue --user YOUR_LOGIN --apply    (does it)
#   ./scripts/lens.sh flow [--apply | --print]
#   ./scripts/lens.sh categories [--apply] [--eventbridge]
#   ./scripts/lens.sh rule-export [--name NAME]
#   ./scripts/lens.sh results [--hours 6]
#
# Anything that changes AWS is a dry run unless you add --apply.
# Set LENS_INSTANCE_ALIAS if your instance alias is not asvinluan-connect-lab.
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_DEFAULT_REGION="$AWS_REGION"

command -v node >/dev/null 2>&1 || { echo "STOPPED: 'node' is not installed or this window cannot see it."; echo "In PowerShell run:  winget install OpenJS.NodeJS.LTS   then reopen this window."; exit 1; }

print_only=0
for a in "$@"; do [ "$a" = "--print" ] && print_only=1; done
if [ "$print_only" -eq 0 ]; then
  command -v aws >/dev/null 2>&1 || { echo "STOPPED: 'aws' is not installed or this window cannot see it."; echo "In PowerShell run:  winget install Amazon.AWSCLI   then reopen this window."; exit 1; }
  aws sts get-caller-identity --query Account --output text >/dev/null 2>&1 \
    || { echo "STOPPED: no working AWS login. Run  aws configure  (or  aws sso login ) and try again."; exit 1; }
fi

exec node "$here/lens.mjs" "$@"
