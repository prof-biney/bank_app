/**
 * Withdrawal Payments API
 * 
 * Enhanced payments API specifically for processing withdrawals across different
 * Ghanaian mobile money networks (MTN, Telecel, AirtelTigo) with proper recipient
 * validation and processing.
 */

import { executeFunction } from '../api';
import { logger } from '../logger';
import { paymentService, type CreatePaymentData } from '../appwrite/paymentService';

// Supported Ghanaian mobile networks
export type GhanaianMobileNetwork = 'mtn' | 'telecel' | 'airteltigo';

// Network configurations for processing
const NETWORK_CONFIGS = {
  mtn: {
    name: 'MTN Mobile Money',
    shortCode: '*170#',
    processingFee: 0.01, // 1%
    minAmount: 1,
    maxAmount: 10000,
    apiEndpoint: 'mtn_mobile_money',
    ussdCode: '*170#',
  },
  telecel: {
    name: 'Telecel Cash',
    shortCode: '*110#',
    processingFee: 0.015, // 1.5%
    minAmount: 1,
    maxAmount: 8000,
    apiEndpoint: 'telecel_cash',
    ussdCode: '*110#',
  },
  airteltigo: {
    name: 'AirtelTigo Money',
    shortCode: '*110#',
    processingFee: 0.012, // 1.2%
    minAmount: 1,
    maxAmount: 9000,
    apiEndpoint: 'airteltigo_money',
    ussdCode: '*110#',
  },
} as const;

// Withdrawal request interface
export interface WithdrawalPaymentRequest {
  cardId: string;
  amount: number;
  currency: string;
  network: GhanaianMobileNetwork;
  recipientName: string;
  recipientNumber: string;
  description?: string;
  reference?: string;
}

// Withdrawal response interface
export interface WithdrawalPaymentResponse {
  success: boolean;
  data?: {
    paymentId: string;
    transactionId: string;
    reference: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    fees: number;
    netAmount: number;
    estimatedCompletionTime: string;
    instructions: {
      network: string;
      recipientNumber: string;
      recipientName: string;
      amount: number;
      reference: string;
      steps: string[];
      ussdCode?: string;
    };
  };
  error?: string;
}

// Bank transfer request interface
export interface BankTransferRequest {
  cardId: string;
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  description?: string;
  reference?: string;
}

// Cash pickup request interface
export interface CashPickupRequest {
  cardId: string;
  amount: number;
  currency: string;
  provider: string;
  receiverName: string;
  receiverPhone: string;
  receiverIdType: string;
  receiverIdNumber: string;
  description?: string;
  reference?: string;
}

/**
 * Withdrawal Payments API Class
 */
export class WithdrawalPaymentsAPI {
  constructor() {
    logger.info('WITHDRAWAL_PAYMENTS_API', 'Withdrawal Payments API initialized');
  }

  /**
   * Validate mobile number format for Ghanaian networks with enhanced checks
   */
  private validateMobileNumber(number: string, network: GhanaianMobileNetwork): { isValid: boolean; error?: string } {
    if (!number || typeof number !== 'string') {
      return { isValid: false, error: 'Mobile number is required' };
    }

    // Remove all non-digits and clean the input
    const cleaned = number.replace(/\D/g, '');
    
    if (cleaned.length === 0) {
      return { isValid: false, error: 'Mobile number cannot be empty' };
    }
    
    // Ghana mobile numbers should be 10 digits (without country code) or 13 digits (with +233)
    if (cleaned.length === 10) {
      // Check network-specific prefixes with enhanced validation
      switch (network) {
        case 'mtn':
          if (/^0?(24|25|53|54|55|59)\d{7}$/.test(cleaned)) {
            return { isValid: true };
          }
          return { isValid: false, error: 'Invalid MTN number format. MTN numbers start with 024, 025, 053, 054, 055, or 059' };
          
        case 'telecel':
          if (/^0?(20|27|28|57)\d{7}$/.test(cleaned)) {
            return { isValid: true };
          }
          return { isValid: false, error: 'Invalid Telecel number format. Telecel numbers start with 020, 027, 028, or 057' };
          
        case 'airteltigo':
          if (/^0?(26|56|78)\d{7}$/.test(cleaned)) {
            return { isValid: true };
          }
          return { isValid: false, error: 'Invalid AirtelTigo number format. AirtelTigo numbers start with 026, 056, or 078' };
          
        default:
          return { isValid: false, error: 'Unsupported mobile network' };
      }
    }
    
    if (cleaned.length === 13 && cleaned.startsWith('233')) {
      const localNumber = cleaned.substring(3);
      return this.validateMobileNumber('0' + localNumber, network);
    }
    
    if (cleaned.length < 10) {
      return { isValid: false, error: 'Mobile number is too short. Ghana numbers should have 10 digits' };
    }
    
    if (cleaned.length > 13) {
      return { isValid: false, error: 'Mobile number is too long' };
    }
    
    return { isValid: false, error: 'Invalid mobile number format' };
  }

  /**
   * Validate bank account details for Ghana
   */
  private validateBankAccount(accountNumber: string, accountName: string, bankCode: string): { isValid: boolean; error?: string } {
    if (!accountNumber || typeof accountNumber !== 'string') {
      return { isValid: false, error: 'Account number is required' };
    }

    if (!accountName || typeof accountName !== 'string') {
      return { isValid: false, error: 'Account holder name is required' };
    }

    if (!bankCode || typeof bankCode !== 'string') {
      return { isValid: false, error: 'Bank code is required' };
    }

    // Clean account number
    const cleanedAccountNumber = accountNumber.replace(/\D/g, '');
    
    if (cleanedAccountNumber.length < 8) {
      return { isValid: false, error: 'Account number is too short. Most Ghana bank accounts have 8-16 digits' };
    }

    if (cleanedAccountNumber.length > 16) {
      return { isValid: false, error: 'Account number is too long' };
    }

    // Validate account name
    if (accountName.trim().length < 2) {
      return { isValid: false, error: 'Account holder name must be at least 2 characters' };
    }

    if (accountName.trim().length > 50) {
      return { isValid: false, error: 'Account holder name is too long' };
    }

    // Basic name validation (letters, spaces, apostrophes, hyphens)
    if (!/^[a-zA-Z\s'\-\.]+$/.test(accountName.trim())) {
      return { isValid: false, error: 'Account holder name contains invalid characters' };
    }

    return { isValid: true };
  }

  /**
   * Validate cash pickup details
   */
  private validateCashPickupDetails(receiverName: string, receiverPhone: string, receiverIdType: string, receiverIdNumber: string): { isValid: boolean; error?: string } {
    if (!receiverName || typeof receiverName !== 'string') {
      return { isValid: false, error: 'Receiver name is required' };
    }

    if (!receiverPhone || typeof receiverPhone !== 'string') {
      return { isValid: false, error: 'Receiver phone number is required' };
    }

    if (!receiverIdType || typeof receiverIdType !== 'string') {
      return { isValid: false, error: 'Receiver ID type is required' };
    }

    if (!receiverIdNumber || typeof receiverIdNumber !== 'string') {
      return { isValid: false, error: 'Receiver ID number is required' };
    }

    // Validate receiver name
    if (receiverName.trim().length < 2) {
      return { isValid: false, error: 'Receiver name must be at least 2 characters' };
    }

    if (receiverName.trim().length > 50) {
      return { isValid: false, error: 'Receiver name is too long' };
    }

    if (!/^[a-zA-Z\s'\-\.]+$/.test(receiverName.trim())) {
      return { isValid: false, error: 'Receiver name contains invalid characters' };
    }

    // Validate phone number (Ghana format)
    const cleanedPhone = receiverPhone.replace(/\D/g, '');
    if (cleanedPhone.length < 10 || cleanedPhone.length > 13) {
      return { isValid: false, error: 'Invalid phone number format' };
    }

    // Validate ID type
    const validIdTypes = ['ghana_card', 'voters_id', 'passport', 'drivers_license'];
    if (!validIdTypes.includes(receiverIdType)) {
      return { isValid: false, error: 'Invalid ID type. Must be one of: Ghana Card, Voter\'s ID, Passport, or Driver\'s License' };
    }

    // Validate ID number based on type
    const cleanedIdNumber = receiverIdNumber.replace(/\s/g, '').toUpperCase();
    
    switch (receiverIdType) {
      case 'ghana_card':
        if (!/^GHA-\d{9}-\d$/.test(cleanedIdNumber)) {
          return { isValid: false, error: 'Ghana Card number must be in format GHA-XXXXXXXXX-X' };
        }
        break;
      case 'voters_id':
        if (cleanedIdNumber.length < 8 || cleanedIdNumber.length > 10) {
          return { isValid: false, error: 'Voter\'s ID number must be 8-10 characters' };
        }
        break;
      case 'passport':
        if (cleanedIdNumber.length < 6 || cleanedIdNumber.length > 9) {
          return { isValid: false, error: 'Passport number must be 6-9 characters' };
        }
        break;
      case 'drivers_license':
        if (cleanedIdNumber.length < 8 || cleanedIdNumber.length > 12) {
          return { isValid: false, error: 'Driver\'s License number must be 8-12 characters' };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Calculate processing fees based on network and amount
   */
  private calculateFees(amount: number, network: GhanaianMobileNetwork): number {
    const config = NETWORK_CONFIGS[network];
    const percentageFee = amount * config.processingFee;
    const fixedFee = 0.50; // Base fee
    const totalFee = percentageFee + fixedFee;
    
    // Cap fees at reasonable limits
    const maxFee = Math.min(amount * 0.05, 25); // Max 5% or GHS 25
    const minFee = 1.00; // Min GHS 1
    
    return Math.min(Math.max(totalFee, minFee), maxFee);
  }

  /**
   * Format mobile number for processing
   */
  private formatMobileNumber(number: string): string {
    const cleaned = number.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return '+233' + cleaned.substring(1); // Remove leading 0 and add country code
    }
    
    if (cleaned.length === 13 && cleaned.startsWith('233')) {
      return '+' + cleaned;
    }
    
    return number; // Return as-is if format is unclear
  }

  /**
   * Process mobile money withdrawal
   */
  async processMobileMoneyWithdrawal(request: WithdrawalPaymentRequest): Promise<WithdrawalPaymentResponse> {
    try {
      logger.info('WITHDRAWAL_PAYMENTS_API', 'Processing mobile money withdrawal', {
        network: request.network,
        amount: request.amount,
        recipientNumber: request.recipientNumber?.substring(0, 8) + '...'
      });

      // Validate network
      if (!NETWORK_CONFIGS[request.network]) {
        return {
          success: false,
          error: 'Unsupported mobile network'
        };
      }

      const config = NETWORK_CONFIGS[request.network];

      // Validate amount limits
      if (request.amount < config.minAmount) {
        return {
          success: false,
          error: `Minimum withdrawal amount for ${config.name} is GHS ${config.minAmount}`
        };
      }

      if (request.amount > config.maxAmount) {
        return {
          success: false,
          error: `Maximum withdrawal amount for ${config.name} is GHS ${config.maxAmount}`
        };
      }

      // Validate mobile number with enhanced error messaging
      const mobileValidation = this.validateMobileNumber(request.recipientNumber, request.network);
      if (!mobileValidation.isValid) {
        return {
          success: false,
          error: mobileValidation.error || `Invalid mobile number for ${config.name}`
        };
      }

      // Calculate fees
      const fees = this.calculateFees(request.amount, request.network);
      const netAmount = request.amount - fees;

      // Format mobile number
      const formattedNumber = this.formatMobileNumber(request.recipientNumber);

      // Generate reference if not provided
      const reference = request.reference || `WD-${Date.now().toString(36).toUpperCase()}`;

      // Create payment record first
      const paymentData: CreatePaymentData = {
        cardId: request.cardId,
        type: 'mobile_money',
        amount: request.amount,
        currency: request.currency || 'GHS',
        description: request.description || `Mobile money withdrawal to ${request.recipientName}`,
        recipientDetails: {
          name: request.recipientName,
          phone: formattedNumber
        },
        status: 'processing',
        reference,
        mobileNumber: formattedNumber,
        mobileNetwork: request.network,
        metadata: {
          withdrawalType: 'mobile_money',
          networkConfig: config.name,
          fees,
          netAmount,
          originalAmount: request.amount
        }
      };

      const payment = await paymentService.createPayment(paymentData);

      // In a real implementation, this would call the actual network API
      // For now, we'll simulate the processing
      const processingResult = await this.simulateNetworkProcessing(request.network, {
        amount: netAmount,
        recipientNumber: formattedNumber,
        recipientName: request.recipientName,
        reference
      });

      if (!processingResult.success) {
        // Update payment status to failed
        await paymentService.updatePayment(payment.id, { status: 'failed' });
        return {
          success: false,
          error: processingResult.error || 'Network processing failed'
        };
      }

      // Update payment status to completed
      await paymentService.updatePayment(payment.id, { status: 'completed' });

      logger.info('WITHDRAWAL_PAYMENTS_API', 'Mobile money withdrawal processed successfully', {
        paymentId: payment.id,
        reference,
        network: request.network
      });

      return {
        success: true,
        data: {
          paymentId: payment.id,
          transactionId: processingResult.transactionId,
          reference,
          status: 'completed',
          fees,
          netAmount,
          estimatedCompletionTime: '2-15 minutes',
          instructions: {
            network: config.name,
            recipientNumber: formattedNumber,
            recipientName: request.recipientName,
            amount: netAmount,
            reference,
            steps: [
              `Withdrawal of GHS ${netAmount.toFixed(2)} has been initiated`,
              `The money will be sent to ${config.name} number: ${formattedNumber}`,
              `Recipient: ${request.recipientName}`,
              `Reference: ${reference}`,
              'The recipient will receive an SMS notification',
              'Processing time: 2-15 minutes',
              'Please ensure the recipient\'s mobile money wallet can receive the amount'
            ],
            ussdCode: config.ussdCode
          }
        }
      };

    } catch (error) {
      logger.error('WITHDRAWAL_PAYMENTS_API', 'Mobile money withdrawal failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  /**
   * Process bank transfer withdrawal
   */
  async processBankTransfer(request: BankTransferRequest): Promise<WithdrawalPaymentResponse> {
    try {
      logger.info('WITHDRAWAL_PAYMENTS_API', 'Processing bank transfer withdrawal', {
        bankCode: request.bankCode,
        amount: request.amount,
        accountNumber: request.accountNumber?.substring(0, 6) + '...'
      });

      // Validate bank account details
      const bankValidation = this.validateBankAccount(request.accountNumber, request.accountName, request.bankCode);
      if (!bankValidation.isValid) {
        return {
          success: false,
          error: bankValidation.error || 'Invalid bank account details'
        };
      }

      // Calculate fees (different for bank transfers)
      const fees = Math.max(request.amount * 0.005 + 2, 3); // 0.5% + GHS 2, min GHS 3
      const netAmount = request.amount - fees;
      
      // Generate reference
      const reference = request.reference || `BT-${Date.now().toString(36).toUpperCase()}`;

      // Create payment record
      const paymentData: CreatePaymentData = {
        cardId: request.cardId,
        type: 'bank_transfer',
        amount: request.amount,
        currency: request.currency || 'GHS',
        description: request.description || `Bank transfer to ${request.accountName}`,
        recipientDetails: {
          name: request.accountName,
          bankAccount: request.accountNumber
        },
        status: 'processing',
        reference,
        bankCode: request.bankCode,
        accountNumber: request.accountNumber,
        metadata: {
          withdrawalType: 'bank_transfer',
          fees,
          netAmount,
          originalAmount: request.amount
        }
      };

      const payment = await paymentService.createPayment(paymentData);

      // Simulate bank processing
      const processingResult = await this.simulateBankProcessing({
        amount: netAmount,
        accountNumber: request.accountNumber,
        accountName: request.accountName,
        bankCode: request.bankCode,
        reference
      });

      if (!processingResult.success) {
        await paymentService.updatePayment(payment.id, { status: 'failed' });
        return {
          success: false,
          error: processingResult.error || 'Bank processing failed'
        };
      }

      // Update payment status
      await paymentService.updatePayment(payment.id, { status: 'completed' });

      return {
        success: true,
        data: {
          paymentId: payment.id,
          transactionId: processingResult.transactionId,
          reference,
          status: 'completed',
          fees,
          netAmount,
          estimatedCompletionTime: '1-2 business days',
          instructions: {
            network: 'Bank Transfer',
            recipientNumber: request.accountNumber,
            recipientName: request.accountName,
            amount: netAmount,
            reference,
            steps: [
              `Bank transfer of GHS ${netAmount.toFixed(2)} has been initiated`,
              `Funds will be transferred to account: ${request.accountNumber}`,
              `Account holder: ${request.accountName}`,
              `Reference: ${reference}`,
              'Processing time: 1-2 business days',
              'You will receive a confirmation SMS when completed'
            ]
          }
        }
      };

    } catch (error) {
      logger.error('WITHDRAWAL_PAYMENTS_API', 'Bank transfer withdrawal failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  /**
   * Process cash pickup withdrawal
   */
  async processCashPickup(request: CashPickupRequest): Promise<WithdrawalPaymentResponse> {
    try {
      logger.info('WITHDRAWAL_PAYMENTS_API', 'Processing cash pickup withdrawal', {
        provider: request.provider,
        amount: request.amount,
        receiverName: request.receiverName
      });

      // Validate cash pickup details
      const pickupValidation = this.validateCashPickupDetails(
        request.receiverName, 
        request.receiverPhone, 
        request.receiverIdType, 
        request.receiverIdNumber
      );
      if (!pickupValidation.isValid) {
        return {
          success: false,
          error: pickupValidation.error || 'Invalid cash pickup details'
        };
      }

      // Calculate fees (higher for cash pickup)
      const fees = Math.max(request.amount * 0.02 + 1, 5); // 2% + GHS 1, min GHS 5
      const netAmount = request.amount - fees;
      
      // Generate reference and pickup code
      const reference = request.reference || `CP-${Date.now().toString(36).toUpperCase()}`;
      const pickupCode = `PU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create payment record
      const paymentData: CreatePaymentData = {
        cardId: request.cardId,
        type: 'cash',
        amount: request.amount,
        currency: request.currency || 'GHS',
        description: request.description || `Cash pickup for ${request.receiverName}`,
        recipientDetails: {
          name: request.receiverName,
          phone: request.receiverPhone
        },
        status: 'processing',
        reference,
        metadata: {
          withdrawalType: 'cash_pickup',
          provider: request.provider,
          pickupCode,
          receiverIdType: request.receiverIdType,
          receiverIdNumber: request.receiverIdNumber,
          fees,
          netAmount,
          originalAmount: request.amount
        }
      };

      const payment = await paymentService.createPayment(paymentData);

      // Simulate cash pickup processing
      const processingResult = await this.simulateCashPickupProcessing({
        amount: netAmount,
        receiverName: request.receiverName,
        receiverPhone: request.receiverPhone,
        provider: request.provider,
        pickupCode,
        reference
      });

      if (!processingResult.success) {
        await paymentService.updatePayment(payment.id, { status: 'failed' });
        return {
          success: false,
          error: processingResult.error || 'Cash pickup processing failed'
        };
      }

      // Update payment status
      await paymentService.updatePayment(payment.id, { status: 'completed' });

      return {
        success: true,
        data: {
          paymentId: payment.id,
          transactionId: processingResult.transactionId,
          reference,
          status: 'completed',
          fees,
          netAmount,
          estimatedCompletionTime: '15-30 minutes',
          instructions: {
            network: `${request.provider} Cash Pickup`,
            recipientNumber: request.receiverPhone,
            recipientName: request.receiverName,
            amount: netAmount,
            reference,
            steps: [
              `Cash pickup of GHS ${netAmount.toFixed(2)} is ready`,
              `Pickup Code: ${pickupCode}`,
              `Receiver: ${request.receiverName}`,
              `Phone: ${request.receiverPhone}`,
              `Reference: ${reference}`,
              `Valid ID required: ${request.receiverIdType.replace('_', ' ').toUpperCase()}`,
              'Available at all agent locations',
              'Pickup code expires in 24 hours'
            ]
          }
        }
      };

    } catch (error) {
      logger.error('WITHDRAWAL_PAYMENTS_API', 'Cash pickup withdrawal failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  /**
   * Simulate network processing (in real app, this would call actual network APIs)
   */
  private async simulateNetworkProcessing(network: GhanaianMobileNetwork, data: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate 95% success rate
    if (Math.random() < 0.95) {
      return {
        success: true,
        transactionId: `${network.toUpperCase()}-${Date.now()}`
      };
    } else {
      return {
        success: false,
        error: 'Network temporarily unavailable. Please try again.'
      };
    }
  }

  /**
   * Simulate bank processing
   */
  private async simulateBankProcessing(data: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (Math.random() < 0.92) {
      return {
        success: true,
        transactionId: `BANK-${Date.now()}`
      };
    } else {
      return {
        success: false,
        error: 'Invalid account details or bank temporarily unavailable.'
      };
    }
  }

  /**
   * Simulate cash pickup processing
   */
  private async simulateCashPickupProcessing(data: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 800));

    if (Math.random() < 0.98) {
      return {
        success: true,
        transactionId: `CASH-${Date.now()}`
      };
    } else {
      return {
        success: false,
        error: 'Cash pickup service temporarily unavailable.'
      };
    }
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(network: GhanaianMobileNetwork) {
    return NETWORK_CONFIGS[network];
  }

  /**
   * Get all supported networks
   */
  getSupportedNetworks() {
    return Object.keys(NETWORK_CONFIGS) as GhanaianMobileNetwork[];
  }
}

// Export singleton instance
export const withdrawalPaymentsAPI = new WithdrawalPaymentsAPI();

// Export commonly used functions
export const {
  processMobileMoneyWithdrawal,
  processBankTransfer,
  processCashPickup,
  getNetworkConfig,
  getSupportedNetworks
} = withdrawalPaymentsAPI;