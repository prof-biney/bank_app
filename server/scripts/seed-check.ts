import { Client, Databases } from 'node-appwrite';

// Define required fields per collection
const REQUIRED = {
  cards: ['userId','holder','last4','brand','exp_month','exp_year','token','fingerprint','createdAt','type'],
  transactions: ['userId','amount','currency','source','status','createdAt','type']
};

async function main() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID;
  const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID;

  const out: Record<string, any> = { ok: true, missing: {} };

  if (!endpoint || !projectId || !apiKey || !databaseId) {
    out.ok = false;
    out.error = 'Missing one or more required env vars for server (endpoint, projectId, apiKey, databaseId)';
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const db = new Databases(client);

  // Helper to check attributes
  async function check(colId: string, label: 'cards'|'transactions') {
    const col = await db.getCollection(databaseId, colId);
    const attrs: string[] = (col?.attributes || []).map((a: any) => a.key).filter(Boolean);
    const missing = REQUIRED[label].filter((k) => !attrs.includes(k));
    if (missing.length) {
      out.ok = false;
      out.missing[label] = missing;
    }
  }

  try {
    if (cardsCol) await check(cardsCol, 'cards');
    if (txCol) await check(txCol, 'transactions');
  } catch (e: any) {
    out.ok = false;
    out.error = e?.message || String(e);
  }

  console.log(JSON.stringify(out, null, 2));
}

main();
