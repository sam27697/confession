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

APP_DIR=/srv/apps/confession
REPO_DIR="$APP_DIR/repo"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "deploy: $APP_DIR/.env is missing. It holds SESSION_SECRET, POSTGRES_PASSWORD," >&2
  echo "        APP_ORIGIN and HOST_PORT, and it is never committed." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

: "${HOST_PORT:?HOST_PORT is not set in .env -- 8182 staging, 8082 production}"

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
docker compose -f "$REPO_DIR/docker-compose.yml" --project-directory "$APP_DIR" up -d --remove-orphans

echo "deploy: waiting for the web container to report healthy"
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' confession-web 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    echo "deploy: healthy after ${i}0s"
    break
  fi
  if [ "$i" = "60" ]; then
    echo "deploy: FAILED -- confession-web never reported healthy (last status: ${status})" >&2
    docker compose -f "$REPO_DIR/docker-compose.yml" --project-directory "$APP_DIR" logs --tail 60 confession-web >&2 || true
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
