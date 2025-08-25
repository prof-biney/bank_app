import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import CustomButton from '@/components/CustomButton';
import Card from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';

export default function PaymentsScreen() {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const { activeCard } = useApp();

  useEffect(() => {
    const { getApiBase } = require('../../lib/api');
    const apiBase = getApiBase();
    const url = `${apiBase}/v1/payments`;
    (async () => {
      try {
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
      const { getApiBase } = require('../../lib/api');
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
      const { getApiBase } = require('../../lib/api');
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
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recent Payments</Text>
          {items.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>No payments yet</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                Create your first payment above to see it here.
              </Text>
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

