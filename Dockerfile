FROM node:22-alpine AS frontend-deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS frontend-builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/ .
RUN npm run build

FROM node:22-alpine AS backend-deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/src ./src
COPY --from=frontend-builder /app/out ./public

EXPOSE 4000
CMD ["node", "--import", "tsx", "src/server.ts"]
