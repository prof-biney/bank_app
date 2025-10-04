/**
 * Enhanced Loading Hooks
 * 
 * Provides comprehensive loading state management with toast notifications
 * for all major app operations with immediate user feedback
 */

import { useCallback } from 'react';
import { useLoading } from '@/context/LoadingContext';
import { useBiometricToast } from '@/context/BiometricToastContext';
import { logger } from '@/lib/logger';

interface LoadingOptions {
  showToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
  customLoadingMessage?: string;
}

export const useEnhancedLoading = () => {
  const loading = useLoading();
  const toast = useBiometricToast();

  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    operationType: Parameters<typeof loading.startLoading>[0],
    options: LoadingOptions = {}
  ): Promise<T> => {
    const {
      showToast = false,
      successMessage,
      errorMessage,
      customLoadingMessage,
    } = options;

    const operationId = loading.startLoading(
      operationType, 
      customLoadingMessage
    );

    try {
      const result = await operation();
      
      // Show success toast if requested
      if (showToast && successMessage) {
        toast.showSuccess('Success', successMessage);
      }
      
      return result;
    } catch (error) {
      logger.error('ENHANCED_LOADING', `Operation failed: ${operationType}`, error);
      
      // Show error toast if requested
      if (showToast && errorMessage) {
        toast.showError('Error', errorMessage);
      }
      
      throw error;
    } finally {
      loading.stopLoading(operationId);
    }
  }, [loading, toast]);

  return {
    withLoading,
    ...loading,
  };
};

// Specific hooks for common operations
export const useAuthLoading = () => {
  const { withLoading } = useEnhancedLoading();
  
  return {
    withLogin: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'login', {
        showToast: true,
        customLoadingMessage: 'Signing you in...',
        successMessage: 'Successfully signed in!',
        errorMessage: 'Sign in failed. Please check your credentials.',
      }), [withLoading]),
      
    withRegister: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'register', {
        showToast: true,
        customLoadingMessage: 'Creating your account...',
        successMessage: 'Account created successfully!',
        errorMessage: 'Account creation failed. Please try again.',
      }), [withLoading]),
      
    withBiometricSetup: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'custom', {
        showToast: true,
        customLoadingMessage: 'Setting up biometric authentication...',
        successMessage: 'Biometric authentication enabled!',
        errorMessage: 'Biometric setup failed. Please try again.',
      }), [withLoading]),
      
    withBiometricAuth: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'custom', {
        customLoadingMessage: 'Authenticating with biometrics...',
      }), [withLoading]),
  };
};

export const useTransactionLoading = () => {
  const { withLoading } = useEnhancedLoading();
  
  return {
    withDeposit: useCallback(<T>(operation: () => Promise<T>, amount?: number) => 
      withLoading(operation, 'deposit', {
        showToast: true,
        customLoadingMessage: amount ? `Processing deposit of GHS ${amount.toFixed(2)}...` : 'Processing your deposit...',
        successMessage: 'Deposit processed successfully!',
        errorMessage: 'Deposit failed. Please try again.',
      }), [withLoading]),
      
    withWithdrawal: useCallback(<T>(operation: () => Promise<T>, amount?: number) => 
      withLoading(operation, 'custom', {
        showToast: true,
        customLoadingMessage: amount ? `Processing withdrawal of GHS ${amount.toFixed(2)}...` : 'Processing your withdrawal...',
        successMessage: 'Withdrawal processed successfully!',
        errorMessage: 'Withdrawal failed. Please try again.',
      }), [withLoading]),
      
    withTransfer: useCallback(<T>(operation: () => Promise<T>, amount?: number) => 
      withLoading(operation, 'transfer', {
        showToast: true,
        customLoadingMessage: amount ? `Transferring GHS ${amount.toFixed(2)}...` : 'Processing your transfer...',
        successMessage: 'Transfer completed successfully!',
        errorMessage: 'Transfer failed. Please try again.',
      }), [withLoading]),
      
    withTransactionDelete: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'custom', {
        showToast: true,
        customLoadingMessage: 'Deleting transaction...',
        successMessage: 'Transaction deleted successfully!',
        errorMessage: 'Failed to delete transaction.',
      }), [withLoading]),
  };
};

export const useCardLoading = () => {
  const { withLoading } = useEnhancedLoading();
  
  return {
    withAddCard: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'add_card', {
        showToast: true,
        customLoadingMessage: 'Adding your card...',
        successMessage: 'Card added successfully!',
        errorMessage: 'Failed to add card. Please try again.',
      }), [withLoading]),
      
    withRemoveCard: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'delete_card', {
        showToast: true,
        customLoadingMessage: 'Removing card...',
        successMessage: 'Card removed successfully!',
        errorMessage: 'Failed to remove card.',
      }), [withLoading]),
      
    withUpdateBalance: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'update_balance', {
        customLoadingMessage: 'Updating balance...',
      }), [withLoading]),
      
    withRefreshBalances: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'sync_data', {
        customLoadingMessage: 'Refreshing balances...',
      }), [withLoading]),
  };
};

export const useDataLoading = () => {
  const { withLoading } = useEnhancedLoading();
  
  return {
    withClearTransactions: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'clear_transactions', {
        showToast: true,
        customLoadingMessage: 'Clearing transaction history...',
        successMessage: 'Transaction history cleared!',
        errorMessage: 'Failed to clear transactions.',
      }), [withLoading]),
      
    withClearActivity: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'clear_activity', {
        showToast: true,
        customLoadingMessage: 'Clearing activity history...',
        successMessage: 'Activity history cleared!',
        errorMessage: 'Failed to clear activity.',
      }), [withLoading]),
      
    withDeleteActivity: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'delete_activity', {
        showToast: true,
        customLoadingMessage: 'Deleting activity...',
        successMessage: 'Activity deleted successfully!',
        errorMessage: 'Failed to delete activity.',
      }), [withLoading]),
      
    withSyncData: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'sync_data', {
        customLoadingMessage: 'Syncing data...',
      }), [withLoading]),
  };
};

// Profile and settings operations
export const useProfileLoading = () => {
  const { withLoading } = useEnhancedLoading();
  
  return {
    withProfileUpdate: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'custom', {
        showToast: true,
        customLoadingMessage: 'Updating profile...',
        successMessage: 'Profile updated successfully!',
        errorMessage: 'Failed to update profile.',
      }), [withLoading]),
      
    withProfilePictureUpdate: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'custom', {
        showToast: true,
        customLoadingMessage: 'Uploading profile picture...',
        successMessage: 'Profile picture updated!',
        errorMessage: 'Failed to update profile picture.',
      }), [withLoading]),
  };
};

// Notification operations
export const useNotificationLoading = () => {
  const { withLoading } = useEnhancedLoading();
  
  return {
    withMarkAllRead: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'custom', {
        customLoadingMessage: 'Marking all notifications as read...',
      }), [withLoading]),
      
    withClearNotifications: useCallback(<T>(operation: () => Promise<T>) => 
      withLoading(operation, 'custom', {
        showToast: true,
        customLoadingMessage: 'Clearing notifications...',
        successMessage: 'Notifications cleared!',
        errorMessage: 'Failed to clear notifications.',
      }), [withLoading]),
  };
};