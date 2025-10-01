import { AppwriteID as ID, AppwriteQuery as Query, databases, appwriteConfig } from './appwrite/config';
import { Transaction } from '../types/index';
import useAuthStore from '@/store/auth.store';
import { logger } from '@/lib/logger';

export interface UpdateTransactionData {
  amount?: number;
  description?: string;
  status?: 'completed' | 'pending' | 'failed';
}

function getUserId() {
  const { user } = useAuthStore.getState();
  return (user as any)?.$id || (user as any)?.id;
}

export async function createAppwriteTransaction(tx: Omit<Transaction, 'id'>): Promise<Transaction> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  if (!databaseId || !transactionsCollectionId) throw new Error('Transactions collection not configured');
  // Authentication is handled by Appwrite SDK
  try {
    const id = ID.unique();
    const data = { ...tx };
    await databases.createDocument(databaseId, transactionsCollectionId, id, data);
    // Ensure we don't accidentally include an id from tx
    const { id: _maybe, ...rest } = data as any;
    return { id, ...rest } as Transaction;
  } catch (err) {
  logger.error('TRANSACTION', 'createAppwriteTransaction failed', err);
    throw err;
  }
}

export async function updateAppwriteTransaction(id: string, updateData: UpdateTransactionData): Promise<Transaction> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  if (!databaseId || !transactionsCollectionId) throw new Error('Transactions collection not configured');
  // Authentication is handled by Appwrite SDK
  const doc = await databases.updateDocument(databaseId, transactionsCollectionId, id, updateData as any);
  // databases.updateDocument returns { $id, ...fields }
  const { $id, ...fields } = doc as any;
  return { id: $id || id, ...(fields as any) } as Transaction;
}

export async function deleteAppwriteTransaction(id: string): Promise<void> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  if (!databaseId || !transactionsCollectionId) throw new Error('Transactions collection not configured');
  // Authentication is handled by Appwrite SDK
  await databases.deleteDocument(databaseId, transactionsCollectionId, id);
}

export async function getAppwriteTransaction(id: string): Promise<Transaction> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  if (!databaseId || !transactionsCollectionId) throw new Error('Transactions collection not configured');
  const doc = await databases.getDocument(databaseId, transactionsCollectionId, id);
  const { $id, ...fields } = doc as any;
  return { id: $id, ...(fields as any) } as Transaction;
}

export async function queryAppwriteTransactions(options: { limit?: number; offset?: number } = {}) {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  if (!databaseId || !transactionsCollectionId) throw new Error('Transactions collection not configured');
  const userId = getUserId();
  
  const queries: any[] = [];
  
  // Add user filter if userId exists
  if (userId) {
    queries.push(Query.equal('userId', userId));
  }
  
  // Add limit query
  if (options.limit) {
    queries.push(Query.limit(options.limit));
  }
  
  // Add offset/pagination
  if (options.offset) {
    queries.push(Query.offset(options.offset));
  }
  
  // Add ordering by creation date (newest first)
  queries.push(Query.orderDesc('$createdAt'));
  
  const resp = await databases.listDocuments(databaseId, transactionsCollectionId, queries);
  return resp;
}

