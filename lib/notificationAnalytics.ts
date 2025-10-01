import { logger } from '@/lib/logger';
/**
 * Notification Analytics Service
 * 
 * This service tracks notification engagement metrics and system performance
 * to help improve the notification experience and identify issues.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notification } from '@/types';

interface NotificationMetrics {
  // Engagement metrics
  totalNotifications: number;
  readNotifications: number;
  unreadNotifications: number;
  archivedNotifications: number;
  deletedNotifications: number;
  
  // Performance metrics
  avgReadTime: number; // Average time to read a notification (in minutes)
  engagementRate: number; // Percentage of notifications that were read
  
  // Type-based metrics
  typeMetrics: {
    [type: string]: {
      count: number;
      readCount: number;
      engagementRate: number;
    };
  };
  
  // Time-based metrics
  dailyStats: {
    [date: string]: {
      received: number;
      read: number;
      deleted: number;
      archived: number;
    };
  };
  
  // System performance metrics
  systemMetrics: {
    successfulDatabaseOps: number;
    failedDatabaseOps: number;
    syncSuccess: number;
    syncFailures: number;
    avgSyncTime: number; // in milliseconds
  };
  
  lastUpdated: string;
}

interface NotificationEvent {
  id: string;
  notificationId: string;
  event: 'created' | 'read' | 'unread' | 'archived' | 'unarchived' | 'deleted';
  timestamp: string;
  type?: string;
  metadata?: any;
}

class NotificationAnalyticsService {
  private static instance: NotificationAnalyticsService;
  private readonly METRICS_KEY = 'notification_metrics';
  private readonly EVENTS_KEY = 'notification_events';
  private readonly MAX_EVENTS = 1000; // Keep last 1000 events
  
  private metrics: NotificationMetrics = this.getDefaultMetrics();
  private events: NotificationEvent[] = [];

  private constructor() {
    this.loadMetrics();
  }

  public static getInstance(): NotificationAnalyticsService {
    if (!NotificationAnalyticsService.instance) {
      NotificationAnalyticsService.instance = new NotificationAnalyticsService();
    }
    return NotificationAnalyticsService.instance;
  }

  private getDefaultMetrics(): NotificationMetrics {
    return {
      totalNotifications: 0,
      readNotifications: 0,
      unreadNotifications: 0,
      archivedNotifications: 0,
      deletedNotifications: 0,
      avgReadTime: 0,
      engagementRate: 0,
      typeMetrics: {},
      dailyStats: {},
      systemMetrics: {
        successfulDatabaseOps: 0,
        failedDatabaseOps: 0,
        syncSuccess: 0,
        syncFailures: 0,
        avgSyncTime: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  private async loadMetrics(): Promise<void> {
    try {
      const [metricsRaw, eventsRaw] = await Promise.all([
        AsyncStorage.getItem(this.METRICS_KEY),
        AsyncStorage.getItem(this.EVENTS_KEY),
      ]);

      if (metricsRaw) {
        this.metrics = { ...this.getDefaultMetrics(), ...JSON.parse(metricsRaw) };
      }

      if (eventsRaw) {
        this.events = JSON.parse(eventsRaw);
      }
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to load metrics:', error);
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      this.metrics.lastUpdated = new Date().toISOString();
      
      await Promise.all([
        AsyncStorage.setItem(this.METRICS_KEY, JSON.stringify(this.metrics)),
        AsyncStorage.setItem(this.EVENTS_KEY, JSON.stringify(this.events.slice(-this.MAX_EVENTS))),
      ]);
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to save metrics:', error);
    }
  }

  private addEvent(event: Omit<NotificationEvent, 'id' | 'timestamp'>): void {
    const newEvent: NotificationEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.events.push(newEvent);
    
    // Keep only the last MAX_EVENTS events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  private getDateKey(date: Date | string = new Date()): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private updateDailyStats(event: string, date?: Date | string): void {
    const dateKey = this.getDateKey(date);
    
    if (!this.metrics.dailyStats[dateKey]) {
      this.metrics.dailyStats[dateKey] = {
        received: 0,
        read: 0,
        deleted: 0,
        archived: 0,
      };
    }

    const stats = this.metrics.dailyStats[dateKey];
    if (event === 'created') stats.received++;
    else if (event === 'read') stats.read++;
    else if (event === 'deleted') stats.deleted++;
    else if (event === 'archived') stats.archived++;
  }

  private updateTypeMetrics(type: string, event: string): void {
    if (!this.metrics.typeMetrics[type]) {
      this.metrics.typeMetrics[type] = {
        count: 0,
        readCount: 0,
        engagementRate: 0,
      };
    }

    const typeMetric = this.metrics.typeMetrics[type];
    if (event === 'created') {
      typeMetric.count++;
    } else if (event === 'read') {
      typeMetric.readCount++;
    }

    // Update engagement rate
    typeMetric.engagementRate = typeMetric.count > 0 
      ? (typeMetric.readCount / typeMetric.count) * 100 
      : 0;
  }

  private recalculateMetrics(): void {
    // Recalculate overall engagement rate
    this.metrics.engagementRate = this.metrics.totalNotifications > 0
      ? (this.metrics.readNotifications / this.metrics.totalNotifications) * 100
      : 0;

    // Calculate average read time based on events
    const readEvents = this.events.filter(e => e.event === 'read');
    const createEvents = this.events.filter(e => e.event === 'created');
    
    if (readEvents.length > 0 && createEvents.length > 0) {
      let totalReadTime = 0;
      let validReadTimes = 0;

      readEvents.forEach(readEvent => {
        const createEvent = createEvents.find(ce => ce.notificationId === readEvent.notificationId);
        if (createEvent) {
          const readTime = new Date(readEvent.timestamp).getTime() - new Date(createEvent.timestamp).getTime();
          const readTimeMinutes = readTime / (1000 * 60); // Convert to minutes
          
          // Only count reasonable read times (between 1 minute and 7 days)
          if (readTimeMinutes >= 1 && readTimeMinutes <= 10080) {
            totalReadTime += readTimeMinutes;
            validReadTimes++;
          }
        }
      });

      this.metrics.avgReadTime = validReadTimes > 0 ? totalReadTime / validReadTimes : 0;
    }
  }

  // Public methods for tracking events

  public trackNotificationCreated(notification: Notification): void {
    try {
      this.addEvent({
        notificationId: notification.id,
        event: 'created',
        type: notification.type,
        metadata: {
          title: notification.title?.substring(0, 50), // Store truncated title for analysis
          hasMessage: !!notification.message,
        },
      });

      this.metrics.totalNotifications++;
      this.metrics.unreadNotifications++;
      
      if (notification.type) {
        this.updateTypeMetrics(notification.type, 'created');
      }
      
      this.updateDailyStats('created');
      this.recalculateMetrics();
      this.saveMetrics();
      
      logger.info('ANALYTICS', '[NotificationAnalytics] Tracked notification created:', notification.id);
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to track notification created:', error);
    }
  }

  public trackNotificationRead(notificationId: string, type?: string): void {
    try {
      this.addEvent({
        notificationId,
        event: 'read',
        type,
      });

      this.metrics.readNotifications++;
      this.metrics.unreadNotifications = Math.max(0, this.metrics.unreadNotifications - 1);
      
      if (type) {
        this.updateTypeMetrics(type, 'read');
      }
      
      this.updateDailyStats('read');
      this.recalculateMetrics();
      this.saveMetrics();
      
      logger.info('ANALYTICS', '[NotificationAnalytics] Tracked notification read:', notificationId);
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to track notification read:', error);
    }
  }

  public trackNotificationArchived(notificationId: string, type?: string): void {
    try {
      this.addEvent({
        notificationId,
        event: 'archived',
        type,
      });

      this.metrics.archivedNotifications++;
      this.updateDailyStats('archived');
      this.saveMetrics();
      
      logger.info('ANALYTICS', '[NotificationAnalytics] Tracked notification archived:', notificationId);
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to track notification archived:', error);
    }
  }

  public trackNotificationDeleted(notificationId: string, type?: string): void {
    try {
      this.addEvent({
        notificationId,
        event: 'deleted',
        type,
      });

      this.metrics.deletedNotifications++;
      this.updateDailyStats('deleted');
      this.saveMetrics();
      
      logger.info('ANALYTICS', '[NotificationAnalytics] Tracked notification deleted:', notificationId);
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to track notification deleted:', error);
    }
  }

  public trackDatabaseOperation(success: boolean, operation: string, duration?: number): void {
    try {
      if (success) {
        this.metrics.systemMetrics.successfulDatabaseOps++;
        this.metrics.systemMetrics.syncSuccess++;
      } else {
        this.metrics.systemMetrics.failedDatabaseOps++;
        this.metrics.systemMetrics.syncFailures++;
      }

      // Update average sync time
      if (duration !== undefined && success) {
        const totalOps = this.metrics.systemMetrics.successfulDatabaseOps;
        const currentAvg = this.metrics.systemMetrics.avgSyncTime;
        this.metrics.systemMetrics.avgSyncTime = ((currentAvg * (totalOps - 1)) + duration) / totalOps;
      }

      this.saveMetrics();
      
      logger.info('ANALYTICS', `[NotificationAnalytics] Tracked database operation: ${operation} - ${success ? 'success' : 'failure'}${duration ? ` (${duration}ms)` : ''}`);
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to track database operation:', error);
    }
  }

  public trackBatchOperation(operation: string, total: number, successful: number, failed: number, duration?: number): void {
    try {
      this.addEvent({
        notificationId: 'batch',
        event: operation as any,
        metadata: {
          total,
          successful,
          failed,
          duration,
          successRate: (successful / total) * 100,
        },
      });

      this.metrics.systemMetrics.successfulDatabaseOps += successful;
      this.metrics.systemMetrics.failedDatabaseOps += failed;

      if (successful > 0) {
        this.metrics.systemMetrics.syncSuccess++;
      }
      if (failed > 0) {
        this.metrics.systemMetrics.syncFailures++;
      }

      this.saveMetrics();
      
      logger.info('ANALYTICS', `[NotificationAnalytics] Tracked batch operation: ${operation} - ${successful}/${total} successful`);
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to track batch operation:', error);
    }
  }

  // Public methods for getting analytics data

  public getMetrics(): NotificationMetrics {
    return { ...this.metrics };
  }

  public getEngagementSummary(): {
    totalNotifications: number;
    engagementRate: number;
    avgReadTime: number;
    topPerformingTypes: Array<{ type: string; engagementRate: number; count: number }>;
  } {
    const topTypes = Object.entries(this.metrics.typeMetrics)
      .map(([type, metrics]) => ({ type, ...metrics }))
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5);

    return {
      totalNotifications: this.metrics.totalNotifications,
      engagementRate: this.metrics.engagementRate,
      avgReadTime: this.metrics.avgReadTime,
      topPerformingTypes: topTypes,
    };
  }

  public getSystemHealth(): {
    syncSuccessRate: number;
    avgSyncTime: number;
    totalOperations: number;
    recentFailures: number;
  } {
    const totalOps = this.metrics.systemMetrics.successfulDatabaseOps + this.metrics.systemMetrics.failedDatabaseOps;
    const successRate = totalOps > 0 
      ? (this.metrics.systemMetrics.successfulDatabaseOps / totalOps) * 100 
      : 100;

    // Count recent failures (last 24 hours)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentFailures = this.events.filter(e => 
      e.timestamp > dayAgo && e.metadata?.successful === false
    ).length;

    return {
      syncSuccessRate: successRate,
      avgSyncTime: this.metrics.systemMetrics.avgSyncTime,
      totalOperations: totalOps,
      recentFailures,
    };
  }

  public getDailyStats(days: number = 7): { date: string; received: number; read: number; engagementRate: number }[] {
    const result = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = this.getDateKey(date);
      
      const stats = this.metrics.dailyStats[dateKey] || { received: 0, read: 0, deleted: 0, archived: 0 };
      const engagementRate = stats.received > 0 ? (stats.read / stats.received) * 100 : 0;

      result.push({
        date: dateKey,
        received: stats.received,
        read: stats.read,
        engagementRate,
      });
    }

    return result;
  }

  public exportAnalytics(): {
    metrics: NotificationMetrics;
    recentEvents: NotificationEvent[];
    summary: ReturnType<NotificationAnalyticsService['getEngagementSummary']>;
    health: ReturnType<NotificationAnalyticsService['getSystemHealth']>;
  } {
    return {
      metrics: this.getMetrics(),
      recentEvents: this.events.slice(-100), // Last 100 events
      summary: this.getEngagementSummary(),
      health: this.getSystemHealth(),
    };
  }

  public async clearAnalytics(): Promise<void> {
    try {
      this.metrics = this.getDefaultMetrics();
      this.events = [];
      
      await Promise.all([
        AsyncStorage.removeItem(this.METRICS_KEY),
        AsyncStorage.removeItem(this.EVENTS_KEY),
      ]);
      
      logger.info('ANALYTICS', '[NotificationAnalytics] Analytics data cleared');
    } catch (error) {
      logger.warn('ANALYTICS', '[NotificationAnalytics] Failed to clear analytics:', error);
    }
  }
}

// Export singleton instance
export const notificationAnalytics = NotificationAnalyticsService.getInstance();

// Helper functions for easy integration
export const trackNotificationCreated = (notification: Notification) => 
  notificationAnalytics.trackNotificationCreated(notification);

export const trackNotificationRead = (notificationId: string, type?: string) => 
  notificationAnalytics.trackNotificationRead(notificationId, type);

export const trackNotificationArchived = (notificationId: string, type?: string) => 
  notificationAnalytics.trackNotificationArchived(notificationId, type);

export const trackNotificationDeleted = (notificationId: string, type?: string) => 
  notificationAnalytics.trackNotificationDeleted(notificationId, type);

export const trackDatabaseOperation = (success: boolean, operation: string, duration?: number) => 
  notificationAnalytics.trackDatabaseOperation(success, operation, duration);

export const trackBatchOperation = (operation: string, total: number, successful: number, failed: number, duration?: number) => 
  notificationAnalytics.trackBatchOperation(operation, total, successful, failed, duration);

// Analytics reporting
export const getNotificationMetrics = () => notificationAnalytics.getMetrics();
export const getEngagementSummary = () => notificationAnalytics.getEngagementSummary();
export const getSystemHealth = () => notificationAnalytics.getSystemHealth();
export const getDailyStats = (days?: number) => notificationAnalytics.getDailyStats(days);
export const exportAnalytics = () => notificationAnalytics.exportAnalytics();
