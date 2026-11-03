# Papercut: one small container serves the game and runs the rooms that pair players online.
# Stats go to Papercut's database on the hub's shared Postgres (DATABASE_URL). Health check: GET /api/health.

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
# Runtime needs ws, pg and tsx (the server runs TypeScript directly).
RUN npm ci --omit=dev && npm cache clean --force
COPY tsconfig.json ./
COPY server server
COPY src/net/protocol.ts src/net/protocol.ts
# The server re-plays every online fight (server/referee.ts), so it needs the fight's code.
COPY src/sim src/sim
COPY --from=build /app/dist dist
EXPOSE 8790
USER node
CMD ["node", "--import", "tsx", "server/index.ts"]
