#!/usr/bin/env bash
# Deploy the confession app on asam-prod-01. Runs ON the server, as the
# `deploy` user, from /srv/apps/confession/.
#
#   cd /srv/apps/confession && ./repo/deploy.sh
#
# It builds, brings the stack up, and then VERIFIES. A deploy script that
# reports success without checking is the same defect as a test suite that
# never ran, so the exit code below is the whole point of the file.
#
# It deliberately does NOT verify from outside: this script has no view of
# DNS or the certificate. The external check is
# `bin/asam.sh check stg.confession.fayad.app` from the build session, and
# that is the claim that counts.
set -euo pipefail

# APP_DIR used to be a constant, which is exactly the bug recorded in spec
# §1.3: run this script from the wrong directory (e.g. production's copy
# invoked while sitting in staging's tree) and it would happily cd into
# staging, read staging's .env and redeploy staging, then exit 0. The script
# always lives at $APP_DIR/repo/deploy.sh, so APP_DIR is derived from its own
# location instead -- a script that only works from one directory has no
# business being copied into two (spec §1.3).
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$REPO_DIR")"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "deploy: $APP_DIR/.env is missing. It holds SESSION_SECRET, POSTGRES_PASSWORD," >&2
  echo "        APP_ORIGIN, HOST_PORT and STACK_NAME, and it is never committed." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

: "${HOST_PORT:?HOST_PORT is not set in .env -- 8182 staging, 8082 production}"
: "${STACK_NAME:?STACK_NAME is not set in .env -- confession for staging, confession-prod for production}"

# The pairing guard runs before the build (spec §1.2): a deploy that is
# going to be refused should be refused before it spends four minutes
# compiling, not after.
echo "deploy: checking STACK_NAME/HOST_PORT/APP_ORIGIN/ALLOW_DEV_LOGIN/APP_DIR pairing"
"$REPO_DIR/scripts/check-deploy-pairing.sh" "$STACK_NAME" "$HOST_PORT" "${APP_ORIGIN:-}" "${ALLOW_DEV_LOGIN:-}" "$APP_DIR"

# The repo is transferred to the box as files, not cloned: this account holds
# no GitHub credential and the repository is private, so there is nothing here
# that could clone it and nothing here that should be able to. The build
# session writes DEPLOY_VERSION next to the tree when it uploads it.
if [ -f "$REPO_DIR/DEPLOY_VERSION" ]; then
  VERSION="$(tr -d '[:space:]' < "$REPO_DIR/DEPLOY_VERSION")"
else
  echo "deploy: $REPO_DIR/DEPLOY_VERSION is missing -- upload the tree with the" >&2
  echo "        build session's transfer step, do not hand-copy it." >&2
  exit 1
fi

export CONFESSION_IMAGE_TAG="confession-web:${VERSION}"

echo "deploy: building ${CONFESSION_IMAGE_TAG}"
docker build -t "$CONFESSION_IMAGE_TAG" "$REPO_DIR"

echo "deploy: bringing the stack up"
docker compose -f "$REPO_DIR/docker-compose.yml" --project-directory "$APP_DIR" -p "$STACK_NAME" up -d --remove-orphans

echo "deploy: waiting for the web container to report healthy"
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "${STACK_NAME}-web" 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    echo "deploy: healthy after ${i}0s"
    break
  fi
  if [ "$i" = "60" ]; then
    echo "deploy: FAILED -- ${STACK_NAME}-web never reported healthy (last status: ${status})" >&2
    docker logs --tail 60 "${STACK_NAME}-web" >&2 || true
    exit 1
  fi
  sleep 10
done

echo "deploy: local health check on 127.0.0.1:${HOST_PORT}"
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${HOST_PORT}/healthz")"
if [ "$code" != "200" ]; then
  echo "deploy: FAILED -- /healthz answered ${code}, expected 200" >&2
  exit 1
fi

echo "deploy: ok. ${CONFESSION_IMAGE_TAG} is up on 127.0.0.1:${HOST_PORT}."
echo "deploy: this proves the process is alive. It proves nothing about DNS or TLS."
echo "deploy: verify from outside before calling it deployed."
