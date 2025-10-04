import { logger } from '@/lib/logger';
import * as SecureStore from 'expo-secure-store';
import { authService } from './appwrite/auth';

declare const global: any;

// Storage keys for JWT management
const JWT_STORAGE_KEY = 'bankapp_jwt_token';
const JWT_EXPIRY_KEY = 'bankapp_jwt_expiry';
const JWT_REFRESH_TIME_KEY = 'bankapp_jwt_refresh_time';

// JWT token refresh configuration
const JWT_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

/**
 * Enhanced JWT Session Manager
 * Handles JWT token lifecycle with secure storage, auto-refresh, and proper error handling
 */
export class JWTSessionManager {
  private static instance: JWTSessionManager;
  private refreshPromise: Promise<string | null> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize the manager
    this.initializeSession();
  }

  public static getInstance(): JWTSessionManager {
    if (!JWTSessionManager.instance) {
      JWTSessionManager.instance = new JWTSessionManager();
    }
    return JWTSessionManager.instance;
  }

  /**
   * Initialize session from stored JWT token
   */
  private async initializeSession(): Promise<void> {
    try {
      const storedToken = await this.getStoredToken();
      if (storedToken && await this.isTokenValid(storedToken)) {
        global.__APPWRITE_JWT__ = storedToken;
        this.scheduleTokenRefresh(storedToken);
        logger.info('JWT_SESSION', 'Session initialized from stored token');
      } else {
        await this.clearStoredToken();
        logger.info('JWT_SESSION', 'No valid stored token found');
      }
    } catch (error) {
      logger.error('JWT_SESSION', 'Failed to initialize session:', error);
      await this.clearStoredToken();
    }
  }

  /**
   * Create and store a new JWT token after successful authentication
   */
  public async createAndStoreToken(): Promise<string | null> {
    try {
      logger.info('JWT_SESSION', 'Creating new JWT token');
      
      // Check if we already have a refresh in progress
      if (this.refreshPromise) {
        logger.info('JWT_SESSION', 'Token creation already in progress, waiting...');
        return await this.refreshPromise;
      }

      this.refreshPromise = this.performTokenCreation();
      const token = await this.refreshPromise;
      this.refreshPromise = null;

      return token;
    } catch (error) {
      this.refreshPromise = null;
      logger.error('JWT_SESSION', 'Failed to create and store token:', error);
      return null;
    }
  }

  /**
   * Perform the actual token creation with retry logic
   */
  private async performTokenCreation(): Promise<string | null> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // Verify we have an active session first
        const session = await authService.getCurrentSession();
        if (!session) {
          logger.warn('JWT_SESSION', 'No active Appwrite session found');
          return null;
        }

        // Create JWT token
        const result = await authService.createJWT();
        if (result?.jwt) {
          // Store token securely
          await this.storeTokenSecurely(result.jwt);
          
          // Set in global for immediate use
          global.__APPWRITE_JWT__ = result.jwt;
          
          // Schedule automatic refresh
          this.scheduleTokenRefresh(result.jwt);
          
          logger.info('JWT_SESSION', `JWT token created and stored successfully on attempt ${attempt}`);
          return result.jwt;
        } else {
          throw new Error('JWT creation returned no token');
        }
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on authentication/scope errors
        if (this.isNonRetryableError(error)) {
          logger.error('JWT_SESSION', 'Non-retryable error, stopping attempts:', error.message);
          break;
        }

        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          logger.warn('JWT_SESSION', `Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('JWT_SESSION', 'All token creation attempts failed:', lastError?.message);
    return null;
  }

  /**
   * Get current valid JWT token with auto-refresh
   */
  public async getValidToken(): Promise<string | null> {
    try {
      const currentToken = global.__APPWRITE_JWT__;
      
      // Check if current token is valid
      if (currentToken && await this.isTokenValid(currentToken)) {
        return currentToken;
      }

      // Token is missing or expired, refresh it
      logger.info('JWT_SESSION', 'Token missing or expired, refreshing...');
      return await this.createAndStoreToken();
    } catch (error) {
      logger.error('JWT_SESSION', 'Failed to get valid token:', error);
      return null;
    }
  }

  /**
   * Check if token is valid and not expired
   */
  private async isTokenValid(token: string): Promise<boolean> {
    if (!token) return false;

    try {
      // Parse JWT payload
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      const expiration = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();

      // Check if token expires within the buffer time
      return (expiration - now) > JWT_REFRESH_BUFFER;
    } catch (error) {
      logger.warn('JWT_SESSION', 'Failed to validate token:', error);
      return false;
    }
  }

  /**
   * Store JWT token securely with expiration info
   */
  private async storeTokenSecurely(token: string): Promise<void> {
    try {
      // Parse token to get expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiration = payload.exp * 1000;

      // Store token and metadata
      await Promise.all([
        SecureStore.setItemAsync(JWT_STORAGE_KEY, token),
        SecureStore.setItemAsync(JWT_EXPIRY_KEY, expiration.toString()),
        SecureStore.setItemAsync(JWT_REFRESH_TIME_KEY, Date.now().toString())
      ]);

      logger.info('JWT_SESSION', 'Token stored securely');
    } catch (error) {
      logger.error('JWT_SESSION', 'Failed to store token securely:', error);
      throw error;
    }
  }

  /**
   * Get stored JWT token from secure storage
   */
  private async getStoredToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(JWT_STORAGE_KEY);
    } catch (error) {
      logger.error('JWT_SESSION', 'Failed to get stored token:', error);
      return null;
    }
  }

  /**
   * Clear stored JWT token and related data
   */
  public async clearStoredToken(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(JWT_STORAGE_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(JWT_EXPIRY_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(JWT_REFRESH_TIME_KEY).catch(() => {})
      ]);

      // Clear global token
      global.__APPWRITE_JWT__ = undefined;

      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }

      logger.info('JWT_SESSION', 'Stored token cleared');
    } catch (error) {
      logger.error('JWT_SESSION', 'Failed to clear stored token:', error);
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(token: string): void {
    try {
      // Clear existing timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }

      // Parse token to get expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiration = payload.exp * 1000;
      const now = Date.now();
      
      // Calculate refresh time (5 minutes before expiry)
      const refreshTime = expiration - now - JWT_REFRESH_BUFFER;
      
      if (refreshTime > 0) {
        this.refreshTimer = setTimeout(() => {
          logger.info('JWT_SESSION', 'Auto-refreshing token');
          this.createAndStoreToken().catch(error => {
            logger.error('JWT_SESSION', 'Auto-refresh failed:', error);
          });
        }, refreshTime);

        logger.info('JWT_SESSION', `Token refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`);
      } else {
        logger.warn('JWT_SESSION', 'Token expires too soon, immediate refresh needed');
        // Schedule immediate refresh
        setTimeout(() => this.createAndStoreToken(), 0);
      }
    } catch (error) {
      logger.error('JWT_SESSION', 'Failed to schedule token refresh:', error);
    }
  }

  /**
   * Check if error is non-retryable (authentication/permission errors)
   */
  private isNonRetryableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('missing scope') ||
           message.includes('guests') ||
           message.includes('invalid credentials') ||
           message.includes('unauthorized') ||
           message.includes('forbidden');
  }

  /**
   * Get JWT token for API requests with automatic refresh
   */
  public async getAuthHeader(): Promise<{ Authorization: string } | null> {
    const token = await this.getValidToken();
    if (!token) {
      logger.warn('JWT_SESSION', 'No valid token available for auth header');
      return null;
    }
    
    return {
      Authorization: `Bearer ${token}`
    };
  }

  /**
   * Clear all session data (for logout)
   */
  public async clearSession(): Promise<void> {
    try {
      await this.clearStoredToken();
      
      // Clear refresh promise
      this.refreshPromise = null;
      
      logger.info('JWT_SESSION', 'Session cleared completely');
    } catch (error) {
      logger.error('JWT_SESSION', 'Failed to clear session:', error);
    }
  }
}

// Export singleton instance
export const jwtSessionManager = JWTSessionManager.getInstance();

// Convenience functions for backward compatibility
export const getValidJWT = () => jwtSessionManager.getValidToken();
export const clearJWTSession = () => jwtSessionManager.clearSession();
export const refreshJWT = () => jwtSessionManager.createAndStoreToken();