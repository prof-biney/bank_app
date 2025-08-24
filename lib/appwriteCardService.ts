import { ID, Query } from 'react-native-appwrite';
import { databases, appwriteConfig, logCardEvent, ensureAuthenticatedClient } from './appwrite';
import { Card } from '@/types';
import useAuthStore from '@/store/auth.store';

/**
 * Appwrite Card Database Service
 * 
 * Handles all card CRUD operations with Appwrite database.
 * Ensures all operations are scoped to the current authenticated user.
 */

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
}

/**
 * Get current authenticated user ID
 */
function getCurrentUserId(): string {
  const { user } = useAuthStore.getState();
  // Handle both id and $id fields for compatibility
  const userId = (user as any)?.id || (user as any)?.$id;
  if (!userId) {
    console.error('[getCurrentUserId] User object:', user);
    throw new Error('User not authenticated - no user ID found');
  }
  return userId;
}

/**
 * Create a new card in Appwrite database
 */
export async function createAppwriteCard(cardData: CreateCardData): Promise<Card> {
  const { cardsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !cardsCollectionId) {
    throw new Error('Appwrite cards collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();
    
    const documentData = {
      userId,
      cardNumber: cardData.cardNumber,
      cardHolderName: cardData.cardHolderName,
      expiryDate: cardData.expiryDate,
      cardType: cardData.cardType,
      cardColor: cardData.cardColor,
      balance: cardData.balance || 0,
      currency: cardData.currency || 'GHS',
      token: cardData.token || '',
      isActive: cardData.isActive !== false, // Default to true
    };

    console.log('[createAppwriteCard] Creating card:', {
      userId,
      cardHolderName: cardData.cardHolderName,
      cardType: cardData.cardType,
      balance: documentData.balance
    });

    const document = await databases.createDocument(
      databaseId,
      cardsCollectionId,
      ID.unique(),
      documentData
    );

    // Convert Appwrite document to Card type
    const card: Card = {
      id: document.$id,
      userId: document.userId,
      cardNumber: document.cardNumber,
      cardHolderName: document.cardHolderName,
      expiryDate: document.expiryDate,
      cardType: document.cardType,
      cardColor: document.cardColor,
      balance: document.balance,
      currency: document.currency,
      token: document.token,
      isActive: document.isActive !== undefined ? document.isActive : true, // Default to true if field doesn't exist
    };

    // Log card event for activity tracking (fire-and-forget)
    try {
      const last4 = cardData.cardNumber.slice(-4);
      logCardEvent({
        status: 'added',
        cardId: card.id,
        userId: card.userId,
        last4,
        brand: card.cardType,
        cardHolderName: card.cardHolderName,
        expiryDate: card.expiryDate,
        title: 'Card added',
        description: `${card.cardHolderName} • ${card.cardNumber}`,
      }).catch(error => {
        console.warn('[createAppwriteCard] Failed to log card event:', error);
      });
    } catch (error) {
      console.warn('[createAppwriteCard] Card event logging failed:', error);
    }

    console.log('[createAppwriteCard] Card created successfully:', card.id);
    return card;

  } catch (error) {
    console.error('[createAppwriteCard] Failed to create card:', error);
    throw new Error(`Failed to create card: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update an existing card in Appwrite database
 */
export async function updateAppwriteCard(
  cardId: string, 
  updateData: UpdateCardData
): Promise<Card> {
  const { cardsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !cardsCollectionId) {
    throw new Error('Appwrite cards collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();

    console.log('[updateAppwriteCard] Updating card:', {
      cardId,
      userId,
      updateData
    });

    // First verify the card belongs to the current user
    const existingDoc = await databases.getDocument(
      databaseId,
      cardsCollectionId,
      cardId
    );

    if (existingDoc.userId !== userId) {
      throw new Error('Unauthorized: Card does not belong to current user');
    }

    const document = await databases.updateDocument(
      databaseId,
      cardsCollectionId,
      cardId,
      updateData
    );

    // Convert Appwrite document to Card type
    const card: Card = {
      id: document.$id,
      userId: document.userId,
      cardNumber: document.cardNumber,
      cardHolderName: document.cardHolderName,
      expiryDate: document.expiryDate,
      cardType: document.cardType,
      cardColor: document.cardColor,
      balance: document.balance,
      currency: document.currency,
      token: document.token,
      isActive: document.isActive !== undefined ? document.isActive : true, // Default to true if field doesn't exist
    };

    console.log('[updateAppwriteCard] Card updated successfully:', card.id);
    return card;

  } catch (error) {
    console.error('[updateAppwriteCard] Failed to update card:', error);
    throw new Error(`Failed to update card: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a card from Appwrite database (sets isActive to false)
 */
export async function deleteAppwriteCard(cardId: string): Promise<void> {
  const { cardsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !cardsCollectionId) {
    throw new Error('Appwrite cards collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();

    console.log('[deleteAppwriteCard] Deactivating card:', {
      cardId,
      userId
    });

    // First verify the card belongs to the current user
    const existingDoc = await databases.getDocument(
      databaseId,
      cardsCollectionId,
      cardId
    );

    if (existingDoc.userId !== userId) {
      throw new Error('Unauthorized: Card does not belong to current user');
    }

    // Instead of deleting, set isActive to false for data integrity
    await databases.updateDocument(
      databaseId,
      cardsCollectionId,
      cardId,
      { isActive: false }
    );

    // Log card event for activity tracking (fire-and-forget)
    try {
      const last4 = existingDoc.cardNumber.slice(-4);
      logCardEvent({
        status: 'removed',
        cardId: existingDoc.$id,
        userId: existingDoc.userId,
        last4,
        brand: existingDoc.cardType,
        cardHolderName: existingDoc.cardHolderName,
        expiryDate: existingDoc.expiryDate,
        title: 'Card removed',
        description: `${existingDoc.cardHolderName} • ${existingDoc.cardNumber}`,
      }).catch(error => {
        console.warn('[deleteAppwriteCard] Failed to log card event:', error);
      });
    } catch (error) {
      console.warn('[deleteAppwriteCard] Card event logging failed:', error);
    }

    console.log('[deleteAppwriteCard] Card deactivated successfully:', cardId);

  } catch (error) {
    console.error('[deleteAppwriteCard] Failed to delete card:', error);
    throw new Error(`Failed to delete card: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Permanently delete a card from Appwrite database
 */
export async function permanentlyDeleteAppwriteCard(cardId: string): Promise<void> {
  const { cardsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !cardsCollectionId) {
    throw new Error('Appwrite cards collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();

    console.log('[permanentlyDeleteAppwriteCard] Permanently deleting card:', {
      cardId,
      userId
    });

    // First verify the card belongs to the current user
    const existingDoc = await databases.getDocument(
      databaseId,
      cardsCollectionId,
      cardId
    );

    if (existingDoc.userId !== userId) {
      throw new Error('Unauthorized: Card does not belong to current user');
    }

    await databases.deleteDocument(
      databaseId,
      cardsCollectionId,
      cardId
    );

    console.log('[permanentlyDeleteAppwriteCard] Card permanently deleted:', cardId);

  } catch (error) {
    console.error('[permanentlyDeleteAppwriteCard] Failed to permanently delete card:', error);
    throw new Error(`Failed to permanently delete card: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a single card by ID for the current user
 */
export async function getAppwriteCard(cardId: string): Promise<Card> {
  const { cardsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !cardsCollectionId) {
    throw new Error('Appwrite cards collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();

    const document = await databases.getDocument(
      databaseId,
      cardsCollectionId,
      cardId
    );

    if (document.userId !== userId) {
      throw new Error('Unauthorized: Card does not belong to current user');
    }

    // Convert Appwrite document to Card type
    const card: Card = {
      id: document.$id,
      userId: document.userId,
      cardNumber: document.cardNumber,
      cardHolderName: document.cardHolderName,
      expiryDate: document.expiryDate,
      cardType: document.cardType,
      cardColor: document.cardColor,
      balance: document.balance,
      currency: document.currency,
      token: document.token,
      isActive: document.isActive !== undefined ? document.isActive : true, // Default to true if field doesn't exist
    };

    return card;

  } catch (error) {
    console.error('[getAppwriteCard] Failed to get card:', error);
    throw new Error(`Failed to get card: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Query cards for the current user
 */
export async function queryAppwriteCards(options: {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  cardType?: string;
  orderBy?: 'cardHolderName' | '$createdAt';
  orderDirection?: 'asc' | 'desc';
} = {}): Promise<{ cards: Card[]; total: number }> {
  const { cardsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !cardsCollectionId) {
    throw new Error('Appwrite cards collection not configured');
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();
    console.log('[queryAppwriteCards] Using userId for query:', userId);
    console.log('[queryAppwriteCards] Auth state from store:', {
      isAuthenticated: useAuthStore.getState().isAuthenticated,
      user: useAuthStore.getState().user ? 'present' : 'null'
    });
    const queries = [Query.equal('userId', userId)];

    // Add optional filters
    if (options.isActive !== undefined) {
      queries.push(Query.equal('isActive', options.isActive));
    }
    if (options.cardType) {
      queries.push(Query.equal('cardType', options.cardType));
    }

    // Add ordering
    const orderBy = options.orderBy || '$createdAt';
    const orderDirection = options.orderDirection || 'desc';
    if (orderDirection === 'desc') {
      queries.push(Query.orderDesc(orderBy));
    } else {
      queries.push(Query.orderAsc(orderBy));
    }

    // Add pagination
    if (options.limit) {
      queries.push(Query.limit(options.limit));
    }
    if (options.offset) {
      queries.push(Query.offset(options.offset));
    }

    console.log('[queryAppwriteCards] Querying cards for user:', userId);

    const response = await databases.listDocuments(
      databaseId,
      cardsCollectionId,
      queries
    );

    // Convert documents to Card types
    const cards: Card[] = response.documents.map(doc => ({
      id: doc.$id,
      userId: doc.userId,
      cardNumber: doc.cardNumber,
      cardHolderName: doc.cardHolderName,
      expiryDate: doc.expiryDate,
      cardType: doc.cardType,
      cardColor: doc.cardColor,
      balance: doc.balance,
      currency: doc.currency,
      token: doc.token,
      isActive: doc.isActive !== undefined ? doc.isActive : true, // Default to true if field doesn't exist
    }));

    console.log('[queryAppwriteCards] Found', cards.length, 'cards');

    return {
      cards,
      total: response.total
    };

  } catch (error) {
    console.error('[queryAppwriteCards] Failed to query cards:', error);
    throw new Error(`Failed to query cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all active cards for the current user
 */
export async function getAppwriteActiveCards(): Promise<Card[]> {
  try {
    // Don't filter by isActive since the field doesn't exist in the Appwrite schema
    const result = await queryAppwriteCards({
      orderBy: '$createdAt',
      orderDirection: 'desc'
    });
    // Filter locally for isActive if the field exists
    return result.cards.filter(card => card.isActive !== false);
  } catch (error) {
    console.error('[getAppwriteActiveCards] Failed to get active cards:', error);
    return [];
  }
}

/**
 * Update card balance
 */
export async function updateAppwriteCardBalance(cardId: string, newBalance: number): Promise<Card> {
  try {
    console.log('[updateAppwriteCardBalance] Updating card balance:', {
      cardId,
      newBalance
    });

    return await updateAppwriteCard(cardId, { balance: newBalance });
  } catch (error) {
    console.error('[updateAppwriteCardBalance] Failed to update card balance:', error);
    throw error;
  }
}

/**
 * Find card by card number (for internal transfers)
 */
export async function findAppwriteCardByNumber(cardNumber: string): Promise<Card | null> {
  const { cardsCollectionId, databaseId } = appwriteConfig;
  
  if (!databaseId || !cardsCollectionId) {
    console.warn('[findAppwriteCardByNumber] Appwrite cards collection not configured');
    return null;
  }

  try {
    // Ensure the authenticated client has a valid JWT token
    const isAuthenticated = await ensureAuthenticatedClient();
    if (!isAuthenticated) {
      throw new Error('User not authenticated - could not obtain JWT token');
    }
    
    const userId = getCurrentUserId();
    
    // Clean card number for comparison
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    
    const queries = [
      Query.equal('userId', userId),
      Query.equal('cardNumber', cleanCardNumber)
      // Note: isActive filter removed since field doesn't exist in Appwrite schema
    ];

    console.log('[findAppwriteCardByNumber] Searching for card number ending in:', cleanCardNumber.slice(-4));

    const response = await databases.listDocuments(
      databaseId,
      cardsCollectionId,
      queries
    );

    if (response.documents.length === 0) {
      return null;
    }

    const document = response.documents[0];
    const card: Card = {
      id: document.$id,
      userId: document.userId,
      cardNumber: document.cardNumber,
      cardHolderName: document.cardHolderName,
      expiryDate: document.expiryDate,
      cardType: document.cardType,
      cardColor: document.cardColor,
      balance: document.balance,
      currency: document.currency,
      token: document.token,
      isActive: document.isActive !== undefined ? document.isActive : true, // Default to true if field doesn't exist
    };

    console.log('[findAppwriteCardByNumber] Found card:', card.id);
    return card;

  } catch (error) {
    console.error('[findAppwriteCardByNumber] Failed to find card by number:', error);
    return null;
  }
}
