/**
 * Appwrite Card Service
 * 
 * This module handles all card-related operations using Appwrite database with real-time subscriptions.
 * It provides CRUD operations for cards, real-time balance updates, and comprehensive error handling.
 */

import { databaseService, Query, ID, collections } from './database';
import { authService } from './auth';
import { logger } from '../logger';
import type { Card } from '@/types';

// Card service interfaces
export interface CreateCardData {
  cardNumber: string;
  cardHolderName: string;
  expiryDate: string;
  cardType: 'visa' | 'mastercard' | 'amex' | 'discover' | 'card';
  cardColor: string;
  balance?: number;
  currency?: string;
  token?: string;
  isActive?: boolean;
}

export interface UpdateCardData {
  cardHolderName?: string;
  expiryDate?: string;
  balance?: number;
  isActive?: boolean;
  cardColor?: string;
  currency?: string;
}

export interface CardFilters {
  isActive?: boolean;
  cardType?: string;
  minBalance?: number;
  maxBalance?: number;
  currency?: string;
}

export interface CardQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'cardHolderName' | '$createdAt' | 'balance';
  orderDirection?: 'asc' | 'desc';
  filters?: CardFilters;
}

// Real-time subscription types
export interface CardRealtimeOptions {
  onCardCreated?: (card: Card) => void;
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: string) => void;
  onBalanceChanged?: (cardId: string, newBalance: number, oldBalance: number) => void;
  onError?: (error: any) => void;
}

/**
 * Appwrite Card Service Class
 */
export class AppwriteCardService {
  private subscriptions = new Map<string, () => void>();

  constructor() {
    logger.info('CARD_SERVICE', 'Appwrite Card Service initialized');
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated - no user ID found');
    }
    
    logger.info('CARD_SERVICE', 'Using userId for card operations', { userId: user.$id });
    return user.$id;
  }

  /**
   * Transform card data to match Appwrite schema
   */
  private transformCardForAppwrite(cardData: CreateCardData, userId: string): any {
    // Parse expiry date (MM/YY format)
    const [expMonth, expYear] = cardData.expiryDate.split('/');
    const fullYear = expYear.length === 2 ? 2000 + parseInt(expYear) : parseInt(expYear);
    
    // Map generic card types to specific brands for Appwrite validation
    const mapCardToBrand = (cardType: string): string => {
      const type = cardType.toLowerCase();
      if (type.includes('visa')) return 'visa';
      if (type.includes('master') || type.includes('mc')) return 'mastercard';
      if (type.includes('amex') || type.includes('american')) return 'amex';
      if (type.includes('verve')) return 'verve';
      if (type.includes('discover')) return 'discover';
      if (type.includes('unionpay')) return 'unionpay';
      if (type.includes('jcb')) return 'jcb';
      // Default to visa for generic 'card' types
      return 'visa';
    };
    
    const result: any = {
      userId,
      cardNumber: cardData.cardNumber,
      last4: cardData.cardNumber.replace(/[^\d]/g, '').slice(-4),
      holder: cardData.cardHolderName,
      brand: mapCardToBrand(cardData.cardType || 'card'),
      exp_month: parseInt(expMonth),
      exp_year: fullYear,
      color: cardData.cardColor,
      currency: cardData.currency || 'GHS',
      token: cardData.token || null,
      status: cardData.isActive !== false ? 'active' : 'inactive',
      type: 'debit', // Default card type
    };
    
    // Only set balance if explicitly provided, otherwise let Appwrite use database default
    if (cardData.balance !== undefined) {
      result.balance = cardData.balance; // Store balance as regular number (not cents)
    }
    
    return result;
  }

  /**
   * Transform Appwrite document to Card type
   */
  private transformAppwriteToCard(doc: any): Card {
    // Smart balance logic:
    // 1. If balance field exists and is not 0, use it
    // 2. If balance is 0 or doesn't exist, we'll calculate it later in getCard method or when requested
    // 3. Fallback to initialBalance -> startingBalance -> default 40000
    let cardBalance = 0;
    if (typeof doc.balance === 'number' && doc.balance !== 0) {
      cardBalance = doc.balance;
    } else if (typeof doc.initialBalance === 'number') {
      cardBalance = doc.initialBalance;
    } else if (typeof doc.startingBalance === 'number') {
      cardBalance = doc.startingBalance;
    } else {
      cardBalance = 40000; // Default balance if no field is available
    }
    
    return {
      id: doc.$id,
      userId: doc.userId,
      cardNumber: doc.cardNumber || `****-****-****-${doc.last4}`,
      cardHolderName: doc.holder || doc.cardHolderName,
      expiryDate: doc.exp_month 
        ? `${doc.exp_month.toString().padStart(2, '0')}/${doc.exp_year.toString().slice(-2)}`
        : doc.expiryDate,
      cardType: doc.brand || doc.cardType || 'card',
      cardColor: doc.color || doc.cardColor || '#1e40af',
      balance: cardBalance, // Use balance as regular number (not cents)
      currency: doc.currency || 'GHS',
      token: doc.token,
      isActive: doc.status ? (doc.status !== 'inactive') : (doc.isActive !== false),
    };
  }

  /**
   * Create a new card
   */
  async createCard(cardData: CreateCardData): Promise<Card> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('CARD_SERVICE', 'Creating card', {
        userId,
        cardHolderName: cardData.cardHolderName,
        cardType: cardData.cardType,
        balance: cardData.balance,
        last4: cardData.cardNumber.slice(-4),
      });

      // Transform data for Appwrite schema
      const appwriteData = this.transformCardForAppwrite(cardData, userId);
      
      // Create document in Appwrite
      const document = await databaseService.createDocument(
        collections.cards.id,
        appwriteData
      );

      // Transform back to Card type
      const card = this.transformAppwriteToCard(document);

      // Log activity (fire-and-forget)
      this.logCardActivity(card.id, 'created', `Card ${card.cardHolderName} created`);

      logger.info('CARD_SERVICE', 'Card created successfully', { cardId: card.id });
      return card;
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to create card', error);
      throw this.handleCardError(error, 'Failed to create card');
    }
  }

  /**
   * Update an existing card
   */
  async updateCard(cardId: string, updateData: UpdateCardData): Promise<Card> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('CARD_SERVICE', 'Updating card', { cardId, userId, updateData });

      // First verify the card belongs to the current user (get directly to avoid circular call)
      const existingDocument = await databaseService.getDocument(collections.cards.id, cardId);
      if (existingDocument.userId !== userId) {
        throw new Error('Unauthorized: Card does not belong to current user');
      }

      // Transform update data to match Appwrite schema
      const appwriteUpdateData: any = {};
      
      if (updateData.balance !== undefined) {
        appwriteUpdateData.balance = updateData.balance; // Store balance as regular number (not cents)
      }
      if (updateData.cardHolderName !== undefined) {
        appwriteUpdateData.holder = updateData.cardHolderName;
      }
      if (updateData.cardColor !== undefined) {
        appwriteUpdateData.color = updateData.cardColor;
      }
      if (updateData.currency !== undefined) {
        appwriteUpdateData.currency = updateData.currency;
      }
      if (updateData.isActive !== undefined) {
        appwriteUpdateData.status = updateData.isActive ? 'active' : 'inactive';
      }
      if (updateData.expiryDate !== undefined) {
        const [expMonth, expYear] = updateData.expiryDate.split('/');
        appwriteUpdateData.exp_month = parseInt(expMonth);
        appwriteUpdateData.exp_year = expYear.length === 2 ? 2000 + parseInt(expYear) : parseInt(expYear);
      }

      // Update document in Appwrite
      const document = await databaseService.updateDocument(
        collections.cards.id,
        cardId,
        appwriteUpdateData
      );

      // Transform back to Card type
      const card = this.transformAppwriteToCard(document);

      // Log activity for significant changes
      if (updateData.balance !== undefined) {
        this.logCardActivity(card.id, 'balance_updated', `Balance updated to ${card.currency} ${card.balance}`);
      }

      logger.info('CARD_SERVICE', 'Card updated successfully', { cardId });
      return card;
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to update card', error);
      throw this.handleCardError(error, 'Failed to update card');
    }
  }

  /**
   * Delete a card (soft delete by setting status to inactive)
   */
  async deleteCard(cardId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('CARD_SERVICE', 'Deleting card', { cardId, userId });

      // First verify the card belongs to the current user
      const existingCard = await this.getCard(cardId);
      if (existingCard.userId !== userId) {
        throw new Error('Unauthorized: Card does not belong to current user');
      }

      // Soft delete by setting status to inactive
      await databaseService.updateDocument(
        collections.cards.id,
        cardId,
        { status: 'inactive' }
      );

      // Log activity
      this.logCardActivity(cardId, 'deleted', `Card ${existingCard.cardHolderName} deleted`);

      logger.info('CARD_SERVICE', 'Card deleted successfully', { cardId });
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to delete card', error);
      throw this.handleCardError(error, 'Failed to delete card');
    }
  }

  /**
   * Permanently delete a card
   */
  async permanentlyDeleteCard(cardId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();

      logger.info('CARD_SERVICE', 'Permanently deleting card', { cardId, userId });

      // First verify the card belongs to the current user
      const existingCard = await this.getCard(cardId);
      if (existingCard.userId !== userId) {
        throw new Error('Unauthorized: Card does not belong to current user');
      }

      // Permanently delete from database
      await databaseService.deleteDocument(collections.cards.id, cardId);

      logger.info('CARD_SERVICE', 'Card permanently deleted', { cardId });
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to permanently delete card', error);
      throw this.handleCardError(error, 'Failed to permanently delete card');
    }
  }

  /**
   * Get a single card by ID with smart balance calculation
   */
  async getCard(cardId: string): Promise<Card> {
    try {
      const userId = await this.getCurrentUserId();

      const document = await databaseService.getDocument(collections.cards.id, cardId);

      if (document.userId !== userId) {
        throw new Error('Unauthorized: Card does not belong to current user');
      }

      let card = this.transformAppwriteToCard(document);
      
      // If balance is 0 or missing, calculate smart balance
      if (card.balance === 0 || !document.balance) {
        try {
          const calculatedBalance = await this.calculateCardBalance(cardId);
          
          // If calculated balance is different from current balance, update it
          if (calculatedBalance !== card.balance) {
            // Update the balance in Appwrite database
            await this.updateCard(cardId, { balance: calculatedBalance });
            card.balance = calculatedBalance;
            
            logger.info('CARD_SERVICE', 'Card balance updated with smart calculation', {
              cardId,
              oldBalance: document.balance || 0,
              newBalance: calculatedBalance
            });
          }
        } catch (balanceError) {
          logger.warn('CARD_SERVICE', 'Failed to calculate smart balance, using existing balance', {
            cardId,
            error: balanceError
          });
        }
      }
      
      logger.info('CARD_SERVICE', 'Card retrieved', { cardId, balance: card.balance });
      return card;
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to get card', error);
      throw this.handleCardError(error, 'Failed to get card');
    }
  }

  /**
   * Query cards for the current user
   */
  async queryCards(options: CardQueryOptions = {}): Promise<{ cards: Card[]; total: number }> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('CARD_SERVICE', 'Querying cards for user', { userId, options });

      // Build queries
      const queries = [Query.equal('userId', userId)];

      // Add filters
      if (options.filters) {
        const { isActive, cardType, minBalance, maxBalance, currency } = options.filters;
        
        if (isActive !== undefined) {
          queries.push(Query.equal('status', isActive ? 'active' : 'inactive'));
        }
        if (cardType) {
          queries.push(Query.equal('brand', cardType));
        }
        if (currency) {
          queries.push(Query.equal('currency', currency));
        }
        if (minBalance !== undefined) {
          queries.push(Query.greaterThanEqual('balance', Math.round(minBalance * 100)));
        }
        if (maxBalance !== undefined) {
          queries.push(Query.lessThanEqual('balance', Math.round(maxBalance * 100)));
        }
      }

      // Add ordering
      const orderBy = options.orderBy || '$createdAt';
      const orderDirection = options.orderDirection || 'desc';
      if (orderDirection === 'desc') {
        queries.push(Query.orderDesc(orderBy === 'balance' ? 'balance' : orderBy));
      } else {
        queries.push(Query.orderAsc(orderBy === 'balance' ? 'balance' : orderBy));
      }

      // Add pagination
      if (options.limit) {
        queries.push(Query.limit(options.limit));
      }
      if (options.offset) {
        queries.push(Query.offset(options.offset));
      }

      // Execute query
      const response = await databaseService.listDocuments(collections.cards.id, queries);

      // Transform documents to Card type
      const cards = response.documents.map(doc => this.transformAppwriteToCard(doc));

      logger.info('CARD_SERVICE', 'Cards queried successfully', { 
        count: cards.length, 
        total: response.total 
      });

      return { cards, total: response.total };
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to query cards', error);
      throw this.handleCardError(error, 'Failed to query cards');
    }
  }

  /**
   * Get all active cards for the current user
   */
  async getActiveCards(): Promise<Card[]> {
    try {
      const result = await this.queryCards({
        filters: { isActive: true },
        orderBy: '$createdAt',
        orderDirection: 'desc'
      });
      
      return result.cards;
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to get active cards', error);
      return [];
    }
  }

  /**
   * Update card balance
   */
  async updateCardBalance(cardId: string, newBalance: number): Promise<Card> {
    try {
      logger.info('CARD_SERVICE', 'Updating card balance', { cardId, newBalance });
      
      return await this.updateCard(cardId, { balance: newBalance });
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to update card balance', error);
      throw error;
    }
  }

  /**
   * Calculate card balance from initial balance and transactions
   */
  async calculateCardBalance(cardId: string): Promise<number> {
    try {
      logger.info('CARD_SERVICE', 'Calculating smart balance for card', { cardId });
      
      // Get the card document to access initialBalance or set default
      const document = await databaseService.getDocument(collections.cards.id, cardId);
      const initialBalance = typeof document.initialBalance === 'number' ? document.initialBalance : 40000;
      
      // Import transaction service to get transactions
      const { transactionService } = await import('./transactionService');
      
      // Get all transactions for this card
      const transactions = await transactionService.getCardTransactions(cardId);
      
      // If no transactions exist, return the initial balance
      if (transactions.length === 0) {
        logger.info('CARD_SERVICE', 'No transactions found, using initial balance', { 
          cardId, 
          initialBalance 
        });
        return initialBalance;
      }
      
      // Calculate balance: initial balance + sum of all transaction amounts
      // Transactions with positive amounts add to balance, negative amounts subtract
      let calculatedBalance = initialBalance;
      
      transactions.forEach(transaction => {
        // For different transaction types:
        // - deposit/credit: positive amount adds to balance
        // - withdraw/debit/payment: negative amount or positive amount that should subtract
        // - transfer: depends on whether it's incoming (+) or outgoing (-)
        
        let transactionEffect = transaction.amount;
        
        // Handle transaction types that should always subtract from balance
        if (transaction.type === 'withdraw' || transaction.type === 'payment') {
          transactionEffect = -Math.abs(transaction.amount);
        }
        // Transfer and deposit amounts should be used as-is (can be + or -)
        
        calculatedBalance += transactionEffect;
        
        logger.info('CARD_SERVICE', 'Processing transaction', {
          transactionId: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          effect: transactionEffect,
          runningBalance: calculatedBalance
        });
      });
      
      // Ensure balance doesn't go below 0
      calculatedBalance = Math.max(calculatedBalance, 0);
      
      logger.info('CARD_SERVICE', 'Smart balance calculated', {
        cardId,
        initialBalance,
        transactionCount: transactions.length,
        calculatedBalance
      });
      
      return calculatedBalance;
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to calculate card balance', { cardId, error });
      // Fallback to default balance if calculation fails
      return 40000;
    }
  }
  
  /**
   * Update card balance in database using smart calculation
   */
  async recalculateAndUpdateCardBalance(cardId: string): Promise<Card> {
    try {
      logger.info('CARD_SERVICE', 'Recalculating and updating card balance', { cardId });
      
      // Calculate the smart balance
      const calculatedBalance = await this.calculateCardBalance(cardId);
      
      // Update the card's balance in Appwrite
      const updatedCard = await this.updateCard(cardId, { balance: calculatedBalance });
      
      logger.info('CARD_SERVICE', 'Card balance recalculated and updated', {
        cardId,
        newBalance: calculatedBalance
      });
      
      return updatedCard;
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to recalculate and update card balance', { cardId, error });
      throw this.handleCardError(error, 'Failed to update card balance');
    }
  }

  /**
   * Find card by card number
   * @param cardNumber The card number to search for
   * @param holderName Optional holder name for additional filtering (legacy parameter, ignored)
   */
  async findCardByNumber(cardNumber: string, holderName?: string): Promise<Card | null> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Clean card number for comparison
      const cleanCardNumber = cardNumber.replace(/\s/g, '');
      const last4 = cleanCardNumber.slice(-4);
      
      logger.info('CARD_SERVICE', 'Searching for card by number', { 
        last4, 
        holderName: holderName || 'not provided' 
      });

      // Query by last 4 digits (more secure than full number)
      const queries = [
        Query.equal('userId', userId),
        Query.equal('last4', last4),
        Query.equal('status', 'active')
      ];
      
      // Optionally filter by holder name if provided
      if (holderName?.trim()) {
        queries.push(Query.search('holder', holderName.trim()));
      }

      const response = await databaseService.listDocuments(collections.cards.id, queries);

      if (response.documents.length === 0) {
        return null;
      }

      // If multiple cards with same last 4, find exact match by full number and/or holder name
      let matchingCard = response.documents[0];
      if (response.documents.length > 1) {
        // First try to match by full card number
        matchingCard = response.documents.find(doc => 
          doc.cardNumber === cleanCardNumber || 
          doc.cardNumber === cardNumber
        );
        
        // If no exact card number match and holder name provided, try holder name match
        if (!matchingCard && holderName?.trim()) {
          matchingCard = response.documents.find(doc => 
            (doc.holder || '').toLowerCase().includes(holderName.toLowerCase())
          );
        }
        
        // Fallback to first result
        matchingCard = matchingCard || response.documents[0];
      }

      const card = this.transformAppwriteToCard(matchingCard);
      
      logger.info('CARD_SERVICE', 'Card found by number', { 
        cardId: card.id, 
        holderMatch: holderName ? (card.cardHolderName === holderName) : 'N/A' 
      });
      return card;
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to find card by number', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time card updates for current user
   */
  subscribeToCards(options: CardRealtimeOptions = {}): () => void {
    try {
      logger.info('CARD_SERVICE', 'Setting up real-time card subscriptions');

      const unsubscribe = databaseService.subscribeToCollection(
        collections.cards.id,
        (response) => {
          const { event, payload } = response;
          
          logger.info('CARD_SERVICE', 'Real-time card update received', {
            event,
            cardId: payload?.$id
          });

          // Only process events for current user's cards
          if (payload?.userId) {
            authService.getCurrentUser().then(user => {
              if (user && payload.userId === user.$id) {
                const card = this.transformAppwriteToCard(payload);
                
                switch (event) {
                  case 'databases.*.collections.*.documents.*.create':
                    options.onCardCreated?.(card);
                    break;
                  case 'databases.*.collections.*.documents.*.update':
                    options.onCardUpdated?.(card);
                    // Check for balance changes
                    if (response.oldPayload?.balance !== payload.balance) {
                      options.onBalanceChanged?.(
                        card.id,
                        card.balance,
                        response.oldPayload?.balance / 100 || 0
                      );
                    }
                    break;
                  case 'databases.*.collections.*.documents.*.delete':
                    options.onCardDeleted?.(payload.$id);
                    break;
                }
              }
            });
          }
        },
        {
          onError: (error) => {
            logger.error('CARD_SERVICE', 'Real-time subscription error', error);
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `cards_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('CARD_SERVICE', 'Unsubscribed from card updates');
      };
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to subscribe to cards', error);
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Subscribe to a specific card's updates
   */
  subscribeToCard(cardId: string, options: CardRealtimeOptions = {}): () => void {
    try {
      logger.info('CARD_SERVICE', 'Setting up real-time subscription for card', { cardId });

      const unsubscribe = databaseService.subscribeToDocument(
        collections.cards.id,
        cardId,
        (response) => {
          const { event, payload } = response;
          
          logger.info('CARD_SERVICE', 'Real-time card update received', { event, cardId });

          const card = this.transformAppwriteToCard(payload);
          
          switch (event) {
            case 'databases.*.collections.*.documents.*.update':
              options.onCardUpdated?.(card);
              // Check for balance changes
              if (response.oldPayload?.balance !== payload.balance) {
                options.onBalanceChanged?.(
                  card.id,
                  card.balance,
                  response.oldPayload?.balance || 0
                );
              }
              break;
            case 'databases.*.collections.*.documents.*.delete':
              options.onCardDeleted?.(cardId);
              break;
          }
        },
        {
          onError: (error) => {
            logger.error('CARD_SERVICE', 'Real-time card subscription error', { cardId, error });
            options.onError?.(error);
          }
        }
      );

      // Store subscription for cleanup
      const subscriptionId = `card_${cardId}_${Date.now()}`;
      this.subscriptions.set(subscriptionId, unsubscribe);

      // Return unsubscribe function
      return () => {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        logger.info('CARD_SERVICE', 'Unsubscribed from card updates', { cardId });
      };
    } catch (error) {
      logger.error('CARD_SERVICE', 'Failed to subscribe to card', { cardId, error });
      options.onError?.(error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Unsubscribe from all card subscriptions
   */
  unsubscribeAll(): void {
    logger.info('CARD_SERVICE', 'Unsubscribing from all card subscriptions', { 
      count: this.subscriptions.size 
    });
    
    this.subscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('CARD_SERVICE', 'Error unsubscribing', error);
      }
    });
    
    this.subscriptions.clear();
  }

  /**
   * Log card activity (fire-and-forget)
   */
  private async logCardActivity(cardId: string, action: string, description: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Import activity service to avoid circular dependencies
      const { databaseService: db } = await import('./database');
      
      await db.createDocument(
        collections.accountUpdates.id,
        {
          userId,
          type: 'card_activity',
          description,
          metadata: {
            cardId,
            action,
            timestamp: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      // Don't throw - this is a fire-and-forget operation
      logger.warn('CARD_SERVICE', 'Failed to log card activity', { cardId, action, error });
    }
  }

  /**
   * Handle and format card-related errors
   */
  private handleCardError(error: any, defaultMessage: string): Error {
    let message = defaultMessage;
    
    if (error?.message) {
      if (error.message.includes('Unauthorized')) {
        message = 'You do not have permission to access this card.';
      } else if (error.message.includes('not found')) {
        message = 'Card not found.';
      } else if (error.message.includes('already exists')) {
        message = 'A card with this number already exists.';
      } else {
        message = error.message;
      }
    }

    const formattedError = new Error(message);
    formattedError.stack = error?.stack;
    return formattedError;
  }
}

// Create and export card service instance
export const cardService = new AppwriteCardService();

// Export commonly used functions with proper binding
export const createCard = cardService.createCard.bind(cardService);
export const updateCard = cardService.updateCard.bind(cardService);
export const deleteCard = cardService.deleteCard.bind(cardService);
export const permanentlyDeleteCard = cardService.permanentlyDeleteCard.bind(cardService);
export const getCard = cardService.getCard.bind(cardService);
export const queryCards = cardService.queryCards.bind(cardService);
export const getActiveCards = cardService.getActiveCards.bind(cardService);
export const updateCardBalance = cardService.updateCardBalance.bind(cardService);
export const calculateCardBalance = cardService.calculateCardBalance.bind(cardService);
export const recalculateAndUpdateCardBalance = cardService.recalculateAndUpdateCardBalance.bind(cardService);
export const findCardByNumber = cardService.findCardByNumber.bind(cardService);
export const subscribeToCards = cardService.subscribeToCards.bind(cardService);
export const subscribeToCard = cardService.subscribeToCard.bind(cardService);
export const unsubscribeAll = cardService.unsubscribeAll.bind(cardService);

// Export default service
export default cardService;