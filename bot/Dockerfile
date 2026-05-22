# Foil HQ Discord ops bot.
#
# Build context is the REPO ROOT (not bot/) so the runtime has access to
# ../docs/ for the system-prompt loader. Multi-stage to keep the image small.
#
# Railway: configure rootDirectory=bot (in railway.json) which tells Railway
# to use this Dockerfile but execute the build from the repo root.

FROM node:22-alpine AS deps
WORKDIR /app
COPY bot/package.json bot/package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy installed deps from the deps stage.
COPY --from=deps /app/node_modules ./node_modules
COPY bot/package.json ./package.json

# Source — we run TypeScript directly via Node's --experimental-strip-types,
# so no transpilation step is needed.
COPY bot/src ./src

# Docs grounding — system-prompt.ts reads ../docs/BRIEFING.md etc. at runtime.
# Copy the second-brain docs but NOT anything that doesn't belong in the
# bot's container (no app/, no scripts/, no lib/).
COPY docs ../docs
COPY CLAUDE.md ../CLAUDE.md
COPY AGENTS.md ../AGENTS.md

# Bot listens for the Discord gateway via outbound WebSocket; no exposed
# HTTP port is needed. Railway's healthcheck will use the process exit
# status, not an HTTP probe.
CMD ["node", "--experimental-strip-types", "--no-warnings", "src/index.ts"]
