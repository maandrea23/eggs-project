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

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/out /usr/share/nginx/html

EXPOSE 4000
CMD ["nginx", "-g", "daemon off;"]
