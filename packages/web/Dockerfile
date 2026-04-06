FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json .
COPY --from=build /app/node_modules ./node_modules
EXPOSE ${PORT:-3011}
ENV PORT=3011
HEALTHCHECK --interval=3m --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3011) + '/').then(r => { if (!r.ok && r.status !== 303) process.exit(1) })" || exit 1
CMD ["bun", "./build/index.js"]
