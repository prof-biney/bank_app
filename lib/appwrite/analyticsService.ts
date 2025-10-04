/**
 * Analytics Service
 * 
 * Provides comprehensive analytics and reporting functionality for banking data.
 * Generates insights, trends, and downloadable reports for cards and transactions.
 */

import { databases, collections, appwriteConfig, Query, AppwriteQuery } from './config';
import { databaseService } from './database';
import { Card, Transaction } from '@/constants/index';
import { logger } from '@/lib/logger';
import { activityLogger } from '@/lib/activityLogger';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
// Note: PDFKit would be imported in Node.js environment: const PDFDocument = require('pdfkit');
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

      // Log report generation activity (fire-and-forget)
      this.logReportGenerationActivity(options, filePath).catch(error => {
        logger.warn('ANALYTICS', 'Failed to log report generation activity', error);
      });

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

  /**
   * Log report generation activity using centralized activity logger
   */
  private async logReportGenerationActivity(options: ReportOptions, filePath: string): Promise<void> {
    try {
      // Get current user from auth context (you may need to import auth service)
      const { authService } = await import('./auth');
      const user = await authService.getCurrentUser();
      if (!user) {
        logger.warn('ANALYTICS', 'Cannot log report activity - user not authenticated');
        return;
      }

      const periodLabel = options.period === 'custom' && options.customStartDate && options.customEndDate
        ? `${options.customStartDate.toLocaleDateString()} to ${options.customEndDate.toLocaleDateString()}`
        : options.period;
      
      const cardInfo = options.cardIds && options.cardIds.length > 0
        ? `for ${options.cardIds.length} card(s)`
        : 'for all cards';
      
      await activityLogger.logReportActivity(
        'generated',
        'financial_report',
        {
          period: periodLabel,
          format: options.format,
          recordCount: options.cardIds?.length || 0,
          description: `${options.format.toUpperCase()} report generated ${cardInfo} for period: ${periodLabel}`,
          cardIds: options.cardIds,
          includeCharts: options.includeCharts,
          includeInsights: options.includeInsights,
          filePath: filePath,
        },
        user.$id
      );
    } catch (error) {
      // Don't throw - this is a fire-and-forget operation
      logger.warn('ANALYTICS', 'Failed to log report generation activity', error);
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
    try {
      const response = await databases.listDocuments(
        appwriteConfig.databaseId,
        this.cardsCollectionId,
        [] // Removed isActive query to prevent errors
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

      // Filter by cardIds and isActive status client-side
      return allCards.filter(card => cardIds.includes(card.id) && card.isActive);
    } catch (error) {
      logger.error('ANALYTICS', 'Failed to fetch cards', error);
      return [];
    }
  }

  private async fetchAllCards(): Promise<Card[]> {
    try {
      const response = await databases.listDocuments(
        appwriteConfig.databaseId,
        this.cardsCollectionId,
        [] // Removed isActive query to prevent errors
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

      // Filter by isActive status client-side
      return allCards.filter(card => card.isActive);
    } catch (error) {
      logger.error('ANALYTICS', 'Failed to fetch all cards', error);
      return [];
    }
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
    try {
      // Validate analytics data
      if (!analytics || !analytics.summary || !analytics.trends) {
        throw new Error('Invalid analytics data provided for CSV report generation');
      }

      // Check for file system availability and create fallback directory
      let documentDir = FileSystem.documentDirectory;
      if (!documentDir) {
        documentDir = FileSystem.cacheDirectory;
      }
      
      if (!documentDir) {
        try {
          const tempDir = `${FileSystem.cacheDirectory || ''}temp/`;
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
          documentDir = tempDir;
        } catch (dirError) {
          throw new Error('No suitable directory available for file storage. Please check app permissions.');
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `financial-report-${timestamp}.csv`;
      const filePath = `${documentDir}${fileName}`;

      let csvContent = 'Financial Report\n\n';
      
      // Summary section
      csvContent += 'SUMMARY\n';
      csvContent += `Period,"${analytics.period.label}"\n`;
      csvContent += `Total Transactions,${analytics.summary.totalTransactions || 0}\n`;
      csvContent += `Total Income,"GH₵${(analytics.summary.totalIncome || 0).toFixed(2)}"\n`;
      csvContent += `Total Expenses,"GH₵${(analytics.summary.totalExpenses || 0).toFixed(2)}"\n`;
      csvContent += `Net Balance,"GH₵${(analytics.summary.netBalance || 0).toFixed(2)}"\n`;
      csvContent += `Current Balance,"GH₵${(analytics.summary.currentBalance || 0).toFixed(2)}"\n\n`;

      // Transaction types breakdown
      if (analytics.trends.transactionTypes && analytics.trends.transactionTypes.length > 0) {
        csvContent += 'TRANSACTION TYPES\n';
        csvContent += 'Type,Count,Amount,Percentage\n';
        analytics.trends.transactionTypes.forEach(type => {
          const safeType = (type.type || 'Unknown').replace(/"/g, '""'); // Escape quotes
          csvContent += `"${safeType}",${type.count || 0},"GH₵${(type.amount || 0).toFixed(2)}","${(type.percentage || 0).toFixed(1)}%"\n`;
        });
        csvContent += '\n';
      }

      // Category breakdown
      if (analytics.trends.categoryBreakdown && analytics.trends.categoryBreakdown.length > 0) {
        csvContent += 'CATEGORIES\n';
        csvContent += 'Category,Count,Amount,Percentage\n';
        analytics.trends.categoryBreakdown.forEach(category => {
          const safeCategory = (category.category || 'Uncategorized').replace(/"/g, '""'); // Escape quotes
          csvContent += `"${safeCategory}",${category.count || 0},"GH₵${(category.amount || 0).toFixed(2)}","${(category.percentage || 0).toFixed(1)}%"\n`;
        });
      }

      // Include insights if requested
      if (options.includeInsights && analytics.insights && analytics.insights.length > 0) {
        csvContent += '\nINSIGHTS\n';
        csvContent += 'Type,Title,Description\n';
        analytics.insights.forEach(insight => {
          const safeTitle = (insight.title || '').replace(/"/g, '""');
          const safeDescription = (insight.description || '').replace(/"/g, '""');
          csvContent += `"${insight.type || 'info'}","${safeTitle}","${safeDescription}"\n`;
        });
      }

      await FileSystem.writeAsStringAsync(filePath, csvContent);
      logger.info('ANALYTICS', `CSV report generated successfully: ${fileName}`);
      return filePath;
    } catch (error) {
      logger.error('ANALYTICS', 'Failed to generate CSV report:', error);
      throw new Error(`Failed to generate CSV report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateJSONReport(analytics: AnalyticsData, options: ReportOptions): Promise<string> {
    try {
      // Validate analytics data
      if (!analytics || !analytics.summary || !analytics.trends) {
        throw new Error('Invalid analytics data provided for JSON report generation');
      }

      // Check for file system availability and create fallback directory
      let documentDir = FileSystem.documentDirectory;
      if (!documentDir) {
        documentDir = FileSystem.cacheDirectory;
      }
      
      if (!documentDir) {
        try {
          const tempDir = `${FileSystem.cacheDirectory || ''}temp/`;
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
          documentDir = tempDir;
        } catch (dirError) {
          throw new Error('No suitable directory available for file storage. Please check app permissions.');
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `financial-report-${timestamp}.json`;
      const filePath = `${documentDir}${fileName}`;

      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          reportType: 'Financial Analytics Report',
          version: '1.0',
          period: analytics.period,
          cardId: analytics.cardId || null,
          cardName: analytics.cardName || 'All Cards',
          options: {
            ...options,
            generatedBy: 'Bank App Analytics Service'
          }
        },
        summary: {
          ...analytics.summary,
          // Ensure all numeric values are properly formatted
          totalIncome: Number((analytics.summary.totalIncome || 0).toFixed(2)),
          totalExpenses: Number((analytics.summary.totalExpenses || 0).toFixed(2)),
          netBalance: Number((analytics.summary.netBalance || 0).toFixed(2)),
          currentBalance: Number((analytics.summary.currentBalance || 0).toFixed(2)),
          averageTransactionAmount: Number((analytics.summary.averageTransactionAmount || 0).toFixed(2))
        },
        trends: {
          dailyTransactions: analytics.trends.dailyTransactions || [],
          monthlyTrends: analytics.trends.monthlyTrends || [],
          categoryBreakdown: (analytics.trends.categoryBreakdown || []).map(cat => ({
            ...cat,
            amount: Number((cat.amount || 0).toFixed(2)),
            percentage: Number((cat.percentage || 0).toFixed(2))
          })),
          transactionTypes: (analytics.trends.transactionTypes || []).map(type => ({
            ...type,
            amount: Number((type.amount || 0).toFixed(2)),
            percentage: Number((type.percentage || 0).toFixed(2))
          }))
        },
        insights: analytics.insights || []
      };

      const jsonContent = JSON.stringify(report, null, 2);
      await FileSystem.writeAsStringAsync(filePath, jsonContent);
      logger.info('ANALYTICS', `JSON report generated successfully: ${fileName}`);
      return filePath;
    } catch (error) {
      logger.error('ANALYTICS', 'Failed to generate JSON report:', error);
      throw new Error(`Failed to generate JSON report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generatePDFReport(analytics: AnalyticsData, options: ReportOptions): Promise<string> {
    try {
      // Validate analytics data
      if (!analytics || !analytics.summary || !analytics.trends) {
        throw new Error('Invalid analytics data provided for PDF report generation');
      }

      // Check for file system availability and create fallback directory
      let documentDir = FileSystem.documentDirectory;
      if (!documentDir) {
        // Try cache directory as fallback
        documentDir = FileSystem.cacheDirectory;
      }
      
      if (!documentDir) {
        // Last resort: create temporary directory
        try {
          const tempDir = `${FileSystem.cacheDirectory || ''}temp/`;
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
          documentDir = tempDir;
        } catch (dirError) {
          throw new Error('No suitable directory available for file storage. Please check app permissions.');
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `financial-report-${timestamp}.pdf`;
      const filePath = `${documentDir}${fileName}`;

      // DIRECT PDF GENERATION APPROACH:
      // For React Native/Expo: Use expo-print with HTML template
      // For Node.js: Use PDFKit for direct PDF generation
      // This implementation provides both approaches:
      
      // METHOD 1: expo-print (React Native/Expo)
      if (typeof window !== 'undefined' || global.ExpoConstant) {
        // Running in React Native/Expo environment
        const htmlContent = this.generateHTMLReport(analytics, options);
        
        // Dynamically import expo-print only when needed
        const Print = require('expo-print');
        const { uri } = await Print.printToFileAsync({
          html: htmlContent,
          base64: false,
          orientation: Print.Orientation.portrait,
          width: 612, // 8.5 inches * 72 DPI
          height: 792, // 11 inches * 72 DPI
          margins: {
            left: 54, // 0.75 inch
            right: 54,
            top: 72, // 1 inch
            bottom: 72
          }
        });
        
        await FileSystem.moveAsync({
          from: uri,
          to: filePath
        });
      } else {
        // METHOD 2: Direct PDF generation using PDFKit (Node.js/Testing)
        await this.generateDirectPDF(analytics, options, filePath);
      }

      logger.info('ANALYTICS', `PDF report generated successfully: ${fileName}`);
      return filePath;
    } catch (error) {
      logger.error('ANALYTICS', 'Failed to generate PDF report:', error);
      throw new Error(`Failed to generate PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateHTMLReport(analytics: AnalyticsData, options: ReportOptions): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Financial Report - ${analytics.period.label}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
          font-family: 'Helvetica Neue', Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          line-height: 1.6; 
          color: #333;
          font-size: 12px;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          page-break-after: avoid;
          border-bottom: 3px solid #1976d2;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #1976d2;
          font-size: 24px;
          margin: 0 0 10px 0;
        }
        .header p {
          margin: 5px 0;
          color: #666;
        }
        .summary { 
          background: #f8f9fa; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 30px; 
          page-break-inside: avoid;
          border: 1px solid #e0e0e0;
        }
        .metrics-container {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-around;
          gap: 10px;
        }
        .metric { 
          flex: 1;
          min-width: 120px;
          text-align: center; 
          padding: 10px;
          border-radius: 4px;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value { 
          font-size: 18px; 
          font-weight: bold; 
          color: #1976d2;
          display: block;
          margin-bottom: 5px;
        }
        .metric-label { 
          font-size: 11px; 
          color: #666; 
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section { 
          margin-bottom: 30px; 
          page-break-inside: avoid;
        }
        .section h2 { 
          color: #1976d2; 
          border-bottom: 2px solid #1976d2; 
          padding-bottom: 10px;
          font-size: 16px;
          margin-top: 0;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 15px;
          border: 1px solid #ddd;
        }
        th, td { 
          padding: 8px 12px; 
          text-align: left; 
          border-bottom: 1px solid #ddd;
          font-size: 11px;
        }
        th { 
          background-color: #1976d2;
          color: white;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .insight { 
          background: #e3f2fd; 
          padding: 15px; 
          border-left: 4px solid #1976d2; 
          margin: 10px 0;
          border-radius: 4px;
          page-break-inside: avoid;
        }
        .insight strong {
          color: #1976d2;
          display: block;
          margin-bottom: 5px;
        }
        .positive { color: #4caf50; font-weight: bold; }
        .negative { color: #f44336; font-weight: bold; }
        .warning { color: #ff9800; font-weight: bold; }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #666;
          font-size: 10px;
          border-top: 1px solid #e0e0e0;
          padding-top: 20px;
        }
        .chart-placeholder {
          background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          margin: 15px 0;
          border: 2px dashed #ccc;
        }
        @media print {
          body { margin: 0; }
          .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Financial Analytics Report</h1>
        <p><strong>Period:</strong> ${analytics.period.label}</p>
        ${analytics.cardName ? `<p><strong>Card:</strong> ${analytics.cardName}</p>` : '<p><strong>All Cards</strong></p>'}
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metrics-container">
            <div class="metric">
                <span class="metric-value">GH₵${analytics.summary.currentBalance.toLocaleString()}</span>
                <span class="metric-label">Current Balance</span>
            </div>
            <div class="metric">
                <span class="metric-value positive">GH₵${analytics.summary.totalIncome.toLocaleString()}</span>
                <span class="metric-label">Total Income</span>
            </div>
            <div class="metric">
                <span class="metric-value negative">GH₵${analytics.summary.totalExpenses.toLocaleString()}</span>
                <span class="metric-label">Total Expenses</span>
            </div>
            <div class="metric">
                <span class="metric-value ${analytics.summary.netBalance >= 0 ? 'positive' : 'negative'}">GH₵${analytics.summary.netBalance.toLocaleString()}</span>
                <span class="metric-label">Net Savings</span>
            </div>
            <div class="metric">
                <span class="metric-value">${analytics.summary.totalTransactions}</span>
                <span class="metric-label">Total Transactions</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Transaction Analysis</h2>
        <table>
            <tr>
                <th>Transaction Type</th>
                <th>Count</th>
                <th>Total Amount</th>
                <th>% of Total</th>
                <th>Avg per Transaction</th>
            </tr>
            ${analytics.trends.transactionTypes.map(type => `
                <tr>
                    <td><strong>${type.type}</strong></td>
                    <td>${type.count}</td>
                    <td>GH₵${type.amount.toLocaleString()}</td>
                    <td>${type.percentage.toFixed(1)}%</td>
                    <td>GH₵${(type.amount / type.count).toFixed(2)}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>Spending by Category</h2>
        <table>
            <tr>
                <th>Category</th>
                <th>Transactions</th>
                <th>Amount Spent</th>
                <th>% of Budget</th>
                <th>Avg per Transaction</th>
            </tr>
            ${analytics.trends.categoryBreakdown.map(category => `
                <tr>
                    <td><strong>${category.category}</strong></td>
                    <td>${category.count}</td>
                    <td>GH₵${category.amount.toLocaleString()}</td>
                    <td>${category.percentage.toFixed(1)}%</td>
                    <td>GH₵${(category.amount / category.count).toFixed(2)}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    ${options.includeCharts ? `
    <div class="section">
        <h2>Visual Analytics</h2>
        <div class="chart-placeholder">
            <div style="text-align: center; color: #666;">
                <p><strong>📊 Chart Visualization</strong></p>
                <p>In the mobile app, this section would contain:</p>
                <p>• Spending trend charts<br>• Category breakdown pie chart<br>• Monthly comparison graphs</p>
            </div>
        </div>
    </div>
    ` : ''}

    ${options.includeInsights ? `
    <div class="section">
        <h2>AI-Powered Financial Insights</h2>
        ${analytics.insights.map(insight => `
            <div class="insight">
                <strong>${insight.title}${insight.severity === 'success' ? ' 💰' : ''}</strong>
                <p>${insight.description}</p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${analytics.trends.dailyTransactions && analytics.trends.dailyTransactions.length > 0 ? `
    <div class="section">
        <h2>Daily Activity Summary</h2>
        <table>
            <tr>
                <th>Date</th>
                <th>Transactions</th>
                <th>Total Activity</th>
                <th>Income</th>
                <th>Expenses</th>
            </tr>
            ${analytics.trends.dailyTransactions.slice(-5).map(day => `
                <tr>
                    <td>${new Date(day.date).toLocaleDateString()}</td>
                    <td>${day.count}</td>
                    <td>GH₵${day.totalAmount.toLocaleString()}</td>
                    <td class="positive">GH₵${day.income.toLocaleString()}</td>
                    <td class="negative">GH₵${day.expenses.toLocaleString()}</td>
                </tr>
            `).join('')}
        </table>
    </div>
    ` : ''}

    <div class="footer">
        <p><strong>🏦 Bank App Analytics Report</strong></p>
        <p>Generated on ${new Date().toLocaleDateString()}, ${new Date().toLocaleTimeString()} • Confidential Financial Document</p>
        <p>This report contains sensitive financial information. Handle with care and maintain confidentiality.</p>
        <p style="margin-top: 10px; font-style: italic;">
            PDF generated using expo-print in React Native/Expo environment
        </p>
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

  /**
   * Direct PDF generation using PDFKit (for Node.js environments)
   * This method creates PDF files programmatically without HTML conversion
   */
  private async generateDirectPDF(analytics: AnalyticsData, options: ReportOptions, outputPath: string): Promise<void> {
    // Note: This method requires PDFKit to be available
    // In a React Native environment, this would not be called
    // The implementation is provided for completeness and testing
    
    try {
      // Dynamic import of PDFKit (only available in Node.js)
      // Using dynamic require to avoid React Native bundling issues
      const PDFDocument = eval('require')("pdfkit");
      const fs = eval('require')("fs");
      
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: 'Financial Analytics Report',
            Author: 'Bank App Analytics',
            Subject: `Financial Report - ${analytics.period.label}`,
            Keywords: 'financial report analytics banking'
          }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Colors
        const colors = {
          primary: '#1976d2',
          success: '#4caf50',
          error: '#f44336',
          text: '#333333',
          lightGray: '#f5f5f5'
        };

        let y = 50;

        // Header
        doc.rect(0, 0, 595, 80).fill(colors.primary);
        doc.fillColor('white')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text('Financial Analytics Report', 50, 25, { width: 495, align: 'center' });

        doc.fontSize(12)
           .text(`${analytics.period.label} | ${analytics.cardName || 'All Cards'}`, 50, 50, { 
             width: 495, 
             align: 'center' 
           });

        y = 120;

        // Executive Summary
        doc.fillColor(colors.primary)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('Executive Summary', 50, y);
        
        y += 30;

        // Metrics
        const metrics = [
          { label: 'Current Balance', value: `GH₵${analytics.summary.currentBalance.toLocaleString()}` },
          { label: 'Total Income', value: `GH₵${analytics.summary.totalIncome.toLocaleString()}` },
          { label: 'Total Expenses', value: `GH₵${analytics.summary.totalExpenses.toLocaleString()}` },
          { label: 'Net Balance', value: `GH₵${analytics.summary.netBalance.toLocaleString()}` }
        ];

        metrics.forEach((metric, index) => {
          const x = 50 + (index % 2) * 250;
          const boxY = y + Math.floor(index / 2) * 70;
          
          doc.rect(x, boxY, 200, 50)
             .fill(colors.lightGray)
             .stroke();
          
          doc.fillColor(colors.primary)
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(metric.value, x + 10, boxY + 10, { width: 180, align: 'center' });
          
          doc.fillColor(colors.text)
             .fontSize(10)
             .font('Helvetica')
             .text(metric.label, x + 10, boxY + 30, { width: 180, align: 'center' });
        });

        y += 150;

        // Transaction Analysis
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.fillColor(colors.primary)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('Transaction Analysis', 50, y);
        
        y += 30;

        // Simple table for transaction types
        analytics.trends.transactionTypes.forEach((type, index) => {
          doc.fillColor(colors.text)
             .fontSize(10)
             .text(`${type.type}: ${type.count} transactions, GH₵${type.amount.toFixed(2)} (${type.percentage.toFixed(1)}%)`, 50, y);
          y += 20;
        });

        y += 20;

        // Insights
        if (options.includeInsights && analytics.insights.length > 0) {
          doc.fillColor(colors.primary)
             .fontSize(16)
             .font('Helvetica-Bold')
             .text('Financial Insights', 50, y);
          
          y += 30;

          analytics.insights.forEach(insight => {
            doc.fillColor(colors.text)
               .fontSize(12)
               .font('Helvetica-Bold')
               .text(insight.title, 50, y);
            
            y += 15;
            
            doc.fontSize(10)
               .font('Helvetica')
               .text(insight.description, 50, y, { width: 495 });
            
            y += 30;
          });
        }

        // Footer
        doc.fillColor('#666')
           .fontSize(8)
           .text('Bank App Analytics Report • Generated using direct PDF generation', 50, 750, { 
             width: 495, 
             align: 'center' 
           });

        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', (error) => reject(error));
      });
    } catch (error) {
      logger.error('ANALYTICS', 'Direct PDF generation failed:', error);
      throw new Error(`Direct PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test report generation with sample data
   * This function can be used to verify that all report formats work correctly
   */
  async testReportGeneration(): Promise<{ success: boolean; results: any[] }> {
    try {
      logger.info('ANALYTICS', 'Starting report generation test...');
      
      // Create sample analytics data for testing
      const sampleAnalytics: AnalyticsData = {
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
          label: 'Test Period - Last 30 Days'
        },
        summary: {
          totalTransactions: 25,
          totalIncome: 5000.00,
          totalExpenses: 3500.00,
          netBalance: 1500.00,
          averageTransactionAmount: 340.00,
          currentBalance: 8500.00
        },
        trends: {
          dailyTransactions: [
            { date: '2024-01-01', count: 3, totalAmount: 450.00, income: 500.00, expenses: 50.00 },
            { date: '2024-01-02', count: 2, totalAmount: 320.00, income: 0.00, expenses: 320.00 }
          ],
          monthlyTrends: [
            { month: 'January', year: 2024, totalTransactions: 25, totalAmount: 8500.00, income: 5000.00, expenses: 3500.00, averageDaily: 283.33 }
          ],
          categoryBreakdown: [
            { category: 'Groceries', count: 8, amount: 1200.00, percentage: 34.3 },
            { category: 'Transportation', count: 5, amount: 800.00, percentage: 22.9 },
            { category: 'Entertainment', count: 3, amount: 450.00, percentage: 12.9 }
          ],
          transactionTypes: [
            { type: 'Purchase', count: 18, amount: 3200.00, percentage: 91.4 },
            { type: 'Withdrawal', count: 2, amount: 300.00, percentage: 8.6 }
          ]
        },
        insights: [
          {
            type: 'income_trend',
            title: 'Positive Cash Flow',
            description: 'Great job! You saved GH₵1,500.00 during this period',
            value: 1500.00,
            trend: 'up',
            severity: 'success'
          },
          {
            type: 'category_alert',
            title: 'Category Concentration',
            description: '34.3% of your spending is in Groceries. Consider diversifying your expenses.',
            value: 34.3,
            severity: 'info'
          }
        ]
      };

      const testOptions: ReportOptions = {
        period: '30d',
        format: 'csv', // Will be changed for each test
        includeCharts: true,
        includeInsights: true
      };

      const results = [];
      const formats: ReportFormat[] = ['csv', 'json', 'pdf'];

      // Test each format
      for (const format of formats) {
        try {
          const formatOptions = { ...testOptions, format };
          let filePath: string;
          
          // Generate report using the appropriate method with sample data
          switch (format) {
            case 'csv':
              filePath = await this.generateCSVReport(sampleAnalytics, formatOptions);
              break;
            case 'json':
              filePath = await this.generateJSONReport(sampleAnalytics, formatOptions);
              break;
            case 'pdf':
              filePath = await this.generatePDFReport(sampleAnalytics, formatOptions);
              break;
            default:
              throw new Error(`Unsupported format: ${format}`);
          }
          
          // Verify file was created
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          results.push({
            format,
            success: true,
            filePath,
            fileExists: fileInfo.exists,
            fileSize: fileInfo.size || 0,
            message: `${format.toUpperCase()} report generated successfully`
          });
          
          logger.info('ANALYTICS', `Test ${format.toUpperCase()} report: SUCCESS`, {
            filePath,
            fileSize: fileInfo.size
          });
        } catch (error) {
          results.push({
            format,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: `Failed to generate ${format.toUpperCase()} report`
          });
          
          logger.error('ANALYTICS', `Test ${format.toUpperCase()} report: FAILED`, error);
        }
      }

      const allSuccessful = results.every(result => result.success);
      
      logger.info('ANALYTICS', 'Report generation test completed', {
        overallSuccess: allSuccessful,
        results: results.map(r => ({ format: r.format, success: r.success }))
      });

      return {
        success: allSuccessful,
        results
      };
    } catch (error) {
      logger.error('ANALYTICS', 'Report generation test failed:', error);
      return {
        success: false,
        results: [{
          format: 'all',
          success: false,
          error: error instanceof Error ? error.message : 'Test setup failed',
          message: 'Test initialization failed'
        }]
      };
    }
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
