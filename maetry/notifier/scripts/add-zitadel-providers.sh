#!/usr/bin/env bash
# MAETRY: creates ZITADEL's HTTP email and SMS providers pointing at this Worker and
# stores their signing keys as Worker secrets. The console has no form for HTTP
# providers, only the Admin API. Keys go straight from the response into
# `wrangler secret put` and are never printed. Providers are created inactive;
# activate them with activate-zitadel-provider.sh after TELNYX_API_KEY is set.
#
# Needs a token with iam.write (an IAM_OWNER), asked for interactively.
set -euo pipefail
cd "$(dirname "$0")/.."

ZITADEL_URL="${ZITADEL_URL:-https://auth.maetry.com}"
WORKER_URL="${WORKER_URL:-https://notify.maetry.com}"

read -rsp "ZITADEL token (iam.write): " TOKEN; echo

add() { # channel, path, secret
  local response id
  response=$(curl -sS --fail-with-body -X POST "$ZITADEL_URL/admin/v1/$2/http" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"endpoint\":\"$WORKER_URL/zitadel/$1\",\"description\":\"Telnyx via zitadel-notifier\"}")
  id=$(jq -er '.id' <<<"$response")
  jq -er '.signingKey' <<<"$response" | npx wrangler secret put "$3" >/dev/null
  echo "$1 provider: $id (signing key stored in $3)"
}

add email email ZITADEL_EMAIL_SIGNING_KEYS
add sms sms ZITADEL_SMS_SIGNING_KEYS
