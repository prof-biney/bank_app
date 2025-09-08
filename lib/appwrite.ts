import {
  Account,
  Avatars,
  Client,
  Databases,
  ID,
  Query,
  Storage,
} from "react-native-appwrite";
import { enhanceClientWithConnectionMonitoring } from './connectionService';
import { logger } from './logger';

// Helper to resolve env vars with fallback names (supports bank/.env APPWRITE_* keys)
const env = (keys: string[], def?: string) => {
  for (const k of keys) {
    const v = (process.env as any)?.[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return def;
};

// Check for required environment variables (accept either EXPO_PUBLIC_* or APPWRITE_* forms)
const requiredPairs: [string, string][] = [
  ["EXPO_PUBLIC_APPWRITE_ENDPOINT", "APPWRITE_ENDPOINT"],
  ["EXPO_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_PROJECT_ID"],
  ["EXPO_PUBLIC_APPWRITE_PLATFORM", "APPWRITE_PLATFORM"],
  ["EXPO_PUBLIC_APPWRITE_DATABASE_ID", "APPWRITE_DATABASE_ID"],
  ["EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID", "APPWRITE_USER_COLLECTION_ID"],
];

const missingEnvVars = requiredPairs
  .filter(([a, b]) => !process.env[a] && !process.env[b])
  .map(([a, b]) => `${a} (or ${b})`);

if (missingEnvVars.length > 0) {
  logger.warn('CONFIG', `Missing required environment variables: ${missingEnvVars.join(", ")}`);
  logger.warn('CONFIG', "Please check your .env (Expo) or bank/.env (server-style) and make sure all required variables are defined.");
}

// Appwrite configuration - all values from environment variables, no hardcoded defaults
export const appwriteConfig = {
  endpoint: env(["EXPO_PUBLIC_APPWRITE_ENDPOINT", "APPWRITE_ENDPOINT"]),
  platform: env(["EXPO_PUBLIC_APPWRITE_PLATFORM", "APPWRITE_PLATFORM"]),
  projectId: env(["EXPO_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_PROJECT_ID"]),
  databaseId: env(["EXPO_PUBLIC_APPWRITE_DATABASE_ID", "APPWRITE_DATABASE_ID"]),
  userCollectionId: env(["EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID", "APPWRITE_USER_COLLECTION_ID"]),
  // Storage bucket for profile pictures
  storageBucketId: env(["EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID", "APPWRITE_STORAGE_BUCKET_ID"]),
  // Collections for realtime activity
  transactionsCollectionId: env(["EXPO_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID", "APPWRITE_TRANSACTIONS_COLLECTION_ID"]),
  cardsCollectionId: env(["EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID", "APPWRITE_CARDS_COLLECTION_ID"]),
  accountUpdatesCollectionId: env(["EXPO_PUBLIC_APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID", "APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID"]),
  notificationsCollectionId: env(["EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID", "APPWRITE_NOTIFICATIONS_COLLECTION_ID"]),
  // API key for server operations
  apiKey: env(["EXPO_PUBLIC_APPWRITE_API_KEY", "APPWRITE_API_KEY"]),
};

// Safe config accessor functions
export const getRequiredConfig = (key: keyof typeof appwriteConfig): string => {
  const value = appwriteConfig[key];
  if (!value) {
    throw new Error(`Required configuration missing: ${key}. Please check your environment variables.`);
  }
  return value;
};

export const getOptionalConfig = (key: keyof typeof appwriteConfig): string | undefined => {
  return appwriteConfig[key] || undefined;
};

// Validate required configuration values with proper error handling
const requiredConfigValues = [
  { key: 'endpoint', value: appwriteConfig.endpoint },
  { key: 'projectId', value: appwriteConfig.projectId },
  { key: 'platform', value: appwriteConfig.platform },
  { key: 'databaseId', value: appwriteConfig.databaseId },
  { key: 'userCollectionId', value: appwriteConfig.userCollectionId },
];

const missingRequired = requiredConfigValues.filter(config => !config.value);
if (missingRequired.length > 0) {
  const missing = missingRequired.map(c => c.key).join(', ');
  const errorMessage = `❌ Missing required Appwrite configuration: ${missing}`;
  const helpMessage = 'Please check your .env file and ensure all required EXPO_PUBLIC_APPWRITE_* variables are set.';
  
  logger.error('CONFIG', errorMessage);
  logger.error('CONFIG', helpMessage);
  
  // Fail fast with clear error instead of allowing runtime crashes
  throw new Error(`${errorMessage}\n${helpMessage}`);
}

// Optional configuration warnings
const optionalConfigValues = [
  { key: 'storageBucketId', value: appwriteConfig.storageBucketId, feature: 'Profile picture uploads' },
  { key: 'transactionsCollectionId', value: appwriteConfig.transactionsCollectionId, feature: 'Transaction persistence' },
  { key: 'cardsCollectionId', value: appwriteConfig.cardsCollectionId, feature: 'Card management' },
  { key: 'notificationsCollectionId', value: appwriteConfig.notificationsCollectionId, feature: 'Notifications' },
];

const missingOptional = optionalConfigValues.filter(config => !config.value);
if (missingOptional.length > 0) {
  logger.warn('CONFIG', '⚠️  Optional Appwrite configuration missing:');
  missingOptional.forEach(config => {
    logger.warn('CONFIG', `  - ${config.key}: ${config.feature} will not be available`);
  });
}

if (appwriteConfig.endpoint && appwriteConfig.projectId && appwriteConfig.platform) {
  logger.info('CONFIG', '✅ Appwrite configuration loaded successfully');
  logger.info('CONFIG', `📍 Endpoint: ${appwriteConfig.endpoint}`);
  logger.info('CONFIG', `🆔 Project: ${appwriteConfig.projectId}`);
  logger.info('CONFIG', `📱 Platform: ${appwriteConfig.platform}`);
}

// Initialize clients only if required configuration is available
// Note: This check is redundant now since we validate above and throw early
// But keeping it for extra safety
if (!appwriteConfig.endpoint || !appwriteConfig.projectId || !appwriteConfig.platform) {
  const errorMessage = '❌ Cannot initialize Appwrite clients: missing required configuration';
  logger.error('CONFIG', errorMessage);
  throw new Error('Appwrite configuration incomplete. Please check your .env file.');
}

const baseClient = new Client();

baseClient
  .setEndpoint(getRequiredConfig('endpoint'))
  .setProject(getRequiredConfig('projectId'))
  .setPlatform(getRequiredConfig('platform'));

// Enhanced client with connection monitoring
export const client = enhanceClientWithConnectionMonitoring(baseClient);

// Create a separate client for authenticated operations that can have JWT set dynamically
export const authenticatedClient = new Client();
authenticatedClient
  .setEndpoint(getRequiredConfig('endpoint'))
  .setProject(getRequiredConfig('projectId'))
  .setPlatform(getRequiredConfig('platform'));

// Note: setKey is not available in React Native Appwrite SDK
// API keys are only used in server-side Node.js environments
// In React Native, we use JWT tokens for authentication instead
const apiKey = getOptionalConfig('apiKey');
if (apiKey && __DEV__) {
  logger.info('CONFIG', '🔑 Appwrite API key found (will be used for server operations only)');
}

// Import the dedicated authentication account instance
// This uses a clean, unmodified client to avoid method binding issues
import { authAccount } from './appwrite-auth';
export const account = authAccount;

// Create a wrapper for Databases to pre-bind all methods and avoid context issues
class BoundDatabases {
  private _databases: Databases;
  
  // Pre-bound methods to avoid context issues
  public createDocument: typeof Databases.prototype.createDocument;
  public listDocuments: typeof Databases.prototype.listDocuments;
  public updateDocument: typeof Databases.prototype.updateDocument;
  public deleteDocument: typeof Databases.prototype.deleteDocument;
  public getDocument: typeof Databases.prototype.getDocument;
  
  constructor(client: Client) {
    this._databases = new Databases(client);
    
    // Bind all methods to maintain proper context
    this.createDocument = this._databases.createDocument.bind(this._databases);
    this.listDocuments = this._databases.listDocuments.bind(this._databases);
    this.updateDocument = this._databases.updateDocument.bind(this._databases);
    this.deleteDocument = this._databases.deleteDocument.bind(this._databases);
    this.getDocument = this._databases.getDocument.bind(this._databases);
  }
  
  // Provide access to underlying instance for any unbinded methods if needed
  get raw() {
    return this._databases;
  }
}

// Use bound database client - no more manual binding needed!
export const databases = new BoundDatabases(client);

// Debug logging
if (__DEV__) {
  logger.appwrite.debug('[Appwrite Setup] Bound Database initialized:', {
    databasesType: typeof databases,
    listDocumentsMethod: typeof databases.listDocuments,
    createDocumentMethod: typeof databases.createDocument,
    isProperlyBound: databases.createDocument === databases.createDocument // Should be true
  });
}

// Create a wrapper for Storage to pre-bind methods
class BoundStorage {
  private _storage: Storage;
  
  public createFile: typeof Storage.prototype.createFile;
  public deleteFile: typeof Storage.prototype.deleteFile;
  public getFileView: typeof Storage.prototype.getFileView;
  
  constructor(client: Client) {
    this._storage = new Storage(client);
    
    this.createFile = this._storage.createFile.bind(this._storage);
    this.deleteFile = this._storage.deleteFile.bind(this._storage);
    this.getFileView = this._storage.getFileView.bind(this._storage);
  }
  
  get raw() {
    return this._storage;
  }
}

// Create a wrapper for Avatars to pre-bind methods
class BoundAvatars {
  private _avatars: Avatars;
  
  // Define the method signature explicitly rather than using typeof
  public getInitialsURL: (name: string, width?: number, height?: number, background?: string) => URL;
  
  constructor(client: Client) {
    this._avatars = new Avatars(client);
    
    // Debug: Log all available methods on the Avatars instance
    if (__DEV__) {
      logger.appwrite.debug('[BoundAvatars] Available methods:', {
        avatarsType: typeof this._avatars,
        availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(this._avatars)),
        hasGetInitials: 'getInitials' in this._avatars,
        hasGetInitialsURL: 'getInitialsURL' in this._avatars,
        getInitialsType: typeof (this._avatars as any).getInitials,
        getInitialsURLType: typeof (this._avatars as any).getInitialsURL
      });
    }
    
    // Bind the getInitialsURL method (this is the correct method name)
    if ('getInitialsURL' in this._avatars && typeof (this._avatars as any).getInitialsURL === 'function') {
      this.getInitialsURL = (this._avatars as any).getInitialsURL.bind(this._avatars);
      if (__DEV__) {
        logger.appwrite.debug('[BoundAvatars] Successfully bound getInitialsURL method');
      }
    } else {
      logger.appwrite.error('[BoundAvatars] getInitialsURL method not found on Avatars instance');
      // Provide a fallback function that generates a simple initials URL
      this.getInitialsURL = (name: string) => {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
        return new URL(`https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6366F1&color=ffffff`);
      };
    }
  }
  
  get raw() {
    return this._avatars;
  }
}

export const storage = new BoundStorage(client);
export const avatars = new BoundAvatars(client);

/**
 * Set JWT token on the authenticated client for database operations
 * @param jwt - JWT token from account.createJWT()
 */
export const setAuthenticatedClientJWT = (jwt: string | null) => {
  if (jwt) {
    authenticatedClient.setJWT(jwt);
    logger.auth.info('[setAuthenticatedClientJWT] JWT token set on authenticated client');
  } else {
    logger.auth.warn('[setAuthenticatedClientJWT] No JWT token provided');
  }
};

/**
 * Ensure the authenticated client has a valid JWT token
 * @returns Promise<boolean> - true if JWT is set successfully
 */
export const ensureAuthenticatedClient = async (): Promise<boolean> => {
  try {
    // Get JWT from global store first
    const globalJWT = (global as any).__APPWRITE_JWT__;
    if (globalJWT) {
      setAuthenticatedClientJWT(globalJWT);
      return true;
    }

    // Check if we have an active session before trying to create JWT
    try {
      const session = await account.getSession('current');
      if (!session) {
        if (__DEV__) {
          logger.auth.warn('[ensureAuthenticatedClient] No active session found');
        }
        return false;
      }
      
      if (__DEV__) {
        logger.auth.info('[ensureAuthenticatedClient] Active session found, creating JWT');
      }
      
      // If we have a session, try to create JWT
      const jwtResponse = await account.createJWT();
      if (jwtResponse?.jwt) {
        (global as any).__APPWRITE_JWT__ = jwtResponse.jwt;
        setAuthenticatedClientJWT(jwtResponse.jwt);
        if (__DEV__) {
          logger.auth.info('[ensureAuthenticatedClient] New JWT created and set successfully');
        }
        return true;
      } else {
        if (__DEV__) {
          logger.auth.warn('[ensureAuthenticatedClient] JWT creation returned no token');
        }
        return false;
      }
    } catch (jwtError: any) {
      if (__DEV__) {
        logger.auth.error('[ensureAuthenticatedClient] JWT creation failed:', jwtError);
      }
      
      // Clear the invalid JWT
      (global as any).__APPWRITE_JWT__ = undefined;
      
      // Handle specific JWT creation errors
      if (jwtError.message?.includes('missing scope (account)')) {
        logger.auth.error('[ensureAuthenticatedClient] Critical: Missing account scope - user needs to re-authenticate');
        return false;
      } else if (jwtError.message?.includes('role: guests')) {
        logger.auth.error('[ensureAuthenticatedClient] Critical: User has guest role - authentication failed');
        return false;
      } else if (jwtError.message?.includes('missing scope')) {
        logger.auth.error('[ensureAuthenticatedClient] Missing required scopes:', jwtError.message);
        return false;
      } else {
        // Other JWT errors (network, server issues, etc.)
        logger.auth.warn('[ensureAuthenticatedClient] JWT creation failed with unknown error:', jwtError.message);
        return false;
      }
    }

    return false;
  } catch (error) {
    if (__DEV__) {
      logger.auth.error('[ensureAuthenticatedClient] Error ensuring authenticated client:', error);
    }
    return false;
  }
};

export const createUser = async ({
  name,
  email,
  password,
  phoneNumber,
}: {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string; // Make it optional for backward compatibility
}) => {
  try {
    if (__DEV__) {
      logger.auth.debug('[createUser] Starting user creation process:', {
        name,
        email,
        phoneNumber,
        accountType: typeof account,
        accountCreateMethod: typeof account.create
      });
    }
    
    if (__DEV__) {
      logger.auth.debug('[createUser] About to call account.create:', {
        IDExists: typeof ID !== 'undefined',
        IDUniqueExists: typeof ID.unique !== 'undefined',
        accountExists: typeof account !== 'undefined',
        accountCreateExists: typeof account.create !== 'undefined',
        emailType: typeof email,
        passwordType: typeof password,
        nameType: typeof name
      });
    }
    
    let uniqueId;
    try {
      uniqueId = ID.unique();
      if (__DEV__) {
        logger.auth.debug('[createUser] ID.unique() called successfully:', { uniqueId, uniqueIdType: typeof uniqueId });
      }
    } catch (idError) {
      logger.auth.error('[createUser] ID.unique() failed:', idError);
      throw new Error(`Failed to generate unique ID: ${idError}`);
    }
    
    if (__DEV__) {
      logger.auth.debug('[createUser] About to call account.create with resolved parameters:', {
        uniqueId,
        email,
        passwordLength: password.length,
        name,
        accountCreateType: typeof account.create
      });
    }
    
    const newAccount = await account.create(uniqueId, email, password, name);

    if (!newAccount) {
      throw new Error("Failed to create account");
    }

    if (__DEV__) {
      logger.auth.debug('[createUser] Account created successfully:', {
        accountId: newAccount.$id,
        avatarsType: typeof avatars,
        avatarsObject: avatars,
        getInitialsURLMethod: typeof avatars.getInitialsURL,
        hasGetInitialsURL: 'getInitialsURL' in avatars
      });
    }

    // Generate avatar URL with robust fallback mechanism
    const generateAvatarUrl = (userName: string): string => {
      try {
        // Extract initials from the user's name
        const initials = userName
          .split(' ')
          .filter(part => part.length > 0)
          .map(part => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2); // Limit to 2 characters
        
        // Use a reliable external service for avatar generation
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6366F1&color=ffffff&size=200&font-size=0.6&format=png`;
        
        if (__DEV__) {
          logger.auth.debug('[createUser] Generated avatar URL from initials:', {
            userName,
            initials,
            avatarUrl
          });
        }
        
        return avatarUrl;
      } catch (error) {
        logger.auth.error('[createUser] Failed to generate avatar URL from initials:', error);
        // Ultimate fallback - use a generic avatar
        return 'https://ui-avatars.com/api/?name=U&background=6366F1&color=ffffff&size=200';
      }
    };
    
    let avatarUrl: string;
    
    // Try to use Appwrite's built-in avatar service first
    try {
      if (__DEV__) {
        logger.auth.debug('[createUser] Attempting to use Appwrite avatar service');
      }
      
      const avatarURLObject = avatars.getInitialsURL(name);
      avatarUrl = avatarURLObject.toString();
      
      if (__DEV__) {
        logger.auth.debug('[createUser] Appwrite avatar URL generated successfully:', { avatarUrl });
      }
    } catch (avatarError) {
      logger.auth.warn('[createUser] Appwrite avatar service failed, using fallback:', avatarError);
      
      // Use our reliable fallback avatar generation
      avatarUrl = generateAvatarUrl(name);
      
      if (__DEV__) {
        logger.auth.info('[createUser] Using fallback avatar URL:', { avatarUrl });
      }
    }
    
    // Ensure we always have a valid avatar URL
    if (!avatarUrl || avatarUrl.trim() === '') {
      avatarUrl = generateAvatarUrl(name);
      logger.auth.warn('[createUser] Empty avatar URL detected, using generated fallback:', { avatarUrl });
    }

    if (__DEV__) {
      logger.database.debug('[createUser] About to create user document:', {
        databaseId: appwriteConfig.databaseId,
        userCollectionId: appwriteConfig.userCollectionId,
        accountId: newAccount.$id,
        databasesType: typeof databases,
        createDocumentMethod: typeof databases.createDocument
      });
    }

    // Prepare user document data with validation
    const userDocumentData = {
      accountId: newAccount.$id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber || null, // Ensure phone number is properly handled
      avatar: avatarUrl, // This should always be a valid URL now
    };
    
    if (__DEV__) {
      logger.database.debug('[createUser] User document data prepared:', {
        ...userDocumentData,
        avatar: `${avatarUrl.substring(0, 50)}...` // Log truncated URL for readability
      });
    }
    
    // Validate required fields before attempting to create the document
    if (!userDocumentData.accountId || !userDocumentData.name || !userDocumentData.email || !userDocumentData.avatar) {
      throw new Error('Missing required fields for user document creation');
    }
    
    try {
      // No need for manual binding - method is already bound
      const result = await databases.createDocument(
        getRequiredConfig('databaseId'),
        getRequiredConfig('userCollectionId'),
        ID.unique(),
        userDocumentData
      );
      
      if (__DEV__) {
        logger.database.info('[createUser] User document created successfully:', result.$id);
      }
      
      return result;
    } catch (createError: any) {
      logger.database.error('[createUser] Database createDocument failed:', createError);
      logger.database.error('[createUser] Database createDocument error details:', {
        message: createError.message,
        name: createError.name,
        stack: createError.stack
      });
      throw createError;
    }
  } catch (error) {
    logger.auth.error("Create user error:", error);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    if (__DEV__) {
      logger.auth.info('[signIn] Attempting to create email password session');
      logger.auth.debug('[signIn] Debug info:', {
        accountObject: typeof account,
        accountMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(account)),
        createEmailPasswordSessionMethod: typeof account.createEmailPasswordSession,
        accountClientType: typeof account.client,
        emailType: typeof email,
        passwordType: typeof password
      });
    }
    
    // Clear any existing sessions first
    try {
      await account.deleteSession('current');
    } catch (e) {
      // Ignore errors when clearing sessions
    }
    
    // Add specific debugging for the method call
    if (__DEV__) {
      logger.auth.debug('[signIn] About to call createEmailPasswordSession');
      logger.auth.debug('[signIn] Method exists:', 'createEmailPasswordSession' in account);
      logger.auth.debug('[signIn] Method type:', typeof account.createEmailPasswordSession);
    }
    
    let session;
    try {
      if (__DEV__) {
        logger.auth.debug('[signIn] Calling createEmailPasswordSession (correct method name)');
      }
      // Use the correct method name from react-native-appwrite
      // account methods are properly bound in appwrite-auth.ts
      session = await account.createEmailPasswordSession(email, password);
    } catch (methodError: any) {
      logger.auth.error('[signIn] Method execution failed:', methodError);
      logger.auth.error('[signIn] Method error details:', {
        name: methodError.name,
        message: methodError.message,
        stack: methodError.stack
      });
      throw methodError;
    }
    
    if (__DEV__) {
      logger.auth.info('[signIn] Session created successfully:', { 
        sessionId: session.$id,
        userId: session.userId 
      });
    }
    
    // Immediately verify the session works by checking account
    try {
      const currentAccount = await account.get();
      if (__DEV__) {
        logger.auth.info('[signIn] Session verified, account accessible:', {
          accountId: currentAccount.$id,
          email: currentAccount.email
        });
      }
    } catch (verifyError) {
      logger.auth.error('[signIn] Session verification failed:', verifyError);
      throw new Error('Authentication failed - session could not be verified');
    }
    
    return session;
  } catch (error) {
    logger.auth.error("[signIn] Sign in error:", error);
    
    // Provide more specific error messaging
    if (error instanceof Error) {
      if (error.message.includes('Invalid credentials')) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      } else if (error.message.includes('too many requests')) {
        throw new Error('Too many login attempts. Please wait a few minutes before trying again.');
      } else if (error.message.includes('User not found')) {
        throw new Error('No account found with this email. Please sign up first.');
      } else if (error.message.includes('missing scope')) {
        throw new Error('Authentication system error. Please contact support.');
      }
    }
    
    throw error;
  }
};

export const signOut = async () => {
  try {
    if (__DEV__) {
      logger.auth.info('[signOut] Starting logout process with token expiration');
    }
    
    // Import token manager functions
    const { performCompleteCleanup } = await import('./tokenManager');
    
    // Perform comprehensive cleanup (expires tokens, deletes session, clears data)
    await performCompleteCleanup();
    
    if (__DEV__) {
      logger.auth.info('[signOut] Logout completed with token expiration');
    }
  } catch (error) {
    logger.auth.error('[signOut] Sign out error:', error);
    
    // Even if logout fails, ensure local cleanup
    try {
      const { clearTokenData, expireToken } = await import('./tokenManager');
      expireToken();
      clearTokenData();
      if (__DEV__) {
        logger.auth.info('[signOut] Performed emergency token cleanup');
      }
    } catch (cleanupError) {
      logger.auth.error('[signOut] Emergency cleanup failed:', cleanupError);
    }
    
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    if (__DEV__) {
      logger.auth.info('[getCurrentUser] Starting user retrieval process');
    }
    
    // First verify we have an active session
    try {
      const session = await account.getSession('current');
      if (!session) {
        throw new Error('No active session found');
      }
      
      if (__DEV__) {
        logger.auth.info('[getCurrentUser] Active session verified:', { sessionId: session.$id });
      }
    } catch (sessionError: any) {
      logger.auth.error('[getCurrentUser] Session verification failed:', sessionError.message);
      
      // Perform automatic token cleanup on session errors
      try {
        const { clearTokenData, expireToken } = await import('./tokenManager');
        if (__DEV__) {
          logger.auth.info('[getCurrentUser] Performing automatic token cleanup due to session error');
        }
        expireToken();
        clearTokenData();
      } catch (cleanupError) {
        logger.auth.error('[getCurrentUser] Token cleanup failed:', cleanupError);
      }
      
      if (sessionError.message?.includes('missing scope')) {
        throw new Error('Authentication session invalid. Please sign in again.');
      }
      throw new Error('No valid authentication session. Please sign in.');
    }
    
    // get the current account
    if (__DEV__) {
      logger.auth.info('[getCurrentUser] Fetching current account details');
    }
    
    const currentAccount = await account.get();
    
    if (__DEV__) {
      logger.auth.info('[getCurrentUser] Current account retrieved:', { 
        accountId: currentAccount.$id,
        email: currentAccount.email,
        emailVerification: currentAccount.emailVerification 
      });
    }

    if (!currentAccount) {
      throw new Error("No authenticated user account found");
    }

    // Ensure we have a JWT for database operations
    if (__DEV__) {
      logger.auth.info('[getCurrentUser] Ensuring authenticated client for database access');
    }
    
    const hasJWT = await ensureAuthenticatedClient();
    if (!hasJWT) {
      logger.auth.warn('[getCurrentUser] Warning: No JWT available for database operations, attempting without JWT');
    }

    if (__DEV__) {
      logger.database.info('[getCurrentUser] Querying user document from database');
      logger.database.debug('[getCurrentUser] Database params:', {
        databaseId: appwriteConfig.databaseId,
        userCollectionId: appwriteConfig.userCollectionId,
        accountId: currentAccount.$id,
        databasesObject: typeof databases,
        listDocumentsMethod: typeof databases.listDocuments
      });
    }
    
    // get the user from the database
    try {
      // No need for manual binding - method is already bound
      const currentUser = await databases.listDocuments(
        getRequiredConfig('databaseId'),
        getRequiredConfig('userCollectionId'),
        [Query.equal("accountId", currentAccount.$id)]
      );
      
      if (__DEV__) {
        logger.database.info('[getCurrentUser] Database query completed:', { 
          documentsFound: currentUser.documents.length,
          totalDocuments: currentUser.total 
        });
      }
      
      if (!currentUser || currentUser.documents.length === 0) {
        logger.auth.error('[getCurrentUser] No user document found for authenticated account');
        logger.auth.error('[getCurrentUser] This suggests the user account exists in Appwrite Auth but not in the users collection');
        throw new Error(`No user profile found for account ID: ${currentAccount.$id}. Please contact support.`);
      }

      const userDocument = currentUser.documents[0];
      
      if (__DEV__) {
        logger.database.info('[getCurrentUser] User document retrieved successfully:', {
          documentId: userDocument.$id,
          name: userDocument.name,
          email: userDocument.email
        });
      }
      
      // return the user
      return userDocument;
    } catch (dbError: any) {
      logger.database.error('[getCurrentUser] Database query failed:', dbError);
      logger.database.error('[getCurrentUser] Database query error details:', {
        message: dbError.message,
        name: dbError.name,
        stack: dbError.stack
      });
      throw dbError;
    }
  } catch (error) {
    logger.auth.error('[getCurrentUser] Get current user error:', error);
    
    // Provide more specific error information
    if (error instanceof Error) {
      if (error.message.includes('missing scope (account)')) {
        throw new Error('Authentication system error: missing account scope. Please sign in again.');
      } else if (error.message.includes('missing scope (databases)')) {
        throw new Error('Database access denied: missing permissions. Please contact support.');
      } else if (error.message.includes('missing scope')) {
        throw new Error('Authentication session has insufficient permissions. Please sign in again.');
      } else if (error.message.includes('Unauthorized')) {
        throw new Error('Access denied to user data. Please check your authentication and try again.');
      } else if (error.message.includes('role: guests')) {
        throw new Error('You are not properly authenticated. Please sign in to access your account.');
      } else if (error.message.includes('No valid authentication session')) {
        // Re-throw our custom session errors as-is
        throw error;
      } else if (error.message.includes('No user profile found')) {
        // Re-throw our custom user document errors as-is
        throw error;
      }
    }
    
    throw error;
  }
};

// ---------------- Card Event Logging ----------------
export type CardEventStatus = "added" | "removed";
export type CardEventInput = {
  cardId: string;
  userId?: string;
  last4?: string;
  brand?: string;
  cardHolderName?: string;
  expiryDate?: string; // MM/YY
  status: CardEventStatus;
  title?: string;
  description?: string;
  // Optional extras for activity mapping
  accountId?: string;
};

/**
 * Persist a card event (added/removed) to Appwrite in the cards collection.
 * This is designed to power the activity timeline via Realtime subscriptions.
 * If the cards collection id is not configured, this will no-op.
 */
export const logCardEvent = async (input: CardEventInput) => {
  const databaseId = getOptionalConfig('databaseId');
  const cardsCollectionId = getOptionalConfig('cardsCollectionId');
  if (!databaseId || !cardsCollectionId) {
    // Silently skip if not configured
    return null;
  }

  try {
    const payload: Record<string, any> = {
      type: "card.event",
      status: input.status,
      cardId: input.cardId,
      userId: input.userId,
      last4: input.last4,
      brand: input.brand,
      holder: input.cardHolderName, // Use 'holder' instead of 'cardHolderName' to match schema
      expiryDate: input.expiryDate,
      title: input.title || (input.status === "added" ? "Card added" : "Card removed"),
      description: input.description,
      accountId: input.accountId,
      category: "card",
      timestamp: new Date().toISOString(),
    };

    return await databases.createDocument(databaseId, cardsCollectionId, ID.unique(), payload);
  } catch (error) {
    logger.database.error("logCardEvent error:", error);
    // Do not throw to avoid breaking UI flows; just report
    return null;
  }
};

// ---------------- Profile Picture Management ----------------

/**
 * Uploads a profile picture to Appwrite Storage
 * @param imageUri - Local URI of the image to upload
 * @param userId - User's account ID for unique file naming
 * @returns Upload result with file ID and URL
 */
export const uploadProfilePicture = async (imageUri: string, userId: string) => {
  const storageBucketId = getOptionalConfig('storageBucketId');
  
  if (!storageBucketId) {
    throw new Error("Storage bucket ID not configured");
  }

  try {
    // Create a unique file name using user ID and timestamp
    const fileName = `profile_${userId}_${Date.now()}.jpg`;
    
    // Create file object from image URI
    const file = {
      name: fileName,
      type: "image/jpeg",
      uri: imageUri,
    } as any;

    // Upload file to storage
    const uploadedFile = await storage.createFile(
      storageBucketId,
      ID.unique(),
      file
    );

    // Generate public URL for the file
    const fileUrl = storage.getFileView(storageBucketId, uploadedFile.$id);

    return {
      fileId: uploadedFile.$id,
      fileUrl: fileUrl.toString(),
      fileName: uploadedFile.name,
    };
  } catch (error) {
    logger.error('STORAGE', "Upload profile picture error:", error);
    throw error;
  }
};

/**
 * Deletes a profile picture from Appwrite Storage
 * @param fileId - File ID to delete
 */
export const deleteProfilePicture = async (fileId: string) => {
  const storageBucketId = getOptionalConfig('storageBucketId');
  
  if (!storageBucketId) {
    throw new Error("Storage bucket ID not configured");
  }

  try {
    await storage.deleteFile(storageBucketId, fileId);
  } catch (error) {
    logger.error('STORAGE', "Delete profile picture error:", error);
    // Don't throw error here as the file might already be deleted
  }
};

/**
 * Gets the public URL for a profile picture
 * @param fileId - File ID to get URL for
 * @returns Public URL of the file
 */
export const getProfilePictureUrl = (fileId: string): string => {
  const storageBucketId = getOptionalConfig('storageBucketId');
  
  if (!storageBucketId) {
    throw new Error("Storage bucket ID not configured");
  }

  return storage.getFileView(storageBucketId, fileId).toString();
};

/**
 * Updates user profile with new avatar information
 * @param userId - User's document ID
 * @param avatarUrl - New avatar URL
 * @param avatarFileId - File ID of the uploaded avatar (optional)
 */
export const updateUserProfile = async (
  userId: string, 
  avatarUrl: string, 
  avatarFileId?: string
) => {
  try {
    const updateData: any = {
      avatar: avatarUrl,
    };
    
    // Add avatarFileId if provided (for tracking uploaded files)
    if (avatarFileId) {
      updateData.avatarFileId = avatarFileId;
    }

    const updatedUser = await databases.updateDocument(
      getRequiredConfig('databaseId'),
      getRequiredConfig('userCollectionId'),
      userId,
      updateData
    );

    return updatedUser;
  } catch (error) {
    logger.database.error("Update user profile error:", error);
    throw error;
  }
};
