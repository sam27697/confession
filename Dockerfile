# Multi-stage build for the confession web app.
#
# The runtime image carries the Next standalone output, the migration
# runner and the .sql files, and nothing else: no build toolchain, no dev
# dependencies, no source. It runs as a non-root user.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The build must not reach the database or the network. Every value below is
# a placeholder that satisfies src/env.ts at build time only; the real ones
# arrive from the environment at run time.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV SESSION_SECRET=build-time-placeholder-not-a-secret-000000
ENV APP_ORIGIN=http://localhost:3000
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# curl for the healthcheck. Nothing else is added to this image.
RUN apk add --no-cache curl

# Next's standalone output already contains the traced node_modules, which
# is where the migration runner finds pg.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/check-env.mjs ./check-env.mjs
COPY --from=build /app/scripts/migrate.mjs ./migrate.mjs
COPY --from=build /app/scripts/bootstrap-admin.mjs ./bootstrap-admin.mjs
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000

# HOSTNAME=0.0.0.0 binds inside the container's own network namespace only.
# The host side is published on 127.0.0.1 by docker-compose.yml, which is
# the rule that matters: Docker's DNAT rules bypass the host firewall.
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
