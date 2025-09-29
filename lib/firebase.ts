import { initializeApp, getApps } from 'firebase/app';
import { 
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getDatabase, ref as dbRef, set as setDb, get as getDb, push as pushDb, child as childDb } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const env = (keys: string[], def?: string) => {
  for (const k of keys) {
    const v = (process.env as any)?.[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return def;
};

const firebaseConfig = {
  apiKey: env(['EXPO_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_API_KEY']),
  authDomain: env(['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN']),
  projectId: env(['EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID']),
  databaseURL: env(['EXPO_PUBLIC_FIREBASE_DATABASE_URL', 'FIREBASE_DATABASE_URL']),
  messagingSenderId: env(['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID']),
  appId: env(['EXPO_PUBLIC_FIREBASE_APP_ID', 'FIREBASE_APP_ID'])
};

let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig as any);
    logger.info('CONFIG', 'Firebase initialized');
  } catch (err) {
    logger.warn('CONFIG', 'Firebase init may have failed or already initialized', err);
  }
}

// Initialize auth with AsyncStorage persistence
export const auth = initializeAuth(app!, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const firestore = getFirestore();
export const database = getDatabase();

export const ID = {
  unique: () => {
    // Simple unique id similar to Appwrite's ID.unique()
    return 'fid_' + Math.random().toString(36).slice(2, 9);
  }
};

export const Query = {
  equal: (field: string, value: any) => ({ field, op: '==', value })
};

// Profile picture functions using Realtime Database
export const uploadImage = async (blob: Blob, userId: string, id?: string): Promise<{ id: string; url: string }> => {
  try {
    // Use provided id or generate a new one
    id = id || ID.unique();

    // Convert blob to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Store in Realtime Database
    const imageRef = dbRef(database, `userImages/${userId}/${id}`);
    await setDb(imageRef, {
      data: base64,
      timestamp: Date.now()
    });

    // Return a URL-like string that can be used to retrieve the image
    const url = `rtdb://${userId}/${id}`;
    return { id, url };
  } catch (error) {
    logger.error('DATABASE', 'Failed to upload image', error);
    throw error;
  }
};

export const getImage = async (userId: string, imageId: string): Promise<string | null> => {
  try {
    const imageRef = dbRef(database, `userImages/${userId}/${imageId}`);
    const snapshot = await getDb(imageRef);
    
    if (snapshot.exists()) {
      return snapshot.val().data;
    }
    return null;
  } catch (error) {
    logger.error('DATABASE', 'Failed to get image', error);
    return null;
  }
};

export const deleteImage = async (userId: string, imageId: string): Promise<void> => {
  try {
    const imageRef = dbRef(database, `userImages/${userId}/${imageId}`);
    await setDb(imageRef, null);
  } catch (error) {
    logger.error('DATABASE', 'Failed to delete image', error);
    throw error;
  }
};

export const createUser = async (emailOrParams: string | { email: string; password: string; name?: string }, password?: string) => {
  try {
    // Accept either createUser(email, password) or createUser({ email, password, name })
    const isStringParams = typeof emailOrParams === 'string';
    const email = isStringParams ? emailOrParams : emailOrParams.email;
    const pass = isStringParams ? password! : emailOrParams.password;
    const name = !isStringParams ? emailOrParams.name : undefined;

    // First check if user already exists
    try {
      const q = query(collection(firestore, 'users'), where('email', '==', email));
      const existingUser = await getDocs(q);
      if (!existingUser.empty) {
        throw new Error('User with this email already exists');
      }
    } catch (err) {
      logger.error('AUTH', 'Failed to check existing user', err);
      throw new Error('Failed to check if user exists');
    }

    // Create Firebase auth user
    const userCred = await createUserWithEmailAndPassword(auth, email, pass);

    // Create user profile in Firestore
    try {
      await setDoc(doc(firestore, 'users', userCred.user.uid), {
        email,
        name: name || null,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      // If profile creation fails, delete the auth user to maintain consistency
      await userCred.user.delete();
      logger.error('AUTH', 'Failed to create user profile, rolling back', err);
      throw new Error('Failed to create user profile');
    }

    // Return Appwrite-like user object
    return { $id: userCred.user.uid, email: userCred.user.email } as any;
  } catch (err: any) {
    logger.error('AUTH', 'User creation failed', err);
    throw err.message ? err : new Error('Failed to create user account');
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    // First check if user exists in Firestore
    const q = query(collection(firestore, 'users'), where('email', '==', email));
    const userDocs = await getDocs(q);
    
    if (userDocs.empty) {
      logger.warn('AUTH', 'User not found in database', { email });
      throw new Error('User not found. Please check your email or sign up for a new account.');
    }

    // Attempt sign in
    const s = await signInWithEmailAndPassword(auth, email, password);
    
    // Double check the user doc exists
    const userDoc = await getDoc(doc(firestore, 'users', s.user.uid));
    if (!userDoc.exists()) {
      // This should never happen since we checked by email, but just in case
      await firebaseSignOut(auth);
      throw new Error('User profile not found. Please contact support.');
    }

    return s.user;
  } catch (err: any) {
    logger.error('AUTH', 'Sign in failed', err);
    throw err.message ? err : new Error('Sign in failed. Please check your credentials.');
  }
};

export const signOut = async () => {
  await firebaseSignOut(auth);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const onAuthChange = (cb: (u: FirebaseUser | null) => void) => onAuthStateChanged(auth, cb);

export const safeGetDocument = async (collectionId: string, documentId: string) => {
  try {
    const dref = doc(firestore, collectionId, documentId);
    const snap = await getDoc(dref);
    if (snap.exists()) return { ...snap.data(), $id: snap.id };
  } catch (err) {
    logger.warn('DATABASE', 'safeGetDocument failed primary getDoc:', err);
  }

  // Fallback: query by $id field (Firestore always supports getDoc so this is unlikely)
  try {
    const q = query(collection(firestore, collectionId), where('__name__', '==', documentId));
    const snaps = await getDocs(q);
    if (!snaps.empty) {
      const first = snaps.docs[0];
      return { ...first.data(), $id: first.id };
    }
  } catch (err) {
    logger.error('DATABASE', 'safeGetDocument fallback failed', err);
  }

  throw new Error('Document not found');
};

// Compatibility helpers expected by existing call-sites (Appwrite-like)
export const fetchUser = (userId: string) => safeGetDocument('users', userId);

export const setAuthenticatedClientJWT = async (_jwt: string | null) => {
  // No-op for Firebase client. Server-side code should handle JWTs separately.
};

export const account = {
  create: async (id: string, email: string, password: string, name?: string) => {
    const created = await createUser({ email, password, name });
    return created as any;
  },
  createEmailPasswordSession: async (email: string, password: string) => {
    return await signIn(email, password);
  },
  createJWT: async () => {
    const u = getCurrentUser();
    if (!u) throw new Error('No authenticated user');
    const token = await u.getIdToken();
    return { jwt: token } as any;
  },
  get: async () => {
    const u = getCurrentUser();
    if (!u) throw new Error('No authenticated user');
    return { $id: u.uid, email: u.email } as any;
  },
  deleteSession: async () => signOut(),
  getSession: async (key?: string) => {
    // Firebase doesn't have session objects; return a minimal session-like object
    const u = getCurrentUser();
    if (!u) return null;
    return { $id: u.uid, userId: u.uid, provider: u.providerId } as any;
  },
  raw: auth
};

// Appwrite-like databases helper to ease migration: provides create/update/delete/list semantics
export const databases = {
  createDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    // Firestore doesn't use databaseId; we map collectionId to collection name
    const cref = doc(collection(firestore, collectionId), documentId);
    await setDoc(cref, data as any);
    return { $id: documentId, ...data };
  },

  updateDocument: async (databaseId: string, collectionId: string, documentId: string, data: any) => {
    const dref = doc(firestore, collectionId, documentId);
    await updateDoc(dref, data as any);
    const snap = await getDoc(dref);
    return { $id: snap.id, ...(snap.exists() ? snap.data() : {}) };
  },

  deleteDocument: async (databaseId: string, collectionId: string, documentId: string) => {
    const dref = doc(firestore, collectionId, documentId);
    await deleteDoc(dref);
    return { success: true };
  },

  listDocuments: async (databaseId: string, collectionId: string, queries: any[] = []) => {
    // Build a basic Firestore query from the provided Appwrite-like queries
    let colRef = collection(firestore, collectionId) as any;
    const whereClauses: any[] = [];
    for (const q of queries) {
      if (!q || !q.op) continue;
      if (q.op === '==') {
        whereClauses.push(where(q.field, '==', q.value));
      }
      // Note: ordering, offset, and limit are not fully implemented here; simple support only
    }

    const finalQuery = whereClauses.length ? query(colRef, ...whereClauses) : query(colRef);
    const snaps = await getDocs(finalQuery);
    const docs = snaps.docs.map(d => ({ $id: d.id, ...(d.data() as any) }));
    return { documents: docs, total: docs.length };
  }
};

export const uploadProfilePicture = async (localUri: string, userId: string) => {
  try {
    // Convert localUri to blob
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    
    // Upload to Realtime Database
    const { id, url } = await uploadImage(blob, userId);
    return { fileId: id, fileUrl: url };
  } catch (err) {
    logger.error('DATABASE', 'uploadProfilePicture failed', err);
    throw err;
  }
};

export const deleteProfilePicture = async (fileId?: string, userId?: string) => {
  if (!fileId || !userId) return;
  try {
    await deleteImage(userId, fileId);
  } catch (err) {
    logger.warn('DATABASE', 'deleteProfilePicture failed', err);
  }
};

export const updateUserProfile = async (collectionId: string, userId: string, data: any) => {
  const dref = doc(firestore, collectionId, userId);
  await updateDoc(dref, data as any);
};

export const logCardEvent = async (collectionId: string | undefined, event: any) => {
  try {
    if (!collectionId) return;
    const cref = doc(collection(firestore, collectionId));
    await setDoc(cref, { ...event, createdAt: new Date().toISOString() } as any);
  } catch (err) {
    logger.warn('ACTIVITY', 'logCardEvent failed', err);
  }
};

export const ensureAuthenticatedClient = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    // Force refresh token
    await user.getIdToken(true);
    return true;
  } catch (err) {
    logger.auth.warn('[ensureAuthenticatedClient] Token refresh failed', err);
    return false;
  }
};

// Minimal compatibility config object to replace appwriteConfig usage in codebase
export const appwriteConfig: any = {
  databaseId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  cardsCollectionId: process.env.EXPO_PUBLIC_CARDS_COLLECTION_ID || 'cards',
  transactionsCollectionId: process.env.EXPO_PUBLIC_TRANSACTIONS_COLLECTION_ID || 'transactions',
  accountUpdatesCollectionId: process.env.EXPO_PUBLIC_ACCOUNT_UPDATES_COLLECTION_ID || 'account_updates',
  notificationsCollectionId: process.env.EXPO_PUBLIC_NOTIFICATIONS_COLLECTION_ID || 'notifications'
};

export default {
  auth,
  firestore,
  ID,
  Query,
  createUser,
  signIn,
  signOut,
  getCurrentUser,
  onAuthChange,
  safeGetDocument,
  fetchUser,
  account,
  uploadProfilePicture,
  deleteProfilePicture,
  updateUserProfile,
  logCardEvent
};
