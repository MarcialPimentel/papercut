# Papercut: one small container serves the game and runs the rooms that pair players online.
# No database. Health check: GET /api/health (reports the build).

FROM node:22-slim AS build
WORKDIR /app
# The desktop app's Electron isn't needed to build the website.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
# vite.config.ts reads the fight version from server/fightVersion.ts.
COPY server/fightVersion.ts server/fightVersion.ts
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
# The rules' source: the server pairs only players whose game was built from the same rules.
COPY src/sim src/sim
COPY --from=build /app/dist dist
EXPOSE 8790
USER node
CMD ["node", "--import", "tsx", "server/index.ts"]
