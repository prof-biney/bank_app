/**
 * Appwrite Withdrawal Service
 * 
 * This module handles all withdrawal-related operations using Appwrite database with integration
 * for Ghanaian financial systems including Mobile Money (MTN, Telecel, AirtelTigo), 
 * Bank Transfers, and Cash Pickup services.
 */

import { databaseService, Query, ID, collections } from './database';
import { authService } from './auth';
import { logger } from '../logger';
import { activityLogger } from '../activityLogger';
// Cache and auto-refresh will be handled inline like transfer service
import { withdrawalPaymentsAPI, type WithdrawalPaymentRequest, type BankTransferRequest, type CashPickupRequest } from '../api/withdrawalPaymentsAPI';
import type { Card } from '@/types';

// Ghana-specific mobile networks
export type GhanaianMobileNetwork = 'mtn' | 'telecel' | 'airteltigo';

// Ghanaian banking systems
export type GhanaianBank = 'gcb' | 'ecobank' | 'stanbic' | 'absa' | 'fidelity' | 'cal_bank' | 'standard_chartered' | 'uba' | 'gt_bank' | 'other';

// Cash pickup locations
export type CashPickupProvider = 'super_express' | 'western_union' | 'moneygram' | 'express_pay' | 'other';

// Withdrawal methods available in Ghana
export type WithdrawalMethod = 'mobile_money' | 'bank_transfer' | 'cash_pickup';

export interface WithdrawalRequest {
  cardId: string;
  amount: number;
  currency: string;
  withdrawalMethod: WithdrawalMethod;
  description?: string;
  
  // Mobile Money specific fields
  mobileNetwork?: GhanaianMobileNetwork;
  mobileNumber?: string;
  recipientName?: string;
  
  // Bank Transfer specific fields
  bankName?: GhanaianBank;
  accountNumber?: string;
  accountName?: string;
  bankBranch?: string;
  
  // Cash Pickup specific fields
  pickupProvider?: CashPickupProvider;
  pickupLocation?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverIdType?: 'ghana_card' | 'voters_id' | 'passport' | 'drivers_license';
  receiverIdNumber?: string;
  
  // Optional reference and metadata
  reference?: string;
  metadata?: Record<string, any>;
}

export interface WithdrawalResponse {
  success: boolean;
  data?: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    amount: number;
    fees: number;
    netAmount: number;
    newBalance: number;
    instructions?: WithdrawalInstructions;
    reference: string;
    estimatedCompletionTime?: string;
    expiresAt?: string;
  };
  error?: string;
}

export interface WithdrawalInstructions {
  method: WithdrawalMethod;
  steps: string[];
  reference: string;
  expiresAt?: string;
  
  // Method-specific instructions
  mobileMoneyInstructions?: {
    network: GhanaianMobileNetwork;
    shortCode: string;
    ussdCode?: string;
    instructions: string[];
  };
  
  bankTransferInstructions?: {
    bankName: string;
    accountNumber: string;
    referenceNumber: string;
    processingTime: string;
  };
  
  cashPickupInstructions?: {
    provider: CashPickupProvider;
    pickupCode: string;
    locations: Array<{
      name: string;
      address: string;
      phone?: string;
      hours: string;
    }>;
  };
}

export interface WithdrawalFilters {
  cardId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  method?: WithdrawalMethod;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface WithdrawalQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: '$createdAt' | 'amount' | 'status';
  orderDirection?: 'asc' | 'desc';
  filters?: WithdrawalFilters;
}

/**
 * Appwrite Withdrawal Service Class
 */
export class AppwriteWithdrawalService {
  constructor() {
    logger.info('WITHDRAWAL_SERVICE', 'Appwrite Withdrawal Service initialized');
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated - no user ID found');
    }
    
    logger.info('WITHDRAWAL_SERVICE', 'Using userId for withdrawal operations', { userId: user.$id });
    return user.$id;
  }

  /**
   * Calculate withdrawal fees based on amount and method
   */
  private calculateWithdrawalFees(amount: number, method: WithdrawalMethod): number {
    // Ghanaian withdrawal fee structure
    let feePercentage = 0;
    let fixedFee = 0;
    let minFee = 0;
    let maxFee = 0;

    switch (method) {
      case 'mobile_money':
        // Mobile Money fees: 1% + GHS 0.50, min GHS 1.00, max GHS 10.00
        feePercentage = 0.01;
        fixedFee = 0.50;
        minFee = 1.00;
        maxFee = 10.00;
        break;
      case 'bank_transfer':
        // Bank transfer fees: 0.5% + GHS 2.00, min GHS 3.00, max GHS 25.00
        feePercentage = 0.005;
        fixedFee = 2.00;
        minFee = 3.00;
        maxFee = 25.00;
        break;
      case 'cash_pickup':
        // Cash pickup fees: 2% + GHS 1.00, min GHS 5.00, max GHS 50.00
        feePercentage = 0.02;
        fixedFee = 1.00;
        minFee = 5.00;
        maxFee = 50.00;
        break;
    }

    const calculatedFee = (amount * feePercentage) + fixedFee;
    return Math.min(Math.max(calculatedFee, minFee), maxFee);
  }

  /**
   * Generate withdrawal instructions based on method and details
   */
  private generateWithdrawalInstructions(
    withdrawalRequest: WithdrawalRequest,
    withdrawalId: string,
    fees: number
  ): WithdrawalInstructions {
    const reference = `WD-${withdrawalId.slice(-8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const baseInstructions: WithdrawalInstructions = {
      method: withdrawalRequest.withdrawalMethod,
      steps: [],
      reference,
      expiresAt,
    };

    switch (withdrawalRequest.withdrawalMethod) {
      case 'mobile_money':
        const network = withdrawalRequest.mobileNetwork!;
        const networkInfo = this.getMobileNetworkInfo(network);
        
        baseInstructions.mobileMoneyInstructions = {
          network,
          shortCode: networkInfo.shortCode,
          ussdCode: networkInfo.ussdCode,
          instructions: [
            `Your withdrawal of GHS ${withdrawalRequest.amount.toFixed(2)} is being processed`,
            `Fees: GHS ${fees.toFixed(2)}`,
            `Net amount to receive: GHS ${(withdrawalRequest.amount - fees).toFixed(2)}`,
            `The money will be sent to ${network.toUpperCase()} number: ${withdrawalRequest.mobileNumber}`,
            `Reference: ${reference}`,
            `Please ensure your mobile money wallet can receive the amount`,
            `Processing time: 2-15 minutes`,
            `You will receive an SMS confirmation when completed`
          ]
        };

        baseInstructions.steps = [
          'Withdrawal request submitted successfully',
          'Processing payment to mobile money wallet',
          'SMS confirmation will be sent upon completion',
          `Funds will be available in 2-15 minutes`
        ];
        break;

      case 'bank_transfer':
        const bankInfo = this.getBankInfo(withdrawalRequest.bankName!);
        
        baseInstructions.bankTransferInstructions = {
          bankName: bankInfo.name,
          accountNumber: withdrawalRequest.accountNumber!,
          referenceNumber: reference,
          processingTime: '1-2 business days'
        };

        baseInstructions.steps = [
          'Withdrawal request submitted successfully',
          'Processing bank transfer',
          `Funds will be transferred to ${bankInfo.name}`,
          `Account: ${withdrawalRequest.accountNumber}`,
          `Processing time: 1-2 business days`,
          'SMS/Email notification will be sent when completed'
        ];
        break;

      case 'cash_pickup':
        const provider = withdrawalRequest.pickupProvider!;
        const providerInfo = this.getCashPickupProviderInfo(provider);
        const pickupCode = `PU-${withdrawalId.slice(-6).toUpperCase()}`;
        
        baseInstructions.cashPickupInstructions = {
          provider,
          pickupCode,
          locations: providerInfo.locations
        };

        baseInstructions.steps = [
          'Cash pickup request submitted successfully',
          `Pickup Code: ${pickupCode}`,
          `Valid ID required: ${withdrawalRequest.receiverIdType?.replace('_', ' ').toUpperCase()}`,
          `Receiver: ${withdrawalRequest.receiverName}`,
          `Amount to collect: GHS ${(withdrawalRequest.amount - fees).toFixed(2)}`,
          `Available at ${providerInfo.name} locations`,
          'Code expires in 24 hours',
          'Bring valid ID for pickup'
        ];
        break;
    }

    return baseInstructions;
  }

  /**
   * Get mobile network information
   */
  private getMobileNetworkInfo(network: GhanaianMobileNetwork) {
    const networks = {
      mtn: {
        name: 'MTN Mobile Money',
        shortCode: '*170#',
        ussdCode: '*170#',
        color: '#FFCC00'
      },
      telecel: {
        name: 'Telecel Cash',
        shortCode: '*110#',
        ussdCode: '*110#',
        color: '#E31E24'
      },
      airteltigo: {
        name: 'AirtelTigo Money',
        shortCode: '*110#',
        ussdCode: '*110#',
        color: '#ED1C24'
      }
    };
    
    return networks[network];
  }

  /**
   * Get bank information
   */
  private getBankInfo(bank: GhanaianBank) {
    const banks = {
      gcb: { name: 'GCB Bank', code: 'GCB' },
      ecobank: { name: 'Ecobank Ghana', code: 'EBG' },
      stanbic: { name: 'Stanbic Bank', code: 'STB' },
      absa: { name: 'Absa Bank Ghana', code: 'ABSA' },
      fidelity: { name: 'Fidelity Bank', code: 'FID' },
      cal_bank: { name: 'CAL Bank', code: 'CAL' },
      standard_chartered: { name: 'Standard Chartered', code: 'SCB' },
      uba: { name: 'United Bank for Africa', code: 'UBA' },
      gt_bank: { name: 'GT Bank', code: 'GTB' },
      other: { name: 'Other Bank', code: 'OTH' }
    };
    
    return banks[bank] || banks.other;
  }

  /**
   * Get cash pickup provider information
   */
  private getCashPickupProviderInfo(provider: CashPickupProvider) {
    const providers = {
      super_express: {
        name: 'Super Express Services',
        locations: [
          { name: 'Accra Central', address: 'High Street, Accra', phone: '+233 30 266 1234', hours: '8AM - 6PM' },
          { name: 'Kumasi Central', address: 'Kejetia Market, Kumasi', phone: '+233 32 202 1234', hours: '8AM - 6PM' },
          { name: 'Tamale Branch', address: 'Central Market, Tamale', phone: '+233 37 202 1234', hours: '8AM - 5PM' }
        ]
      },
      western_union: {
        name: 'Western Union',
        locations: [
          { name: 'Accra Mall', address: 'Tetteh Quarshie Interchange', phone: '+233 30 276 1234', hours: '9AM - 9PM' },
          { name: 'Kumasi City Mall', address: 'Airport Roundabout, Kumasi', phone: '+233 32 205 1234', hours: '9AM - 9PM' }
        ]
      },
      moneygram: {
        name: 'MoneyGram',
        locations: [
          { name: 'Ridge Branch', address: 'Ridge Road, Accra', phone: '+233 30 223 1234', hours: '8AM - 6PM' },
          { name: 'Kejetia Branch', address: 'Kejetia Market, Kumasi', phone: '+233 32 202 5678', hours: '8AM - 6PM' }
        ]
      },
      express_pay: {
        name: 'ExpressPay Ghana',
        locations: [
          { name: 'Tema Branch', address: 'Community 1, Tema', phone: '+233 30 320 1234', hours: '8AM - 6PM' },
          { name: 'Cape Coast Branch', address: 'Central Region, Cape Coast', phone: '+233 33 213 1234', hours: '8AM - 5PM' }
        ]
      },
      other: {
        name: 'Other Provider',
        locations: [
          { name: 'Local Agent', address: 'Contact customer service', phone: '+233 XX XXX XXXX', hours: 'Varies' }
        ]
      }
    };

    return providers[provider] || providers.other;
  }

  /**
   * Process withdrawal with comprehensive error handling and validation
   */
  async processWithdrawal(withdrawalRequest: WithdrawalRequest): Promise<WithdrawalResponse & { newBalance?: number; transactionId?: string }> {
    let withdrawalId: string | null = null;
    let uploadedFileCleanup: string[] = []; // Track any files that need cleanup
    
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('WITHDRAWAL_SERVICE', 'Processing enhanced withdrawal', {
        userId,
        amount: withdrawalRequest.amount,
        method: withdrawalRequest.withdrawalMethod,
        cardId: withdrawalRequest.cardId,
        requestId: withdrawalId
      });

      // Step 1: Validate withdrawal request
      logger.info('WITHDRAWAL_SERVICE', 'Step 1: Validating withdrawal request');
      try {
        this.validateWithdrawalRequest(withdrawalRequest);
        logger.info('WITHDRAWAL_SERVICE', 'Withdrawal request validation passed');
      } catch (validationError) {
        logger.error('WITHDRAWAL_SERVICE', 'Withdrawal request validation failed', validationError);
        throw new Error(`Validation failed: ${validationError.message}`);
      }

      // Step 2: Get and validate card
      logger.info('WITHDRAWAL_SERVICE', 'Step 2: Fetching and validating card');
      let card;
      try {
        card = await databaseService.getDocument(collections.cards.id, withdrawalRequest.cardId);
        if (!card) {
          throw new Error('Card not found in database');
        }
        logger.info('WITHDRAWAL_SERVICE', 'Card retrieved successfully', {
          cardId: withdrawalRequest.cardId,
          balance: card.balance,
          cardType: card.type
        });
      } catch (cardError) {
        logger.error('WITHDRAWAL_SERVICE', 'Failed to retrieve card', cardError);
        throw new Error(`Card access failed: ${cardError.message}`);
      }

      // Step 3: Verify card ownership
      if (card.userId !== userId) {
        logger.error('WITHDRAWAL_SERVICE', 'Unauthorized card access attempt', {
          cardUserId: card.userId,
          requestUserId: userId
        });
        throw new Error('Unauthorized: Card does not belong to current user');
      }

      // Step 4: Check balance sufficiency
      const currentBalance = card.balance; // Balance is already in correct format (GHS)
      const requestedAmount = withdrawalRequest.amount;
      
      logger.info('WITHDRAWAL_SERVICE', 'Step 4: Balance verification', {
        currentBalance,
        requestedAmount,
        cardId: withdrawalRequest.cardId
      });

      if (currentBalance < requestedAmount) {
        const error = `Insufficient funds. Available: GHS ${currentBalance.toFixed(2)}, Requested: GHS ${requestedAmount.toFixed(2)}`;
        logger.error('WITHDRAWAL_SERVICE', 'Insufficient balance', {
          available: currentBalance,
          requested: requestedAmount,
          deficit: requestedAmount - currentBalance
        });
        throw new Error(error);
      }

      // Step 5: Calculate fees and final amounts
      logger.info('WITHDRAWAL_SERVICE', 'Step 5: Calculating fees and amounts');
      const fees = this.calculateWithdrawalFees(withdrawalRequest.amount, withdrawalRequest.withdrawalMethod);
      const netAmount = withdrawalRequest.amount - fees;
      const newBalance = currentBalance - requestedAmount;
      
      logger.info('WITHDRAWAL_SERVICE', 'Fee calculation completed', {
        requestedAmount,
        fees,
        netAmount,
        newBalance
      });

      // Step 6: Generate unique withdrawal ID and instructions
      logger.info('WITHDRAWAL_SERVICE', 'Step 6: Generating withdrawal ID and instructions');
      withdrawalId = ID.unique();
      
      const instructions = this.generateWithdrawalInstructions(withdrawalRequest, withdrawalId, fees);
      logger.info('WITHDRAWAL_SERVICE', 'Instructions generated', {
        withdrawalId,
        reference: instructions.reference,
        method: withdrawalRequest.withdrawalMethod
      });

      // Step 7: Process payment through external API
      logger.info('WITHDRAWAL_SERVICE', 'Step 7: Processing payment through external API');
      let paymentResult;
      
      try {
        if (withdrawalRequest.withdrawalMethod === 'mobile_money') {
          logger.info('WITHDRAWAL_SERVICE', 'Processing mobile money withdrawal');
          const paymentRequest: WithdrawalPaymentRequest = {
            cardId: withdrawalRequest.cardId,
            amount: withdrawalRequest.amount,
            currency: withdrawalRequest.currency || 'GHS',
            network: withdrawalRequest.mobileNetwork as any,
            recipientName: withdrawalRequest.recipientName || 'Recipient',
            recipientNumber: withdrawalRequest.mobileNumber || '',
            description: withdrawalRequest.description,
            reference: instructions.reference
          };
          
          paymentResult = await withdrawalPaymentsAPI.processMobileMoneyWithdrawal(paymentRequest);
          
        } else if (withdrawalRequest.withdrawalMethod === 'bank_transfer') {
          logger.info('WITHDRAWAL_SERVICE', 'Processing bank transfer withdrawal');
          const bankRequest: BankTransferRequest = {
            cardId: withdrawalRequest.cardId,
            amount: withdrawalRequest.amount,
            currency: withdrawalRequest.currency || 'GHS',
            bankCode: withdrawalRequest.bankName || '',
            accountNumber: withdrawalRequest.accountNumber || '',
            accountName: withdrawalRequest.accountName || '',
            description: withdrawalRequest.description,
            reference: instructions.reference
          };
          
          paymentResult = await withdrawalPaymentsAPI.processBankTransfer(bankRequest);
          
        } else if (withdrawalRequest.withdrawalMethod === 'cash_pickup') {
          logger.info('WITHDRAWAL_SERVICE', 'Processing cash pickup withdrawal');
          const cashRequest: CashPickupRequest = {
            cardId: withdrawalRequest.cardId,
            amount: withdrawalRequest.amount,
            currency: withdrawalRequest.currency || 'GHS',
            provider: withdrawalRequest.pickupProvider || '',
            receiverName: withdrawalRequest.receiverName || '',
            receiverPhone: withdrawalRequest.receiverPhone || '',
            receiverIdType: withdrawalRequest.receiverIdType || 'ghana_card',
            receiverIdNumber: withdrawalRequest.receiverIdNumber || '',
            description: withdrawalRequest.description,
            reference: instructions.reference
          };
          
          paymentResult = await withdrawalPaymentsAPI.processCashPickup(cashRequest);
        } else {
          throw new Error(`Unsupported withdrawal method: ${withdrawalRequest.withdrawalMethod}`);
        }
        
        logger.info('WITHDRAWAL_SERVICE', 'Payment processing completed', {
          success: paymentResult.success,
          paymentId: paymentResult.data?.paymentId,
          transactionId: paymentResult.data?.transactionId
        });
        
      } catch (paymentError) {
        logger.error('WITHDRAWAL_SERVICE', 'Payment processing failed', paymentError);
        throw new Error(`Payment processing failed: ${paymentError.message}`);
      }
      
      if (!paymentResult.success) {
        const error = paymentResult.error || 'Payment processing failed';
        logger.error('WITHDRAWAL_SERVICE', 'Payment processing returned failure', {
          error,
          paymentResult
        });
        throw new Error(error);
      }
      
      // Update fees and amounts from payment result
      const actualFees = paymentResult.data?.fees || fees;
      const actualNetAmount = paymentResult.data?.netAmount || netAmount;
      const actualNewBalance = currentBalance - withdrawalRequest.amount;

      // Create withdrawal record in database with payment details
      const enhancedWithdrawalData = {
        userId,
        cardId: withdrawalRequest.cardId,
        amount: withdrawalRequest.amount, // Keep in GHS format
        fees: actualFees,
        netAmount: actualNetAmount,
        currency: withdrawalRequest.currency || 'GHS',
        withdrawalMethod: withdrawalRequest.withdrawalMethod,
        status: paymentResult.data?.status || 'completed',
        reference: paymentResult.data?.reference || instructions.reference,
        paymentId: paymentResult.data?.paymentId,
        transactionId: paymentResult.data?.transactionId,
        
        // Method-specific data
        mobileNetwork: withdrawalRequest.mobileNetwork,
        mobileNumber: withdrawalRequest.mobileNumber,
        recipientName: withdrawalRequest.recipientName,
        bankName: withdrawalRequest.bankName,
        accountNumber: withdrawalRequest.accountNumber,
        accountName: withdrawalRequest.accountName,
        bankBranch: withdrawalRequest.bankBranch,
        pickupProvider: withdrawalRequest.pickupProvider,
        pickupLocation: withdrawalRequest.pickupLocation,
        receiverName: withdrawalRequest.receiverName,
        receiverPhone: withdrawalRequest.receiverPhone,
        receiverIdType: withdrawalRequest.receiverIdType,
        receiverIdNumber: withdrawalRequest.receiverIdNumber,
        
        description: withdrawalRequest.description,
        instructions: paymentResult.data?.instructions || instructions,
        metadata: { 
          ...withdrawalRequest.metadata, 
          paymentProcessing: paymentResult.data 
        },
        expiresAt: instructions.expiresAt,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      
      const document = await databaseService.createDocument(
        collections.transactions.id,
        enhancedWithdrawalData,
        withdrawalId
      );

      // Update card balance (keep in GHS format)
      await databaseService.updateDocument(
        collections.cards.id,
        withdrawalRequest.cardId,
        {
          balance: actualNewBalance, // Keep in GHS format
          lastTransactionDate: new Date().toISOString()
        }
      );

      // Create transaction record
      const transactionData = {
        userId,
        cardId: withdrawalRequest.cardId,
        type: 'withdrawal',
        amount: withdrawalRequest.amount, // Keep in GHS format
        currency: withdrawalRequest.currency || 'GHS',
        description: withdrawalRequest.description || `Withdrawal via ${withdrawalRequest.withdrawalMethod.replace('_', ' ')}`,
        balanceAfter: actualNewBalance,
        fees: actualFees,
        reference: paymentResult.data?.reference || instructions.reference,
        withdrawalMethod: withdrawalRequest.withdrawalMethod,
        recipient: withdrawalRequest.recipientName || withdrawalRequest.accountName || withdrawalRequest.receiverName,
        status: 'completed',
        paymentId: paymentResult.data?.paymentId,
        externalTransactionId: paymentResult.data?.transactionId,
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const transactionDoc = await databaseService.createDocument(
        collections.transactions.id,
        transactionData,
        ID.unique()
      );

      // Log activity to centralized logger (fire-and-forget)
      activityLogger.logTransactionActivity(
        document.$id,
        'completed',
        'withdrawal',
        {
          amount: withdrawalRequest.amount,
          cardId: withdrawalRequest.cardId,
          withdrawalMethod: withdrawalRequest.withdrawalMethod,
          fees: fees,
          netAmount: netAmount,
          newBalance: newBalance,
          currency: withdrawalRequest.currency || 'GHS',
          recipient: withdrawalRequest.recipientName || withdrawalRequest.accountName || withdrawalRequest.receiverName,
          status: 'completed',
          transactionId: transactionDoc.$id
        },
        `Withdrawal completed: ${withdrawalRequest.withdrawalMethod.replace('_', ' ')}`,
        userId
      ).catch(error => {
        logger.warn('WITHDRAWAL_SERVICE', 'Failed to log withdrawal activity', error);
      });

      // Clear withdrawal-related cache
      await this.clearWithdrawalCache(withdrawalRequest.cardId);
      
      // Trigger auto-refresh of relevant data (fire-and-forget)
      this.triggerAutoRefresh(withdrawalRequest.cardId);

        logger.info('WITHDRAWAL_SERVICE', 'Withdrawal processed successfully', {
        withdrawalId: document.$id,
        transactionId: transactionDoc.$id,
        paymentId: paymentResult.data?.paymentId,
        amount: withdrawalRequest.amount,
        netAmount: actualNetAmount,
        fees: actualFees,
        newBalance: actualNewBalance
      });

      return {
        success: true,
        data: {
          id: document.$id,
          status: paymentResult.data?.status || 'completed',
          amount: withdrawalRequest.amount,
          fees: actualFees,
          netAmount: actualNetAmount,
          newBalance: actualNewBalance,
          instructions: paymentResult.data?.instructions || instructions,
          reference: paymentResult.data?.reference || instructions.reference,
          estimatedCompletionTime: paymentResult.data?.estimatedCompletionTime || this.getEstimatedCompletionTime(withdrawalRequest.withdrawalMethod),
          expiresAt: instructions.expiresAt
        },
        newBalance: actualNewBalance,
        transactionId: paymentResult.data?.transactionId || transactionDoc.$id
      };

    } catch (error) {
      logger.error('WITHDRAWAL_SERVICE', 'Failed to process withdrawal', error);
      
      // Log failure activity
      try {
        const userId = await this.getCurrentUserId();
        await activityLogger.logTransactionActivity(
          'FAILED_WITHDRAWAL',
          'failed',
          'withdrawal',
          {
            amount: withdrawalRequest.amount,
            cardId: withdrawalRequest.cardId,
            withdrawalMethod: withdrawalRequest.withdrawalMethod,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId
        );
      } catch (logError) {
        logger.warn('WITHDRAWAL_SERVICE', 'Failed to log withdrawal failure activity', logError);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process withdrawal'
      };
    }
  }

  /**
   * Clear withdrawal-related cache and refresh data
   */
  private async clearWithdrawalCache(cardId: string): Promise<void> {
    try {
      // Import AsyncStorage for cache cleanup
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      // Clear transaction cache that might be stale
      await AsyncStorage.removeItem('cached_transactions');
      await AsyncStorage.removeItem('transaction_cache');
      
      // Clear card balance cache
      await AsyncStorage.removeItem(`card_balance_${cardId}`);
      
      // Clear any withdrawal history cache
      await AsyncStorage.removeItem('withdrawal_history');
      
      logger.info('WITHDRAWAL_SERVICE', 'Withdrawal cache cleared successfully');
    } catch (error) {
      logger.warn('WITHDRAWAL_SERVICE', 'Failed to clear withdrawal cache', error);
      // Non-critical error - don't fail the withdrawal
    }
  }
  
  /**
   * Trigger auto-refresh of relevant data after successful withdrawal
   */
  private async triggerAutoRefresh(cardId: string): Promise<void> {
    try {
      // Import refresh functions from app context if available
      const { refreshCardBalances, refreshTransactions, refreshNotifications } = await import('@/context/AppContext');
      
      // Trigger refresh of card balances
      setTimeout(async () => {
        try {
          if (refreshCardBalances) {
            await refreshCardBalances();
            logger.info('WITHDRAWAL_SERVICE', 'Card balances refreshed after withdrawal');
          }
        } catch (error) {
          logger.warn('WITHDRAWAL_SERVICE', 'Failed to refresh card balances', error);
        }
      }, 500);
      
      // Trigger refresh of transactions
      setTimeout(async () => {
        try {
          if (refreshTransactions) {
            await refreshTransactions();
            logger.info('WITHDRAWAL_SERVICE', 'Transactions refreshed after withdrawal');
          }
        } catch (error) {
          logger.warn('WITHDRAWAL_SERVICE', 'Failed to refresh transactions', error);
        }
      }, 1000);
      
      // Trigger refresh of notifications
      setTimeout(async () => {
        try {
          if (refreshNotifications) {
            await refreshNotifications();
            logger.info('WITHDRAWAL_SERVICE', 'Notifications refreshed after withdrawal');
          }
        } catch (error) {
          logger.warn('WITHDRAWAL_SERVICE', 'Failed to refresh notifications', error);
        }
      }, 1500);
      
    } catch (error) {
      logger.warn('WITHDRAWAL_SERVICE', 'Failed to trigger auto-refresh', error);
      // Non-critical error
    }
  }
  
  /**
   * Initiate withdrawal request (legacy method for backward compatibility)
   */
  async initiateWithdrawal(withdrawalRequest: WithdrawalRequest): Promise<WithdrawalResponse> {
    // For enhanced functionality, use processWithdrawal instead
    return this.processWithdrawal(withdrawalRequest);
  }

  /**
   * Get estimated completion time for withdrawal method
   */
  private getEstimatedCompletionTime(method: WithdrawalMethod): string {
    switch (method) {
      case 'mobile_money':
        return '5-15 minutes';
      case 'bank_transfer':
        return '1-3 business hours';
      case 'cash_pickup':
        return '15-30 minutes';
      default:
        return '1-2 hours';
    }
  }

  /**
   * Validate withdrawal request
   */
  private validateWithdrawalRequest(request: WithdrawalRequest): void {
    if (!request.cardId) {
      throw new Error('Card ID is required');
    }
    
    if (!request.amount || request.amount <= 0) {
      throw new Error('Valid withdrawal amount is required');
    }
    
    if (request.amount < 1) {
      throw new Error('Minimum withdrawal amount is GHS 1.00');
    }
    
    if (request.amount > 10000) {
      throw new Error('Maximum withdrawal amount is GHS 10,000.00');
    }

    if (!request.withdrawalMethod) {
      throw new Error('Withdrawal method is required');
    }

    // Method-specific validations
    switch (request.withdrawalMethod) {
      case 'mobile_money':
        if (!request.mobileNetwork) {
          throw new Error('Mobile network is required for mobile money withdrawals');
        }
        if (!request.mobileNumber) {
          throw new Error('Mobile number is required for mobile money withdrawals');
        }
        break;

      case 'bank_transfer':
        if (!request.bankName) {
          throw new Error('Bank name is required for bank transfer withdrawals');
        }
        if (!request.accountNumber) {
          throw new Error('Account number is required for bank transfer withdrawals');
        }
        if (!request.accountName) {
          throw new Error('Account name is required for bank transfer withdrawals');
        }
        break;

      case 'cash_pickup':
        if (!request.pickupProvider) {
          throw new Error('Pickup provider is required for cash pickup withdrawals');
        }
        if (!request.receiverName) {
          throw new Error('Receiver name is required for cash pickup withdrawals');
        }
        if (!request.receiverPhone) {
          throw new Error('Receiver phone is required for cash pickup withdrawals');
        }
        if (!request.receiverIdType) {
          throw new Error('Receiver ID type is required for cash pickup withdrawals');
        }
        if (!request.receiverIdNumber) {
          throw new Error('Receiver ID number is required for cash pickup withdrawals');
        }
        break;
    }
  }

  /**
   * Get estimated completion time for withdrawal method
   */
  private getEstimatedCompletionTime(method: WithdrawalMethod): string {
    const now = new Date();
    
    switch (method) {
      case 'mobile_money':
        // 2-15 minutes
        const mobileTime = new Date(now.getTime() + 15 * 60 * 1000);
        return mobileTime.toISOString();
      case 'bank_transfer':
        // 1-2 business days
        const bankTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        return bankTime.toISOString();
      case 'cash_pickup':
        // Available immediately for pickup
        const cashTime = new Date(now.getTime() + 30 * 60 * 1000);
        return cashTime.toISOString();
      default:
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
  }

  /**
   * Query withdrawals for current user
   */
  async queryWithdrawals(options: WithdrawalQueryOptions = {}): Promise<{ withdrawals: any[]; total: number }> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('WITHDRAWAL_SERVICE', 'Querying withdrawals for user', { userId, options });

      // Build queries
      const queries = [Query.equal('userId', userId)];

      // Add filters
      if (options.filters) {
        const { cardId, status, method, minAmount, maxAmount, dateFrom, dateTo } = options.filters;
        
        if (cardId) {
          queries.push(Query.equal('cardId', cardId));
        }
        if (status) {
          queries.push(Query.equal('status', status));
        }
        if (method) {
          queries.push(Query.equal('withdrawalMethod', method));
        }
        if (minAmount !== undefined) {
          queries.push(Query.greaterThanEqual('amount', minAmount));
        }
        if (maxAmount !== undefined) {
          queries.push(Query.lessThanEqual('amount', maxAmount));
        }
        if (dateFrom) {
          queries.push(Query.greaterThanEqual('$createdAt', dateFrom));
        }
        if (dateTo) {
          queries.push(Query.lessThanEqual('$createdAt', dateTo));
        }
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

      // Execute query
      const response = await databaseService.listDocuments(collections.transactions.id, queries);

      // Transform documents
      const withdrawals = response.documents.map(doc => ({
        id: doc.$id,
        userId: doc.userId,
        cardId: doc.cardId,
        amount: doc.amount, // Already in GHS format
        fees: doc.fees,
        netAmount: doc.netAmount,
        currency: doc.currency,
        withdrawalMethod: doc.withdrawalMethod,
        status: doc.status,
        reference: doc.reference,
        instructions: doc.instructions,
        createdAt: doc.$createdAt,
        expiresAt: doc.expiresAt,
        ...doc // Include all other fields
      }));

      logger.info('WITHDRAWAL_SERVICE', 'Withdrawals queried successfully', { 
        count: withdrawals.length, 
        total: response.total 
      });

      return { withdrawals, total: response.total };
    } catch (error) {
      logger.error('WITHDRAWAL_SERVICE', 'Failed to query withdrawals', error);
      throw error;
    }
  }

  /**
   * Get withdrawal by ID
   */
  async getWithdrawal(withdrawalId: string): Promise<any> {
    try {
      const userId = await this.getCurrentUserId();
      
      const document = await databaseService.getDocument(collections.transactions.id, withdrawalId);
      
      if (document.userId !== userId) {
        throw new Error('Unauthorized: Withdrawal does not belong to current user');
      }

      return {
        id: document.$id,
        userId: document.userId,
        cardId: document.cardId,
        amount: document.amount,
        fees: document.fees,
        netAmount: document.netAmount,
        currency: document.currency,
        withdrawalMethod: document.withdrawalMethod,
        status: document.status,
        reference: document.reference,
        instructions: document.instructions,
        createdAt: document.$createdAt,
        expiresAt: document.expiresAt,
        ...document
      };
    } catch (error) {
      logger.error('WITHDRAWAL_SERVICE', 'Failed to get withdrawal', error);
      throw error;
    }
  }

  /**
   * Update withdrawal status (for admin/system use)
   */
  async updateWithdrawalStatus(withdrawalId: string, status: string, metadata?: Record<string, any>): Promise<any> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('WITHDRAWAL_SERVICE', 'Updating withdrawal status', { withdrawalId, status });

      // Get existing withdrawal for context
      const existingWithdrawal = await this.getWithdrawal(withdrawalId);

      const updateData: any = {
        status,
        updatedAt: new Date().toISOString()
      };

      if (metadata) {
        updateData.metadata = { ...updateData.metadata, ...metadata };
      }

      if (status === 'completed') {
        updateData.completedAt = new Date().toISOString();
      } else if (status === 'failed' || status === 'cancelled') {
        updateData.failedAt = new Date().toISOString();
      }

      const document = await databaseService.updateDocument(
        collections.transactions.id,
        withdrawalId,
        updateData
      );

      // Log status change activity to centralized logger (fire-and-forget)
      activityLogger.logTransactionActivity(
        withdrawalId,
        'status_updated',
        'withdrawal',
        {
          amount: existingWithdrawal.amount,
          cardId: existingWithdrawal.cardId,
          oldStatus: existingWithdrawal.status,
          newStatus: status,
          withdrawalMethod: existingWithdrawal.withdrawalMethod,
          updatedAt: updateData.updatedAt,
        },
        `Withdrawal status changed from ${existingWithdrawal.status} to ${status}`,
        userId
      ).catch(error => {
        logger.warn('WITHDRAWAL_SERVICE', 'Failed to log withdrawal status update activity', error);
      });

      // Withdrawal status change has been logged to centralized activity logger above

      logger.info('WITHDRAWAL_SERVICE', 'Withdrawal status updated successfully', { withdrawalId, status });
      
      return {
        id: document.$id,
        status: document.status,
        updatedAt: document.updatedAt
      };
    } catch (error) {
      logger.error('WITHDRAWAL_SERVICE', 'Failed to update withdrawal status', error);
      throw error;
    }
  }
}

// Create and export withdrawal service instance
export const withdrawalService = new AppwriteWithdrawalService();

// Export commonly used functions with proper `this` binding
export const processWithdrawal = withdrawalService.processWithdrawal.bind(withdrawalService);
export const initiateWithdrawal = withdrawalService.initiateWithdrawal.bind(withdrawalService);
export const queryWithdrawals = withdrawalService.queryWithdrawals.bind(withdrawalService);
export const getWithdrawal = withdrawalService.getWithdrawal.bind(withdrawalService);
export const updateWithdrawalStatus = withdrawalService.updateWithdrawalStatus.bind(withdrawalService);

// Export default service
export default withdrawalService;
