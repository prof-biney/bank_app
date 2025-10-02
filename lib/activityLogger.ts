/**
 * Centralized Activity Logger
 * 
 * This service captures ALL app activities and logs them for display in the Activity screen.
 * Activities include: card operations, transactions, reports, modifications, user actions, etc.
 */

import { ActivityEvent } from '@/types/activity';
import { logger } from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/context/AppContext';

const ACTIVITY_STORAGE_KEY = 'comprehensive_activity_log';
const MAX_ACTIVITIES = 1000; // Keep last 1000 activities

export interface AppActivity extends ActivityEvent {
  // Extended activity with more specific fields
  userId?: string;
  metadata?: Record<string, any>;
  source: 'card' | 'transaction' | 'user' | 'system' | 'report' | 'notification' | 'auth' | 'settings';
  severity: 'low' | 'medium' | 'high' | 'critical';
  relatedEntities?: {
    cardId?: string;
    transactionId?: string;
    userId?: string;
    notificationId?: string;
  };
}

class ActivityLogger {
  private activities: AppActivity[] = [];
  private initialized = false;

  /**
   * Initialize the activity logger
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load existing activities from storage
      const storedActivities = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
      if (storedActivities) {
        this.activities = JSON.parse(storedActivities);
        logger.info('ACTIVITY_LOGGER', `Loaded ${this.activities.length} activities from storage`);
      }
      this.initialized = true;
    } catch (error) {
      logger.error('ACTIVITY_LOGGER', 'Failed to initialize activity logger', error);
      this.activities = [];
      this.initialized = true;
    }
  }

  /**
   * Log a card-related activity
   */
  async logCardActivity(
    action: 'created' | 'updated' | 'deleted' | 'balance_updated' | 'activated' | 'deactivated',
    cardId: string,
    details: {
      cardName?: string;
      cardNumber?: string;
      amount?: number;
      previousBalance?: number;
      newBalance?: number;
      description?: string;
    },
    userId?: string
  ): Promise<void> {
    const activity: AppActivity = {
      id: `card_${action}_${cardId}_${Date.now()}`,
      category: 'card',
      type: `card.${action}`,
      title: this.getCardActivityTitle(action, details),
      subtitle: details.cardNumber ? `Card ending in ${details.cardNumber.slice(-4)}` : undefined,
      description: details.description || this.getCardActivityDescription(action, details),
      amount: details.amount,
      currency: 'GHS',
      status: 'completed',
      timestamp: new Date().toISOString(),
      cardId,
      userId,
      source: 'card',
      severity: action === 'deleted' ? 'high' : action === 'balance_updated' ? 'medium' : 'low',
      tags: ['card', action],
      metadata: {
        action,
        previousBalance: details.previousBalance,
        newBalance: details.newBalance,
        cardName: details.cardName,
      },
      relatedEntities: { cardId, userId },
    };

    await this.addActivity(activity);
  }

  /**
   * Log a transaction-related activity
   */
  async logTransactionActivity(
    action: 'created' | 'updated' | 'completed' | 'failed' | 'pending' | 'approved' | 'rejected',
    transactionId: string,
    details: {
      type?: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
      amount?: number;
      cardId?: string;
      recipientCardId?: string;
      description?: string;
      failureReason?: string;
    },
    userId?: string
  ): Promise<void> {
    const activity: AppActivity = {
      id: `transaction_${action}_${transactionId}_${Date.now()}`,
      category: 'transaction',
      type: `transaction.${action}`,
      title: this.getTransactionActivityTitle(action, details),
      subtitle: details.type ? `${details.type.charAt(0).toUpperCase()}${details.type.slice(1)}` : undefined,
      description: details.description || this.getTransactionActivityDescription(action, details),
      amount: details.amount,
      currency: 'GHS',
      status: this.mapTransactionActionToStatus(action),
      timestamp: new Date().toISOString(),
      transactionId,
      cardId: details.cardId,
      userId,
      source: 'transaction',
      severity: action === 'failed' ? 'high' : action === 'completed' ? 'medium' : 'low',
      tags: ['transaction', action, details.type].filter(Boolean) as string[],
      metadata: {
        action,
        type: details.type,
        failureReason: details.failureReason,
        recipientCardId: details.recipientCardId,
      },
      relatedEntities: { 
        transactionId, 
        cardId: details.cardId, 
        userId 
      },
    };

    await this.addActivity(activity);
  }

  /**
   * Log a user-related activity
   */
  async logUserActivity(
    action: 'login' | 'logout' | 'biometric_setup' | 'biometric_auth' | 'settings_change' | 'profile_update',
    details: {
      description?: string;
      settingType?: string;
      biometricType?: string;
      success?: boolean;
    },
    userId?: string
  ): Promise<void> {
    const activity: AppActivity = {
      id: `user_${action}_${Date.now()}`,
      category: 'account',
      type: `user.${action}`,
      title: this.getUserActivityTitle(action, details),
      description: details.description || this.getUserActivityDescription(action, details),
      status: details.success !== false ? 'completed' : 'failed',
      timestamp: new Date().toISOString(),
      userId,
      source: 'user',
      severity: action === 'login' ? 'medium' : 'low',
      tags: ['user', action],
      metadata: {
        action,
        settingType: details.settingType,
        biometricType: details.biometricType,
        success: details.success,
      },
      relatedEntities: { userId },
    };

    await this.addActivity(activity);
  }

  /**
   * Log a system-related activity
   */
  async logSystemActivity(
    action: 'startup' | 'error' | 'sync' | 'backup' | 'maintenance' | 'security_event',
    details: {
      description?: string;
      errorType?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    },
    userId?: string
  ): Promise<void> {
    const activity: AppActivity = {
      id: `system_${action}_${Date.now()}`,
      category: 'account',
      type: `system.${action}`,
      title: this.getSystemActivityTitle(action, details),
      description: details.description || this.getSystemActivityDescription(action, details),
      status: action === 'error' ? 'failed' : 'completed',
      timestamp: new Date().toISOString(),
      userId,
      source: 'system',
      severity: details.severity || (action === 'error' ? 'high' : 'low'),
      tags: ['system', action],
      metadata: {
        action,
        errorType: details.errorType,
      },
      relatedEntities: { userId },
    };

    await this.addActivity(activity);
  }

  /**
   * Log a report-related activity
   */
  async logReportActivity(
    action: 'generated' | 'exported' | 'viewed',
    reportType: 'transaction_summary' | 'card_statement' | 'activity_log' | 'financial_report',
    details: {
      period?: string;
      format?: string;
      recordCount?: number;
      description?: string;
    },
    userId?: string
  ): Promise<void> {
    const activity: AppActivity = {
      id: `report_${action}_${reportType}_${Date.now()}`,
      category: 'account',
      type: `report.${action}`,
      title: this.getReportActivityTitle(action, reportType, details),
      description: details.description || this.getReportActivityDescription(action, reportType, details),
      status: 'completed',
      timestamp: new Date().toISOString(),
      userId,
      source: 'report',
      severity: 'low',
      tags: ['report', action, reportType],
      metadata: {
        action,
        reportType,
        period: details.period,
        format: details.format,
        recordCount: details.recordCount,
      },
      relatedEntities: { userId },
    };

    await this.addActivity(activity);
  }

  /**
   * Get all activities (for activity screen)
   */
  async getActivities(filters?: {
    category?: string;
    source?: string;
    severity?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<AppActivity[]> {
    await this.initialize();

    let filtered = [...this.activities];

    if (filters) {
      if (filters.category) {
        filtered = filtered.filter(a => a.category === filters.category);
      }
      if (filters.source) {
        filtered = filtered.filter(a => a.source === filters.source);
      }
      if (filters.severity) {
        filtered = filtered.filter(a => a.severity === filters.severity);
      }
      if (filters.dateFrom) {
        filtered = filtered.filter(a => new Date(a.timestamp) >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        filtered = filtered.filter(a => new Date(a.timestamp) <= filters.dateTo!);
      }
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Clear all activities
   */
  async clearActivities(): Promise<void> {
    this.activities = [];
    await AsyncStorage.removeItem(ACTIVITY_STORAGE_KEY);
    logger.info('ACTIVITY_LOGGER', 'All activities cleared');
  }

  /**
   * Delete a specific activity
   */
  async deleteActivity(activityId: string): Promise<void> {
    await this.initialize();

    const initialCount = this.activities.length;
    this.activities = this.activities.filter(activity => activity.id !== activityId);
    
    if (this.activities.length === initialCount) {
      throw new Error(`Activity with ID ${activityId} not found`);
    }

    // Persist to storage
    try {
      await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(this.activities));
      logger.info('ACTIVITY_LOGGER', `Deleted activity: ${activityId}`);
    } catch (error) {
      logger.error('ACTIVITY_LOGGER', 'Failed to save activities to storage after deletion', error);
      throw error;
    }
  }

  /**
   * Add an activity to the log
   */
  private async addActivity(activity: AppActivity): Promise<void> {
    await this.initialize();

    // Add to memory
    this.activities.unshift(activity); // Add to beginning (newest first)

    // Trim if necessary
    if (this.activities.length > MAX_ACTIVITIES) {
      this.activities = this.activities.slice(0, MAX_ACTIVITIES);
    }

    // Persist to storage
    try {
      await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(this.activities));
    } catch (error) {
      logger.error('ACTIVITY_LOGGER', 'Failed to save activities to storage', error);
    }

    // Also add to the AppContext activity array for compatibility
    try {
      const appContext = useApp.getState?.();
      if (appContext?.pushActivity) {
        // Convert to ActivityEvent format for compatibility
        const compatActivity: ActivityEvent = {
          id: activity.id,
          category: activity.category,
          type: activity.type,
          title: activity.title,
          subtitle: activity.subtitle,
          description: activity.description,
          amount: activity.amount,
          currency: activity.currency,
          status: activity.status,
          timestamp: activity.timestamp,
          cardId: activity.cardId,
          transactionId: activity.transactionId,
          tags: activity.tags,
        };
        appContext.pushActivity(compatActivity);
      }
    } catch (error) {
      // Non-critical error - continue
      logger.warn('ACTIVITY_LOGGER', 'Failed to push activity to AppContext', error);
    }

    logger.info('ACTIVITY_LOGGER', `Logged activity: ${activity.type}`, {
      id: activity.id,
      title: activity.title,
      source: activity.source,
      severity: activity.severity,
    });
  }

  // Helper methods for generating titles and descriptions
  private getCardActivityTitle(action: string, details: any): string {
    switch (action) {
      case 'created': return 'Card Created';
      case 'updated': return 'Card Updated';
      case 'deleted': return 'Card Removed';
      case 'balance_updated': return 'Balance Updated';
      case 'activated': return 'Card Activated';
      case 'deactivated': return 'Card Deactivated';
      default: return `Card ${action}`;
    }
  }

  private getCardActivityDescription(action: string, details: any): string {
    switch (action) {
      case 'created': 
        return `New card added${details.cardName ? ` - ${details.cardName}` : ''}`;
      case 'balance_updated': 
        return `Balance ${details.previousBalance && details.newBalance ? 
          `updated from GHS ${details.previousBalance} to GHS ${details.newBalance}` : 
          'updated'}`;
      case 'deleted': 
        return `Card removed${details.cardName ? ` - ${details.cardName}` : ''}`;
      default: 
        return `Card ${action}`;
    }
  }

  private getTransactionActivityTitle(action: string, details: any): string {
    switch (action) {
      case 'created': return 'Transaction Created';
      case 'completed': return 'Transaction Completed';
      case 'failed': return 'Transaction Failed';
      case 'approved': return 'Transaction Approved';
      case 'rejected': return 'Transaction Rejected';
      default: return `Transaction ${action}`;
    }
  }

  private getTransactionActivityDescription(action: string, details: any): string {
    const amount = details.amount ? `GHS ${details.amount}` : '';
    const type = details.type || 'transaction';
    
    switch (action) {
      case 'created': return `${type} of ${amount} initiated`;
      case 'completed': return `${type} of ${amount} completed successfully`;
      case 'failed': return `${type} of ${amount} failed${details.failureReason ? `: ${details.failureReason}` : ''}`;
      default: return `${type} ${action}`;
    }
  }

  private getUserActivityTitle(action: string, details: any): string {
    switch (action) {
      case 'login': return 'User Login';
      case 'logout': return 'User Logout';
      case 'biometric_setup': return 'Biometric Setup';
      case 'biometric_auth': return 'Biometric Authentication';
      case 'settings_change': return 'Settings Changed';
      case 'profile_update': return 'Profile Updated';
      default: return `User ${action}`;
    }
  }

  private getUserActivityDescription(action: string, details: any): string {
    switch (action) {
      case 'biometric_setup': 
        return `${details.biometricType || 'Biometric'} authentication ${details.success ? 'set up successfully' : 'setup failed'}`;
      case 'settings_change': 
        return `${details.settingType || 'Settings'} updated`;
      default: 
        return `User ${action} ${details.success !== false ? 'successful' : 'failed'}`;
    }
  }

  private getSystemActivityTitle(action: string, details: any): string {
    switch (action) {
      case 'startup': return 'App Started';
      case 'error': return 'System Error';
      case 'sync': return 'Data Sync';
      case 'security_event': return 'Security Event';
      default: return `System ${action}`;
    }
  }

  private getSystemActivityDescription(action: string, details: any): string {
    switch (action) {
      case 'error': return `System error: ${details.errorType || 'Unknown error'}`;
      case 'sync': return 'Data synchronization completed';
      default: return `System ${action}`;
    }
  }

  private getReportActivityTitle(action: string, reportType: string, details: any): string {
    const typeMap = {
      transaction_summary: 'Transaction Summary',
      card_statement: 'Card Statement',
      activity_log: 'Activity Log',
      financial_report: 'Financial Report',
    };
    
    return `${typeMap[reportType as keyof typeof typeMap] || reportType} ${action}`;
  }

  private getReportActivityDescription(action: string, reportType: string, details: any): string {
    const period = details.period ? ` for ${details.period}` : '';
    const format = details.format ? ` in ${details.format} format` : '';
    const count = details.recordCount ? ` (${details.recordCount} records)` : '';
    
    return `Report ${action}${period}${format}${count}`;
  }

  private mapTransactionActionToStatus(action: string): 'pending' | 'completed' | 'failed' | 'info' {
    switch (action) {
      case 'completed':
      case 'approved':
        return 'completed';
      case 'failed':
      case 'rejected':
        return 'failed';
      case 'pending':
        return 'pending';
      default:
        return 'info';
    }
  }
}

// Export singleton instance
export const activityLogger = new ActivityLogger();
export default activityLogger;