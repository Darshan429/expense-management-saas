# =========================
# Stage 1: Install dependencies
# =========================
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev


# =========================
# Stage 2: Production image
# =========================
FROM node:22-alpine

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY --chown=node:node . .

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]