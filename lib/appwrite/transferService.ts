/**
 * Enhanced Transfer Service
 * 
 * Handles secure transfers with card validation, balance persistence, and transaction logging.
 * Validates recipient cards exist in the database before allowing transfers.
 */

import { databaseService, Query, collections } from './database';
import { AppwriteCardService, updateCardSystem } from './cardService';
import { AppwriteTransactionService } from './transactionService';
import { AppwriteActivityService } from './activityService';
import { logger } from '../logger';
import { activityLogger } from '../activityLogger';
import { Card, Transaction } from '@/types';

// Transfer interfaces
export interface TransferRequest {
  sourceCardId: string;
  recipientCardNumber: string;
  amount: number;
  currency?: string;
  description?: string;
  recipientName?: string;
}

export interface TransferResult {
  success: boolean;
  error?: string;
  transactionId?: string;
  sourceNewBalance?: number;
  recipientNewBalance?: number;
  recipientCard?: Card;
}

export interface CardLookupResult {
  exists: boolean;
  card?: Card;
  isUserCard?: boolean;
}

// Create service instances to avoid circular dependencies
const cardService = new AppwriteCardService();
const transactionService = new AppwriteTransactionService();
const activityService = new AppwriteActivityService();

/**
 * Enhanced Transfer Service Class
 */
export class AppwriteTransferService {
  
  /**
   * Find a card by its card number across all users
   * This checks if the recipient card exists in the system
   */
  async findCardByNumber(cardNumber: string): Promise<CardLookupResult> {
    try {
      // Clean the card number (remove spaces and non-digits)
      const cleanCardNumber = cardNumber.replace(/\D/g, '');
      const last4 = cleanCardNumber.slice(-4);
      
      logger.info('TRANSFER_SERVICE', 'Looking up card by number', {
        inputLength: cleanCardNumber.length,
        last4: last4
      });
      
      // Search for cards with matching last 4 digits
      // We search by last4 field which should be indexed for performance
      const documents = await databaseService.listDocuments(
        collections.cards.id,
        [
          Query.equal('last4', last4),
          Query.equal('status', 'active'), // Only find active cards
          Query.limit(10) // Limit results for performance
        ]
      );
      
      if (documents.length === 0) {
        logger.info('TRANSFER_SERVICE', 'No cards found with matching last 4 digits', { last4 });
        return { exists: false };
      }
      
      // Find exact match by full card number (if available) or last4
      let matchedCard = null;
      
      for (const doc of documents.documents) {
        // Try to match full card number if available
        if (doc.cardNumber) {
          const docCleanNumber = doc.cardNumber.replace(/\D/g, '');
          if (docCleanNumber === cleanCardNumber) {
            matchedCard = doc;
            break;
          }
        }
        
        // Fall back to last4 match (first one found)
        if (!matchedCard && doc.last4 === last4) {
          matchedCard = doc;
        }
      }
      
      if (!matchedCard) {
        logger.info('TRANSFER_SERVICE', 'No exact card match found', { last4 });
        return { exists: false };
      }
      
      // Transform to Card type
      const card = this.transformDocumentToCard(matchedCard);
      
      logger.info('TRANSFER_SERVICE', 'Card found', {
        cardId: card.id,
        cardHolder: card.cardHolderName,
        last4: card.cardNumber.slice(-4),
      });
      
      return {
        exists: true,
        card: card,
        isUserCard: false // Will be determined by caller if needed
      };
      
    } catch (error) {
      logger.error('TRANSFER_SERVICE', 'Failed to lookup card', error);
      return { exists: false };
    }
  }
  
  /**
   * Validate transfer request and check all preconditions
   */
  async validateTransfer(transferRequest: TransferRequest): Promise<{
    isValid: boolean;
    error?: string;
    sourceCard?: Card;
    recipientCard?: Card;
  }> {
    try {
      // 1. Get source card and validate it exists and belongs to user
      const sourceCard = await cardService.getCard(transferRequest.sourceCardId);
      if (!sourceCard) {
        return { isValid: false, error: 'Source card not found' };
      }
      
      // 2. Check if source card has sufficient balance
      if (sourceCard.balance < transferRequest.amount) {
        return { 
          isValid: false, 
          error: `Insufficient funds. Available balance: ${sourceCard.currency || 'GHS'} ${sourceCard.balance.toFixed(2)}` 
        };
      }
      
      // 3. Look up recipient card in database
      const cardLookup = await this.findCardByNumber(transferRequest.recipientCardNumber);
      if (!cardLookup.exists || !cardLookup.card) {
        return { 
          isValid: false, 
          error: 'Card not registered on the system' 
        };
      }
      
      // 4. Prevent self-transfers (same card)
      if (cardLookup.card.id === transferRequest.sourceCardId) {
        return { 
          isValid: false, 
          error: 'Cannot transfer to the same card' 
        };
      }
      
      // 5. Validate amount is positive
      if (transferRequest.amount <= 0) {
        return { 
          isValid: false, 
          error: 'Transfer amount must be greater than zero' 
        };
      }
      
      return {
        isValid: true,
        sourceCard: sourceCard,
        recipientCard: cardLookup.card
      };
      
    } catch (error) {
      logger.error('TRANSFER_SERVICE', 'Transfer validation failed', error);
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }
  
  /**
   * Execute a validated transfer with balance updates and transaction logging
   */
  async executeTransfer(transferRequest: TransferRequest): Promise<TransferResult> {
    try {
      logger.info('TRANSFER_SERVICE', 'Starting transfer execution', {
        sourceCardId: transferRequest.sourceCardId,
        amount: transferRequest.amount,
        recipientLast4: transferRequest.recipientCardNumber.slice(-4)
      });
      
      // 1. Validate the transfer
      const validation = await this.validateTransfer(transferRequest);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }
      
      const { sourceCard, recipientCard } = validation;
      if (!sourceCard || !recipientCard) {
        return {
          success: false,
          error: 'Card validation failed'
        };
      }
      
      // 2. Calculate new balances
      const sourceNewBalance = sourceCard.balance - transferRequest.amount;
      const recipientNewBalance = recipientCard.balance + transferRequest.amount;
      
      logger.info('TRANSFER_SERVICE', 'Calculated new balances', {
        sourceOld: sourceCard.balance,
        sourceNew: sourceNewBalance,
        recipientOld: recipientCard.balance,
        recipientNew: recipientNewBalance
      });
      
      // 3. Update card balances (atomic-like operation)
      try {
        // Update source card balance
        await cardService.updateCard(sourceCard.id, {
          balance: sourceNewBalance
        });
        
        // Update recipient card balance (using system update since it may belong to different user)
        await updateCardSystem(recipientCard.id, {
          balance: recipientNewBalance
        });
        
        logger.info('TRANSFER_SERVICE', 'Card balances updated successfully');
        
      } catch (balanceUpdateError) {
        logger.error('TRANSFER_SERVICE', 'Failed to update card balances', balanceUpdateError);
        throw new Error('Failed to update card balances. Transfer aborted.');
      }
      
      // 4. Create transaction records
      let sourceTransactionId: string | undefined;
      
      try {
        // Create outgoing transaction for source card
        const sourceTransaction = await transactionService.createTransaction({
          userId: sourceCard.userId,
          cardId: sourceCard.id,
          type: 'transfer',
          amount: -transferRequest.amount, // Negative for outgoing
          currency: transferRequest.currency || sourceCard.currency || 'GHS',
          description: transferRequest.description || `Transfer to ${recipientCard.cardHolderName}`,
          status: 'completed',
          recipient: `${recipientCard.cardHolderName} (${transferRequest.recipientCardNumber})`,
          reference: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        
        sourceTransactionId = sourceTransaction.id;
        
        // Create incoming transaction for recipient card
        await transactionService.createTransaction({
          userId: recipientCard.userId,
          cardId: recipientCard.id,
          type: 'transfer',
          amount: transferRequest.amount, // Positive for incoming
          currency: transferRequest.currency || recipientCard.currency || 'GHS',
          description: `Transfer from ${sourceCard.cardHolderName}`,
          status: 'completed',
          sender: `${sourceCard.cardHolderName} (${sourceCard.cardNumber.slice(-4)})`,
          reference: sourceTransaction.reference // Same reference for linked transactions
        });
        
        logger.info('TRANSFER_SERVICE', 'Transaction records created', {
          sourceTransactionId: sourceTransaction.id
        });
        
      } catch (transactionError) {
        logger.error('TRANSFER_SERVICE', 'Failed to create transaction records', transactionError);
        // Note: At this point balances are already updated
        // In a production system, you might want to implement compensation logic
      }
      
      // 5. Clear transfer-related cache
      await this.clearTransferCache(sourceCard.id, recipientCard.id);
      
      // 6. Log activity events (fire-and-forget)
      this.logTransferActivity(sourceCard, recipientCard, transferRequest.amount, sourceTransactionId);
      
      // 7. Trigger auto-refresh of relevant data (fire-and-forget)
      this.triggerAutoRefresh(sourceCard.id, recipientCard.id);
      
      logger.info('TRANSFER_SERVICE', 'Transfer completed successfully with cache cleanup and auto-refresh', {
        transactionId: sourceTransactionId,
        sourceNewBalance,
        recipientNewBalance
      });
      
      return {
        success: true,
        transactionId: sourceTransactionId,
        sourceNewBalance,
        recipientNewBalance,
        recipientCard
      };
      
    } catch (error) {
      logger.error('TRANSFER_SERVICE', 'Transfer execution failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }
  
  /**
   * Clear transfer-related cache and refresh data
   */
  private async clearTransferCache(sourceCardId: string, recipientCardId: string): Promise<void> {
    try {
      // Import AsyncStorage for cache cleanup
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      // Clear transaction cache that might be stale
      await AsyncStorage.removeItem('cached_transactions');
      await AsyncStorage.removeItem('transaction_cache');
      
      // Clear card balance cache
      await AsyncStorage.removeItem(`card_balance_${sourceCardId}`);
      await AsyncStorage.removeItem(`card_balance_${recipientCardId}`);
      
      // Clear any transfer history cache
      await AsyncStorage.removeItem('transfer_history');
      
      logger.info('TRANSFER_SERVICE', 'Transfer cache cleared successfully');
    } catch (error) {
      logger.warn('TRANSFER_SERVICE', 'Failed to clear transfer cache', error);
      // Non-critical error - don't fail the transfer
    }
  }
  
  /**
   * Trigger auto-refresh of relevant data after successful transfer
   */
  private async triggerAutoRefresh(sourceCardId: string, recipientCardId: string): Promise<void> {
    try {
      logger.info('TRANSFER_SERVICE', 'Transfer completed, data refresh will be handled by calling component');
      
      // Note: Data refresh is now handled by the calling component (makeTransfer in AppContext)
      // This avoids circular import issues and keeps the refresh logic where it belongs
      
      // The transfer service just focuses on the core transfer logic
      // Refresh is triggered in AppContext after successful transfer
      
    } catch (error) {
      logger.warn('TRANSFER_SERVICE', 'Failed to log refresh trigger', error);
      // Non-critical error
    }
  }
  
  /**
   * Log transfer activity events using centralized logger (fire-and-forget)
   */
  private async logTransferActivity(
    sourceCard: Card, 
    recipientCard: Card, 
    amount: number, 
    transactionId?: string
  ): Promise<void> {
    try {
      // Log outgoing transfer activity for sender using centralized logger
      await activityLogger.logTransactionActivity(
        'completed',
        transactionId || `transfer_${Date.now()}`,
        {
          type: 'transfer',
          amount: amount,
          cardId: sourceCard.id,
          recipientCardId: recipientCard.id,
          description: `Transfer sent to ${recipientCard.cardHolderName}`
        },
        sourceCard.userId
      );
      
      // Log incoming transfer activity for recipient using centralized logger
      await activityLogger.logTransactionActivity(
        'completed',
        transactionId || `transfer_${Date.now()}_in`,
        {
          type: 'transfer',
          amount: amount,
          cardId: recipientCard.id,
          recipientCardId: sourceCard.id,
          description: `Transfer received from ${sourceCard.cardHolderName}`
        },
        recipientCard.userId
      );

      logger.info('TRANSFER_SERVICE', 'Transfer activity logged successfully');
      
    } catch (error) {
      logger.warn('TRANSFER_SERVICE', 'Failed to log transfer activity', error);
      // Don't fail the transfer for activity logging issues
    }
  }
  
  /**
   * Transform Appwrite document to Card type
   */
  private transformDocumentToCard(doc: any): Card {
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
      balance: doc.balance ? (doc.balance / 100) : 0, // Convert from cents
      currency: doc.currency || 'GHS',
      token: doc.token,
      isActive: doc.status ? (doc.status !== 'inactive') : (doc.isActive !== false),
    };
  }
}

// Export singleton instance
export const transferService = new AppwriteTransferService();
export default transferService;