# Next.js standalone web + shared worker (linux/amd64 + linux/arm64)
FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs eslint.config.mjs ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
COPY worker.mjs worker.ts ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

RUN mkdir -p /data \
  && chown -R 1000:1000 /data /app

# Next standalone server
COPY --from=build --chown=1000:1000 /app/public ./public
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static

# Worker + domain libs + native sqlite (external to Next bundle)
COPY --from=build --chown=1000:1000 /app/lib ./lib
COPY --from=build --chown=1000:1000 /app/worker.mjs ./worker.mjs
COPY --from=build --chown=1000:1000 /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build --chown=1000:1000 /app/node_modules/bindings ./node_modules/bindings
COPY --from=build --chown=1000:1000 /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=build --chown=1000:1000 /app/node_modules/dotenv ./node_modules/dotenv
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh

USER 1000:1000

ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
