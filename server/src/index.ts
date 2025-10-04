import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { z } from 'zod';
import { Client, Databases, ID, Query } from 'node-appwrite';
import { appwriteAuth } from './middleware/auth';
import { luhnValid, detectBrand } from './utils/luhn';
import { validatePhoneForNetwork, isValidGhanaianMobileNumber } from './utils/phoneValidation';
import { logger } from './utils/logger';

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

// Safe getDocument helper for server: tries getDocument and falls back to listDocuments by $id
async function safeGetDocument(databases: Databases, databaseId: string, collectionId: string, documentId: string) {
  try {
    const doc = await databases.getDocument(databaseId, collectionId, documentId).catch(() => null as any);
    if (doc && doc.$id) return doc;
  } catch (err) {}

  try {
    const list = await databases.listDocuments(databaseId, collectionId, [Query.equal('$id', documentId), Query.limit(1)]).catch(() => null as any);
    if (list && list.documents && list.documents.length > 0) return list.documents[0];
  } catch (err) {}

  return null;
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

const TransferCreate = z.object({
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('GHS'),
  cardId: z.string().min(1), // card ID
  recipient: z.string().min(1).max(256), // recipient card number
  recipientName: z.string().min(1).max(128).optional(), // recipient card holder name
  description: z.string().max(256).optional()
});

const DepositCreate = z.object({
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('GHS'),
  cardId: z.string().min(1), // card ID to deposit into
  description: z.string().max(256).optional(),
  escrowMethod: z.enum(['bank_transfer', 'mobile_money', 'cash']).optional().default('mobile_money'),
  // Mobile money specific fields
  mobileNetwork: z.enum(['mtn', 'telecel', 'airteltigo']).optional(),
  mobileNumber: z.string().optional(),
  reference: z.string().max(50).optional()
}).refine((data) => {
  // If mobile money is selected, validate network and phone number
  if (data.escrowMethod === 'mobile_money') {
    if (!data.mobileNetwork) {
      return false;
    }
    if (!data.mobileNumber) {
      return false;
    }
    // Validate phone number for the selected network
    const validation = validatePhoneForNetwork(data.mobileNumber, data.mobileNetwork);
    return validation.isValid;
  }
  return true;
}, {
  message: "Invalid mobile money details: network and valid phone number are required"
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

    const detectedBrand = detectBrand(normalized);
    // Map detected brand to valid Appwrite enum values
    const validBrands = ['visa', 'mastercard', 'amex', 'verve', 'discover', 'unionpay', 'jcb'];
    const brand = validBrands.includes(detectedBrand) ? detectedBrand : 'visa'; // Default to visa
    const last4 = normalized.slice(-4);
    const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`; // simple random token
    const fingerprint = `fp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { databases } = createDb();
    const databaseId = process.env.APPWRITE_DATABASE_ID!;
    const cardsCollectionId = process.env.APPWRITE_CARDS_COLLECTION_ID!;

    // Log non-sensitive diagnostics
    const hasApiKey = Boolean(process.env.APPWRITE_API_KEY);
    logger.info('CARDS', 'cards.create begin', { 
      userId: user.$id, 
      hasApiKey, 
      databaseIdPresent: Boolean(databaseId), 
      cardsCollectionPresent: Boolean(cardsCollectionId) 
    });

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
      type: 'debit' // Changed from 'card' to valid enum value
    });

    const body = {
      authorization: { last4, brand, exp_month, exp_year },
      customer: { name },
      token,
      id: doc.$id,
      created: doc.$createdAt
    };
    if (idemKey) idem.set(`${user.$id}:${idemKey}`, { status: 200, body, expiresAt: Date.now() + IDEM_TTL_MS });
    logger.info('CARDS', 'cards.create success', { userId: user.$id, docId: doc.$id });
    return c.json(body);
  } catch (e: any) {
    const errInfo = {
      message: e?.message,
      code: e?.code,
      type: e?.type,
      response: e?.response || undefined,
    };
    logger.error('CARDS', 'cards.create error', { userId: (c.get('user') as any)?.$id, ...errInfo });
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

  const res = await safeGetDocument(databases, databaseId, cardsCollectionId, id);
  if (!res) return c.json({ error: 'not_found' }, 404);
  if (res.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
  await databases.deleteDocument(databaseId, cardsCollectionId, id);
  return c.json({ ok: true });
});

// Transactions: list (paginated + optional status/type filters) - All transaction types
v1.get('/transactions', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  if (!txCol) return c.json({ error: 'server_missing_transactions_collection' }, 500);

  const limitRaw = Number(c.req.query('limit') || '20');
  const limit = Math.min(Math.max(limitRaw, 1), 100);
  const cursor = c.req.query('cursor') || undefined;
  const statusParam = c.req.query('status') || '';
  const typeParam = c.req.query('type') || '';
  const cardIdParam = c.req.query('cardId') || '';

  const queries: any[] = [
    Query.equal('userId', user.$id),
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ];
  
  // Filter by transaction type if specified
  const types = typeParam.split(',').map(s => s.trim()).filter(Boolean);
  if (types.length > 0) {
    queries.push(Query.equal('type', types.length === 1 ? types[0] : types));
  }
  
  // Filter by status if specified
  const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
  if (statuses.length > 0) {
    queries.push(Query.equal('status', statuses.length === 1 ? statuses[0] : statuses));
  }
  
  // Filter by card ID if specified
  if (cardIdParam) {
    queries.push(Query.equal('cardId', cardIdParam));
  }
  
  if (cursor) queries.push(Query.cursorAfter(cursor));

  const list = await databases.listDocuments(databaseId, txCol, queries);
  const docs = list.documents || [];
  
  // Transform database records to match frontend Transaction interface
  const data = await Promise.all(docs.map(async (d: any) => {
    let cardInfo = null;
    
    // Try to get card info for transactions that have cardId or source (token)
    if (cardsCol && (d.cardId || d.source)) {
      try {
        let cardQuery = [];
        if (d.cardId) {
          cardQuery = [Query.equal('userId', user.$id)];
          const card = await safeGetDocument(databases, databaseId, cardsCol, d.cardId);
          if (card && card.userId === user.$id) cardInfo = card;
        } else if (d.source) {
          // Find card by token for older payment transactions
          const cardList = await databases.listDocuments(databaseId, cardsCol, [
            Query.equal('token', d.source),
            Query.equal('userId', user.$id),
            Query.limit(1)
          ]);
          cardInfo = (cardList.documents || [])[0] || null;
        }
      } catch {
        // Ignore card lookup errors
      }
    }

    return {
      id: d.$id,
      userId: d.userId,
      cardId: d.cardId || cardInfo?.$id || '',
      type: d.type || 'payment',
      amount: typeof d.amount === 'number' ? Math.abs(d.amount) : 0,
      description: d.description || `${(d.type || 'payment').charAt(0).toUpperCase()}${(d.type || 'payment').slice(1)}`,
      recipient: d.recipient || undefined,
      category: d.type || 'general',
      date: d.$createdAt || d.createdAt || new Date().toISOString(),
      status: (d.status === 'captured' || d.status === 'completed') ? 'completed' as const : 
              (d.status === 'failed') ? 'failed' as const : 'pending' as const
    };
  }));
  
  const nextCursor = docs.length === limit ? docs[docs.length - 1].$id : null;
  return c.json({ data, nextCursor });
});

// Payments: list (paginated + optional status/type filters) - Legacy endpoint
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
  const doc: any = await safeGetDocument(databases, databaseId, txCol, id);
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
  const doc: any = await safeGetDocument(databases, databaseId, txCol, id);
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

// Transfers: create and update card balance with recipient crediting
v1.post('/transfers', appwriteAuth, async (c) => {
  const idemKey = c.req.header('Idempotency-Key');
  const user = c.get('user') as { $id: string };
  if (idemKey) {
    const cached = idem.get(`${user.$id}:${idemKey}`);
    if (cached) return c.json(cached.body, cached.status);
  }
  
  const parse = TransferCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) return c.json({ error: 'validation_error', details: parse.error.flatten() }, 400);
  const { amount, currency, cardId, recipient, recipientName, description } = parse.data;
  
  if ((currency || '').toUpperCase() !== 'GHS') return c.json({ error: 'unsupported_currency', expected: 'GHS' }, 400);
  
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!txCol || !cardsCol) return c.json({ error: 'server_missing_collections' }, 500);
  
  let balanceDebited = false;
  let originalBalance = 0;
  let recipientCredited = false;
  let originalRecipientBalance = 0;
  let recipientCard: any = null;
  
  try {
    // Step 1: Get and validate sender card
  const senderCard: any = await safeGetDocument(databases, databaseId, cardsCol, cardId);
  if (!senderCard) return c.json({ error: 'card_not_found' }, 404);
  if (senderCard.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
    
    const currentBalance = typeof senderCard.balance === 'number' ? senderCard.balance : (typeof senderCard.startingBalance === 'number' ? senderCard.startingBalance : DEFAULT_CARD_BALANCE);
    if (amount > currentBalance) return c.json({ error: 'insufficient_funds', available: currentBalance }, 400);
    
    originalBalance = currentBalance;
    
    // Step 2: Search for recipient card that matches both card number and holder name
    const cleanRecipientNumber = recipient.replace(/[^0-9]/g, ''); // Remove all non-digits
    logger.info('TRANSFERS', 'searching for recipient', { recipientNumber: cleanRecipientNumber, recipientName });
    
    // Search for cards with matching last4 digits first
    const last4 = cleanRecipientNumber.slice(-4);
    const potentialCards = await databases.listDocuments(databaseId, cardsCol, [
      Query.equal('last4', last4),
      Query.limit(50) // Reasonable limit to avoid performance issues
    ]);
    
    logger.info('TRANSFERS', 'potential matches found', { count: potentialCards.documents.length, last4 });
    
    // Filter by exact card number match and holder name (if provided)
    for (const card of potentialCards.documents) {
      // Reconstruct full card number for comparison
      const cardLast4 = card.last4 || '';
      if (cleanRecipientNumber.endsWith(cardLast4)) {
        // Check if holder name matches (case-insensitive)
        const cardHolderName = (card.holder || '').toLowerCase().trim();
        const providedName = (recipientName || '').toLowerCase().trim();
        
        if (!recipientName || cardHolderName === providedName) {
          recipientCard = card;
          logger.info('TRANSFERS', 'found matching recipient card', {
            cardId: card.$id,
            userId: card.userId,
            holderName: card.holder,
            last4: card.last4
          });
          break;
        }
      }
    }
    
    // Step 3: Prevent self-transfers (same card to same card)
    if (recipientCard && recipientCard.$id === cardId) {
      return c.json({ error: 'self_transfer_not_allowed', message: 'Cannot transfer to the same card' }, 400);
    }
    
    // Step 4: Debit sender card balance
    const newSenderBalance = Math.max(currentBalance - amount, 0);
    await databases.updateDocument(databaseId, cardsCol, cardId, { balance: newSenderBalance });
    balanceDebited = true;
    
    // Step 5: Credit recipient card if found
    let newRecipientBalance: number | undefined;
    if (recipientCard) {
      const recipientCurrentBalance = typeof recipientCard.balance === 'number' ? 
        recipientCard.balance : 
        (typeof recipientCard.startingBalance === 'number' ? recipientCard.startingBalance : DEFAULT_CARD_BALANCE);
      
      originalRecipientBalance = recipientCurrentBalance;
      newRecipientBalance = recipientCurrentBalance + amount;
      
      await databases.updateDocument(databaseId, cardsCol, recipientCard.$id, { balance: newRecipientBalance });
      recipientCredited = true;
      
      logger.info('TRANSFERS', 'credited recipient card', {
        recipientCardId: recipientCard.$id,
        previousBalance: recipientCurrentBalance,
        newBalance: newRecipientBalance,
        creditAmount: amount
      });
    }
    
    // Step 6: Create transaction record for sender (outgoing transfer)
    const senderTransferDoc = await databases.createDocument(databaseId, txCol, ID.unique(), {
      userId: user.$id,
      cardId: cardId,
      amount: -amount, // Negative for outgoing transfer
      currency: currency.toUpperCase(),
      recipient: recipientCard ? `${recipientCard.holder} (${recipient})` : recipient,
      description: description || `Transfer to ${recipientCard ? recipientCard.holder : recipient}`,
      status: 'completed',
      type: 'transfer'
    });
    
    // Step 7: Create transaction record for recipient (incoming transfer) if card was found
    let recipientTransferDoc: any = null;
    if (recipientCard) {
      recipientTransferDoc = await databases.createDocument(databaseId, txCol, ID.unique(), {
        userId: recipientCard.userId,
        cardId: recipientCard.$id,
        amount: amount, // Positive for incoming transfer
        currency: currency.toUpperCase(),
        recipient: `${senderCard.holder} (${senderCard.cardNumber || `•••• •••• •••• ${senderCard.last4}`})`,
        description: `Transfer from ${senderCard.holder}`,
        status: 'completed',
        type: 'transfer'
      });
      
      // Step 8: Create notification for recipient if notifications are enabled
      if (notifCol && recipientCard.userId !== user.$id) {
        try {
          await databases.createDocument(databaseId, notifCol, ID.unique(), {
            userId: recipientCard.userId,
            type: 'transaction',
            title: 'Money Received',
            message: `You received GHS ${amount.toFixed(2)} from ${senderCard.holder}. Your new balance is GHS ${newRecipientBalance!.toFixed(2)}.`,
            unread: true
          });
          logger.info('TRANSFERS', 'notification sent to recipient', { recipientUserId: recipientCard.userId });
        } catch (notifError) {
          logger.warn('TRANSFERS', 'failed to send notification', { error: notifError });
          // Don't fail the transfer if notification fails
        }
      }
    }
    
    const body = {
      id: senderTransferDoc.$id,
      status: 'completed',
      amount: amount,
      currency: currency.toUpperCase(),
      recipient,
      cardId,
      newBalance: newSenderBalance,
      recipientFound: Boolean(recipientCard),
      recipientCardId: recipientCard?.$id,
      recipientNewBalance: newRecipientBalance,
      recipientTransactionId: recipientTransferDoc?.$id,
      created: senderTransferDoc.$createdAt
    };
    
    if (idemKey) idem.set(`${user.$id}:${idemKey}`, { status: 200, body, expiresAt: Date.now() + IDEM_TTL_MS });
    
    logger.info('TRANSFERS', 'transfer success', {
      userId: user.$id,
      cardId,
      amount,
      newSenderBalance,
      recipientFound: Boolean(recipientCard),
      recipientCardId: recipientCard?.$id,
      newRecipientBalance
    });
    
    return c.json(body);
    
  } catch (e: any) {
    // Rollback logic: if any balance was changed, restore it
    logger.error('TRANSFERS', 'transfer error occurred, attempting rollback', { error: e?.message });
    
    if (recipientCredited && recipientCard && originalRecipientBalance >= 0) {
      try {
        await databases.updateDocument(databaseId, cardsCol, recipientCard.$id, { balance: originalRecipientBalance });
        logger.info('TRANSFERS', 'rolled back recipient balance', { recipientCardId: recipientCard.$id, originalBalance: originalRecipientBalance });
      } catch (rollbackError) {
        logger.error('TRANSFERS', 'failed to rollback recipient balance', { error: rollbackError });
      }
    }
    
    if (balanceDebited && originalBalance > 0) {
      try {
        await databases.updateDocument(databaseId, cardsCol, cardId, { balance: originalBalance });
        logger.info('TRANSFERS', 'rolled back sender balance', { cardId, originalBalance });
        
        // Create a failed transaction record
        await databases.createDocument(databaseId, txCol, ID.unique(), {
          userId: user.$id,
          cardId: cardId,
          amount: -amount,
          currency: currency.toUpperCase(),
          recipient,
          description: `FAILED: ${description || `Transfer to ${recipient}`}`,
          status: 'failed',
          type: 'transfer',
          failureReason: 'system_error'
        });
      } catch (rollbackError) {
        logger.error('TRANSFERS', 'failed to rollback sender balance', { error: rollbackError });
      }
    }
    
    const errInfo = {
      message: e?.message,
      code: e?.code,
      type: e?.type,
      response: e?.response || undefined,
    };
    logger.error('TRANSFERS', 'transfer error', { userId: user.$id, cardId, amount, ...errInfo });
    return c.json({ error: 'server_error', message: 'Transfer failed. Any debited amounts have been refunded.', ...errInfo }, 500);
  }
});

// Deposits: create escrow deposit request
v1.post('/deposits', appwriteAuth, async (c) => {
  const idemKey = c.req.header('Idempotency-Key');
  const user = c.get('user') as { $id: string };
  if (idemKey) {
    const cached = idem.get(`${user.$id}:${idemKey}`);
    if (cached) return c.json(cached.body, cached.status);
  }
  
  const parse = DepositCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parse.success) return c.json({ error: 'validation_error', details: parse.error.flatten() }, 400);
  const { amount, currency, cardId, description, escrowMethod, mobileNetwork, mobileNumber, reference } = parse.data;
  
  if ((currency || '').toUpperCase() !== 'GHS') return c.json({ error: 'unsupported_currency', expected: 'GHS' }, 400);
  
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!txCol || !cardsCol) return c.json({ error: 'server_missing_collections' }, 500);
  
  try {
  // Step 1: Validate card belongs to user
  const card: any = await safeGetDocument(databases, databaseId, cardsCol, cardId);
  if (!card) return c.json({ error: 'card_not_found' }, 404);
  if (card.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
    
    // Step 2: Create pending deposit transaction (escrow phase)
    const depositDoc = await databases.createDocument(databaseId, txCol, ID.unique(), {
      userId: user.$id,
      cardId: cardId,
      amount: amount, // Positive for incoming deposit
      currency: currency.toUpperCase(),
      description: description || `${escrowMethod.replace('_', ' ')} deposit`,
      status: escrowMethod === 'cash' ? 'completed' : 'pending', // Cash is immediate, others are pending
      type: 'deposit',
      escrowMethod,
      mobileNetwork: mobileNetwork || null,
      mobileNumber: mobileNumber || null,
      reference: reference || null,
      pendingUntil: escrowMethod === 'cash' ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h expiry for non-cash
    });
    
    // Step 3: Handle immediate cash deposits
    if (escrowMethod === 'cash') {
      // For cash deposits, immediately update the card balance
      const currentBalance = typeof card.balance === 'number' ? card.balance : 
                           (typeof card.startingBalance === 'number' ? card.startingBalance : DEFAULT_CARD_BALANCE);
      const newBalance = currentBalance + amount;
      
      // Update card balance immediately
      await databases.updateDocument(databaseId, cardsCol, cardId, { balance: newBalance });
      
      // Create success notification
      if (notifCol) {
        try {
          await databases.createDocument(databaseId, notifCol, ID.unique(), {
            userId: user.$id,
            type: 'transaction',
            title: 'Cash Deposit Completed',
            message: `Your cash deposit of GHS ${amount.toFixed(2)} has been successfully added to your card. New balance: GHS ${newBalance.toFixed(2)}.`,
            unread: true
          });
        } catch (notifError) {
          logger.warn('DEPOSITS', 'failed to send cash deposit notification', { error: notifError });
        }
      }
      
      const body = {
        id: depositDoc.$id,
        status: 'completed',
        amount: amount,
        currency: currency.toUpperCase(),
        cardId,
        escrowMethod,
        newBalance,
        confirmationId: `CASH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        created: depositDoc.$createdAt
      };
      
      if (idemKey) idem.set(`${user.$id}:${idemKey}`, { status: 200, body, expiresAt: Date.now() + IDEM_TTL_MS });
      
      logger.info('DEPOSITS', 'cash deposit completed immediately', {
        userId: user.$id,
        depositId: depositDoc.$id,
        cardId,
        amount,
        newBalance
      });
      
      return c.json(body);
    }
    
    // Step 4: Generate escrow payment instructions for non-cash deposits
    const escrowInstructions = generateEscrowInstructions(escrowMethod, amount, depositDoc.$id, mobileNetwork, mobileNumber, reference);
    
    const body = {
      id: depositDoc.$id,
      status: 'pending',
      amount: amount,
      currency: currency.toUpperCase(),
      cardId,
      escrowMethod,
      mobileNetwork,
      instructions: escrowInstructions,
      expiresAt: depositDoc.pendingUntil,
      created: depositDoc.$createdAt
    };
    
    if (idemKey) idem.set(`${user.$id}:${idemKey}`, { status: 200, body, expiresAt: Date.now() + IDEM_TTL_MS });
    
    logger.info('DEPOSITS', 'pending deposit created', {
      userId: user.$id,
      depositId: depositDoc.$id,
      cardId,
      amount,
      escrowMethod
    });
    
    return c.json(body);
    
  } catch (e: any) {
    const errInfo = {
      message: e?.message,
      code: e?.code,
      type: e?.type,
      response: e?.response || undefined,
    };
    logger.error('DEPOSITS', 'deposit create error', { userId: user.$id, cardId, amount, ...errInfo });
    return c.json({ error: 'server_error', message: 'Failed to create deposit request', ...errInfo }, 500);
  }
});

// Deposits: confirm escrow deposit (simulate payment confirmation)
v1.post('/deposits/:id/confirm', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const id = c.req.param('id');
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID!;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  
  try {
    // Step 1: Get and validate deposit transaction
  const depositDoc: any = await safeGetDocument(databases, databaseId, txCol, id);
    if (!depositDoc) return c.json({ error: 'not_found' }, 404);
    if (depositDoc.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
    if (depositDoc.type !== 'deposit') return c.json({ error: 'invalid_transaction_type' }, 400);
    if (depositDoc.status === 'completed') return c.json({ id: depositDoc.$id, status: 'completed', message: 'Already completed' });
    if (depositDoc.status === 'failed') return c.json({ error: 'transaction_failed', message: 'Deposit has failed' }, 400);
    if (depositDoc.status !== 'pending') return c.json({ error: `invalid_status:${depositDoc.status}` }, 409);
    
    // Step 2: Check if deposit has expired
    if (depositDoc.pendingUntil && new Date(depositDoc.pendingUntil) < new Date()) {
      await databases.updateDocument(databaseId, txCol, id, { status: 'failed', failureReason: 'expired' });
      return c.json({ error: 'deposit_expired', message: 'Deposit request has expired' }, 400);
    }
    
    // Step 3: Simulate escrow confirmation (in production, verify actual payment)
    const confirmationResult = await simulateEscrowConfirmation(depositDoc.escrowMethod, depositDoc.amount);
    if (!confirmationResult.success) {
      await databases.updateDocument(databaseId, txCol, id, { 
        status: 'failed', 
        failureReason: confirmationResult.reason || 'payment_failed'
      });
      return c.json({ 
        error: 'payment_failed', 
        message: confirmationResult.message || 'Escrow payment could not be confirmed' 
      }, 400);
    }
    
    // Step 4: Get card and update balance
    const card: any = await safeGetDocument(databases, databaseId, cardsCol, depositDoc.cardId);
    if (!card) {
      await databases.updateDocument(databaseId, txCol, id, { status: 'failed', failureReason: 'card_not_found' });
      return c.json({ error: 'card_not_found' }, 404);
    }
    
    const currentBalance = typeof card.balance === 'number' ? card.balance : 
                         (typeof card.startingBalance === 'number' ? card.startingBalance : DEFAULT_CARD_BALANCE);
    const newBalance = currentBalance + depositDoc.amount;
    
    // Step 5: Update card balance
    await databases.updateDocument(databaseId, cardsCol, depositDoc.cardId, { balance: newBalance });
    
    // Step 6: Mark deposit as completed
    const updatedDeposit = await databases.updateDocument(databaseId, txCol, id, { 
      status: 'completed',
      completedAt: new Date().toISOString(),
      escrowConfirmation: confirmationResult.confirmationId
    });
    
    // Step 7: Create success notification
    if (notifCol) {
      try {
        await databases.createDocument(databaseId, notifCol, ID.unique(), {
          userId: user.$id,
          type: 'transaction',
          title: 'Deposit Completed',
          message: `Your deposit of GHS ${depositDoc.amount.toFixed(2)} has been successfully added to your card. New balance: GHS ${newBalance.toFixed(2)}.`,
          unread: true
        });
      } catch (notifError) {
        logger.warn('DEPOSITS', 'failed to send deposit confirmation notification', { error: notifError });
      }
    }
    
    logger.info('DEPOSITS', 'deposit confirmed and completed', {
      userId: user.$id,
      depositId: id,
      cardId: depositDoc.cardId,
      amount: depositDoc.amount,
      newBalance
    });
    
    return c.json({
      id: updatedDeposit.$id,
      status: 'completed',
      amount: depositDoc.amount,
      cardId: depositDoc.cardId,
      newBalance,
      confirmationId: confirmationResult.confirmationId,
      completedAt: updatedDeposit.completedAt
    });
    
  } catch (e: any) {
    const errInfo = {
      message: e?.message,
      code: e?.code,
      type: e?.type,
    };
    logger.error('DEPOSITS', 'deposit confirm error', { userId: user.$id, depositId: id, ...errInfo });
    return c.json({ error: 'server_error', message: 'Failed to confirm deposit', ...errInfo }, 500);
  }
});

// Helper function to get Ghanaian mobile network details
function getNetworkDetails(network: string) {
  switch (network) {
    case 'mtn':
      return {
        name: 'MTN',
        color: '#FFCC00',
        ussd: '*170#',
        shortCode: '170'
      };
    case 'telecel':
      return {
        name: 'Telecel',
        color: '#0066CC',
        ussd: '*110#',
        shortCode: '110'
      };
    case 'airteltigo':
      return {
        name: 'AirtelTigo',
        color: '#FF0000',
        ussd: '*110#',
        shortCode: '110'
      };
    default:
      return {
        name: 'MTN',
        color: '#FFCC00',
        ussd: '*170#',
        shortCode: '170'
      };
  }
}

// Helper function to generate escrow payment instructions
function generateEscrowInstructions(method: string, amount: number, depositId: string, mobileNetwork?: string, mobileNumber?: string, reference?: string) {
  switch (method) {
    case 'mobile_money':
      const networkDetails = getNetworkDetails(mobileNetwork || 'mtn');
      return {
        method: `${networkDetails.name} Mobile Money`,
        network: mobileNetwork || 'mtn',
        networkName: networkDetails.name,
        networkColor: networkDetails.color,
        steps: [
          `Open your ${networkDetails.name} mobile money app or dial ${networkDetails.ussd}`,
          'Select "Send Money" or "Transfer"',
          `Send GHS ${amount.toFixed(2)} to: ${mobileNumber || '0244-123-456'}`,
          `Reference: ${reference || `DEP-${depositId.slice(-8).toUpperCase()}`}`,
          'Save the transaction receipt',
          'Tap "I\'ve Made Payment" below to confirm your deposit'
        ],
        recipientNumber: mobileNumber || '0244-123-456',
        reference: reference || `DEP-${depositId.slice(-8).toUpperCase()}`,
        estimatedTime: '2-5 minutes',
        networkUssd: networkDetails.ussd
      };
    case 'bank_transfer':
      return {
        method: 'Bank Transfer',
        steps: [
          'Log into your mobile banking app',
          'Select "Transfer to Other Banks"',
          'Bank: Ghana Commercial Bank',
          'Account: 1234567890123456',
          'Name: BankApp Escrow Account',
          `Amount: GHS ${amount.toFixed(2)}`,
          `Reference: DEP-${depositId.slice(-8).toUpperCase()}`,
          'Complete the transfer',
          'Your deposit will be confirmed within 1 business day'
        ],
        bankName: 'Ghana Commercial Bank',
        accountNumber: '1234567890123456',
        accountName: 'BankApp Escrow Account',
        reference: `DEP-${depositId.slice(-8).toUpperCase()}`,
        estimatedTime: '1-2 business days'
      };
    case 'cash':
      return {
        method: 'Cash Deposit',
        steps: [
          'Visit any of our partner locations',
          'Present a valid ID',
          `Deposit GHS ${amount.toFixed(2)}`,
          `Quote reference: DEP-${depositId.slice(-8).toUpperCase()}`,
          'Receive your receipt',
          'Your deposit will be confirmed immediately'
        ],
        reference: `DEP-${depositId.slice(-8).toUpperCase()}`,
        partnerLocations: ['Accra Mall', 'East Legon', 'Kumasi Central'],
        estimatedTime: 'Immediate'
      };
    default:
      return {
        method: 'Unknown',
        steps: ['Contact support for deposit instructions'],
        estimatedTime: 'Unknown'
      };
  }
}

// Helper function to simulate escrow confirmation
async function simulateEscrowConfirmation(method: string, amount: number): Promise<{
  success: boolean;
  confirmationId?: string;
  reason?: string;
  message?: string;
}> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate different success rates based on method
  const random = Math.random();
  let successRate = 0.95; // Default 95% success
  
  switch (method) {
    case 'mobile_money':
      successRate = 0.98; // Mobile money is very reliable
      break;
    case 'bank_transfer':
      successRate = 0.92; // Bank transfers can have issues
      break;
    case 'cash':
      successRate = 0.99; // Cash is most reliable
      break;
  }
  
  if (random <= successRate) {
    return {
      success: true,
      confirmationId: `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    };
  } else {
    // Simulate different failure reasons
    const failureReasons = [
      { reason: 'insufficient_funds', message: 'Insufficient funds in source account' },
      { reason: 'invalid_reference', message: 'Invalid or missing payment reference' },
      { reason: 'network_error', message: 'Network error during payment processing' },
      { reason: 'timeout', message: 'Payment processing timeout' }
    ];
    
    const failure = failureReasons[Math.floor(Math.random() * failureReasons.length)];
    return {
      success: false,
      ...failure
    };
  }
}

// Simulate transfer processing - in a real system, this would call an external payment API
async function simulateTransferProcessing(amount: number, recipient: string): Promise<boolean> {
  // Simulate a 10% failure rate for demonstration
  // In production, this would be replaced with actual payment processor API calls
  const random = Math.random();
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 90% success rate
  return random > 0.1;
}

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

// Notifications: create new notification
v1.post('/notifications', appwriteAuth, async (c) => {
  const user = c.get('user') as { $id: string };
  const { databases } = createDb();
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const notifCol = process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID;
  if (!notifCol) return c.json({ error: 'server_missing_notifications_collection' }, 500);
  
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = z.object({ 
      type: z.string().default('system'),
      title: z.string().min(1).max(255),
      message: z.string().min(1).max(1000),
      unread: z.boolean().default(true)
    }).safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
    }
    
    const doc = await databases.createDocument(databaseId, notifCol, ID.unique(), {
      userId: user.$id,
      type: parsed.data.type,
      title: parsed.data.title,
      message: parsed.data.message,
      unread: parsed.data.unread
    });
    
    return c.json({ 
      id: doc.$id, 
      type: doc.type,
      title: doc.title,
      message: doc.message,
      unread: doc.unread,
      createdAt: doc.$createdAt
    });
  } catch (e: any) {
    logger.error('NOTIFICATIONS', 'notification create error', { userId: user.$id, error: e?.message });
    return c.json({ error: 'server_error', message: e?.message }, 500);
  }
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

  const doc: any = await safeGetDocument(databases, databaseId, notifCol, id);
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

  const doc: any = await safeGetDocument(databases, databaseId, notifCol, id);
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
  logger.error('SENTRY', 'test error triggered', { ts: new Date().toISOString(), user: user.$id || 'anon' });
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
logger.info('SERVER', 'server starting', { port, endpoint: `http://localhost:${port}` });
export default {
  port,
  fetch: app.fetch
};

