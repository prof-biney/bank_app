/**
 * Analytics Helpers
 * 
 * Helper functions to track user actions and transactions for analytics
 */

import { Transaction } from '@/constants/index';
import { logger } from './logger';

/**
 * Track transaction analytics
 * This function can be extended to send data to analytics services like Google Analytics, Mixpanel, etc.
 */
export async function trackTransactionAnalytics(transaction: Transaction, userId: string): Promise<void> {
  try {
    logger.info('ANALYTICS', 'Tracking transaction analytics', {
      transactionId: transaction.id,
      type: transaction.type,
      amount: Math.abs(transaction.amount),
      category: transaction.category,
      status: transaction.status,
      userId
    });
    
    // Track transaction event based on type
    const eventData = {
      userId,
      transactionId: transaction.id,
      type: transaction.type,
      amount: Math.abs(transaction.amount),
      currency: 'GHS',
      category: transaction.category,
      status: transaction.status,
      timestamp: new Date().toISOString(),
      isCredit: transaction.amount > 0,
      isDebit: transaction.amount < 0,
    };
    
    // Log different event types for different transaction types
    switch (transaction.type) {
      case 'deposit':
        await trackEvent('transaction_deposit', {
          ...eventData,
          escrowMethod: 'mobile_money', // Could extract from description
        });
        break;
        
      case 'withdrawal':
        await trackEvent('transaction_withdrawal', {
          ...eventData,
          withdrawalMethod: 'mobile_money', // Could extract from description
        });
        break;
        
      case 'transfer':
        await trackEvent('transaction_transfer', {
          ...eventData,
          recipient: transaction.recipient,
          isInternal: transaction.description?.includes('Internal'),
        });
        break;
        
      case 'fee':
        await trackEvent('transaction_fee', {
          ...eventData,
          feeType: transaction.description?.includes('withdrawal') ? 'withdrawal' : 'general',
        });
        break;
        
      default:
        await trackEvent('transaction_general', eventData);
        break;
    }
    
    // Track debit/credit analytics
    if (transaction.amount > 0) {
      await trackEvent('credit_transaction', {
        ...eventData,
        creditAmount: transaction.amount,
      });
    } else if (transaction.amount < 0) {
      await trackEvent('debit_transaction', {
        ...eventData,
        debitAmount: Math.abs(transaction.amount),
      });
    }
    
    logger.info('ANALYTICS', 'Transaction analytics tracked successfully');
    
  } catch (error) {
    // Don't throw - analytics tracking should not break the user experience
    logger.warn('ANALYTICS', 'Failed to track transaction analytics:', error);
  }
}

/**
 * Track general events for analytics
 * This can be extended to integrate with real analytics services
 */
export async function trackEvent(eventName: string, eventData: any): Promise<void> {
  try {
    // Log the event for now
    logger.info('ANALYTICS_EVENT', `Event: ${eventName}`, eventData);
    
    // Here you can add integrations with analytics services:
    // - Google Analytics
    // - Mixpanel  
    // - Firebase Analytics
    // - Custom analytics API
    
    // Example with hypothetical analytics service:
    // await analyticsService.track(eventName, eventData);
    
    // For now, we'll just store it in the app's internal analytics
    await storeAnalyticsEvent(eventName, eventData);
    
  } catch (error) {
    logger.warn('ANALYTICS', `Failed to track event ${eventName}:`, error);
  }
}

/**
 * Store analytics event in internal storage/database
 */
async function storeAnalyticsEvent(eventName: string, eventData: any): Promise<void> {
  try {
    // Store analytics data for internal reporting
    // This could be sent to Appwrite analytics collection
    const { databaseService } = await import('./appwrite/database');
    
    await databaseService.createDocument(
      'analytics_events', // You might need to create this collection
      {
        eventName,
        eventData,
        timestamp: new Date().toISOString(),
        userId: eventData.userId,
      }
    ).catch(() => {
      // If analytics collection doesn't exist, that's okay
      logger.debug('ANALYTICS', 'Analytics collection not available, skipping storage');
    });
    
  } catch (error) {
    // Don't fail if analytics storage fails
    logger.debug('ANALYTICS', 'Failed to store analytics event:', error);
  }
}

/**
 * Track user action analytics (non-transaction events)
 */
export async function trackUserAction(action: string, data: any, userId: string): Promise<void> {
  try {
    await trackEvent(`user_action_${action}`, {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    logger.warn('ANALYTICS', `Failed to track user action ${action}:`, error);
  }
}

/**
 * Track card operations
 */
export async function trackCardOperation(operation: string, cardId: string, userId: string, data?: any): Promise<void> {
  try {
    await trackEvent(`card_${operation}`, {
      operation,
      cardId,
      userId,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    logger.warn('ANALYTICS', `Failed to track card operation ${operation}:`, error);
  }
}