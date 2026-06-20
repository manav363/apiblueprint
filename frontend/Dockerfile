# ── Stage 1: install node dependencies ────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: dev server ────────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
