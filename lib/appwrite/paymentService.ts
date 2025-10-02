/**
 * Appwrite Payment Service
 * 
 * This module handles all payment-related operations using Appwrite database.
 * It provides CRUD operations for payments, real-time subscriptions, and comprehensive filtering.
 */

import { databaseService, Query, ID, collections } from './database';
import { authService } from './auth';
import { logger } from '../logger';
import { activityLogger } from '../activityLogger';

// Payment service interfaces
export interface CreatePaymentData {
  cardId: string;
  type: 'mobile_money' | 'bank_transfer' | 'card' | 'cash';
  amount: number;
  currency: string;
  description: string;
  recipientId?: string;
  recipientDetails?: {
    name: string;
    phone?: string;
    email?: string;
    bankAccount?: string;
  };
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  metadata?: Record<string, any>;
  // Mobile money specific
  mobileNumber?: string;
  mobileNetwork?: string;
  // Bank transfer specific
  bankCode?: string;
  accountNumber?: string;
}

export interface UpdatePaymentData {
  amount?: number;
  description?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  recipientDetails?: {
    name?: string;
    phone?: string;
    email?: string;
    bankAccount?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentFilters {
  cardId?: string;
  type?: 'mobile_money' | 'bank_transfer' | 'card' | 'cash';
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  recipientId?: string;
  currency?: string;
  reference?: string;
}

export interface PaymentQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: '$createdAt' | 'amount' | 'status';
  orderDirection?: 'asc' | 'desc';
  filters?: PaymentFilters;
}

// Payment interface
export interface Payment {
  id: string;
  userId: string;
  cardId: string;
  type: 'mobile_money' | 'bank_transfer' | 'card' | 'cash';
  amount: number;
  currency: string;
  description: string;
  recipientId?: string;
  recipientDetails?: {
    name: string;
    phone?: string;
    email?: string;
    bankAccount?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  // Mobile money specific
  mobileNumber?: string;
  mobileNetwork?: string;
  // Bank transfer specific
  bankCode?: string;
  accountNumber?: string;
}

// Payment statistics interface
export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  averageAmount: number;
  byStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  byType: {
    mobile_money: number;
    bank_transfer: number;
    card: number;
    cash: number;
  };
  byCurrency: Record<string, number>;
  monthlyTrend: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
}

/**
 * Appwrite Payment Service Class
 */
export class AppwritePaymentService {
  private subscriptions = new Map<string, () => void>();

  constructor() {
    logger.info('PAYMENT_SERVICE', 'Appwrite Payment Service initialized');
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated - no user ID found');
    }
    
    logger.info('PAYMENT_SERVICE', 'Using userId for payment operations', { userId: user.$id });
    return user.$id;
  }

  /**
   * Transform payment data to match Appwrite schema
   */
  private transformPaymentForAppwrite(paymentData: CreatePaymentData, userId: string): any {
    return {
      userId,
      cardId: paymentData.cardId,
      type: paymentData.type,
      amount: Math.round(paymentData.amount * 100), // Convert to cents
      currency: paymentData.currency,
      description: paymentData.description,
      recipientId: paymentData.recipientId || null,
      recipientDetails: paymentData.recipientDetails || null,
      status: paymentData.status || 'pending',
      reference: paymentData.reference,
      metadata: paymentData.metadata || null,
      mobileNumber: paymentData.mobileNumber || null,
      mobileNetwork: paymentData.mobileNetwork || null,
      bankCode: paymentData.bankCode || null,
      accountNumber: paymentData.accountNumber || null,
    };
  }

  /**
   * Transform Appwrite document to Payment type
   */
  private transformAppwriteToPayment(doc: any): Payment {
    return {
      id: doc.$id,
      userId: doc.userId,
      cardId: doc.cardId,
      type: doc.type,
      amount: doc.amount ? (doc.amount / 100) : 0, // Convert from cents
      currency: doc.currency,
      description: doc.description,
      recipientId: doc.recipientId,
      recipientDetails: doc.recipientDetails,
      status: doc.status,
      reference: doc.reference,
      metadata: doc.metadata,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt,
      mobileNumber: doc.mobileNumber || undefined,
      mobileNetwork: doc.mobileNetwork || undefined,
      bankCode: doc.bankCode || undefined,
      accountNumber: doc.accountNumber || undefined,
    };
  }

  /**
   * Create a new payment
   */
  async createPayment(paymentData: CreatePaymentData): Promise<Payment> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('PAYMENT_SERVICE', 'Creating payment', {
        userId,
        type: paymentData.type,
        amount: paymentData.amount,
        currency: paymentData.currency,
        reference: paymentData.reference,
      });

      // Transform data for Appwrite schema
      const appwriteData = this.transformPaymentForAppwrite(paymentData, userId);
      
      // Create document in Appwrite
      const document = await databaseService.createDocument(
        collections.payments.id,
        appwriteData
      );

      // Transform back to Payment type
      const payment = this.transformAppwriteToPayment(document);

      // Log activity to centralized logger (fire-and-forget)
      activityLogger.logPaymentActivity(
        'created',
        payment.id,
        {
          type: paymentData.type,
          amount: paymentData.amount,
          currency: paymentData.currency,
          cardId: paymentData.cardId,
          description: paymentData.description,
          reference: paymentData.reference,
        },
        userId
      ).catch(error => {
        logger.warn('PAYMENT_SERVICE', 'Failed to log payment creation activity', error);
      });

      logger.info('PAYMENT_SERVICE', 'Payment created successfully', { 
        paymentId: payment.id,
        reference: payment.reference
      });
      return payment;
    } catch (error) {
      logger.error('PAYMENT_SERVICE', 'Failed to create payment', error);
      throw this.handlePaymentError(error, 'Failed to create payment');
    }
  }

  /**
   * Update an existing payment
   */
  async updatePayment(paymentId: string, updateData: UpdatePaymentData): Promise<Payment> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('PAYMENT_SERVICE', 'Updating payment', { 
        paymentId, 
        userId, 
        updateData 
      });

      // First verify the payment belongs to the current user
      const existingPayment = await this.getPayment(paymentId);
      if (existingPayment.userId !== userId) {
        throw new Error('Unauthorized: Payment does not belong to current user');
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
      if (updateData.recipientDetails !== undefined) {
        appwriteUpdateData.recipientDetails = updateData.recipientDetails;
      }
      if (updateData.metadata !== undefined) {
        appwriteUpdateData.metadata = updateData.metadata;
      }

      // Update document in Appwrite
      const document = await databaseService.updateDocument(
        collections.payments.id,
        paymentId,
        appwriteUpdateData
      );

      // Transform back to Payment type
      const payment = this.transformAppwriteToPayment(document);

      // Log activity for all updates to centralized logger (fire-and-forget)
      activityLogger.logPaymentActivity(
        'updated',
        payment.id,
        {
          type: payment.type,
          amount: payment.amount,
          currency: payment.currency,
          cardId: payment.cardId,
          description: payment.description,
          reference: payment.reference,
        },
        userId
      ).catch(error => {
        logger.warn('PAYMENT_SERVICE', 'Failed to log payment update activity', error);
      });

      // Handle status changes with notifications
      if (updateData.status !== undefined && updateData.status !== existingPayment.status) {
        // Log status change specifically
        activityLogger.logPaymentActivity(
          'updated',
          payment.id,
          {
            type: payment.type,
            amount: payment.amount,
            currency: payment.currency,
            cardId: payment.cardId,
            description: `Status changed from ${existingPayment.status} to ${updateData.status}`,
            reference: payment.reference,
          },
          userId
        ).catch(error => {
          logger.warn('PAYMENT_SERVICE', 'Failed to log status change activity', error);
        });
      }

      logger.info('PAYMENT_SERVICE', 'Payment updated successfully', { paymentId });
      return payment;
    } catch (error) {
      logger.error('PAYMENT_SERVICE', 'Failed to update payment', error);
      throw this.handlePaymentError(error, 'Failed to update payment');
    }
  }

  /**
   * Delete a payment
   */
  async deletePayment(paymentId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('PAYMENT_SERVICE', 'Deleting payment', { paymentId, userId });

      // First verify the payment belongs to the current user
      const existingPayment = await this.getPayment(paymentId);
      if (existingPayment.userId !== userId) {
        throw new Error('Unauthorized: Payment does not belong to current user');
      }

      // Delete document from Appwrite
      await databaseService.deleteDocument(collections.payments.id, paymentId);

      // Log activity to centralized logger (fire-and-forget)
      activityLogger.logPaymentActivity(
        'deleted',
        paymentId,
        {
          type: existingPayment.type,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          cardId: existingPayment.cardId,
          description: existingPayment.description,
          reference: existingPayment.reference,
        },
        userId
      ).catch(error => {
        logger.warn('PAYMENT_SERVICE', 'Failed to log payment deletion activity', error);
      });

      logger.info('PAYMENT_SERVICE', 'Payment deleted successfully', { paymentId });
    } catch (error) {
      logger.error('PAYMENT_SERVICE', 'Failed to delete payment', error);
      throw this.handlePaymentError(error, 'Failed to delete payment');
    }
  }

  /**
   * Get a single payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('PAYMENT_SERVICE', 'Retrieving payment', { paymentId, userId });

      const document = await databaseService.getDocument(collections.payments.id, paymentId);
      const payment = this.transformAppwriteToPayment(document);

      // Verify the payment belongs to the current user
      if (payment.userId !== userId) {
        throw new Error('Unauthorized: Payment does not belong to current user');
      }

      logger.info('PAYMENT_SERVICE', 'Payment retrieved successfully', { paymentId });
      return payment;
    } catch (error) {
      logger.error('PAYMENT_SERVICE', 'Failed to retrieve payment', error);
      throw this.handlePaymentError(error, 'Failed to retrieve payment');
    }
  }

  /**
   * Query payments with filters and pagination
   */
  async queryPayments(options: PaymentQueryOptions = {}): Promise<{
    payments: Payment[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('PAYMENT_SERVICE', 'Querying payments for user', {
        userId,
        options
      });

      const queries: any[] = [];
      
      // Always filter by current user
      queries.push(Query.equal('userId', userId));

      // Apply filters
      if (options.filters) {
        const { filters } = options;
        
        if (filters.cardId) {
          queries.push(Query.equal('cardId', filters.cardId));
        }
        
        if (filters.type) {
          queries.push(Query.equal('type', filters.type));
        }
        
        if (filters.status) {
          queries.push(Query.equal('status', filters.status));
        }
        
        if (filters.currency) {
          queries.push(Query.equal('currency', filters.currency));
        }
        
        if (filters.reference) {
          queries.push(Query.equal('reference', filters.reference));
        }
        
        if (filters.recipientId) {
          queries.push(Query.equal('recipientId', filters.recipientId));
        }
        
        if (filters.minAmount !== undefined) {
          queries.push(Query.greaterThanEqual('amount', Math.round(filters.minAmount * 100)));
        }
        
        if (filters.maxAmount !== undefined) {
          queries.push(Query.lessThanEqual('amount', Math.round(filters.maxAmount * 100)));
        }
        
        if (filters.dateFrom) {
          queries.push(Query.greaterThanEqual('$createdAt', filters.dateFrom));
        }
        
        if (filters.dateTo) {
          queries.push(Query.lessThanEqual('$createdAt', filters.dateTo));
        }
      }

      // Apply ordering
      const orderBy = options.orderBy || '$createdAt';
      const orderDirection = options.orderDirection || 'desc';
      
      if (orderDirection === 'desc') {
        queries.push(Query.orderDesc(orderBy));
      } else {
        queries.push(Query.orderAsc(orderBy));
      }

      // Apply pagination
      const limit = Math.min(options.limit || 20, 100); // Max 100 items per request
      queries.push(Query.limit(limit));
      
      if (options.offset) {
        queries.push(Query.offset(options.offset));
      }

      const response = await databaseService.listDocuments(collections.payments.id, queries);
      
      const payments = response.documents.map(doc => this.transformAppwriteToPayment(doc));
      const total = response.total;
      const hasMore = (options.offset || 0) + payments.length < total;

      logger.info('PAYMENT_SERVICE', 'Payments queried successfully', {
        count: payments.length,
        total,
        hasMore
      });

      return { payments, total, hasMore };
    } catch (error) {
      logger.error('PAYMENT_SERVICE', 'Failed to query payments', error);
      throw this.handlePaymentError(error, 'Failed to query payments');
    }
  }

  /**
   * Get payment statistics for the current user
   */
  async getPaymentStats(dateRange?: { from: string; to: string }): Promise<PaymentStats> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('PAYMENT_SERVICE', 'Getting payment statistics', { userId, dateRange });

      const queries: any[] = [Query.equal('userId', userId)];
      
      if (dateRange) {
        queries.push(Query.greaterThanEqual('$createdAt', dateRange.from));
        queries.push(Query.lessThanEqual('$createdAt', dateRange.to));
      }

      // Get all payments for stats calculation
      queries.push(Query.limit(1000)); // Reasonable limit for stats

      const response = await databaseService.listDocuments(collections.payments.id, queries);
      const payments = response.documents.map(doc => this.transformAppwriteToPayment(doc));

      // Calculate statistics
      const stats: PaymentStats = {
        totalPayments: payments.length,
        totalAmount: 0,
        averageAmount: 0,
        byStatus: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        },
        byType: {
          mobile_money: 0,
          bank_transfer: 0,
          card: 0,
          cash: 0,
        },
        byCurrency: {},
        monthlyTrend: [],
      };

      // Process each payment for statistics
      const monthlyData: Record<string, { count: number; amount: number }> = {};

      payments.forEach(payment => {
        // Total amount
        stats.totalAmount += payment.amount;
        
        // By status
        stats.byStatus[payment.status] = (stats.byStatus[payment.status] || 0) + 1;
        
        // By type
        stats.byType[payment.type] = (stats.byType[payment.type] || 0) + 1;
        
        // By currency
        stats.byCurrency[payment.currency] = (stats.byCurrency[payment.currency] || 0) + payment.amount;
        
        // Monthly trend
        const month = new Date(payment.createdAt).toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { count: 0, amount: 0 };
        }
        monthlyData[month].count++;
        monthlyData[month].amount += payment.amount;
      });

      // Calculate average
      stats.averageAmount = stats.totalPayments > 0 ? stats.totalAmount / stats.totalPayments : 0;

      // Convert monthly data to array and sort
      stats.monthlyTrend = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

      logger.info('PAYMENT_SERVICE', 'Payment statistics calculated', {
        totalPayments: stats.totalPayments,
        totalAmount: stats.totalAmount
      });

      return stats;
    } catch (error) {
      logger.error('PAYMENT_SERVICE', 'Failed to get payment statistics', error);
      throw this.handlePaymentError(error, 'Failed to get payment statistics');
    }
  }

  /**
   * Delete all payments for the current user
   */
  async deleteAllUserPayments(): Promise<number> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('PAYMENT_SERVICE', 'Deleting all payments for user', { userId });

      // Get all user payments
      const { payments } = await this.queryPayments({ limit: 1000 });

      let deletedCount = 0;
      
      // Delete each payment
      for (const payment of payments) {
        try {
          await databaseService.deleteDocument(collections.payments.id, payment.id);
          deletedCount++;
          
          // Log deletion activity
          activityLogger.logPaymentActivity(
            'deleted',
            payment.id,
            {
              type: payment.type,
              amount: payment.amount,
              currency: payment.currency,
              cardId: payment.cardId,
              description: `Bulk deletion: ${payment.description}`,
              reference: payment.reference,
            },
            userId
          ).catch(error => {
            logger.warn('PAYMENT_SERVICE', 'Failed to log bulk payment deletion activity', error);
          });
        } catch (deleteError) {
          logger.warn('PAYMENT_SERVICE', `Failed to delete payment ${payment.id}`, deleteError);
        }
      }

      logger.info('PAYMENT_SERVICE', 'Bulk payment deletion completed', {
        totalPayments: payments.length,
        deletedCount
      });

      return deletedCount;
    } catch (error) {
      logger.error('PAYMENT_SERVICE', 'Failed to delete all user payments', error);
      throw this.handlePaymentError(error, 'Failed to delete all user payments');
    }
  }

  /**
   * Handle payment-specific errors
   */
  private handlePaymentError(error: any, context: string): Error {
    if (error?.code === 404) {
      return new Error('Payment not found');
    }
    if (error?.code === 401) {
      return new Error('Unauthorized to access payment');
    }
    if (error?.code === 400) {
      return new Error('Invalid payment data');
    }
    
    const message = error?.message || context;
    return new Error(message);
  }
}

// Export singleton instance
export const paymentService = new AppwritePaymentService();