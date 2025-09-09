import { Transaction } from '@/types';
import { StorageManager } from './storageService';
import { logger } from '@/utils/logger';

/**
 * Transaction Service
 * 
 * This service handles all transaction-related API calls and provides 
 * a clean interface for the AppContext to interact with the backend.
 * Now includes caching layer for offline support and improved performance.
 */

interface ApiResponse<T = any> {
  data: T;
  nextCursor?: string | null;
}

interface TransactionFilters {
  type?: string | string[];
  status?: string | string[];
  cardId?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Fetches user transactions from the server API
 * @param filters - Optional filters for the transaction query
 * @returns Promise with transactions data and pagination info
 */
export async function fetchUserTransactions(filters: TransactionFilters = {}): Promise<{ success: boolean; data?: { transactions: Transaction[]; nextCursor?: string | null }; error?: string }> {
  try {
    const { getApiBase } = require('./api');
    const { getValidJWTWithAutoRefresh, refreshAppwriteJWTWithRetry } = require('./jwt');
    
    // Build query parameters
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.cursor) params.append('cursor', filters.cursor);
    if (filters.cardId) params.append('cardId', filters.cardId);
    
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      params.append('type', types.join(','));
    }
    
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      params.append('status', statuses.join(','));
    }

    const url = `${getApiBase()}/v1/transactions?${params.toString()}`;
    logger.info('TRANSACTIONS', '[fetchUserTransactions] Request URL:', url);
    
    // Use improved JWT handling with auto-refresh
    let jwt = await getValidJWTWithAutoRefresh();
    logger.info('TRANSACTIONS', '[fetchUserTransactions] JWT obtained:', !!jwt);

    const makeRequest = async (token: string | undefined) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      logger.info('TRANSACTIONS', '[fetchUserTransactions] Request headers:', { hasAuth: !!token, contentType: headers['Content-Type'] });
      return await fetch(url, { headers });
    };

    let response = await makeRequest(jwt);
    logger.info('TRANSACTIONS', '[fetchUserTransactions] Response status:', response.status, response.statusText);

    // Handle token refresh if needed with improved retry logic
    if (response.status === 401) {
      logger.info('TRANSACTIONS', '[fetchUserTransactions] Got 401, attempting JWT refresh with retry...');
      jwt = await refreshAppwriteJWTWithRetry();
      if (jwt) {
        response = await makeRequest(jwt);
        logger.info('TRANSACTIONS', '[fetchUserTransactions] Retry response status:', response.status, response.statusText);
      } else {
        // JWT refresh failed, likely needs re-authentication
        return {
          success: false,
          error: 'Authentication failed. Please sign in again.'
        };
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // Handle 404 as "no transactions found" rather than an error
      if (response.status === 404) {
        logger.info('TRANSACTIONS', '[fetchUserTransactions] No transactions found (404), returning empty array');
        return {
          success: true,
          data: {
            transactions: [],
            nextCursor: null
          }
        };
      }
      
      logger.error('TRANSACTIONS', '[fetchUserTransactions] HTTP Error:', response.status, response.statusText);
      logger.debug('TRANSACTIONS', '[fetchUserTransactions] Error details:', errorText);
      return {
        success: false,
        error: `Failed to fetch transactions: ${response.status} ${response.statusText}`
      };
    }

    const result = await response.json();
    logger.info('TRANSACTIONS', '[fetchUserTransactions] Success response:', { dataLength: result.data?.length, hasNextCursor: !!result.nextCursor });
    
    return {
      success: true,
      data: {
        transactions: result.data || [],
        nextCursor: result.nextCursor
      }
    };
  } catch (error) {
    logger.error('TRANSACTIONS', 'Error fetching user transactions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Creates a new transaction in the database
 * @param transactionData - Transaction data to create
 * @returns Promise with the created transaction
 */
export async function createTransaction(
  transactionData: Omit<Transaction, 'id' | 'date'>
): Promise<Transaction> {
  try {
    const { getApiBase } = require('./api');
    const { getValidJWT, refreshAppwriteJWT } = require('./jwt');
    
    const url = `${getApiBase()}/v1/transactions`;
    let jwt = await getValidJWT();

    const payload = {
      ...transactionData,
      // Convert frontend format to backend format
      type: transactionData.type,
      amount: transactionData.amount,
      currency: 'GHS',
      description: transactionData.description,
      recipient: transactionData.recipient,
      cardId: transactionData.cardId,
      status: transactionData.status
    };

    const makeRequest = async (token: string | undefined) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
    };

    let response = await makeRequest(jwt);

    // Handle token refresh if needed
    if (response.status === 401 && jwt) {
      logger.info('TRANSACTIONS', '[createTransaction] Got 401, refreshing JWT and retrying...');
      jwt = await refreshAppwriteJWT();
      if (jwt) {
        response = await makeRequest(jwt);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create transaction: ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    logger.error('TRANSACTIONS', 'Error creating transaction:', error);
    throw error;
  }
}

/**
 * Updates a transaction in the database
 * @param transactionId - ID of the transaction to update
 * @param updateData - Data to update
 * @returns Promise with the updated transaction
 */
export async function updateTransaction(
  transactionId: string,
  updateData: Partial<Pick<Transaction, 'status' | 'description' | 'amount'>>
): Promise<Transaction> {
  try {
    const { getApiBase } = require('./api');
    const { getValidJWT, refreshAppwriteJWT } = require('./jwt');
    
    const url = `${getApiBase()}/v1/transactions/${transactionId}`;
    let jwt = await getValidJWT();

    const makeRequest = async (token: string | undefined) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData)
      });
    };

    let response = await makeRequest(jwt);

    // Handle token refresh if needed
    if (response.status === 401 && jwt) {
      logger.info('TRANSACTIONS', '[updateTransaction] Got 401, refreshing JWT and retrying...');
      jwt = await refreshAppwriteJWT();
      if (jwt) {
        response = await makeRequest(jwt);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update transaction: ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    logger.error('TRANSACTIONS', 'Error updating transaction:', error);
    throw error;
  }
}

/**
 * Fetches a single transaction by ID
 * @param transactionId - ID of the transaction to fetch
 * @returns Promise with the transaction
 */
export async function getTransactionById(transactionId: string): Promise<Transaction> {
  try {
    const { getApiBase } = require('./api');
    const { getValidJWT, refreshAppwriteJWT } = require('./jwt');
    
    const url = `${getApiBase()}/v1/transactions/${transactionId}`;
    let jwt = await getValidJWT();

    const makeRequest = async (token: string | undefined) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return await fetch(url, { headers });
    };

    let response = await makeRequest(jwt);

    // Handle token refresh if needed
    if (response.status === 401 && jwt) {
      logger.info('TRANSACTIONS', '[getTransactionById] Got 401, refreshing JWT and retrying...');
      jwt = await refreshAppwriteJWT();
      if (jwt) {
        response = await makeRequest(jwt);
      }
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    logger.error('TRANSACTIONS', 'Error fetching transaction by ID:', error);
    throw error;
  }
}

/**
 * Refreshes transactions by fetching the latest data from the server
 * @param lastCursor - Optional cursor for pagination
 * @returns Promise with fresh transaction data
 */
export async function refreshTransactions(lastCursor?: string) {
  return fetchUserTransactions({
    limit: 50, // Fetch a good amount for initial load
    cursor: lastCursor
  });
}

/**
 * Fetches transactions for a specific card
 * @param cardId - ID of the card to fetch transactions for
 * @param limit - Number of transactions to fetch
 * @returns Promise with card-specific transactions
 */
export async function getCardTransactions(cardId: string, limit = 20): Promise<Transaction[]> {
  const result = await fetchUserTransactions({
    cardId,
    limit
  });
  return result.success ? result.data?.transactions || [] : [];
}

/**
 * Fetches recent transactions (last 30 days)
 * @param limit - Number of transactions to fetch
 * @returns Promise with recent transactions
 */
export async function getRecentTransactions(limit = 20): Promise<Transaction[]> {
  const result = await fetchUserTransactions({
    limit,
    // Note: We could add date filtering here if the backend supports it
  });
  return result.success ? result.data?.transactions || [] : [];
}

// ===== CACHING LAYER =====

/**
 * Get cached transactions from storage
 * @returns Promise with cached transactions and metadata
 */
export async function getCachedTransactions(): Promise<{ transactions: Transaction[]; lastSync: number } | null> {
  try {
    return await StorageManager.getCachedTransactions();
  } catch (error) {
    logger.warn('TRANSACTIONS', '[getCachedTransactions] Failed to read cache:', error);
    return null;
  }
}

/**
 * Cache transactions to storage
 * @param transactions - Transactions to cache
 */
export async function cacheTransactions(transactions: Transaction[]): Promise<void> {
  try {
    await StorageManager.cacheTransactions(transactions);
  } catch (error) {
    logger.error('TRANSACTIONS', '[cacheTransactions] Failed to cache transactions:', error);
    // Don't throw - caching failures shouldn't break the app
  }
}

/**
 * Fetches transactions with cache-first strategy
 * @param filters - Optional filters for the transaction query
 * @param useCache - Whether to return cached data immediately (default: true)
 * @returns Promise with transactions and cache metadata
 */
export async function fetchUserTransactionsWithCache(
  filters: TransactionFilters = {},
  useCache: boolean = true
): Promise<{ 
  success: boolean; 
  data?: { transactions: Transaction[]; nextCursor?: string | null; fromCache?: boolean; lastSync?: number };
  error?: string;
}> {
  let cachedData: { transactions: Transaction[]; lastSync: number } | null = null;
  
  // Step 1: Try to get cached data first if requested
  if (useCache) {
    try {
      cachedData = await getCachedTransactions();
      if (cachedData) {
        logger.info('TRANSACTIONS', `[fetchUserTransactionsWithCache] Found ${cachedData.transactions.length} cached transactions`);
        
        // Return cached data immediately
        const cacheResult = {
          success: true,
          data: {
            transactions: cachedData.transactions,
            nextCursor: null, // Cached data doesn't have cursor info
            fromCache: true,
            lastSync: cachedData.lastSync
          }
        };
        
        // Start background sync (don't await)
        backgroundSyncTransactions(filters).catch(error => 
          logger.warn('TRANSACTIONS', '[fetchUserTransactionsWithCache] Background sync failed:', error)
        );
        
        return cacheResult;
      }
    } catch (error) {
      logger.warn('TRANSACTIONS', '[fetchUserTransactionsWithCache] Cache read failed:', error);
      // Continue to server fetch
    }
  }
  
  // Step 2: Fetch from server
  logger.info('TRANSACTIONS', '[fetchUserTransactionsWithCache] Fetching from server');
  const serverResult = await fetchUserTransactions(filters);
  
  if (serverResult.success && serverResult.data) {
    // Cache the fresh data
    await cacheTransactions(serverResult.data.transactions);
    
    // If we had cached data, merge intelligently
    if (cachedData && cachedData.transactions.length > 0) {
      const merged = StorageManager.mergeTransactions(
        cachedData.transactions, 
        serverResult.data.transactions
      );
      await cacheTransactions(merged);
      
      return {
        success: true,
        data: {
          transactions: merged,
          nextCursor: serverResult.data.nextCursor,
          fromCache: false,
          lastSync: Date.now()
        }
      };
    }
    
    return {
      ...serverResult,
      data: {
        ...serverResult.data,
        fromCache: false,
        lastSync: Date.now()
      }
    };
  }
  
  // Step 3: Server failed, return cached data if available
  if (cachedData) {
    logger.info('TRANSACTIONS', '[fetchUserTransactionsWithCache] Server failed, using cache fallback');
    return {
      success: true,
      data: {
        transactions: cachedData.transactions,
        nextCursor: null,
        fromCache: true,
        lastSync: cachedData.lastSync
      }
    };
  }
  
  // Step 4: Both server and cache failed
  return serverResult;
}

/**
 * Background sync function (non-blocking)
 */
export async function backgroundSyncTransactions(filters: TransactionFilters = {}): Promise<void> {
  try {
    logger.info('TRANSACTIONS', '[backgroundSyncTransactions] Starting background sync');
    const serverResult = await fetchUserTransactions(filters);
    
    if (serverResult.success && serverResult.data) {
      // Get cached data
      const cachedData = await getCachedTransactions();
      
      if (cachedData) {
        // Merge and update cache
        const merged = StorageManager.mergeTransactions(
          cachedData.transactions,
          serverResult.data.transactions
        );
        await cacheTransactions(merged);
        logger.info('TRANSACTIONS', `[backgroundSyncTransactions] Updated cache with ${merged.length} transactions`);
      } else {
        // No cache, just store server data
        await cacheTransactions(serverResult.data.transactions);
        logger.info('TRANSACTIONS', `[backgroundSyncTransactions] Cached ${serverResult.data.transactions.length} transactions`);
      }
    }
  } catch (error) {
    logger.warn('TRANSACTIONS', '[backgroundSyncTransactions] Background sync failed:', error);
  }
}

/**
 * Check if transactions need sync based on staleness
 * @returns Promise with staleness information
 */
export async function checkTransactionsNeedSync(): Promise<boolean> {
  try {
    const staleInfo = await StorageManager.isDataStale();
    return staleInfo.transactions;
  } catch (error) {
    logger.warn('TRANSACTIONS', '[checkTransactionsNeedSync] Check failed:', error);
    return true; // Assume needs sync if check fails
  }
}

/**
 * Force refresh transactions from server and update cache
 * @param filters - Optional filters for the transaction query
 * @returns Promise with fresh transactions
 */
export async function forceRefreshTransactions(filters: TransactionFilters = {}): Promise<{
  success: boolean;
  data?: { transactions: Transaction[]; nextCursor?: string | null };
  error?: string;
}> {
  logger.info('TRANSACTIONS', '[forceRefreshTransactions] Force refreshing from server');
  
  const result = await fetchUserTransactions(filters);
  
  if (result.success && result.data) {
    // Update cache with fresh data
    await cacheTransactions(result.data.transactions);
  }
  
  return result;
}
