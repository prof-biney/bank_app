import React, { createContext, ReactNode, useContext, useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Transaction } from "@/constants/index";
import type { Notification } from "@/types";
import { ActivityEvent } from "@/types/activity";
import { appwriteConfig, databases, AppwriteQuery as Query } from "@/lib/appwrite/config";
import { 
  queryTransactions as queryAppwriteTransactions
} from "@/lib/appwrite/transactionService";
import { StorageManager } from "@/lib/storageService";
import { initNotificationService } from "@/lib/appwrite/notificationService";
import { logger } from "@/lib/logger";

// Appwrite database services
import {
  createTransaction as createAppwriteTransaction,
  updateTransaction as updateAppwriteTransaction,
  deleteTransaction as deleteAppwriteTransaction,
  UpdateTransactionData
} from "@/lib/appwrite/transactionService";
import {
  createCard as createAppwriteCard,
  updateCardBalance as updateAppwriteCardBalance,
  deleteCard as deleteAppwriteCard,
  getActiveCards as getAppwriteActiveCards,
  findCardByNumber as findAppwriteCardByNumber
} from "@/lib/appwrite/cardService";
import {
  createAppwriteActivityEvent
} from "@/lib/appwrite/activityService";
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
  makeDeposit: (params: { cardId?: string; amount?: number; currency?: string; escrowMethod?: string; description?: string; depositId?: string; action?: string; mobileNetwork?: string; mobileNumber?: string; reference?: string }) => Promise<{ success: boolean; error?: string; data?: any }>;
  makeTransaction: (params: { type: 'withdrawal' | 'deposit' | 'transfer' | 'payment'; amount: number; fromCardId?: string; toCardId?: string; description?: string; fee?: number }) => Promise<{ success: boolean; error?: string }>;
  refreshCardBalances: () => Promise<void>;
  isLoadingCards: boolean;
  isLoadingTransactions: boolean;
  refreshTransactions: () => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  clearAllTransactions: () => Promise<void>;
  updateTransaction: (id: string, updateData: UpdateTransactionData) => Promise<{ success: boolean; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;
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
  // Transaction approvals
  handleApprovalStatusChange: (approvalId: string, approved: boolean, transactionId?: string) => Promise<void>;
  refreshPendingApprovals: () => Promise<void>;
  pendingApprovalsCount: number;
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
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  
  // Get auth state reactively
  const { isAuthenticated, isLoading: authLoading, user } = useAuthStore();
  
  // Function to refresh card balances from database with smart balance calculation
  const refreshCardBalances = async () => {
    try {
      if (!isAuthenticated || !user) {
        logger.info('CONTEXT', '[refreshCardBalances] User not authenticated, skipping refresh');
        return;
      }
      
      logger.info('CONTEXT', '[refreshCardBalances] Refreshing card balances from database with smart calculation');
      
      // Get fresh cards from database - this will trigger smart balance calculation
      const freshCards = await getAppwriteActiveCards();
      
      // If we have fresh cards, trigger smart balance recalculation for each
      if (freshCards.length > 0) {
        logger.info('CONTEXT', '[refreshCardBalances] Triggering smart balance recalculation for all cards');
        
        // Import card service to recalculate balances
        try {
          const { recalculateAndUpdateCardBalance } = await import('@/lib/appwrite/cardService');
          
          // Recalculate balance for each card in parallel
          const updatedCards = await Promise.all(
            freshCards.map(async (card) => {
              try {
                const updatedCard = await recalculateAndUpdateCardBalance(card.id);
                logger.info('CONTEXT', `[refreshCardBalances] Smart balance calculated for card ${card.id}`, {
                  oldBalance: card.balance,
                  newBalance: updatedCard.balance
                });
                return updatedCard;
              } catch (error) {
                logger.warn('CONTEXT', `[refreshCardBalances] Failed to recalculate balance for card ${card.id}`, error);
                // Fall back to original card data if recalculation fails
                return card;
              }
            })
          );
          
          // Update cards with smart balance calculated values
          setCards(prevCards => {
            const updatedCardsMap = updatedCards.map(updatedCard => {
              const prevCard = prevCards.find(p => p.id === updatedCard.id);
              if (prevCard) {
                // Update balance and any other fields that might have changed
                return {
                  ...prevCard,
                  balance: updatedCard.balance, // Smart calculated balance
                  isActive: updatedCard.isActive,
                };
              }
              return updatedCard;
            });
            
            // Add any new cards that might have been created elsewhere
            const existingIds = new Set(prevCards.map(c => c.id));
            const newCards = updatedCards.filter(c => !existingIds.has(c.id));
            
            return [...updatedCardsMap, ...newCards];
          });
          
          // Update active card if it's in the refreshed list
          setActiveCard(prevActive => {
            if (prevActive) {
              const freshActiveCard = updatedCards.find(c => c.id === prevActive.id);
              return freshActiveCard ? { ...prevActive, balance: freshActiveCard.balance } : prevActive;
            }
            return prevActive;
          });
          
          logger.info('CONTEXT', '[refreshCardBalances] Card balances refreshed successfully with smart calculation', 
            updatedCards.map(c => ({ id: c.id, balance: c.balance }))
          );
          
        } catch (importError) {
          logger.warn('CONTEXT', '[refreshCardBalances] Failed to import card service, using fresh cards without smart calculation', importError);
          
          // Fallback to original logic if smart balance calculation fails
          setCards(prevCards => {
            const updatedCards = prevCards.map(prevCard => {
              const freshCard = freshCards.find(f => f.id === prevCard.id);
              if (freshCard) {
                return {
                  ...prevCard,
                  balance: freshCard.balance,
                  isActive: freshCard.isActive,
                };
              }
              return prevCard;
            });
            
            const existingIds = new Set(prevCards.map(c => c.id));
            const newCards = freshCards.filter(f => !existingIds.has(f.id));
            
            return [...updatedCards, ...newCards];
          });
          
          setActiveCard(prevActive => {
            if (prevActive) {
              const freshActiveCard = freshCards.find(f => f.id === prevActive.id);
              return freshActiveCard ? { ...prevActive, balance: freshActiveCard.balance } : prevActive;
            }
            return prevActive;
          });
        }
      }
    } catch (error) {
      logger.warn('CONTEXT', '[refreshCardBalances] Failed to refresh card balances:', error);
    }
  };

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
        // Note: cacheTransactions was removed - transactions are now cached via Appwrite
        
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
            logger.auth.warn('[addTransaction] User not authenticated, skipping Appwrite persistence');
            return;
          }
          
          logger.database.info('[addTransaction] Persisting transaction to Appwrite:', newTransaction.id);
          const appwriteTransaction = await createAppwriteTransaction(newTransaction);
          logger.database.info('[addTransaction] Transaction persisted successfully:', appwriteTransaction.id);
          
          // Update local state with Appwrite document ID if different
          if (appwriteTransaction.id !== newTransaction.id) {
            setTransactions(prev => prev.map(tx => 
              tx.id === newTransaction.id 
                ? { ...tx, id: appwriteTransaction.id }
                : tx
            ));
          }
          
          // Create activity event in Appwrite
          await createAppwriteActivityEvent({
            ...activityEvent,
            id: `tx.${appwriteTransaction.id}`,
            transactionId: appwriteTransaction.id,
          });
          
          // Track analytics for this transaction
          const { trackTransactionAnalytics } = await import('@/lib/analyticsHelpers');
          trackTransactionAnalytics(newTransaction, user.$id || user.id || '');
          
        } catch (appwriteError) {
          logger.database.warn('[addTransaction] Failed to persist to Appwrite:', appwriteError);
          // Could implement retry logic or queue for later sync
        }
        
      } catch (error) {
        logger.error('STORAGE', '[addTransaction] Failed to cache data:', error);
      }
    };
    
    // Cache and persist in background (don't await)
    persistDataInBackground();
    
    // Note: Transfers are already persisted via /v1/transfers endpoint in makeTransfer
    // Payments would be persisted via /v1/payments endpoint 
    // This function is mainly for local state updates and activity events
  };

const addCard: AppContextType["addCard"] = async (cardData) => {
    logger.info('CARDS', 'Adding card to local state and Appwrite', {
      hasToken: Boolean(cardData.token),
      cardHolderName: cardData.cardHolderName,
      last4: cardData.cardNumber.slice(-4)
    });

    // Check for potential duplicate by card number (last 4 digits) and name
    const last4 = cardData.cardNumber.replace(/\D/g, '').slice(-4);
    const existingCard = cards.find(card => {
      const cardLast4 = card.cardNumber.replace(/[^\d]/g, '').slice(-4);
      return cardLast4 === last4 && 
             card.cardHolderName.toLowerCase().trim() === cardData.cardHolderName.toLowerCase().trim();
    });
    
    if (existingCard) {
      logger.warn('CARDS', 'Duplicate card detected in local state', {
        existingCardId: existingCard.id,
        newCardLast4: last4,
        holderName: cardData.cardHolderName
      });
      throw new Error(`Card ending in ${last4} for ${cardData.cardHolderName} already exists.`);
    }

    // Generate a unique temporary ID for optimistic updates
    const tempId = `temp_${last4}_${cardData.cardHolderName.replace(/\s+/g, '_')}_${Date.now()}`;
    const newCard: Card = {
      id: tempId,
      userId: cardData.userId,
      cardNumber: cardData.cardNumber,
      cardHolderName: cardData.cardHolderName,
      expiryDate: cardData.expiryDate,
      balance: cardData.balance ?? 0,
      cardType: cardData.cardType,
      isActive: true,
      cardColor: cardData.cardColor || '#1D4ED8',
      token: cardData.token,
      currency: cardData.currency ?? 'GHS',
    };
    
    // Optimistically add to local state
    setCards((prev) => {
      // Double-check for duplicates in current state
      const isDuplicate = prev.some(card => {
        const existingLast4 = card.cardNumber.replace(/[^\d]/g, '').slice(-4);
        return existingLast4 === last4 && 
               card.cardHolderName.toLowerCase().trim() === cardData.cardHolderName.toLowerCase().trim();
      });
      
      if (isDuplicate) {
        logger.warn('CARDS', 'Duplicate found during state update, skipping');
        return prev;
      }
      
      return [newCard, ...prev];
    });
    
    setActiveCard(newCard);

    // Create activity event
    const activityEvent = {
      id: `card.added.${tempId}`,
      category: 'card' as const,
      type: 'card.added',
      title: 'New card added',
      subtitle: `${newCard.cardHolderName} • ****${last4}`,
      description: `Card ${newCard.cardHolderName} ending in ${last4} was added to your account`,
      timestamp: new Date().toISOString(),
      cardId: tempId,
      tags: ['card','added'],
    };
    pushActivity(activityEvent);

    // Persist to Appwrite database
    try {
      logger.info('CARDS', 'Persisting card to Appwrite database', { 
        tempId, 
        hasToken: Boolean(newCard.token) 
      });
      
      const appwriteCard = await createAppwriteCard(newCard);
      logger.info('CARDS', 'Card persisted to Appwrite successfully', { 
        appwriteCardId: appwriteCard.id,
        hasToken: Boolean(appwriteCard.token)
      });
      
      // Replace temporary card with the real Appwrite card data
      setCards(prev => prev.map(card => 
        card.id === tempId 
          ? { ...appwriteCard } // Use complete card data from Appwrite
          : card
      ));
      
      // Update active card if it was the temporary one
      setActiveCard(prev => 
        prev?.id === tempId 
          ? { ...appwriteCard }
          : prev
      );
      
      // Create activity event in Appwrite with real card ID
      await createAppwriteActivityEvent({
        ...activityEvent,
        id: `card.added.${appwriteCard.id}`,
        cardId: appwriteCard.id,
      });
      
      logger.info('CARDS', 'Card creation completed successfully', {
        tempId,
        finalId: appwriteCard.id,
        holderName: appwriteCard.cardHolderName
      });
      
    } catch (error) {
      logger.error('CARDS', 'Failed to persist card to Appwrite', {
        tempId,
        error: error instanceof Error ? error.message : error
      });
      
      // Remove the temporary card on failure
      setCards(prev => prev.filter(card => card.id !== tempId));
      if (activeCard?.id === tempId) {
        setActiveCard(null);
      }
      
      // Re-throw error to be handled by calling code
      throw error;
    }
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
      description: removed ? `Card ${removed.cardHolderName} was removed from your account` : 'A card was removed from your account',
      timestamp: new Date().toISOString(),
      cardId,
      tags: ['card','removed'],
    };
    pushActivity(activityEvent);

    // Persist removal to Appwrite in background
    const persistCardRemovalInBackground = async () => {
      try {
        logger.info('CARDS', 'Removing card from Appwrite', { cardId });
        await deleteAppwriteCard(cardId);
        logger.info('CARDS', 'Card removed successfully from Appwrite');
        
        // Create activity event in Appwrite
        await createAppwriteActivityEvent(activityEvent);
        
      } catch (error) {
        logger.warn('CARDS', 'Failed to remove from Appwrite', error);
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
        logger.info('CARDS', 'Updating card balance in Appwrite', { cardId, newBalance });
        await updateAppwriteCardBalance(cardId, newBalance);
        logger.info('CARDS', 'Card balance updated successfully in Appwrite');
        
        // Create activity event for balance update
        const activityEvent = {
          id: `card.balance.${cardId}.${Date.now()}`,
          category: 'card' as const,
          type: 'card.balance.updated',
          title: 'Balance updated',
          subtitle: `New balance: ${newBalance.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}`,
          description: `Card balance was updated to ${newBalance.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}`,
          timestamp: new Date().toISOString(),
          cardId,
          amount: newBalance,
          currency: 'GHS',
          tags: ['card', 'balance'],
        };
        
        pushActivity(activityEvent);
        await createAppwriteActivityEvent(activityEvent);
        
      } catch (error) {
        logger.warn('CARDS', 'Failed to update balance in Appwrite', error);
        // Could implement retry logic or queue for later sync
      }
    };
    
    // Fire and forget - don't block UI
    persistBalanceUpdateInBackground();
  };

  const makeTransfer: AppContextType["makeTransfer"] = async (cardId, amount, recipientCardNumber, description) => {
    logger.info('TRANSFERS', 'Function called', { 
      cardId, 
      amount, 
      recipientCardNumber: recipientCardNumber?.substring(0, 10) + '...', 
      description 
    });
    
    // Validate user session is active before initiating transfers
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated || !user) {
      logger.error('TRANSFERS', 'User not authenticated');
      return {
        success: false,
        error: 'User not authenticated. Please sign in again.'
      };
    }
    
    // Get source card details
    const sourceCard = cards.find(card => card.id === cardId);
    if (!sourceCard) {
      logger.error('TRANSFERS', 'Source card not found');
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
    // Use last4 matching since cards are stored with masked numbers
    const recipientCardNumberClean = recipientCardNumber.replace(/\s/g, ''); // Remove spaces for comparison
    const recipientLast4 = recipientCardNumberClean.slice(-4); // Get last 4 digits
    
    const recipientCard = cards.find(card => {
      const cardLast4 = card.cardNumber.replace(/[^\d]/g, '').slice(-4);
      return cardLast4 === recipientLast4;
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
      logger.info('TRANSFERS', 'Internal transfer detected - handling locally');
      
      try {
        const newSourceBalance = sourceCard.balance - amount;
        const newRecipientBalance = recipientCard.balance + amount;
        
        // Update both card balances locally
        updateCardBalance(sourceCard.id, newSourceBalance);
        updateCardBalance(recipientCard.id, newRecipientBalance);
        
        // Add outgoing transaction for source card
        addTransaction({
          userId: user.$id || user.id || '',
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
          userId: user.$id || user.id || '',
          cardId: recipientCard.id,
          amount: amount, // Positive for incoming transfer
          type: 'transfer',
          category: 'transfer',
          description: description || `Internal Transfer From: ${sourceCard.cardHolderName}`,
          recipient: `${sourceCard.cardHolderName} (${sourceCard.cardNumber})`,
          status: 'completed'
        });
        
        // Send notification for recipient (internal transfer)
        const { pushTransferNotification } = require('../lib/appwrite/notificationService');
        pushTransferNotification('received', amount, sourceCard.cardHolderName, newRecipientBalance);
        
        // Refresh card balances from database after successful transfer
        setTimeout(() => refreshCardBalances(), 1000); // Small delay to ensure DB updates are complete
        
        logger.info('TRANSFERS', 'Internal transfer completed successfully');
        
        return {
          success: true,
          newBalance: newSourceBalance,
          recipientNewBalance: newRecipientBalance
        };
      } catch (error) {
        logger.error('TRANSFERS', 'Internal transfer error', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Internal transfer failed'
        };
      }
    }
    
    // Handle external transfer (to external card/recipient)
    logger.info('TRANSFERS', 'Attempting external transfer');
    
    if (!sourceCard) {
      logger.error('TRANSFERS', 'Source card not found');
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
    
    // Try Appwrite function first, fall back to local simulation
    try {
      const { executeFunction } = require('../lib/api');
      
      logger.info('TRANSFERS', 'Using Appwrite function for external transfer');
      
      const requestData = {
        cardId,
        amount,
        currency: 'GHS',
        recipient: recipientCardNumber,
        recipientName: undefined, // TODO: Extract recipient name from transfer form
        description: description || `Transfer To: ${recipientCardNumber}`
      };
      
      logger.info('TRANSFERS', 'Request details', {
        cardId,
        amount,
        recipient: recipientCardNumber
      });
      
      // Execute Appwrite function for transfer
      const result = await executeFunction('transfers', requestData);
      
      logger.info('TRANSFERS', 'Function result:', result);
      
      if (result.success) {
        // Server transfer successful
        const data = result.data;
        const newBalance = data.newBalance;
        
        logger.info('TRANSFERS', 'Server transfer successful', { newBalance });
        
        // Create approval request for external transfers
        const { createApprovalRequest, autoApprove } = await import('@/lib/appwrite/transactionApprovalService');
        
        // For large external transfers, require approval; for smaller amounts, auto-approve
        const requiresApproval = amount > 1000; // Amounts over 1000 GHS require approval
        
        // Add pending transaction locally to show in history
        const newTransaction = {
          userId: user.$id || user.id || '',
          cardId,
          amount: -amount, // Negative for outgoing transfer
          type: 'transfer',
          category: 'transfer',
          description: description || `Transfer To: ${recipientCardNumber}`,
          recipient: recipientCardNumber,
          status: requiresApproval ? 'pending_approval' : 'completed'
        };
        
        addTransaction(newTransaction);
        
        let approvalData = null;
        
        if (requiresApproval) {
          // Create approval request for large external transfers
          try {
            const approvalResponse = await createApprovalRequest({
              transactionId: data.transferId || `transfer_${Date.now()}`,
              approvalType: 'pin', // Require PIN for transfers
              expiryMinutes: 20, // 20 minutes to approve
              metadata: {
                amount: amount,
                currency: 'GHS',
                recipient: recipientCardNumber,
                description: description
              }
            });
            
            approvalData = approvalResponse;
            
            logger.info('TRANSFERS', 'Approval request created for external transfer', {
              transferId: data.transferId,
              approvalId: approvalResponse.approvalId
            });
          } catch (approvalError) {
            logger.warn('TRANSFERS', 'Failed to create approval request, proceeding without approval', approvalError);
          }
        } else {
          // Auto-approve small transfers and update balance
          try {
            await autoApprove(data.transferId || `transfer_${Date.now()}`, `Small transfer amount (${amount} GHS)`);
            
            // Update local card balance for auto-approved transfers
            updateCardBalance(cardId, newBalance);
            
            logger.info('TRANSFERS', 'Small external transfer auto-approved', { transferId: data.transferId });
          } catch (approvalError) {
            logger.warn('TRANSFERS', 'Failed to auto-approve transfer', approvalError);
            // Still update balance for small transfers
            updateCardBalance(cardId, newBalance);
          }
        }
        
        // Refresh card balances from database after successful transfer
        setTimeout(() => refreshCardBalances(), 1000);
        
        return {
          success: true,
          newBalance,
          requiresApproval,
          approval: approvalData
        };
      } else {
        // Server transfer failed, fall back to local simulation
        logger.warn('TRANSFERS', 'Server transfer failed, falling back to local simulation', result.error);
        
        // Fall through to local simulation below
      }
    } catch (error) {
      logger.warn('TRANSFERS', 'Server transfer error, falling back to local simulation', error);
      // Fall through to local simulation below
    }
    
    // Local simulation fallback
    try {
      logger.info('TRANSFERS', 'Using local simulation for external transfer');
      const newSourceBalance = sourceCard.balance - amount;
      
      // Update source card balance locally
      updateCardBalance(sourceCard.id, newSourceBalance);
      
      // Add outgoing transaction for source card
      addTransaction({
        userId: user.$id || user.id || '',
        cardId: sourceCard.id,
        amount: -amount, // Negative for outgoing transfer
        type: 'transfer',
        category: 'transfer',
        description: description || `External Transfer To: ${recipientCardNumber}`,
        recipient: recipientCardNumber,
        status: 'completed'
      });
      
      // Refresh card balances from database after successful local transfer
      setTimeout(() => refreshCardBalances(), 1000);
      
      logger.info('TRANSFERS', 'External transfer simulated locally');
      
      return {
        success: true,
        newBalance: newSourceBalance
      };
    } catch (error) {
      logger.error('TRANSFERS', 'Local simulation error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'External transfer failed'
      };
    }
  };

  const makeDeposit: AppContextType["makeDeposit"] = async (params) => {
    logger.info('DEPOSITS', 'Function called', params);
    
    // Validate user session is active
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated || !user) {
      logger.error('DEPOSITS', 'User not authenticated');
      return {
        success: false,
        error: 'User not authenticated. Please sign in again.'
      };
    }
    
    // Handle deposit confirmation
    if (params.depositId && params.action === 'confirm') {
      try {
        const { executeFunction } = require('../lib/api');
        
        logger.info('DEPOSITS', '[MakeDeposit] Using Appwrite function for deposit confirmation');
        
        const requestData = {
          action: 'confirm',
          depositId: params.depositId
        };
        
        logger.info('DEPOSITS', 'Confirming deposit', { depositId: params.depositId });
        
        // Execute Appwrite function for deposit confirmation
        const result = await executeFunction('deposits', requestData);
        
        logger.info('CONTEXT', '[MakeDeposit] Confirmation result:', result);
        
        if (result.success) {
          const data = result.data;
          logger.info('CONTEXT', '[MakeDeposit] Deposit confirmed successfully:', data);
          
          // Update local card balance
          if (data.cardId && data.newBalance !== undefined) {
            updateCardBalance(data.cardId, data.newBalance);
          }
          
          // Add the deposit transaction locally
          if (data.cardId && data.amount) {
            addTransaction({
              userId: user.$id || user.id || '',
              cardId: data.cardId,
              amount: data.amount, // Positive for deposit
              type: 'deposit',
              category: 'deposit',
              description: `Deposit confirmed - ${data.confirmationId || 'Success'}`,
              status: 'completed'
            });
          }
          
          // Refresh card balances from database after successful deposit
          setTimeout(() => refreshCardBalances(), 1000);
          
          return {
            success: true,
            data
          };
        } else {
          logger.error('CONTEXT', '[MakeDeposit] Function confirmation failed:', result.error);
          return {
            success: false,
            error: result.error || 'Deposit confirmation failed'
          };
        }
      } catch (error) {
        logger.error('CONTEXT', '[MakeDeposit] Confirmation error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Deposit confirmation failed'
        };
      }
    }
    
    // Handle new deposit creation
    if (!params.cardId || !params.amount) {
      return {
        success: false,
        error: 'Card ID and amount are required for deposit creation.'
      };
    }
    
    // Get target card details
    const targetCard = cards.find(card => card.id === params.cardId);
    if (!targetCard) {
      logger.error('CONTEXT', '[MakeDeposit] Target card not found');
      return {
        success: false,
        error: 'Target card not found. Please try again.'
      };
    }
    
    // Validate amount
    if (params.amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than zero.'
      };
    }
    
    if (params.amount > 10000) {
      return {
        success: false,
        error: 'Maximum deposit amount is GHS 10,000.'
      };
    }
    
    try {
      const { executeFunction } = require('../lib/api');
      
      logger.info('CONTEXT', '[MakeDeposit] Using Appwrite function for deposit creation');
      
      const requestData = {
        cardId: params.cardId,
        amount: params.amount,
        currency: params.currency || 'GHS',
        escrowMethod: params.escrowMethod || 'mobile_money',
        description: params.description || `${(params.escrowMethod || 'mobile_money').replace('_', ' ')} deposit`,
        ...(params.mobileNetwork && { mobileNetwork: params.mobileNetwork }),
        ...(params.mobileNumber && { mobileNumber: params.mobileNumber }),
        ...(params.reference && { reference: params.reference })
      };
      
      logger.info('CONTEXT', '[MakeDeposit] Request details:', {
        cardId: params.cardId,
        amount: params.amount,
        escrowMethod: params.escrowMethod
      });
      
      // Execute Appwrite function for deposit creation
      const result = await executeFunction('deposits', requestData);
      
      logger.info('CONTEXT', '[MakeDeposit] Function result:', result);
      
      if (result.success) {
        // Create approval request for deposit
        const { createApprovalRequest, autoApprove } = await import('@/lib/appwrite/transactionApprovalService');
        
        // For small amounts, auto-approve; for larger amounts, require manual approval
        const requiresApproval = params.amount > 1000; // Amounts over 1000 GHS require approval
        
        // Add pending transaction locally to show in history
        const newTransaction = {
          userId: user.$id || user.id || '',
          cardId: params.cardId,
          amount: params.amount, // Positive for deposit
          type: 'deposit',
          category: 'deposit',
          description: params.description || `${(params.escrowMethod || 'mobile_money').replace('_', ' ')} deposit`,
          status: requiresApproval ? 'pending_approval' : 'pending'
        };
        
        addTransaction(newTransaction);
        
        let approvalData = null;
        
        if (requiresApproval) {
          // Create approval request for large deposits
          try {
            const approvalResponse = await createApprovalRequest({
              transactionId: result.data.depositId,
              approvalType: 'pin', // Require PIN for deposits
              expiryMinutes: 30, // 30 minutes to approve
              metadata: {
                amount: params.amount,
                currency: params.currency || 'GHS',
                depositMethod: params.escrowMethod
              }
            });
            
            approvalData = approvalResponse;
            
            logger.info('DEPOSITS', 'Approval request created for deposit', {
              depositId: result.data.depositId,
              approvalId: approvalResponse.approvalId
            });
          } catch (approvalError) {
            logger.warn('DEPOSITS', 'Failed to create approval request, proceeding without approval', approvalError);
          }
        } else {
          // Auto-approve small deposits
          try {
            await autoApprove(result.data.depositId, `Small deposit amount (${params.amount} GHS)`);
            logger.info('DEPOSITS', 'Small deposit auto-approved', { depositId: result.data.depositId });
          } catch (approvalError) {
            logger.warn('DEPOSITS', 'Failed to auto-approve deposit', approvalError);
          }
        }
        
        // Push notification for pending deposit
        const { pushTransactionNotification } = require('../lib/appwrite/notificationService');
        const notificationMessage = requiresApproval 
          ? `Your deposit request has been created and requires approval. Check your pending approvals to complete the transaction.`
          : `Your deposit request has been created. Follow the payment instructions to complete your deposit.`;
          
        pushTransactionNotification(
          'success',
          'Deposit Initiated',
          notificationMessage,
          params.amount
        );
        
        return {
          success: true,
          data: {
            ...result.data,
            requiresApproval,
            approval: approvalData
          }
        };
      } else {
        logger.error('CONTEXT', '[MakeDeposit] Function failed:', result.error);
        return {
          success: false,
          error: result.error || 'Deposit creation failed'
        };
      }
    } catch (error) {
      logger.error('CONTEXT', '[MakeDeposit] Deposit creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deposit creation failed'
      };
    }
  };

  // Load transactions with caching strategy
  const loadTransactionsWithCache = async (cursor?: string | null, append: boolean = false, useCache: boolean = true) => {
    setIsLoadingTransactions(true);
    try {
      logger.info('CONTEXT', '[loadTransactionsWithCache] Attempting to load transactions with cache');
      
      // Use Appwrite transaction service
      let result = { success: false, data: null, error: null };
      try {
        const response = await queryAppwriteTransactions({ limit: 20 });
        const documents = response?.documents || [];
        const transactions = documents.map((doc: any) => ({
          id: doc.$id,
          userId: doc.userId || user.$id || user.id || '',
          cardId: doc.cardId,
          amount: doc.amount,
          type: doc.type,
          category: doc.category,
          description: doc.description,
          status: doc.status,
          date: doc.date || doc.$createdAt,
        }));
        
        result = {
          success: true,
          data: {
            transactions,
            nextCursor: null, // Appwrite doesn't use cursor pagination in this simple implementation
            fromCache: false
          },
          error: null
        };
      } catch (error) {
        logger.error('CONTEXT', 'Failed to fetch transactions from Appwrite:', error);
        result = {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Failed to fetch transactions'
        };
      }
      
      if (result.success && result.data) {
        const transactionCount = result.data.transactions.length;
        const dataSource = result.data.fromCache ? '(from cache)' : '(from server)';
        
        if (transactionCount === 0) {
          logger.info('CONTEXT', '[loadTransactionsWithCache] No transactions found', dataSource);
        } else {
          logger.info('CONTEXT', '[loadTransactionsWithCache] Successfully loaded', transactionCount, 'transactions', dataSource);
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
            logger.warn('CONTEXT', '[loadTransactionsWithCache] Failed to cache activity:', error);
          }
        }
      } else {
        logger.warn('CONTEXT', '[loadTransactionsWithCache] Request failed:', result.error);
        // If we failed and don't have cached data, still try fallback
      }
    } catch (error) {
      logger.error('CONTEXT', '[loadTransactionsWithCache] Error loading transactions:', error);
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
        logger.info('CONTEXT', '[LoadCards] Waiting for authentication to complete...');
      }
      return;
    }
    
    // Don't load cards if user is not authenticated
    if (!isAuthenticated || !user) {
      if (__DEV__) {
        logger.info('CONTEXT', '[LoadCards] Skipping card load - user not authenticated');
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
            logger.info('CONTEXT', '[LoadCards] Attempting to load cards from Appwrite for user:', user.$id || user.id);
          }
          const appwriteCards = await getAppwriteActiveCards();
          if (appwriteCards.length > 0) {
            if (__DEV__) {
              logger.info('CONTEXT', '[LoadCards] Loaded', appwriteCards.length, 'cards from Appwrite with fresh balances');
            }
            // Cards from Appwrite already have fresh balances from database
            // No need to map - the service already returns proper Card objects with current balances
            setCards(appwriteCards);
            setActiveCard(appwriteCards[0] || null);
            
            if (__DEV__) {
              logger.info('CONTEXT', '[LoadCards] Cards set with current balances:', 
                appwriteCards.map(c => ({ id: c.id, holder: c.cardHolderName, balance: c.balance }))
              );
            }
            return; // Exit early if Appwrite load was successful
          }
        } catch (appwriteError) {
          logger.warn('CONTEXT', '[LoadCards] Failed to load from Appwrite:', appwriteError);
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
          logger.info('CONTEXT', '[LoadCards] Got 401, refreshing JWT and retrying...');
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
        logger.warn('CONTEXT', '[LoadCards] Failed to load cards:', error);
      } finally {
        setIsLoadingCards(false);
      }
    };
    
    loadCards();
  }, [authLoading, isAuthenticated, user]);
  
  // Load transactions only after authentication is ready
  useEffect(() => {
    // Don't load transactions if authentication is still loading
    if (authLoading) {
      logger.info('CONTEXT', '[loadTransactionsWithCache] Waiting for authentication to complete...');
      return;
    }
    
    // Don't load transactions if user is not authenticated
    if (!isAuthenticated || !user) {
      logger.info('CONTEXT', '[loadTransactionsWithCache] Skipping transaction load - user not authenticated');
      return;
    }
    
    // Load transactions with cache-first strategy
    logger.info('CONTEXT', '[loadTransactionsWithCache] Authentication ready, loading transactions');
    loadTransactionsWithCache();
  }, [authLoading, isAuthenticated, user]);

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
        
        // Get current user ID
        const { user } = useAuthStore.getState();
        const userId = user?.id || user?.$id;
        if (!userId) {
          logger.info('CONTEXT', '[loadNotifications] No user ID available, skipping notifications load');
          return;
        }
        
        // User-scoped query for notifications
        const resp: any = await databases.listDocuments(dbId, notifCol, [
          Query.equal('userId', userId),
          Query.orderDesc('$createdAt'),
          Query.limit(50)
        ]);
        
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

  // Appwrite Realtime subscription removed
  // Note: Appwrite realtime was previously used here via client.subscribe().
  // Realtime listeners can be implemented per-collection if live updates are required.
  // For now, keep a no-op effect to avoid runtime errors and preserve app lifecycle.
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

    // Realtime subscriptions are disabled after removing Appwrite.
    // Implement per-collection onSnapshot listeners in the future if needed.
    logger.info('CONTEXT', '[Realtime] Appwrite realtime removed; channels detected:', channels);

    // No-op unsubscribe
    return () => {};
  }, []);

  const markNotificationRead: AppContextType['markNotificationRead'] = async (id) => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    
    // Optimistic update (always perform for local state)
    setNotifications(cur => cur.map(n => (n.id === id ? { ...n, unread: false } : n)));
    
    // Only try database update if configured
    if (!dbId || !notifCol) {
      logger.info('CONTEXT', '[markNotificationRead] Database not configured, using local-only mode');
      return;
    }
    
    try {
      await databases.updateDocument(dbId, notifCol, id, { unread: false });
      logger.info('CONTEXT', `[markNotificationRead] Successfully marked notification ${id} as read`);
    } catch (e) {
      logger.warn('CONTEXT', `[markNotificationRead] Failed to update notification ${id} in database:`, e);
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
      logger.info('CONTEXT', '[markAllNotificationsRead] No unread notifications to mark');
      return;
    }
    
    logger.info('CONTEXT', `[markAllNotificationsRead] Marking ${unread.length} notifications as read`);
    logger.info('CONTEXT', '[markAllNotificationsRead] Current notifications:', notifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Store the original state for potential partial rollback
    const originalNotifications = notifications;
    
    // Create completely new notification objects to ensure React detects the change
    const updatedNotifications = notifications.map(n => ({
      ...n,
      unread: false // Mark ALL as read, not just the unread ones
    }));
    
    logger.info('CONTEXT', '[markAllNotificationsRead] Updated notifications:', updatedNotifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Force immediate state update with completely new array
    setNotifications(updatedNotifications);
    
    logger.info('CONTEXT', '[markAllNotificationsRead] State updated, unread indicators should be hidden immediately');
    
    // Only try database update if configured
    if (!dbId || !notifCol) {
      logger.info('CONTEXT', '[markAllNotificationsRead] Database not configured, using local-only mode');
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
        logger.warn('CONTEXT', `[markAllNotificationsRead] Retry ${retryCount + 1}/${maxRetries} failed for notification ${notificationId}:`, e);
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
          logger.warn('CONTEXT', `[markAllNotificationsRead] Initial attempt failed for notification ${notification.id}:`, e);
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
    
    logger.info('CONTEXT', `[markAllNotificationsRead] Database update completed: ${successfulUpdates} successful, ${failedUpdates} failed`);
    
    // Enhanced error handling with partial rollback for persistent failures
    if (failedUpdates > 0) {
      logger.warn('CONTEXT', `[markAllNotificationsRead] ${failedUpdates} notifications failed to update after retries:`, failedIds);
      
      // Determine the severity of the failure
      const failureRate = failedUpdates / unread.length;
      
      if (failureRate >= 0.8) {
        // If 80% or more failed, likely a connection/server issue - keep optimistic update
        logger.error('CONTEXT', '[markAllNotificationsRead] High failure rate detected - likely connection issue. Keeping optimistic update.');
      } else if (failureRate >= 0.3) {
        // If 30-79% failed, partial server issue - revert failed notifications only
        logger.warn('CONTEXT', '[markAllNotificationsRead] Moderate failure rate - reverting failed notifications to unread state.');
        setNotifications(current => 
          current.map(n => 
            failedIds.includes(n.id) ? { ...n, unread: true } : n
          )
        );
      } else {
        // Less than 30% failed - likely individual notification issues, keep optimistic update
        logger.info('CONTEXT', '[markAllNotificationsRead] Low failure rate - keeping optimistic update for UX.');
      }
    }
    
    // Log final status
    if (successfulUpdates > 0) {
      logger.info('CONTEXT', `[markAllNotificationsRead] Successfully synchronized ${successfulUpdates}/${unread.length} notifications to database`);
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
      logger.info('CONTEXT', '[toggleNotificationRead] Database not configured, using local-only mode');
      return;
    }
    
    try {
      await databases.updateDocument(dbId, notifCol, id, { unread: nextUnread });
      logger.info('CONTEXT', `[toggleNotificationRead] Successfully toggled notification ${id} to ${nextUnread ? 'unread' : 'read'}`);
    } catch (e) {
      logger.warn('CONTEXT', `[toggleNotificationRead] Failed to update notification ${id} in database:`, e);
      // Don't roll back - this notification might be local-only
    }
  };

  const markAllNotificationsUnread: AppContextType['markAllNotificationsUnread'] = async () => {
    const dbId = appwriteConfig.databaseId;
    const notifCol = (appwriteConfig as any).notificationsCollectionId as string | undefined;
    const readNotifications = notifications.filter(n => !n.unread);
    if (readNotifications.length === 0) {
      logger.info('CONTEXT', '[markAllNotificationsUnread] No read notifications to mark as unread');
      return;
    }
    
    logger.info('CONTEXT', `[markAllNotificationsUnread] Marking ${readNotifications.length} notifications as unread`);
    logger.info('CONTEXT', '[markAllNotificationsUnread] Current notifications:', notifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Create completely new notification objects to ensure React detects the change
    const updatedNotifications = notifications.map(n => ({
      ...n,
      unread: true // Mark ALL as unread
    }));
    
    logger.info('CONTEXT', '[markAllNotificationsUnread] Updated notifications:', updatedNotifications.map(n => ({ id: n.id, title: n.title.substring(0, 20), unread: n.unread })));
    
    // Force immediate state update with completely new array
    setNotifications(updatedNotifications);
    
    logger.info('CONTEXT', '[markAllNotificationsUnread] State updated, all notifications should show as unread immediately');
    
    // Only try database update if configured
    if (!dbId || !notifCol) {
      logger.info('CONTEXT', '[markAllNotificationsUnread] Database not configured, using local-only mode');
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
        logger.warn('CONTEXT', `[markAllNotificationsUnread] Failed to update notification ${notification.id} in database:`, e);
        // Don't roll back - this notification might be local-only
      }
    }
    
    logger.info('CONTEXT', `[markAllNotificationsUnread] Database update completed: ${successfulUpdates} successful, ${failedUpdates} failed`);
    
    // Only show error if ALL updates failed (suggesting a connection issue)
    if (successfulUpdates === 0 && failedUpdates > 0) {
      logger.warn('CONTEXT', '[markAllNotificationsUnread] All database updates failed - this might indicate a connection issue');
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
        logger.info('CONTEXT', '[ClearNotifications] Got 401, refreshing JWT and retrying...');
        jwt = await refreshAppwriteJWT();
        if (jwt) {
          res = await makeRequest(jwt);
        }
      }
      
      if (!res.ok) {
        logger.warn('CONTEXT', 'Failed to clear notifications (server), but local state has been cleared');
      }
    } catch (e) {
      logger.warn('CONTEXT', 'clearAllNotifications server error (local state cleared):', e);
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
    const { logger } = require('@/lib/logger');
    
    logger.info('TRANSACTION', 'Starting clear all transactions operation');
    
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
      
      // Set a flag to indicate transactions were manually cleared
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('transactions_manually_cleared', Date.now().toString());
      
      logger.info('TRANSACTION', 'Transaction data cleared successfully');
    } catch (error) {
      logger.error('TRANSACTION', 'Failed to clear cached data:', error);
      throw error;
    }
    
    // Note: We don't delete transactions from Appwrite server as this would be destructive
    // The user can refresh to reload transactions from server if needed
  };

  const clearAllActivity: AppContextType['clearAllActivity'] = async () => {
    const { logger } = require('@/lib/logger');
    
    logger.info('ACTIVITY', 'Starting clear all activity operation');
    
    // Clear local activity state
    setActivity([]);
    
    try {
      // Clear cached activity events
      await StorageManager.clearActivityCache();
      
      // Set a flag to indicate activity was manually cleared
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('activity_manually_cleared', Date.now().toString());
      
      logger.info('ACTIVITY', 'Activity data cleared successfully');
    } catch (error) {
      logger.error('ACTIVITY', 'Failed to clear cached activity:', error);
      throw error;
    }
    
    // Note: We don't delete activity from Appwrite server as this would be destructive
    // The user can refresh to reload activity from server if needed
  };

  const updateTransaction: AppContextType['updateTransaction'] = async (id, updateData) => {
    const { logger } = require('@/lib/logger');
    logger.debug('TRANSACTION', 'Updating transaction:', { id, updateData });
    
    try {
      // Validate user session is active
      const { isAuthenticated, user } = useAuthStore.getState();
      if (!isAuthenticated || !user) {
        logger.error('TRANSACTION', 'User not authenticated');
        return {
          success: false,
          error: 'User not authenticated. Please sign in again.'
        };
      }

      // Update in Appwrite database
      await updateAppwriteTransaction(id, updateData);
      
      // Update local state optimistically
      setTransactions(prev => 
        prev.map(tx => 
          tx.id === id 
            ? { ...tx, ...updateData }
            : tx
        )
      );
      
      // Update activity if transaction was updated
      setActivity(prev => 
        prev.map(act => 
          act.transactionId === id 
            ? { 
                ...act, 
                title: updateData.description ? 
                  (act.category === 'transaction' ? updateData.description : act.title) : 
                  act.title,
                status: updateData.status as any || act.status
              }
            : act
        )
      );
      
      logger.info('TRANSACTION', 'Transaction updated successfully');
      return { success: true };
      
    } catch (error) {
      logger.error('TRANSACTION', 'Failed to update transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update transaction'
      };
    }
  };

  const deleteTransaction: AppContextType['deleteTransaction'] = async (id) => {
    const { logger } = require('@/lib/logger');
    logger.debug('TRANSACTION', 'Deleting transaction:', { id });
    
    try {
      // Validate user session is active
      const { isAuthenticated, user } = useAuthStore.getState();
      if (!isAuthenticated || !user) {
        logger.error('TRANSACTION', 'User not authenticated');
        return {
          success: false,
          error: 'User not authenticated. Please sign in again.'
        };
      }

      // Find transaction to get details for activity tracking
      const transactionToDelete = transactions.find(tx => tx.id === id);
      
      // Delete from Appwrite database
      await deleteAppwriteTransaction(id);
      
      // Remove from local state
      setTransactions(prev => prev.filter(tx => tx.id !== id));
      
      // Remove related activity events
      setActivity(prev => prev.filter(act => act.transactionId !== id));
      
      // Create activity event for deletion
      if (transactionToDelete) {
        const deletionEvent = {
          id: `tx.deleted.${id}`,
          category: 'transaction' as const,
          type: 'transaction.deleted',
          title: `Transaction deleted: ${transactionToDelete.description}`,
          subtitle: `${transactionToDelete.type} of ${Math.abs(transactionToDelete.amount).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}`,
          amount: transactionToDelete.amount,
          currency: 'GHS',
          status: 'info' as const,
          timestamp: new Date().toISOString(),
          transactionId: id,
          cardId: transactionToDelete.cardId,
          tags: ['deleted', transactionToDelete.category],
        };
        
        pushActivity(deletionEvent);
      }
      
      logger.info('TRANSACTION', 'Transaction deleted successfully');
      return { success: true };
      
    } catch (error) {
      logger.error('TRANSACTION', 'Failed to delete transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete transaction'
      };
    }
  };

  // Generic transaction maker for withdrawals and other transaction types
  const makeTransaction: AppContextType['makeTransaction'] = async (params) => {
    const { logger } = require('@/lib/logger');
    
    try {
      // Validate user session
      const { isAuthenticated, user } = useAuthStore.getState();
      if (!isAuthenticated || !user) {
        logger.error('TRANSACTION', '[makeTransaction] User not authenticated');
        return {
          success: false,
          error: 'User not authenticated. Please sign in again.'
        };
      }

      const { type, amount, fromCardId, toCardId, description, fee } = params;
      
      // Validate required fields
      if (!type || !amount) {
        return {
          success: false,
          error: 'Transaction type and amount are required.'
        };
      }

      if (amount <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than zero.'
        };
      }

      // For withdrawals, we need fromCardId
      if (type === 'withdrawal' && !fromCardId) {
        return {
          success: false,
          error: 'Source card is required for withdrawals.'
        };
      }

      // For transfers, we need both fromCardId and toCardId
      if (type === 'transfer' && (!fromCardId || !toCardId)) {
        return {
          success: false,
          error: 'Both source and destination cards are required for transfers.'
        };
      }

      // Validate source card if provided
      if (fromCardId) {
        const sourceCard = cards.find(card => card.id === fromCardId);
        if (!sourceCard) {
          return {
            success: false,
            error: 'Source card not found.'
          };
        }

        // Check sufficient balance for withdrawals and transfers
        if ((type === 'withdrawal' || type === 'transfer') && sourceCard.balance < (amount + (fee || 0))) {
          return {
            success: false,
            error: 'Insufficient balance.'
          };
        }
      }

      // Create transaction record
      const transactionData: Omit<Transaction, 'id' | 'date'> = {
        userId: user.$id || user.id || '',
        cardId: fromCardId || toCardId || '',
        amount: type === 'withdrawal' ? -Math.abs(amount) : amount, // Negative for withdrawals
        type: type,
        category: type,
        description: description || `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
        status: 'completed',
        ...(fee && fee > 0 && { fee })
      };

      // For withdrawals, use Appwrite function with approval system
      if (type === 'withdrawal' && fromCardId) {
        try {
          const { executeFunction } = require('../lib/api');
          
          logger.info('TRANSACTION', '[makeTransaction] Using Appwrite function for withdrawal');
          
          const requestData = {
            cardId: fromCardId,
            amount: amount,
            currency: 'GHS',
            withdrawalMethod: 'mobile_money', // Default method - could be customizable
            description: description || 'Withdrawal',
            ...(fee && fee > 0 && { fee })
          };
          
          // Execute Appwrite function for withdrawal
          const result = await executeFunction('withdrawals', requestData);
          
          logger.info('TRANSACTION', '[makeTransaction] Withdrawal function result:', result);
          
          if (result.success) {
            const data = result.data;
            
            // Create approval request for withdrawal
            const { createApprovalRequest, autoApprove } = await import('@/lib/appwrite/transactionApprovalService');
            
            // For large amounts, require approval; for smaller amounts, auto-approve
            const requiresApproval = amount > 500; // Amounts over 500 GHS require approval
            
            // Add pending transaction locally to show in history
            const newTransaction = {
              userId: user.$id || user.id || '',
              cardId: fromCardId,
              amount: -data.amount, // Negative for withdrawal
              type: 'withdrawal',
              category: 'withdrawal',
              description: description || 'Withdrawal',
              status: requiresApproval ? 'pending_approval' : 'completed',
              fee: data.fee
            };
            
            addTransaction(newTransaction);
            
            let approvalData = null;
            
            if (requiresApproval) {
              // Create approval request for large withdrawals
              try {
                const approvalResponse = await createApprovalRequest({
                  transactionId: data.withdrawalId || `withdrawal_${Date.now()}`,
                  approvalType: 'biometric', // Require biometric for withdrawals
                  expiryMinutes: 15, // 15 minutes to approve
                  metadata: {
                    amount: amount,
                    currency: 'GHS',
                    withdrawalMethod: requestData.withdrawalMethod,
                    fee: data.fee || 0
                  }
                });
                
                approvalData = approvalResponse;
                
                logger.info('WITHDRAWAL', 'Approval request created for withdrawal', {
                  withdrawalId: data.withdrawalId,
                  approvalId: approvalResponse.approvalId
                });
              } catch (approvalError) {
                logger.warn('WITHDRAWAL', 'Failed to create approval request, proceeding without approval', approvalError);
              }
            } else {
              // Auto-approve small withdrawals and update balance
              try {
                await autoApprove(data.withdrawalId || `withdrawal_${Date.now()}`, `Small withdrawal amount (${amount} GHS)`);
                
                // Update local card balance for auto-approved withdrawals
                updateCardBalance(fromCardId, data.newBalance);
                
                logger.info('WITHDRAWAL', 'Small withdrawal auto-approved', { withdrawalId: data.withdrawalId });
              } catch (approvalError) {
                logger.warn('WITHDRAWAL', 'Failed to auto-approve withdrawal', approvalError);
                // Still update balance for small withdrawals
                updateCardBalance(fromCardId, data.newBalance);
              }
            }
            
            // Add fee transaction if there's a fee
            if (data.fee > 0) {
              addTransaction({
                userId: user.$id || user.id || '',
                cardId: fromCardId,
                amount: -data.fee, // Negative for fee
                type: 'fee',
                category: 'fee',
                description: 'Withdrawal fee',
                status: 'completed'
              });
            }
            
            logger.info('TRANSACTION', '[makeTransaction] Withdrawal completed successfully via Appwrite function', {
              requiresApproval,
              approvalId: approvalData?.approvalId
            });
            
            return { 
              success: true, 
              requiresApproval,
              approval: approvalData
            };
          } else {
            logger.error('TRANSACTION', '[makeTransaction] Withdrawal function failed:', result.error);
            return {
              success: false,
              error: result.error || 'Withdrawal failed'
            };
          }
        } catch (error) {
          logger.error('TRANSACTION', '[makeTransaction] Withdrawal function error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Withdrawal failed'
          };
        }
      }
      
      // For other transaction types, add to local state and database
      addTransaction(transactionData);

      logger.info('TRANSACTION', `[makeTransaction] ${type} transaction completed successfully`, {
        type,
        amount,
        fromCardId,
        toCardId,
        fee
      });

      return { success: true };
      
    } catch (error) {
      logger.error('TRANSACTION', `[makeTransaction] Failed to process ${params.type} transaction:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to process ${params.type} transaction`
      };
    }
  };

  // Refresh pending approvals count
  const refreshPendingApprovals: AppContextType['refreshPendingApprovals'] = async () => {
    try {
      const { getPendingApprovals } = await import('@/lib/appwrite/transactionApprovalService');
      const approvals = await getPendingApprovals();
      setPendingApprovalsCount(approvals.length);
      
      logger.info('APPROVALS', `Refreshed pending approvals count: ${approvals.length}`);
    } catch (error) {
      logger.warn('APPROVALS', 'Failed to refresh pending approvals count:', error);
    }
  };

  // Handle approval status changes
  const handleApprovalStatusChange: AppContextType['handleApprovalStatusChange'] = async (approvalId, approved, transactionId) => {
    logger.info('APPROVALS', `Handling approval status change: ${approvalId} - ${approved ? 'approved' : 'rejected'}`);
    
    try {
      // Update transaction status if we have the transaction ID
      if (transactionId) {
        const newStatus = approved ? 'completed' : 'rejected';
        
        // Update local transaction status
        setTransactions(prev => 
          prev.map(tx => {
            // Match by transaction ID or by description containing the transaction ID
            if (tx.id === transactionId || tx.description.includes(transactionId)) {
              return { ...tx, status: newStatus };
            }
            return tx;
          })
        );
        
        // Update activity status
        setActivity(prev => 
          prev.map(act => {
            if (act.transactionId === transactionId || act.id.includes(transactionId)) {
              return { ...act, status: newStatus as any };
            }
            return act;
          })
        );
        
        // If approved, process the transaction (update balances, etc.)
        if (approved) {
          // For deposits, withdrawals, and transfers - refresh balances
          setTimeout(() => {
            refreshCardBalances();
            refreshTransactions();
          }, 1000);
          
          // Create success activity event
          const successEvent = {
            id: `approval.success.${approvalId}`,
            category: 'approval' as const,
            type: 'approval.completed',
            title: 'Transaction Approved',
            subtitle: 'Your transaction has been approved and processed',
            description: `Transaction ${transactionId} was approved and completed successfully`,
            timestamp: new Date().toISOString(),
            status: 'success' as const,
            tags: ['approval', 'success'],
          };
          
          pushActivity(successEvent);
          
          // Send success notification
          const { pushTransactionNotification } = require('../lib/appwrite/notificationService');
          pushTransactionNotification(
            'success',
            'Transaction Approved',
            'Your transaction has been approved and processed successfully.',
            0 // No amount needed for approval notification
          );
        } else {
          // Create rejection activity event
          const rejectionEvent = {
            id: `approval.rejected.${approvalId}`,
            category: 'approval' as const,
            type: 'approval.rejected',
            title: 'Transaction Rejected',
            subtitle: 'Your transaction was rejected',
            description: `Transaction ${transactionId} was rejected and will not be processed`,
            timestamp: new Date().toISOString(),
            status: 'error' as const,
            tags: ['approval', 'rejected'],
          };
          
          pushActivity(rejectionEvent);
          
          // Send rejection notification
          const { pushTransactionNotification } = require('../lib/appwrite/notificationService');
          pushTransactionNotification(
            'error',
            'Transaction Rejected',
            'Your transaction was rejected and will not be processed.',
            0 // No amount needed for rejection notification
          );
        }
      }
      
      // Refresh pending approvals count
      await refreshPendingApprovals();
      
      logger.info('APPROVALS', `Successfully handled approval status change for ${approvalId}`);
      
    } catch (error) {
      logger.error('APPROVALS', `Failed to handle approval status change for ${approvalId}:`, error);
      throw error;
    }
  };

  // Load pending approvals count on auth ready
  useEffect(() => {
    if (isAuthenticated && user && !authLoading) {
      refreshPendingApprovals();
      
      // Refresh every 60 seconds
      const interval = setInterval(refreshPendingApprovals, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user, authLoading]);

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
        makeDeposit,
        makeTransaction,
        refreshCardBalances,
        isLoadingCards,
        isLoadingTransactions,
        refreshTransactions: refreshTransactionsImpl,
        loadMoreTransactions: loadMoreTransactionsImpl,
        clearAllTransactions,
        updateTransaction,
        deleteTransaction,
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
        // Transaction approvals
        handleApprovalStatusChange,
        refreshPendingApprovals,
        pendingApprovalsCount,
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
