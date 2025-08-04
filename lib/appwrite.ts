import {
  Account,
  Avatars,
  Client,
  Databases,
  ID,
  Query,
} from "react-native-appwrite";

// Check for required environment variables
const requiredEnvVars = [
  "EXPO_PUBLIC_APPWRITE_ENDPOINT",
  "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
  "EXPO_PUBLIC_APPWRITE_PLATFORM",
  "EXPO_PUBLIC_APPWRITE_DATABASE_ID",
  "EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID",
];

// Log warnings for missing environment variables
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.warn(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  console.warn(
    "Please check your .env file and make sure all required variables are defined."
  );
}

// Appwrite configuration with fallbacks for development
export const appwriteConfig = {
  endpoint:
    process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  platform: process.env.EXPO_PUBLIC_APPWRITE_PLATFORM || "com.profbiney.vault",
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "your_project_id",
  databaseId:
    process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || "688951e80021396d424f",
  userCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_USER_COLLECTION_ID ||
    "688a76c0003178d28a3e",
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
