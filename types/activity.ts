export type ActivityCategory = 'transaction' | 'account' | 'card' | 'approval';

export type ActivityStatus = 'pending' | 'completed' | 'failed' | 'reversed' | 'info' | 'success' | 'error';

export interface ActivityEvent {
  id: string;
  category: ActivityCategory;
  type: string; // e.g., transaction.created, card.added, card.removed, account.updated
  title: string;
  subtitle?: string;
  description?: string;
  amount?: number;
  currency?: string;
  status?: ActivityStatus;
  timestamp: string; // ISO 8601
  accountId?: string;
  cardId?: string;
  transactionId?: string;
  tags?: string[];
  // Mobile money details for deposits
  mobileNumber?: string;
  mobileNetwork?: string;
  // Additional metadata from centralized activities
  metadata?: Record<string, any>;
  userId?: string;
  source?: string;
  severity?: string;
}

