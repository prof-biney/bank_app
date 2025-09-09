import { logger } from '@/utils/logger';
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import CustomButton from '@/components/CustomButton';
import Card from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { ClearDataModal } from '@/components/ClearDataModal';

export default function PaymentsScreen() {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [showClearPayments, setShowClearPayments] = useState(false);
  const [isClearingPayments, setIsClearingPayments] = useState(false);
  const [paymentsSuppressed, setPaymentsSuppressed] = useState(false);
  const { activeCard } = useApp();

  useEffect(() => {
    (async () => {
      try {
        // Check if payments were manually cleared
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const suppressedFlag = await AsyncStorage.getItem('payments_manually_cleared');
        
        if (suppressedFlag) {
          logger.info('UI', 'Payments are suppressed, skipping fetch');
          setPaymentsSuppressed(true);
          setItems([]);
          return;
        }
        
        const { getApiBase } = require('@/lib/api');
        const apiBase = getApiBase();
        const url = `${apiBase}/v1/payments`;
        const jwt = (global as any).__APPWRITE_JWT__ || undefined;
        const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setItems(Array.isArray(data?.data) ? data.data : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load payments');
      }
    })();
  }, []);

  const onCreate = async () => {
    setError(null);
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!activeCard || !activeCard.token) {
      setError('Select a card with a valid token before creating a payment.');
      return;
    }
    setSubmitting(true);
    try {
      const { getApiBase } = require('@/lib/api');
      const apiBase = getApiBase();
      const url = `${apiBase}/v1/payments`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = { 'Content-Type': 'application/json' };
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      headers['Idempotency-Key'] = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const body = { amount: value, currency: 'GHS', source: activeCard.token, description: 'Payment from app' };
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems((prev) => [{ id: data.id, status: data.status, amount: data.amount, currency: data.currency, created: data.created }, ...prev]);
      setAmount('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create payment');
    } finally {
      setSubmitting(false);
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
      setError(e?.message || 'Failed to restore payments');
      logger.error('UI', 'Failed to restore payments:', e);
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
            <CustomButton onPress={onCreate} isLoading={submitting} title={submitting ? 'Creating...' : 'Create'} variant="primary" size="md" />
          </View>
          {error && <Text style={{ color: colors.negative }}>{error}</Text>}
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
});

