/**
 * Error Suppression Configuration
 * 
 * This file configures how errors and warnings are handled in the app.
 * It prevents console errors from showing in the app interface while
 * still allowing them to be logged in development.
 */

import { LogBox } from 'react-native';

/**
 * Configure error suppression for the app
 */
export function configureErrorSuppression() {
  // First, completely disable all LogBox warnings and errors
  LogBox.ignoreAllLogs(true);
  
  // In production, completely disable console methods to prevent any logs
  if (!__DEV__) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
  } else {
    // In development, suppress console errors in the UI overlay completely
    // but still log them to the terminal/debugger for debugging
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;
    
    // Override console methods to prevent UI overlays while preserving terminal logging
    console.error = (...args) => {
      // Check if this is running in Metro/development environment
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // Log to native console (terminal) but don't trigger React Native LogBox
        if (typeof global.nativeLoggingHook !== 'undefined') {
          global.nativeLoggingHook.error(...args);
        } else {
          // Fallback: log to original console but suppress LogBox
          originalError.apply(console, args);
        }
      }
    };
    
    console.warn = (...args) => {
      // Similar approach for warnings
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        if (typeof global.nativeLoggingHook !== 'undefined') {
          global.nativeLoggingHook.warn(...args);
        } else {
          originalWarn.apply(console, args);
        }
      }
    };
  }

  // Disable LogBox warnings for specific patterns
  LogBox.ignoreLogs([
    // React warnings
    'Warning: Each child in a list should have a unique "key" prop',
    'Warning: Failed prop type',
    'Warning: componentWillReceiveProps',
    'Warning: componentWillMount',
    'Warning: componentWillUpdate',
    'Warning: componentWillUnmount',
    'Warning: Can\'t perform a React state update',
    'Warning: Cannot update during an existing state transition',
    'Warning: setState(...): Cannot update during an existing state transition',
    
    // React Navigation warnings
    'Non-serializable values were found in the navigation state',
    'The action \'NAVIGATE\' with payload',
    
    // Metro/Bundler warnings
    'Module RCTImageLoader requires',
    'Require cycle:',
    'Remote debugger',
    'Task orphaned for request',
    
    // Timer warnings
    'Setting a timer for a long period of time',
    'Timer with id',
    
    // List warnings
    'VirtualizedLists should never be nested',
    'VirtualizedList: You have a large list that is slow to update',
    
    // Appwrite specific errors (these are expected during development)
    'AppwriteException:',
    'Failed to refresh Appwrite JWT',
    'Missing scope error',
    'User (role: guests) missing scope',
    'Invalid credentials',
    'Account session has expired',
    
    // Promise rejections that are handled
    'Possible Unhandled Promise Rejection',
    'Unhandled promise rejection',
    
    // Font/Icon warnings
    'Font family',
    'MaterialIcons',
    'Feather',
    
    // AsyncStorage warnings
    'AsyncStorage has been extracted',
    
    // Flipper warnings
    'Flipper',
    'DevTools',
    
    // Expo warnings
    'expo-constants',
    'expo-modules-core',
    
    // Network warnings
    'Network request failed',
    'fetch',
    'XMLHttpRequest',
    
    // Development only warnings
    'You are not currently signed in to Expo',
    'Development server',
    
    // Add more patterns as needed
  ]);

  // Disable all LogBox warnings in production
  if (!__DEV__) {
    LogBox.ignoreAllLogs(true);
  }
}

/**
 * Configure global error handlers to prevent app crashes
 */
export function configureGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  const originalHandler = global.HermesInternal?.hasPromise 
    ? global.HermesInternal.setPromiseRejectionTracker 
    : null;

  if (typeof global.HermesInternal?.setPromiseRejectionTracker === 'function') {
    global.HermesInternal.setPromiseRejectionTracker((id: number, rejection: any) => {
      if (__DEV__) {
        console.warn('Unhandled promise rejection:', rejection);
      }
      // In production, silently handle the rejection
    });
  }

  // Handle JavaScript errors
  const originalErrorHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (__DEV__) {
      console.error('Global error handler:', error);
      // Call original handler in development for debugging
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    } else {
      // In production, log the error but don't crash the app
      console.log('Error occurred in production:', error?.message || 'Unknown error');
    }
  });
}

/**
 * Initialize all error suppression configurations
 */
export function initializeErrorSuppression() {
  configureErrorSuppression();
  configureGlobalErrorHandlers();
}
