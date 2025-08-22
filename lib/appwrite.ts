import {
  Account,
  Avatars,
  Client,
  Databases,
  ID,
  Query,
} from "react-native-appwrite";

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

// Appwrite configuration with fallbacks (EXPO_PUBLIC_* first, then APPWRITE_*)
export const appwriteConfig = {
  endpoint: env(["EXPO_PUBLIC_APPWRITE_ENDPOINT", "APPWRITE_ENDPOINT"], "https://cloud.appwrite.io/v1"),
  platform: env(["EXPO_PUBLIC_APPWRITE_PLATFORM", "APPWRITE_PLATFORM"], "com.profbiney.vault"),
  projectId: env(["EXPO_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_PROJECT_ID"], "your_project_id"),
  databaseId: env(["EXPO_PUBLIC_APPWRITE_DATABASE_ID", "APPWRITE_DATABASE_ID"], "688951e80021396d424f"),
  userCollectionId: env(["EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID", "APPWRITE_USER_COLLECTION_ID"], "688a76c0003178d28a3e"),
  // Optional collections for realtime activity
  transactionsCollectionId: env(["EXPO_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID", "APPWRITE_TRANSACTIONS_COLLECTION_ID"]),
  cardsCollectionId: env(["EXPO_PUBLIC_APPWRITE_CARDS_COLLECTION_ID", "APPWRITE_CARDS_COLLECTION_ID"]),
  accountUpdatesCollectionId: env(["EXPO_PUBLIC_APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID", "APPWRITE_ACCOUNT_UPDATES_COLLECTION_ID"]),
  notificationsCollectionId: env(["EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID", "APPWRITE_NOTIFICATIONS_COLLECTION_ID"]),
};

export const client = new Client();

client
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId)
  .setPlatform(appwriteConfig.platform);

export const account = new Account(client);

export const databases = new Databases(client);

const avatars = new Avatars(client);

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
