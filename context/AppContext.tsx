import React, { createContext, ReactNode, useContext, useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Transaction } from "@/constants/index";
import type { Notification } from "@/types";
import { ActivityEvent } from "@/types/activity";
import { appwriteConfig, client, logCardEvent, databases } from "@/lib/appwrite";
import { 
  fetchUserTransactions, 
  refreshTransactions, 
  fetchUserTransactionsWithCache, 
  forceRefreshTransactions,
  cacheTransactions 
} from "@/lib/transactionService";
import { StorageManager } from "@/lib/storageService";
import { initNotificationService } from "@/lib/notificationService";

// Appwrite database services
import {
  createAppwriteTransaction,
  updateAppwriteTransaction,
  deleteAppwriteTransaction
} from "@/lib/appwriteTransactionService";
import {
  createAppwriteCard,
  updateAppwriteCardBalance,
  deleteAppwriteCard,
  getAppwriteActiveCards,
  findAppwriteCardByNumber
} from "@/lib/appwriteCardService";
import {
  createAppwriteActivityEvent
} from "@/lib/appwriteActivityService";
import { initConnectionMonitoring, getConnectionStatus } from "@/lib/connectionService";
import useAuthStore from "@/store/auth.store";

interface AppContextType {
  cards: Card[];
  transactions: Transaction[];
  activeCard: Card | null;
  setActiveCard: (card: Card) => void;
  addCard: (card: Omit<Card, "id" | "balance"> & Partial<Pick<Card, "balance" | "token" | "currency">>) => void;
  removeCard: (cardId: string) => void;
  addTransaction: (transaction: Omit<Transaction, "id" | "date">) => void;
  updateCardBalance: (cardId: string, newBalance: number) => void;
  makeTransfer: (cardId: string, amount: number, recipientCardNumber: string, description?: string) => Promise<{ success: boolean; error?: string; newBalance?: number; recipientNewBalance?: number }>;
  isLoadingCards: boolean;
  isLoadingTransactions: boolean;
  refreshTransactions: () => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  clearAllTransactions: () => Promise<void>;
  // Activity events
  activity: ActivityEvent[];
  pushActivity: (evt: ActivityEvent) => void;
  setActivity: React.Dispatch<React.SetStateAction<ActivityEvent[]>>;
  clearAllActivity: () => Promise<void>;
  // Notifications
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  markNotificationRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteAllReadNotifications: () => Promise<void>;
  toggleNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsUnread: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  unarchiveNotification: (id: string) => Promise<void>;
  toggleNotificationArchive: (id: string) => Promise<void>;
  archiveAllReadNotifications: () => Promise<void>;
  // Test function - remove in production
  addTestNotifications?: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true);
  const [transactionsCursor, setTransactionsCursor] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Get auth state reactively
  const { isAuthenticated, isLoading: authLoading, user } = useAuthStore();

  // Initialize notification service with AppContext functions
  useEffect(() => {
    initNotificationService({ setNotifications });
  }, []);

const pushActivity: AppContextType["pushActivity"] = (evt) => {
    setActivity((prev) => [evt, ...prev]);
  };

  const addTransaction = (
    transactionData: Omit<Transaction, "id" | "date">
  ) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
      date: new Date().toISOString(),
    };
    
    // Optimistically add to local state
    setTransactions((prev) => [newTransaction, ...prev]);

    // Push activity event
    // For transfers, use the description directly to avoid duplication ("Transfer: Transfer To: Name")
    const activityTitle = newTransaction.type === 'transfer' ? 
      newTransaction.description : 
      `${newTransaction.type.charAt(0).toUpperCase()}${newTransaction.type.slice(1)}: ${newTransaction.description}`;
    
    const activityEvent = {
      id: `tx.${newTransaction.id}`,
      category: 'transaction' as const,
      type: `transaction.${newTransaction.type}`,
      title: activityTitle,
      subtitle: new Date(newTransaction.date).toLocaleString(),
      amount: newTransaction.amount,
      currency: 'GHS',
      status: newTransaction.status as any,
      timestamp: newTransaction.date,
      transactionId: newTransaction.id,
      cardId: newTransaction.cardId,
      tags: [newTransaction.category],
    };
    
    pushActivity(activityEvent);

    // Persist transaction and activity to cache and Appwrite
    const persistDataInBackground = async () => {
      try {
        // Update transaction cache
        const currentTransactions = [newTransaction, ...transactions];
        await cacheTransactions(currentTransactions);
        
        // Update activity cache with the new activity event
        const currentActivity = await StorageManager.getCachedActivityEvents();
        const existingEvents = currentActivity?.events || [];
        const mergedActivity = StorageManager.mergeActivityEvents(existingEvents, [activityEvent]);
        await StorageManager.cacheActivityEvents(mergedActivity);
        
        // Persist to Appwrite in background
        try {
          // Check authentication state before attempting Appwrite operations
          const { isAuthenticated, user } = useAuthStore.getState();
          if (!isAuthenticated || !user) {
            console.warn('[addTransaction] User not authenticated, skipping Appwrite persistence');
            return;
          }
          
          console.log('[addTransaction] Persisting transaction to Appwrite:', newTransaction.id);
          const appwriteTransaction = await createAppwriteTransaction(newTransaction);
          console.log('[addTransaction] Transaction persisted successfully:', appwriteTransaction.id);
          
          // Update local state with Appwrite document ID if different
          if (appwriteTransaction.$id !== newTransaction.id) {
            setTransactions(prev => prev.map(tx => 
              tx.id === newTransaction.id 
                ? { ...tx, id: appwriteTransaction.$id }
                : tx
            ));
          }
          
          // Create activity event in Appwrite
          await createAppwriteActivityEvent({
            ...activityEvent,
            id: `tx.${appwriteTransaction.$id}`,
            transactionId: appwriteTransaction.$id,
          });
          
        } catch (appwriteError) {
          console.warn('[addTransaction] Failed to persist to Appwrite:', appwriteError);
          // Could implement retry logic or queue for later sync
        }
        
      } catch (error) {
        console.warn('[addTransaction] Failed to cache data:', error);
      }
    };
    
    // Cache and persist in background (don't await)
    persistDataInBackground();
    
    // Note: Transfers are already persisted via /v1/transfers endpoint in makeTransfer
    // Payments would be persisted via /v1/payments endpoint 
    // This function is mainly for local state updates and activity events
  };

const addCard: AppContextType["addCard"] = async (cardData) => {
    const newCard: Card = {
      id: Date.now().toString(),
      userId: cardData.userId,
      cardNumber: cardData.cardNumber,
      cardHolderName: cardData.cardHolderName,
      expiryDate: cardData.expiryDate,
      balance: cardData.balance ?? 0,
      cardType: cardData.cardType,
      isActive: true,
      cardColor: cardData.cardColor,
      token: cardData.token,
      currency: cardData.currency ?? 'GHS',
    };
    
    // Optimistically update local state
    setCards((prev) => [newCard, ...prev]);
    setActiveCard(newCard);

    // Activity
    const activityEvent = {
      id: `card.added.${newCard.id}`,
      category: 'card' as const,
      type: 'card.added',
      title: 'Card added',
      subtitle: `${newCard.cardHolderName} • ${newCard.cardNumber}`,
      timestamp: new Date().toISOString(),
      cardId: newCard.id,
      tags: ['card','added'],
    };
    pushActivity(activityEvent);

    // Persist to Appwrite in background
    const persistCardInBackground = async () => {
      try {
        console.log('[addCard] Persisting card to Appwrite:', newCard.id);
        const appwriteCard = await createAppwriteCard(newCard);
        console.log('[addCard] Card persisted successfully:', appwriteCard.$id);
        
        // Update local state with Appwrite document ID if different
        if (appwriteCard.$id !== newCard.id) {
          setCards(prev => prev.map(card => 
            card.id === newCard.id 
              ? { ...card, id: appwriteCard.$id }
              : card
          ));
          setActiveCard(prev => 
            prev?.id === newCard.id 
              ? { ...prev, id: appwriteCard.$id }
              : prev
          );
        }
        
        // Create activity event in Appwrite
        await createAppwriteActivityEvent({
          ...activityEvent,
          id: `card.added.${appwriteCard.$id}`,
          cardId: appwriteCard.$id,
        });
        
      } catch (error) {
        console.warn('[addCard] Failed to persist to Appwrite:', error);
        // Could implement retry logic or queue for later sync
      }
    };
    
    // Fire and forget - don't block UI
    persistCardInBackground();
  };

const removeCard: AppContextType["removeCard"] = async (cardId) => {
    const removed = cards.find(c => c.id === cardId);
    
    // Optimistically update local state
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setActiveCard((prev) => (prev?.id === cardId ? null : prev));

    // Activity
    const activityEvent = {
      id: `card.removed.${cardId}`,
      category: 'card' as const,
      type: 'card.removed',
      title: 'Card removed',
      subtitle: removed ? `${removed.cardHolderName} • ${removed.cardNumber}` : undefined,
      timestamp: new Date().toISOString(),
      cardId,
      tags: ['card','removed'],
    };
    pushActivity(activityEvent);

    // Persist removal to Appwrite in background
    const persistCardRemovalInBackground = async () => {
      try {
        console.log('[removeCard] Removing card from Appwrite:', cardId);
        await deleteAppwriteCard(cardId);
        console.log('[removeCard] Card removed successfully from Appwrite');
        
        // Create activity event in Appwrite
        await createAppwriteActivityEvent(activityEvent);
        
      } catch (error) {
        console.warn('[removeCard] Failed to remove from Appwrite:', error);
        // Could revert local state or queue for retry
        // For now, we'll keep the optimistic update
      }
    };
    
    // Fire and forget - don't block UI
    persistCardRemovalInBackground();
  };

  const updateCardBalance: AppContextType["updateCardBalance"] = async (cardId, newBalance) => {
    // Optimistically update local state
    setCards((prev) => prev.map((card) => 
      card.id === cardId ? { ...card, balance: newBalance } : card
    ));
    
    // Update active card if it's the one being updated
    setActiveCard((prev) => 
      prev?.id === cardId ? { ...prev, balance: newBalance } : prev
    );
    
    // Persist balance update to Appwrite in background
    const persistBalanceUpdateInBackground = async () => {
      try {
        console.log('[updateCardBalance] Updating card balance in Appwrite:', { cardId, newBalance });
        await updateAppwriteCardBalance(cardId, newBalance);
        console.log('[updateCardBalance] Card balance updated successfully in Appwrite');
        
        // Create activity event for balance update
        const activityEvent = {
          id: `card.balance.${cardId}.${Date.now()}`,
          category: 'card' as const,
          type: 'card.balance.updated',
          title: 'Balance updated',
          subtitle: `New balance: ${newBalance.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}`,
          timestamp: new Date().toISOString(),
          cardId,
          amount: newBalance,
          currency: 'GHS',
          tags: ['card', 'balance'],
        };
        
        pushActivity(activityEvent);
        await createAppwriteActivityEvent(activityEvent);
        
      } catch (error) {
        console.warn('[updateCardBalance] Failed to update balance in Appwrite:', error);
        // Could implement retry logic or queue for later sync
      }
    };
    
    // Fire and forget - don't block UI
    persistBalanceUpdateInBackground();
  };

  const makeTransfer: AppContextType["makeTransfer"] = async (cardId, amount, recipientCardNumber, description) => {
    console.log('[MakeTransfer] Function called with:', { 
      cardId, 
      amount, 
      recipientCardNumber: recipientCardNumber?.substring(0, 10) + '...', 
      description 
    });
    
    // Validate user session is active before initiating transfers
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated || !user) {
      console.error('[MakeTransfer] User not authenticated');
      return {
        success: false,
        error: 'User not authenticated. Please sign in again.'
      };
    }
    
    // Get source card details
    const sourceCard = cards.find(card => card.id === cardId);
    if (!sourceCard) {
      console.error('[MakeTransfer] Source card not found');
      return {
        success: false,
        error: 'Source card not found. Please try again.'
      };
    }
    
    // Check if sufficient funds
    if (sourceCard.balance < amount) {
      return {
        success: false,
        error: 'Insufficient funds for this transfer.'
      };
    }
    
    // Check if recipient is one of user's own cards (internal transfer)
    const recipientCardNumberClean = recipientCardNumber.replace(/\s/g, ''); // Remove spaces for comparison
    const recipientCard = cards.find(card => {
      const cardDigits = card.cardNumber.replace(/[^\d]/g, '');
      return cardDigits === recipientCardNumberClean;
    });
    
    // Prevent self-transfers (same card to same card)
    if (recipientCard && recipientCard.id === cardId) {
      return {
        success: false,
        error: 'Cannot transfer to the same card. Please select a different recipient.'
      };
    }
    
    // Handle internal transfer (between user's own cards) - local only
    if (recipientCard && sourceCard) {
      console.log('[MakeTransfer] Internal transfer detected - handling locally');
      
      try {
        const newSourceBalance = sourceCard.balance - amount;
        const newRecipientBalance = recipientCard.balance + amount;
        
        // Update both card balances locally
        updateCardBalance(sourceCard.id, newSourceBalance);
        updateCardBalance(recipientCard.id, newRecipientBalance);
        
        // Add outgoing transaction for source card
        addTransaction({
          cardId: sourceCard.id,
          amount: -amount, // Negative for outgoing transfer
          type: 'transfer',
          category: 'transfer',
          description: description || `Internal Transfer To: ${recipientCard.cardHolderName}`,
          recipient: `${recipientCard.cardHolderName} (${recipientCardNumber})`,
          status: 'completed'
        });
        
        // Add incoming transaction for recipient card
        addTransaction({
          cardId: recipientCard.id,
          amount: amount, // Positive for incoming transfer
          type: 'transfer',
          category: 'transfer',
          description: description || `Internal Transfer From: ${sourceCard.cardHolderName}`,
          recipient: `${sourceCard.cardHolderName} (${sourceCard.cardNumber})`,
          status: 'completed'
        });
        
        // Send notification for recipient (internal transfer)
        const { pushTransferNotification } = require('../lib/notificationService');
        pushTransferNotification('received', amount, sourceCard.cardHolderName, newRecipientBalance);
        
        console.log('[MakeTransfer] Internal transfer completed successfully');
        
        return {
          success: true,
          newBalance: newSourceBalance,
          recipientNewBalance: newRecipientBalance
        };
      } catch (error) {
        console.error('[MakeTransfer] Internal transfer error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Internal transfer failed'
        };
      }
    }
    
    // Handle external transfer (to external card/recipient)
    console.log('[MakeTransfer] Attempting external transfer');
    
    if (!sourceCard) {
      console.error('[MakeTransfer] Source card not found');
      return {
        success: false,
        error: 'Source card not found. Please try again.'
      };
    }
    
    // Check if sufficient funds
    if (sourceCard.balance < amount) {
      return {
        success: false,
        error: 'Insufficient funds for this transfer.'
      };
    }
    
    // Try server-based transfer first, fall back to local simulation
    try {
      const { getApiBase } = require('../lib/api');
      const { getValidJWTWithAutoRefresh, refreshAppwriteJWTWithRetry } = require('../lib/jwt');
      
      const apiBase = getApiBase();
      if (!apiBase || apiBase.includes('undefined') || apiBase === 'undefined') {
        console.log('[MakeTransfer] API base URL not configured, using local simulation');
        throw new Error('Server not configured');
      }
      
      const url = `${apiBase}/v1/transfers`;
      
      console.log('[MakeTransfer] API Base:', apiBase);
      
      // Use improved JWT handling with auto-refresh
      let jwt = await getValidJWTWithAutoRefresh();
      if (!jwt) {
        console.log('[MakeTransfer] No JWT available, attempting refresh with retry');
        jwt = await refreshAppwriteJWTWithRetry();
        if (!jwt) {
          console.warn('[MakeTransfer] Could not obtain JWT after retries, using local simulation');
          throw new Error('Authentication failed');
        }
      }
      console.log('[MakeTransfer] JWT obtained:', !!jwt);
      
      const requestBody = {
        cardId,
        amount,
        currency: 'GHS',
        recipient: recipientCardNumber,
        recipientName: undefined, // TODO: Extract recipient name from transfer form
        description: description || `Transfer To: ${recipientCardNumber}`
      };
      
      console.log('[MakeTransfer] Request details:', {
        url,
        cardId,
        amount,
        recipient: recipientCardNumber,
        hasJWT: !!jwt
      });
      
      const makeRequest = async (token: string | undefined) => {
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });
      };
      
      let res = await makeRequest(jwt);
      
      console.log('[MakeTransfer] Response status:', res.status);
      
      // If we get a 401, try refreshing the token once
      if (res.status === 401 && jwt) {
        console.log('[MakeTransfer] Got 401, refreshing JWT and retrying...');
        jwt = await refreshAppwriteJWT();
        if (jwt) {
          res = await makeRequest(jwt);
          console.log('[MakeTransfer] Retry response status:', res.status);
        } else {
          console.error('[MakeTransfer] Failed to refresh JWT after 401');
          return {
            success: false,
            error: 'Authentication failed. Please sign in again.'
          };
        }
      }
      
      if (res.ok) {
        // Server transfer successful
        const data = await res.json();
        const newBalance = data.newBalance;
        
        console.log('[MakeTransfer] Server transfer successful:', { newBalance });
        
        // Update local card balance
        updateCardBalance(cardId, newBalance);
        
        // Add the transaction locally
        addTransaction({
          cardId,
          amount: -amount, // Negative for outgoing transfer
          type: 'transfer',
          category: 'transfer',
          description: description || `Transfer To: ${recipientCardNumber}`,
          recipient: recipientCardNumber,
          status: 'completed'
        });
        
        return {
          success: true,
          newBalance
        };
      } else {
        // Server transfer failed, fall back to local simulation
        const responseText = await res.text().catch(() => 'Unknown error');
        console.warn('[MakeTransfer] Server transfer failed, falling back to local simulation:', {
          status: res.status,
          statusText: res.statusText,
          responseText
        });
        
        // Fall through to local simulation below
      }
    } catch (error) {
      console.warn('[MakeTransfer] Server transfer error, falling back to local simulation:', error);
      // Fall through to local simulation below
    }
    
    // Local simulation fallback
    try {
      console.log('[MakeTransfer] Using local simulation for external transfer');
      const newSourceBalance = sourceCard.balance - amount;
      
      // Update source card balance locally
      updateCardBalance(sourceCard.id, newSourceBalance);
      
      // Add outgoing transaction for source card
      addTransaction({
        cardId: sourceCard.id,
        amount: -amount, // Negative for outgoing transfer
        type: 'transfer',
        category: 'transfer',
        description: description || `External Transfer To: ${recipientCardNumber}`,
        recipient: recipientCardNumber,
        status: 'completed'
      });
      
      console.log('[MakeTransfer] External transfer simulated locally');
      
      return {
        success: true,
        newBalance: newSourceBalance
      };
    } catch (error) {
      console.error('[MakeTransfer] Local simulation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'External transfer failed'
      };
    }
  };

  // Load transactions with caching strategy
  const loadTransactionsWithCache = async (cursor?: string | null, append: boolean = false, useCache: boolean = true) => {
    setIsLoadingTransactions(true);
    try {
      console.log('[loadTransactionsWithCache] Attempting to load transactions with cache');
      const result = await fetchUserTransactionsWithCache({ 
        limit: 20, 
        cursor: cursor || undefined 
      }, useCache);
      
      if (result.success && result.data) {
        const transactionCount = result.data.transactions.length;
        const dataSource = result.data.fromCache ? '(from cache)' : '(from server)';
        
        if (transactionCount === 0) {
          console.log('[loadTransactionsWithCache] No transactions found', dataSource);
        } else {
          console.log('[loadTransactionsWithCache] Successfully loaded', transactionCount, 'transactions', dataSource);
        }
        
        if (append) {
          setTransactions(prev => {
            // Avoid duplicates when appending
            const existingIds = new Set(prev.map(tx => tx.id));
            const newTransactions = result.data.transactions.filter(tx => !existingIds.has(tx.id));
            return [...prev, ...newTransactions];
          });
        } else {
          setTransactions(result.data.transactions);
        }
        setTransactionsCursor(result.data.nextCursor || null);
        
        // Convert transactions to activity events
        const activities: ActivityEvent[] = result.data.transactions.map(tx => ({
          id: `tx.${tx.id}`,
          category: 'transaction',
          type: `transaction.${tx.type}`,
          title: tx.type === 'transfer' ? 
            tx.description : 
            `${tx.type.charAt(0).toUpperCase()}${tx.type.slice(1)}: ${tx.description}`,
          subtitle: new Date(tx.date).toLocaleString(),
          amount: tx.amount,
          currency: 'GHS',
          status: tx.status as any,
          timestamp: tx.date,
          transactionId: tx.id,
          cardId: tx.cardId,
          tags: [tx.category],
        }));
        
        if (append) {
          setActivity(prev => {
            // Avoid duplicates when appending activity
            const existingIds = new Set(prev.map(a => a.id));
            const newActivities = activities.filter(a => !existingIds.has(a.id));
            return [...prev, ...newActivities];
          });
        } else {
          setActivity(prev => {
            // Only add transaction activities, keep other activities
            const nonTxActivities = prev.filter(a => a.category !== 'transaction');
            return [...activities, ...nonTxActivities];
          });
        }
        
        // Cache the activity events as well
        if (result.data.transactions.length > 0) {
          try {
            const currentActivity = await StorageManager.getCachedActivityEvents();
            const existingEvents = currentActivity?.events || [];
            const mergedActivity = StorageManager.mergeActivityEvents(existingEvents, activities);
            await StorageManager.cacheActivityEvents(mergedActivity);
          } catch (error) {
            console.warn('[loadTransactionsWithCache] Failed to cache activity:', error);
          }
        }
      } else {
        console.warn('[loadTransactionsWithCache] Request failed:', result.error);
        // If we failed and don't have cached data, still try fallback
      }
    } catch (error) {
      console.error('[loadTransactionsWithCache] Error loading transactions:', error);
      // Keep existing local transactions on error
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Refresh transactions function
  const refreshTransactionsImpl: AppContextType['refreshTransactions'] = async () => {
    await loadTransactionsWithCache(null, false, false); // Force server refresh
  };

  // Load more transactions function
  const loadMoreTransactionsImpl: AppContextType['loadMoreTransactions'] = async () => {
    if (transactionsCursor) {
      await loadTransactionsWithCache(transactionsCursor, true, false); // Force server for pagination
    }
  };

  // Load cards when authentication is ready
  useEffect(() => {
    // Don't load cards if authentication is still loading
    if (authLoading) {
      if (__DEV__) {
        console.log('[LoadCards] Waiting for authentication to complete...');
      }
      return;
    }
    
    // Don't load cards if user is not authenticated
    if (!isAuthenticated || !user) {
      if (__DEV__) {
        console.log('[LoadCards] Skipping card load - user not authenticated');
      }
      setIsLoadingCards(false);
      return;
    }
    
    const loadCards = async () => {
      const { getApiBase } = require('../lib/api');
      const { getValidJWT, refreshAppwriteJWT } = require('../lib/jwt');
      
      setIsLoadingCards(true);
      try {
        // Try to load from Appwrite first since user is authenticated
        try {
          if (__DEV__) {
            console.log('[LoadCards] Attempting to load cards from Appwrite for user:', user.$id || user.id);
          }
          const appwriteCards = await getAppwriteActiveCards();
          if (appwriteCards.length > 0) {
            if (__DEV__) {
              console.log('[LoadCards] Loaded', appwriteCards.length, 'cards from Appwrite');
            }
            // Cards already have correct structure from getAppwriteActiveCards
            const cards = appwriteCards.map(card => ({
              id: card.id, // Already mapped correctly in getAppwriteActiveCards
              userId: card.userId,
              cardNumber: card.cardNumber,
              cardHolderName: card.cardHolderName,
              expiryDate: card.expiryDate,
              balance: card.balance,
              cardType: card.cardType,
              isActive: card.isActive,
              cardColor: card.cardColor,
              token: card.token,
              currency: card.currency || 'GHS',
            }));
            setCards(cards);
            setActiveCard(cards[0] || null);
            return; // Exit early if Appwrite load was successful
          }
        } catch (appwriteError) {
          console.warn('[LoadCards] Failed to load from Appwrite:', appwriteError);
          // Continue to API fallback
        }
        
        // Fallback to REST API
        let jwt = await getValidJWT();
        const url = `${getApiBase()}/v1/cards`;
        
        const makeRequest = async (token: string | undefined) => {
          return await fetch(url, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
        };
        
        let res = await makeRequest(jwt);
        
        // If we get a 401, try refreshing the token once
        if (res.status === 401 && jwt) {
          console.log('[LoadCards] Got 401, refreshing JWT and retrying...');
          jwt = await refreshAppwriteJWT();
          if (jwt) {
            res = await makeRequest(jwt);
          }
        }
        
        if (!res.ok) return; // no-op
        const data = await res.json();
        // Server returns { data: Card[] }
        const list = Array.isArray((data as any)?.data) ? (data as any).data : (Array.isArray(data) ? data : []);
        setCards(list as Card[]);
        setActiveCard((list as Card[])[0] || null);
      } catch (error) {
        console.warn('[LoadCards] Failed to load cards:', error);
      } finally {
        setIsLoadingCards(false);
      }
    };
    
    loadCards();
  }, [authLoading, isAuthenticated, user]);
  
  // Load transactions on initial mount with cache-first strategy
  useEffect(() => {
    loadTransactionsWithCache();
  }, []);

  // Load notifications from storage first, then fetch from Appwrite
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('notifications');
        if (raw) {
          const parsed: Notification[] = JSON.parse(raw);
          setNotifications(parsed);
        }
      } catch {}
    })();
  }, []);

  // Initial load of notifications (if configured)
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const dbId = appwriteConfig.databaseId;
        const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
        if (!dbId || !notifCol) return;
        const resp: any = await databases.listDocuments(dbId, notifCol);
        const docs = Array.isArray(resp?.documents) ? resp.documents : [];
        const fetched: Notification[] = docs.map((d: any) => ({
          id: d.$id,
          userId: d.userId,
          title: d.title,
          message: d.message,
          type: d.type,
          unread: d.unread,
          createdAt: d.$createdAt || d.createdAt,
        }));
        // Merge with any local notifications (prefer fetched)
        setNotifications(prev => {
          const map = new Map<string, Notification>();
          for (const n of prev) map.set(n.id, n);
          for (const n of fetched) map.set(n.id, n);
          const merged = Array.from(map.values());
          merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          return merged;
        });
      } catch {}
    };
    loadNotifications();
  }, []);

  // Persist notifications to storage
  useEffect(() => {
    AsyncStorage.setItem('notifications', JSON.stringify(notifications)).catch(() => {});
  }, [notifications]);

  // Appwrite Realtime subscription
  useEffect(() => {
    const dbId = appwriteConfig.databaseId;
    const txCol = appwriteConfig.transactionsCollectionId;
    const cardCol = appwriteConfig.cardsCollectionId;
    const acctCol = appwriteConfig.accountUpdatesCollectionId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;

    const channels: string[] = [];
    if (dbId && txCol) channels.push(`databases.${dbId}.collections.${txCol}.documents`);
    if (dbId && cardCol) channels.push(`databases.${dbId}.collections.${cardCol}.documents`);
    if (dbId && acctCol) channels.push(`databases.${dbId}.collections.${acctCol}.documents`);
    if (dbId && notifCol) channels.push(`databases.${dbId}.collections.${notifCol}.documents`);

    if (channels.length === 0) return;

    const unsub = client.subscribe(channels, (message: any) => {
      try {
        const { events, payload } = message as { events: string[]; payload: any };
        const eventStr = events?.[0] || '';
        const ts = new Date().toISOString();

        // Notifications: handle separately
        if (notifCol && eventStr.includes(`collections.${notifCol}.`)) {
          const n: Notification = {
            id: payload?.$id || `rt.${Date.now()}`,
            userId: payload?.userId,
            title: payload?.title || 'Notification',
            message: payload?.message || '',
            type: payload?.type,
            unread: typeof payload?.unread === 'boolean' ? payload.unread : true,
            createdAt: payload?.$createdAt || ts,
          };
          setNotifications((prev) => [n, ...prev]);
          return;
        }

        // Determine category by collection in event string (for activity timeline)
        let category: ActivityEvent['category'] = 'account';
        if (txCol && eventStr.includes(`collections.${txCol}.`)) category = 'transaction';
        else if (cardCol && eventStr.includes(`collections.${cardCol}.`)) category = 'card';
        else category = 'account';

        // Map to ActivityEvent
        const evt: ActivityEvent = {
          id: payload?.$id ? `rt.${payload.$id}` : `rt.${Date.now()}`,
          category,
          type: eventStr.split('.documents.')[1] ? `realtime.${eventStr.split('.documents.')[1]}` : 'realtime.update',
          title:
            category === 'transaction'
              ? `Transaction ${payload?.type || ''}`.trim()
              : category === 'card'
              ? `Card update`
              : `Account update`,
          subtitle: payload?.description || payload?.title || undefined,
          amount: typeof payload?.amount === 'number' ? payload.amount : undefined,
          currency: payload?.currency,
          status: payload?.status,
          timestamp: payload?.$updatedAt || payload?.$createdAt || ts,
          accountId: payload?.accountId,
          cardId: payload?.cardId,
          transactionId: payload?.transactionId || payload?.$id,
          tags: payload?.category ? [payload.category] : undefined,
        };
        pushActivity(evt);
      } catch (e) {
        // Swallow mapping errors
      }
    });

    return () => {
      try { unsub(); } catch {}
    };
  }, []);

  const markNotificationRead: AppContextType['markNotificationRead'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    
    // Optimistic update (always perform for local state)
    setNotifications(cur => cur.map(n => (n.id === id ? { ...n, unread: false } : n)));
    
    // Only try database update if configured
    if (!dbId || !notifCol) {
      console.log('[markNotificationRead] Database not configured, using local-only mode');
      return;
    }
    
    try {
      await databases.updateDocument(dbId, notifCol, id, { unread: false });
      console.log(`[markNotificationRead] Successfully marked notification ${id} as read`);
    } catch (e) {
      console.warn(`[markNotificationRead] Failed to update notification ${id} in database:`, e);
      // Don't roll back - this notification might be local-only
    }
  };

  const deleteNotification: AppContextType['deleteNotification'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    
    // Optimistic update (always perform for local state)
    let prev: Notification[] | null = null;
    setNotifications(cur => {
      prev = cur;
      return cur.filter(n => n.id !== id);
    });
    
    // Only try database update if configured
    if (!dbId || !notifCol) return;
    
    try {
      await databases.deleteDocument(dbId, notifCol, id);
    } catch (e) {
      // Revert on failure
      if (prev) setNotifications(prev);
    }
  };

  const markAllNotificationsRead: AppContextType['markAllNotificationsRead'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    const unread = notifications.filter(n => n.unread);
    if (unread.length === 0) {
      console.log('[markAllNotificationsRead] No unread notifications to mark');
      return;
    }
    
    console.log(`[markAllNotificationsRead] Marking ${unread.length} notifications as read`);
    console.log('[markAllNotificationsRead] Current notifications:', notifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Store the original state for potential partial rollback
    const originalNotifications = notifications;
    
    // Create completely new notification objects to ensure React detects the change
    const updatedNotifications = notifications.map(n => ({
      ...n,
      unread: false // Mark ALL as read, not just the unread ones
    }));
    
    console.log('[markAllNotificationsRead] Updated notifications:', updatedNotifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Force immediate state update with completely new array
    setNotifications(updatedNotifications);
    
    console.log('[markAllNotificationsRead] State updated, unread indicators should be hidden immediately');
    
    // Only try database update if configured
    if (!dbId || !notifCol) {
      console.log('[markAllNotificationsRead] Database not configured, using local-only mode');
      return;
    }
    
    // Enhanced batch processing with retry logic and partial failure handling
    const batchSize = 10; // Process notifications in batches to avoid overwhelming the server
    const maxRetries = 2;
    let successfulUpdates = 0;
    let failedUpdates = 0;
    const failedIds: string[] = [];
    
    // Helper function to retry failed operations
    const retryFailedUpdate = async (notificationId: string, retryCount: number): Promise<boolean> => {
      if (retryCount >= maxRetries) return false;
      
      try {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // Exponential backoff
        await databases.updateDocument(dbId, notifCol, notificationId, { unread: false });
        return true;
      } catch (e) {
        console.warn(`[markAllNotificationsRead] Retry ${retryCount + 1}/${maxRetries} failed for notification ${notificationId}:`, e);
        return retryFailedUpdate(notificationId, retryCount + 1);
      }
    };
    
    // Process notifications in batches
    for (let i = 0; i < unread.length; i += batchSize) {
      const batch = unread.slice(i, i + batchSize);
      
      // Process batch concurrently but with a limit
      const batchPromises = batch.map(async (notification) => {
        try {
          await databases.updateDocument(dbId, notifCol, notification.id, { unread: false });
          return { id: notification.id, success: true };
        } catch (e) {
          console.warn(`[markAllNotificationsRead] Initial attempt failed for notification ${notification.id}:`, e);
          return { id: notification.id, success: false, error: e };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Handle batch results
      for (const result of batchResults) {
        if (result.success) {
          successfulUpdates++;
        } else {
          // Attempt retry for failed notifications
          const retrySuccess = await retryFailedUpdate(result.id, 0);
          if (retrySuccess) {
            successfulUpdates++;
          } else {
            failedUpdates++;
            failedIds.push(result.id);
          }
        }
      }
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < unread.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[markAllNotificationsRead] Database update completed: ${successfulUpdates} successful, ${failedUpdates} failed`);
    
    // Enhanced error handling with partial rollback for persistent failures
    if (failedUpdates > 0) {
      console.warn(`[markAllNotificationsRead] ${failedUpdates} notifications failed to update after retries:`, failedIds);
      
      // Determine the severity of the failure
      const failureRate = failedUpdates / unread.length;
      
      if (failureRate >= 0.8) {
        // If 80% or more failed, likely a connection/server issue - keep optimistic update
        console.error('[markAllNotificationsRead] High failure rate detected - likely connection issue. Keeping optimistic update.');
      } else if (failureRate >= 0.3) {
        // If 30-79% failed, partial server issue - revert failed notifications only
        console.warn('[markAllNotificationsRead] Moderate failure rate - reverting failed notifications to unread state.');
        setNotifications(current => 
          current.map(n => 
            failedIds.includes(n.id) ? { ...n, unread: true } : n
          )
        );
      } else {
        // Less than 30% failed - likely individual notification issues, keep optimistic update
        console.info('[markAllNotificationsRead] Low failure rate - keeping optimistic update for UX.');
      }
    }
    
    // Log final status
    if (successfulUpdates > 0) {
      console.log(`[markAllNotificationsRead] Successfully synchronized ${successfulUpdates}/${unread.length} notifications to database`);
    }
  };

  const deleteAllReadNotifications: AppContextType['deleteAllReadNotifications'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) return;
    const toDelete = notifications.filter(n => !n.unread).map(n => n.id);
    if (toDelete.length === 0) return;
    const prev = notifications;
    // Optimistic: remove read items
    setNotifications(cur => cur.filter(n => n.unread));
    try {
      for (const id of toDelete) {
        // eslint-disable-next-line no-await-in-loop
        await databases.deleteDocument(dbId, notifCol, id);
      }
    } catch (e) {
      setNotifications(prev);
    }
  };

  const toggleNotificationRead: AppContextType['toggleNotificationRead'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    
    // Optimistic update (always perform for local state)
    let nextUnread = true;
    setNotifications(cur => {
      const updated = cur.map(n => {
        if (n.id === id) {
          nextUnread = !n.unread;
          return { ...n, unread: !n.unread };
        }
        return n;
      });
      return updated;
    });
    
    // Only try database update if configured
    if (!dbId || !notifCol) {
      console.log('[toggleNotificationRead] Database not configured, using local-only mode');
      return;
    }
    
    try {
      await databases.updateDocument(dbId, notifCol, id, { unread: nextUnread });
      console.log(`[toggleNotificationRead] Successfully toggled notification ${id} to ${nextUnread ? 'unread' : 'read'}`);
    } catch (e) {
      console.warn(`[toggleNotificationRead] Failed to update notification ${id} in database:`, e);
      // Don't roll back - this notification might be local-only
    }
  };

  const markAllNotificationsUnread: AppContextType['markAllNotificationsUnread'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    const readNotifications = notifications.filter(n => !n.unread);
    if (readNotifications.length === 0) {
      console.log('[markAllNotificationsUnread] No read notifications to mark as unread');
      return;
    }
    
    console.log(`[markAllNotificationsUnread] Marking ${readNotifications.length} notifications as unread`);
    console.log('[markAllNotificationsUnread] Current notifications:', notifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Create completely new notification objects to ensure React detects the change
    const updatedNotifications = notifications.map(n => ({
      ...n,
      unread: true // Mark ALL as unread
    }));
    
    console.log('[markAllNotificationsUnread] Updated notifications:', updatedNotifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Force immediate state update with completely new array
    setNotifications(updatedNotifications);
    
    console.log('[markAllNotificationsUnread] State updated, all notifications should show as unread immediately');
    
    // Only try database update if configured
    if (!dbId || !notifCol) {
      console.log('[markAllNotificationsUnread] Database not configured, using local-only mode');
      return;
    }
    
    // Try to update database, but don't roll back if it fails (notifications might be local-only)
    let successfulUpdates = 0;
    let failedUpdates = 0;
    
    for (const notification of readNotifications) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await databases.updateDocument(dbId, notifCol, notification.id, { unread: true });
        successfulUpdates++;
      } catch (e) {
        failedUpdates++;
        console.warn(`[markAllNotificationsUnread] Failed to update notification ${notification.id} in database:`, e);
        // Don't roll back - this notification might be local-only
      }
    }
    
    console.log(`[markAllNotificationsUnread] Database update completed: ${successfulUpdates} successful, ${failedUpdates} failed`);
    
    // Only show error if ALL updates failed (suggesting a connection issue)
    if (successfulUpdates === 0 && failedUpdates > 0) {
      console.warn('[markAllNotificationsUnread] All database updates failed - this might indicate a connection issue');
    }
  };

  const clearAllNotifications: AppContextType['clearAllNotifications'] = async () => {
    // Optimistic update (always clear local state first)
    const prev = notifications;
    setNotifications([]);
    
    // Try server clear if API is available, but don't fail if it's not
    try {
      const { getApiBase } = require('../lib/api');
      const { getValidJWT, refreshAppwriteJWT } = require('../lib/jwt');
      const url = `${getApiBase()}/v1/notifications/clear`;
      
      let jwt = await getValidJWT();
      
      const makeRequest = async (token: string | undefined) => {
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return await fetch(url, { method: 'POST', headers });
      };
      
      let res = await makeRequest(jwt);
      
      // If we get a 401, try refreshing the token once
      if (res.status === 401 && jwt) {
        console.log('[ClearNotifications] Got 401, refreshing JWT and retrying...');
        jwt = await refreshAppwriteJWT();
        if (jwt) {
          res = await makeRequest(jwt);
        }
      }
      
      if (!res.ok) {
        console.warn('Failed to clear notifications (server), but local state has been cleared');
      }
    } catch (e) {
      console.warn('clearAllNotifications server error (local state cleared):', e);
    }
  };

  const archiveNotification: AppContextType['archiveNotification'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) {
      // For local-only operation, just update the local state
      setNotifications(cur => cur.map(n => (n.id === id ? { ...n, archived: true } : n)));
      return;
    }
    // Optimistic update
    let prev: Notification[] | null = null;
    setNotifications(cur => {
      prev = cur;
      return cur.map(n => (n.id === id ? { ...n, archived: true } : n));
    });
    try {
      await databases.updateDocument(dbId, notifCol, id, { archived: true });
    } catch (e) {
      // Revert on failure
      if (prev) setNotifications(prev);
    }
  };

  const unarchiveNotification: AppContextType['unarchiveNotification'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    if (!dbId || !notifCol) {
      // For local-only operation, just update the local state
      setNotifications(cur => cur.map(n => (n.id === id ? { ...n, archived: false } : n)));
      return;
    }
    // Optimistic update
    let prev: Notification[] | null = null;
    setNotifications(cur => {
      prev = cur;
      return cur.map(n => (n.id === id ? { ...n, archived: false } : n));
    });
    try {
      await databases.updateDocument(dbId, notifCol, id, { archived: false });
    } catch (e) {
      // Revert on failure
      if (prev) setNotifications(prev);
    }
  };

  const toggleNotificationArchive: AppContextType['toggleNotificationArchive'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    let prev: Notification[] | null = null;
    let nextArchived = false;
    
    setNotifications(cur => {
      prev = cur;
      const updated = cur.map(n => {
        if (n.id === id) {
          nextArchived = !n.archived;
          return { ...n, archived: !n.archived };
        }
        return n;
      });
      return updated;
    });
    
    if (!dbId || !notifCol) {
      // For local-only operation, the state update above is sufficient
      return;
    }
    
    try {
      await databases.updateDocument(dbId, notifCol, id, { archived: nextArchived });
    } catch (e) {
      // Revert on failure
      if (prev) setNotifications(prev);
    }
  };

  const archiveAllReadNotifications: AppContextType['archiveAllReadNotifications'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    const toArchive = notifications.filter(n => !n.unread && !n.archived).map(n => n.id);
    if (toArchive.length === 0) return;
    
    const prev = notifications;
    // Optimistic: mark read items as archived
    setNotifications(cur => cur.map(n => 
      (!n.unread && !n.archived) ? { ...n, archived: true } : n
    ));
    
    if (!dbId || !notifCol) {
      // For local-only operation, the optimistic update above is sufficient
      return;
    }
    
    try {
      for (const id of toArchive) {
        // eslint-disable-next-line no-await-in-loop
        await databases.updateDocument(dbId, notifCol, id, { archived: true });
      }
    } catch (e) {
      setNotifications(prev);
    }
  };

  const clearAllTransactions: AppContextType['clearAllTransactions'] = async () => {
    // Clear local state
    setTransactions([]);
    setTransactionsCursor(null);
    
    // Clear transaction-related activity events
    setActivity(prev => prev.filter(a => a.category !== 'transaction'));
    
    try {
      // Clear cached transactions
      await StorageManager.clearTransactionCache();
      
      // Clear cached activity events (transaction-related)
      const currentActivity = await StorageManager.getCachedActivityEvents();
      if (currentActivity) {
        const nonTransactionEvents = currentActivity.events.filter(evt => evt.category !== 'transaction');
        await StorageManager.cacheActivityEvents({ 
          ...currentActivity,
          events: nonTransactionEvents 
        });
      }
      
      console.log('[clearAllTransactions] Transaction data cleared successfully');
    } catch (error) {
      console.warn('[clearAllTransactions] Failed to clear cached data:', error);
    }
    
    // Note: We don't delete transactions from Appwrite server as this would be destructive
    // The user can refresh to reload transactions from server if needed
  };

  const clearAllActivity: AppContextType['clearAllActivity'] = async () => {
    // Clear local activity state
    setActivity([]);
    
    try {
      // Clear cached activity events
      await StorageManager.clearActivityCache();
      
      console.log('[clearAllActivity] Activity data cleared successfully');
    } catch (error) {
      console.warn('[clearAllActivity] Failed to clear cached activity:', error);
    }
    
    // Note: We don't delete activity from Appwrite server as this would be destructive
    // The user can refresh to reload activity from server if needed
  };

  return (
    <AppContext.Provider
      value={{
        cards,
        transactions,
        activeCard,
        setActiveCard,
        addCard,
        removeCard,
        addTransaction,
        updateCardBalance,
        makeTransfer,
        isLoadingCards,
        isLoadingTransactions,
        refreshTransactions: refreshTransactionsImpl,
        loadMoreTransactions: loadMoreTransactionsImpl,
        clearAllTransactions,
        activity,
        pushActivity,
        setActivity,
        clearAllActivity,
        notifications,
        setNotifications,
        markNotificationRead,
        deleteNotification,
        markAllNotificationsRead,
        deleteAllReadNotifications,
        toggleNotificationRead,
        markAllNotificationsUnread,
        clearAllNotifications,
        archiveNotification,
        unarchiveNotification,
        toggleNotificationArchive,
        archiveAllReadNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
