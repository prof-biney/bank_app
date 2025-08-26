/**
 * Enhanced Notification Loading Service
 * 
 * This service provides optimized notification loading with pagination,
 * caching, and performance optimizations for large notification lists.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Query } from 'react-native-appwrite';
import { databases, appwriteConfig } from '@/lib/appwrite';
import { Notification } from '@/types';
import { trackDatabaseOperation } from '@/lib/notificationAnalytics';

interface NotificationPage {
  notifications: Notification[];
  cursor?: string;
  hasMore: boolean;
  fromCache: boolean;
}

interface NotificationCache {
  pages: {
    [cursor: string]: {
      notifications: Notification[];
      timestamp: number;
      hasMore: boolean;
    };
  };
  lastUpdated: number;
  totalCount: number;
}

interface LoadOptions {
  limit?: number;
  cursor?: string;
  useCache?: boolean;
  maxAge?: number; // Cache max age in milliseconds
  forceRefresh?: boolean;
}

class NotificationLoader {
  private static instance: NotificationLoader;
  private readonly CACHE_KEY = 'notification_pages_cache';
  private readonly DEFAULT_LIMIT = 20;
  private readonly DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_PAGES = 10;
  
  private cache: NotificationCache = {
    pages: {},
    lastUpdated: 0,
    totalCount: 0,
  };
  
  private loadingPromises: Map<string, Promise<NotificationPage>> = new Map();
  private initialized = false;

  private constructor() {
    this.initializeCache();
  }

  public static getInstance(): NotificationLoader {
    if (!NotificationLoader.instance) {
      NotificationLoader.instance = new NotificationLoader();
    }
    return NotificationLoader.instance;
  }

  private async initializeCache(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const cacheRaw = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cacheRaw) {
        this.cache = JSON.parse(cacheRaw);
        console.log('[NotificationLoader] Cache loaded with', Object.keys(this.cache.pages).length, 'pages');
      }
    } catch (error) {
      console.warn('[NotificationLoader] Failed to load cache:', error);
    }
    
    this.initialized = true;
  }

  private async saveCache(): Promise<void> {
    try {
      // Limit cache size by keeping only the most recent pages
      const pages = Object.entries(this.cache.pages)
        .sort(([, a], [, b]) => b.timestamp - a.timestamp)
        .slice(0, this.MAX_CACHE_PAGES)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as typeof this.cache.pages);

      const cacheToSave = {
        ...this.cache,
        pages,
      };

      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheToSave));
    } catch (error) {
      console.warn('[NotificationLoader] Failed to save cache:', error);
    }
  }

  private getCacheKey(cursor?: string): string {
    return cursor || 'first_page';
  }

  private isCacheValid(timestamp: number, maxAge: number): boolean {
    return Date.now() - timestamp < maxAge;
  }

  private mapAppwriteDocument(doc: any): Notification {
    return {
      id: doc.$id,
      userId: doc.userId,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      unread: typeof doc.unread === 'boolean' ? doc.unread : true,
      archived: typeof doc.archived === 'boolean' ? doc.archived : false,
      createdAt: doc.$createdAt || doc.createdAt,
    };
  }

  private async loadFromDatabase(cursor?: string, limit: number = this.DEFAULT_LIMIT): Promise<NotificationPage> {
    const startTime = Date.now();
    
    try {
      const dbId = appwriteConfig.databaseId;
      const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
      
      if (!dbId || !notifCol) {
        throw new Error('Database not configured');
      }

      // Build query with current user filter, ordering, and pagination
      const queries = [
        Query.orderDesc('$createdAt'),
        Query.limit(limit + 1), // Request one extra to check if there are more
      ];

      // Add cursor for pagination
      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }

      const response = await databases.listDocuments(dbId, notifCol, queries);
      const documents = response.documents || [];
      
      // Check if there are more notifications
      const hasMore = documents.length > limit;
      const notifications = documents.slice(0, limit).map(this.mapAppwriteDocument);
      
      // Get next cursor (last document ID)
      const nextCursor = notifications.length > 0 ? notifications[notifications.length - 1].id : undefined;
      
      const result: NotificationPage = {
        notifications,
        cursor: nextCursor,
        hasMore,
        fromCache: false,
      };
      
      // Track successful database operation
      const duration = Date.now() - startTime;
      trackDatabaseOperation(true, 'load_notifications_page', duration);
      
      console.log(`[NotificationLoader] Loaded ${notifications.length} notifications from database (${duration}ms)`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      trackDatabaseOperation(false, 'load_notifications_page', duration);
      
      console.error('[NotificationLoader] Database load failed:', error);
      throw error;
    }
  }

  private async loadFromCache(cursor?: string, maxAge: number): Promise<NotificationPage | null> {
    await this.initializeCache();
    
    const cacheKey = this.getCacheKey(cursor);
    const cachedPage = this.cache.pages[cacheKey];
    
    if (!cachedPage) {
      return null;
    }
    
    if (!this.isCacheValid(cachedPage.timestamp, maxAge)) {
      console.log('[NotificationLoader] Cache expired for key:', cacheKey);
      return null;
    }
    
    console.log(`[NotificationLoader] Loaded ${cachedPage.notifications.length} notifications from cache`);
    
    return {
      notifications: cachedPage.notifications,
      cursor: cachedPage.notifications.length > 0 ? cachedPage.notifications[cachedPage.notifications.length - 1].id : undefined,
      hasMore: cachedPage.hasMore,
      fromCache: true,
    };
  }

  private async savePage(cursor: string | undefined, page: NotificationPage): Promise<void> {
    const cacheKey = this.getCacheKey(cursor);
    
    this.cache.pages[cacheKey] = {
      notifications: page.notifications,
      timestamp: Date.now(),
      hasMore: page.hasMore,
    };
    
    this.cache.lastUpdated = Date.now();
    await this.saveCache();
  }

  // Public API

  public async loadNotifications(options: LoadOptions = {}): Promise<NotificationPage> {
    const {
      limit = this.DEFAULT_LIMIT,
      cursor,
      useCache = true,
      maxAge = this.DEFAULT_MAX_AGE,
      forceRefresh = false,
    } = options;

    // Create a unique key for this request to avoid duplicate loading
    const requestKey = `${cursor || 'first'}_${limit}`;
    
    // Check if we're already loading this page
    if (this.loadingPromises.has(requestKey)) {
      console.log('[NotificationLoader] Using existing loading promise for:', requestKey);
      return await this.loadingPromises.get(requestKey)!;
    }

    // Create loading promise
    const loadingPromise = this.performLoad(cursor, limit, useCache, maxAge, forceRefresh);
    this.loadingPromises.set(requestKey, loadingPromise);

    try {
      const result = await loadingPromise;
      return result;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(requestKey);
    }
  }

  private async performLoad(
    cursor: string | undefined,
    limit: number,
    useCache: boolean,
    maxAge: number,
    forceRefresh: boolean
  ): Promise<NotificationPage> {
    // Try cache first (unless force refresh)
    if (useCache && !forceRefresh) {
      try {
        const cached = await this.loadFromCache(cursor, maxAge);
        if (cached) {
          return cached;
        }
      } catch (error) {
        console.warn('[NotificationLoader] Cache load failed:', error);
      }
    }

    // Load from database
    try {
      const page = await this.loadFromDatabase(cursor, limit);
      
      // Save to cache in background (don't await)
      if (useCache) {
        this.savePage(cursor, page).catch(error => {
          console.warn('[NotificationLoader] Failed to cache page:', error);
        });
      }
      
      return page;
    } catch (error) {
      console.error('[NotificationLoader] Failed to load from database:', error);
      
      // Try to fall back to stale cache if available
      if (useCache) {
        console.log('[NotificationLoader] Attempting stale cache fallback');
        try {
          const staleCache = await this.loadFromCache(cursor, Infinity); // Accept any age
          if (staleCache) {
            console.log('[NotificationLoader] Using stale cache as fallback');
            return { ...staleCache, fromCache: true };
          }
        } catch (cacheError) {
          console.warn('[NotificationLoader] Stale cache fallback failed:', cacheError);
        }
      }
      
      // If all else fails, return empty page
      return {
        notifications: [],
        hasMore: false,
        fromCache: false,
      };
    }
  }

  public async loadFirstPage(options: Omit<LoadOptions, 'cursor'> = {}): Promise<NotificationPage> {
    return this.loadNotifications({ ...options, cursor: undefined });
  }

  public async loadNextPage(cursor: string, options: Omit<LoadOptions, 'cursor'> = {}): Promise<NotificationPage> {
    return this.loadNotifications({ ...options, cursor });
  }

  public async refreshFromServer(options: Omit<LoadOptions, 'forceRefresh'> = {}): Promise<NotificationPage> {
    return this.loadNotifications({ ...options, forceRefresh: true });
  }

  public async invalidateCache(cursor?: string): Promise<void> {
    await this.initializeCache();
    
    if (cursor) {
      const cacheKey = this.getCacheKey(cursor);
      delete this.cache.pages[cacheKey];
    } else {
      // Invalidate entire cache
      this.cache.pages = {};
      this.cache.lastUpdated = 0;
    }
    
    await this.saveCache();
    console.log('[NotificationLoader] Cache invalidated');
  }

  public async clearCache(): Promise<void> {
    this.cache = {
      pages: {},
      lastUpdated: 0,
      totalCount: 0,
    };
    
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
      console.log('[NotificationLoader] Cache cleared');
    } catch (error) {
      console.warn('[NotificationLoader] Failed to clear cache:', error);
    }
  }

  public getCacheStats(): {
    pages: number;
    totalNotifications: number;
    oldestPage: number;
    newestPage: number;
    cacheSize: string;
  } {
    const pages = Object.values(this.cache.pages);
    const totalNotifications = pages.reduce((sum, page) => sum + page.notifications.length, 0);
    const timestamps = pages.map(page => page.timestamp).filter(Boolean);
    
    return {
      pages: pages.length,
      totalNotifications,
      oldestPage: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestPage: timestamps.length > 0 ? Math.max(...timestamps) : 0,
      cacheSize: `${Math.round(JSON.stringify(this.cache).length / 1024)}KB`,
    };
  }

  // Batch operations for better performance

  public async preloadNextPages(currentCursor: string, pages: number = 2): Promise<void> {
    console.log(`[NotificationLoader] Preloading ${pages} pages starting from:`, currentCursor);
    
    let cursor = currentCursor;
    const promises: Promise<NotificationPage>[] = [];
    
    for (let i = 0; i < pages; i++) {
      const promise = this.loadNotifications({
        cursor,
        useCache: true,
        limit: this.DEFAULT_LIMIT,
      }).then(page => {
        cursor = page.cursor; // Update cursor for next iteration
        return page;
      });
      
      promises.push(promise);
    }
    
    try {
      await Promise.all(promises);
      console.log('[NotificationLoader] Preloading completed');
    } catch (error) {
      console.warn('[NotificationLoader] Preloading failed:', error);
    }
  }

  public async warmupCache(): Promise<void> {
    console.log('[NotificationLoader] Warming up cache...');
    
    try {
      const firstPage = await this.loadNotifications({
        useCache: false, // Force fresh load
        limit: this.DEFAULT_LIMIT * 2, // Load more on warmup
      });
      
      console.log(`[NotificationLoader] Cache warmed up with ${firstPage.notifications.length} notifications`);
      
      // Preload next page if available
      if (firstPage.hasMore && firstPage.cursor) {
        this.preloadNextPages(firstPage.cursor, 1).catch(error => {
          console.warn('[NotificationLoader] Cache warmup preload failed:', error);
        });
      }
    } catch (error) {
      console.warn('[NotificationLoader] Cache warmup failed:', error);
    }
  }
}

// Export singleton instance and convenience functions
export const notificationLoader = NotificationLoader.getInstance();

export const loadNotifications = (options?: LoadOptions) => 
  notificationLoader.loadNotifications(options);

export const loadFirstPage = (options?: Omit<LoadOptions, 'cursor'>) => 
  notificationLoader.loadFirstPage(options);

export const loadNextPage = (cursor: string, options?: Omit<LoadOptions, 'cursor'>) => 
  notificationLoader.loadNextPage(cursor, options);

export const refreshNotifications = (options?: Omit<LoadOptions, 'forceRefresh'>) => 
  notificationLoader.refreshFromServer(options);

export const invalidateNotificationCache = (cursor?: string) => 
  notificationLoader.invalidateCache(cursor);

export const clearNotificationCache = () => 
  notificationLoader.clearCache();

export const warmupNotificationCache = () => 
  notificationLoader.warmupCache();

export const getNotificationCacheStats = () => 
  notificationLoader.getCacheStats();
