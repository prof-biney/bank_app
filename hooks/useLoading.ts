/**
 * useLoading Hook
 * 
 * A custom hook for managing loading states across components with consistent
 * loading animation integration. Provides methods to show/hide loading with
 * customizable messages and types.
 */

import { useState, useCallback, useRef } from 'react';
import { LoadingAnimationProps } from '@/components/LoadingAnimation';

export interface LoadingState {
  visible: boolean;
  message?: string;
  subtitle?: string;
  type?: LoadingAnimationProps['type'];
  size?: LoadingAnimationProps['size'];
}

export interface UseLoadingReturn {
  /** Current loading state */
  loading: LoadingState;
  
  /** Show loading with optional configuration */
  showLoading: (config?: Partial<LoadingState>) => void;
  
  /** Hide loading */
  hideLoading: () => void;
  
  /** Update loading message/subtitle without hiding */
  updateLoading: (updates: Partial<Pick<LoadingState, 'message' | 'subtitle'>>) => void;
  
  /** Execute an async operation with loading states */
  withLoading: <T>(
    operation: () => Promise<T>,
    config?: Partial<LoadingState>
  ) => Promise<T>;
  
  /** Execute multiple operations with sequential loading messages */
  withSequentialLoading: <T>(
    operations: Array<{
      operation: () => Promise<any>;
      message?: string;
      subtitle?: string;
    }>,
    finalOperation?: () => Promise<T>,
    config?: Partial<LoadingState>
  ) => Promise<T>;
  
  /** Check if currently loading */
  isLoading: boolean;
}

const DEFAULT_LOADING_STATE: LoadingState = {
  visible: false,
  message: 'Loading...',
  type: 'spinner',
  size: 'medium',
};

export const useLoading = (initialConfig?: Partial<LoadingState>): UseLoadingReturn => {
  const [loading, setLoading] = useState<LoadingState>({
    ...DEFAULT_LOADING_STATE,
    ...initialConfig,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const showLoading = useCallback((config?: Partial<LoadingState>) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setLoading(prev => ({
      ...prev,
      ...config,
      visible: true,
    }));
  }, []);
  
  const hideLoading = useCallback(() => {
    setLoading(prev => ({
      ...prev,
      visible: false,
    }));
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);
  
  const updateLoading = useCallback((updates: Partial<Pick<LoadingState, 'message' | 'subtitle'>>) => {
    setLoading(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);
  
  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    config?: Partial<LoadingState>
  ): Promise<T> => {
    try {
      showLoading(config);
      const result = await operation();
      return result;
    } catch (error) {
      throw error;
    } finally {
      hideLoading();
    }
  }, [showLoading, hideLoading]);
  
  const withSequentialLoading = useCallback(async <T>(
    operations: Array<{
      operation: () => Promise<any>;
      message?: string;
      subtitle?: string;
    }>,
    finalOperation?: () => Promise<T>,
    config?: Partial<LoadingState>
  ): Promise<T> => {
    try {
      showLoading(config);
      
      // Execute each operation with its message
      for (const { operation, message, subtitle } of operations) {
        if (message || subtitle) {
          updateLoading({ message, subtitle });
        }
        await operation();
        
        // Small delay between operations for better UX
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Execute final operation if provided
      if (finalOperation) {
        const result = await finalOperation();
        return result;
      }
      
      return undefined as T;
    } catch (error) {
      throw error;
    } finally {
      hideLoading();
    }
  }, [showLoading, hideLoading, updateLoading]);
  
  return {
    loading,
    showLoading,
    hideLoading,
    updateLoading,
    withLoading,
    withSequentialLoading,
    isLoading: loading.visible,
  };
};

// Predefined loading configurations for common scenarios
export const LOADING_CONFIGS = {
  // Authentication operations
  LOGIN: {
    message: 'Signing you in...',
    subtitle: 'Please wait while we authenticate your credentials',
    type: 'spinner' as const,
  },
  REGISTER: {
    message: 'Creating your account...',
    subtitle: 'Setting up your profile and preferences',
    type: 'dots' as const,
  },
  LOGOUT: {
    message: 'Signing out...',
    subtitle: 'Clearing your session data',
    type: 'pulse' as const,
  },
  
  // Card operations
  CREATE_CARD: {
    message: 'Creating your card...',
    subtitle: 'Setting up your new payment card',
    type: 'bars' as const,
  },
  DELETE_CARD: {
    message: 'Removing card...',
    subtitle: 'This may take a few moments',
    type: 'spinner' as const,
  },
  UPDATE_CARD: {
    message: 'Updating card details...',
    type: 'pulse' as const,
  },
  
  // Transaction operations
  PROCESS_TRANSACTION: {
    message: 'Processing transaction...',
    subtitle: 'Please do not close this screen',
    type: 'spinner' as const,
  },
  LOAD_TRANSACTIONS: {
    message: 'Loading transactions...',
    type: 'dots' as const,
  },
  
  // Data operations
  SYNC_DATA: {
    message: 'Syncing your data...',
    subtitle: 'Fetching the latest information',
    type: 'bars' as const,
  },
  SAVE_CHANGES: {
    message: 'Saving changes...',
    type: 'pulse' as const,
  },
  
  // Profile operations
  UPDATE_PROFILE: {
    message: 'Updating your profile...',
    type: 'spinner' as const,
  },
  UPLOAD_PHOTO: {
    message: 'Uploading photo...',
    subtitle: 'This may take a moment depending on your connection',
    type: 'bars' as const,
  },
  
  // Generic operations
  LOADING: {
    message: 'Loading...',
    type: 'spinner' as const,
  },
  PROCESSING: {
    message: 'Processing...',
    type: 'dots' as const,
  },
  SAVING: {
    message: 'Saving...',
    type: 'pulse' as const,
  },
} as const;

export default useLoading;