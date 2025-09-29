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
   * Initiate withdrawal request
   */
  async initiateWithdrawal(withdrawalRequest: WithdrawalRequest): Promise<WithdrawalResponse> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('WITHDRAWAL_SERVICE', 'Initiating withdrawal', {
        userId,
        amount: withdrawalRequest.amount,
        method: withdrawalRequest.withdrawalMethod,
        cardId: withdrawalRequest.cardId
      });

      // Validate withdrawal request
      this.validateWithdrawalRequest(withdrawalRequest);

      // Calculate fees
      const fees = this.calculateWithdrawalFees(withdrawalRequest.amount, withdrawalRequest.withdrawalMethod);
      const netAmount = withdrawalRequest.amount - fees;

      // Generate unique withdrawal ID
      const withdrawalId = ID.unique();
      
      // Generate instructions
      const instructions = this.generateWithdrawalInstructions(withdrawalRequest, withdrawalId, fees);

      // Prepare withdrawal data for database
      const withdrawalData = {
        userId,
        cardId: withdrawalRequest.cardId,
        amount: Math.round(withdrawalRequest.amount * 100), // Convert to cents
        fees: Math.round(fees * 100),
        netAmount: Math.round(netAmount * 100),
        currency: withdrawalRequest.currency || 'GHS',
        withdrawalMethod: withdrawalRequest.withdrawalMethod,
        status: 'pending',
        reference: instructions.reference,
        
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
        instructions: instructions,
        metadata: withdrawalRequest.metadata || {},
        expiresAt: instructions.expiresAt,
        createdAt: new Date().toISOString(),
      };

      // Create withdrawal record in database
      const document = await databaseService.createDocument(
        collections.withdrawals.id,
        withdrawalData,
        withdrawalId
      );

      logger.info('WITHDRAWAL_SERVICE', 'Withdrawal request created successfully', {
        withdrawalId: document.$id,
        amount: withdrawalRequest.amount,
        netAmount,
        fees
      });

      return {
        success: true,
        data: {
          id: document.$id,
          status: 'pending',
          amount: withdrawalRequest.amount,
          fees,
          netAmount,
          newBalance: 0, // Will be updated after processing
          instructions,
          reference: instructions.reference,
          estimatedCompletionTime: this.getEstimatedCompletionTime(withdrawalRequest.withdrawalMethod),
          expiresAt: instructions.expiresAt
        }
      };

    } catch (error) {
      logger.error('WITHDRAWAL_SERVICE', 'Failed to initiate withdrawal', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate withdrawal'
      };
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
          queries.push(Query.greaterThanEqual('amount', Math.round(minAmount * 100)));
        }
        if (maxAmount !== undefined) {
          queries.push(Query.lessThanEqual('amount', Math.round(maxAmount * 100)));
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
      const response = await databaseService.listDocuments(collections.withdrawals.id, queries);

      // Transform documents
      const withdrawals = response.documents.map(doc => ({
        id: doc.$id,
        userId: doc.userId,
        cardId: doc.cardId,
        amount: doc.amount / 100, // Convert from cents
        fees: doc.fees / 100,
        netAmount: doc.netAmount / 100,
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
      
      const document = await databaseService.getDocument(collections.withdrawals.id, withdrawalId);
      
      if (document.userId !== userId) {
        throw new Error('Unauthorized: Withdrawal does not belong to current user');
      }

      return {
        id: document.$id,
        userId: document.userId,
        cardId: document.cardId,
        amount: document.amount / 100,
        fees: document.fees / 100,
        netAmount: document.netAmount / 100,
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
      logger.info('WITHDRAWAL_SERVICE', 'Updating withdrawal status', { withdrawalId, status });

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
        collections.withdrawals.id,
        withdrawalId,
        updateData
      );

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

// Export commonly used functions
export const {
  initiateWithdrawal,
  queryWithdrawals,
  getWithdrawal,
  updateWithdrawalStatus
} = withdrawalService;

// Export default service
export default withdrawalService;