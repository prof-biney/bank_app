import { Filter, ArrowDownLeft, ArrowUpRight, User, CreditCard as CardIcon } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateFilterModal } from "../../components/DateFilterModal";
import ActivityLogItem from "@/components/activity/ActivityLogItem";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
import { useTheme } from "@/context/ThemeContext";
import { TransactionItem } from "../../components/TransactionItem";
import { useApp } from "../../context/AppContext";
import { ActivityEvent } from "@/types/activity";

type Payment = { id: string; status: string; amount?: number; currency?: string; created?: string };

export default function ActivityScreen() {
  const handleCreatePayment = async () => {
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
      const url = `${apiBase.replace(/\/$/, "")}/v1/payments`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = { 'Content-Type': 'application/json' };
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      headers['Idempotency-Key'] = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ amount: 1000, currency: 'GHS', source: 'tok_demo', description: 'Demo payment' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // prepend for UX
      setPayments((prev) => [{ id: data.id, status: data.status, amount: data.amount, currency: data.currency, created: data.created }, ...prev]);
    } catch (e) {
      // no-op for brevity; could show alert
    }
  };

  const handleCapture = async (id: string) => {
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
      const url = `${apiBase.replace(/\/$/, "")}/v1/payments/${id}/capture`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = {};
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      const res = await fetch(url, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'captured' } : p)));
    } catch (e) {}
  };

  const handleRefund = async (id: string) => {
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
      const url = `${apiBase.replace(/\/$/, "")}/v1/payments/${id}/refund`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = {};
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      const res = await fetch(url, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'refunded' } : p)));
    } catch (e) {}
  };
  const { transactions, activity } = useApp();
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
    const url = `${apiBase.replace(/\/$/, "")}/v1/payments`;
    async function run() {
      try {
        setLoading(true);
        const jwt = (global as any).__APPWRITE_JWT__ || undefined;
        const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setPayments(Array.isArray(data?.data) ? data.data : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load payments");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, []);
  const { colors } = useTheme();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [filters, setFilters] = useState({ income: true, expense: true, account: true, card: true });

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('activityFilters');
        if (raw) {
          const parsed = JSON.parse(raw);
          setFilters((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem('activityFilters', JSON.stringify(filters)).catch(() => {});
  }, [filters]);

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Enforce at least one on
      if (!next.income && !next.expense && !next.account && !next.card) {
        return prev; // ignore toggle that would turn all off
      }
      return next;
    });
  };

  const setAllOn = () => setFilters({ income: true, expense: true, account: true, card: true });

  const getFilteredTransactions = () => {
    if (!Array.isArray(transactions)) return [];

    let filtered = [...transactions];

    // Apply date filter first
    const now = new Date();
    switch (dateFilter) {
      case "today":
        filtered = filtered.filter((t) => {
          const transactionDate = new Date(t.date);
          return transactionDate.toDateString() === now.toDateString();
        });
        break;
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((t) => new Date(t.date) >= weekAgo);
        break;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((t) => new Date(t.date) >= monthAgo);
        break;
    }

    // Apply income/expense filter
    filtered = filtered.filter((transaction) => {
      if (transaction.amount > 0) return filters.income;
      if (transaction.amount < 0) return filters.expense;
      return true;
    });

    return filtered;
  };

  const activityCards = useMemo(() => {
    const events: ActivityEvent[] = activity.filter((evt) => {
      if (evt.category === 'transaction') {
        const amt = typeof evt.amount === 'number' ? evt.amount : 0;
        if (amt > 0) return filters.income;
        if (amt < 0) return filters.expense;
        // If no amount, include if either income or expense is on
        return filters.income || filters.expense;
      }
      if (evt.category === 'account') return filters.account;
      if (evt.category === 'card') return filters.card;
      return true;
    });

    // Date filter for activity timeline
    const now2 = new Date();
    const inRange = (ts: string) => {
      const d = new Date(ts);
      switch (dateFilter) {
        case "today":
          return d.toDateString() === now2.toDateString();
        case "week":
          return d >= new Date(now2.getTime() - 7 * 24 * 60 * 60 * 1000);
        case "month":
          return d >= new Date(now2.getTime() - 30 * 24 * 60 * 60 * 1000);
        default:
          return true;
      }
    };

    return events.filter((e) => inRange(e.timestamp));
  }, [activity, filters, dateFilter]);

  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const filteredTransactions = getFilteredTransactions();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Activity</Text>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => setShowDateFilter(true)}
          >
            <Filter color={colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
]}
            onPress={setAllOn}
          >
              <Text
                style={[
                  styles.filterTabText,
                  { color: colors.textSecondary },
                ]}
              >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              { backgroundColor: filters.income ? colors.tintPrimary : colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => toggleFilter('income')}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filters.income ? '#FFFFFF' : colors.textSecondary },
]}
            >
              <ArrowDownLeft size={14} color={filters.income ? '#FFFFFF' : colors.textSecondary} /> Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              { backgroundColor: filters.expense ? colors.tintPrimary : colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => toggleFilter('expense')}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filters.expense ? '#FFFFFF' : colors.textSecondary },
]}
            >
              <ArrowUpRight size={14} color={filters.expense ? '#FFFFFF' : colors.textSecondary} /> Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              { backgroundColor: filters.account ? colors.tintPrimary : colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => toggleFilter('account')}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filters.account ? '#FFFFFF' : colors.textSecondary },
]}
            >
              <User size={14} color={filters.account ? '#FFFFFF' : colors.textSecondary} /> Account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              { backgroundColor: filters.card ? colors.tintPrimary : colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => toggleFilter('card')}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filters.card ? '#FFFFFF' : colors.textSecondary },
]}
            >
              <CardIcon size={14} color={filters.card ? '#FFFFFF' : colors.textSecondary} /> Cards
            </Text>
          </TouchableOpacity>
          </ScrollView>
        </View>


        <View style={styles.transactionsContainer}>
          <ScrollView
            style={styles.transactionsList}
            showsVerticalScrollIndicator={false}
          >
            {/* Activity timeline events (account, card, and transaction summaries) */}
            {activityCards.map((evt) => (
                <ActivityLogItem key={evt.id} event={evt} themeColors={colors} onPress={(e) => { setSelected(e); setShowDetail(true); }} />
              ))}

            {/* Detailed transaction list (still shown for finances) */}
            {filteredTransactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}

            {/* Payments from server */}
            {loading && (
              <Text style={{ padding: 16, color: colors.textSecondary }}>Loading payments…</Text>
            )}
            {error && (
              <Text style={{ padding: 16, color: '#ef4444' }}>{error}</Text>
            )}
            {payments.map((p) => (
              <View key={p.id} style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Payment {p.id.slice(-6)}</Text>
                <Text style={{ color: colors.textSecondary }}>{p.status.toUpperCase()} • {p.amount ?? '-'} {p.currency ?? ''}</Text>
                <Text style={{ color: colors.textSecondary }}>{p.created ? new Date(p.created).toLocaleString() : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {p.status === 'authorized' && (
                    <TouchableOpacity onPress={() => handleCapture(p.id)} style={{ backgroundColor: '#0F766E', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Capture</Text>
                    </TouchableOpacity>
                  )}
                  {(p.status === 'authorized' || p.status === 'captured') && (
                    <TouchableOpacity onPress={() => handleRefund(p.id)} style={{ backgroundColor: '#ef4444', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Refund</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Quick create payment (demo) */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          <TouchableOpacity onPress={handleCreatePayment} style={{ backgroundColor: '#1D4ED8', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Create Test Payment</Text>
          </TouchableOpacity>
        </View>

        <DateFilterModal
          visible={showDateFilter}
          onClose={() => setShowDateFilter(false)}
          selectedFilter={dateFilter}
          onFilterSelect={setDateFilter}
        />

        <ActivityDetailModal visible={showDetail} event={selected} onClose={() => setShowDetail(false)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  filterScrollContent: {
    paddingRight: 20,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: "white",
  },
  filterTabActive: {
    backgroundColor: "#0F766E",
  },
  filterTabText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
  },
  filterTabTextActive: {
    color: "white",
  },
  categoryChips: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryChipActive: {
    backgroundColor: "#0F766E",
    borderColor: "#0F766E",
  },
  categoryChipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  transactionsContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 8,
    paddingTop: 8,
  },
  transactionsList: {
    flex: 1,
  },
  activityItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "white",
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  activitySubtitle: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 2,
  },
  activityMeta: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
});
