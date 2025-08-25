import { Client, Databases } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID;
const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID;
const txCol = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID;

async function main() {
  const result: Record<string, any> = { ok: true, env: {}, checks: {} };
  result.env = {
    endpoint: Boolean(endpoint),
    projectId: Boolean(projectId),
    apiKey: Boolean(apiKey),
    databaseId: Boolean(databaseId),
    cardsCollectionId: Boolean(cardsCol),
    transactionsCollectionId: Boolean(txCol),
  };

  try {
    if (!endpoint || !projectId || !apiKey) throw new Error('Missing endpoint/projectId/apiKey');
    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const db = new Databases(client);

    if (!databaseId) throw new Error('Missing APPWRITE_DATABASE_ID');

    if (cardsCol) {
      try {
        await db.listDocuments(databaseId, cardsCol, []);
        result.checks.cardsReadable = true;
      } catch (e) {
        result.checks.cardsReadable = false;
        result.ok = false;
      }
    }
    if (txCol) {
      try {
        await db.listDocuments(databaseId, txCol, []);
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

  console.log(JSON.stringify(result, null, 2));
}

main();
