# syntax=docker/dockerfile:1
# Production image for the Marketing Task Tracker.
# Runs BOTH process types from one image:
#   web    -> npm start          (next start, port 3000)
#   worker -> npm run worker     (IMAP poller, node-cron)
# Fly selects which via [processes] in fly.toml.

FROM node:20-slim AS base
WORKDIR /app
# openssl is required by Prisma's query engine on Debian.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# --- deps: install node_modules (skip the prisma postinstall; we generate later) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# --- build: generate Prisma client + build Next ---
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- runner: the image Fly runs ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Copy the full app (node_modules includes tsx for the worker and the prisma
# CLI for `migrate deploy` in the release command).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/worker ./worker
COPY --from=build /app/scripts ./scripts

EXPOSE 3000
CMD ["npm", "start"]
