/**
 * Appwrite Transaction Service
 * 
 * This module handles all transaction-related operations using Appwrite database with real-time subscriptions.
 * It provides CRUD operations for transactions, real-time notifications, and comprehensive filtering.
 */

import { databaseService, Query, ID, collections } from './database';
import { authService } from './auth';
import { logger } from '../logger';
import { activityLogger } from '../activityLogger';
import { Transaction } from '@/types';

// Transaction service interfaces
export interface CreateTransactionData {
  cardId: string;
  type: 'deposit' | 'transfer' | 'withdraw' | 'payment';
  amount: number;
  description: string;
  recipient?: string;
  category: string;
  status?: 'completed' | 'pending' | 'failed';
  // Mobile money details for deposits
  mobileNumber?: string;
  mobileNetwork?: string;
}

export interface UpdateTransactionData {
  amount?: number;
  description?: string;
  status?: 'completed' | 'pending' | 'failed';
  category?: string;
  // Mobile money details for deposits
  mobileNumber?: string;
  mobileNetwork?: string;
}

export interface TransactionFilters {
  cardId?: string;
  type?: 'deposit' | 'transfer' | 'withdraw' | 'payment';
  status?: 'completed' | 'pending' | 'failed';
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  recipient?: string;
}

export interface TransactionQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: '$createdAt' | 'amount';
  orderDirection?: 'asc' | 'desc';
  filters?: TransactionFilters;
}

// Real-time subscription types
export interface TransactionRealtimeOptions {
  onTransactionCreated?: (transaction: Transaction) => void;
  onTransactionUpdated?: (transaction: Transaction) => void;
  onTransactionDeleted?: (transactionId: string) => void;
  onStatusChanged?: (transactionId: string, newStatus: string, oldStatus: string) => void;
  onError?: (error: any) => void;
}

// Transaction statistics interface
export interface TransactionStats {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalTransfers: number;
  totalPayments: number;
  averageAmount: number;
  totalAmount: number;
  byStatus: {
    completed: number;
    pending: number;
    failed: number;
  };
  byCategory: Record<string, number>;
  monthlyTrend: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
}

/**
 * Appwrite Transaction Service Class
 */
export class AppwriteTransactionService {
  private subscriptions = new Map<string, () => void>();

  constructor() {
    logger.info('TRANSACTION_SERVICE', 'Appwrite Transaction Service initialized');
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated - no user ID found');
    }
    
    logger.info('TRANSACTION_SERVICE', 'Using userId for transaction operations', { userId: user.$id });
    return user.$id;
  }

  /**
   * Transform transaction data to match Appwrite schema
   */
  private transformTransactionForAppwrite(transactionData: CreateTransactionData, userId: string): any {
    return {
      userId,
      cardId: transactionData.cardId,
      type: transactionData.type,
      amount: Math.round(transactionData.amount * 100), // Convert to cents
      description: transactionData.description,
      recipient: transactionData.recipient || null,
      category: transactionData.category,
      status: transactionData.status || 'completed',
      currency: 'GHS', // Add default currency
      mobileNumber: transactionData.mobileNumber || null,
      mobileNetwork: transactionData.mobileNetwork || null,
    };
  }

  /**
   * Transform Appwrite document to Transaction type
   */
  private transformAppwriteToTransaction(doc: any): Transaction {
    return {
      id: doc.$id,
      userId: doc.userId,
      cardId: doc.cardId,
      type: doc.type,
      amount: doc.amount ? (doc.amount / 100) : 0, // Convert from cents
      description: doc.description,
      recipient: doc.recipient,
      category: doc.category,
      date: doc.$createdAt,
      status: doc.status || 'completed',
      mobileNumber: doc.mobileNumber || undefined,
      mobileNetwork: doc.mobileNetwork || undefined,
    };
  }

  /**
   * Create a new transaction
   */
  async createTransaction(transactionData: CreateTransactionData): Promise<Transaction> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('TRANSACTION_SERVICE', 'Creating transaction', {
        userId,
        type: transactionData.type,
        amount: transactionData.amount,
        cardId: transactionData.cardId,
        category: transactionData.category,
      });

      // Transform data for Appwrite schema
      const appwriteData = this.transformTransactionForAppwrite(transactionData, userId);
      
      // Create document in Appwrite
      const document = await databaseService.createDocument(
        collections.transactions.id,
        appwriteData
      );

      // Transform back to Transaction type
      const transaction = this.transformAppwriteToTransaction(document);

      // Log activity to centralized logger (fire-and-forget)
      activityLogger.logTransactionActivity(
        'created',
        transaction.id,
        {
          type: transactionData.type,
          amount: transactionData.amount,
          cardId: transactionData.cardId,
          description: transactionData.description,
          recipientCardId: transactionData.recipient,
        },
        userId
      ).catch(error => {
        logger.warn('TRANSACTION_SERVICE', 'Failed to log transaction creation activity', error);
      });
      
      // Recalculate and update card balance (fire-and-forget)
      this.recalculateCardBalanceAfterTransaction(transactionData.cardId);

      logger.info('TRANSACTION_SERVICE', 'Transaction created successfully', { 
        transactionId: transaction.id 
      });
      return transaction;
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to create transaction', error);
      throw this.handleTransactionError(error, 'Failed to create transaction');
    }
  }

  /**
   * Update an existing transaction
   */
  async updateTransaction(transactionId: string, updateData: UpdateTransactionData): Promise<Transaction> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('TRANSACTION_SERVICE', 'Updating transaction', { 
        transactionId, 
        userId, 
        updateData 
      });

      // First verify the transaction belongs to the current user
      const existingTransaction = await this.getTransaction(transactionId);
      if (existingTransaction.userId !== userId) {
        throw new Error('Unauthorized: Transaction does not belong to current user');
      }

      // Transform update data to match Appwrite schema
      const appwriteUpdateData: any = {};
      
      if (updateData.amount !== undefined) {
        appwriteUpdateData.amount = Math.round(updateData.amount * 100); // Convert to cents
      }
      if (updateData.description !== undefined) {
        appwriteUpdateData.description = updateData.description;
      }
      if (updateData.status !== undefined) {
        appwriteUpdateData.status = updateData.status;
      }
      if (updateData.category !== undefined) {
        appwriteUpdateData.category = updateData.category;
      }
      if (updateData.mobileNumber !== undefined) {
        appwriteUpdateData.mobileNumber = updateData.mobileNumber;
      }
      if (updateData.mobileNetwork !== undefined) {
        appwriteUpdateData.mobileNetwork = updateData.mobileNetwork;
      }

      // Update document in Appwrite
      const document = await databaseService.updateDocument(
        collections.transactions.id,
        transactionId,
        appwriteUpdateData
      );

      // Transform back to Transaction type
      const transaction = this.transformAppwriteToTransaction(document);

      // Log activity for all updates to centralized logger (fire-and-forget)
      activityLogger.logTransactionActivity(
        'updated',
        transaction.id,
        {
          type: transaction.type,
          amount: transaction.amount,
          cardId: transaction.cardId,
          description: transaction.description,
          recipientCardId: transaction.recipient,
        },
        userId
      ).catch(error => {
        logger.warn('TRANSACTION_SERVICE', 'Failed to log transaction update activity', error);
      });

      // Handle status changes with notifications
      if (updateData.status !== undefined && updateData.status !== existingTransaction.status) {
        // Log status change specifically - use 'updated' action since status_updated is not in the allowed actions
        activityLogger.logTransactionActivity(
          'updated',
          transaction.id,
          {
            type: transaction.type,
            amount: transaction.amount,
            cardId: transaction.cardId,
            description: `Status changed from ${existingTransaction.status} to ${updateData.status}`,
          },
          userId
        ).catch(error => {
          logger.warn('TRANSACTION_SERVICE', 'Failed to log status change activity', error);
        });

        // Status change has been logged to centralized activity logger above
        // Activity logging provides all necessary user feedback
      }
      
      // Recalculate and update card balance if amount changed (fire-and-forget)
      if (updateData.amount !== undefined && updateData.amount !== existingTransaction.amount) {
        this.recalculateCardBalanceAfterTransaction(existingTransaction.cardId);
      }

      logger.info('TRANSACTION_SERVICE', 'Transaction updated successfully', { transactionId });
      return transaction;
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to update transaction', error);
      throw this.handleTransactionError(error, 'Failed to update transaction');
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('TRANSACTION_SERVICE', 'Deleting transaction', { transactionId, userId });

      // First verify the transaction belongs to the current user
      const existingTransaction = await this.getTransaction(transactionId);
      if (existingTransaction.userId !== userId) {
        throw new Error('Unauthorized: Transaction does not belong to current user');
      }

      // Delete from database
      await databaseService.deleteDocument(collections.transactions.id, transactionId);

      // Log activity to centralized logger (fire-and-forget)
      // Note: 'deleted' is not in the allowed actions, using 'failed' to indicate deletion
      activityLogger.logTransactionActivity(
        'failed',
        transactionId,
        {
          type: existingTransaction.type,
          amount: existingTransaction.amount,
          cardId: existingTransaction.cardId,
          description: `${existingTransaction.type.charAt(0).toUpperCase() + existingTransaction.type.slice(1)} transaction deleted`,
          failureReason: 'Transaction was deleted'
        },
        userId
      ).catch(error => {
        logger.warn('TRANSACTION_SERVICE', 'Failed to log transaction deletion activity', error);
      });
      
      // Recalculate and update card balance (fire-and-forget)
      this.recalculateCardBalanceAfterTransaction(existingTransaction.cardId);

      logger.info('TRANSACTION_SERVICE', 'Transaction deleted successfully', { transactionId });
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to delete transaction', error);
      throw this.handleTransactionError(error, 'Failed to delete transaction');
    }
  }

  /**
   * Get a single transaction by ID
   */
  async getTransaction(transactionId: string): Promise<Transaction> {
    try {
      const userId = await this.getCurrentUserId();

      const document = await databaseService.getDocument(collections.transactions.id, transactionId);

      if (document.userId !== userId) {
        throw new Error('Unauthorized: Transaction does not belong to current user');
      }

      const transaction = this.transformAppwriteToTransaction(document);
      
      logger.info('TRANSACTION_SERVICE', 'Transaction retrieved', { transactionId });
      return transaction;
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to get transaction', error);
      throw this.handleTransactionError(error, 'Failed to get transaction');
    }
  }

  /**
   * Query transactions for the current user
   */
  async queryTransactions(options: TransactionQueryOptions = {}): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('TRANSACTION_SERVICE', 'Querying transactions for user', { userId, options });

      // Build queries
      const queries = [Query.equal('userId', userId)];

      // Add filters
      if (options.filters) {
        const { 
          cardId, 
          type, 
          status, 
          category, 
          minAmount, 
          maxAmount, 
          dateFrom, 
          dateTo, 
          recipient 
        } = options.filters;
        
        if (cardId) {
          queries.push(Query.equal('cardId', cardId));
        }
        if (type) {
          queries.push(Query.equal('type', type));
        }
        if (status) {
          queries.push(Query.equal('status', status));
        }
        if (category) {
          queries.push(Query.equal('category', category));
        }
        if (recipient) {
          queries.push(Query.equal('recipient', recipient));
        }
        if (minAmount !== undefined) {
          queries.push(Query.greaterThanEqual('amount', Math.round(minAmount * 100)));
        }
        if (maxAmount !== undefined) {
          queries.push(Query.lessThanEqual('amount', Math.round(maxAmount * 100)));
        }
        if (dateFrom) {
          queries.push(Query.greaterThanEqual('$createdAt', dateFrom));
        }
        if (dateTo) {
          queries.push(Query.lessThanEqual('$createdAt', dateTo));
        }
      }

      // Add ordering
      const orderBy = options.orderBy || '$createdAt';
      const orderDirection = options.orderDirection || 'desc';
      if (orderDirection === 'desc') {
        queries.push(Query.orderDesc(orderBy === 'amount' ? 'amount' : orderBy));
      } else {
        queries.push(Query.orderAsc(orderBy === 'amount' ? 'amount' : orderBy));
      }

      // Add pagination
      if (options.limit) {
        queries.push(Query.limit(options.limit));
      }
      if (options.offset) {
        queries.push(Query.offset(options.offset));
      }

      // Execute query
      const response = await databaseService.listDocuments(collections.transactions.id, queries);

      // Transform documents to Transaction type
      const transactions = response.documents.map(doc => this.transformAppwriteToTransaction(doc));

      logger.info('TRANSACTION_SERVICE', 'Transactions queried successfully', { 
        count: transactions.length, 
        total: response.total 
      });

      return { transactions, total: response.total };
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to query transactions', error);
      throw this.handleTransactionError(error, 'Failed to query transactions');
    }
  }

  /**
   * Get transactions for a specific card
   */
  async getCardTransactions(cardId: string, options: Omit<TransactionQueryOptions, 'filters'> & { filters?: Omit<TransactionFilters, 'cardId'> } = {}): Promise<Transaction[]> {
    try {
      const result = await this.queryTransactions({
        ...options,
        filters: {
          ...options.filters,
          cardId,
        },
      });
      
      return result.transactions;
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to get card transactions', { cardId, error });
      return [];
    }
  }

  /**
   * Get recent transactions (last 30 days by default)
   */
  async getRecentTransactions(days: number = 30, limit: number = 50): Promise<Transaction[]> {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      
      const result = await this.queryTransactions({
        filters: {
          dateFrom: dateFrom.toISOString(),
        },
        orderBy: '$createdAt',
        orderDirection: 'desc',
        limit,
      });
      
      return result.transactions;
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to get recent transactions', { days, limit, error });
      return [];
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(dateFrom?: string, dateTo?: string): Promise<TransactionStats> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('TRANSACTION_SERVICE', 'Getting transaction statistics', { 
        userId, 
        dateFrom, 
        dateTo 
      });

      // Query all transactions for the user within date range
      const filters: TransactionFilters = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const { transactions } = await this.queryTransactions({
        filters,
        limit: 10000, // Get all transactions (consider pagination for very large datasets)
      });

      // Calculate statistics
      const stats: TransactionStats = {
        totalTransactions: transactions.length,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalTransfers: 0,
        totalPayments: 0,
        averageAmount: 0,
        totalAmount: 0,
        byStatus: {
          completed: 0,
          pending: 0,
          failed: 0,
        },
        byCategory: {},
        monthlyTrend: [],
      };

      let totalAmount = 0;
      const monthlyData: Record<string, { count: number; amount: number }> = {};

      transactions.forEach(transaction => {
        const amount = transaction.amount;
        totalAmount += amount;

        // Count by type
        switch (transaction.type) {
          case 'deposit':
            stats.totalDeposits++;
            break;
          case 'withdraw':
            stats.totalWithdrawals++;
            break;
          case 'transfer':
            stats.totalTransfers++;
            break;
          case 'payment':
            stats.totalPayments++;
            break;
        }

        // Count by status
        stats.byStatus[transaction.status as keyof typeof stats.byStatus]++;

        // Count by category
        if (!stats.byCategory[transaction.category]) {
          stats.byCategory[transaction.category] = 0;
        }
        stats.byCategory[transaction.category]++;

        // Monthly trend data
        const month = new Date(transaction.date).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { count: 0, amount: 0 };
        }
        monthlyData[month].count++;
        monthlyData[month].amount += amount;
      });

      stats.totalAmount = totalAmount;
      stats.averageAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;

      // Convert monthly data to array and sort
      stats.monthlyTrend = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

      logger.info('TRANSACTION_SERVICE', 'Transaction statistics calculated', stats);
      return stats;
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to get transaction statistics', error);
      throw this.handleTransactionError(error, 'Failed to get transaction statistics');
    }
  }

  /**
   * Subscribe to real-time transaction updates for current user
   */
  subscribeToTransactions(options: TransactionRealtimeOptions = {}): () => void {
    try {
      logger.info('TRANSACTION_SERVICE', 'Setting up real-time transaction subscriptions');

      const unsubscribe = databaseService.subscribeToCollection(
        collections.transactions.id,
        (response) => {
          const { event, payload } = response;
          
          logger.info('TRANSACTION_SERVICE', 'Real-time transaction update received', {
            event,
            transactionId: payload?.$id
          });

          // Only process events for current user's transactions
          if (payload?.userId) {
            authService.getCurrentUser().then(user => {
              if (user && payload.userId === user.$id) {
                const transaction = this.transformAppwriteToTransaction(payload);
                
                switch (event) {
                  case 'databases.*.collections.*.documents.*.create':
                    options.onTransactionCreated?.(transaction);
                    break;
                  case 'databases.*.collections.*.documents.*.update':
                    options.onTransactionUpdated?.(transaction);
                    // Check for status changes
                    if (response.oldPayload?.status !== payload.status) {
                      options.onStatusChanged?.(
                        transaction.id,
                        payload.status,
                        response.oldPayload?.status || 'unknown'
                      );
                    }
                    break;
                  case 'databases.*.collections.*.documents.*.delete':
                    options.onTransactionDeleted?.(payload.$id);
                    break;
                }
              }
            });
          }
        },
        {
          onError: (error) => {
            logger.error('TRANSACTION_SERVICE', 'Real-time subscription error', error);
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `transactions_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('TRANSACTION_SERVICE', 'Unsubscribed from transaction updates');
      };
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to subscribe to transactions', error);
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Subscribe to a specific transaction's updates
   */
  subscribeToTransaction(transactionId: string, options: TransactionRealtimeOptions = {}): () => void {
    try {
      logger.info('TRANSACTION_SERVICE', 'Setting up real-time subscription for transaction', { 
        transactionId 
      });

      const unsubscribe = databaseService.subscribeToDocument(
        collections.transactions.id,
        transactionId,
        (response) => {
          const { event, payload } = response;
          
          logger.info('TRANSACTION_SERVICE', 'Real-time transaction update received', { 
            event, 
            transactionId 
          });

          const transaction = this.transformAppwriteToTransaction(payload);
          
          switch (event) {
            case 'databases.*.collections.*.documents.*.update':
              options.onTransactionUpdated?.(transaction);
              // Check for status changes
              if (response.oldPayload?.status !== payload.status) {
                options.onStatusChanged?.(
                  transaction.id,
                  payload.status,
                  response.oldPayload?.status || 'unknown'
                );
              }
              break;
            case 'databases.*.collections.*.documents.*.delete':
              options.onTransactionDeleted?.(transactionId);
              break;
          }
        },
        {
          onError: (error) => {
            logger.error('TRANSACTION_SERVICE', 'Real-time transaction subscription error', { 
              transactionId, 
              error 
            });
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `transaction_${transactionId}_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('TRANSACTION_SERVICE', 'Unsubscribed from transaction updates', { 
          transactionId 
        });
      };
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to subscribe to transaction', { 
        transactionId, 
        error 
      });
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Subscribe to transactions for a specific card
   */
  subscribeToCardTransactions(cardId: string, options: TransactionRealtimeOptions = {}): () => void {
    try {
      logger.info('TRANSACTION_SERVICE', 'Setting up real-time subscription for card transactions', { 
        cardId 
      });

      const unsubscribe = databaseService.subscribeToCollection(
        collections.transactions.id,
        (response) => {
          const { event, payload } = response;
          
          // Only process events for the specific card
          if (payload?.cardId === cardId && payload?.userId) {
            authService.getCurrentUser().then(user => {
              if (user && payload.userId === user.$id) {
                const transaction = this.transformAppwriteToTransaction(payload);
                
                switch (event) {
                  case 'databases.*.collections.*.documents.*.create':
                    options.onTransactionCreated?.(transaction);
                    break;
                  case 'databases.*.collections.*.documents.*.update':
                    options.onTransactionUpdated?.(transaction);
                    if (response.oldPayload?.status !== payload.status) {
                      options.onStatusChanged?.(
                        transaction.id,
                        payload.status,
                        response.oldPayload?.status || 'unknown'
                      );
                    }
                    break;
                  case 'databases.*.collections.*.documents.*.delete':
                    options.onTransactionDeleted?.(payload.$id);
                    break;
                }
              }
            });
          }
        },
        {
          onError: (error) => {
            logger.error('TRANSACTION_SERVICE', 'Real-time card transactions subscription error', { 
              cardId, 
              error 
            });
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `card_transactions_${cardId}_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('TRANSACTION_SERVICE', 'Unsubscribed from card transaction updates', { 
          cardId 
        });
      };
    } catch (error) {
      logger.error('TRANSACTION_SERVICE', 'Failed to subscribe to card transactions', { 
        cardId, 
        error 
      });
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Unsubscribe from all transaction subscriptions
   */
  unsubscribeAll(): void {
    logger.info('TRANSACTION_SERVICE', 'Unsubscribing from all transaction subscriptions', { 
      count: this.subscriptions.size 
    });
    
    this.subscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('TRANSACTION_SERVICE', 'Error unsubscribing', error);
      }
    });
    
    this.subscriptions.clear();
  }

  /**
   * Recalculate and update card balance after transaction changes (fire-and-forget)
   */
  private async recalculateCardBalanceAfterTransaction(cardId: string): Promise<void> {
    try {
      logger.info('TRANSACTION_SERVICE', 'Recalculating card balance after transaction change', { cardId });
      
      // Import card service to avoid circular dependencies
      const { cardService } = await import('./cardService');
      
      // Recalculate and update the card balance
      await cardService.recalculateAndUpdateCardBalance(cardId);
      
      logger.info('TRANSACTION_SERVICE', 'Card balance recalculated successfully', { cardId });
    } catch (error) {
      // Don't throw - this is a fire-and-forget operation
      logger.warn('TRANSACTION_SERVICE', 'Failed to recalculate card balance after transaction', { 
        cardId, 
        error 
      });
    }
  }


  /**
   * Handle and format transaction-related errors
   */
  private handleTransactionError(error: any, defaultMessage: string): Error {
    let message = defaultMessage;
    
    if (error?.message) {
      if (error.message.includes('Unauthorized')) {
        message = 'You do not have permission to access this transaction.';
      } else if (error.message.includes('not found')) {
        message = 'Transaction not found.';
      } else if (error.message.includes('Invalid amount')) {
        message = 'Transaction amount must be greater than 0.';
      } else {
        message = error.message;
      }
    }

    const formattedError = new Error(message);
    formattedError.stack = error?.stack;
    return formattedError;
  }
}

// Create and export transaction service instance
export const transactionService = new AppwriteTransactionService();

// Export commonly used functions with proper binding
export const createTransaction = transactionService.createTransaction.bind(transactionService);
export const updateTransaction = transactionService.updateTransaction.bind(transactionService);
export const deleteTransaction = transactionService.deleteTransaction.bind(transactionService);
export const getTransaction = transactionService.getTransaction.bind(transactionService);
export const queryTransactions = transactionService.queryTransactions.bind(transactionService);
export const getCardTransactions = transactionService.getCardTransactions.bind(transactionService);
export const getRecentTransactions = transactionService.getRecentTransactions.bind(transactionService);
export const getTransactionStats = transactionService.getTransactionStats.bind(transactionService);
export const subscribeToTransactions = transactionService.subscribeToTransactions.bind(transactionService);
export const subscribeToTransaction = transactionService.subscribeToTransaction.bind(transactionService);
export const subscribeToCardTransactions = transactionService.subscribeToCardTransactions.bind(transactionService);
export const unsubscribeAll = transactionService.unsubscribeAll.bind(transactionService);

// Export default service
export default transactionService;