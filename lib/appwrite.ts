import {
  Avatars,
  Client,
  Databases,
  ID,
  Query,
  Storage,
} from "react-native-appwrite";
import { enhanceClientWithConnectionMonitoring } from './connectionService';
import { logger } from './logger';
import { authAccount } from './appwrite-auth';

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

// Helper to add a timeout to promises (fail-fast for network hangs)
const withTimeout = async <T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> => {
  let timeoutId: any;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutId!);
    return result as T;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
};

// Note: setKey is not available in React Native Appwrite SDK
// API keys are only used in server-side Node.js environments
// In React Native, we use JWT tokens for authentication instead
const apiKey = getOptionalConfig('apiKey');
if (apiKey && __DEV__) {
  logger.info('CONFIG', '🔑 Appwrite API key found (will be used for server operations only)');
}

// Export the dedicated authentication account instance (imported at top)
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
// Also expose a databases instance that uses the authenticated client.
// This one should be used for operations that require a user's JWT (create/update/delete documents)
export const authDatabases = new BoundDatabases(authenticatedClient);

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
  } catch (error) {
    if (__DEV__) {
      logger.auth.error('[ensureAuthenticatedClient] Error ensuring authenticated client:', error);
    }
    return false;
  }
};

// Update the createUser function with better error handling
// Minimal local types used by this module to avoid cross-file type coupling
type CreateUserParams = { email: string; password: string; name: string; phoneNumber?: string };
type User = any;

export const createUser = async ({ email, password, name, phoneNumber }: CreateUserParams): Promise<User> => {
  try {
    logger.debug('AUTH', '[createUser] Starting user creation process:', {
      accountCreateMethod: typeof account.create,
      accountType: typeof account,
      email,
      name,
      phoneNumber
    });

    // First check if user already exists. This is best-effort: if the public
    // listDocuments call fails (permissions/network), we log and continue because
    // it's preferable to attempt account creation and let the authenticated
    // createDocument call surface errors reliably.
    let existingUserFound = false;
    try {
      logger.debug('AUTH', '[createUser] Checking for existing user with email:', { email });
      const existingUser = await withTimeout(
        databases.listDocuments(
          getRequiredConfig('databaseId'),
          getRequiredConfig('userCollectionId'),
          [Query.equal('email', email)]
        ),
        8000,
        'listDocuments'
      );
      logger.debug('AUTH', '[createUser] listDocuments returned:', { count: existingUser?.documents?.length });

      if (existingUser && existingUser.documents && existingUser.documents.length > 0) {
        existingUserFound = true;
      }
    } catch (err: any) {
      // Don't abort creation on listDocuments failures; log for diagnosis and continue
      logger.warn('AUTH', '[createUser] Could not verify existing user (listDocuments failed). Proceeding with account creation. This may indicate a permissions or network issue:', err);
    }

    if (existingUserFound) {
      throw new Error('email already exists');
    }

    // Generate unique ID
    const uniqueId = ID.unique();
    logger.debug('AUTH', '[createUser] Generated unique ID:', uniqueId);

    // Create Appwrite account
    logger.debug('AUTH', '[createUser] Calling account.create with uniqueId:', uniqueId);
    let userAccount: any = null;
    try {
      userAccount = await withTimeout(
        account.create(uniqueId, email, password, name),
        8000,
        'account.create'
      );
      logger.debug('AUTH', '[createUser] Appwrite account created successfully:', { userId: userAccount?.$id });
    } catch (acctErr) {
      logger.error('AUTH', '[createUser] account.create failed:', acctErr);
      throw acctErr;
    }

    // Create user preferences document
    try {
      logger.debug('AUTH', '[createUser] Preparing to create user preferences document...');

      // Immediately create an email/password session for the newly created account so we can
      // authenticate subsequent database operations. The authAccount wrapper provides
      // createEmailPasswordSession and createJWT methods (see lib/appwrite-auth.ts).
      try {
        logger.debug('AUTH', '[createUser] Creating email/password session for new user');
        await account.createEmailPasswordSession(email, password);
        logger.debug('AUTH', '[createUser] Email/password session created');

        // Create a JWT for the authenticated client and set it so authenticatedClient can be used
        let jwtResp: any = null;
        try {
          jwtResp = await withTimeout(account.createJWT(), 8000, 'createJWT');
          if (jwtResp && jwtResp.jwt) {
            setAuthenticatedClientJWT(jwtResp.jwt);
            logger.debug('AUTH', '[createUser] JWT created and set on authenticated client');
          } else {
            logger.auth.warn('[createUser] createJWT did not return a jwt', jwtResp);
            throw new Error('JWT creation returned no token');
          }
        } catch (jwtErr) {
          logger.error('AUTH', '[createUser] createJWT failed:', jwtErr);
          throw jwtErr;
        }
      } catch (sessionError) {
        logger.error('AUTH', '[createUser] Failed to create session/JWT for new user:', sessionError);
        // If we cannot create a session, we should cleanup the created account and fail early
          try {
            await (account.raw as any).delete();
          } catch (cleanupErr) {
            logger.error('AUTH', '[createUser] Failed to cleanup account after session failure:', cleanupErr);
          }
        throw new Error('Failed to authenticate newly created user');
      }

      // Now persist the user preferences using the authenticated databases client so permissions
      // checks succeed. Use the user's ID as the document ID to make lookups straightforward.
      let userDoc: any = null;
      try {
        logger.debug('AUTH', '[createUser] Creating user document with authDatabases...');
        userDoc = await withTimeout(
          authDatabases.createDocument(
            getRequiredConfig('databaseId'),
            getRequiredConfig('userCollectionId'),
            uniqueId,
            {
              userId: uniqueId,
              email,
              name,
              phoneNumber,
              avatar: `https://cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(name)}`,
              theme: 'system',
              currency: 'USD',
              language: 'en',
              notifications: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ),
          8000,
          'createDocument'
        );

        logger.debug('AUTH', '[createUser] authDatabases.createDocument returned:', { docId: userDoc?.$id, raw: userDoc });
      } catch (createDocErr: any) {
        logger.error('AUTH', '[createUser] authDatabases.createDocument failed:', createDocErr);
        // Surface the original error message to the caller so UI can present it
        throw createDocErr;
      }

      logger.debug('AUTH', '[createUser] User preferences document created:', {
        docId: userDoc.$id
      });

  // Session already created above; no-op here (keeps behaviour consistent)
  logger.debug('AUTH', '[createUser] Session ensured earlier, skipping extra session creation');

      return userAccount;

    } catch (error) {
      logger.error('AUTH', '[createUser] Error creating user document:', error);
      
      // Cleanup: Delete the Appwrite account if document creation fails
      try {
        await (account.raw as any).delete();
        logger.debug('AUTH', '[createUser] Cleaned up Appwrite account after document creation failure');
      } catch (cleanupError) {
        logger.error('AUTH', '[createUser] Error cleaning up Appwrite account:', cleanupError);
      }
      
      throw new Error('Failed to complete account setup');
    }

  } catch (error: any) {
    logger.error('AUTH', '[createUser] Error in create user process:', error);
    
    if (error?.response?.message) {
      throw new Error(error.response.message);
    }
    
    throw error;
  }
};

// Add function to fetch user data
export const fetchUser = async (userId: string): Promise<any> => {
  // Try authenticated client first (the user document is created with the authenticated client
  // during signup, so the authenticated client may have immediate read permissions).
  try {
    if (__DEV__) logger.debug('AUTH', '[fetchUser] Attempting to fetch user using authDatabases');

    const user = await withTimeout(
      authDatabases.getDocument(
        getRequiredConfig('databaseId'),
        getRequiredConfig('userCollectionId'),
        userId
      ),
      6000,
      'auth-getDocument'
    );

    if (user && user.$id) return user;
  } catch (authErr) {
    // Authenticated fetch may fail if JWT hasn't propagated yet; log and continue to fallback
    logger.warn('AUTH', '[fetchUser] Authenticated fetch failed, will fallback to public databases:', authErr);
  }

  // Fallback: try public (non-authenticated) databases instance
  try {
    if (__DEV__) logger.debug('AUTH', '[fetchUser] Attempting to fetch user using public databases');

    const user = await withTimeout(
      databases.getDocument(
        getRequiredConfig('databaseId'),
        getRequiredConfig('userCollectionId'),
        userId
      ),
      6000,
      'public-getDocument'
    );

    return user;
  } catch (error) {
    logger.error('AUTH', '[fetchUser] Error fetching user from public databases:', error);
    throw error;
  }
};
