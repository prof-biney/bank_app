/**
 * React Hook for Appwrite Card Real-time Updates
 * 
 * This hook provides real-time card data and subscriptions using Appwrite services.
 * It manages card loading, real-time updates, and error states.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  cardService, 
  Card, 
  CardRealtimeOptions,
  getActiveCards 
} from '@/lib/appwrite/cardService';
import { logger } from '@/lib/logger';

export interface UseAppwriteCardsOptions {
  enableRealtime?: boolean;
  onCardCreated?: (card: Card) => void;
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: string) => void;
  onBalanceChanged?: (cardId: string, newBalance: number, oldBalance: number) => void;
  onError?: (error: any) => void;
}

export interface UseAppwriteCardsReturn {
  cards: Card[];
  activeCard: Card | null;
  isLoading: boolean;
  error: Error | null;
  refreshCards: () => Promise<void>;
  setActiveCard: (card: Card | null) => void;
  unsubscribeAll: () => void;
}

export function useAppwriteCards(options: UseAppwriteCardsOptions = {}): UseAppwriteCardsReturn {
  const [cards, setCards] = useState<Card[]>([]);
  const [activeCard, setActiveCardState] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const {
    enableRealtime = true,
    onCardCreated,
    onCardUpdated,
    onCardDeleted,
    onBalanceChanged,
    onError,
  } = options;

  /**
   * Load cards from Appwrite
   */
  const loadCards = useCallback(async () => {
    try {
      setError(null);
      logger.info('USE_APPWRITE_CARDS', 'Loading cards from Appwrite');
      
      const activeCards = await getActiveCards();
      setCards(activeCards);
      
      // Set first card as active if no active card is set
      if (!activeCard && activeCards.length > 0) {
        setActiveCardState(activeCards[0]);
      }
      
      logger.info('USE_APPWRITE_CARDS', 'Cards loaded successfully', { 
        count: activeCards.length 
      });
    } catch (err) {
      logger.error('USE_APPWRITE_CARDS', 'Failed to load cards', err);
      setError(err instanceof Error ? err : new Error('Failed to load cards'));
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCard, onError]);

  /**
   * Refresh cards data
   */
  const refreshCards = useCallback(async () => {
    setIsLoading(true);
    await loadCards();
  }, [loadCards]);

  /**
   * Set up real-time subscriptions
   */
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!enableRealtime) {
      logger.info('USE_APPWRITE_CARDS', 'Real-time disabled, skipping subscriptions');
      return;
    }

    logger.info('USE_APPWRITE_CARDS', 'Setting up real-time card subscriptions');

    const realtimeOptions: CardRealtimeOptions = {
      onCardCreated: (card) => {
        logger.info('USE_APPWRITE_CARDS', 'Real-time: Card created', { cardId: card.id });
        
        setCards(prevCards => {
          const exists = prevCards.some(c => c.id === card.id);
          if (exists) {
            return prevCards;
          }
          return [...prevCards, card];
        });
        
        onCardCreated?.(card);
      },

      onCardUpdated: (card) => {
        logger.info('USE_APPWRITE_CARDS', 'Real-time: Card updated', { cardId: card.id });
        
        setCards(prevCards => 
          prevCards.map(c => c.id === card.id ? card : c)
        );
        
        // Update active card if it's the one that was updated
        setActiveCardState(prevActive => 
          prevActive?.id === card.id ? card : prevActive
        );
        
        onCardUpdated?.(card);
      },

      onCardDeleted: (cardId) => {
        logger.info('USE_APPWRITE_CARDS', 'Real-time: Card deleted', { cardId });
        
        setCards(prevCards => prevCards.filter(c => c.id !== cardId));
        
        // Clear active card if it was deleted
        setActiveCardState(prevActive => 
          prevActive?.id === cardId ? null : prevActive
        );
        
        onCardDeleted?.(cardId);
      },

      onBalanceChanged: (cardId, newBalance, oldBalance) => {
        logger.info('USE_APPWRITE_CARDS', 'Real-time: Card balance changed', { 
          cardId, 
          newBalance, 
          oldBalance 
        });
        
        onBalanceChanged?.(cardId, newBalance, oldBalance);
      },

      onError: (err) => {
        logger.error('USE_APPWRITE_CARDS', 'Real-time subscription error', err);
        setError(err instanceof Error ? err : new Error('Real-time subscription error'));
        onError?.(err);
      },
    };

    const unsubscribe = cardService.subscribeToCards(realtimeOptions);
    unsubscribeRef.current = unsubscribe;
    
    logger.info('USE_APPWRITE_CARDS', 'Real-time subscriptions set up successfully');
  }, [
    enableRealtime,
    onCardCreated,
    onCardUpdated,
    onCardDeleted,
    onBalanceChanged,
    onError,
  ]);

  /**
   * Set active card
   */
  const setActiveCard = useCallback((card: Card | null) => {
    setActiveCardState(card);
    logger.info('USE_APPWRITE_CARDS', 'Active card changed', { 
      cardId: card?.id || 'none' 
    });
  }, []);

  /**
   * Unsubscribe from all real-time subscriptions
   */
  const unsubscribeAll = useCallback(() => {
    if (unsubscribeRef.current) {
      logger.info('USE_APPWRITE_CARDS', 'Unsubscribing from real-time updates');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // Load cards on mount
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Set up real-time subscriptions
  useEffect(() => {
    setupRealtimeSubscriptions();
    
    return () => {
      unsubscribeAll();
    };
  }, [setupRealtimeSubscriptions, unsubscribeAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeAll();
    };
  }, [unsubscribeAll]);

  return {
    cards,
    activeCard,
    isLoading,
    error,
    refreshCards,
    setActiveCard,
    unsubscribeAll,
  };
}