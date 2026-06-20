# ── Stage 1: install node dependencies ────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chown -R node:node /app
USER node
CMD ["node", "server.js"]
