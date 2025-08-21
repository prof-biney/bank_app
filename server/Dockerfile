# Railway deployment using Bun
FROM oven/bun:1 as base
WORKDIR /app
COPY package.json bun.lockb* bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . ./src
EXPOSE 3000
CMD ["bun", "run", "start"]

