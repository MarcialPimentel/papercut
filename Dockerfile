# Papercut: one small container serves the game and runs the rooms that pair players online.
# No database. Health check: GET /api/health (reports the build).

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public public
COPY src src
ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8790
ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA
COPY package.json package-lock.json ./
# Runtime needs only ws and tsx (the server runs TypeScript directly).
RUN npm ci --omit=dev && npm cache clean --force
COPY tsconfig.json ./
COPY server server
COPY src/net/protocol.ts src/net/protocol.ts
COPY --from=build /app/dist dist
EXPOSE 8790
USER node
CMD ["node", "--import", "tsx", "server/index.ts"]
