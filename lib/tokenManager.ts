import { logger } from '@/lib/logger';
/**
 * Token Manager Module
 * 
 * Handles JWT token management, cleanup, and expiration for the authentication system.
 * This module provides utilities for token lifecycle management and secure cleanup.
 */

import { authService } from './appwrite/auth';

/**
 * Expires the global JWT token by clearing it from memory
 */
export const expireToken = (): void => {
  try {
    if (__DEV__) {
      logger.info('JWT', '[TokenManager] Expiring global JWT token');
    }
    
    // Clear the global JWT token
    (global as any).__APPWRITE_JWT__ = undefined;
    
    if (__DEV__) {
      logger.info('JWT', '[TokenManager] Global JWT token expired successfully');
    }
  } catch (error) {
  logger.error('JWT', '[TokenManager] Error expiring token:', error);
  }
};

/**
 * Clears all token-related data from memory and storage
 */
export const clearTokenData = (): void => {
  try {
    if (__DEV__) {
      logger.info('JWT', '[TokenManager] Clearing all token data');
    }
    
    // Clear global JWT
    (global as any).__APPWRITE_JWT__ = undefined;
    
    // Clear any other token-related data that might be stored
    // This is a placeholder for future token storage mechanisms
    
    if (__DEV__) {
      logger.info('JWT', '[TokenManager] All token data cleared successfully');
    }
  } catch (error) {
  logger.error('JWT', '[TokenManager] Error clearing token data:', error);
  }
};

/**
 * Performs complete cleanup including token expiration, session deletion, and data clearing
 */
export const performCompleteCleanup = async (): Promise<void> => {
  try {
    if (__DEV__) {
      logger.info('JWT', '[TokenManager] Starting complete cleanup process');
    }
    
    // Step 1: Expire tokens first
    expireToken();
    
    // Step 2: Sign out the current Appwrite session (if any)
    try {
      await authService.logout();
      if (__DEV__) {
        logger.info('JWT', '[TokenManager] Appwrite session signed out successfully');
      }
    } catch (sessionError: any) {
      if (__DEV__) {
        logger.info('JWT', '[TokenManager] Session sign-out failed (session may already be invalid):', sessionError.message);
      }
    }
    
    // Step 3: Clear all token data
    clearTokenData();
    
      if (__DEV__) {
      logger.info('JWT', '[TokenManager] Complete cleanup finished successfully');
    }
  } catch (error) {
  logger.error('JWT', '[TokenManager] Error during complete cleanup:', error);
    
    // Even if cleanup fails, ensure tokens are cleared
    try {
      expireToken();
      clearTokenData();
    } catch (fallbackError) {
  logger.error('JWT', '[TokenManager] Fallback cleanup also failed:', fallbackError);
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
  logger.error('JWT', '[TokenManager] Error checking token validity:', error);
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
  logger.error('JWT', '[TokenManager] Error getting current token:', error);
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
      logger.info('JWT', '[TokenManager] Setting new JWT token:', token ? 'Token provided' : 'Token cleared');
    }
    
    (global as any).__APPWRITE_JWT__ = token;
    
    if (__DEV__) {
      logger.info('JWT', '[TokenManager] JWT token updated successfully');
    }
  } catch (error) {
  logger.error('JWT', '[TokenManager] Error setting token:', error);
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
      logger.info('JWT', '[TokenManager] Emergency cleanup completed');
    }
  } catch (error) {
    // Silent failure for emergency cleanup
  logger.error('JWT', '[TokenManager] Emergency cleanup failed:', error);
  }
};
