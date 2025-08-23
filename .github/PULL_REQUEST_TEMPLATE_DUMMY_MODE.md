# PR: Dummy Mode, Tokenized Payments, Seeding, and Deployment Optimizations

## Summary
This PR introduces a safe, toggleable Dummy Mode for the server, improves card handling and payments in the app, adds a dev-only seeding endpoint, and updates documentation and build configuration for more reliable deployments.

## Highlights
- Server (Bun + Hono)
  - DUMMY_MODE=true flag to enable demo-safe behavior
  - Card validation: still requires Luhn; in dummy mode, rejects numbers with duplicated 4‑digit chunks (e.g., 4242 4242 4242 4242)
  - Randomized token (always) and fingerprint (in dummy mode; not derived from PAN)
  - Dev-only seeding endpoint: POST /v1/dev/seed-transactions (requires Bearer Appwrite JWT)
  - Diagnostics endpoint: GET /v1/diag now includes dummyMode flag
  - No PAN/CVC stored or logged; last4/brand/expiry only

- App (React Native + Expo)
  - Stores server-issued card token and uses it as the payment source
  - Auto-seeds demo transactions on sign-in/login when server is in dummy mode (idempotent if transactions exist)
  - Payments screen creates payments using activeCard.token and supports capture/refund

- Docs
  - server/README.md: Dummy Mode, seeding, CORS examples, curl snippets, diag info
  - root README.md: Dummy Mode & Seeding section, CORS & troubleshooting, optimization tips
  - CHANGELOG.md: Unreleased changes documented

- Build/Deploy
  - server/Dockerfile: pin Bun version (1.2.9), prefer `bun install --ci`, copy server/scripts
  - fly.toml: already pointing to server/Dockerfile; no change required

## User impact
- In dummy mode, cards with repeated 4‑digit chunks are rejected as invalid, preventing common public test numbers and improving demo safety.
- Cards added via the app now carry a token that’s used to associate payments and automatically adjust balances on capture/refund.
- Seeding endpoint enables richer demo data with realistic state transitions.

## Config changes
- Server (Fly secrets):
  - DUMMY_MODE=true
  - CORS_ORIGINS=comma-separated exact origins (e.g., http://localhost:19006,http://localhost:8081,https://app.yourdomain.com)
  - APPWRITE_* values (endpoint, project, database, collections, optional API key)
- App (.env):
  - EXPO_PUBLIC_FLY_API_URL or EXPO_PUBLIC_API_BASE_URL set to your Fly app URL

## Verification
- GET /v1/diag returns dummyMode: true and checks for collections
- POST /v1/cards with 4242 4242 4242 4242 returns 400 in dummy mode
- POST /v1/cards with a Luhn-valid number without repeated chunks succeeds; response includes token
- From the app, create payment -> capture -> refund; balances adjust by token
- POST /v1/dev/seed-transactions with { count: 20, skipIfNotEmpty: true } seeds transactions (dummy mode only)

## Optimization tips (docs)
- Use Idempotency-Key on POST requests
- Keep Expo packages on suggested patch versions
- Pin Bun version and use `bun install --ci` for reproducible images
- Use `bunx expo start --tunnel` for quick device testing

## Files changed (high level)
- server/src/index.ts (dummy mode, validation, seed endpoint, diag)
- server/.env.example (DUMMY_MODE, CORS_ORIGINS note)
- server/Dockerfile (pin bun, install strategy, copy scripts)
- app/(tabs)/cards.tsx (store token)
- app/(tabs)/payments.tsx (use token as payment source)
- context/AppContext.tsx, constants/index.ts, types/index.ts (token plumbing)
- store/auth.store.ts (auto-seed on sign-in/login)
- README.md and server/README.md (docs)
- CHANGELOG.md (unreleased updates)

## Rollout
- Deploy server with DUMMY_MODE=true on staging, validate flows
- Point app env to staging API base
- Optionally enable seeding automatically (already integrated post-login)
- For production, decide whether to keep DUMMY_MODE=true (demo environments) or set to false

