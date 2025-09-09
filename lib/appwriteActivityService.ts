import { logger } from '@/utils/logger';
import { ID, Query } from 'react-native-appwrite';
import { databases, appwriteConfig } from './appwrite';
import { ActivityEvent } from '@/types/activity';
import useAuthStore from '@/store/auth.store';

/**
 * Appwrite Activity Database Service
 * 
 * Handles all activity event CRUD operations with Appwrite database.
 * Ensures all operations are scoped to the current authenticated user.
 */

export interface CreateActivityEventData {
  category: 'transaction' | 'account' | 'card';
  type: string;
  title: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  status?: 'pending' | 'completed' | 'failed' | 'reversed' | 'info';
  accountId?: string;
  cardId?: string;
  transactionId?: string;
  tags?: string[];
}

export interface UpdateActivityEventData {
  title?: string;
  subtitle?: string;
  status?: 'pending' | 'completed' | 'failed' | 'reversed' | 'info';
}

/**
 * Get current authenticated user ID
 */
function getCurrentUserId(): string {
  const { user } = useAuthStore.getState();
  if (!user?.id) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

/**
 * Create a new activity event in Appwrite database
 */
export async function createAppwriteActivityEvent(eventData: CreateActivityEventData): Promise<ActivityEvent> {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !accountUpdatesCollectionId) {
    throw new Error('Appwrite activity collection not configured');
  }

  try {
    const userId = getCurrentUserId();
    
    const documentData = {
      userId,
      category: eventData.category,
      type: eventData.type,
      title: eventData.title,
      subtitle: eventData.subtitle || '',
      amount: eventData.amount || null,
      currency: eventData.currency || 'GHS',
      status: eventData.status || 'info',
      accountId: eventData.accountId || '',
      cardId: eventData.cardId || '',
      transactionId: eventData.transactionId || '',
      tags: eventData.tags ? JSON.stringify(eventData.tags) : '[]',
      timestamp: new Date().toISOString(),
    };

    logger.info('ACTIVITY', '[createAppwriteActivityEvent] Creating activity event:', {
      userId,
      category: eventData.category,
      type: eventData.type,
      title: eventData.title
    });

    const document = await databases.createDocument(
      databaseId,
      accountUpdatesCollectionId,
      ID.unique(),
      documentData
    );

    // Convert Appwrite document to ActivityEvent type
    const activityEvent: ActivityEvent = {
      id: document.$id,
      category: document.category,
      type: document.type,
      title: document.title,
      subtitle: document.subtitle,
      amount: document.amount,
      currency: document.currency,
      status: document.status,
      timestamp: document.timestamp,
      accountId: document.accountId,
      cardId: document.cardId,
      transactionId: document.transactionId,
      tags: document.tags ? JSON.parse(document.tags) : [],
    };

    logger.info('ACTIVITY', '[createAppwriteActivityEvent] Activity event created successfully:', activityEvent.id);
    return activityEvent;

  } catch (error) {
    logger.error('ACTIVITY', '[createAppwriteActivityEvent] Failed to create activity event:', error);
    throw new Error(`Failed to create activity event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update an existing activity event in Appwrite database
 */
export async function updateAppwriteActivityEvent(
  eventId: string, 
  updateData: UpdateActivityEventData
): Promise<ActivityEvent> {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !accountUpdatesCollectionId) {
    throw new Error('Appwrite activity collection not configured');
  }

  try {
    const userId = getCurrentUserId();

    logger.info('ACTIVITY', '[updateAppwriteActivityEvent] Updating activity event:', {
      eventId,
      userId,
      updateData
    });

    // First verify the activity event belongs to the current user
    const existingDoc = await databases.getDocument(
      databaseId,
      accountUpdatesCollectionId,
      eventId
    );

    if (existingDoc.userId !== userId) {
      throw new Error('Unauthorized: Activity event does not belong to current user');
    }

    const document = await databases.updateDocument(
      databaseId,
      accountUpdatesCollectionId,
      eventId,
      updateData
    );

    // Convert Appwrite document to ActivityEvent type
    const activityEvent: ActivityEvent = {
      id: document.$id,
      category: document.category,
      type: document.type,
      title: document.title,
      subtitle: document.subtitle,
      amount: document.amount,
      currency: document.currency,
      status: document.status,
      timestamp: document.timestamp,
      accountId: document.accountId,
      cardId: document.cardId,
      transactionId: document.transactionId,
      tags: document.tags ? JSON.parse(document.tags) : [],
    };

    logger.info('ACTIVITY', '[updateAppwriteActivityEvent] Activity event updated successfully:', activityEvent.id);
    return activityEvent;

  } catch (error) {
    logger.error('ACTIVITY', '[updateAppwriteActivityEvent] Failed to update activity event:', error);
    throw new Error(`Failed to update activity event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete an activity event from Appwrite database
 */
export async function deleteAppwriteActivityEvent(eventId: string): Promise<void> {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !accountUpdatesCollectionId) {
    throw new Error('Appwrite activity collection not configured');
  }

  try {
    const userId = getCurrentUserId();

    logger.info('ACTIVITY', '[deleteAppwriteActivityEvent] Deleting activity event:', {
      eventId,
      userId
    });

    // First verify the activity event belongs to the current user
    const existingDoc = await databases.getDocument(
      databaseId,
      accountUpdatesCollectionId,
      eventId
    );

    if (existingDoc.userId !== userId) {
      throw new Error('Unauthorized: Activity event does not belong to current user');
    }

    await databases.deleteDocument(
      databaseId,
      accountUpdatesCollectionId,
      eventId
    );

    logger.info('ACTIVITY', '[deleteAppwriteActivityEvent] Activity event deleted successfully:', eventId);

  } catch (error) {
    logger.error('ACTIVITY', '[deleteAppwriteActivityEvent] Failed to delete activity event:', error);
    throw new Error(`Failed to delete activity event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a single activity event by ID for the current user
 */
export async function getAppwriteActivityEvent(eventId: string): Promise<ActivityEvent> {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !accountUpdatesCollectionId) {
    throw new Error('Appwrite activity collection not configured');
  }

  try {
    const userId = getCurrentUserId();

    const document = await databases.getDocument(
      databaseId,
      accountUpdatesCollectionId,
      eventId
    );

    if (document.userId !== userId) {
      throw new Error('Unauthorized: Activity event does not belong to current user');
    }

    // Convert Appwrite document to ActivityEvent type
    const activityEvent: ActivityEvent = {
      id: document.$id,
      category: document.category,
      type: document.type,
      title: document.title,
      subtitle: document.subtitle,
      amount: document.amount,
      currency: document.currency,
      status: document.status,
      timestamp: document.timestamp,
      accountId: document.accountId,
      cardId: document.cardId,
      transactionId: document.transactionId,
      tags: document.tags ? JSON.parse(document.tags) : [],
    };

    return activityEvent;

  } catch (error) {
    logger.error('ACTIVITY', '[getAppwriteActivityEvent] Failed to get activity event:', error);
    throw new Error(`Failed to get activity event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Query activity events for the current user
 */
export async function queryAppwriteActivityEvents(options: {
  limit?: number;
  offset?: number;
  category?: 'transaction' | 'account' | 'card';
  type?: string;
  status?: string;
  cardId?: string;
  transactionId?: string;
  orderBy?: 'timestamp' | '$createdAt';
  orderDirection?: 'asc' | 'desc';
} = {}): Promise<{ events: ActivityEvent[]; total: number }> {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !accountUpdatesCollectionId) {
    throw new Error('Appwrite activity collection not configured');
  }

  try {
    const userId = getCurrentUserId();
    const queries = [Query.equal('userId', userId)];

    // Add optional filters
    if (options.category) {
      queries.push(Query.equal('category', options.category));
    }
    if (options.type) {
      queries.push(Query.equal('type', options.type));
    }
    if (options.status) {
      queries.push(Query.equal('status', options.status));
    }
    if (options.cardId) {
      queries.push(Query.equal('cardId', options.cardId));
    }
    if (options.transactionId) {
      queries.push(Query.equal('transactionId', options.transactionId));
    }

    // Add ordering
    const orderBy = options.orderBy || 'timestamp';
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

    logger.info('ACTIVITY', '[queryAppwriteActivityEvents] Querying activity events for user:', userId);

    const response = await databases.listDocuments(
      databaseId,
      accountUpdatesCollectionId,
      queries
    );

    // Convert documents to ActivityEvent types
    const events: ActivityEvent[] = response.documents.map(doc => ({
      id: doc.$id,
      category: doc.category,
      type: doc.type,
      title: doc.title,
      subtitle: doc.subtitle,
      amount: doc.amount,
      currency: doc.currency,
      status: doc.status,
      timestamp: doc.timestamp,
      accountId: doc.accountId,
      cardId: doc.cardId,
      transactionId: doc.transactionId,
      tags: doc.tags ? JSON.parse(doc.tags) : [],
    }));

    logger.info('ACTIVITY', '[queryAppwriteActivityEvents] Found', events.length, 'activity events');

    return {
      events,
      total: response.total
    };

  } catch (error) {
    logger.error('ACTIVITY', '[queryAppwriteActivityEvents] Failed to query activity events:', error);
    throw new Error(`Failed to query activity events: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get activity events for a specific category
 */
export async function getAppwriteActivityEventsByCategory(
  category: 'transaction' | 'account' | 'card', 
  limit = 50
): Promise<ActivityEvent[]> {
  try {
    const result = await queryAppwriteActivityEvents({
      category,
      limit,
      orderBy: 'timestamp',
      orderDirection: 'desc'
    });
    return result.events;
  } catch (error) {
    logger.error('ACTIVITY', '[getAppwriteActivityEventsByCategory] Failed to get activity events by category:', error);
    return [];
  }
}

/**
 * Get recent activity events for the current user
 */
export async function getAppwriteRecentActivityEvents(limit = 50): Promise<ActivityEvent[]> {
  try {
    const result = await queryAppwriteActivityEvents({
      limit,
      orderBy: 'timestamp',
      orderDirection: 'desc'
    });
    return result.events;
  } catch (error) {
    logger.error('ACTIVITY', '[getAppwriteRecentActivityEvents] Failed to get recent activity events:', error);
    return [];
  }
}

/**
 * Clean up old activity events (older than retention period)
 */
export async function cleanupOldAppwriteActivityEvents(): Promise<void> {
  const { accountUpdatesCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !accountUpdatesCollectionId) {
    logger.warn('ACTIVITY', '[cleanupOldAppwriteActivityEvents] Appwrite activity collection not configured');
    return;
  }

  try {
    const userId = getCurrentUserId();
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - 30); // 30 days retention
    
    logger.info('ACTIVITY', '[cleanupOldAppwriteActivityEvents] Cleaning activity events older than:', retentionDate.toISOString());

    // Query old events
    const queries = [
      Query.equal('userId', userId),
      Query.lessThan('timestamp', retentionDate.toISOString()),
      Query.limit(100) // Process in batches
    ];

    const response = await databases.listDocuments(
      databaseId,
      accountUpdatesCollectionId,
      queries
    );

    // Delete old events
    for (const doc of response.documents) {
      try {
        await databases.deleteDocument(
          databaseId,
          accountUpdatesCollectionId,
          doc.$id
        );
      } catch (error) {
        logger.warn('ACTIVITY', '[cleanupOldAppwriteActivityEvents] Failed to delete event:', doc.$id, error);
      }
    }

    logger.info('ACTIVITY', '[cleanupOldAppwriteActivityEvents] Cleaned up', response.documents.length, 'old activity events');

  } catch (error) {
    logger.error('ACTIVITY', '[cleanupOldAppwriteActivityEvents] Failed to cleanup activity events:', error);
    // Don't throw - this is a background cleanup operation
  }
}
