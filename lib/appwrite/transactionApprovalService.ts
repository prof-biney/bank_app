/**
 * Transaction Approval Service
 * 
 * Handles transaction approval, verification, and status management
 */

import { databases, appwriteConfig, Query, ID } from './config';
import { databaseService } from './database';
import { authService } from './auth';
import { logger } from '../logger';
import { Transaction } from '@/constants/index';

export interface TransactionApproval {
  id: string;
  transactionId: string;
  userId: string;
  approvalType: 'manual' | 'automatic' | 'biometric' | 'pin' | 'otp';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  expiresAt: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface ApprovalRequest {
  transactionId: string;
  approvalType: 'manual' | 'automatic' | 'biometric' | 'pin' | 'otp';
  expiryMinutes?: number; // Default: 15 minutes
  requiresUserConfirmation?: boolean;
  metadata?: Record<string, any>;
}

export interface ApprovalResponse {
  approvalId: string;
  status: 'pending' | 'approved' | 'rejected';
  expiresAt: string;
  approvalMethod?: string;
  nextStep?: string;
  message: string;
}

export interface VerificationRequest {
  approvalId: string;
  verificationMethod: 'pin' | 'biometric' | 'otp' | 'manual';
  verificationData?: {
    pin?: string;
    otpCode?: string;
    biometricSignature?: string;
    manualConfirmation?: boolean;
  };
}

/**
 * Transaction Approval Service Class
 */
export class TransactionApprovalService {
  private readonly transactionsCollectionId: string;

  constructor() {
    this.transactionsCollectionId = appwriteConfig.transactionsCollectionId;
    logger.info('APPROVAL_SERVICE', 'Transaction Approval Service initialized using transactions collection');
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated - no user ID found');
    }
    
    logger.info('APPROVAL_SERVICE', 'Using userId for approval operations', { userId: user.$id });
    return user.$id;
  }

  /**
   * Create a transaction approval request by updating the transaction
   */
  async createApprovalRequest(request: ApprovalRequest): Promise<ApprovalResponse> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('APPROVAL_SERVICE', 'Creating approval request for transaction', {
        transactionId: request.transactionId,
        approvalType: request.approvalType,
        userId
      });

      // Set expiry time
      const expiryMinutes = request.expiryMinutes || 15;
      const pendingUntil = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

      // Update transaction with approval information
      const approvalData = {
        status: 'pending_approval',
        pendingUntil: pendingUntil,
        // Store approval metadata in source field or create a new metadata field
        source: JSON.stringify({
          approvalType: request.approvalType,
          requiresUserConfirmation: request.requiresUserConfirmation,
          metadata: request.metadata || {},
          createdAt: new Date().toISOString()
        })
      };

      await databaseService.updateDocument(
        this.transactionsCollectionId,
        request.transactionId,
        approvalData
      );

      const response: ApprovalResponse = {
        approvalId: request.transactionId, // Use transaction ID as approval ID
        status: 'pending',
        expiresAt: pendingUntil,
        message: 'Approval request created successfully',
        nextStep: this.getNextStepForApprovalType(request.approvalType)
      };

      logger.info('APPROVAL_SERVICE', 'Approval request created successfully', { 
        transactionId: request.transactionId,
        pendingUntil 
      });
      return response;

    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Failed to create approval request', error);
      throw this.handleApprovalError(error, 'Failed to create approval request');
    }
  }

  /**
   * Verify and approve a transaction
   */
  async verifyAndApprove(request: VerificationRequest): Promise<ApprovalResponse> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('APPROVAL_SERVICE', 'Processing verification request', {
        approvalId: request.approvalId,
        verificationMethod: request.verificationMethod,
        userId
      });

      // Get the transaction (approval is the transaction ID)
      const transaction = await this.getTransactionForApproval(request.approvalId);
      
      if (transaction.userId !== userId) {
        throw new Error('Unauthorized: Transaction does not belong to current user');
      }

      if (transaction.status !== 'pending_approval') {
        throw new Error(`Transaction is ${transaction.status} and cannot be processed`);
      }

      // Check if approval has expired
      if (new Date() > new Date(transaction.pendingUntil)) {
        await this.updateTransactionStatus(request.approvalId, 'failed', 'Approval expired');
        throw new Error('Approval request has expired');
      }

      // Create approval object for verification
      const approval = this.transformTransactionToApproval(transaction);
      
      // Perform verification based on method
      const isVerified = await this.performVerification(approval, request);

      if (isVerified) {
        // Approve the transaction
        await this.updateTransactionStatus(request.approvalId, 'completed');

        // Log approval activity
        await this.logApprovalActivity(
          request.approvalId, 
          'approved', 
          `Transaction approved via ${request.verificationMethod}`
        );

        return {
          approvalId: request.approvalId,
          status: 'approved',
          expiresAt: transaction.pendingUntil,
          approvalMethod: request.verificationMethod,
          message: 'Transaction approved successfully'
        };
      } else {
        // Reject the approval
        await this.updateTransactionStatus(request.approvalId, 'failed', 'Verification failed');

        return {
          approvalId: request.approvalId,
          status: 'rejected',
          expiresAt: transaction.pendingUntil,
          message: 'Verification failed - transaction rejected'
        };
      }

    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Failed to verify and approve', error);
      throw this.handleApprovalError(error, 'Failed to verify transaction');
    }
  }

  /**
   * Get transaction for approval by ID
   */
  private async getTransactionForApproval(transactionId: string): Promise<any> {
    try {
      const document = await databaseService.getDocument(this.transactionsCollectionId, transactionId);
      return document;
    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Failed to get transaction for approval', error);
      throw this.handleApprovalError(error, 'Failed to get transaction');
    }
  }

  /**
   * Get approval by ID (transaction ID)
   */
  async getApproval(approvalId: string): Promise<TransactionApproval> {
    try {
      const userId = await this.getCurrentUserId();

      const transaction = await this.getTransactionForApproval(approvalId);

      if (transaction.userId !== userId) {
        throw new Error('Unauthorized: Transaction does not belong to current user');
      }

      return this.transformTransactionToApproval(transaction);
      
    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Failed to get approval', error);
      throw this.handleApprovalError(error, 'Failed to get approval');
    }
  }

  /**
   * Get pending approvals for current user from transactions collection
   */
  async getPendingApprovals(): Promise<TransactionApproval[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('APPROVAL_SERVICE', 'Getting pending approvals from transactions for user', { userId });

      const response = await databaseService.listDocuments(this.transactionsCollectionId, [
        Query.equal('userId', userId),
        Query.equal('status', 'pending_approval'),
        Query.greaterThan('pendingUntil', new Date().toISOString()),
        Query.orderDesc('$createdAt'),
        Query.limit(50)
      ]);

      const approvals = response.documents.map(doc => this.transformTransactionToApproval(doc));
      
      logger.info('APPROVAL_SERVICE', 'Retrieved pending approvals from transactions', { count: approvals.length });
      return approvals;

    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Failed to get pending approvals from transactions', error);
      throw this.handleApprovalError(error, 'Failed to get pending approvals');
    }
  }

  /**
   * Cancel an approval request (transaction)
   */
  async cancelApproval(approvalId: string, reason?: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('APPROVAL_SERVICE', 'Canceling approval', { approvalId, reason, userId });

      const approval = await this.getApproval(approvalId);
      
      if (approval.status !== 'pending') {
        throw new Error(`Cannot cancel transaction with status: ${approval.status}`);
      }

      await this.updateTransactionStatus(approvalId, 'failed', reason || 'Cancelled by user');

      await this.logApprovalActivity(
        approvalId, 
        'cancelled', 
        reason || 'Approval cancelled by user'
      );

      logger.info('APPROVAL_SERVICE', 'Approval cancelled successfully', { approvalId });

    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Failed to cancel approval', error);
      throw this.handleApprovalError(error, 'Failed to cancel approval');
    }
  }

  /**
   * Auto-approve a transaction (for small amounts or trusted operations)
   */
  async autoApprove(transactionId: string, reason: string): Promise<ApprovalResponse> {
    try {
      const userId = await this.getCurrentUserId();
      
      logger.info('APPROVAL_SERVICE', 'Auto-approving transaction', { transactionId, reason, userId });

      // Create and immediately approve
      const approvalRequest: ApprovalRequest = {
        transactionId,
        approvalType: 'automatic',
        expiryMinutes: 1,
        metadata: { autoApprovalReason: reason }
      };

      const approval = await this.createApprovalRequest(approvalRequest);
      
      // Immediately approve it by updating transaction status
      await this.updateTransactionStatus(transactionId, 'completed');

      await this.logApprovalActivity(
        approval.approvalId, 
        'auto_approved', 
        `Auto-approved: ${reason}`
      );

      return {
        approvalId: approval.approvalId,
        status: 'approved',
        expiresAt: approval.expiresAt,
        approvalMethod: 'automatic',
        message: `Transaction auto-approved: ${reason}`
      };

    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Failed to auto-approve transaction', error);
      throw this.handleApprovalError(error, 'Failed to auto-approve transaction');
    }
  }

  /**
   * Perform verification based on method
   */
  private async performVerification(approval: TransactionApproval, request: VerificationRequest): Promise<boolean> {
    try {
      switch (request.verificationMethod) {
        case 'pin':
          return await this.verifyPin(request.verificationData?.pin);
        
        case 'biometric':
          return await this.verifyBiometric(request.verificationData?.biometricSignature);
        
        case 'otp':
          return await this.verifyOTP(request.verificationData?.otpCode);
        
        case 'manual':
          return request.verificationData?.manualConfirmation === true;
        
        default:
          throw new Error(`Unsupported verification method: ${request.verificationMethod}`);
      }
    } catch (error) {
      logger.error('APPROVAL_SERVICE', 'Verification failed', error);
      return false;
    }
  }

  /**
   * Verify PIN (mock implementation - replace with real PIN verification)
   */
  private async verifyPin(pin?: string): Promise<boolean> {
    if (!pin || pin.length !== 4) {
      return false;
    }
    
    // Mock verification - in real app, compare with stored PIN hash
    // For demo purposes, accept "1234" as valid PIN
    return pin === "1234";
  }

  /**
   * Verify biometric (mock implementation)
   */
  private async verifyBiometric(signature?: string): Promise<boolean> {
    if (!signature) {
      return false;
    }
    
    // Mock verification - in real app, verify biometric signature
    return signature.length > 10; // Simple mock check
  }

  /**
   * Verify OTP (mock implementation)
   */
  private async verifyOTP(otpCode?: string): Promise<boolean> {
    if (!otpCode || otpCode.length !== 6) {
      return false;
    }
    
    // Mock verification - in real app, verify against sent OTP
    // For demo purposes, accept "123456" as valid OTP
    return otpCode === "123456";
  }


  /**
   * Update transaction status and related fields
   */
  private async updateTransactionStatus(transactionId: string, status: string, failureReason?: string): Promise<void> {
    try {
      const updateData: any = { status };
      
      if (status === 'completed') {
        updateData.completedAt = new Date().toISOString();
        updateData.pendingUntil = null; // Clear pending status
      } else if (status === 'failed' && failureReason) {
        updateData.failureReason = failureReason;
        updateData.pendingUntil = null; // Clear pending status
      }
      
      await databaseService.updateDocument(
        this.transactionsCollectionId,
        transactionId,
        updateData
      );
    } catch (error) {
      logger.warn('APPROVAL_SERVICE', 'Failed to update transaction status', { transactionId, status, error });
    }
  }

  /**
   * Get next step for approval type
   */
  private getNextStepForApprovalType(approvalType: ApprovalRequest['approvalType']): string {
    switch (approvalType) {
      case 'pin':
        return 'Enter your 4-digit PIN to approve the transaction';
      case 'biometric':
        return 'Use your fingerprint or face ID to approve the transaction';
      case 'otp':
        return 'Enter the OTP sent to your registered phone number';
      case 'manual':
        return 'Manually confirm the transaction to proceed';
      case 'automatic':
        return 'Transaction will be processed automatically';
      default:
        return 'Complete the verification process';
    }
  }

  /**
   * Transform transaction document to TransactionApproval
   */
  private transformTransactionToApproval(doc: any): TransactionApproval {
    let approvalType = 'manual';
    let metadata = {};
    
    // Parse source field if it contains approval metadata
    try {
      if (doc.source) {
        const sourceData = JSON.parse(doc.source);
        if (sourceData.approvalType) {
          approvalType = sourceData.approvalType;
        }
        if (sourceData.metadata) {
          metadata = sourceData.metadata;
        }
      }
    } catch (e) {
      // If parsing fails, use defaults
    }
    
    return {
      id: doc.$id,
      transactionId: doc.$id,
      userId: doc.userId,
      approvalType: approvalType as any,
      status: doc.status === 'pending_approval' ? 'pending' : doc.status,
      approvedAt: doc.completedAt,
      approvedBy: undefined, // Not tracked in transactions
      rejectedAt: doc.status === 'failed' ? doc.$updatedAt : undefined,
      rejectionReason: doc.failureReason,
      expiresAt: doc.pendingUntil,
      createdAt: doc.$createdAt,
      metadata: {
        ...metadata,
        amount: doc.amount,
        currency: doc.currency,
        description: doc.description,
        type: doc.type
      }
    };
  }

  /**
   * Log approval activity
   */
  private async logApprovalActivity(
    approvalId: string, 
    action: string, 
    description: string
  ): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      await databaseService.createDocument(
        appwriteConfig.accountUpdatesCollectionId,
        {
          userId,
          type: 'approval_activity',
          description,
          metadata: {
            approvalId,
            action,
            timestamp: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.warn('APPROVAL_SERVICE', 'Failed to log approval activity', error);
    }
  }

  /**
   * Handle and format approval-related errors
   */
  private handleApprovalError(error: any, defaultMessage: string): Error {
    let message = defaultMessage;
    
    if (error?.message) {
      if (error.message.includes('Unauthorized')) {
        message = 'You do not have permission to access this approval.';
      } else if (error.message.includes('not found')) {
        message = 'Approval not found.';
      } else if (error.message.includes('expired')) {
        message = 'Approval request has expired.';
      } else {
        message = error.message;
      }
    }

    const formattedError = new Error(message);
    formattedError.stack = error?.stack;
    return formattedError;
  }
}

// Create and export service instance
export const transactionApprovalService = new TransactionApprovalService();

// Export commonly used functions as bound methods
export const createApprovalRequest = transactionApprovalService.createApprovalRequest.bind(transactionApprovalService);
export const verifyAndApprove = transactionApprovalService.verifyAndApprove.bind(transactionApprovalService);
export const getApproval = transactionApprovalService.getApproval.bind(transactionApprovalService);
export const getPendingApprovals = transactionApprovalService.getPendingApprovals.bind(transactionApprovalService);
export const cancelApproval = transactionApprovalService.cancelApproval.bind(transactionApprovalService);
export const autoApprove = transactionApprovalService.autoApprove.bind(transactionApprovalService);

export default transactionApprovalService;