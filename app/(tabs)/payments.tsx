import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaymentsScreen() {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    const url = `${apiBase.replace(/\/$/, '')}/v1/payments`;
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
    setSubmitting(true);
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const url = `${apiBase.replace(/\/$/, '')}/v1/payments`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = { 'Content-Type': 'application/json' };
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      headers['Idempotency-Key'] = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const body = { amount: value, currency: 'GHS', source: 'tok_demo', description: 'Payment from app' };
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
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const url = `${apiBase.replace(/\/$/, '')}/v1/payments/${id}/${kind}`;
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Create and manage payments. Currency is Ghana Cedi (GHS).</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Payment (GHS)</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Amount in GHS"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity onPress={onCreate} disabled={submitting} style={styles.buttonPrimary}>
              <Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
          {error && <Text style={{ color: '#ef4444' }}>{error}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Payments</Text>
          {items.map((p) => (
            <View key={p.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>Payment {p.id.slice(-6)}</Text>
                <Text style={{ color: '#6B7280' }}>{p.status.toUpperCase()} • {p.amount ?? '-'} {p.currency ?? ''}</Text>
                <Text style={{ color: '#6B7280' }}>{p.created ? new Date(p.created).toLocaleString() : ''}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {p.status === 'authorized' && (
                  <TouchableOpacity onPress={() => action(p.id, 'capture')} style={styles.buttonSmallPrimary}>
                    <Text style={styles.buttonText}>Capture</Text>
                  </TouchableOpacity>
                )}
                {(p.status === 'authorized' || p.status === 'captured') && (
                  <TouchableOpacity onPress={() => action(p.id, 'refund')} style={styles.buttonSmallDanger}>
                    <Text style={styles.buttonText}>Refund</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { color: '#6B7280', marginTop: 4, marginBottom: 12 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontWeight: '700', marginBottom: 12, color: '#111827' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  buttonPrimary: { backgroundColor: '#1D4ED8', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  buttonSmallPrimary: { backgroundColor: '#0F766E', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  buttonSmallDanger: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: 'white', fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
});

