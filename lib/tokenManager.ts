/**
 * Token Manager Module
 * 
 * Handles JWT token management, cleanup, and expiration for the authentication system.
 * This module provides utilities for token lifecycle management and secure cleanup.
 */

import { account } from './appwrite';

/**
 * Expires the global JWT token by clearing it from memory
 */
export const expireToken = (): void => {
  try {
    if (__DEV__) {
      console.log('[TokenManager] Expiring global JWT token');
    }
    
    // Clear the global JWT token
    (global as any).__APPWRITE_JWT__ = undefined;
    
    if (__DEV__) {
      console.log('[TokenManager] Global JWT token expired successfully');
    }
  } catch (error) {
    console.error('[TokenManager] Error expiring token:', error);
  }
};

/**
 * Clears all token-related data from memory and storage
 */
export const clearTokenData = (): void => {
  try {
    if (__DEV__) {
      console.log('[TokenManager] Clearing all token data');
    }
    
    // Clear global JWT
    (global as any).__APPWRITE_JWT__ = undefined;
    
    // Clear any other token-related data that might be stored
    // This is a placeholder for future token storage mechanisms
    
    if (__DEV__) {
      console.log('[TokenManager] All token data cleared successfully');
    }
  } catch (error) {
    console.error('[TokenManager] Error clearing token data:', error);
  }
};

/**
 * Performs complete cleanup including token expiration, session deletion, and data clearing
 */
export const performCompleteCleanup = async (): Promise<void> => {
  try {
    if (__DEV__) {
      console.log('[TokenManager] Starting complete cleanup process');
    }
    
    // Step 1: Expire tokens first
    expireToken();
    
    // Step 2: Delete the current session from Appwrite
    try {
      await account.deleteSession('current');
      if (__DEV__) {
        console.log('[TokenManager] Appwrite session deleted successfully');
      }
    } catch (sessionError: any) {
      // It's okay if session deletion fails (session might already be expired)
      if (__DEV__) {
        console.log('[TokenManager] Session deletion failed (session may already be invalid):', sessionError.message);
      }
    }
    
    // Step 3: Clear all token data
    clearTokenData();
    
    if (__DEV__) {
      console.log('[TokenManager] Complete cleanup finished successfully');
    }
  } catch (error) {
    console.error('[TokenManager] Error during complete cleanup:', error);
    
    // Even if cleanup fails, ensure tokens are cleared
    try {
      expireToken();
      clearTokenData();
    } catch (fallbackError) {
      console.error('[TokenManager] Fallback cleanup also failed:', fallbackError);
    }
    
    throw error;
  }
};

/**
 * Checks if a JWT token is currently available
 * @returns true if a JWT token exists, false otherwise
 */
export const hasValidToken = (): boolean => {
  try {
    const jwt = (global as any).__APPWRITE_JWT__;
    return typeof jwt === 'string' && jwt.length > 0;
  } catch (error) {
    console.error('[TokenManager] Error checking token validity:', error);
    return false;
  }
};

/**
 * Gets the current JWT token if available
 * @returns JWT token string or null if not available
 */
export const getCurrentToken = (): string | null => {
  try {
    const jwt = (global as any).__APPWRITE_JWT__;
    return typeof jwt === 'string' && jwt.length > 0 ? jwt : null;
  } catch (error) {
    console.error('[TokenManager] Error getting current token:', error);
    return null;
  }
};

/**
 * Sets a new JWT token
 * @param token - The JWT token to set
 */
export const setToken = (token: string | null): void => {
  try {
    if (__DEV__) {
      console.log('[TokenManager] Setting new JWT token:', token ? 'Token provided' : 'Token cleared');
    }
    
    (global as any).__APPWRITE_JWT__ = token;
    
    if (__DEV__) {
      console.log('[TokenManager] JWT token updated successfully');
    }
  } catch (error) {
    console.error('[TokenManager] Error setting token:', error);
  }
};

/**
 * Emergency cleanup that doesn't throw errors
 * Used as a fallback when other cleanup methods fail
 */
export const emergencyCleanup = (): void => {
  try {
    expireToken();
    clearTokenData();
    if (__DEV__) {
      console.log('[TokenManager] Emergency cleanup completed');
    }
  } catch (error) {
    // Silent failure for emergency cleanup
    console.error('[TokenManager] Emergency cleanup failed:', error);
  }
};
