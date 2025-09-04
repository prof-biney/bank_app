/**
 * Safe Navigation Utilities
 * 
 * Provides robust navigation methods that handle edge cases like
 * navigation during authentication state changes, unmounted components, etc.
 */

import { router } from 'expo-router';

/**
 * Safely navigate to a route with retries and error handling
 * @param route - The route to navigate to
 * @param method - Navigation method ('replace' | 'push')
 * @param retries - Number of retry attempts
 * @param delay - Delay between retries in milliseconds
 */
export const safeNavigate = async (
  route: string,
  method: 'replace' | 'push' = 'replace',
  retries: number = 3,
  delay: number = 100
): Promise<void> => {
  let attemptCount = 0;
  
  const attemptNavigation = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (method === 'replace') {
          router.replace(route);
        } else {
          router.push(route);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  };
  
  while (attemptCount < retries) {
    try {
      await attemptNavigation();
      console.log(`[SafeNavigation] Successfully navigated to ${route} on attempt ${attemptCount + 1}`);
      return;
    } catch (error) {
      attemptCount++;
      console.warn(`[SafeNavigation] Navigation attempt ${attemptCount} failed:`, error);
      
      if (attemptCount >= retries) {
        console.error(`[SafeNavigation] All ${retries} navigation attempts failed for route: ${route}`);
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attemptCount));
    }
  }
};

/**
 * Navigate after logout with special handling for authentication state changes
 * @param route - The route to navigate to (default: '/sign-in')
 */
export const navigateAfterLogout = async (route: string = '/sign-in'): Promise<void> => {
  return new Promise((resolve) => {
    // Use a longer delay to ensure authentication state has fully updated
    setTimeout(async () => {
      try {
        await safeNavigate(route, 'replace', 5, 150);
        resolve();
      } catch (error) {
        console.error('[SafeNavigation] Post-logout navigation failed:', error);
        
        // Last resort: try a simple router.push
        try {
          router.push(route);
          resolve();
        } catch (finalError) {
          console.error('[SafeNavigation] Final navigation attempt failed:', finalError);
          resolve(); // Don't throw - user can manually navigate
        }
      }
    }, 200);
  });
};

/**
 * Check if navigation is currently safe (i.e., router is mounted and ready)
 */
export const isNavigationReady = (): boolean => {
  try {
    // Try to access router state without causing side effects
    router.canGoBack();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Wait for navigation to be ready before proceeding
 * @param timeout - Maximum time to wait in milliseconds
 * @param checkInterval - How often to check in milliseconds
 */
export const waitForNavigationReady = async (
  timeout: number = 5000,
  checkInterval: number = 50
): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (isNavigationReady()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  return false;
};

/**
 * Navigate with preparation - waits for navigation to be ready first
 * @param route - The route to navigate to
 * @param method - Navigation method ('replace' | 'push')
 */
export const navigateWhenReady = async (
  route: string,
  method: 'replace' | 'push' = 'replace'
): Promise<void> => {
  const isReady = await waitForNavigationReady();
  
  if (!isReady) {
    console.warn('[SafeNavigation] Navigation not ready after timeout, attempting anyway');
  }
  
  return safeNavigate(route, method);
};
