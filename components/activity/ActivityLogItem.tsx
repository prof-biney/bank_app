import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityEvent } from '@/types/activity';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Info, Send } from 'lucide-react-native';

export default function ActivityLogItem({ event, themeColors, onPress }: { event: ActivityEvent; themeColors: any; onPress?: (e: ActivityEvent) => void; }) {
  const isTx = event.category === 'transaction';
  const amount = typeof event.amount === 'number' ? event.amount : undefined;
  const getToneColor = () => {
    const type = event.type || '';
    const status = (event.status || '').toString();
    const isError = type.includes('failed') || type.includes('removed') || type.includes('delete') || status.includes('failed');
    const isSuccess = type.includes('success') || type.includes('approved') || type.includes('added') || type.includes('created') || status.includes('completed');
    const isPending = type.includes('pending') || type.includes('unapproved') || status.includes('pending');
    if (isError) return themeColors.negative || '#EF4444';
    if (isSuccess) return themeColors.positive || '#10B981';
    if (isPending) return themeColors.warning || '#F59E0B';
    return themeColors.textSecondary;
  };

  const getIcon = () => {
    if (isTx) {
      // Check if it's a transfer transaction
      const isTransfer = event.type?.includes('transfer') || event.title?.toLowerCase().includes('transfer');
      
      if (isTransfer && (amount || 0) < 0) {
        // Red transfer icon for outgoing transfers (expenses)
        return <Send color={themeColors.negative || '#EF4444'} size={20} />;
      }
      
      // Transaction icons prefer amount color coding but respect failed/pending
      const tone = getToneColor();
      if ((amount || 0) > 0 && tone === themeColors.textSecondary) return <ArrowDownLeft color={themeColors.positive || '#10B981'} size={20} />;
      if ((amount || 0) < 0 && tone === themeColors.textSecondary) return <ArrowUpRight color={themeColors.negative || '#EF4444'} size={20} />;
      // If tone overrides (failed/pending/success), show generic with tone color
      return (amount || 0) >= 0 ? <ArrowDownLeft color={tone} size={20} /> : <ArrowUpRight color={tone} size={20} />;
    }
    const tone = getToneColor();
    if (event.category === 'card') return <CreditCard color={tone} size={20} />;
    return <Info color={tone} size={20} />;
  };

  const getAmountColor = () => {
    if (!isTx || amount === undefined) return themeColors.textSecondary;
    return amount > 0 ? (themeColors.positive || '#10B981') : (themeColors.negative || '#EF4444');
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const categoryText = event.tags?.[0] ?? event.category.charAt(0).toUpperCase() + event.category.slice(1);

  return (
    <TouchableOpacity 
      style={[styles.container, { 
        backgroundColor: themeColors.card,
        shadowColor: themeColors.textPrimary,
      }]} 
      onPress={() => onPress?.(event)}
    >
      <View style={[styles.iconContainer, { backgroundColor: themeColors.background }]}>{getIcon()}</View>

      <View style={styles.details}>
        <Text 
          style={[styles.description, { color: themeColors.textPrimary }]} 
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {event.title}
        </Text>
        <Text 
          style={[styles.category, { color: themeColors.textSecondary }]} 
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {categoryText}
        </Text>
      </View>

      <View style={styles.amountContainer}>
        {amount !== undefined ? (
          <Text style={[styles.amount, { color: getAmountColor() }]}>
            {amount > 0 ? '+' : ''}GHS {Math.abs(amount).toFixed(2)}
          </Text>
        ) : null}
        <Text style={[styles.date, { color: themeColors.textSecondary }]}>{formatDate(event.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  details: { flex: 1 },
  description: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
  },
  amountContainer: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  date: { fontSize: 12 },
});
