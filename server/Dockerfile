# Fly.io deployment using Bun
FROM oven/bun:1 as base
WORKDIR /app

# Install only server dependencies
COPY package.json bun.lockb* bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Copy server source
COPY . .

# Ensure the same port Fly routes to
EXPOSE 3000

# Run the Bun server directly to avoid relying on package.json scripts
CMD ["bun", "src/index.ts"]

