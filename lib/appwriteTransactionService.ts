import { ID, Query } from 'react-native-appwrite';
import { databases, appwriteConfig, ensureAuthenticatedClient } from './appwrite';
import { Transaction } from '@/types';
import useAuthStore from '@/store/auth.store';

/**
 * Appwrite Transaction Database Service
 * 
 * Handles all transaction CRUD operations with Appwrite database.
 * Ensures all operations are scoped to the current authenticated user.
 */

export interface CreateTransactionData {
  cardId: string;
  type: 'deposit' | 'transfer' | 'withdraw' | 'payment';
  amount: number;
  description: string;
  recipient?: string;
  category: string;
  status: 'completed' | 'pending' | 'failed';
  currency?: string;
}

export interface UpdateTransactionData {
  status?: 'completed' | 'pending' | 'failed';
  description?: string;
  amount?: number;
}

/**
 * Get current authenticated user ID
 */
function getCurrentUserId(): string {
  const { user } = useAuthStore.getState();
  // Handle both id and $id fields for compatibility
  const userId = (user as any)?.id || (user as any)?.$id;
  if (!userId) {
    console.error('[getCurrentUserId] User object:', user);
    throw new Error('User not authenticated - no user ID found');
  }
  return userId;
}

/**
 * Create a new transaction in Appwrite database
 */
export async function createAppwriteTransaction(transactionData: CreateTransactionData): Promise<Transaction> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !transactionsCollectionId) {
    throw new Error('Appwrite transactions collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();
    
    const documentData = {
      userId,
      cardId: transactionData.cardId,
      type: transactionData.type,
      amount: transactionData.amount,
      description: transactionData.description,
      recipient: transactionData.recipient || '',
      category: transactionData.category,
      status: transactionData.status,
      currency: transactionData.currency || 'GHS',
      // Note: 'date' field removed as server uses $createdAt timestamp
    };

    console.log('[createAppwriteTransaction] Creating transaction:', {
      userId,
      type: transactionData.type,
      amount: transactionData.amount,
      status: transactionData.status
    });

    const document = await databases.createDocument(
      databaseId,
      transactionsCollectionId,
      ID.unique(),
      documentData
    );

    // Convert Appwrite document to Transaction type
    const transaction: Transaction = {
      id: document.$id,
      userId: document.userId,
      cardId: document.cardId,
      type: document.type,
      amount: document.amount,
      description: document.description,
      recipient: document.recipient,
      category: document.category,
      status: document.status,
      date: document.$createdAt || document.date || new Date().toISOString(),
    };

    console.log('[createAppwriteTransaction] Transaction created successfully:', transaction.id);
    return transaction;

  } catch (error) {
    console.error('[createAppwriteTransaction] Failed to create transaction:', error);
    throw new Error(`Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update an existing transaction in Appwrite database
 */
export async function updateAppwriteTransaction(
  transactionId: string, 
  updateData: UpdateTransactionData
): Promise<Transaction> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !transactionsCollectionId) {
    throw new Error('Appwrite transactions collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();

    console.log('[updateAppwriteTransaction] Updating transaction:', {
      transactionId,
      userId,
      updateData
    });

    // First verify the transaction belongs to the current user
    const existingDoc = await databases.getDocument(
      databaseId,
      transactionsCollectionId,
      transactionId
    );

    if (existingDoc.userId !== userId) {
      throw new Error('Unauthorized: Transaction does not belong to current user');
    }

    const document = await databases.updateDocument(
      databaseId,
      transactionsCollectionId,
      transactionId,
      updateData
    );

    // Convert Appwrite document to Transaction type
    const transaction: Transaction = {
      id: document.$id,
      userId: document.userId,
      cardId: document.cardId,
      type: document.type,
      amount: document.amount,
      description: document.description,
      recipient: document.recipient,
      category: document.category,
      status: document.status,
      date: document.date,
    };

    console.log('[updateAppwriteTransaction] Transaction updated successfully:', transaction.id);
    return transaction;

  } catch (error) {
    console.error('[updateAppwriteTransaction] Failed to update transaction:', error);
    throw new Error(`Failed to update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a transaction from Appwrite database
 */
export async function deleteAppwriteTransaction(transactionId: string): Promise<void> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !transactionsCollectionId) {
    throw new Error('Appwrite transactions collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();

    console.log('[deleteAppwriteTransaction] Deleting transaction:', {
      transactionId,
      userId
    });

    // First verify the transaction belongs to the current user
    const existingDoc = await databases.getDocument(
      databaseId,
      transactionsCollectionId,
      transactionId
    );

    if (existingDoc.userId !== userId) {
      throw new Error('Unauthorized: Transaction does not belong to current user');
    }

    await databases.deleteDocument(
      databaseId,
      transactionsCollectionId,
      transactionId
    );

    console.log('[deleteAppwriteTransaction] Transaction deleted successfully:', transactionId);

  } catch (error) {
    console.error('[deleteAppwriteTransaction] Failed to delete transaction:', error);
    throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a single transaction by ID for the current user
 */
export async function getAppwriteTransaction(transactionId: string): Promise<Transaction> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !transactionsCollectionId) {
    throw new Error('Appwrite transactions collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();

    const document = await databases.getDocument(
      databaseId,
      transactionsCollectionId,
      transactionId
    );

    if (document.userId !== userId) {
      throw new Error('Unauthorized: Transaction does not belong to current user');
    }

    // Convert Appwrite document to Transaction type
    const transaction: Transaction = {
      id: document.$id,
      userId: document.userId,
      cardId: document.cardId,
      type: document.type,
      amount: document.amount,
      description: document.description,
      recipient: document.recipient,
      category: document.category,
      status: document.status,
      date: document.date,
    };

    return transaction;

  } catch (error) {
    console.error('[getAppwriteTransaction] Failed to get transaction:', error);
    throw new Error(`Failed to get transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Query transactions for the current user
 */
export async function queryAppwriteTransactions(options: {
  limit?: number;
  offset?: number;
  cardId?: string;
  type?: string;
  status?: string;
  orderBy?: 'date' | '$createdAt';
  orderDirection?: 'asc' | 'desc';
} = {}): Promise<{ transactions: Transaction[]; total: number }> {
  const { transactionsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !transactionsCollectionId) {
    throw new Error('Appwrite transactions collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();
    const queries = [Query.equal('userId', userId)];

    // Add optional filters
    if (options.cardId) {
      queries.push(Query.equal('cardId', options.cardId));
    }
    if (options.type) {
      queries.push(Query.equal('type', options.type));
    }
    if (options.status) {
      queries.push(Query.equal('status', options.status));
    }

    // Add ordering
    const orderBy = options.orderBy || 'date';
    const orderDirection = options.orderDirection || 'desc';
    if (orderDirection === 'desc') {
      queries.push(Query.orderDesc(orderBy));
    } else {
      queries.push(Query.orderAsc(orderBy));
    }

    // Add pagination
    if (options.limit) {
      queries.push(Query.limit(options.limit));
    }
    if (options.offset) {
      queries.push(Query.offset(options.offset));
    }

    console.log('[queryAppwriteTransactions] Querying transactions for user:', userId);

    const response = await databases.listDocuments(
      databaseId,
      transactionsCollectionId,
      queries
    );

    // Convert documents to Transaction types
    const transactions: Transaction[] = response.documents.map(doc => ({
      id: doc.$id,
      userId: doc.userId,
      cardId: doc.cardId,
      type: doc.type,
      amount: doc.amount,
      description: doc.description,
      recipient: doc.recipient,
      category: doc.category,
      status: doc.status,
      date: doc.date,
    }));

    console.log('[queryAppwriteTransactions] Found', transactions.length, 'transactions');

    return {
      transactions,
      total: response.total
    };

  } catch (error) {
    console.error('[queryAppwriteTransactions] Failed to query transactions:', error);
    throw new Error(`Failed to query transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get transactions for a specific card
 */
export async function getAppwriteCardTransactions(cardId: string, limit = 20): Promise<Transaction[]> {
  try {
    const result = await queryAppwriteTransactions({
      cardId,
      limit,
      orderBy: 'date',
      orderDirection: 'desc'
    });
    return result.transactions;
  } catch (error) {
    console.error('[getAppwriteCardTransactions] Failed to get card transactions:', error);
    return [];
  }
}

/**
 * Get recent transactions for the current user
 */
export async function getAppwriteRecentTransactions(limit = 20): Promise<Transaction[]> {
  try {
    const result = await queryAppwriteTransactions({
      limit,
      orderBy: 'date',
      orderDirection: 'desc'
    });
    return result.transactions;
  } catch (error) {
    console.error('[getAppwriteRecentTransactions] Failed to get recent transactions:', error);
    return [];
  }
}
