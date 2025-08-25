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
  console.warn(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  console.warn(
    "Please check your .env (Expo) or bank/.env (server-style) and make sure all required variables are defined."
  );
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

// Validate required configuration values
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
  console.error(`❌ Missing required Appwrite configuration: ${missing}`);
  console.error('Please check your .env file and ensure all required EXPO_PUBLIC_APPWRITE_* variables are set.');
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
  console.warn('⚠️  Optional Appwrite configuration missing:');
  missingOptional.forEach(config => {
    console.warn(`  - ${config.key}: ${config.feature} will not be available`);
  });
}

if (appwriteConfig.endpoint && appwriteConfig.projectId && appwriteConfig.platform) {
  console.log('✅ Appwrite configuration loaded successfully');
  console.log(`📍 Endpoint: ${appwriteConfig.endpoint}`);
  console.log(`🆔 Project: ${appwriteConfig.projectId}`);
  console.log(`📱 Platform: ${appwriteConfig.platform}`);
}

// Initialize clients only if required configuration is available
if (!appwriteConfig.endpoint || !appwriteConfig.projectId || !appwriteConfig.platform) {
  console.error('❌ Cannot initialize Appwrite clients: missing required configuration');
  throw new Error('Appwrite configuration incomplete. Please check your .env file.');
}

const baseClient = new Client();

baseClient
  .setEndpoint(appwriteConfig.endpoint!)
  .setProject(appwriteConfig.projectId!)
  .setPlatform(appwriteConfig.platform!);

// Enhanced client with connection monitoring
export const client = enhanceClientWithConnectionMonitoring(baseClient);

// Create a separate client for authenticated operations that can have JWT set dynamically
export const authenticatedClient = new Client();
authenticatedClient
  .setEndpoint(appwriteConfig.endpoint!)
  .setProject(appwriteConfig.projectId!)
  .setPlatform(appwriteConfig.platform!);

// Note: setKey is not available in React Native Appwrite SDK
// API keys are only used in server-side Node.js environments
// In React Native, we use JWT tokens for authentication instead
if (appwriteConfig.apiKey) {
  console.log('🔑 Appwrite API key found (will be used for server operations only)');
  console.warn('Note: API keys cannot be used in React Native client - using JWT authentication instead');
}

export const account = new Account(client);

// Use authenticated client for database operations
export const databases = new Databases(authenticatedClient);

export const storage = new Storage(client);

const avatars = new Avatars(client);

/**
 * Set JWT token on the authenticated client for database operations
 * @param jwt - JWT token from account.createJWT()
 */
export const setAuthenticatedClientJWT = (jwt: string | null) => {
  if (jwt) {
    authenticatedClient.setJWT(jwt);
    console.log('[setAuthenticatedClientJWT] JWT token set on authenticated client');
  } else {
    console.warn('[setAuthenticatedClientJWT] No JWT token provided');
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

    // If no global JWT, try to create one
    try {
      const jwtResponse = await account.createJWT();
      if (jwtResponse?.jwt) {
        (global as any).__APPWRITE_JWT__ = jwtResponse.jwt;
        setAuthenticatedClientJWT(jwtResponse.jwt);
        console.log('[ensureAuthenticatedClient] New JWT created and set');
        return true;
      }
    } catch (jwtError) {
      console.error('[ensureAuthenticatedClient] Failed to create JWT:', jwtError);
    }

    console.error('[ensureAuthenticatedClient] No valid JWT available');
    return false;
  } catch (error) {
    console.error('[ensureAuthenticatedClient] Error ensuring authenticated client:', error);
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
    const newAccount = await account.create(ID.unique(), email, password, name);

    if (!newAccount) {
      throw new Error("Failed to create account");
    }

    const avatarUrl = avatars.getInitialsURL(name);

    return await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      {
        accountId: newAccount.$id,
        name,
        email,
        phoneNumber, // Include phone number in the document
        avatar: avatarUrl,
      }
    );
  } catch (error) {
    console.error("Create user error:", error);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const session = await account.createEmailPasswordSession(email, password);
    return session;
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await account.deleteSession("current");
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    // get the current account
    const currentAccount = await account.get();

    if (!currentAccount) {
      throw new Error("No user found");
    }

    // get the user from the database
    const currentUser = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal("accountId", currentAccount.$id)]
    );

    if (!currentUser) throw Error;

    // return the user
    return currentUser.documents[0];
  } catch (error) {
    console.error("Get current user error:", error);
    throw new Error(error as string);
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
  const { cardsCollectionId, databaseId } = appwriteConfig;
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
      cardHolderName: input.cardHolderName,
      expiryDate: input.expiryDate,
      title: input.title || (input.status === "added" ? "Card added" : "Card removed"),
      description: input.description,
      accountId: input.accountId,
      category: "card",
      timestamp: new Date().toISOString(),
    };

    return await databases.createDocument(databaseId, cardsCollectionId, ID.unique(), payload);
  } catch (error) {
    console.error("logCardEvent error:", error);
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
  const { storageBucketId } = appwriteConfig;
  
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
    console.error("Upload profile picture error:", error);
    throw error;
  }
};

/**
 * Deletes a profile picture from Appwrite Storage
 * @param fileId - File ID to delete
 */
export const deleteProfilePicture = async (fileId: string) => {
  const { storageBucketId } = appwriteConfig;
  
  if (!storageBucketId) {
    throw new Error("Storage bucket ID not configured");
  }

  try {
    await storage.deleteFile(storageBucketId, fileId);
  } catch (error) {
    console.error("Delete profile picture error:", error);
    // Don't throw error here as the file might already be deleted
  }
};

/**
 * Gets the public URL for a profile picture
 * @param fileId - File ID to get URL for
 * @returns Public URL of the file
 */
export const getProfilePictureUrl = (fileId: string): string => {
  const { storageBucketId } = appwriteConfig;
  
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
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId,
      updateData
    );

    return updatedUser;
  } catch (error) {
    console.error("Update user profile error:", error);
    throw error;
  }
};
