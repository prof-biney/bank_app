/**
 * App State Management Service
 * 
 * Handles app state changes and manages session cleanup to prevent conflicts
 * when the app goes to background or resumes.
 */

import { AppState, AppStateStatus } from 'react-native';
import { logger } from './logger';
import { getCurrentSession, validateSession } from './appwrite/auth';

class AppStateService {
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = AppState.currentState;
  private backgroundTime: number | null = null;
  private isInitialized = false;

  // Time threshold (in minutes) after which to validate session on resume
  private readonly SESSION_VALIDATION_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize app state monitoring
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn('APP_STATE', 'App state service already initialized');
      return;
    }

    logger.info('APP_STATE', 'Initializing app state monitoring');

    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    this.currentAppState = AppState.currentState;
    this.isInitialized = true;

    logger.info('APP_STATE', 'App state monitoring initialized', {
      currentState: this.currentAppState,
    });
  }

  /**
   * Clean up app state monitoring
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription?.remove();
      this.appStateSubscription = null;
    }

    this.isInitialized = false;
    logger.info('APP_STATE', 'App state monitoring cleaned up');
  }

  /**
   * Handle app state changes
   */
  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    logger.info('APP_STATE', 'App state changed', {
      from: this.currentAppState,
      to: nextAppState,
    });

    try {
      if (this.currentAppState === 'active' && nextAppState.match(/inactive|background/)) {
        // App going to background
        await this.handleAppGoingBackground();
      } else if (this.currentAppState.match(/inactive|background/) && nextAppState === 'active') {
        // App coming to foreground
        await this.handleAppComingForeground();
      }
    } catch (error) {
      logger.error('APP_STATE', 'Error handling app state change', error);
    }

    this.currentAppState = nextAppState;
  }

  /**
   * Handle app going to background
   */
  private async handleAppGoingBackground(): Promise<void> {
    logger.info('APP_STATE', 'App going to background');
    
    this.backgroundTime = Date.now();

    // Optional: Clear sensitive data from memory
    // Note: Be careful not to clear user auth state here as it would force re-login
    
    logger.info('APP_STATE', 'Background transition handled', {
      backgroundTime: new Date(this.backgroundTime).toISOString(),
    });
  }

  /**
   * Handle app coming to foreground
   */
  private async handleAppComingForeground(): Promise<void> {
    logger.info('APP_STATE', 'App coming to foreground');

    const now = Date.now();
    const timeInBackground = this.backgroundTime ? now - this.backgroundTime : 0;

    logger.info('APP_STATE', 'Foreground transition details', {
      timeInBackground,
      backgroundTime: this.backgroundTime ? new Date(this.backgroundTime).toISOString() : null,
      shouldValidateSession: timeInBackground > this.SESSION_VALIDATION_THRESHOLD,
    });

    // If app was in background for more than threshold, validate session
    if (timeInBackground > this.SESSION_VALIDATION_THRESHOLD) {
      await this.validateSessionOnResume();
    }

    this.backgroundTime = null;
    logger.info('APP_STATE', 'Foreground transition handled');
  }

  /**
   * Validate session when app resumes after being backgrounded for a while
   */
  private async validateSessionOnResume(): Promise<void> {
    try {
      logger.info('APP_STATE', 'Validating session on app resume');

      const isValid = await validateSession();
      
      if (!isValid) {
        logger.warn('APP_STATE', 'Session invalid on resume, user may need to re-authenticate');
        
        // Optional: Clear auth state to force re-login
        // This depends on your app's security requirements
        // For now, we'll just log the issue and let the app handle it naturally
      } else {
        logger.info('APP_STATE', 'Session validation successful on resume');
      }
    } catch (error) {
      logger.error('APP_STATE', 'Error validating session on resume', error);
      
      // If session validation fails, there might be a session conflict
      // The auth service should handle this gracefully
    }
  }

  /**
   * Force session validation (can be called manually)
   */
  async forceValidateSession(): Promise<boolean> {
    try {
      logger.info('APP_STATE', 'Forcing session validation');
      return await validateSession();
    } catch (error) {
      logger.error('APP_STATE', 'Force session validation failed', error);
      return false;
    }
  }

  /**
   * Get current app state
   */
  getCurrentState(): AppStateStatus {
    return this.currentAppState;
  }

  /**
   * Check if app was recently backgrounded
   */
  wasRecentlyBackgrounded(thresholdMs: number = this.SESSION_VALIDATION_THRESHOLD): boolean {
    if (!this.backgroundTime) return false;
    
    const timeSinceBackground = Date.now() - this.backgroundTime;
    return timeSinceBackground <= thresholdMs;
  }
}

// Export singleton instance
export const appStateService = new AppStateService();
export default appStateService;