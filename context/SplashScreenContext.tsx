/**
 * SplashScreenContext - State Management for Custom Splash Screen
 * 
 * Provides centralized state management for controlling the custom splash screen
 * throughout the app initialization process.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface SplashScreenState {
  isVisible: boolean;
  progress: number;
  stage: string;
  isCompleting: boolean;
}

interface SplashScreenContextValue {
  state: SplashScreenState;
  showSplash: () => void;
  hideSplash: () => void;
  updateProgress: (progress: number, stage?: string) => void;
  completeSplash: () => Promise<void>;
  resetSplash: () => void;
}

const SplashScreenContext = createContext<SplashScreenContextValue | undefined>(undefined);

interface SplashScreenProviderProps {
  children: React.ReactNode;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function SplashScreenProvider({ 
  children, 
  autoHide = false, 
  autoHideDelay = 3000 
}: SplashScreenProviderProps) {
  const [state, setState] = useState<SplashScreenState>({
    isVisible: true, // Start visible by default
    progress: 0,
    stage: 'Initializing...',
    isCompleting: false,
  });

  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionPromiseRef = useRef<Promise<void> | null>(null);
  const completionResolveRef = useRef<(() => void) | null>(null);

  // Auto-hide functionality
  useEffect(() => {
    if (autoHide && state.isVisible && !state.isCompleting) {
      autoHideTimeoutRef.current = setTimeout(() => {
        completeSplash();
      }, autoHideDelay);
    }

    return () => {
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
        autoHideTimeoutRef.current = null;
      }
    };
  }, [autoHide, autoHideDelay, state.isVisible, state.isCompleting]);

  const showSplash = useCallback(() => {
    logger.info('SPLASH', 'Showing splash screen');
    setState(prev => ({
      ...prev,
      isVisible: true,
      isCompleting: false,
    }));
  }, []);

  const hideSplash = useCallback(() => {
    logger.info('SPLASH', 'Hiding splash screen');
    setState(prev => ({
      ...prev,
      isVisible: false,
      isCompleting: false,
    }));
    
    // Clear auto-hide timeout if it exists
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }

    // Resolve completion promise if it exists
    if (completionResolveRef.current) {
      completionResolveRef.current();
      completionResolveRef.current = null;
      completionPromiseRef.current = null;
    }
  }, []);

  const updateProgress = useCallback((progress: number, stage?: string) => {
    logger.debug('SPLASH', `Updating progress: ${progress}%`, { stage });
    setState(prev => ({
      ...prev,
      progress: Math.min(Math.max(progress, 0), 100), // Clamp between 0-100
      ...(stage && { stage }),
    }));
  }, []);

  const completeSplash = useCallback(async (): Promise<void> => {
    logger.info('SPLASH', 'Completing splash screen');
    
    // If already completing, return existing promise
    if (completionPromiseRef.current) {
      return completionPromiseRef.current;
    }

    // Create completion promise
    completionPromiseRef.current = new Promise<void>((resolve) => {
      completionResolveRef.current = resolve;
    });

    setState(prev => ({
      ...prev,
      isCompleting: true,
    }));

    // Clear auto-hide timeout
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }

    return completionPromiseRef.current;
  }, []);

  const resetSplash = useCallback(() => {
    logger.info('SPLASH', 'Resetting splash screen');
    
    // Clear timeouts and promises
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }
    
    if (completionResolveRef.current) {
      completionResolveRef.current();
      completionResolveRef.current = null;
      completionPromiseRef.current = null;
    }

    setState({
      isVisible: true,
      progress: 0,
      stage: 'Initializing...',
      isCompleting: false,
    });
  }, []);

  const contextValue: SplashScreenContextValue = {
    state,
    showSplash,
    hideSplash,
    updateProgress,
    completeSplash,
    resetSplash,
  };

  return (
    <SplashScreenContext.Provider value={contextValue}>
      {children}
    </SplashScreenContext.Provider>
  );
}

export function useSplashScreen(): SplashScreenContextValue {
  const context = useContext(SplashScreenContext);
  if (!context) {
    throw new Error('useSplashScreen must be used within a SplashScreenProvider');
  }
  return context;
}

/**
 * Hook for managing splash screen during app initialization
 * Provides common patterns for splash screen management
 */
export function useAppInitialization() {
  const splash = useSplashScreen();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<Error | null>(null);

  const initializeApp = useCallback(async (
    initializationSteps: Array<{
      name: string;
      task: () => Promise<void>;
      weight: number; // Progress weight (0-100)
    }>
  ) => {
    try {
      setInitializationError(null);
      setIsInitialized(false);
      
      let totalProgress = 0;
      const totalWeight = initializationSteps.reduce((sum, step) => sum + step.weight, 0);
      
      for (const step of initializationSteps) {
        splash.updateProgress(totalProgress, step.name);
        
        try {
          await step.task();
          totalProgress += (step.weight / totalWeight) * 100;
        } catch (error) {
          logger.error('SPLASH', `Initialization step "${step.name}" failed:`, error);
          throw error;
        }
      }
      
      splash.updateProgress(100, 'Ready!');
      setIsInitialized(true);
      
      // Complete splash screen
      await splash.completeSplash();
      
    } catch (error) {
      const initError = error instanceof Error ? error : new Error('Unknown initialization error');
      setInitializationError(initError);
      logger.error('SPLASH', 'App initialization failed:', initError);
      throw initError;
    }
  }, [splash]);

  const retryInitialization = useCallback(() => {
    setInitializationError(null);
    splash.resetSplash();
  }, [splash]);

  return {
    isInitialized,
    initializationError,
    initializeApp,
    retryInitialization,
    splash,
  };
}

/**
 * Higher-order component for wrapping components that need splash screen management
 */
export function withSplashScreen<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    showSplashOnMount?: boolean;
    autoHide?: boolean;
    autoHideDelay?: number;
  } = {}
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    const splash = useSplashScreen();

    useEffect(() => {
      if (options.showSplashOnMount) {
        splash.showSplash();
      }
    }, []);

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withSplashScreen(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export default SplashScreenContext;