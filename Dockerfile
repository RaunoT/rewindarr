FROM node:26-alpine AS base

# Node 25 and later no longer ship corepack, which picks the pinned pnpm
RUN npm install -g corepack@0.36.0 && corepack enable pnpm

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
ENV HUSKY=0
# Cache mounts keep corepack's pnpm and pnpm's package store between builds,
# so a lockfile change only downloads what changed
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm i --frozen-lockfile --store-dir /pnpm/store

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_VERSION_TAG
ENV NEXT_PUBLIC_VERSION_TAG=${NEXT_PUBLIC_VERSION_TAG}

# Turbopack's build cache, kept per architecture so the two builds don't share it
ARG TARGETARCH
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    --mount=type=cache,id=next-cache-${TARGETARCH},target=/app/.next/cache \
    pnpm run build

# Production image, copy all the files and run next
FROM node:26-alpine AS runner
WORKDIR /app

# su-exec lets the entrypoint drop root privileges
RUN apk add --no-cache su-exec

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# The app saves settings to config and Next.js writes its caches to .next/cache,
# so both need to be writable by the runtime user (sticky 1777 cache supports custom --user UIDs)
RUN mkdir -p config .next/cache && chown -R node:node config .next/cache && chmod 1777 .next/cache

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 8383

ENV PORT=8383

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY; \
    wget -qO /dev/null "http://127.0.0.1:${PORT:-8383}/api/health" \
    || wget -qO /dev/null "http://[::1]:${PORT:-8383}/api/health"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
