Bank App Server (Bun + Hono)

Overview
- Secure mock/payments API replacing Paystack
- Uses Appwrite for storage and Appwrite JWT for auth
- Deployable on Railway or Fly.io

Endpoints
- GET /healthz
- Cards
  - POST /v1/cards (Bearer Appwrite JWT)
  - GET /v1/cards (Bearer Appwrite JWT)
  - DELETE /v1/cards/:id (Bearer Appwrite JWT)
- Payments
  - POST /v1/payments (authorize)
  - POST /v1/payments/:id/capture
  - POST /v1/payments/:id/refund

Security
- Requires Authorization: Bearer <Appwrite JWT>
- Never stores PAN/CVC; stores only last4/brand/expiry/token/fingerprint
- Idempotency via Idempotency-Key header on POST /v1/cards
- Basic CORS allowlist via CORS_ORIGINS env

Env variables
- PORT (default 3000)
- APPWRITE_ENDPOINT (e.g. https://cloud.appwrite.io/v1)
- APPWRITE_PROJECT_ID
- APPWRITE_API_KEY (optional, for server-side DB operations)
- APPWRITE_DATABASE_ID
- APPWRITE_CARDS_COLLECTION_ID
- APPWRITE_TRANSACTIONS_COLLECTION_ID
- CORS_ORIGINS (comma-separated; optional)

Local dev
- bun install
- bun run dev

Collections (Appwrite)
- Cards collection (APPWRITE_CARDS_COLLECTION_ID): fields userId, holder, last4, brand, exp_month, exp_year, token, fingerprint, createdAt, type
- Transactions collection (APPWRITE_TRANSACTIONS_COLLECTION_ID): fields userId, amount, currency, source, description, status, createdAt, capturedAt?, refundedAt?, type

Deploy on Railway
- Create a new service from this server/ directory
- Set the env vars above in Railway
- Expose port 3000

Auth from mobile app
- Obtain Appwrite JWT in the client (react-native-appwrite supports account.createJWT()) and send as Bearer token.

