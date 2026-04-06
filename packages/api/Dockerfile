FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN mkdir -p data logs
EXPOSE ${PORT:-3010}
HEALTHCHECK --interval=3m --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3010) + '/health').then(r => { if (!r.ok) process.exit(1) })" || exit 1
CMD ["bun", "run", "src/index.ts"]
