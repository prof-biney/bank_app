/**
 * Appwrite Services Index
 * 
 * This module exports all Appwrite services and utilities for easy importing
 * throughout the application. It provides a central access point for all
 * Appwrite functionality replacing Firebase services.
 */

// Core Appwrite configuration
export * from './config';

// Import services for default export
import authService from './auth';
import databaseService from './database';
import cardService from './cardService';
import transactionService from './transactionService';
import activityService from './activityService';
import notificationService from './notificationService';
import transferService from './transferService';
import withdrawalService from './withdrawalService';
import analyticsService from './analyticsService';

// Authentication service
export * from './auth';
export { default as authService } from './auth';

// Database service with real-time capabilities  
export * from './database';
export { default as databaseService } from './database';

// Card service
export * from './cardService';
export { default as cardService } from './cardService';

// Transaction service
export * from './transactionService';
export { default as transactionService } from './transactionService';

// Activity service
export * from './activityService';
export { default as activityService } from './activityService';

// Notification service
export * from './notificationService';
export { default as notificationService } from './notificationService';

// Transfer service
export * from './transferService';
export { default as transferService } from './transferService';

// Withdrawal service
export * from './withdrawalService';
export { default as withdrawalService } from './withdrawalService';

// Analytics service
export * from './analyticsService';
export { default as analyticsService } from './analyticsService';

// Re-export commonly used types and utilities
export type { 
  DatabaseDocument, 
  DatabaseResponse, 
  RealtimeSubscriptionOptions 
} from './database';

export type {
  LoginCredentials,
  RegisterCredentials,
  AuthUser,
  UserSession,
  UserProfile
} from './auth';

export type {
  CreateCardData,
  UpdateCardData,
  CardFilters,
  CardQueryOptions,
  CardRealtimeOptions
} from './cardService';

export type {
  CreateTransactionData,
  UpdateTransactionData,
  TransactionFilters,
  TransactionQueryOptions,
  TransactionRealtimeOptions,
  TransactionStats
} from './transactionService';

export type {
  ActivityEvent,
  ActivityFilters,
  ActivityQueryOptions,
  ActivityRealtimeOptions
} from './activityService';

export type {
  CreateNotificationData,
  UpdateNotificationData,
  NotificationFilters,
  NotificationQueryOptions,
  NotificationRealtimeOptions,
  NotificationStats
} from './notificationService';

export type {
  TransferRequest,
  TransferResult,
  CardLookupResult
} from './transferService';

export type {
  WithdrawalRequest,
  WithdrawalResult,
  WithdrawalMethod,
  MobileMoneyWithdrawal,
  BankTransferWithdrawal,
  CashPickupWithdrawal,
  WithdrawalInstructions
} from './withdrawalService';

export type {
  AnalyticsData,
  DailyTransaction,
  MonthlyTrend,
  CategoryBreakdown,
  TransactionTypeBreakdown,
  AnalyticsInsight,
  ReportFormat,
  ReportPeriod,
  ReportOptions
} from './analyticsService';

// Default export with all services
export default {
  auth: authService,
  database: databaseService,
  cards: cardService,
  transactions: transactionService,
  activities: activityService,
  notifications: notificationService,
  transfers: transferService,
  withdrawals: withdrawalService,
  analytics: analyticsService,
};
