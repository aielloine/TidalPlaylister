FROM node:24-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/tidal.db
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --chown=node:node prisma/migrations ./prisma/migrations
COPY --chown=node:node migrate.mjs ./
USER node
VOLUME /app/data
EXPOSE 3000
CMD ["sh", "-c", "node migrate.mjs && exec node server.js"]
