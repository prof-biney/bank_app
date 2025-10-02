/**
 * Login Attempts Tracking Service
 * 
 * Handles login attempt tracking, account lockouts, and security measures.
 * Features:
 * - Track failed login attempts per email
 * - Implement 5-minute lockout after 4 failed attempts
 * - Persistent storage of attempt data
 * - Automatic cleanup of expired lockouts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const STORAGE_KEY = 'login_attempts';
const LAST_EMAIL_KEY = 'last_attempted_email';
const MAX_ATTEMPTS = 4;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export interface LoginAttemptData {
  email: string;
  attempts: number;
  lastAttemptTime: number;
  lockoutUntil?: number;
}

export interface LoginAttemptResult {
  isLocked: boolean;
  isLockedOut: boolean; // Alias for isLocked for backward compatibility
  attempts: number;
  remainingAttempts: number;
  lockoutTimeRemaining?: number; // in milliseconds
  canAttempt: boolean;
}

class LoginAttemptsService {
  /**
   * Get stored login attempts data
   */
  private async getStoredData(): Promise<Record<string, LoginAttemptData>> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return {};
      
      const data = JSON.parse(stored);
      
      // Clean up expired lockouts
      const now = Date.now();
      const cleanedData: Record<string, LoginAttemptData> = {};
      let hasChanges = false;
      
      for (const [email, attemptData] of Object.entries(data as Record<string, LoginAttemptData>)) {
        if (attemptData.lockoutUntil && attemptData.lockoutUntil <= now) {
          // Lockout has expired, reset attempts
          logger.info('LOGIN_ATTEMPTS', `Lockout expired for ${email}, resetting attempts`, {
            email,
            previousAttempts: attemptData.attempts,
            lockoutUntil: new Date(attemptData.lockoutUntil).toISOString(),
            now: new Date(now).toISOString()
          });
          
          cleanedData[email] = {
            ...attemptData,
            attempts: 0,
            lockoutUntil: undefined,
          };
          hasChanges = true;
        } else {
          cleanedData[email] = attemptData;
        }
      }
      
      // Save cleaned data back if changes were made
      if (hasChanges) {
        await this.saveData(cleanedData);
        logger.info('LOGIN_ATTEMPTS', 'Cleaned expired lockouts from storage');
      }
      
      return cleanedData;
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error getting stored data:', error);
      return {};
    }
  }

  /**
   * Save login attempts data
   */
  private async saveData(data: Record<string, LoginAttemptData>): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error saving data:', error);
    }
  }

  /**
   * Check if an email can attempt login and return attempt status
   */
  async checkLoginAttempts(email: string): Promise<LoginAttemptResult> {
    try {
      const data = await this.getStoredData(); // This automatically cleans expired lockouts
      const normalizedEmail = email.toLowerCase().trim();
      const attemptData = data[normalizedEmail];
      
      const now = Date.now();
      
      if (!attemptData) {
        // First time attempting login
        return {
          isLocked: false,
          isLockedOut: false,
          attempts: 0,
          remainingAttempts: MAX_ATTEMPTS,
          canAttempt: true,
        };
      }
      
      // Double-check lockout expiry even if getStoredData didn't catch it
      if (attemptData.lockoutUntil && attemptData.lockoutUntil <= now) {
        // Lockout has expired, reset immediately
        logger.info('LOGIN_ATTEMPTS', `Lockout expired during check for ${normalizedEmail}, resetting now`);
        
        attemptData.attempts = 0;
        attemptData.lockoutUntil = undefined;
        data[normalizedEmail] = attemptData;
        await this.saveData(data);
        
        return {
          isLocked: false,
          isLockedOut: false,
          attempts: 0,
          remainingAttempts: MAX_ATTEMPTS,
          canAttempt: true,
        };
      }
      
      // Check if currently locked out
      if (attemptData.lockoutUntil && attemptData.lockoutUntil > now) {
        const timeRemaining = attemptData.lockoutUntil - now;
        logger.info('LOGIN_ATTEMPTS', `Account locked for ${normalizedEmail}`, {
          timeRemaining,
          attempts: attemptData.attempts,
          lockoutUntil: new Date(attemptData.lockoutUntil).toISOString(),
          currentTime: new Date(now).toISOString()
        });
        
        return {
          isLocked: true,
          remainingAttempts: 0,
          lockoutTimeRemaining: timeRemaining,
          canAttempt: false,
        };
      }
      
      // If we have attempts but no valid lockout, user can try again
      // Calculate remaining attempts (reset if lockout expired)
      const remainingAttempts = attemptData.lockoutUntil ? MAX_ATTEMPTS : Math.max(0, MAX_ATTEMPTS - attemptData.attempts);
      
      return {
        isLocked: false,
        remainingAttempts,
        canAttempt: remainingAttempts > 0,
      };
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error checking login attempts:', error);
      // On error, allow attempt (fail open for user experience)
      return {
        isLocked: false,
        remainingAttempts: MAX_ATTEMPTS,
        canAttempt: true,
      };
    }
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedAttempt(email: string): Promise<LoginAttemptResult> {
    try {
      const data = await this.getStoredData();
      const normalizedEmail = email.toLowerCase().trim();
      const now = Date.now();
      
      // Store the last attempted email for persistence across app restarts
      await this.setLastAttemptedEmail(normalizedEmail);
      
      let attemptData = data[normalizedEmail] || {
        email: normalizedEmail,
        attempts: 0,
        lastAttemptTime: now,
      };
      
      // Increment attempts
      attemptData.attempts += 1;
      attemptData.lastAttemptTime = now;
      
      // Check if we need to lock the account
      if (attemptData.attempts >= MAX_ATTEMPTS) {
        attemptData.lockoutUntil = now + LOCKOUT_DURATION;
        logger.warn('LOGIN_ATTEMPTS', `Account locked due to too many failed attempts`, {
          email: normalizedEmail,
          attempts: attemptData.attempts,
          lockoutUntil: new Date(attemptData.lockoutUntil).toISOString(),
        });
      } else {
        logger.info('LOGIN_ATTEMPTS', `Failed login attempt recorded`, {
          email: normalizedEmail,
          attempts: attemptData.attempts,
          remainingAttempts: MAX_ATTEMPTS - attemptData.attempts,
        });
      }
      
      // Update stored data
      data[normalizedEmail] = attemptData;
      await this.saveData(data);
      
      // Return current status
      return this.checkLoginAttempts(email);
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error recording failed attempt:', error);
      return {
        isLocked: false,
        remainingAttempts: MAX_ATTEMPTS - 1,
        canAttempt: true,
      };
    }
  }

  /**
   * Clear login attempts for successful login
   */
  async clearLoginAttempts(email: string): Promise<void> {
    try {
      const data = await this.getStoredData();
      const normalizedEmail = email.toLowerCase().trim();
      
      if (data[normalizedEmail]) {
        delete data[normalizedEmail];
        await this.saveData(data);
        logger.info('LOGIN_ATTEMPTS', `Login attempts cleared for successful login`, {
          email: normalizedEmail,
        });
      }
      
      // Also clear the last attempted email since login was successful
      await this.clearLastAttemptedEmail();
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error clearing login attempts:', error);
    }
  }

  /**
   * Format lockout time remaining as human-readable string
   */
  formatTimeRemaining(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  /**
   * Get lockout settings for reference
   */
  getSettings() {
    return {
      maxAttempts: MAX_ATTEMPTS,
      lockoutDuration: LOCKOUT_DURATION,
      lockoutDurationMinutes: LOCKOUT_DURATION / (60 * 1000),
    };
  }

  /**
   * Get remaining lockout time in seconds for a specific email
   * This method ensures accurate time calculation even after app restarts
   */
  async getLockoutTimeLeft(email: string): Promise<number> {
    try {
      const data = await this.getStoredData();
      const normalizedEmail = email.toLowerCase().trim();
      const attemptData = data[normalizedEmail];
      
      if (!attemptData || !attemptData.lockoutUntil) {
        return 0;
      }
      
      const now = Date.now();
      const timeLeft = attemptData.lockoutUntil - now;
      
      if (timeLeft <= 0) {
        // Lockout has expired, clean it up
        attemptData.attempts = 0;
        attemptData.lockoutUntil = undefined;
        data[normalizedEmail] = attemptData;
        await this.saveData(data);
        return 0;
      }
      
      // Return time left in seconds
      return Math.ceil(timeLeft / 1000);
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error getting lockout time left:', error);
      return 0;
    }
  }

  /**
   * Get current lockout status for an email (used for immediate status checks)
   */
  async getCurrentLockoutStatus(email: string): Promise<{
    isLockedOut: boolean;
    timeLeftSeconds: number;
    attempts: number;
    remainingAttempts: number;
  }> {
    try {
      const result = await this.checkLoginAttempts(email);
      const timeLeftSeconds = await this.getLockoutTimeLeft(email);
      
      return {
        isLockedOut: result.isLocked,
        timeLeftSeconds,
        attempts: result.isLocked ? MAX_ATTEMPTS : (MAX_ATTEMPTS - result.remainingAttempts),
        remainingAttempts: result.remainingAttempts,
      };
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error getting current lockout status:', error);
      return {
        isLockedOut: false,
        timeLeftSeconds: 0,
        attempts: 0,
        remainingAttempts: MAX_ATTEMPTS,
      };
    }
  }

  /**
   * Store the last attempted email for persistence across app restarts
   */
  private async setLastAttemptedEmail(email: string): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error storing last attempted email:', error);
    }
  }

  /**
   * Get the last attempted email (for checking lockout status on app start)
   */
  async getLastAttemptedEmail(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LAST_EMAIL_KEY);
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error getting last attempted email:', error);
      return null;
    }
  }

  /**
   * Clear the stored last attempted email
   */
  async clearLastAttemptedEmail(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_EMAIL_KEY);
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error clearing last attempted email:', error);
    }
  }

  /**
   * Manually check and unlock expired lockouts for a specific email
   * This ensures lockouts are properly cleared even if automatic cleanup missed them
   */
  async unlockExpiredAccount(email: string): Promise<boolean> {
    try {
      const data = await this.getStoredData(); // This already handles expired lockout cleanup
      const normalizedEmail = email.toLowerCase().trim();
      const attemptData = data[normalizedEmail];
      
      if (!attemptData || !attemptData.lockoutUntil) {
        // No lockout data or not locked out
        return false;
      }
      
      const now = Date.now();
      if (attemptData.lockoutUntil <= now) {
        // Lockout has expired, manually clear it
        logger.info('LOGIN_ATTEMPTS', `Manually unlocking expired account for ${normalizedEmail}`);
        
        attemptData.attempts = 0;
        attemptData.lockoutUntil = undefined;
        data[normalizedEmail] = attemptData;
        await this.saveData(data);
        
        return true; // Account was unlocked
      }
      
      return false; // Still locked out
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error unlocking expired account:', error);
      return false;
    }
  }

  /**
   * Force unlock an account (for admin/debug purposes)
   */
  async forceUnlockAccount(email: string): Promise<void> {
    try {
      const data = await this.getStoredData();
      const normalizedEmail = email.toLowerCase().trim();
      
      if (data[normalizedEmail]) {
        logger.info('LOGIN_ATTEMPTS', `Force unlocking account for ${normalizedEmail}`);
        
        data[normalizedEmail].attempts = 0;
        data[normalizedEmail].lockoutUntil = undefined;
        await this.saveData(data);
      }
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error force unlocking account:', error);
    }
  }

  /**
   * Clear all stored login attempt data (for testing/admin purposes)
   */
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(LAST_EMAIL_KEY);
      logger.info('LOGIN_ATTEMPTS', 'All login attempt data cleared');
    } catch (error) {
      logger.error('LOGIN_ATTEMPTS', 'Error clearing all data:', error);
    }
  }
}

// Export singleton instance
export const loginAttemptsService = new LoginAttemptsService();
export default loginAttemptsService;