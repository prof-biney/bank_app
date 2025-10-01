export type ActivityCategory = 'transaction' | 'account' | 'card';

export type ActivityStatus = 'pending' | 'completed' | 'failed' | 'reversed' | 'info';

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
}

