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

const TransferCreate = z.object({
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('GHS'),
  cardId: z.string().min(1), // card ID
  recipient: z.string().min(1).max(256), // recipient card number
  recipientName: z.string().min(1).max(128).optional(), // recipient card holder name
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

    const detectedBrand = detectBrand(normalized);
    // Map detected brand to valid Appwrite enum values
    const validBrands = ['visa', 'mastercard', 'amex', 'verve', 'discover', 'unionpay', 'jcb'];
    const brand = validBrands.includes(detectedBrand) ? detectedBrand : 'visa'; // Default to visa
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
          const card = await databases.getDocument(databaseId, cardsCol, d.cardId).catch(() => null);
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
    const senderCard: any = await databases.getDocument(databaseId, cardsCol, cardId).catch(() => null);
    if (!senderCard) return c.json({ error: 'card_not_found' }, 404);
    if (senderCard.userId !== user.$id) return c.json({ error: 'forbidden' }, 403);
    
    const currentBalance = typeof senderCard.balance === 'number' ? senderCard.balance : (typeof senderCard.startingBalance === 'number' ? senderCard.startingBalance : DEFAULT_CARD_BALANCE);
    if (amount > currentBalance) return c.json({ error: 'insufficient_funds', available: currentBalance }, 400);
    
    originalBalance = currentBalance;
    
    // Step 2: Search for recipient card that matches both card number and holder name
    const cleanRecipientNumber = recipient.replace(/[^0-9]/g, ''); // Remove all non-digits
    console.log('[transfer.create] searching for recipient', { recipientNumber: cleanRecipientNumber, recipientName });
    
    // Search for cards with matching last4 digits first
    const last4 = cleanRecipientNumber.slice(-4);
    const potentialCards = await databases.listDocuments(databaseId, cardsCol, [
      Query.equal('last4', last4),
      Query.limit(50) // Reasonable limit to avoid performance issues
    ]);
    
    console.log('[transfer.create] found', potentialCards.documents.length, 'cards with matching last4:', last4);
    
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
          console.log('[transfer.create] found matching recipient card:', {
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
      
      console.log('[transfer.create] credited recipient card', {
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
          console.log('[transfer.create] notification sent to recipient:', recipientCard.userId);
        } catch (notifError) {
          console.warn('[transfer.create] failed to send notification:', notifError);
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
    
    console.log('[transfer.create] success', {
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
    console.error('[transfer.create] error occurred, attempting rollback', { error: e?.message });
    
    if (recipientCredited && recipientCard && originalRecipientBalance >= 0) {
      try {
        await databases.updateDocument(databaseId, cardsCol, recipientCard.$id, { balance: originalRecipientBalance });
        console.log('[transfer.create] rolled back recipient balance', { recipientCardId: recipientCard.$id, originalBalance: originalRecipientBalance });
      } catch (rollbackError) {
        console.error('[transfer.create] failed to rollback recipient balance:', rollbackError);
      }
    }
    
    if (balanceDebited && originalBalance > 0) {
      try {
        await databases.updateDocument(databaseId, cardsCol, cardId, { balance: originalBalance });
        console.log('[transfer.create] rolled back sender balance', { cardId, originalBalance });
        
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
        console.error('[transfer.create] failed to rollback sender balance:', rollbackError);
      }
    }
    
    const errInfo = {
      message: e?.message,
      code: e?.code,
      type: e?.type,
      response: e?.response || undefined,
    };
    console.error('[transfer.create] error', { userId: user.$id, cardId, amount, ...errInfo });
    return c.json({ error: 'server_error', message: 'Transfer failed. Any debited amounts have been refunded.', ...errInfo }, 500);
  }
});

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
    console.error('[notifications.create] error', { userId: user.$id, error: e?.message });
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

