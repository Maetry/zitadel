#!/usr/bin/env bash
# MAETRY: activates a ZITADEL email or SMS provider by id (from add-zitadel-providers.sh).
# Usage: activate-zitadel-provider.sh email|sms <provider id>
set -euo pipefail

ZITADEL_URL="${ZITADEL_URL:-https://auth.maetry.com}"
case "${1:-}" in email|sms) ;; *) echo "usage: $0 email|sms <provider id>" >&2; exit 2;; esac
[ -n "${2:-}" ] || { echo "usage: $0 email|sms <provider id>" >&2; exit 2; }

read -rsp "ZITADEL token (iam.write): " TOKEN; echo
curl -sS --fail-with-body -X POST "$ZITADEL_URL/admin/v1/$1/$2/_activate" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' >/dev/null
echo "$1 provider $2 is active"
