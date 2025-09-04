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

// Validate required configuration for authentication
if (!authConfig.endpoint || !authConfig.projectId || !authConfig.platform) {
  console.error('❌ Cannot initialize Appwrite authentication: missing required configuration');
  throw new Error('Authentication configuration incomplete. Please check your .env file.');
}

if (__DEV__) {
  console.log('🔐 Appwrite authentication client initialized');
  console.log(`📍 Auth Endpoint: ${authConfig.endpoint}`);
  console.log(`🆔 Auth Project: ${authConfig.projectId}`);
  console.log(`📱 Auth Platform: ${authConfig.platform}`);
}

// Create a clean, dedicated client for authentication operations only
// This client has NO connection monitoring, NO proxying, NO enhancements
const authClient = new Client();

authClient
  .setEndpoint(authConfig.endpoint!)
  .setProject(authConfig.projectId!)
  .setPlatform(authConfig.platform!);

// Create dedicated Account instance using the clean client
export const authAccount = new Account(authClient);

// Debug logging for authentication client
if (__DEV__) {
  console.log('[Auth Client] Account instance created:', {
    accountType: typeof authAccount,
    clientType: typeof authClient,
    hasCreateEmailPasswordSession: typeof authAccount.createEmailPasswordSession,
    availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(authAccount)).slice(0, 10), // First 10 methods for brevity
  });
}

/**
 * Test the authentication account instance to ensure it's properly initialized
 */
export const testAuthAccount = () => {
  if (__DEV__) {
    console.log('[Auth Client] Testing account instance...');
    console.log('[Auth Client] Account methods available:', {
      create: typeof authAccount.create,
      createEmailPasswordSession: typeof authAccount.createEmailPasswordSession,
      get: typeof authAccount.get,
      getSession: typeof authAccount.getSession,
      deleteSession: typeof authAccount.deleteSession,
      createJWT: typeof authAccount.createJWT,
    });
    
    // Verify critical authentication methods exist
    const criticalMethods = ['create', 'createEmailPasswordSession', 'get', 'getSession', 'deleteSession'];
    const missingMethods = criticalMethods.filter(method => typeof (authAccount as any)[method] !== 'function');
    
    if (missingMethods.length > 0) {
      console.error('[Auth Client] Missing critical methods:', missingMethods);
      throw new Error(`Authentication client missing methods: ${missingMethods.join(', ')}`);
    } else {
      console.log('[Auth Client] ✅ All critical authentication methods available');
    }
  }
};

// Run the test in development
if (__DEV__) {
  testAuthAccount();
}
