/**
 * Analytics Service
 * 
 * Provides comprehensive analytics and reporting functionality for banking data.
 * Generates insights, trends, and downloadable reports for cards and transactions.
 */

import { databases, appwriteConfig, Query, AppwriteQuery } from './config';
import { databaseService } from './database';
import { Card, Transaction } from '@/constants/index';
import { logger } from '@/lib/logger';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface AnalyticsData {
  cardId?: string;
  cardName?: string;
  period: {
    start: Date;
    end: Date;
    label: string;
  };
  summary: {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    averageTransactionAmount: number;
    currentBalance: number;
  };
  trends: {
    dailyTransactions: DailyTransaction[];
    monthlyTrends: MonthlyTrend[];
    categoryBreakdown: CategoryBreakdown[];
    transactionTypes: TransactionTypeBreakdown[];
  };
  insights: AnalyticsInsight[];
}

export interface DailyTransaction {
  date: string;
  count: number;
  totalAmount: number;
  income: number;
  expenses: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  totalTransactions: number;
  totalAmount: number;
  income: number;
  expenses: number;
  averageDaily: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface TransactionTypeBreakdown {
  type: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface AnalyticsInsight {
  type: 'spending_pattern' | 'income_trend' | 'category_alert' | 'balance_warning' | 'recommendation';
  title: string;
  description: string;
  value?: number;
  trend?: 'up' | 'down' | 'stable';
  severity?: 'info' | 'warning' | 'success' | 'danger';
}

export type ReportFormat = 'pdf' | 'csv' | 'json';
export type ReportPeriod = '7d' | '30d' | '90d' | '1y' | 'custom';

export interface ReportOptions {
  cardIds?: string[]; // If empty, includes all cards
  period: ReportPeriod;
  customStartDate?: Date;
  customEndDate?: Date;
  format: ReportFormat;
  includeCharts: boolean;
  includeInsights: boolean;
}

class AnalyticsService {
  private readonly transactionsCollectionId: string;
  private readonly cardsCollectionId: string;

  constructor() {
    this.transactionsCollectionId = appwriteConfig.transactionsCollectionId;
    this.cardsCollectionId = appwriteConfig.cardsCollectionId;
  }

  /**
   * Generate analytics data for specified cards and period
   */
  async generateAnalytics(cardIds?: string[], period: ReportPeriod = '30d', customStart?: Date, customEnd?: Date): Promise<AnalyticsData> {
    try {
      logger.info('ANALYTICS', 'Generating analytics', { cardIds, period });

      const { start, end, label } = this.getPeriodDates(period, customStart, customEnd);
      
      // Fetch transactions for the period
      const transactions = await this.fetchTransactions(cardIds, start, end);
      
      // Fetch card information
      const cards = cardIds ? await this.fetchCards(cardIds) : await this.fetchAllCards();
      
      // Generate analytics data
      const summary = this.calculateSummary(transactions, cards);
      const trends = this.calculateTrends(transactions, start, end);
      const insights = this.generateInsights(transactions, summary, trends);

      const analytics: AnalyticsData = {
        cardId: cardIds?.length === 1 ? cardIds[0] : undefined,
        cardName: cardIds?.length === 1 ? cards.find(c => c.id === cardIds[0])?.cardName : undefined,
        period: { start, end, label },
        summary,
        trends,
        insights
      };

      logger.info('ANALYTICS', 'Analytics generated successfully', {
        transactionCount: transactions.length,
        cardCount: cards.length,
        period: label
      });

      return analytics;

    } catch (error) {
      logger.error('ANALYTICS', 'Failed to generate analytics:', error);
      throw error;
    }
  }

  /**
   * Generate and download report
   */
  async generateReport(options: ReportOptions): Promise<string> {
    try {
      logger.info('ANALYTICS', 'Generating report', options);

      // Generate analytics data
      const analytics = await this.generateAnalytics(
        options.cardIds,
        options.period,
        options.customStartDate,
        options.customEndDate
      );

      // Generate report based on format
      let filePath: string;
      switch (options.format) {
        case 'csv':
          filePath = await this.generateCSVReport(analytics, options);
          break;
        case 'json':
          filePath = await this.generateJSONReport(analytics, options);
          break;
        case 'pdf':
          filePath = await this.generatePDFReport(analytics, options);
          break;
        default:
          throw new Error(`Unsupported report format: ${options.format}`);
      }

      logger.info('ANALYTICS', 'Report generated successfully', { filePath, format: options.format });
      return filePath;

    } catch (error) {
      logger.error('ANALYTICS', 'Failed to generate report:', error);
      throw error;
    }
  }

  /**
   * Share generated report
   */
  async shareReport(filePath: string): Promise<void> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: this.getMimeType(filePath),
          dialogTitle: 'Share Financial Report'
        });
        logger.info('ANALYTICS', 'Report shared successfully');
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      logger.error('ANALYTICS', 'Failed to share report:', error);
      throw error;
    }
  }

  private async fetchTransactions(cardIds?: string[], startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    const queries = [Query.orderDesc('$createdAt')];
    
    // Note: Query.in might not be available in current Appwrite SDK
    // For now, if specific cards are requested, we'll filter after fetching
    // This can be optimized later with proper query support
    
    if (startDate) {
      queries.push(Query.greaterThanEqual('$createdAt', startDate.toISOString()));
    }
    
    if (endDate) {
      queries.push(Query.lessThanEqual('$createdAt', endDate.toISOString()));
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      this.transactionsCollectionId,
      queries
    );

    let transactions = response.documents.map(doc => ({
      id: doc.$id,
      userId: doc.userId,
      cardId: doc.cardId,
      amount: doc.amount,
      type: doc.type,
      category: doc.category,
      description: doc.description,
      status: doc.status,
      date: doc.date || doc.$createdAt,
      fee: doc.fee || 0
    }));

    // Filter by cardIds if specified (since Query.in might not be available)
    if (cardIds && cardIds.length > 0) {
      transactions = transactions.filter(t => cardIds.includes(t.cardId));
    }

    return transactions;
  }

  private async fetchCards(cardIds: string[]): Promise<Card[]> {
    // Fetch all cards first, then filter by IDs (since Query.in might not be available)
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      this.cardsCollectionId,
      [Query.equal('isActive', true)]
    );

    const allCards = response.documents.map(doc => ({
      id: doc.$id,
      userId: doc.userId,
      cardNumber: doc.cardNumber,
      cardHolderName: doc.cardHolderName,
      expiryDate: doc.expiryDate,
      balance: doc.balance,
      cardType: doc.cardType,
      isActive: doc.isActive,
      cardColor: doc.cardColor,
      token: doc.token,
      currency: doc.currency || 'GHS'
    }));

    // Filter by cardIds
    return allCards.filter(card => cardIds.includes(card.id));
  }

  private async fetchAllCards(): Promise<Card[]> {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      this.cardsCollectionId,
      [Query.equal('isActive', true)]
    );

    return response.documents.map(doc => ({
      id: doc.$id,
      userId: doc.userId,
      cardNumber: doc.cardNumber,
      cardHolderName: doc.cardHolderName,
      expiryDate: doc.expiryDate,
      balance: doc.balance,
      cardType: doc.cardType,
      isActive: doc.isActive,
      cardColor: doc.cardColor,
      token: doc.token,
      currency: doc.currency || 'GHS'
    }));
  }

  private getPeriodDates(period: ReportPeriod, customStart?: Date, customEnd?: Date) {
    const end = customEnd || new Date();
    let start: Date;
    let label: string;

    switch (period) {
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Last 7 Days';
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 Days';
        break;
      case '90d':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        label = 'Last 90 Days';
        break;
      case '1y':
        start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
        label = 'Last Year';
        break;
      case 'custom':
        start = customStart || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 Days';
    }

    return { start, end, label };
  }

  private calculateSummary(transactions: Transaction[], cards: Card[]) {
    const totalTransactions = transactions.length;
    const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    const netBalance = totalIncome - totalExpenses;
    const averageTransactionAmount = totalTransactions > 0 ? (totalIncome + totalExpenses) / totalTransactions : 0;
    const currentBalance = cards.reduce((sum, card) => sum + (card.balance || 0), 0);

    return {
      totalTransactions,
      totalIncome,
      totalExpenses,
      netBalance,
      averageTransactionAmount,
      currentBalance
    };
  }

  private calculateTrends(transactions: Transaction[], startDate: Date, endDate: Date) {
    // Daily transactions
    const dailyTransactions = this.groupTransactionsByDay(transactions);
    
    // Monthly trends
    const monthlyTrends = this.groupTransactionsByMonth(transactions);
    
    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(transactions);
    
    // Transaction type breakdown
    const transactionTypes = this.calculateTransactionTypeBreakdown(transactions);

    return {
      dailyTransactions,
      monthlyTrends,
      categoryBreakdown,
      transactionTypes
    };
  }

  private groupTransactionsByDay(transactions: Transaction[]): DailyTransaction[] {
    const groups = new Map<string, DailyTransaction>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.date).toISOString().split('T')[0];
      
      if (!groups.has(date)) {
        groups.set(date, {
          date,
          count: 0,
          totalAmount: 0,
          income: 0,
          expenses: 0
        });
      }

      const group = groups.get(date)!;
      group.count++;
      group.totalAmount += Math.abs(transaction.amount);
      
      if (transaction.amount > 0) {
        group.income += transaction.amount;
      } else {
        group.expenses += Math.abs(transaction.amount);
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private groupTransactionsByMonth(transactions: Transaction[]): MonthlyTrend[] {
    const groups = new Map<string, MonthlyTrend>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          month: date.toLocaleDateString('en-US', { month: 'long' }),
          year: date.getFullYear(),
          totalTransactions: 0,
          totalAmount: 0,
          income: 0,
          expenses: 0,
          averageDaily: 0
        });
      }

      const group = groups.get(key)!;
      group.totalTransactions++;
      group.totalAmount += Math.abs(transaction.amount);
      
      if (transaction.amount > 0) {
        group.income += transaction.amount;
      } else {
        group.expenses += Math.abs(transaction.amount);
      }
    });

    // Calculate average daily amounts
    Array.from(groups.values()).forEach(trend => {
      const daysInMonth = new Date(trend.year, new Date(`${trend.month} 1`).getMonth() + 1, 0).getDate();
      trend.averageDaily = trend.totalAmount / daysInMonth;
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return new Date(`${a.month} 1`).getMonth() - new Date(`${b.month} 1`).getMonth();
    });
  }

  private calculateCategoryBreakdown(transactions: Transaction[]): CategoryBreakdown[] {
    const groups = new Map<string, { count: number; amount: number }>();
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    transactions.forEach(transaction => {
      const category = transaction.category || 'Uncategorized';
      
      if (!groups.has(category)) {
        groups.set(category, { count: 0, amount: 0 });
      }

      const group = groups.get(category)!;
      group.count++;
      group.amount += Math.abs(transaction.amount);
    });

    return Array.from(groups.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private calculateTransactionTypeBreakdown(transactions: Transaction[]): TransactionTypeBreakdown[] {
    const groups = new Map<string, { count: number; amount: number }>();
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    transactions.forEach(transaction => {
      const type = transaction.type || 'Other';
      
      if (!groups.has(type)) {
        groups.set(type, { count: 0, amount: 0 });
      }

      const group = groups.get(type)!;
      group.count++;
      group.amount += Math.abs(transaction.amount);
    });

    return Array.from(groups.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private generateInsights(transactions: Transaction[], summary: any, trends: any): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    // Spending pattern insight
    if (summary.totalExpenses > summary.totalIncome) {
      insights.push({
        type: 'spending_pattern',
        title: 'High Spending Alert',
        description: `Your expenses (GH₵${summary.totalExpenses.toFixed(2)}) exceed your income (GH₵${summary.totalIncome.toFixed(2)}) by GH₵${(summary.totalExpenses - summary.totalIncome).toFixed(2)}`,
        value: summary.totalExpenses - summary.totalIncome,
        trend: 'up',
        severity: 'warning'
      });
    } else if (summary.netBalance > 0) {
      insights.push({
        type: 'income_trend',
        title: 'Positive Cash Flow',
        description: `Great job! You saved GH₵${summary.netBalance.toFixed(2)} during this period`,
        value: summary.netBalance,
        trend: 'up',
        severity: 'success'
      });
    }

    // Category insights
    const topCategory = trends.categoryBreakdown[0];
    if (topCategory && topCategory.percentage > 40) {
      insights.push({
        type: 'category_alert',
        title: 'Category Concentration',
        description: `${topCategory.percentage.toFixed(1)}% of your spending is in ${topCategory.category}. Consider diversifying your expenses.`,
        value: topCategory.percentage,
        severity: 'info'
      });
    }

    // Balance warning
    if (summary.currentBalance < 1000) {
      insights.push({
        type: 'balance_warning',
        title: 'Low Balance Alert',
        description: `Your current balance is GH₵${summary.currentBalance.toFixed(2)}. Consider making a deposit soon.`,
        value: summary.currentBalance,
        severity: 'warning'
      });
    }

    // Recommendation
    if (trends.dailyTransactions.length > 7) {
      const recentDays = trends.dailyTransactions.slice(-7);
      const avgDailySpending = recentDays.reduce((sum, day) => sum + day.expenses, 0) / 7;
      
      if (avgDailySpending > 100) {
        insights.push({
          type: 'recommendation',
          title: 'Spending Recommendation',
          description: `Your average daily spending is GH₵${avgDailySpending.toFixed(2)}. Consider setting a daily budget to track expenses better.`,
          value: avgDailySpending,
          severity: 'info'
        });
      }
    }

    return insights;
  }

  private async generateCSVReport(analytics: AnalyticsData, options: ReportOptions): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `financial-report-${timestamp}.csv`;
    const filePath = `${FileSystem.documentDirectory || ''}${fileName}`;

    let csvContent = 'Financial Report\n\n';
    
    // Summary section
    csvContent += 'SUMMARY\n';
    csvContent += `Period,${analytics.period.label}\n`;
    csvContent += `Total Transactions,${analytics.summary.totalTransactions}\n`;
    csvContent += `Total Income,GH₵${analytics.summary.totalIncome.toFixed(2)}\n`;
    csvContent += `Total Expenses,GH₵${analytics.summary.totalExpenses.toFixed(2)}\n`;
    csvContent += `Net Balance,GH₵${analytics.summary.netBalance.toFixed(2)}\n`;
    csvContent += `Current Balance,GH₵${analytics.summary.currentBalance.toFixed(2)}\n\n`;

    // Transaction types breakdown
    csvContent += 'TRANSACTION TYPES\n';
    csvContent += 'Type,Count,Amount,Percentage\n';
    analytics.trends.transactionTypes.forEach(type => {
      csvContent += `${type.type},${type.count},GH₵${type.amount.toFixed(2)},${type.percentage.toFixed(1)}%\n`;
    });
    csvContent += '\n';

    // Category breakdown
    csvContent += 'CATEGORIES\n';
    csvContent += 'Category,Count,Amount,Percentage\n';
    analytics.trends.categoryBreakdown.forEach(category => {
      csvContent += `${category.category},${category.count},GH₵${category.amount.toFixed(2)},${category.percentage.toFixed(1)}%\n`;
    });

    await FileSystem.writeAsStringAsync(filePath, csvContent);
    return filePath;
  }

  private async generateJSONReport(analytics: AnalyticsData, options: ReportOptions): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `financial-report-${timestamp}.json`;
    const filePath = `${FileSystem.documentDirectory || ''}${fileName}`;

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        reportType: 'Financial Analytics Report',
        period: analytics.period,
        cardId: analytics.cardId,
        cardName: analytics.cardName,
        options
      },
      analytics
    };

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(report, null, 2));
    return filePath;
  }

  private async generatePDFReport(analytics: AnalyticsData, options: ReportOptions): Promise<string> {
    // For now, we'll generate an HTML report that can be converted to PDF
    // In a production app, you'd use a proper PDF library like react-native-pdf-lib
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `financial-report-${timestamp}.html`;
    const filePath = `${FileSystem.documentDirectory || ''}${fileName}`;

    const htmlContent = this.generateHTMLReport(analytics, options);
    await FileSystem.writeAsStringAsync(filePath, htmlContent);
    return filePath;
  }

  private generateHTMLReport(analytics: AnalyticsData, options: ReportOptions): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Financial Report - ${analytics.period.label}</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #1976d2; }
        .metric-label { font-size: 14px; color: #666; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .insight { background: #e3f2fd; padding: 15px; border-left: 4px solid #1976d2; margin: 10px 0; }
        .positive { color: #4caf50; }
        .negative { color: #f44336; }
        .warning { color: #ff9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Financial Analytics Report</h1>
        <p><strong>Period:</strong> ${analytics.period.label}</p>
        ${analytics.cardName ? `<p><strong>Card:</strong> ${analytics.cardName}</p>` : '<p><strong>All Cards</strong></p>'}
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="summary">
        <h2>Financial Summary</h2>
        <div class="metric">
            <div class="metric-value">GH₵${analytics.summary.currentBalance.toFixed(2)}</div>
            <div class="metric-label">Current Balance</div>
        </div>
        <div class="metric">
            <div class="metric-value positive">GH₵${analytics.summary.totalIncome.toFixed(2)}</div>
            <div class="metric-label">Total Income</div>
        </div>
        <div class="metric">
            <div class="metric-value negative">GH₵${analytics.summary.totalExpenses.toFixed(2)}</div>
            <div class="metric-label">Total Expenses</div>
        </div>
        <div class="metric">
            <div class="metric-value ${analytics.summary.netBalance >= 0 ? 'positive' : 'negative'}">GH₵${analytics.summary.netBalance.toFixed(2)}</div>
            <div class="metric-label">Net Balance</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analytics.summary.totalTransactions}</div>
            <div class="metric-label">Total Transactions</div>
        </div>
    </div>

    <div class="section">
        <h2>Transaction Types</h2>
        <table>
            <tr>
                <th>Type</th>
                <th>Count</th>
                <th>Amount</th>
                <th>Percentage</th>
            </tr>
            ${analytics.trends.transactionTypes.map(type => `
                <tr>
                    <td>${type.type}</td>
                    <td>${type.count}</td>
                    <td>GH₵${type.amount.toFixed(2)}</td>
                    <td>${type.percentage.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>Category Breakdown</h2>
        <table>
            <tr>
                <th>Category</th>
                <th>Count</th>
                <th>Amount</th>
                <th>Percentage</th>
            </tr>
            ${analytics.trends.categoryBreakdown.map(category => `
                <tr>
                    <td>${category.category}</td>
                    <td>${category.count}</td>
                    <td>GH₵${category.amount.toFixed(2)}</td>
                    <td>${category.percentage.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    ${options.includeInsights ? `
    <div class="section">
        <h2>Financial Insights</h2>
        ${analytics.insights.map(insight => `
            <div class="insight">
                <strong>${insight.title}</strong><br>
                ${insight.description}
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px;">
        <p>Generated by Bank App Analytics • ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>
    `;
  }

  private getMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      case 'html': return 'text/html';
      case 'pdf': return 'application/pdf';
      default: return 'application/octet-stream';
    }
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;