#!/bin/sh
# Migrate, then serve. Never serve without migrating: a container that comes
# up answering requests against a half-migrated database is worse than one
# that does not come up at all.
set -e

echo "entrypoint: running migrations"
node /app/migrate.mjs

echo "entrypoint: starting web server"
exec "$@"
