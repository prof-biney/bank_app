// Minimal compatibility shim for appwrite surface (moved from lib/appwrite.ts)
// Re-export a small surface from ./firebase to avoid declaring Appwrite SDK types
import * as fb from './firebase';

export const ID = (fb as any).ID;
export const Query = (fb as any).Query;
export const databases = (fb as any).databases;
export const safeGetDocument = (fb as any).safeGetDocument;
export const logCardEvent = (fb as any).logCardEvent;
export const ensureAuthenticatedClient = (fb as any).ensureAuthenticatedClient;
export const uploadProfilePicture = (fb as any).uploadProfilePicture;
export const deleteProfilePicture = (fb as any).deleteProfilePicture;
export const appwriteConfig = (fb as any).appwriteConfig || {};

export default {
  ID,
  Query,
  databases,
  safeGetDocument,
  logCardEvent,
  ensureAuthenticatedClient,
  uploadProfilePicture,
  deleteProfilePicture,
  appwriteConfig
};

