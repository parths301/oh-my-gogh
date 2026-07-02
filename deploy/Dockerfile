# Oh my Gogh! — Medusa backend production image
# Build context is the repo root:  docker build -f deploy/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY backend/ .
RUN npm run build \
  # the built server has its own package.json — install its prod deps
  && cd .medusa/server && npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.medusa/server ./
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD curl -fsS http://localhost:9000/health || exit 1
CMD ["npx", "medusa", "start"]
