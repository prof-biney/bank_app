/**
 * Appwrite Configuration
 * 
 * This module sets up the Appwrite client and services for the banking application.
 * It provides centralized configuration for authentication, database operations,
 * real-time subscriptions, and file storage.
 */

import { Client, Account, Databases, Storage, Functions, Query, ID } from 'appwrite';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../logger';

// Environment configuration helper
const getEnvVar = (keys: string[], fallback?: string): string => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable: ${keys.join(' or ')}`);
};

// Appwrite configuration
export const appwriteConfig = {
  endpoint: getEnvVar(['EXPO_PUBLIC_APPWRITE_ENDPOINT', 'APPWRITE_ENDPOINT']),
  projectId: getEnvVar(['EXPO_PUBLIC_APPWRITE_PROJECT_ID', 'APPWRITE_PROJECT_ID']),
  databaseId: getEnvVar(['EXPO_PUBLIC_APPWRITE_DATABASE_ID', 'APPWRITE_DATABASE_ID']),
  
  // Collection IDs
  usersCollectionId: getEnvVar(['EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID', 'APPWRITE_USER_COLLECTION_ID']),
  cardsCollectionId: getEnvVar(['EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID', 'APPWRITE_CARDS_COLLECTION_ID']),
  transactionsCollectionId: getEnvVar(['EXPO_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID', 'APPWRITE_TRANSACTIONS_COLLECTION_ID']),
  accountUpdatesCollectionId: getEnvVar(['EXPO_PUBLIC_APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID', 'APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID'], 'account_updates'),
  notificationsCollectionId: getEnvVar(['EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID', 'APPWRITE_NOTIFICATIONS_COLLECTION_ID']),
  
  // Biometric collections (optional - will use fallback names if not configured)
  biometricTokensCollectionId: getEnvVar(['EXPO_PUBLIC_APPWRITE_BIOMETRIC_TOKENS_COLLECTION_ID', 'APPWRITE_BIOMETRIC_TOKENS_COLLECTION_ID'], 'biometric_tokens'),
  biometricAuditCollectionId: getEnvVar(['EXPO_PUBLIC_APPWRITE_BIOMETRIC_AUDIT_COLLECTION_ID', 'APPWRITE_BIOMETRIC_AUDIT_COLLECTION_ID'], 'biometric_audit'),
  
  // Storage configuration
  storageBucketId: getEnvVar(['EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID', 'APPWRITE_STORAGE_BUCKET_ID']),
  
  // Platform identifier
  platform: getEnvVar(['EXPO_PUBLIC_APPWRITE_PLATFORM', 'APPWRITE_PLATFORM'], 'com.bankapp.vault'),
};

// Validate configuration
const validateConfig = () => {
  const required = [
    'endpoint',
    'projectId', 
    'databaseId',
    'usersCollectionId',
    'cardsCollectionId', 
    'transactionsCollectionId',
    'notificationsCollectionId'
  ];
  
  for (const key of required) {
    if (!appwriteConfig[key as keyof typeof appwriteConfig]) {
      logger.error('APPWRITE_CONFIG', `Missing required config: ${key}`);
      throw new Error(`Appwrite configuration error: ${key} is required`);
    }
  }
  
  logger.info('APPWRITE_CONFIG', 'Configuration validated successfully', {
    endpoint: appwriteConfig.endpoint,
    projectId: appwriteConfig.projectId,
    databaseId: appwriteConfig.databaseId,
    platform: appwriteConfig.platform,
  });
};

// Initialize Appwrite client
const createClient = (): Client => {
  try {
    validateConfig();
    
    const client = new Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId);
    
    // Note: setPlatform was removed in newer Appwrite SDK versions
    // Platform detection is handled automatically
    
    logger.info('APPWRITE_CLIENT', 'Client initialized successfully', {
      endpoint: appwriteConfig.endpoint,
      projectId: appwriteConfig.projectId,
      platform: Platform.OS,
    });
    
    return client;
  } catch (error) {
    logger.error('APPWRITE_CLIENT', 'Failed to initialize client', error);
    throw error;
  }
};

// Client instance
export const client = createClient();

// Services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

// Realtime is accessed through client.subscribe()
// Use client for real-time subscriptions

// Helper functions and utilities
export { Query, ID };

/**
 * ID generator compatible with Appwrite
 */
export const AppwriteID = {
  unique: () => ID.unique(),
  custom: (id: string) => ID.custom(id),
};

/**
 * Query builder helpers for common operations
 */
export const AppwriteQuery = {
  equal: (field: string, value: any) => Query.equal(field, value),
  notEqual: (field: string, value: any) => Query.notEqual(field, value),
  lessThan: (field: string, value: any) => Query.lessThan(field, value),
  lessThanEqual: (field: string, value: any) => Query.lessThanEqual(field, value),
  greaterThan: (field: string, value: any) => Query.greaterThan(field, value),
  greaterThanEqual: (field: string, value: any) => Query.greaterThanEqual(field, value),
  in: (field: string, values: any[]) => Query.equal(field, values), // Use equal for single values or contains for arrays
  search: (field: string, value: string) => Query.search(field, value),
  orderAsc: (field: string) => Query.orderAsc(field),
  orderDesc: (field: string) => Query.orderDesc(field),
  limit: (count: number) => Query.limit(count),
  offset: (count: number) => Query.offset(count),
  select: (fields: string[]) => Query.select(fields),
  cursorAfter: (documentId: string) => Query.cursorAfter(documentId),
  cursorBefore: (documentId: string) => Query.cursorBefore(documentId),
};

/**
 * Collection helper to get collection configuration
 */
export const collections = {
  users: {
    id: appwriteConfig.usersCollectionId,
    databaseId: appwriteConfig.databaseId,
  },
  cards: {
    id: appwriteConfig.cardsCollectionId,
    databaseId: appwriteConfig.databaseId,
  },
  transactions: {
    id: appwriteConfig.transactionsCollectionId,
    databaseId: appwriteConfig.databaseId,
  },
  accountUpdates: {
    id: appwriteConfig.accountUpdatesCollectionId,
    databaseId: appwriteConfig.databaseId,
  },
  notifications: {
    id: appwriteConfig.notificationsCollectionId,
    databaseId: appwriteConfig.databaseId,
  },
  biometricTokens: {
    id: appwriteConfig.biometricTokensCollectionId,
    databaseId: appwriteConfig.databaseId,
  },
  biometricAudit: {
    id: appwriteConfig.biometricAuditCollectionId,
    databaseId: appwriteConfig.databaseId,
  },
};

/**
 * Real-time subscription helper
 */
export const createRealtimeSubscription = (
  channels: string[],
  callback: (response: any) => void,
  onError?: (error: any) => void
) => {
  try {
    logger.info('APPWRITE_REALTIME', 'Creating subscription', { channels });
    
    // In newer Appwrite SDK, use client.subscribe directly
    const unsubscribe = client.subscribe(channels, callback);
    
    return unsubscribe;
  } catch (error) {
    logger.error('APPWRITE_REALTIME', 'Failed to create subscription', error);
    if (onError) onError(error);
    throw error;
  }
};

/**
 * Storage helper for file operations
 */
export const storageHelpers = {
  uploadFile: async (file: File | Blob, fileId?: string) => {
    try {
      const id = fileId || AppwriteID.unique();
      const result = await storage.createFile(appwriteConfig.storageBucketId, id, file);
      logger.info('APPWRITE_STORAGE', 'File uploaded', { fileId: result.$id });
      return result;
    } catch (error) {
      logger.error('APPWRITE_STORAGE', 'Failed to upload file', error);
      throw error;
    }
  },
  
  deleteFile: async (fileId: string) => {
    try {
      await storage.deleteFile(appwriteConfig.storageBucketId, fileId);
      logger.info('APPWRITE_STORAGE', 'File deleted', { fileId });
    } catch (error) {
      logger.error('APPWRITE_STORAGE', 'Failed to delete file', error);
      throw error;
    }
  },
  
  getFileView: (fileId: string) => {
    return storage.getFileView(appwriteConfig.storageBucketId, fileId);
  },
  
  getFilePreview: (fileId: string, width?: number, height?: number) => {
    return storage.getFilePreview(appwriteConfig.storageBucketId, fileId, width, height);
  },
};

/**
 * Session persistence helper for React Native
 */
export const sessionHelpers = {
  saveSession: async (session: any) => {
    try {
      await AsyncStorage.setItem('@appwrite_session', JSON.stringify(session));
      logger.info('APPWRITE_SESSION', 'Session saved to storage');
    } catch (error) {
      logger.error('APPWRITE_SESSION', 'Failed to save session', error);
    }
  },
  
  getSession: async () => {
    try {
      const sessionData = await AsyncStorage.getItem('@appwrite_session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        logger.info('APPWRITE_SESSION', 'Session restored from storage');
        return session;
      }
      return null;
    } catch (error) {
      logger.error('APPWRITE_SESSION', 'Failed to restore session', error);
      return null;
    }
  },
  
  clearSession: async () => {
    try {
      await AsyncStorage.removeItem('@appwrite_session');
      logger.info('APPWRITE_SESSION', 'Session cleared from storage');
    } catch (error) {
      logger.error('APPWRITE_SESSION', 'Failed to clear session', error);
    }
  },
};

/**
 * Connection status monitoring
 */
export const connectionHelpers = {
  isOnline: () => {
    // In React Native, we can use NetInfo, but for now return true
    return true;
  },
  
  onConnectionChange: (callback: (isOnline: boolean) => void) => {
    // Implement NetInfo listener for React Native
    // For now, assume always online
    callback(true);
  },
};

// Default export for convenience
export default {
  client,
  account,
  databases,
  storage,
  functions,
  config: appwriteConfig,
  collections,
  Query: AppwriteQuery,
  ID: AppwriteID,
  createRealtimeSubscription,
  storageHelpers,
  sessionHelpers,
  connectionHelpers,
};
