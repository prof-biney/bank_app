/**
 * Main App Entry Point
 * 
 * This is the initial screen that handles routing to the appropriate destination
 * after the splash screen completes. Only shows splash screen on first app load.
 */

import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSplashScreen } from '@/context/SplashScreenContext';
import { CustomSplashScreen } from '@/components/CustomSplashScreen';
import { logger } from '@/lib/logger';
import * as SplashScreen from 'expo-splash-screen';
import useAuthStore from '@/store/auth.store';

export default function IndexScreen() {
  const splash = useSplashScreen();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Hide native splash screen immediately when JS loads
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
        logger.info('SCREEN', '[IndexScreen] Native splash screen hidden');
      } catch (error) {
        logger.warn('SCREEN', '[IndexScreen] Failed to hide native splash:', error);
      }
    };
    
    hideSplash();
    
    // Only initialize app if we haven't already
    if (!hasInitialized) {
      initializeApp();
    }
  }, [hasInitialized]);

  // Handle routing based on initialization completion
  useEffect(() => {
    if (hasInitialized) {
      logger.info('SCREEN', '[IndexScreen] Initialization complete, checking auth state', {
        isAuthenticated,
        isLoading
      });
      
      setShowSplash(false);
      
      // Small delay to let splash screen finish its animation
      const routingTimer = setTimeout(() => {
        if (isAuthenticated) {
          logger.info('SCREEN', '[IndexScreen] User authenticated, navigating to main app');
          router.replace('/(tabs)');
        } else {
          logger.info('SCREEN', '[IndexScreen] User not authenticated, navigating to sign-in');
          router.replace('/(auth)/sign-in');
        }
      }, 500);
      
      return () => clearTimeout(routingTimer);
    }
  }, [hasInitialized, isAuthenticated]);

  const initializeApp = async () => {
    try {
      // Simple app introduction with progress updates
      splash.updateProgress(15, 'Welcome to BankApp...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      splash.updateProgress(35, 'Setting up your experience...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      splash.updateProgress(60, 'Preparing secure environment...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      splash.updateProgress(85, 'Almost ready...');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      splash.updateProgress(100, 'Ready!');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mark as initialized instead of navigating directly
      setHasInitialized(true);
      
    } catch (error) {
      logger.error('APP', 'App initialization failed:', error);
      
      // Still mark as initialized on error
      setHasInitialized(true);
    }
  };

  // Only show splash if we're still initializing
  if (!showSplash) {
    return null; // Let routing handle the next screen
  }

  return (
    <CustomSplashScreen 
      onComplete={() => {
        // This will be handled by the useEffect above
        logger.info('SCREEN', '[IndexScreen] Splash screen animation completed');
      }}
      testMode={__DEV__} // Faster animations in development
    />
  );
}
