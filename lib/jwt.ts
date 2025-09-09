import { account } from './appwrite';
import { logger } from '@/utils/logger';

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
    // First, ensure we have an active session
    const session = await account.getSession('current');
    if (!session) {
      logger.warn('JWT', 'No active session found');
      global.__APPWRITE_JWT__ = undefined;
      return undefined;
    }
    
    // Create JWT with proper error handling for scope issues
    const jwt = await account.createJWT();
    const token = jwt?.jwt;
    if (token) {
      global.__APPWRITE_JWT__ = token;
      logger.info('JWT', 'JWT created successfully');
      return token;
    }
    
    logger.warn('JWT', 'JWT creation returned no token');
    return undefined;
  } catch (e: any) {
    logger.error('JWT', 'Failed to refresh Appwrite JWT', e);
    
    // Handle specific error cases
    if (e.message?.includes('missing scope')) {
      logger.error('JWT', 'Missing scope error - user may need to re-authenticate');
    } else if (e.message?.includes('guests')) {
      logger.error('JWT', 'User has guest role - authentication issue');
    }
    
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
    logger.error('JWT', 'Failed to get valid JWT', e);
    return undefined;
  }
}

/**
 * Enhanced JWT refresh with retry logic and exponential backoff
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise resolving to JWT token or undefined
 */
export async function refreshAppwriteJWTWithRetry(maxRetries = 3): Promise<string | undefined> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const token = await refreshAppwriteJWT();
      if (token) {
        logger.info('JWT', `JWT refreshed successfully on attempt ${attempt + 1}`);
        return token;
      }
    } catch (error: any) {
      attempt++;
      
      // Don't retry on authentication/scope errors - these require re-authentication
      if (error.message?.includes('missing scope') || error.message?.includes('guests') || error.message?.includes('Invalid credentials')) {
        logger.error('JWT', 'Authentication error - no retry', { message: error.message });
        break;
      }
      
      if (attempt >= maxRetries) {
        logger.error('JWT', 'Max retries reached', { message: error.message });
        break;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      logger.warn('JWT', `Attempt ${attempt} failed, retrying in ${delay}ms`, { message: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  global.__APPWRITE_JWT__ = undefined;
  return undefined;
}

/**
 * Check if the current JWT is valid and not expired
 * @returns Promise resolving to boolean indicating JWT validity
 */
export async function isJWTValid(): Promise<boolean> {
  const token = global.__APPWRITE_JWT__;
  if (!token) return false;
  
  try {
    // Try to decode JWT to check expiration
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiration = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    
    // Add 5-minute buffer to refresh before actual expiration
    const bufferTime = 5 * 60 * 1000;
    
    return (expiration - now) > bufferTime;
  } catch (error) {
    logger.warn('JWT', 'Failed to decode JWT', error);
    return false;
  }
}

/**
 * Get valid JWT with automatic refresh if needed
 * @returns Promise resolving to JWT token or undefined
 */
export async function getValidJWTWithAutoRefresh(): Promise<string | undefined> {
  try {
    // Check if current token is still valid
    const currentToken = global.__APPWRITE_JWT__;
    if (currentToken && await isJWTValid()) {
      return currentToken;
    }
    
    // Token is missing or expired, try to refresh
    logger.info('JWT', 'Token expired or missing, refreshing...');
    const newToken = await refreshAppwriteJWTWithRetry();
    
    return newToken;
  } catch (error) {
    logger.error('JWT', 'Failed to get valid JWT', error);
    return undefined;
  }
}

