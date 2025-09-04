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
  // User objects from getCurrentUser() have $id field (Appwrite documents)
  // Check for $id first since that's the standard Appwrite document field
  const userId = (user as any)?.$id || (user as any)?.id;
  if (!userId) {
    console.error('[getCurrentUserId] User object:', user);
    console.error('[getCurrentUserId] Available user fields:', user ? Object.keys(user) : 'null');
    throw new Error('User not authenticated - no user ID found');
  }
  console.log('[getCurrentUserId] Using userId:', userId);
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
    
    // Parse expiry date (MM/YY format)
    const [expMonth, expYear] = cardData.expiryDate.split('/');
    const fullYear = expYear.length === 2 ? 2000 + parseInt(expYear) : parseInt(expYear);
    
    const documentData = {
      userId,
      cardNumber: cardData.cardNumber, // Store full card number
      last4: cardData.cardNumber.replace(/[^\d]/g, '').slice(-4), // Extract last 4 digits
      holder: cardData.cardHolderName,
      brand: cardData.cardType,
      exp_month: parseInt(expMonth),
      exp_year: fullYear,
      color: cardData.cardColor,
      balance: Math.round((cardData.balance || 0) * 100), // Convert to cents
      currency: cardData.currency || 'GHS',
      token: cardData.token || null,
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

    // Convert Appwrite document to Card type (mapping schema fields)
    const card: Card = {
      id: document.$id,
      userId: document.userId,
      cardNumber: `****-****-****-${document.last4}`,
      cardHolderName: document.holder,
      expiryDate: `${document.exp_month.toString().padStart(2, '0')}/${document.exp_year.toString().slice(-2)}`,
      cardType: document.brand || 'card',
      cardColor: document.color || '#1e40af',
      balance: document.balance / 100, // Convert from cents to dollars
      currency: document.currency,
      token: document.token,
      isActive: document.status !== 'inactive',
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

    // Transform updateData to match Appwrite schema
    const transformedUpdateData: any = {};
    
    if (updateData.balance !== undefined) {
      transformedUpdateData.balance = Math.round(updateData.balance * 100); // Convert to cents
    }
    if (updateData.cardHolderName !== undefined) {
      transformedUpdateData.holder = updateData.cardHolderName;
    }
    if (updateData.cardColor !== undefined) {
      transformedUpdateData.color = updateData.cardColor;
    }
    if (updateData.isActive !== undefined) {
      transformedUpdateData.status = updateData.isActive ? 'active' : 'inactive';
    }
    if (updateData.expiryDate !== undefined) {
      const [expMonth, expYear] = updateData.expiryDate.split('/');
      transformedUpdateData.exp_month = parseInt(expMonth);
      transformedUpdateData.exp_year = expYear.length === 2 ? 2000 + parseInt(expYear) : parseInt(expYear);
    }

    const document = await databases.updateDocument(
      databaseId,
      cardsCollectionId,
      cardId,
      transformedUpdateData
    );

    // Convert Appwrite document to Card type (mapping schema fields)
    const card: Card = {
      id: document.$id,
      userId: document.userId,
      cardNumber: `****-****-****-${document.last4}`, // Reconstruct from last4
      cardHolderName: document.holder,
      expiryDate: `${document.exp_month.toString().padStart(2, '0')}/${document.exp_year.toString().slice(-2)}`,
      cardType: document.brand || 'card',
      cardColor: document.color || '#1e40af',
      balance: document.balance / 100, // Convert from cents to dollars
      currency: document.currency,
      token: document.token,
      isActive: document.status !== 'inactive', // Map status to isActive
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

    // Instead of deleting, set status to inactive for data integrity
    await databases.updateDocument(
      databaseId,
      cardsCollectionId,
      cardId,
      { status: 'inactive' }
    );

    // Log card event for activity tracking (fire-and-forget)
    try {
      const last4 = existingDoc.last4 || (existingDoc.cardNumber ? existingDoc.cardNumber.slice(-4) : '****');
      logCardEvent({
        status: 'removed',
        cardId: existingDoc.$id,
        userId: existingDoc.userId,
        last4,
        brand: existingDoc.brand || existingDoc.cardType || 'card',
        cardHolderName: existingDoc.holder || existingDoc.cardHolderName,
        expiryDate: existingDoc.exp_month ? `${existingDoc.exp_month.toString().padStart(2, '0')}/${existingDoc.exp_year.toString().slice(-2)}` : existingDoc.expiryDate,
        title: 'Card removed',
        description: `${existingDoc.holder || existingDoc.cardHolderName} • ****-****-****-${last4}`,
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

    // Convert Appwrite document to Card type (mapping schema fields)
    const cards: Card[] = response.documents.map(doc => ({
      id: doc.$id,
      userId: doc.userId,
      cardNumber: `****-****-****-${doc.last4}`, // Reconstruct card number from last4
      cardHolderName: doc.holder,
      expiryDate: `${doc.exp_month.toString().padStart(2, '0')}/${doc.exp_year.toString().slice(-2)}`,
      cardType: doc.brand || doc.type || 'card',
      cardColor: doc.color || '#1e40af', // Default color
      balance: doc.balance / 100, // Convert from cents to dollars
      currency: doc.currency,
      token: doc.token,
      isActive: doc.status !== 'inactive', // Map status to isActive
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
    // Convert Appwrite document to Card type (mapping schema fields)
    const card: Card = {
      id: document.$id,
      userId: document.userId,
      cardNumber: document.cardNumber || `****-****-****-${document.last4}`,
      cardHolderName: document.holder || document.cardHolderName,
      expiryDate: document.exp_month ? `${document.exp_month.toString().padStart(2, '0')}/${document.exp_year.toString().slice(-2)}` : document.expiryDate,
      cardType: document.brand || document.cardType || 'card',
      cardColor: document.color || document.cardColor || '#1e40af',
      balance: document.balance ? (document.balance / 100) : 0, // Convert from cents to dollars
      currency: document.currency,
      token: document.token,
      isActive: document.status ? (document.status !== 'inactive') : (document.isActive !== false),
    };

    console.log('[findAppwriteCardByNumber] Found card:', card.id);
    return card;

  } catch (error) {
    console.error('[findAppwriteCardByNumber] Failed to find card by number:', error);
    return null;
  }
}
