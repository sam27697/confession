#!/bin/sh
# Check env, then migrate, then serve. Never serve without migrating: a
# container that comes up answering requests against a half-migrated
# database is worse than one that does not come up at all. Never migrate
# without checking env first either (week 9 spec §4, Finding D): a stack
# that cannot serve a request should not have written to the database, and
# the configuration error that would have refused it is known-safe to print
# in full, unlike an arbitrary runtime error (see check-env.mjs).
set -e

echo "entrypoint: checking environment"
node /app/check-env.mjs

echo "entrypoint: running migrations"
node /app/migrate.mjs

echo "entrypoint: bootstrapping admin access"
node /app/bootstrap-admin.mjs

echo "entrypoint: starting web server"
exec "$@"
