Bank App Server (Bun + Hono)

Overview
- Secure mock/payments API replacing Paystack
- Uses Appwrite for storage and Appwrite JWT for auth
- Deployable on Railway or Fly.io
- Dummy mode for safe demos (no real processing; stricter validation; randomized fingerprint)

Endpoints
- GET /healthz
- GET /v1/diag (diagnostics: env flags like dummyMode and collection readability)
- Cards
  - POST /v1/cards (Bearer Appwrite JWT)
  - GET /v1/cards (Bearer Appwrite JWT)
  - DELETE /v1/cards/:id (Bearer Appwrite JWT)
- Payments
  - POST /v1/payments (authorize)
  - POST /v1/payments/:id/capture
  - POST /v1/payments/:id/refund
- Dev (dummy mode only)
  - POST /v1/dev/seed-transactions { count: 1..200, cardToken?: string, skipIfNotEmpty?: boolean }

Security
- Requires Authorization: Bearer <Appwrite JWT>
- Never stores PAN/CVC; stores only last4/brand/expiry/token/fingerprint
- Idempotency via Idempotency-Key header on POST /v1/cards
- Basic CORS allowlist via CORS_ORIGINS env

Dummy Mode
- Toggle via DUMMY_MODE=true
- /v1/cards still requires Luhn-valid numbers
- Additional validation: rejects card numbers with repeated 4-digit chunks (e.g., 4242 4242 4242 4242) with error: invalid_card_number
- Token is randomized; fingerprint is randomized (not derived from PAN) in dummy mode
- /v1/dev/seed-transactions enabled to generate demo payments and adjust balances

Env variables
- PORT (default 3000)
- APPWRITE_ENDPOINT (e.g. https://cloud.appwrite.io/v1)
- APPWRITE_PROJECT_ID
- APPWRITE_API_KEY (optional, for server-side DB operations)
- APPWRITE_DATABASE_ID
- APPWRITE_CARDS_COLLECTION_ID
- APPWRITE_TRANSACTIONS_COLLECTION_ID
- APPWRITE_NOTIFICATIONS_COLLECTION_ID (optional)
- CORS_ORIGINS (comma-separated; optional; exact origins like http://localhost:19006,http://localhost:8081,https://app.example.com)
- DUMMY_MODE (true|false)

Local dev
- bun install
- bun run dev

CORS examples
- Development (web):
  CORS_ORIGINS=http://localhost:19006,http://localhost:8081
- Add LAN origin if accessing from a phone browser:
  CORS_ORIGINS=http://localhost:19006,http://localhost:8081,http://192.168.1.123:19006
- Production (web):
  CORS_ORIGINS=https://app.yourdomain.com

Curl examples (assuming JWT in $JWT and API in $API):
- Cards create:
  curl -s -X POST "$API/v1/cards" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $(date +%s)-$RANDOM" \
    -d '{"number":"4000 0027 6000 3184","exp_month":12,"exp_year":2030,"cvc":"123","name":"John Doe"}'
- Seed transactions (dummy mode):
  curl -s -X POST "$API/v1/dev/seed-transactions" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"count":20,"skipIfNotEmpty":true}'

Collections (Appwrite)
- Cards collection (APPWRITE_CARDS_COLLECTION_ID): fields userId, holder, last4, brand, exp_month, exp_year, token, fingerprint, createdAt, type
- Transactions collection (APPWRITE_TRANSACTIONS_COLLECTION_ID): fields userId, amount, currency, source, description, status, createdAt, capturedAt?, refundedAt?, type

Deploy on Railway
- Create a new service from this server/ directory
- Set the env vars above in Railway
- Expose port 3000

Auth from mobile app
- Obtain Appwrite JWT in the client (react-native-appwrite supports account.createJWT()) and send as Bearer token.

