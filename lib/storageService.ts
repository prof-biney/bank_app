import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '@/types';
import { ActivityEvent } from '@/types/activity';

/**
 * Storage Service
 * 
 * Centralized utility for managing persistent storage of transactions and activity logs.
 * Provides caching, data management, and cleanup functionality.
 */

// Storage keys
export const STORAGE_KEYS = {
  TRANSACTIONS: '@bankapp:transactions',
  ACTIVITY_EVENTS: '@bankapp:activity_events',
  PAYMENTS: '@bankapp:payments',
  LAST_SYNC: '@bankapp:last_sync',
  STORAGE_VERSION: '@bankapp:storage_version',
} as const;

// Configuration constants
export const STORAGE_CONFIG = {
  MAX_TRANSACTIONS: 1000,
  MAX_ACTIVITY_RETENTION_DAYS: 30,
  MAX_PAYMENTS: 500,
  CURRENT_VERSION: '1.0.0',
  SYNC_TIMEOUT_HOURS: 24,
} as const;

// Types for cached data
export interface CachedData<T> {
  data: T[];
  timestamp: number;
  version: string;
}

export interface SyncMetadata {
  lastTransactionSync?: number;
  lastActivitySync?: number;
  lastPaymentSync?: number;
  syncInProgress?: boolean;
}

/**
 * Generic storage operations with error handling
 */
export class StorageManager {
  private static async safeWrite<T>(key: string, data: T): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      await AsyncStorage.setItem(key, serialized);
      console.log(`[StorageManager] Successfully wrote ${key}`);
    } catch (error) {
      console.error(`[StorageManager] Failed to write ${key}:`, error);
      throw new Error(`Failed to save data to storage: ${key}`);
    }
  }

  private static async safeRead<T>(key: string): Promise<T | null> {
    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) return null;
      
      return JSON.parse(serialized) as T;
    } catch (error) {
      console.error(`[StorageManager] Failed to read ${key}:`, error);
      // Don't throw here - return null for graceful degradation
      return null;
    }
  }

  /**
   * Save transactions to cache with metadata
   */
  static async cacheTransactions(transactions: Transaction[]): Promise<void> {
    // Enforce transaction limit (keep most recent)
    const limitedTransactions = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, STORAGE_CONFIG.MAX_TRANSACTIONS);

    const cachedData: CachedData<Transaction> = {
      data: limitedTransactions,
      timestamp: Date.now(),
      version: STORAGE_CONFIG.CURRENT_VERSION,
    };

    await this.safeWrite(STORAGE_KEYS.TRANSACTIONS, cachedData);
    await this.updateSyncMetadata({ lastTransactionSync: Date.now() });
  }

  /**
   * Load cached transactions
   */
  static async getCachedTransactions(): Promise<{ transactions: Transaction[]; lastSync: number } | null> {
    const cached = await this.safeRead<CachedData<Transaction>>(STORAGE_KEYS.TRANSACTIONS);
    if (!cached || !cached.data) return null;

    return {
      transactions: cached.data,
      lastSync: cached.timestamp,
    };
  }

  /**
   * Save activity events to cache
   */
  static async cacheActivityEvents(events: ActivityEvent[]): Promise<void> {
    // Filter events by retention policy (last 30 days)
    const cutoffDate = Date.now() - (STORAGE_CONFIG.MAX_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const filteredEvents = events
      .filter(event => new Date(event.timestamp).getTime() > cutoffDate)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const cachedData: CachedData<ActivityEvent> = {
      data: filteredEvents,
      timestamp: Date.now(),
      version: STORAGE_CONFIG.CURRENT_VERSION,
    };

    await this.safeWrite(STORAGE_KEYS.ACTIVITY_EVENTS, cachedData);
    await this.updateSyncMetadata({ lastActivitySync: Date.now() });
  }

  /**
   * Load cached activity events
   */
  static async getCachedActivityEvents(): Promise<{ events: ActivityEvent[]; lastSync: number } | null> {
    const cached = await this.safeRead<CachedData<ActivityEvent>>(STORAGE_KEYS.ACTIVITY_EVENTS);
    if (!cached || !cached.data) return null;

    return {
      events: cached.data,
      lastSync: cached.timestamp,
    };
  }

  /**
   * Save payments data to cache
   */
  static async cachePayments(payments: any[]): Promise<void> {
    // Enforce payments limit (keep most recent)
    const limitedPayments = payments
      .sort((a, b) => {
        const aDate = new Date(a.created || a.createdAt || 0).getTime();
        const bDate = new Date(b.created || b.createdAt || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, STORAGE_CONFIG.MAX_PAYMENTS);

    const cachedData: CachedData<any> = {
      data: limitedPayments,
      timestamp: Date.now(),
      version: STORAGE_CONFIG.CURRENT_VERSION,
    };

    await this.safeWrite(STORAGE_KEYS.PAYMENTS, cachedData);
    await this.updateSyncMetadata({ lastPaymentSync: Date.now() });
  }

  /**
   * Load cached payments
   */
  static async getCachedPayments(): Promise<{ payments: any[]; lastSync: number } | null> {
    const cached = await this.safeRead<CachedData<any>>(STORAGE_KEYS.PAYMENTS);
    if (!cached || !cached.data) return null;

    return {
      payments: cached.data,
      lastSync: cached.timestamp,
    };
  }

  /**
   * Update sync metadata
   */
  private static async updateSyncMetadata(update: Partial<SyncMetadata>): Promise<void> {
    const existing = await this.safeRead<SyncMetadata>(STORAGE_KEYS.LAST_SYNC) || {};
    const updated = { ...existing, ...update };
    await this.safeWrite(STORAGE_KEYS.LAST_SYNC, updated);
  }

  /**
   * Get sync metadata
   */
  static async getSyncMetadata(): Promise<SyncMetadata> {
    return await this.safeRead<SyncMetadata>(STORAGE_KEYS.LAST_SYNC) || {};
  }

  /**
   * Check if data is stale and needs sync
   */
  static async isDataStale(): Promise<{ transactions: boolean; activity: boolean; payments: boolean }> {
    const metadata = await this.getSyncMetadata();
    const staleThreshold = STORAGE_CONFIG.SYNC_TIMEOUT_HOURS * 60 * 60 * 1000; // Convert to ms
    const now = Date.now();

    return {
      transactions: !metadata.lastTransactionSync || (now - metadata.lastTransactionSync) > staleThreshold,
      activity: !metadata.lastActivitySync || (now - metadata.lastActivitySync) > staleThreshold,
      payments: !metadata.lastPaymentSync || (now - metadata.lastPaymentSync) > staleThreshold,
    };
  }

  /**
   * Merge transactions intelligently (avoid duplicates)
   */
  static mergeTransactions(cached: Transaction[], fresh: Transaction[]): Transaction[] {
    const transactionMap = new Map<string, Transaction>();
    
    // Add cached transactions first
    cached.forEach(tx => transactionMap.set(tx.id, tx));
    
    // Add/update with fresh transactions (server data wins)
    fresh.forEach(tx => transactionMap.set(tx.id, tx));

    return Array.from(transactionMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Merge activity events (avoid duplicates)
   */
  static mergeActivityEvents(cached: ActivityEvent[], fresh: ActivityEvent[]): ActivityEvent[] {
    const eventMap = new Map<string, ActivityEvent>();
    
    // Add cached events first
    cached.forEach(event => eventMap.set(event.id, event));
    
    // Add/update with fresh events
    fresh.forEach(event => eventMap.set(event.id, event));

    return Array.from(eventMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clear cached transactions only
   */
  static async clearTransactionCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      console.log('[StorageManager] Transaction cache cleared');
    } catch (error) {
      console.warn('[StorageManager] Failed to clear transaction cache:', error);
      throw error;
    }
  }

  /**
   * Clear cached activity events only
   */
  static async clearActivityCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVITY_EVENTS);
      console.log('[StorageManager] Activity cache cleared');
    } catch (error) {
      console.warn('[StorageManager] Failed to clear activity cache:', error);
      throw error;
    }
  }

  /**
   * Clear all cached data (for troubleshooting or logout)
   */
  static async clearAllCache(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS);
    await Promise.all(keys.map(key => 
      AsyncStorage.removeItem(key).catch(error => 
        console.warn(`[StorageManager] Failed to remove ${key}:`, error)
      )
    ));
    console.log('[StorageManager] All cache cleared');
  }

  /**
   * Get cache size information
   */
  static async getCacheInfo(): Promise<{
    transactionCount: number;
    activityCount: number;
    paymentCount: number;
    lastSync: SyncMetadata;
  }> {
    const [transactions, activity, payments, syncMeta] = await Promise.all([
      this.getCachedTransactions(),
      this.getCachedActivityEvents(), 
      this.getCachedPayments(),
      this.getSyncMetadata()
    ]);

    return {
      transactionCount: transactions?.transactions.length || 0,
      activityCount: activity?.events.length || 0,
      paymentCount: payments?.payments.length || 0,
      lastSync: syncMeta,
    };
  }

  /**
   * Cleanup old data based on retention policies
   */
  static async cleanupOldData(): Promise<void> {
    try {
      // Clean old activity events
      const activityData = await this.getCachedActivityEvents();
      if (activityData) {
        const cutoffDate = Date.now() - (STORAGE_CONFIG.MAX_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const filteredEvents = activityData.events.filter(
          event => new Date(event.timestamp).getTime() > cutoffDate
        );
        
        if (filteredEvents.length !== activityData.events.length) {
          await this.cacheActivityEvents(filteredEvents);
          console.log(`[StorageManager] Cleaned ${activityData.events.length - filteredEvents.length} old activity events`);
        }
      }

      // Ensure transaction limit
      const transactionData = await this.getCachedTransactions();
      if (transactionData && transactionData.transactions.length > STORAGE_CONFIG.MAX_TRANSACTIONS) {
        const limitedTransactions = transactionData.transactions
          .slice(0, STORAGE_CONFIG.MAX_TRANSACTIONS);
        await this.cacheTransactions(limitedTransactions);
        console.log(`[StorageManager] Trimmed transactions to ${STORAGE_CONFIG.MAX_TRANSACTIONS} limit`);
      }

    } catch (error) {
      console.error('[StorageManager] Cleanup failed:', error);
    }
  }

  /**
   * Migration utility for future schema changes
   */
  static async migrateIfNeeded(): Promise<void> {
    try {
      const currentVersion = await this.safeRead<string>(STORAGE_KEYS.STORAGE_VERSION);
      
      if (!currentVersion || currentVersion !== STORAGE_CONFIG.CURRENT_VERSION) {
        console.log(`[StorageManager] Migrating storage from ${currentVersion} to ${STORAGE_CONFIG.CURRENT_VERSION}`);
        
        // For now, just clear cache on version mismatch
        // In future versions, add migration logic here
        await this.clearAllCache();
        await this.safeWrite(STORAGE_KEYS.STORAGE_VERSION, STORAGE_CONFIG.CURRENT_VERSION);
        
        console.log('[StorageManager] Migration completed');
      }
    } catch (error) {
      console.error('[StorageManager] Migration failed:', error);
    }
  }
}
