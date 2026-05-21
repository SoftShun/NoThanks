# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build-client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache curl tini
# Server is plain JS — copy source directly (no build step)
COPY server/ ./server/
# Client built output — server resolves via path.join(__dirname, '..', 'client', 'dist')
COPY --from=build-client /app/client/dist ./client/dist
ENV NODE_ENV=production
WORKDIR /app/server
RUN npm ci --omit=dev
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-3001}/health || exit 1
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","index.js"]
