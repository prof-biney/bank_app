# Fly.io deployment using Bun
FROM oven/bun:1 as base
WORKDIR /app

# Install only server dependencies (copy from repo root)
COPY server/package.json server/bun.lockb* server/bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Copy server source (from repo root)
COPY server/. .

# Ensure the same port Fly routes to
EXPOSE 3000

# Override entrypoint to bypass image's default 'bun run start'
ENTRYPOINT ["bun"]
# Run the Bun server directly
CMD ["/app/src/index.ts"]

