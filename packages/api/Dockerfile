FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN mkdir -p data logs
EXPOSE ${PORT:-3010}
CMD ["bun", "run", "src/index.ts"]
