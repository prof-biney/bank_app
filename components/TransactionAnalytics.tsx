import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { Transaction } from '@/types';
import { withAlpha } from '@/theme/color-utils';
import CustomButton from '@/components/CustomButton';

type Period = 'week' | 'month' | 'year';

interface AnalyticsData {
  labels: string[];
  income: number[];
  expenses: number[];
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  categoryBreakdown: { name: string; amount: number; color: string }[];
}

export function TransactionAnalytics() {
  const { colors } = useTheme();
  const { transactions } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  
  const screenWidth = Dimensions.get('window').width;

  // Filter and process transactions based on selected period
  const analyticsData = useMemo((): AnalyticsData => {
    if (!transactions || transactions.length === 0) {
      return {
        labels: [],
        income: [],
        expenses: [],
        totalIncome: 0,
        totalExpenses: 0,
        netAmount: 0,
        categoryBreakdown: [],
      };
    }

    const now = new Date();
    let filteredTransactions: Transaction[] = [];
    let labels: string[] = [];

    // Filter transactions based on period
    switch (selectedPeriod) {
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredTransactions = transactions.filter(t => new Date(t.date) >= weekAgo);
        // Generate labels for last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        }
        break;
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredTransactions = transactions.filter(t => new Date(t.date) >= monthAgo);
        // Generate labels for last 4 weeks
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        break;
      }
      case 'year': {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        filteredTransactions = transactions.filter(t => new Date(t.date) >= yearAgo);
        // Generate labels for last 12 months
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        }
        break;
      }
    }

    // Group transactions by time period
    const income: number[] = new Array(labels.length).fill(0);
    const expenses: number[] = new Array(labels.length).fill(0);
    
    filteredTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      let periodIndex = 0;

      switch (selectedPeriod) {
        case 'week': {
          const daysDiff = Math.floor((now.getTime() - transactionDate.getTime()) / (24 * 60 * 60 * 1000));
          periodIndex = Math.max(0, 6 - daysDiff);
          break;
        }
        case 'month': {
          const weeksDiff = Math.floor((now.getTime() - transactionDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          periodIndex = Math.max(0, Math.min(3, 3 - weeksDiff));
          break;
        }
        case 'year': {
          const monthsDiff = now.getMonth() - transactionDate.getMonth() + 
                            (now.getFullYear() - transactionDate.getFullYear()) * 12;
          periodIndex = Math.max(0, Math.min(11, 11 - monthsDiff));
          break;
        }
      }

      if (periodIndex >= 0 && periodIndex < labels.length) {
        if (transaction.amount > 0) {
          income[periodIndex] += transaction.amount;
        } else {
          expenses[periodIndex] += Math.abs(transaction.amount);
        }
      }
    });

    // Calculate totals
    const totalIncome = filteredTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = filteredTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Category breakdown for pie chart
    const categoryMap = new Map<string, number>();
    filteredTransactions
      .filter(t => t.amount < 0) // Only expenses for pie chart
      .forEach(transaction => {
        const category = transaction.category || 'Other';
        const amount = Math.abs(transaction.amount);
        categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
      });

    const categoryColors = [
      colors.tintPrimary,
      colors.positive,
      colors.warning,
      colors.negative,
      colors.info,
      withAlpha(colors.tintPrimary, 0.7),
      withAlpha(colors.positive, 0.7),
      withAlpha(colors.warning, 0.7),
    ];

    const categoryBreakdown = Array.from(categoryMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8) // Limit to top 8 categories
      .map(([name, amount], index) => ({
        name,
        amount,
        color: categoryColors[index] || colors.textSecondary,
      }));

    return {
      labels,
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      categoryBreakdown,
    };
  }, [transactions, selectedPeriod, colors]);

  // Chart configuration
  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    color: (opacity = 1) => withAlpha(colors.tintPrimary, opacity),
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 12,
      fontWeight: '500',
      fill: colors.textSecondary,
    },
    propsForVerticalLabels: {
      fontSize: 10,
      fill: colors.textSecondary,
    },
    propsForHorizontalLabels: {
      fontSize: 10,
      fill: colors.textSecondary,
    },
    style: {
      borderRadius: 16,
    },
  };

  const lineData = {
    labels: analyticsData.labels.length > 0 ? analyticsData.labels : ['No Data'],
    datasets: [
      {
        data: analyticsData.income.length > 0 ? analyticsData.income : [0],
        color: (opacity = 1) => withAlpha(colors.positive, opacity),
        strokeWidth: 3,
      },
      {
        data: analyticsData.expenses.length > 0 ? analyticsData.expenses : [0],
        color: (opacity = 1) => withAlpha(colors.negative, opacity),
        strokeWidth: 3,
      },
    ],
    legend: ['Income', 'Expenses'],
  };

  const pieData = analyticsData.categoryBreakdown.map((item, index) => ({
    name: item.name,
    population: item.amount,
    color: item.color,
    legendFontColor: colors.textSecondary,
    legendFontSize: 12,
  }));

  const periods: { key: Period; label: string }[] = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Analytics</Text>
        
        {/* Period Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.periodFilter}
        >
          {periods.map((period) => {
            const isSelected = selectedPeriod === period.key;
            
            return (
              <View key={period.key} style={styles.periodButtonWrapper}>
                <CustomButton
                  title={period.label}
                  size="sm"
                  isFilterAction
                  variant={isSelected ? 'primary' : 'secondary'}
                  onPress={() => setSelectedPeriod(period.key)}
                  style={[
                    styles.periodButton,
                    isSelected ? styles.periodButtonSelected : styles.periodButtonUnselected
                  ]}
                  textStyle={[
                    styles.periodButtonText,
                    { color: isSelected ? '#FFFFFF' : colors.textPrimary }
                  ]}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>

      {analyticsData.labels.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transaction data</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Make some transactions to see your analytics here
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Income</Text>
              <Text style={[styles.summaryValue, { color: colors.positive }]}>
                GHS {analyticsData.totalIncome.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.summaryValue, { color: colors.negative }]}>
                GHS {analyticsData.totalExpenses.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Net</Text>
              <Text style={[
                styles.summaryValue, 
                { color: analyticsData.netAmount >= 0 ? colors.positive : colors.negative }
              ]}>
                GHS {analyticsData.netAmount.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Line Chart */}
          <View style={styles.chartSection}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Income vs Expenses</Text>
            <LineChart
              data={lineData}
              width={screenWidth - 64}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={[styles.chart, { backgroundColor: colors.card }]}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={true}
              segments={4}
            />
          </View>

          {/* Pie Chart */}
          {analyticsData.categoryBreakdown.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Expense Categories</Text>
              <PieChart
                data={pieData}
                width={screenWidth - 64}
                height={200}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                style={styles.chart}
                hasLegend={true}
                center={[10, 10]}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  periodFilter: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  periodButtonWrapper: {
    marginRight: 8,
  },
  periodButton: {
    minWidth: 80,
    height: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodButtonSelected: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  periodButtonUnselected: {
    // Styles for unselected buttons
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  chartSection: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
});