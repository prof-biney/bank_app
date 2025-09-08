/**
 * Dedicated Appwrite Authentication Client
 * 
 * This module provides a clean, unmodified Appwrite Client specifically for authentication operations.
 * It uses a separate client instance to avoid interference from connection monitoring, proxying,
 * or other enhancements that could affect the Account class methods.
 * 
 * @module lib/appwrite-auth
 */

import { Account, Client } from "react-native-appwrite";
import { logger } from './logger';

// Helper to resolve env vars with fallback names (supports bank/.env APPWRITE_* keys)
const env = (keys: string[], def?: string) => {
  for (const k of keys) {
    const v = (process.env as any)?.[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return def;
};

// Authentication-specific Appwrite configuration
const authConfig = {
  endpoint: env(["EXPO_PUBLIC_APPWRITE_ENDPOINT", "APPWRITE_ENDPOINT"]),
  platform: env(["EXPO_PUBLIC_APPWRITE_PLATFORM", "APPWRITE_PLATFORM"]),
  projectId: env(["EXPO_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_PROJECT_ID"]),
};

// Validate required configuration for authentication with proper error handling
if (!authConfig.endpoint || !authConfig.projectId || !authConfig.platform) {
  const missingConfigs = [];
  if (!authConfig.endpoint) missingConfigs.push('endpoint');
  if (!authConfig.projectId) missingConfigs.push('projectId');
  if (!authConfig.platform) missingConfigs.push('platform');
  
  const errorMessage = `❌ Cannot initialize Appwrite authentication: missing required configuration: ${missingConfigs.join(', ')}`;
  logger.error('CONFIG', errorMessage);
  throw new Error(`Authentication configuration incomplete. Missing: ${missingConfigs.join(', ')}. Please check your .env file.`);
}

if (__DEV__) {
  logger.info('CONFIG', '🔐 Appwrite authentication client initialized');
  logger.info('CONFIG', `📍 Auth Endpoint: ${authConfig.endpoint}`);
  logger.info('CONFIG', `🆔 Auth Project: ${authConfig.projectId}`);
  logger.info('CONFIG', `📱 Auth Platform: ${authConfig.platform}`);
}

// Create a clean, dedicated client for authentication operations only
// This client has NO connection monitoring, NO proxying, NO enhancements
const authClient = new Client();

// Safe to use non-null assertion here since we validated above
authClient
  .setEndpoint(authConfig.endpoint!)
  .setProject(authConfig.projectId!)
  .setPlatform(authConfig.platform!);

// Create a wrapper for Account to pre-bind methods and avoid context issues
class BoundAccount {
  private _account: Account;
  
  public create: typeof Account.prototype.create;
  public createEmailPasswordSession: typeof Account.prototype.createEmailPasswordSession;
  public get: typeof Account.prototype.get;
  public getSession: typeof Account.prototype.getSession;
  public deleteSession: typeof Account.prototype.deleteSession;
  public createJWT: typeof Account.prototype.createJWT;
  
  constructor(client: Client) {
    this._account = new Account(client);
    
    // Bind all methods to maintain proper context
    this.create = this._account.create.bind(this._account);
    this.createEmailPasswordSession = this._account.createEmailPasswordSession.bind(this._account);
    this.get = this._account.get.bind(this._account);
    this.getSession = this._account.getSession.bind(this._account);
    this.deleteSession = this._account.deleteSession.bind(this._account);
    this.createJWT = this._account.createJWT.bind(this._account);
  }
  
  get raw() {
    return this._account;
  }
}

// Create bound Account instance using the clean client - no more manual binding needed!
export const authAccount = new BoundAccount(authClient);

// Debug logging for authentication client
if (__DEV__) {
  logger.appwrite.debug('[Auth Client] Bound Account instance created:', {
    accountType: typeof authAccount,
    clientType: typeof authClient,
    hasCreateEmailPasswordSession: typeof authAccount.createEmailPasswordSession,
    isProperlyBound: authAccount.createEmailPasswordSession === authAccount.createEmailPasswordSession, // Should be true
  });
}

/**
 * Test the authentication account instance to ensure it's properly initialized
 */
export const testAuthAccount = () => {
  if (__DEV__) {
    logger.appwrite.debug('[Auth Client] Testing bound account instance...');
    logger.appwrite.debug('[Auth Client] Account methods available:', {
      create: typeof authAccount.create,
      createEmailPasswordSession: typeof authAccount.createEmailPasswordSession,
      get: typeof authAccount.get,
      getSession: typeof authAccount.getSession,
      deleteSession: typeof authAccount.deleteSession,
      createJWT: typeof authAccount.createJWT,
    });
    
    // Verify critical authentication methods exist and are properly bound
    const criticalMethods = ['create', 'createEmailPasswordSession', 'get', 'getSession', 'deleteSession'];
    const missingMethods = criticalMethods.filter(method => typeof (authAccount as any)[method] !== 'function');
    
    if (missingMethods.length > 0) {
      logger.appwrite.error('[Auth Client] Missing critical methods:', missingMethods);
      throw new Error(`Authentication client missing methods: ${missingMethods.join(', ')}`);
    } else {
      logger.appwrite.info('[Auth Client] ✅ All critical authentication methods available and properly bound');
    }
  }
};

// Run the test in development
if (__DEV__) {
  testAuthAccount();
}
