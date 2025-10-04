/**
 * Appwrite Activity Service
 * 
 * This module handles all activity-related operations using Appwrite database with real-time subscriptions.
 * It provides activity logging, real-time activity feeds, and comprehensive filtering.
 */

import { databaseService, Query, ID, collections } from './database';
import { authService } from './auth';
import { logger } from '../logger';

// Activity interfaces
export interface ActivityEvent {
  id?: string;
  userId?: string;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface ActivityFilters {
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
}

export interface ActivityQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'type';
  orderDirection?: 'asc' | 'desc';
  filters?: ActivityFilters;
}

// Real-time subscription types
export interface ActivityRealtimeOptions {
  onActivityCreated?: (activity: ActivityEvent) => void;
  onActivityUpdated?: (activity: ActivityEvent) => void;
  onActivityDeleted?: (activityId: string) => void;
  onError?: (error: any) => void;
}

/**
 * Appwrite Activity Service Class
 */
export class AppwriteActivityService {
  private subscriptions = new Map<string, () => void>();

  constructor() {
    logger.info('ACTIVITY_SERVICE', 'Appwrite Activity Service initialized');
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated - no user ID found');
    }
    
    logger.info('ACTIVITY_SERVICE', 'Using userId for activity operations', { userId: user.$id });
    return user.$id;
  }

  /**
   * Transform activity data to match Appwrite schema
   */
  private transformActivityForAppwrite(activityData: ActivityEvent, userId: string): any {
    return {
      userId,
      type: activityData.type,
      description: activityData.description,
      metadata: activityData.metadata || {},
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Transform Appwrite document to ActivityEvent type
   */
  private transformAppwriteToActivity(doc: any): ActivityEvent {
    return {
      id: doc.$id,
      userId: doc.userId,
      type: doc.type,
      description: doc.description,
      metadata: doc.metadata || {},
      createdAt: doc.createdAt || doc.$createdAt,
    };
  }

  /**
   * Create a new activity event (stubbed - account_updates collection removed)
   */
  async createActivity(activityData: ActivityEvent): Promise<ActivityEvent> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('ACTIVITY_SERVICE', 'Creating activity (stubbed)', {
        userId,
        type: activityData.type,
        description: activityData.description,
      });

      // Return a mock activity since we no longer use account_updates collection
      const activity: ActivityEvent = {
        id: `activity_${Date.now()}`,
        userId,
        type: activityData.type,
        description: activityData.description,
        metadata: activityData.metadata || {},
        createdAt: new Date().toISOString(),
      };

      logger.info('ACTIVITY_SERVICE', 'Activity created (stubbed)', { 
        activityId: activity.id 
      });
      return activity;
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to create activity', error);
      throw this.handleActivityError(error, 'Failed to create activity');
    }
  }

  /**
   * Get a single activity by ID (stubbed - account_updates collection removed)
   */
  async getActivity(activityId: string): Promise<ActivityEvent> {
    try {
      const userId = await this.getCurrentUserId();

      // Return a mock activity since we no longer use account_updates collection
      const activity: ActivityEvent = {
        id: activityId,
        userId,
        type: 'system',
        description: 'Activity not available (account_updates collection removed)',
        metadata: {},
        createdAt: new Date().toISOString(),
      };
      
      logger.info('ACTIVITY_SERVICE', 'Activity retrieved (stubbed)', { activityId });
      return activity;
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to get activity', error);
      throw this.handleActivityError(error, 'Failed to get activity');
    }
  }

  /**
   * Query activities for the current user
   */
  async queryActivities(options: ActivityQueryOptions = {}): Promise<{ activities: ActivityEvent[]; total: number }> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('ACTIVITY_SERVICE', 'Querying activities for user', { userId, options });

      // Build queries
      const queries = [Query.equal('userId', userId)];

      // Add filters
      if (options.filters) {
        const { type, dateFrom, dateTo } = options.filters;
        
        if (type) {
          queries.push(Query.equal('type', type));
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

      // Return empty response since account_updates collection was removed
      const response = { documents: [], total: 0 };
      
      logger.info('ACTIVITY_SERVICE', 'Query activities (stubbed - returning empty)', { userId });

      // Transform documents to ActivityEvent type
      const activities = response.documents.map(doc => this.transformAppwriteToActivity(doc));

      logger.info('ACTIVITY_SERVICE', 'Activities queried successfully', { 
        count: activities.length, 
        total: response.total 
      });

      return { activities, total: response.total };
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to query activities', error);
      throw this.handleActivityError(error, 'Failed to query activities');
    }
  }

  /**
   * Get recent activities (last 30 days by default)
   */
  async getRecentActivities(days: number = 30, limit: number = 50): Promise<ActivityEvent[]> {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      
      const result = await this.queryActivities({
        filters: {
          dateFrom: dateFrom.toISOString(),
        },
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit,
      });
      
      return result.activities;
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to get recent activities', { days, limit, error });
      return [];
    }
  }

  /**
   * Get activities by type
   */
  async getActivitiesByType(type: string, limit: number = 50): Promise<ActivityEvent[]> {
    try {
      const result = await this.queryActivities({
        filters: { type },
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit,
      });
      
      return result.activities;
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to get activities by type', { type, error });
      return [];
    }
  }

  /**
   * Delete an activity
   */
  async deleteActivity(activityId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('ACTIVITY_SERVICE', 'Deleting activity', { activityId, userId });

      // First verify the activity belongs to the current user
      const existingActivity = await this.getActivity(activityId);
      if (existingActivity.userId !== userId) {
        throw new Error('Unauthorized: Activity does not belong to current user');
      }

      // Delete from database
      await databaseService.deleteDocument(collections.accountUpdates.id, activityId);

      logger.info('ACTIVITY_SERVICE', 'Activity deleted successfully', { activityId });
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to delete activity', error);
      throw this.handleActivityError(error, 'Failed to delete activity');
    }
  }

  /**
   * Subscribe to real-time activity updates for current user
   */
  subscribeToActivities(options: ActivityRealtimeOptions = {}): () => void {
    try {
      logger.info('ACTIVITY_SERVICE', 'Setting up real-time activity subscriptions');

      const unsubscribe = databaseService.subscribeToCollection(
        collections.accountUpdates.id,
        (response) => {
          const { event, payload } = response;
          
          logger.info('ACTIVITY_SERVICE', 'Real-time activity update received', {
            event,
            activityId: payload?.$id
          });

          // Only process events for current user's activities
          if (payload?.userId) {
            authService.getCurrentUser().then(user => {
              if (user && payload.userId === user.$id) {
                const activity = this.transformAppwriteToActivity(payload);
                
                switch (event) {
                  case 'databases.*.collections.*.documents.*.create':
                    options.onActivityCreated?.(activity);
                    break;
                  case 'databases.*.collections.*.documents.*.update':
                    options.onActivityUpdated?.(activity);
                    break;
                  case 'databases.*.collections.*.documents.*.delete':
                    options.onActivityDeleted?.(payload.$id);
                    break;
                }
              }
            });
          }
        },
        {
          onError: (error) => {
            logger.error('ACTIVITY_SERVICE', 'Real-time subscription error', error);
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `activities_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('ACTIVITY_SERVICE', 'Unsubscribed from activity updates');
      };
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to subscribe to activities', error);
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Subscribe to activities by type
   */
  subscribeToActivitiesByType(type: string, options: ActivityRealtimeOptions = {}): () => void {
    try {
      logger.info('ACTIVITY_SERVICE', 'Setting up real-time subscription for activity type', { type });

      const unsubscribe = databaseService.subscribeToCollection(
        collections.accountUpdates.id,
        (response) => {
          const { event, payload } = response;
          
          // Only process events for the specific type and current user
          if (payload?.type === type && payload?.userId) {
            authService.getCurrentUser().then(user => {
              if (user && payload.userId === user.$id) {
                const activity = this.transformAppwriteToActivity(payload);
                
                switch (event) {
                  case 'databases.*.collections.*.documents.*.create':
                    options.onActivityCreated?.(activity);
                    break;
                  case 'databases.*.collections.*.documents.*.update':
                    options.onActivityUpdated?.(activity);
                    break;
                  case 'databases.*.collections.*.documents.*.delete':
                    options.onActivityDeleted?.(payload.$id);
                    break;
                }
              }
            });
          }
        },
        {
          onError: (error) => {
            logger.error('ACTIVITY_SERVICE', 'Real-time activity type subscription error', { type, error });
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `activities_type_${type}_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('ACTIVITY_SERVICE', 'Unsubscribed from activity type updates', { type });
      };
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to subscribe to activity type', { type, error });
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Subscribe to a specific activity's updates
   */
  subscribeToActivity(activityId: string, options: ActivityRealtimeOptions = {}): () => void {
    try {
      logger.info('ACTIVITY_SERVICE', 'Setting up real-time subscription for activity', { activityId });

      const unsubscribe = databaseService.subscribeToDocument(
        collections.accountUpdates.id,
        activityId,
        (response) => {
          const { event, payload } = response;
          
          logger.info('ACTIVITY_SERVICE', 'Real-time activity update received', { event, activityId });

          const activity = this.transformAppwriteToActivity(payload);
          
          switch (event) {
            case 'databases.*.collections.*.documents.*.update':
              options.onActivityUpdated?.(activity);
              break;
            case 'databases.*.collections.*.documents.*.delete':
              options.onActivityDeleted?.(activityId);
              break;
          }
        },
        {
          onError: (error) => {
            logger.error('ACTIVITY_SERVICE', 'Real-time activity subscription error', { activityId, error });
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `activity_${activityId}_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('ACTIVITY_SERVICE', 'Unsubscribed from activity updates', { activityId });
      };
    } catch (error) {
      logger.error('ACTIVITY_SERVICE', 'Failed to subscribe to activity', { activityId, error });
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Unsubscribe from all activity subscriptions
   */
  unsubscribeAll(): void {
    logger.info('ACTIVITY_SERVICE', 'Unsubscribing from all activity subscriptions', { 
      count: this.subscriptions.size 
    });
    
    this.subscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('ACTIVITY_SERVICE', 'Error unsubscribing', error);
      }
    });
    
    this.subscriptions.clear();
  }

  /**
   * Handle and format activity-related errors
   */
  private handleActivityError(error: any, defaultMessage: string): Error {
    let message = defaultMessage;
    
    if (error?.message) {
      if (error.message.includes('Unauthorized')) {
        message = 'You do not have permission to access this activity.';
      } else if (error.message.includes('not found')) {
        message = 'Activity not found.';
      } else {
        message = error.message;
      }
    }

    const formattedError = new Error(message);
    formattedError.stack = error?.stack;
    return formattedError;
  }
}

// Create and export activity service instance
export const activityService = new AppwriteActivityService();

// Export commonly used functions
export const {
  createActivity,
  getActivity,
  queryActivities,
  getRecentActivities,
  getActivitiesByType,
  deleteActivity,
  subscribeToActivities,
  subscribeToActivitiesByType,
  subscribeToActivity,
  unsubscribeAll,
} = activityService;

// Compatibility function for existing code
export async function createAppwriteActivityEvent(evt: ActivityEvent): Promise<ActivityEvent> {
  return activityService.createActivity(evt);
}

export async function queryAppwriteActivityEvents(options: { limit?: number; offset?: number } = {}) {
  const result = await activityService.queryActivities(options);
  return {
    documents: result.activities,
    total: result.total
  };
}

// Export default service
export default activityService;