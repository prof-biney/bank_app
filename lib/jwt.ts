import { account } from './appwrite';

declare const global: any;

export async function ensureAppwriteJWT(getJwt: (() => Promise<string>) | null) {
  try {
    if (global.__APPWRITE_JWT__) return global.__APPWRITE_JWT__ as string;
    if (!getJwt) return undefined;
    const token = await getJwt();
    global.__APPWRITE_JWT__ = token;
    return token;
  } catch {
    return undefined;
  }
}

export async function refreshAppwriteJWT(): Promise<string | undefined> {
  try {
    const jwt = await account.createJWT();
    const token = jwt?.jwt;
    if (token) {
      global.__APPWRITE_JWT__ = token;
      return token;
    }
    return undefined;
  } catch (e) {
    console.error('Failed to refresh Appwrite JWT:', e);
    global.__APPWRITE_JWT__ = undefined;
    return undefined;
  }
}

export async function getValidJWT(): Promise<string | undefined> {
  try {
    // First try to use existing token
    let token = global.__APPWRITE_JWT__;
    if (token) return token;
    
    // If no token exists, try to refresh it
    token = await refreshAppwriteJWT();
    return token;
  } catch (e) {
    console.error('Failed to get valid JWT:', e);
    return undefined;
  }
}

