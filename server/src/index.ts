import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { z } from 'zod';
import { Client, Databases, ID, Query } from 'node-appwrite';
import { appwriteAuth } from './middleware/auth';
import { luhnValid, detectBrand } from './utils/luhn';

const app = new Hono();

// CORS
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use('*', cors({ origin: (origin) => {
  if (!origin) return true;
  if (CORS_ORIGINS.length === 0) return true;
  return CORS_ORIGINS.includes(origin);
}, allowMethods: ['GET','POST','DELETE','OPTIONS'], allowHeaders: ['Content-Type','Authorization','Idempotency-Key']}));

app.use('*', prettyJSON());

// Health
app.get('/healthz', (c) => {
  const ok = Boolean(process.env.APPWRITE_ENDPOINT && process.env.APPWRITE_PROJECT_ID && process.env.APPWRITE_DATABASE_ID && process.env.APPWRITE_CARDS_COLLECTION_ID);
  return c.json({ ok });
});

// Appwrite client factory
function createDb() {
  const endpoint = process.env.APPWRITE_ENDPOINT!;
  const projectId = process.env.APPWRITE_PROJECT_ID!;
  const apiKey = process.env.APPWRITE_API_KEY; // optional for server ops
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  if (apiKey) client.setKey(apiKey);
  const databases = new Databases(client);
  return { client, databases };
}

// Idempotency cache (in-memory, dev)
const idem = new Map<string, { status: number; body: any; expiresAt: number }>();
const IDEM_TTL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of idem) if (v.expiresAt <= now) idem.delete(k);
}, 60 * 1000).unref?.();

// Schemas
const CardCreate = z.object({
  number: z.string().min(12).max(24),
  exp_month: z.number().int().min(1).max(12),
  exp_year: z.number().int().min(2024).max(2050),
  cvc: z.string().regex(/^\d{3,4}$/),
  name: z.string().min(1).max(128)
});

const PaymentCreate = z.object({
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('GHS'),
  source: z.string().min(6), // card token
  description: z.string().max(256).optional()
});

// Authenticated routes
const v1 = new Hono();

// Cards: create
v1.post('/cards', appwriteAuth, async (c) => {
  const idemKey = c.req.header('Idempotency-Key');
  const user = c.get('user') as { $id: string };
  if (idemKey) {
    const cached = idem.get(`${user.$id}:${idemKey}`);
    if (cached) return c.json(cached.body, cached.status);
  }

  const parse = CardCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) return c.json({ error: 'validation_error', details: parse.error.flatten() }, 400);
  const { number, exp_month, exp_year, cvc, name } = parse.data;

  const normalized = number.replace(/\s+/g, '');
  if (!luhnValid(normalized)) return c.json({ error: 'invalid_card_number' }, 400);
  const brand = detectBrand(normalized);
  const last4 = normalized.slice(-4);
  const token = `tok_${crypto.randomUUID()}`;
  const fingerprint = `fp_${Buffer.from(normalized).toString('base64url').slice(-16)}`;

  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const cardsCollectionId = process.env.APPWRITE_CARDS_COLLECTION_ID!;

  const doc = await databases.createDocument(databaseId, cardsCollectionId, ID.unique(), {
    userId: user.$id,
    holder: name,
    last4,
    brand,
    exp_month,
    exp_year,
    token,
    fingerprint,
    createdAt: new Date().toISOString(),
    type: 'card'
  });

  const body = {
    authorization: { last4, brand, exp_month, exp_year },
    customer: { name },
    token,
    id: doc.$id,
    created: doc.$createdAt
  };
  if (idemKey) idem.set(`${user.$id}:${idemKey}`, { status: 200, body, expiresAt: Date.now() + IDEM_TTL_MS });
  return c.json(body);
});

// Cards: list
v1.get('/cards', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const cardsCollectionId = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  const res = await databases.listDocuments(databaseId, cardsCollectionId, [Query.equal('userId', user.$id)]);
  return c.json({ data: res.documents });
});

// Cards: delete
v1.delete('/cards/:id', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const id = c.req.param('id');
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const cardsCollectionId = process.env.APPWRITE_CARDS_COLLECTION_ID!;

  const res = await databases.getDocument(databaseId, cardsCollectionId, id).catch(() => null as any);
  if (!res) return c.json({ error: 'not_found' }, 404);
  if (res.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  await databases.deleteDocument(databaseId, cardsCollectionId, id);
  return c.json({ ok: true });
});

// Payments: list
v1.get('/payments', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  if (!txCol) return c.json({ error: 'server_missing_transactions_collection' }, 500);
  const res = await databases.listDocuments(databaseId, txCol, [Query.equal('userId', user.$id)]);
  return c.json({ data: res.documents });
});

// Payments: create (authorize)
v1.post('/payments', appwriteAuth, async (c) => {
  const idemKey = c.req.header('Idempotency-Key');
  const user = c.get('user') as { $id: string };
  if (idemKey) {
    const cached = idem.get(`${user.$id}:${idemKey}`);
    if (cached) return c.json(cached.body, cached.status);
  }
  const parse = PaymentCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) return c.json({ error: 'validation_error', details: parse.error.flatten() }, 400);
  const { amount, currency, source, description } = parse.data;
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  if (!txCol) return c.json({ error: 'server_missing_transactions_collection' }, 500);

  const doc = await databases.createDocument(databaseId, txCol, ID.unique(), {
    userId: user.$id,
    amount,
    currency: currency.toUpperCase(),
    source,
    description,
    status: 'authorized',
    createdAt: new Date().toISOString(),
    type: 'payment'
  });
  const body = { id: doc.$id, status: 'authorized', amount, currency: currency.toUpperCase(), created: doc.$createdAt };
  if (idemKey) idem.set(`${user.$id}:${idemKey}`, { status: 200, body, expiresAt: Date.now() + IDEM_TTL_MS });
  return c.json(body);
});

// Payments: capture
v1.post('/payments/:id/capture', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const id = c.req.param('id');
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const doc: any = await databases.getDocument(databaseId, txCol, id).catch(() => null);
  if (!doc) return c.json({ error: 'not_found' }, 404);
  if (doc.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  if (doc.status === 'captured') return c.json({ id: doc.$id, status: 'captured' });
  if (doc.status !== 'authorized') return c.json({ error: `invalid_status:${doc.status}` }, 409);
  const updated = await databases.updateDocument(databaseId, txCol, id, { status: 'captured', capturedAt: new Date().toISOString() });
  return c.json({ id: updated.$id, status: 'captured' });
});

// Payments: refund
v1.post('/payments/:id/refund', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const id = c.req.param('id');
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const doc: any = await databases.getDocument(databaseId, txCol, id).catch(() => null);
  if (!doc) return c.json({ error: 'not_found' }, 404);
  if (doc.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  if (doc.status === 'refunded') return c.json({ id: doc.$id, status: 'refunded' });
  if (doc.status !== 'captured' && doc.status !== 'authorized') return c.json({ error: `invalid_status:${doc.status}` }, 409);
  const updated = await databases.updateDocument(databaseId, txCol, id, { status: 'refunded', refundedAt: new Date().toISOString() });
  return c.json({ id: updated.$id, status: 'refunded' });
});

// Diagnostics: connectivity and collection checks
v1.get('/diag', async (c) => {
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const endpoint = process.env.APPWRITE_ENDPOINT;

  const result: Record<string, any> = {
    ok: true,
    env: {
      endpoint: Boolean(endpoint),
      projectId: Boolean(projectId),
      databaseId: Boolean(databaseId),
      cardsCollectionId: Boolean(cardsCol),
      transactionsCollectionId: Boolean(txCol),
    },
    checks: {}
  };

  try {
    if (!databaseId) throw new Error('missing_database_id');
    // Basic list to ensure access (limit to 1)
    if (cardsCol) {
      try {
        await databases.listDocuments(databaseId, cardsCol, []);
        result.checks.cardsReadable = true;
      } catch (e) {
        result.checks.cardsReadable = false;
        result.ok = false;
      }
    }
    if (txCol) {
      try {
        await databases.listDocuments(databaseId, txCol, []);
        result.checks.transactionsReadable = true;
      } catch (e) {
        result.checks.transactionsReadable = false;
        result.ok = false;
      }
    }
  } catch (e: any) {
    result.ok = false;
    result.error = e?.message || String(e);
  }

  return c.json(result);
});

app.route('/v1', v1);

const port = Number(process.env.PORT || 3000);
console.log(`[server] listening on http://localhost:${port}`);
export default {
  port,
  fetch: app.fetch
};

