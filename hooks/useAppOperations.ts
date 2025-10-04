/**
 * Enhanced App Operations Hooks
 * 
 * Provides app operations with immediate loading feedback and toast notifications
 * These hooks wrap the AppContext operations with enhanced loading states
 */

import { useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  useTransactionLoading, 
  useCardLoading, 
  useDataLoading, 
  useNotificationLoading,
  useAuthLoading,
  useProfileLoading
} from './useEnhancedLoading';
import useAuthStore from '@/store/auth.store';

// Enhanced transaction operations
export const useEnhancedTransactions = () => {
  const { 
    makeTransfer, 
    makeWithdrawal, 
    makeDeposit, 
    updateTransaction, 
    deleteTransaction,
    clearAllTransactions,
    refreshTransactions
  } = useApp();
  
  const loading = useTransactionLoading();

  return {
    makeTransfer: useCallback(async (cardId: string, amount: number, recipientCardNumber: string, description?: string) => {
      return loading.withTransfer(
        () => makeTransfer(cardId, amount, recipientCardNumber, description),
        amount
      );
    }, [makeTransfer, loading]),

    makeWithdrawal: useCallback(async (cardId: string, amount: number, withdrawalMethod: string, withdrawalDetails: any, description?: string) => {
      return loading.withWithdrawal(
        () => makeWithdrawal(cardId, amount, withdrawalMethod, withdrawalDetails, description),
        amount
      );
    }, [makeWithdrawal, loading]),

    makeDeposit: useCallback(async (params: Parameters<typeof makeDeposit>[0], onSuccess?: Parameters<typeof makeDeposit>[1]) => {
      return loading.withDeposit(
        () => makeDeposit(params, onSuccess),
        params.amount
      );
    }, [makeDeposit, loading]),

    updateTransaction: useCallback(async (id: string, updateData: Parameters<typeof updateTransaction>[1]) => {
      return loading.withTransactionDelete(
        () => updateTransaction(id, updateData)
      );
    }, [updateTransaction, loading]),

    deleteTransaction: useCallback(async (id: string) => {
      return loading.withTransactionDelete(
        () => deleteTransaction(id)
      );
    }, [deleteTransaction, loading]),

    clearAllTransactions: useCallback(async () => {
      const { withClearTransactions } = useDataLoading();
      return withClearTransactions(
        () => clearAllTransactions()
      );
    }, [clearAllTransactions]),

    refreshTransactions: useCallback(async () => {
      const { withSyncData } = useDataLoading();
      return withSyncData(
        () => refreshTransactions()
      );
    }, [refreshTransactions]),
  };
};

// Enhanced card operations
export const useEnhancedCards = () => {
  const { 
    addCard, 
    removeCard, 
    updateCardBalance,
    refreshCardBalances
  } = useApp();
  
  const loading = useCardLoading();

  return {
    addCard: useCallback(async (cardData: Parameters<typeof addCard>[0]) => {
      return loading.withAddCard(
        () => addCard(cardData)
      );
    }, [addCard, loading]),

    removeCard: useCallback(async (cardId: string) => {
      return loading.withRemoveCard(
        () => removeCard(cardId)
      );
    }, [removeCard, loading]),

    updateCardBalance: useCallback(async (cardId: string, newBalance: number) => {
      return loading.withUpdateBalance(
        () => updateCardBalance(cardId, newBalance)
      );
    }, [updateCardBalance, loading]),

    refreshCardBalances: useCallback(async () => {
      return loading.withRefreshBalances(
        () => refreshCardBalances()
      );
    }, [refreshCardBalances, loading]),
  };
};

// Enhanced data management operations
export const useEnhancedDataOperations = () => {
  const { 
    clearAllActivity, 
    deleteActivity,
    clearAllTransactions,
    clearAllNotifications,
    markAllNotificationsRead
  } = useApp();
  
  const dataLoading = useDataLoading();
  const notificationLoading = useNotificationLoading();

  return {
    clearAllActivity: useCallback(async () => {
      return dataLoading.withClearActivity(
        () => clearAllActivity()
      );
    }, [clearAllActivity, dataLoading]),

    deleteActivity: useCallback(async (activityId: string) => {
      return dataLoading.withDeleteActivity(
        () => deleteActivity(activityId)
      );
    }, [deleteActivity, dataLoading]),

    clearAllTransactions: useCallback(async () => {
      return dataLoading.withClearTransactions(
        () => clearAllTransactions()
      );
    }, [clearAllTransactions, dataLoading]),

    clearAllNotifications: useCallback(async () => {
      return notificationLoading.withClearNotifications(
        () => clearAllNotifications()
      );
    }, [clearAllNotifications, notificationLoading]),

    markAllNotificationsRead: useCallback(async () => {
      return notificationLoading.withMarkAllRead(
        () => markAllNotificationsRead()
      );
    }, [markAllNotificationsRead, notificationLoading]),
  };
};

// Enhanced auth operations
export const useEnhancedAuth = () => {
  const { 
    login, 
    register, 
    logout,
    updateProfilePicture,
    updateUserProfile,
    setupBiometric,
    authenticateWithBiometric
  } = useAuthStore();
  
  const authLoading = useAuthLoading();
  const profileLoading = useProfileLoading();

  return {
    login: useCallback(async (email: string, password: string) => {
      return authLoading.withLogin(
        () => login(email, password)
      );
    }, [login, authLoading]),

    register: useCallback(async (email: string, password: string, name?: string) => {
      return authLoading.withRegister(
        () => register(email, password, name)
      );
    }, [register, authLoading]),

    logout: useCallback(async () => {
      // Don't show loading for logout as it should be instant
      return logout();
    }, [logout]),

    updateProfilePicture: useCallback(async (imageUri: string) => {
      return profileLoading.withProfilePictureUpdate(
        () => updateProfilePicture(imageUri)
      );
    }, [updateProfilePicture, profileLoading]),

    updateUserProfile: useCallback(async (updates: { name?: string; phoneNumber?: string }) => {
      return profileLoading.withProfileUpdate(
        () => updateUserProfile(updates)
      );
    }, [updateUserProfile, profileLoading]),

    setupBiometric: useCallback(async () => {
      return authLoading.withBiometricSetup(
        () => setupBiometric()
      );
    }, [setupBiometric, authLoading]),

    authenticateWithBiometric: useCallback(async () => {
      return authLoading.withBiometricAuth(
        () => authenticateWithBiometric()
      );
    }, [authenticateWithBiometric, authLoading]),
  };
};

// Convenience hook that provides all enhanced operations
export const useAppWithLoading = () => {
  const transactions = useEnhancedTransactions();
  const cards = useEnhancedCards();
  const data = useEnhancedDataOperations();
  const auth = useEnhancedAuth();

  return {
    transactions,
    cards,
    data,
    auth,
  };
};