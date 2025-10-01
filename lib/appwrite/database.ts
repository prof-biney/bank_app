/**
 * Appwrite Database Service
 * 
 * This module provides database operations with real-time subscriptions for the banking application.
 * It includes CRUD operations, real-time listeners, offline queue management, and error handling.
 */

import { 
  databases, 
  collections, 
  appwriteConfig, 
  AppwriteQuery, 
  AppwriteID,
  createRealtimeSubscription,
  sessionHelpers,
  connectionHelpers
} from './config';
import { logger } from '../logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for database operations
export interface DatabaseDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions?: string[];
  [key: string]: any;
}

export interface DatabaseResponse<T = any> {
  total: number;
  documents: T[];
}

export interface RealtimeSubscriptionOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onReconnect?: () => void;
}

export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collectionId: string;
  documentId?: string;
  data?: any;
  timestamp: number;
  retryCount: number;
}

// Offline operations queue
class OfflineQueue {
  private queue: OfflineOperation[] = [];
  private isProcessing = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  async addOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) {
    const queueItem: OfflineOperation = {
      ...operation,
      id: AppwriteID.unique(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(queueItem);
    await this.saveQueueToStorage();
    
    logger.info('OFFLINE_QUEUE', 'Operation added to queue', { 
      operationId: queueItem.id,
      type: queueItem.type,
      collectionId: queueItem.collectionId 
    });

    // Try to process queue if online
    if (connectionHelpers.isOnline()) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    logger.info('OFFLINE_QUEUE', 'Processing queue', { queueLength: this.queue.length });

    const processedIds: string[] = [];

    for (const operation of this.queue) {
      try {
        await this.executeOperation(operation);
        processedIds.push(operation.id);
        logger.info('OFFLINE_QUEUE', 'Operation processed successfully', { operationId: operation.id });
      } catch (error) {
        operation.retryCount++;
        logger.error('OFFLINE_QUEUE', 'Operation failed', { 
          operationId: operation.id, 
          retryCount: operation.retryCount,
          error 
        });

        if (operation.retryCount >= this.MAX_RETRIES) {
          processedIds.push(operation.id);
          logger.error('OFFLINE_QUEUE', 'Operation failed permanently', { operationId: operation.id });
        } else {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, operation.retryCount))
          );
        }
      }
    }

    // Remove processed operations
    this.queue = this.queue.filter(op => !processedIds.includes(op.id));
    await this.saveQueueToStorage();
    
    this.isProcessing = false;
    logger.info('OFFLINE_QUEUE', 'Queue processing completed', { 
      remainingOperations: this.queue.length 
    });
  }

  private async executeOperation(operation: OfflineOperation) {
    const { type, collectionId, documentId, data } = operation;
    
    switch (type) {
      case 'create':
        return await databases.createDocument(
          appwriteConfig.databaseId,
          collectionId,
          documentId || AppwriteID.unique(),
          data
        );
      case 'update':
        if (!documentId) throw new Error('Document ID required for update operation');
        return await databases.updateDocument(
          appwriteConfig.databaseId,
          collectionId,
          documentId,
          data
        );
      case 'delete':
        if (!documentId) throw new Error('Document ID required for delete operation');
        return await databases.deleteDocument(
          appwriteConfig.databaseId,
          collectionId,
          documentId
        );
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  private async saveQueueToStorage() {
    try {
      await AsyncStorage.setItem('@appwrite_offline_queue', JSON.stringify(this.queue));
    } catch (error) {
      logger.error('OFFLINE_QUEUE', 'Failed to save queue to storage', error);
    }
  }

  async loadQueueFromStorage() {
    try {
      const queueData = await AsyncStorage.getItem('@appwrite_offline_queue');
      if (queueData) {
        this.queue = JSON.parse(queueData);
        logger.info('OFFLINE_QUEUE', 'Queue loaded from storage', { queueLength: this.queue.length });
      }
    } catch (error) {
      logger.error('OFFLINE_QUEUE', 'Failed to load queue from storage', error);
    }
  }

  async clearQueue() {
    this.queue = [];
    await AsyncStorage.removeItem('@appwrite_offline_queue');
    logger.info('OFFLINE_QUEUE', 'Queue cleared');
  }

  getQueueStatus() {
    return {
      length: this.queue.length,
      isProcessing: this.isProcessing,
      operations: this.queue.map(op => ({
        id: op.id,
        type: op.type,
        collectionId: op.collectionId,
        timestamp: op.timestamp,
        retryCount: op.retryCount,
      }))
    };
  }
}

// Global offline queue instance
const offlineQueue = new OfflineQueue();

/**
 * Database Service Class
 */
export class AppwriteDatabaseService {
  private subscriptions = new Map<string, () => void>();

  constructor() {
    // Load offline queue on initialization
    offlineQueue.loadQueueFromStorage();
    
    // Set up connection monitoring
    connectionHelpers.onConnectionChange((isOnline) => {
      if (isOnline) {
        logger.info('DATABASE', 'Connection restored, processing offline queue');
        offlineQueue.processQueue();
      }
    });
  }

  /**
   * Create a new document
   */
  async createDocument<T = any>(
    collectionId: string, 
    data: any, 
    documentId?: string,
    useOfflineQueue = true
  ): Promise<T> {
    const id = documentId || AppwriteID.unique();
    
    try {
      const document = await databases.createDocument(
        appwriteConfig.databaseId,
        collectionId,
        id,
        data
      );
      
      logger.info('DATABASE', 'Document created', { 
        collectionId, 
        documentId: document.$id 
      });
      
      return document as T;
    } catch (error) {
      logger.error('DATABASE', 'Failed to create document', { collectionId, error });
      
      if (useOfflineQueue && !connectionHelpers.isOnline()) {
        await offlineQueue.addOperation({
          type: 'create',
          collectionId,
          documentId: id,
          data,
        });
        
        // Return optimistic response
        return {
          $id: id,
          $createdAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString(),
          ...data
        } as T;
      }
      
      throw error;
    }
  }

  /**
   * Update an existing document
   */
  async updateDocument<T = any>(
    collectionId: string, 
    documentId: string, 
    data: any,
    useOfflineQueue = true
  ): Promise<T> {
    try {
      const document = await databases.updateDocument(
        appwriteConfig.databaseId,
        collectionId,
        documentId,
        data
      );
      
      logger.info('DATABASE', 'Document updated', { 
        collectionId, 
        documentId 
      });
      
      return document as T;
    } catch (error) {
      logger.error('DATABASE', 'Failed to update document', { collectionId, documentId, error });
      
      if (useOfflineQueue && !connectionHelpers.isOnline()) {
        await offlineQueue.addOperation({
          type: 'update',
          collectionId,
          documentId,
          data,
        });
        
        // Return optimistic response (would need to merge with existing data)
        throw new Error('Offline update queued - cannot return updated document');
      }
      
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(
    collectionId: string, 
    documentId: string,
    useOfflineQueue = true
  ): Promise<void> {
    try {
      await databases.deleteDocument(
        appwriteConfig.databaseId,
        collectionId,
        documentId
      );
      
      logger.info('DATABASE', 'Document deleted', { 
        collectionId, 
        documentId 
      });
    } catch (error) {
      logger.error('DATABASE', 'Failed to delete document', { collectionId, documentId, error });
      
      if (useOfflineQueue && !connectionHelpers.isOnline()) {
        await offlineQueue.addOperation({
          type: 'delete',
          collectionId,
          documentId,
        });
        return; // Optimistically assume success
      }
      
      throw error;
    }
  }

  /**
   * Get a single document
   */
  async getDocument<T = any>(
    collectionId: string, 
    documentId: string
  ): Promise<T> {
    try {
      const document = await databases.getDocument(
        appwriteConfig.databaseId,
        collectionId,
        documentId
      );
      
      logger.info('DATABASE', 'Document retrieved', { 
        collectionId, 
        documentId 
      });
      
      return document as T;
    } catch (error) {
      logger.error('DATABASE', 'Failed to get document', { collectionId, documentId, error });
      throw error;
    }
  }

  /**
   * List documents with queries
   */
  async listDocuments<T = any>(
    collectionId: string, 
    queries: string[] = []
  ): Promise<DatabaseResponse<T>> {
    try {
      const response = await databases.listDocuments(
        appwriteConfig.databaseId,
        collectionId,
        queries
      );
      
      logger.info('DATABASE', 'Documents listed', { 
        collectionId, 
        count: response.documents.length,
        total: response.total 
      });
      
      return response as DatabaseResponse<T>;
    } catch (error) {
      logger.error('DATABASE', 'Failed to list documents', { collectionId, error });
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates for a collection
   */
  subscribeToCollection<T = any>(
    collectionId: string,
    callback: (response: any) => void,
    options: RealtimeSubscriptionOptions = {}
  ): () => void {
    const channelName = `databases.${appwriteConfig.databaseId}.collections.${collectionId}.documents`;
    
    logger.info('DATABASE_REALTIME', 'Subscribing to collection', { 
      collectionId, 
      channel: channelName 
    });

    const unsubscribe = createRealtimeSubscription(
      [channelName],
      (response) => {
        logger.info('DATABASE_REALTIME', 'Collection update received', {
          collectionId,
          event: response.event,
          documentId: response.payload?.$id
        });
        callback(response);
      },
      (error) => {
        logger.error('DATABASE_REALTIME', 'Subscription error', { collectionId, error });
        options.onError?.(error);
      }
    );

    // Store subscription for cleanup
    const subscriptionId = `${collectionId}_${Date.now()}`;
    this.subscriptions.set(subscriptionId, unsubscribe);

    // Return unsubscribe function that also cleans up from our map
    return () => {
      unsubscribe();
      this.subscriptions.delete(subscriptionId);
      logger.info('DATABASE_REALTIME', 'Unsubscribed from collection', { collectionId });
    };
  }

  /**
   * Subscribe to real-time updates for a specific document
   */
  subscribeToDocument<T = any>(
    collectionId: string,
    documentId: string,
    callback: (response: any) => void,
    options: RealtimeSubscriptionOptions = {}
  ): () => void {
    const channelName = `databases.${appwriteConfig.databaseId}.collections.${collectionId}.documents.${documentId}`;
    
    logger.info('DATABASE_REALTIME', 'Subscribing to document', { 
      collectionId, 
      documentId,
      channel: channelName 
    });

    const unsubscribe = createRealtimeSubscription(
      [channelName],
      (response) => {
        logger.info('DATABASE_REALTIME', 'Document update received', {
          collectionId,
          documentId,
          event: response.event
        });
        callback(response);
      },
      (error) => {
        logger.error('DATABASE_REALTIME', 'Document subscription error', { 
          collectionId, 
          documentId, 
          error 
        });
        options.onError?.(error);
      }
    );

    // Store subscription for cleanup
    const subscriptionId = `${collectionId}_${documentId}_${Date.now()}`;
    this.subscriptions.set(subscriptionId, unsubscribe);

    // Return unsubscribe function that also cleans up from our map
    return () => {
      unsubscribe();
      this.subscriptions.delete(subscriptionId);
      logger.info('DATABASE_REALTIME', 'Unsubscribed from document', { collectionId, documentId });
    };
  }

  /**
   * Subscribe to multiple collections
   */
  subscribeToMultipleCollections(
    subscriptions: Array<{
      collectionId: string;
      callback: (response: any) => void;
      options?: RealtimeSubscriptionOptions;
    }>
  ): () => void {
    const unsubscribeFunctions = subscriptions.map(({ collectionId, callback, options }) =>
      this.subscribeToCollection(collectionId, callback, options)
    );

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Clean up all subscriptions
   */
  unsubscribeAll(): void {
    logger.info('DATABASE_REALTIME', 'Unsubscribing from all subscriptions', { 
      count: this.subscriptions.size 
    });
    
    this.subscriptions.forEach((unsubscribe, subscriptionId) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('DATABASE_REALTIME', 'Error unsubscribing', { subscriptionId, error });
      }
    });
    
    this.subscriptions.clear();
  }

  /**
   * Get offline queue status
   */
  getOfflineQueueStatus() {
    return offlineQueue.getQueueStatus();
  }

  /**
   * Force process offline queue
   */
  async processOfflineQueue() {
    return offlineQueue.processQueue();
  }

  /**
   * Clear offline queue
   */
  async clearOfflineQueue() {
    return offlineQueue.clearQueue();
  }
}

// Create and export database service instance
export const databaseService = new AppwriteDatabaseService();

// Export commonly used functions
export const {
  createDocument,
  updateDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  subscribeToCollection,
  subscribeToDocument,
  subscribeToMultipleCollections,
  unsubscribeAll,
  getOfflineQueueStatus,
  processOfflineQueue,
  clearOfflineQueue,
} = databaseService;

// Export Query and ID helpers for convenience
export { AppwriteQuery as Query, AppwriteID as ID, collections };

// Export default service
export default databaseService;