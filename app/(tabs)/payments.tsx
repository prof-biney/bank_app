import { logger } from '@/lib/logger';
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import CustomButton from '@/components/CustomButton';
import Card from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { ClearDataModal } from '@/components/ClearDataModal';
import { transactionService, withdrawalService, type WithdrawalRequest, type WithdrawalMethod } from '@/lib/appwrite';
import LoadingAnimation from '@/components/LoadingAnimation';
import { useLoading, LOADING_CONFIGS } from '@/hooks/useLoading';
import useAuthStore from '@/store/auth.store';
import { router } from 'expo-router';

export default function PaymentsScreen() {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [showClearPayments, setShowClearPayments] = useState(false);
  const [paymentsSuppressed, setPaymentsSuppressed] = useState(false);
  const [isClearingPayments, setIsClearingPayments] = useState(false);
  const [activeTab, setActiveTab] = useState<'payments' | 'withdrawals'>('payments');
  const { activeCard, cards, makeTransaction, refreshCardBalances } = useApp();
  const { user } = useAuthStore();
  const { loading, withLoading, showLoading, hideLoading } = useLoading();

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const suppressedFlag = await AsyncStorage.getItem('payments_manually_cleared');
      
      if (suppressedFlag) {
        logger.info('UI', 'Payments are suppressed, skipping fetch');
        setPaymentsSuppressed(true);
        setItems([]);
        return;
      }

      await withLoading(async () => {
        const userId = user?.id || user?.$id;
        if (!userId) return;
        const result = await transactionService.queryTransactions({ 
          filters: { type: 'payment' },
          limit: 20,
          orderBy: '$createdAt',
          orderDirection: 'desc'
        });
        setItems(result.transactions || []);
      }, LOADING_CONFIGS.LOAD_TRANSACTIONS);
    } catch (e: any) {
      // Only show error if it's not just due to empty data
      if (!e?.message?.includes('No transactions found') && !e?.message?.includes('empty')) {
        setError(e?.message || 'Failed to load payments');
        logger.error('UI', 'Failed to load payments:', e);
      } else {
        logger.info('UI', 'No payments found, showing empty state');
        setItems([]);
      }
    }
  };

  const onCreate = async () => {
    setError(null);
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!activeCard?.id) {
      setError('Please select a card first.');
      return;
    }
    const userId = user?.id || user?.$id;
    if (!userId) {
      setError('User not authenticated.');
      return;
    }

    try {
      await withLoading(async () => {
        const transaction = await transactionService.createTransaction({
          cardId: activeCard.id,
          type: 'payment',
          amount: value,
          description: 'Payment from app',
          category: 'general',
          status: 'completed'
        });
        setItems((prev) => [transaction, ...prev]);
        setAmount('');
      }, LOADING_CONFIGS.PROCESS_TRANSACTION);
    } catch (e: any) {
      setError(e?.message || 'Failed to create payment');
      logger.error('UI', 'Failed to create payment:', e);
    }
  };

  const action = async (id: string, kind: 'capture' | 'refund') => {
    try {
      const { getApiBase } = require('@/lib/api');
      const apiBase = getApiBase();
      const url = `${apiBase}/v1/payments/${id}/${kind}`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = {};
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      const res = await fetch(url, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status: kind === 'capture' ? 'captured' : 'refunded' } : p)));
    } catch (e: any) {
      setError(e?.message || `Failed to ${kind}`);
    }
  };

  const handleClearPayments = async () => {
    setIsClearingPayments(true);
    try {
      logger.info('UI', 'Starting clear payments operation');
      
      // Clear the payments from the local state
      setItems([]);
      
      // Clear payment data from AsyncStorage if applicable
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('paymentData');
      await AsyncStorage.removeItem('payments_cache');
      
      // Set suppression flag to prevent reloading on next visit
      await AsyncStorage.setItem('payments_manually_cleared', Date.now().toString());
      setPaymentsSuppressed(true);
      
      logger.info('UI', 'Payments cleared successfully');
      setShowClearPayments(false);
    } catch (error) {
      logger.error('UI', 'Failed to clear payments:', error);
      setError('Failed to clear payments. Please try again.');
    } finally {
      setIsClearingPayments(false);
    }
  };

  const handleCancelClearPayments = () => {
    setShowClearPayments(false);
  };
  
  const handleRestorePayments = async () => {
    try {
      logger.info('UI', 'Restoring payments after clear');
      
      // Remove suppression flag
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('payments_manually_cleared');
      setPaymentsSuppressed(false);
      
      // Reload payments
      const { getApiBase } = require('@/lib/api');
      const apiBase = getApiBase();
      const url = `${apiBase}/v1/payments`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems(Array.isArray(data?.data) ? data.data : []);
      
      logger.info('UI', 'Payments restored successfully');
    } catch (e: any) {
      // Only show error if it's not just due to empty data
      if (!e?.message?.includes('No payments found') && !e?.message?.includes('empty')) {
        setError(e?.message || 'Failed to restore payments');
        logger.error('UI', 'Failed to restore payments:', e);
      } else {
        logger.info('UI', 'No payments found during restore, showing empty state');
        setItems([]);
      }
    }
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Payments</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Create and manage payments. Currency is Ghana Cedi (GHS).</Text>

        <Card>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Create Payment (GHS)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary }]}
              placeholder="Amount in GHS"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholderTextColor={colors.textSecondary}
            />
            <CustomButton onPress={onCreate} isLoading={loading.visible} title={loading.visible ? 'Creating...' : 'Create'} variant="primary" size="md" />
          </View>
          {error && <Text style={{ color: colors.negative }}>{error}</Text>}
        </Card>

        {/* Withdrawal Quick Actions */}
        <Card>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Withdraw Money</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginBottom: 16 }]}>Quick withdrawal options for your convenience</Text>
          
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={[
                styles.withdrawalOption,
                { backgroundColor: colors.background, borderColor: colors.border }
              ]}
              onPress={() => router.push('/withdraw')}
            >
              <Text style={{ fontSize: 24, marginBottom: 8 }}>📱</Text>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Mobile Money</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>MTN • Telecel • AirtelTigo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.withdrawalOption,
                { backgroundColor: colors.background, borderColor: colors.border }
              ]}
              onPress={() => router.push('/withdraw')}
            >
              <Text style={{ fontSize: 24, marginBottom: 8 }}>🏦</Text>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Bank Transfer</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>GCB • Ecobank • More</Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[
                styles.withdrawalOption,
                { backgroundColor: colors.background, borderColor: colors.border }
              ]}
              onPress={() => router.push('/withdraw')}
            >
              <Text style={{ fontSize: 24, marginBottom: 8 }}>💰</Text>
              <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>Cash Pickup</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>Western Union • MoneyGram</Text>
            </TouchableOpacity>
            
            <View style={{ flex: 1 }}>
              <CustomButton 
                onPress={() => router.push('/withdraw')} 
                title="View All Options" 
                variant="outline" 
                size="md"
              />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Recent Payments</Text>
            {items.length > 0 && (
              <TouchableOpacity onPress={() => setShowClearPayments(true)}>
                <Text style={{ color: colors.negative, fontSize: 14, fontWeight: '600' }}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
          {items.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>
                {paymentsSuppressed ? 'Payments cleared' : 'No payments yet'}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                {paymentsSuppressed 
                  ? 'Your payment history has been cleared from this session.'
                  : 'Create your first payment above to see it here.'
                }
              </Text>
              {paymentsSuppressed && (
                <TouchableOpacity 
                  onPress={handleRestorePayments}
                  style={{ 
                    marginTop: 12, 
                    paddingVertical: 8, 
                    paddingHorizontal: 16, 
                    backgroundColor: colors.tintPrimary, 
                    borderRadius: 8 
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Restore Payments</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            items.map((p) => (
              <View key={p.id} style={[styles.item, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Payment {p.id.slice(-6)}</Text>
                  <Text style={{ color: colors.textSecondary }}>{p.status.toUpperCase()} • {p.amount ?? '-'} {p.currency ?? ''}</Text>
                  <Text style={{ color: colors.textSecondary }}>{p.created ? new Date(p.created).toLocaleString() : ''}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {p.status === 'authorized' && (
                    <CustomButton onPress={() => action(p.id, 'capture')} title="Capture" variant="primary" size="sm" />
                  )}
                  {(p.status === 'authorized' || p.status === 'captured') && (
                    <CustomButton onPress={() => action(p.id, 'refund')} title="Refund" variant="danger" size="sm" />
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
      
      <ClearDataModal
        visible={showClearPayments}
        onClose={handleCancelClearPayments}
        onConfirm={handleClearPayments}
        dataType="payments"
        count={items.length}
        isLoading={isClearingPayments}
      />
      
      <LoadingAnimation
        visible={loading.visible}
        message={loading.message}
        subtitle={loading.subtitle}
        type={loading.type}
        size={loading.size}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 4, marginBottom: 12 },
  cardTitle: { fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  buttonPrimary: { backgroundColor: '#1D4ED8', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  buttonSmallPrimary: { backgroundColor: '#0F766E', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  buttonSmallDanger: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: 'white', fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  withdrawalOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 100,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  optionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});

