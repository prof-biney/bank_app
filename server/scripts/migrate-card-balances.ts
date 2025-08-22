#!/usr/bin/env bun
import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT!;
const projectId = process.env.APPWRITE_PROJECT_ID!;
const apiKey = process.env.APPWRITE_API_KEY!;
const databaseId = process.env.APPWRITE_DATABASE_ID!;
const cardsCol = process.env.APPWRITE_CARDS_COLLECTION_ID!;

const DEFAULT = 40000;

async function main() {
  if (!endpoint || !projectId || !apiKey || !databaseId || !cardsCol) {
    console.error("Missing required Appwrite env vars");
    process.exit(1);
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const db = new Databases(client);

  let cursor: string | null = null;
  let updated = 0, scanned = 0;
  for (;;) {
    const queries: any[] = [Query.limit(100), Query.orderAsc()];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res: any = await db.listDocuments(databaseId, cardsCol, queries);
    const docs: any[] = res.documents || [];
    if (docs.length === 0) break;
    for (const d of docs) {
      scanned++;
      const needsStart = typeof d.startingBalance !== number;
      const needsBalance = typeof d.balance !== number;
      const needsCurrency = !d.currency;
      if (needsStart || needsBalance || needsCurrency) {
        await db.updateDocument(databaseId, cardsCol, d., {
          startingBalance: needsStart ? DEFAULT : d.startingBalance,
          balance: needsBalance ? (typeof d.startingBalance === number ? d.startingBalance : DEFAULT) : d.balance,
          currency: needsCurrency ? GHS : d.currency,
        }).catch(() => {});
        updated++;
      }
    }
    cursor = docs[docs.length - 1].;
  }
  console.log(JSON.stringify({ ok: true, scanned, updated }));
}

main().catch((e) => { console.error(e); process.exit(1); });
