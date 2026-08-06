FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "--import", "tsx", "src/server.ts"]
