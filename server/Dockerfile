# Fly.io deployment using Bun (pinned version)
FROM oven/bun:1.2.9 as base
WORKDIR /app

ENV NODE_ENV=production

# Install only server dependencies (copy from repo root)
COPY server/package.json ./package.json
# Copy lock files if present for reproducible installs
COPY server/bun.lockb* server/bun.lock* ./
# Prefer reproducible install; fallback if lock is missing
RUN bun install --ci || bun install

# Copy server source explicitly
COPY server/src ./src
COPY server/tsconfig.json ./tsconfig.json
# Include scripts (optional utilities, migrations)
COPY server/scripts ./scripts

# Ensure the same port Fly routes to
EXPOSE 3000

# Override entrypoint to bypass image's default 'bun run start'
ENTRYPOINT ["bun"]
# Run the Bun server directly
CMD ["/app/src/index.ts"]

