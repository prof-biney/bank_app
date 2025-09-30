/**
 * Appwrite Notification Service
 * 
 * This module handles all notification-related operations using Appwrite database with real-time subscriptions.
 * It provides notification management, real-time updates, and comprehensive filtering.
 */

import { databaseService, Query, ID, collections } from './database';
import { authService } from './auth';
import { logger } from '../logger';
import { Notification } from '@/types';

// Notification service interfaces
export interface CreateNotificationData {
  title: string;
  message: string;
  type?: 'payment' | 'transaction' | 'statement' | 'system';
  metadata?: Record<string, any>;
}

export interface UpdateNotificationData {
  title?: string;
  message?: string;
  unread?: boolean;
  archived?: boolean;
  type?: 'payment' | 'transaction' | 'statement' | 'system';
}

export interface NotificationFilters {
  type?: 'payment' | 'transaction' | 'statement' | 'system';
  unread?: boolean;
  archived?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface NotificationQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'type' | 'title';
  orderDirection?: 'asc' | 'desc';
  filters?: NotificationFilters;
}

// Real-time subscription types
export interface NotificationRealtimeOptions {
  onNotificationCreated?: (notification: Notification) => void;
  onNotificationUpdated?: (notification: Notification) => void;
  onNotificationDeleted?: (notificationId: string) => void;
  onNotificationRead?: (notificationId: string) => void;
  onError?: (error: any) => void;
}

// Notification statistics interface
export interface NotificationStats {
  totalNotifications: number;
  unreadCount: number;
  archivedCount: number;
  byType: {
    payment: number;
    transaction: number;
    statement: number;
    system: number;
  };
  recentCount: number; // last 24 hours
}

/**
 * Appwrite Notification Service Class
 */
export class AppwriteNotificationService {
  private subscriptions = new Map<string, () => void>();

  constructor() {
    logger.info('NOTIFICATION_SERVICE', 'Appwrite Notification Service initialized');
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated - no user ID found');
    }
    
    logger.info('NOTIFICATION_SERVICE', 'Using userId for notification operations', { userId: user.$id });
    return user.$id;
  }

  /**
   * Transform notification data to match Appwrite schema
   */
  private transformNotificationForAppwrite(notificationData: CreateNotificationData, userId: string): any {
    return {
      userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'system',
      unread: true,
      archived: false,
      // Note: metadata field removed as it's not in the Appwrite schema
      // Store metadata info in the message if needed
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Transform Appwrite document to Notification type
   */
  private transformAppwriteToNotification(doc: any): Notification {
    return {
      id: doc.$id,
      userId: doc.userId,
      title: doc.title,
      message: doc.message,
      type: doc.type || 'system',
      unread: doc.unread !== false,
      archived: doc.archived === true,
      createdAt: doc.createdAt || doc.$createdAt,
    };
  }

  /**
   * Create a new notification
   */
  async createNotification(notificationData: CreateNotificationData): Promise<Notification> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('NOTIFICATION_SERVICE', 'Creating notification', {
        userId,
        title: notificationData.title,
        type: notificationData.type,
      });

      // Transform data for Appwrite schema
      const appwriteData = this.transformNotificationForAppwrite(notificationData, userId);
      
      // Create document in Appwrite
      const document = await databaseService.createDocument(
        collections.notifications.id,
        appwriteData
      );

      // Transform back to Notification type
      const notification = this.transformAppwriteToNotification(document);

      logger.info('NOTIFICATION_SERVICE', 'Notification created successfully', { 
        notificationId: notification.id 
      });
      return notification;
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to create notification', error);
      throw this.handleNotificationError(error, 'Failed to create notification');
    }
  }

  /**
   * Update an existing notification
   */
  async updateNotification(notificationId: string, updateData: UpdateNotificationData): Promise<Notification> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('NOTIFICATION_SERVICE', 'Updating notification', { 
        notificationId, 
        userId, 
        updateData 
      });

      // First verify the notification belongs to the current user
      const existingNotification = await this.getNotification(notificationId);
      if (existingNotification.userId !== userId) {
        throw new Error('Unauthorized: Notification does not belong to current user');
      }

      // Transform update data to match Appwrite schema
      const appwriteUpdateData: any = {};
      
      if (updateData.title !== undefined) {
        appwriteUpdateData.title = updateData.title;
      }
      if (updateData.message !== undefined) {
        appwriteUpdateData.message = updateData.message;
      }
      if (updateData.unread !== undefined) {
        appwriteUpdateData.unread = updateData.unread;
      }
      if (updateData.archived !== undefined) {
        appwriteUpdateData.archived = updateData.archived;
      }
      if (updateData.type !== undefined) {
        appwriteUpdateData.type = updateData.type;
      }

      // Update document in Appwrite
      const document = await databaseService.updateDocument(
        collections.notifications.id,
        notificationId,
        appwriteUpdateData
      );

      // Transform back to Notification type
      const notification = this.transformAppwriteToNotification(document);

      logger.info('NOTIFICATION_SERVICE', 'Notification updated successfully', { notificationId });
      return notification;
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to update notification', error);
      throw this.handleNotificationError(error, 'Failed to update notification');
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('NOTIFICATION_SERVICE', 'Deleting notification', { notificationId, userId });

      // First verify the notification belongs to the current user
      const existingNotification = await this.getNotification(notificationId);
      if (existingNotification.userId !== userId) {
        throw new Error('Unauthorized: Notification does not belong to current user');
      }

      // Delete from database
      await databaseService.deleteDocument(collections.notifications.id, notificationId);

      logger.info('NOTIFICATION_SERVICE', 'Notification deleted successfully', { notificationId });
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to delete notification', error);
      throw this.handleNotificationError(error, 'Failed to delete notification');
    }
  }

  /**
   * Get a single notification by ID
   */
  async getNotification(notificationId: string): Promise<Notification> {
    try {
      const userId = await this.getCurrentUserId();

      const document = await databaseService.getDocument(collections.notifications.id, notificationId);

      if (document.userId !== userId) {
        throw new Error('Unauthorized: Notification does not belong to current user');
      }

      const notification = this.transformAppwriteToNotification(document);
      
      logger.info('NOTIFICATION_SERVICE', 'Notification retrieved', { notificationId });
      return notification;
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to get notification', error);
      throw this.handleNotificationError(error, 'Failed to get notification');
    }
  }

  /**
   * Query notifications for the current user
   */
  async queryNotifications(options: NotificationQueryOptions = {}): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('NOTIFICATION_SERVICE', 'Querying notifications for user', { userId, options });

      // Build queries
      const queries = [Query.equal('userId', userId)];

      // Add filters
      if (options.filters) {
        const { type, unread, archived, dateFrom, dateTo } = options.filters;
        
        if (type) {
          queries.push(Query.equal('type', type));
        }
        if (unread !== undefined) {
          queries.push(Query.equal('unread', unread));
        }
        if (archived !== undefined) {
          queries.push(Query.equal('archived', archived));
        }
        if (dateFrom) {
          queries.push(Query.greaterThanEqual('createdAt', dateFrom));
        }
        if (dateTo) {
          queries.push(Query.lessThanEqual('createdAt', dateTo));
        }
      }

      // Add ordering
      const orderBy = options.orderBy || 'createdAt';
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

      // Execute query
      const response = await databaseService.listDocuments(collections.notifications.id, queries);

      // Transform documents to Notification type
      const notifications = response.documents.map(doc => this.transformAppwriteToNotification(doc));

      logger.info('NOTIFICATION_SERVICE', 'Notifications queried successfully', { 
        count: notifications.length, 
        total: response.total 
      });

      return { notifications, total: response.total };
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to query notifications', error);
      throw this.handleNotificationError(error, 'Failed to query notifications');
    }
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(limit: number = 50): Promise<Notification[]> {
    try {
      const result = await this.queryNotifications({
        filters: { unread: true, archived: false },
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit,
      });
      
      return result.notifications;
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to get unread notifications', error);
      return [];
    }
  }

  /**
   * Get recent notifications (last 7 days by default)
   */
  async getRecentNotifications(days: number = 7, limit: number = 50): Promise<Notification[]> {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      
      const result = await this.queryNotifications({
        filters: {
          dateFrom: dateFrom.toISOString(),
          archived: false,
        },
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit,
      });
      
      return result.notifications;
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to get recent notifications', { days, limit, error });
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      logger.info('NOTIFICATION_SERVICE', 'Marking notification as read', { notificationId });
      
      return await this.updateNotification(notificationId, { unread: false });
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to mark notification as read', error);
      throw error;
    }
  }

  /**
   * Mark notification as unread
   */
  async markAsUnread(notificationId: string): Promise<Notification> {
    try {
      logger.info('NOTIFICATION_SERVICE', 'Marking notification as unread', { notificationId });
      
      return await this.updateNotification(notificationId, { unread: true });
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to mark notification as unread', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const unreadNotifications = await this.getUnreadNotifications(1000);
      
      logger.info('NOTIFICATION_SERVICE', 'Marking all notifications as read', { 
        count: unreadNotifications.length 
      });

      // Update all unread notifications in parallel
      const updatePromises = unreadNotifications.map(notification =>
        this.updateNotification(notification.id, { unread: false }).catch(error => {
          logger.warn('NOTIFICATION_SERVICE', 'Failed to mark notification as read', { 
            notificationId: notification.id, 
            error 
          });
        })
      );

      await Promise.all(updatePromises);

      logger.info('NOTIFICATION_SERVICE', 'All notifications marked as read');
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to mark all notifications as read', error);
      throw this.handleNotificationError(error, 'Failed to mark all notifications as read');
    }
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId: string): Promise<Notification> {
    try {
      logger.info('NOTIFICATION_SERVICE', 'Archiving notification', { notificationId });
      
      return await this.updateNotification(notificationId, { archived: true });
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to archive notification', error);
      throw error;
    }
  }

  /**
   * Unarchive notification
   */
  async unarchiveNotification(notificationId: string): Promise<Notification> {
    try {
      logger.info('NOTIFICATION_SERVICE', 'Unarchiving notification', { notificationId });
      
      return await this.updateNotification(notificationId, { archived: false });
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to unarchive notification', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<NotificationStats> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('NOTIFICATION_SERVICE', 'Getting notification statistics', { userId });

      // Query all notifications for the user
      const { notifications } = await this.queryNotifications({
        limit: 10000, // Get all notifications (consider pagination for very large datasets)
      });

      // Calculate statistics
      const stats: NotificationStats = {
        totalNotifications: notifications.length,
        unreadCount: 0,
        archivedCount: 0,
        byType: {
          payment: 0,
          transaction: 0,
          statement: 0,
          system: 0,
        },
        recentCount: 0,
      };

      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      notifications.forEach(notification => {
        // Count unread
        if (notification.unread) {
          stats.unreadCount++;
        }

        // Count archived
        if (notification.archived) {
          stats.archivedCount++;
        }

        // Count by type
        if (notification.type && stats.byType.hasOwnProperty(notification.type)) {
          stats.byType[notification.type as keyof typeof stats.byType]++;
        }

        // Count recent (last 24 hours)
        if (new Date(notification.createdAt!) > oneDayAgo) {
          stats.recentCount++;
        }
      });

      logger.info('NOTIFICATION_SERVICE', 'Notification statistics calculated', stats);
      return stats;
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to get notification statistics', error);
      throw this.handleNotificationError(error, 'Failed to get notification statistics');
    }
  }

  /**
   * Subscribe to real-time notification updates for current user
   */
  subscribeToNotifications(options: NotificationRealtimeOptions = {}): () => void {
    try {
      logger.info('NOTIFICATION_SERVICE', 'Setting up real-time notification subscriptions');

      const unsubscribe = databaseService.subscribeToCollection(
        collections.notifications.id,
        (response) => {
          const { event, payload } = response;
          
          logger.info('NOTIFICATION_SERVICE', 'Real-time notification update received', {
            event,
            notificationId: payload?.$id
          });

          // Only process events for current user's notifications
          if (payload?.userId) {
            authService.getCurrentUser().then(user => {
              if (user && payload.userId === user.$id) {
                const notification = this.transformAppwriteToNotification(payload);
                
                switch (event) {
                  case 'databases.*.collections.*.documents.*.create':
                    options.onNotificationCreated?.(notification);
                    break;
                  case 'databases.*.collections.*.documents.*.update':
                    options.onNotificationUpdated?.(notification);
                    // Check for read status changes
                    if (response.oldPayload?.unread !== payload.unread && !payload.unread) {
                      options.onNotificationRead?.(payload.$id);
                    }
                    break;
                  case 'databases.*.collections.*.documents.*.delete':
                    options.onNotificationDeleted?.(payload.$id);
                    break;
                }
              }
            });
          }
        },
        {
          onError: (error) => {
            logger.error('NOTIFICATION_SERVICE', 'Real-time subscription error', error);
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `notifications_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('NOTIFICATION_SERVICE', 'Unsubscribed from notification updates');
      };
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to subscribe to notifications', error);
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Subscribe to unread notifications only
   */
  subscribeToUnreadNotifications(options: NotificationRealtimeOptions = {}): () => void {
    try {
      logger.info('NOTIFICATION_SERVICE', 'Setting up real-time unread notifications subscriptions');

      const unsubscribe = databaseService.subscribeToCollection(
        collections.notifications.id,
        (response) => {
          const { event, payload } = response;
          
          // Only process events for unread notifications and current user
          if (payload?.unread && payload?.userId) {
            authService.getCurrentUser().then(user => {
              if (user && payload.userId === user.$id) {
                const notification = this.transformAppwriteToNotification(payload);
                
                switch (event) {
                  case 'databases.*.collections.*.documents.*.create':
                    if (notification.unread) {
                      options.onNotificationCreated?.(notification);
                    }
                    break;
                  case 'databases.*.collections.*.documents.*.update':
                    options.onNotificationUpdated?.(notification);
                    break;
                }
              }
            });
          }
        },
        {
          onError: (error) => {
            logger.error('NOTIFICATION_SERVICE', 'Real-time unread notifications subscription error', error);
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `unread_notifications_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('NOTIFICATION_SERVICE', 'Unsubscribed from unread notification updates');
      };
    } catch (error) {
      logger.error('NOTIFICATION_SERVICE', 'Failed to subscribe to unread notifications', error);
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Unsubscribe from all notification subscriptions
   */
  unsubscribeAll(): void {
    logger.info('NOTIFICATION_SERVICE', 'Unsubscribing from all notification subscriptions', { 
      count: this.subscriptions.size 
    });
    
    this.subscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('NOTIFICATION_SERVICE', 'Error unsubscribing', error);
      }
    });
    
    this.subscriptions.clear();
  }

  /**
   * Handle and format notification-related errors
   */
  private handleNotificationError(error: any, defaultMessage: string): Error {
    let message = defaultMessage;
    
    if (error?.message) {
      if (error.message.includes('Unauthorized')) {
        message = 'You do not have permission to access this notification.';
      } else if (error.message.includes('not found')) {
        message = 'Notification not found.';
      } else {
        message = error.message;
      }
    }

    const formattedError = new Error(message);
    formattedError.stack = error?.stack;
    return formattedError;
  }
}

// Create and export notification service instance
export const notificationService = new AppwriteNotificationService();

// Export commonly used functions
export const {
  createNotification,
  updateNotification,
  deleteNotification,
  getNotification,
  queryNotifications,
  getUnreadNotifications,
  getRecentNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  archiveNotification,
  unarchiveNotification,
  getNotificationStats,
  subscribeToNotifications,
  subscribeToUnreadNotifications,
  unsubscribeAll,
} = notificationService;

// Backward compatibility functions

/**
 * Enhanced alert function that shows an alert and pushes it to notifications
 * This maintains compatibility with the old notification service API
 */
export function showAlertWithNotification(
  showAlert: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void,
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  title?: string
) {
  // Show the immediate alert
  showAlert(type, message, title);
  
  // Map alert types to notification types
  const notificationType: 'payment' | 'transaction' | 'statement' | 'system' = 
    type === 'success' ? 'system' :
    type === 'error' ? 'system' :
    type === 'warning' ? 'system' :
    'system';
  
  // Push to notification system (fire and forget)
  const payload: CreateNotificationData = {
    type: notificationType,
    title: title || 'Alert',
    message,
  };
  
  // Create notification in background (don't await or block UI)
  notificationService.createNotification(payload).catch((error) => {
    logger.warn('NOTIFICATION_SERVICE', 'Failed to create notification for alert', error);
  });
}

/**
 * Pushes a transaction-related notification
 */
export function pushTransactionNotification(
  type: 'success' | 'failed',
  title: string,
  message: string,
  amount?: number
) {
  const payload: CreateNotificationData = {
    type: 'transaction',
    title,
    message: amount ? `${message} - Amount: GHS ${Math.abs(amount).toFixed(2)}` : message,
  };
  
  // Create notification in background (don't await or block UI)
  notificationService.createNotification(payload).catch((error) => {
    logger.warn('NOTIFICATION_SERVICE', 'Failed to create transaction notification', error);
  });
}

/**
 * Pushes a payment-related notification
 */
export function pushPaymentNotification(
  type: 'success' | 'failed',
  title: string,
  message: string,
  amount?: number
) {
  const payload: CreateNotificationData = {
    type: 'payment',
    title,
    message: amount ? `${message} - Amount: GHS ${Math.abs(amount).toFixed(2)}` : message,
  };
  
  // Create notification in background (don't await or block UI)
  notificationService.createNotification(payload).catch((error) => {
    logger.warn('NOTIFICATION_SERVICE', 'Failed to create payment notification', error);
  });
}

/**
 * Pushes a transfer-related notification
 */
export function pushTransferNotification(
  type: 'sent' | 'received',
  amount: number,
  counterpartyName: string,
  newBalance?: number
) {
  const title = type === 'sent' ? 'Money Sent' : 'Money Received';
  let message = `${type === 'sent' ? 'You sent' : 'You received'} GHS ${amount.toFixed(2)}`;
  message += ` ${type === 'sent' ? 'to' : 'from'} ${counterpartyName}.`;
  if (typeof newBalance === 'number') {
    message += ` Your new balance is GHS ${newBalance.toFixed(2)}.`;
  }
  
  const payload: CreateNotificationData = {
    type: 'transaction',
    title,
    message,
  };
  
  // Create notification in background (don't await or block UI)
  notificationService.createNotification(payload).catch((error) => {
    logger.warn('NOTIFICATION_SERVICE', 'Failed to create transfer notification', error);
  });
}

/**
 * Pushes a system notification
 */
export function pushSystemNotification(
  title: string,
  message: string
) {
  const payload: CreateNotificationData = {
    type: 'system',
    title,
    message,
  };
  
  // Create notification in background (don't await or block UI)
  notificationService.createNotification(payload).catch((error) => {
    logger.warn('NOTIFICATION_SERVICE', 'Failed to create system notification', error);
  });
}

/**
 * Initialize the notification service
 * This is a no-op function for backward compatibility
 * The Appwrite service doesn't need initialization with context functions
 */
export function initNotificationService(appContextFunctions?: any) {
  logger.info('NOTIFICATION_SERVICE', 'Notification service initialized (Appwrite-based)');
  // No-op - the Appwrite service doesn't need these context functions
  // Notifications are managed through the Appwrite database instead
}

// Export default service
export default notificationService;
