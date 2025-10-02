/**
 * Analytics Helpers
 * 
 * Provides functionality to log analytics events to the analytics_events collection.
 * Gracefully handles cases where the collection doesn't exist.
 */

import { databases, collections } from '@/lib/appwrite/config';
import { logger } from '@/lib/logger';
import { ID } from 'react-native-appwrite';

export interface AnalyticsEvent {
  event_type: string;
  user_id?: string;
  session_id?: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

class AnalyticsHelper {
  private collectionExists: boolean | null = null;

  /**
   * Check if analytics collection exists
   */
  private async checkCollectionExists(): Promise<boolean> {
    if (this.collectionExists !== null) {
      return this.collectionExists;
    }

    try {
      // Try to list documents to see if collection exists
      await databases.listDocuments(
        collections.analytics.databaseId,
        collections.analytics.id,
        []
      );
      this.collectionExists = true;
      return true;
    } catch (error: any) {
      // Collection doesn't exist or access denied
      if (error?.code === 404 || error?.type === 'collection_not_found') {
        logger.info('ANALYTICS', 'Analytics collection not found, skipping analytics logging');
        this.collectionExists = false;
        return false;
      }
      // Other errors - assume collection doesn't exist
      logger.warn('ANALYTICS', 'Could not access analytics collection, skipping analytics logging', error);
      this.collectionExists = false;
      return false;
    }
  }

  /**
   * Log an analytics event
   */
  async logEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const exists = await this.checkCollectionExists();
      if (!exists) {
        // Skip silently if collection doesn't exist
        return;
      }

      const eventData = {
        event_type: event.event_type,
        user_id: event.user_id || null,
        session_id: event.session_id || null,
        properties: event.properties ? JSON.stringify(event.properties) : null,
        timestamp: event.timestamp || new Date().toISOString(),
      };

      await databases.createDocument(
        collections.analytics.databaseId,
        collections.analytics.id,
        ID.unique(),
        eventData
      );

      logger.debug('ANALYTICS', 'Event logged successfully', { event_type: event.event_type });
    } catch (error: any) {
      // Log warning but don't throw - analytics shouldn't break the app
      logger.warn('ANALYTICS', 'Failed to log analytics event', {
        event_type: event.event_type,
        error: error?.message || 'Unknown error'
      });
    }
  }

  /**
   * Log multiple analytics events in batch
   */
  async logEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      const exists = await this.checkCollectionExists();
      if (!exists) {
        // Skip silently if collection doesn't exist
        return;
      }

      // Log events sequentially to avoid overwhelming the API
      for (const event of events) {
        await this.logEvent(event);
        // Small delay between events
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error: any) {
      logger.warn('ANALYTICS', 'Failed to log analytics events batch', error);
    }
  }

  /**
   * Log user action event
   */
  async logUserAction(
    action: string,
    userId?: string,
    properties?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: 'user_action',
      user_id: userId,
      properties: {
        action,
        ...properties
      }
    });
  }

  /**
   * Log screen view event
   */
  async logScreenView(
    screenName: string,
    userId?: string,
    properties?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: 'screen_view',
      user_id: userId,
      properties: {
        screen_name: screenName,
        ...properties
      }
    });
  }

  /**
   * Log transaction event
   */
  async logTransaction(
    transactionType: string,
    amount: number,
    userId?: string,
    properties?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: 'transaction',
      user_id: userId,
      properties: {
        transaction_type: transactionType,
        amount,
        ...properties
      }
    });
  }

  /**
   * Log error event
   */
  async logError(
    error: string,
    userId?: string,
    properties?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: 'error',
      user_id: userId,
      properties: {
        error_message: error,
        ...properties
      }
    });
  }

  /**
   * Reset collection existence cache (useful for testing)
   */
  resetCollectionCache(): void {
    this.collectionExists = null;
  }
}

export const analyticsHelper = new AnalyticsHelper();
export default analyticsHelper;