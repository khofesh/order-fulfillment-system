#!/bin/sh
# Run a command against the local AWS Emulator instead of real AWS.
#   scripts/with-emulator.sh terraform -chdir=infra apply
#   scripts/with-emulator.sh aws sts get-caller-identity
#
# Requires the emulator to be running (scripts/emulator-up.sh, which also writes
# ~/.aws/emulator/<port>.env). That file points at this run's credentials, config
# and CA bundle, and unsets any real AWS credentials.
set -eu

PORT="${AWS_EMULATOR_PORT:-9297}"
ENV_FILE="$HOME/.aws/emulator/$PORT.env"
CA="$HOME/.aws/emulator/$PORT/ca.pem"

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found; run scripts/emulator-up.sh first" >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"
# The Node.js SDK ignores AWS_CA_BUNDLE.
export NODE_EXTRA_CA_CERTS="$CA"

if ! curl -sf --cacert "$CA" "https://127.0.0.1:$PORT/__admin/health" >/dev/null; then
  echo "error: emulator not healthy on 127.0.0.1:$PORT (docker ps --filter name=aws-emulator)" >&2
  exit 1
fi

account=$(aws sts get-caller-identity --query Account --output text)
if [ "$account" != "000000000000" ]; then
  echo "error: expected emulator account 000000000000, got $account; refusing to run" >&2
  exit 1
fi

exec "$@"
