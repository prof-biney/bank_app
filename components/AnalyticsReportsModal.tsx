/**
 * Analytics & Reports Modal
 * 
 * Comprehensive modal for viewing analytics and generating reports.
 * Provides options to generate reports for specific cards or all cards.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';

import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { 
  analyticsService,
  type AnalyticsData,
  type ReportOptions,
  type ReportFormat,
  type ReportPeriod 
} from '@/lib/appwrite';
import { logger } from '@/lib/logger';

const { width } = Dimensions.get('window');

interface AnalyticsReportsModalProps {
  visible: boolean;
  onClose: () => void;
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
];

const FORMAT_OPTIONS: { value: ReportFormat; label: string; icon: string }[] = [
  { value: 'csv', label: 'CSV Spreadsheet', icon: 'document-text' },
  { value: 'json', label: 'JSON Data', icon: 'code' },
  { value: 'pdf', label: 'PDF Report', icon: 'document' },
];

export default function AnalyticsReportsModal({ visible, onClose }: AnalyticsReportsModalProps) {
  const { colors } = useTheme();
  const { cards, activeCard } = useApp();

  const [activeTab, setActiveTab] = useState<'analytics' | 'reports'>('analytics');
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('30d');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('csv');
  const [includeInsights, setIncludeInsights] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Initialize with active card selected
  useEffect(() => {
    if (activeCard && !selectedCards.includes(activeCard.id)) {
      setSelectedCards([activeCard.id]);
    }
  }, [activeCard]);

  // Load analytics when modal opens or settings change
  useEffect(() => {
    if (visible && activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [visible, activeTab, selectedPeriod, selectedCards]);

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const analyticsData = await analyticsService.generateAnalytics(
        selectedCards.length > 0 ? selectedCards : undefined,
        selectedPeriod
      );
      setAnalytics(analyticsData);
    } catch (error) {
      logger.error('ANALYTICS_MODAL', 'Failed to load analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data. Please try again.');
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  };

  const selectAllCards = () => {
    setSelectedCards(cards.map(card => card.id));
  };

  const clearCardSelection = () => {
    setSelectedCards([]);
  };

  const generateReport = async () => {
    if (selectedCards.length === 0 && cards.length > 0) {
      Alert.alert('Select Cards', 'Please select at least one card or choose "All Cards" to generate a report.');
      return;
    }

    setIsGeneratingReport(true);
    try {
      const reportOptions: ReportOptions = {
        cardIds: selectedCards.length > 0 ? selectedCards : undefined,
        period: selectedPeriod,
        format: selectedFormat,
        includeCharts,
        includeInsights
      };

      const filePath = await analyticsService.generateReport(reportOptions);
      
      Alert.alert(
        'Report Generated',
        'Your financial report has been generated successfully. Would you like to share it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Share', 
            onPress: () => shareReport(filePath)
          }
        ]
      );

    } catch (error) {
      logger.error('ANALYTICS_MODAL', 'Failed to generate report:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const shareReport = async (filePath: string) => {
    try {
      await analyticsService.shareReport(filePath);
    } catch (error) {
      logger.error('ANALYTICS_MODAL', 'Failed to share report:', error);
      Alert.alert('Error', 'Failed to share report. Please try again.');
    }
  };

  const renderAnalyticsTab = () => {
    if (isLoadingAnalytics) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tintPrimary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading analytics...
          </Text>
        </View>
      );
    }

    if (!analytics) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            No Data Available
          </Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            Select cards and a time period to view analytics
          </Text>
        </View>
      );
    }

    // Prepare chart data
    const chartData = analytics.trends.dailyTransactions.slice(-7); // Last 7 days
    const lineChartData = {
      labels: chartData.map(d => new Date(d.date).getDate().toString()),
      datasets: [
        {
          data: chartData.map(d => d.totalAmount),
          strokeWidth: 2,
          color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
        }
      ]
    };

    const pieChartData = analytics.trends.transactionTypes.slice(0, 5).map((type, index) => ({
      name: type.type,
      amount: type.amount,
      color: [
        '#1976d2',
        '#388e3c',
        '#f57c00',
        '#d32f2f',
        '#7b1fa2'
      ][index] || '#666',
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    }));

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryValue, { color: colors.tintPrimary }]}>
              GH₵{analytics.summary.currentBalance.toFixed(2)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Current Balance
            </Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryValue, { color: '#4caf50' }]}>
              GH₵{analytics.summary.totalIncome.toFixed(2)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Total Income
            </Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryValue, { color: '#f44336' }]}>
              GH₵{analytics.summary.totalExpenses.toFixed(2)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Total Expenses
            </Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryValue, { 
              color: analytics.summary.netBalance >= 0 ? '#4caf50' : '#f44336' 
            }]}>
              GH₵{analytics.summary.netBalance.toFixed(2)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Net Balance
            </Text>
          </View>
        </View>

        {/* Charts Section */}
        {chartData.length > 0 && (
          <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
              Daily Transaction Trends (Last 7 Days)
            </Text>
            <LineChart
              data={lineChartData}
              width={width - 80}
              height={200}
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
                labelColor: (opacity = 1) => colors.textSecondary,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: colors.tintPrimary,
                },
              }}
              style={{ marginVertical: 8, borderRadius: 16 }}
            />
          </View>
        )}

        {pieChartData.length > 0 && (
          <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
              Transaction Types Breakdown
            </Text>
            <PieChart
              data={pieChartData}
              width={width - 80}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
            />
          </View>
        )}

        {/* Insights */}
        {analytics.insights.length > 0 && (
          <View style={[styles.insightsContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Financial Insights
            </Text>
            {analytics.insights.map((insight, index) => (
              <View key={index} style={[styles.insightCard, { backgroundColor: colors.background }]}>
                <View style={styles.insightHeader}>
                  <Ionicons 
                    name={getInsightIcon(insight.type)} 
                    size={20} 
                    color={getInsightColor(insight.severity || 'info')} 
                  />
                  <Text style={[styles.insightTitle, { color: colors.textPrimary }]}>
                    {insight.title}
                  </Text>
                </View>
                <Text style={[styles.insightDescription, { color: colors.textSecondary }]}>
                  {insight.description}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Transaction Types Table */}
        <View style={[styles.tableContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Transaction Types
          </Text>
          {analytics.trends.transactionTypes.map((type, index) => (
            <View key={index} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableCell, { color: colors.textPrimary }]}>
                {type.type}
              </Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
                {type.count}
              </Text>
              <Text style={[styles.tableCell, { color: colors.textPrimary }]}>
                GH₵{type.amount.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
                {type.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderReportsTab = () => {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Card Selection */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Select Cards
          </Text>
          
          <View style={styles.cardSelectionHeader}>
            <TouchableOpacity onPress={selectAllCards} style={styles.selectionButton}>
              <Text style={[styles.selectionButtonText, { color: colors.tintPrimary }]}>
                All Cards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearCardSelection} style={styles.selectionButton}>
              <Text style={[styles.selectionButtonText, { color: colors.textSecondary }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          {cards.map(card => (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.cardSelectionItem,
                { backgroundColor: colors.background }
              ]}
              onPress={() => handleCardSelection(card.id)}
            >
              <View style={styles.cardSelectionContent}>
                <View>
                  <Text style={[styles.cardName, { color: colors.textPrimary }]}>
                    {card.cardHolderName}
                  </Text>
                  <Text style={[styles.cardDetails, { color: colors.textSecondary }]}>
                    {card.cardHolderName} • ****{card.cardNumber.slice(-4)}
                  </Text>
                </View>
                <Ionicons
                  name={selectedCards.includes(card.id) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={selectedCards.includes(card.id) ? colors.tintPrimary : colors.textSecondary}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period Selection */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Time Period
          </Text>
          <View style={styles.periodOptions}>
            {PERIOD_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.periodOption,
                  {
                    backgroundColor: selectedPeriod === option.value ? colors.tintPrimary : colors.background,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setSelectedPeriod(option.value)}
              >
                <Text style={[
                  styles.periodOptionText,
                  {
                    color: selectedPeriod === option.value ? '#fff' : colors.textPrimary
                  }
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Format Selection (Enhanced Visibility) */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            📊 Report Format
          </Text>
          <Text style={[styles.sectionHelper, { color: colors.textSecondary }]}>
            Choose your preferred file format for the generated report
          </Text>

          <View style={styles.formatChips}>
            {FORMAT_OPTIONS.map(format => {
              const selected = selectedFormat === format.value;
              return (
                <TouchableOpacity
                  key={format.value}
                  style={[styles.formatChip, {
                    backgroundColor: selected ? colors.tintPrimary : colors.background,
                    borderColor: selected ? colors.tintPrimary : colors.border,
                    shadowColor: selected ? colors.tintPrimary : 'transparent',
                    shadowOpacity: selected ? 0.3 : 0,
                    shadowRadius: selected ? 4 : 0,
                    elevation: selected ? 2 : 0,
                  }]}
                  onPress={() => setSelectedFormat(format.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Select ${format.label} format`}
                >
                  <Ionicons
                    name={format.icon as any}
                    size={20}
                    color={selected ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.formatChipText, { 
                    color: selected ? '#fff' : colors.textPrimary,
                    fontWeight: selected ? '700' : '500'
                  }]}>
                    {format.label}
                  </Text>
                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#fff"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Options */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Include Options
          </Text>
          
          <TouchableOpacity
            style={[styles.optionItem, { backgroundColor: colors.background }]}
            onPress={() => setIncludeInsights(!includeInsights)}
          >
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                Financial Insights
              </Text>
              <Ionicons
                name={includeInsights ? 'checkbox' : 'square-outline'}
                size={24}
                color={includeInsights ? colors.tintPrimary : colors.textSecondary}
              />
            </View>
            <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
              Include AI-generated insights and recommendations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionItem, { backgroundColor: colors.background }]}
            onPress={() => setIncludeCharts(!includeCharts)}
          >
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                Charts & Graphs
              </Text>
              <Ionicons
                name={includeCharts ? 'checkbox' : 'square-outline'}
                size={24}
                color={includeCharts ? colors.tintPrimary : colors.textSecondary}
              />
            </View>
            <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
              Include visual charts and graphs (PDF format only)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateButton, { backgroundColor: colors.tintPrimary }]}
          onPress={generateReport}
          disabled={isGeneratingReport}
        >
          {isGeneratingReport ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const getInsightIcon = (type: string): string => {
    switch (type) {
      case 'spending_pattern': return 'trending-up';
      case 'income_trend': return 'arrow-up';
      case 'category_alert': return 'warning';
      case 'balance_warning': return 'alert';
      case 'recommendation': return 'bulb';
      default: return 'information';
    }
  };

  const getInsightColor = (severity: string): string => {
    switch (severity) {
      case 'success': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'danger': return '#f44336';
      default: return '#2196f3';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Analytics & Reports
          </Text>
          <View style={styles.closeButton} />
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'analytics' && { borderBottomColor: colors.tintPrimary }]}
            onPress={() => setActiveTab('analytics')}
          >
            <Ionicons 
              name="analytics" 
              size={20} 
              color={activeTab === 'analytics' ? colors.tintPrimary : colors.textSecondary} 
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'analytics' ? colors.tintPrimary : colors.textSecondary }
            ]}>
              Analytics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'reports' && { borderBottomColor: colors.tintPrimary }]}
            onPress={() => setActiveTab('reports')}
          >
            <Ionicons 
              name="document-text" 
              size={20} 
              color={activeTab === 'reports' ? colors.tintPrimary : colors.textSecondary} 
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'reports' ? colors.tintPrimary : colors.textSecondary }
            ]}>
              Reports
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'analytics' ? renderAnalyticsTab() : renderReportsTab()}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  chartContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  insightsContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionHelper: {
    fontSize: 13,
    marginBottom: 16,
  },
  insightCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  insightDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  formatChips: {
    flexDirection: 'column',
    gap: 12,
  },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  formatChipText: {
    fontSize: 16,
    flex: 1,
  },
  tableContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
  },
  sectionContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  cardSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 12,
  },
  selectionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardSelectionItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardSelectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  periodOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  periodOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formatOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  formatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  formatText: {
    flex: 1,
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    marginBottom: 40,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});