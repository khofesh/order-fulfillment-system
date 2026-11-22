#!/bin/sh
# Build the AWS Emulator image (if missing), start it in Docker on loopback, write
# the connection env file and wait until it is healthy.
#   scripts/emulator-up.sh            # or: make emulator-up
# Rebuild with the latest emulator release: REBUILD=1 scripts/emulator-up.sh
set -eu

PORT="${AWS_EMULATOR_PORT:-9297}"
NAME="${AWS_EMULATOR_NAME:-aws-emulator}"
IMAGE=aws-emulator
DIR="$HOME/.aws/emulator/$PORT"
ENV_FILE="$HOME/.aws/emulator/$PORT.env"
ROOT=$(cd "$(dirname "$0")/.." && pwd)

case "$(uname -m)" in
  arm64 | aarch64) ARCH=arm64 ;;
  x86_64 | amd64) ARCH=amd64 ;;
  *) echo "error: unsupported CPU $(uname -m)" >&2; exit 1 ;;
esac

if [ "${REBUILD:-}" = 1 ] || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build --pull ${REBUILD:+--no-cache} --build-arg TARGETARCH="$ARCH" -t "$IMAGE" "$ROOT/emulator"
fi

# Create the mount first, otherwise Docker creates it owned by root.
mkdir -p "$DIR"

if docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "$NAME already running"
else
  docker network create aws-emulator >/dev/null 2>&1 || true
  # Loopback only, minimal rights; the mount is the only writable path. State is in
  # memory and is lost when the container stops.
  docker run -d --rm --name "$NAME" \
    --network aws-emulator \
    --cap-drop ALL --security-opt no-new-privileges --read-only \
    -e EMULATOR_TELEMETRY=off \
    -p "127.0.0.1:$PORT:$PORT" \
    -v "$DIR:/home/emulator/.aws/emulator/$PORT" \
    "$IMAGE" -p "$PORT" >/dev/null
fi

# Points at file paths, not their contents, so it keeps working across restarts.
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
export AWS_ENDPOINT_URL=https://127.0.0.1:$PORT
export AWS_SHARED_CREDENTIALS_FILE=\$HOME/.aws/emulator/$PORT/emulator_credentials
export AWS_CONFIG_FILE=\$HOME/.aws/emulator/$PORT/config
export AWS_EC2_METADATA_DISABLED=true
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

# Environment credentials win over the credentials file: real keys would be sent and rejected.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE \\
  AWS_WEB_IDENTITY_TOKEN_FILE AWS_ROLE_ARN AWS_ROLE_SESSION_NAME AWS_CONTAINER_CREDENTIALS_RELATIVE_URI \\
  AWS_CONTAINER_CREDENTIALS_FULL_URI AWS_CONTAINER_AUTHORIZATION_TOKEN

# The config's ca_bundle is a container path, so use the host path.
export AWS_CA_BUNDLE=\$HOME/.aws/emulator/$PORT/ca.pem

export AWS_PAGER=""
EOF
  echo "wrote $ENV_FILE"
fi

for _ in $(seq 30); do
  if curl -sf --cacert "$DIR/ca.pem" "https://127.0.0.1:$PORT/__admin/health" >/dev/null 2>&1; then
    echo "emulator healthy on https://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 1
done
echo "error: emulator not healthy after 30s; see: docker logs $NAME" >&2
exit 1
