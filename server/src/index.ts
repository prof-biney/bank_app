import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { z } from 'zod';
import { Client, Databases, ID, Query } from 'node-appwrite';
import { appwriteAuth } from './middleware/auth';
import { luhnValid, detectBrand } from './utils/luhn';

const app = new Hono();

// Dummy mode gate
const IS_DUMMY = (process.env.DUMMY_MODE || '').toLowerCase() === 'true';

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

const DEFAULT_CARD_BALANCE = 40000; // GHS 40,000 starting balance

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

  try {
    const parse = CardCreate.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) return c.json({ error: 'validation_error', details: parse.error.flatten() }, 400);
    const { number, exp_month, exp_year, cvc, name } = parse.data;

    const normalized = number.replace(/\s+/g, '');
    // Always require Luhn-valid numbers
    if (!luhnValid(normalized)) return c.json({ error: 'invalid_card_number', message: 'Invalid card number' }, 400);
    // In dummy mode, reject numbers that contain duplicate 4-digit chunks
    if (IS_DUMMY) {
      const chunks = normalized.match(/\d{4}/g) || [];
      const hasDuplicateChunk = new Set(chunks).size !== chunks.length;
      if (hasDuplicateChunk) {
        return c.json({ error: 'invalid_card_number', message: 'Invalid card number' }, 400);
      }
    }

    const brand = detectBrand(normalized);
    const last4 = normalized.slice(-4);
    const token = `tok_${crypto.randomUUID()}`; // always random token
    const fingerprint = IS_DUMMY
      ? `fp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
      : `fp_${Buffer.from(normalized).toString('base64url').slice(-16)}`;

    const { databases } = createDb();
    const databaseId = process.env.APPWRITE_DATABASE_ID!;
    const cardsCollectionId = process.env.APPWRITE_CARDS_COLLECTION_ID!;

    // Log non-sensitive diagnostics
    const hasApiKey = Boolean(process.env.APPWRITE_API_KEY);
    console.log('[cards.create] begin', { userId: user.$id, hasApiKey, databaseIdPresent: Boolean(databaseId), cardsCollectionPresent: Boolean(cardsCollectionId) });

    const doc = await databases.createDocument(databaseId, cardsCollectionId, ID.unique(), {
      userId: user.$id,
      holder: name,
      last4,
      brand,
      exp_month,
      exp_year,
      token,
      fingerprint,
      currency: 'GHS',
      startingBalance: DEFAULT_CARD_BALANCE,
      balance: DEFAULT_CARD_BALANCE,
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
    console.log('[cards.create] success', { userId: user.$id, docId: doc.$id });
    return c.json(body);
  } catch (e: any) {
    const errInfo = {
      message: e?.message,
      code: e?.code,
      type: e?.type,
      response: e?.response || undefined,
    };
    console.error('[cards.create] error', { userId: (c.get('user') as any)?.$id, ...errInfo });
    return c.json({ error: 'server_error', ...errInfo }, 500);
  }
});

// Cards: list
v1.get('/cards', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const cardsCollectionId = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  const res = await databases.listDocuments(databaseId, cardsCollectionId, [Query.equal('userId', user.$id)]);
  const list = res.documents || [];
  const data = list.map((d: any) => {
    const mm = String(d.exp_month || 1).padStart(2, '0');
    const yy = String(d.exp_year || 0).toString().slice(-2);
    return {
      id: d.$id,
      userId: d.userId,
      cardNumber: `•••• •••• •••• ${d.last4 || '0000'}`,
      cardHolderName: d.holder || 'Card Holder',
      expiryDate: `${mm}/${yy}`,
      balance: typeof d.balance === 'number' ? d.balance : (typeof d.startingBalance === 'number' ? d.startingBalance : DEFAULT_CARD_BALANCE),
      cardType: (d.brand || 'visa').toLowerCase(),
      isActive: true,
      cardColor: '#1F2937',
      currency: d.currency || 'GHS',
      token: d.token,
    };
  });
  return c.json({ data });
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

// Payments: list (paginated + optional status/type filters)
v1.get('/payments', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  if (!txCol) return c.json({ error: 'server_missing_transactions_collection' }, 500);

  const limitRaw = Number(c.req.query('limit') || '10');
  const limit = Math.min(Math.max(limitRaw, 1), 50);
  const cursor = c.req.query('cursor') || undefined;
  const statusParam = c.req.query('status') || '';
  const typeParam = c.req.query('type') || '';

  const queries: any[] = [
    Query.equal('userId', user.$id),
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ];
  const types = typeParam.split(',').map(s => s.trim()).filter(Boolean);
  if (types.length > 0) {
    queries.push(Query.equal('type', types.length === 1 ? types[0] : types));
  } else {
    queries.push(Query.equal('type', 'payment'));
  }
  const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
  if (statuses.length > 0) {
    queries.push(Query.equal('status', statuses.length === 1 ? statuses[0] : statuses));
  }
  if (cursor) queries.push(Query.cursorAfter(cursor));

  const list = await databases.listDocuments(databaseId, txCol, queries);
  const docs = list.documents || [];
  const data = docs.map((d: any) => ({
    id: d.$id,
    status: d.status,
    amount: d.amount,
    currency: d.currency,
    created: d.$createdAt || d.createdAt,
  }));
  const nextCursor = docs.length === limit ? docs[docs.length - 1].$id : null;
  return c.json({ data, nextCursor });
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
  if ((currency || '').toUpperCase() !== 'GHS') return c.json({ error: 'unsupported_currency', expected: 'GHS' }, 400);
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
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  const doc: any = await databases.getDocument(databaseId, txCol, id).catch(() => null);
  if (!doc) return c.json({ error: 'not_found' }, 404);
  if (doc.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  if (doc.status === 'captured') return c.json({ id: doc.$id, status: 'captured' });
  if (doc.status !== 'authorized') return c.json({ error: `invalid_status:${doc.status}` }, 409);
  const updated = await databases.updateDocument(databaseId, txCol, id, { status: 'captured', capturedAt: new Date().toISOString() });

  // Adjust card balance: subtract amount from card with matching token
  try {
    const token = doc.source;
    if (token && cardsCol) {
      const list = await databases.listDocuments(databaseId, cardsCol, [Query.equal('token', token), Query.equal('userId', user.$id), Query.limit(1)]);
      const card = (list.documents || [])[0] as any;
      if (card) {
        const start = typeof card.startingBalance === 'number' ? card.startingBalance : DEFAULT_CARD_BALANCE;
        const prev = typeof card.balance === 'number' ? card.balance : start;
        const next = Math.max(prev - Number(doc.amount || 0), 0);
        await databases.updateDocument(databaseId, cardsCol, card.$id, { balance: next });
      }
    }
  } catch {}

  return c.json({ id: updated.$id, status: 'captured' });
});

// Payments: refund
v1.post('/payments/:id/refund', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const id = c.req.param('id');
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  const doc: any = await databases.getDocument(databaseId, txCol, id).catch(() => null);
  if (!doc) return c.json({ error: 'not_found' }, 404);
  if (doc.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  if (doc.status === 'refunded') return c.json({ id: doc.$id, status: 'refunded' });
  if (doc.status !== 'captured' && doc.status !== 'authorized') return c.json({ error: `invalid_status:${doc.status}` }, 409);
  const updated = await databases.updateDocument(databaseId, txCol, id, { status: 'refunded', refundedAt: new Date().toISOString() });

  // Adjust card balance: add amount back to card (clamp to startingBalance)
  try {
    const token = doc.source;
    if (token && cardsCol) {
      const list = await databases.listDocuments(databaseId, cardsCol, [Query.equal('token', token), Query.equal('userId', user.$id), Query.limit(1)]);
      const card = (list.documents || [])[0] as any;
      if (card) {
        const start = typeof card.startingBalance === 'number' ? card.startingBalance : DEFAULT_CARD_BALANCE;
        const prev = typeof card.balance === 'number' ? card.balance : start;
        const next = Math.min(prev + Number(doc.amount || 0), start);
        await databases.updateDocument(databaseId, cardsCol, card.$id, { balance: next });
      }
    }
  } catch {}

return c.json({ id: updated.$id, status: 'refunded' });
});

// Dev-only: seed transactions (dummy mode)
const SeedReq = z.object({
  count: z.number().int().min(1).max(200),
  cardToken: z.string().min(6).optional(),
  skipIfNotEmpty: z.boolean().optional(),
});

v1.post('/dev/seed-transactions', appwriteAuth, async (c) => {
  if (!IS_DUMMY) return c.json({ error: 'not_found' }, 404);
  const user = c.get('user') as { $id: string };
  const parsed = SeedReq.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  const { count, cardToken, skipIfNotEmpty } = parsed.data;

  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;

  if (!txCol || !cardsCol) return c.json({ error: 'server_missing_collections' }, 500);

  if (skipIfNotEmpty) {
    const existing = await databases.listDocuments(databaseId, txCol, [Query.equal('userId', user.$id), Query.limit(1)]);
    if ((existing.documents || []).length > 0) {
      return c.json({ ok: true, seeded: 0 });
    }
  }

  let tokens: string[] = [];
  if (cardToken) {
    tokens = [cardToken];
  } else {
    const cardList = await databases.listDocuments(databaseId, cardsCol, [Query.equal('userId', user.$id), Query.limit(100)]);
    tokens = (cardList.documents || []).map((d: any) => d.token).filter(Boolean);
  }
  if (tokens.length === 0) return c.json({ ok: true, seeded: 0, note: 'no cards' });

  const now = Date.now();
  const DAY = 86400000;
  let seeded = 0;

  async function adjustByToken(token: string, delta: number) {
    const list = await databases.listDocuments(databaseId, cardsCol, [Query.equal('token', token), Query.equal('userId', user.$id), Query.limit(1)]);
    const card = (list.documents || [])[0] as any;
    if (!card) return;
    const start = typeof card.startingBalance === 'number' ? card.startingBalance : DEFAULT_CARD_BALANCE;
    const prev = typeof card.balance === 'number' ? card.balance : start;
    let next = prev + delta;
    if (delta < 0) next = Math.max(next, 0);
    else next = Math.min(next, start);
    await databases.updateDocument(databaseId, cardsCol, card.$id, { balance: next });
  }

  function pickStatus(): 'authorized' | 'captured' | 'refunded' {
    const r = Math.random();
    if (r < 0.6) return 'captured';
    if (r < 0.85) return 'authorized';
    return 'refunded';
  }

  for (let i = 0; i < count; i++) {
    const tkn = tokens[Math.floor(Math.random() * tokens.length)];
    const amount = Math.floor(5 + Math.random() * 1995);
    const status = pickStatus();
    const ts = new Date(now - Math.floor(Math.random() * 90 * DAY)).toISOString();

    await databases.createDocument(databaseId, txCol, ID.unique(), {
      userId: user.$id,
      amount,
      currency: 'GHS',
      source: tkn,
      description: 'Seeded transaction',
      status,
      createdAt: ts,
      ...(status === 'captured' ? { capturedAt: ts } : {}),
      ...(status === 'refunded' ? { refundedAt: ts } : {}),
      type: 'payment'
    });

    if (status === 'captured') {
      await adjustByToken(tkn, -amount);
    } else if (status === 'refunded') {
      await adjustByToken(tkn, +amount);
    }

    seeded++;
  }

  return c.json({ ok: true, seeded });
});

// Notifications: clear all for current user
v1.post('/notifications/clear', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!notifCol) return c.json({ error: 'server_missing_notifications_collection' }, 500);
  const list = await databases.listDocuments(databaseId, notifCol, [Query.equal('userId', user.$id)]);
  for (const d of list.documents) {
    await databases.deleteDocument(databaseId, notifCol, d.$id).catch(() => {});
  }
  return c.json({ ok: true, cleared: list.documents.length });
});

// Notifications: list (paginated)
v1.get('/notifications', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!notifCol) return c.json({ error: 'server_missing_notifications_collection' }, 500);
  const limitRaw = Number(c.req.query('limit') || '15');
  const limit = Math.min(Math.max(limitRaw, 1), 50);
  const cursor = c.req.query('cursor') || undefined;
  const queries: any[] = [
    Query.equal('userId', user.$id),
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const list = await databases.listDocuments(databaseId, notifCol, queries);
  const docs = list.documents || [];
  const nextCursor = docs.length === limit ? docs[docs.length - 1].$id : null;
  return c.json({ data: docs, nextCursor });
});

// Notifications: update (read/unread)
v1.patch('/notifications/:id', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const id = c.req.param('id');
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!notifCol) return c.json({ error: 'server_missing_notifications_collection' }, 500);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ unread: z.boolean() }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const doc: any = await databases.getDocument(databaseId, notifCol, id).catch(() => null);
  if (!doc) return c.json({ error: 'not_found' }, 404);
  if (doc.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  const updated = await databases.updateDocument(databaseId, notifCol, id, { unread: parsed.data.unread });
  return c.json({ id: updated.$id, unread: updated.unread, updated: true });
});

// Notifications: delete single
v1.delete('/notifications/:id', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const id = c.req.param('id');
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!notifCol) return c.json({ error: 'server_missing_notifications_collection' }, 500);

  const doc: any = await databases.getDocument(databaseId, notifCol, id).catch(() => null);
  if (!doc) return c.json({ error: 'not_found' }, 404);
  if (doc.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  await databases.deleteDocument(databaseId, notifCol, id);
  return c.json({ ok: true });
});

// Notifications: delete all read
v1.post('/notifications/delete-read', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!notifCol) return c.json({ error: 'server_missing_notifications_collection' }, 500);

  const list = await databases.listDocuments(databaseId, notifCol, [
    Query.equal('userId', user.$id),
    Query.equal('unread', false),
    Query.limit(100)
  ]);
  let deleted = 0;
  for (const d of list.documents) {
    await databases.deleteDocument(databaseId, notifCol, d.$id).catch(() => {});
    deleted++;
  }
  return c.json({ ok: true, deleted });
});

// Notifications: mark all (read/unread)
v1.post('/notifications/mark-all', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!notifCol) return c.json({ error: 'server_missing_notifications_collection' }, 500);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ unread: z.boolean() }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);

  const list = await databases.listDocuments(databaseId, notifCol, [
    Query.equal('userId', user.$id),
    Query.limit(100)
  ]);
  let updatedCount = 0;
  for (const d of list.documents) {
    await databases.updateDocument(databaseId, notifCol, d.$id, { unread: parsed.data.unread }).catch(() => {});
    updatedCount++;
  }
  return c.json({ ok: true, updated: updatedCount, unread: parsed.data.unread });
});

// Sentry check endpoints
v1.get('/sentry/env', (c) => {
  const dsn = process.env.SENTRY_DSN || process.env.SENTRY_SERVER_DSN || '';
  const environment = process.env.SENTRY_ENVIRONMENT || process.env.APP_ENV || process.env.NODE_ENV || 'unknown';
  const release = process.env.SENTRY_RELEASE || '';
  return c.json({ dsnConfigured: Boolean(dsn), environment, release });
});

v1.post('/sentry/test', appwriteAuth, async (c) => {
  const user = (c.get('user') as any) || {};
  console.error('[sentry:test] sample error triggered', { ts: new Date().toISOString(), user: user.$id || 'anon' });
  return c.json({ ok: true }, 202);
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
      dummyMode: IS_DUMMY,
    },
    checks: {}
  };

  try {
    if (!databaseId) throw new Error('missing_database_id');
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

