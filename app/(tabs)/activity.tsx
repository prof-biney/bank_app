import { Filter, ArrowDownLeft, ArrowUpRight, User, CreditCard as CardIcon } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateFilterModal } from "../../components/DateFilterModal";
import ActivityLogItem from "@/components/activity/ActivityLogItem";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
import { useTheme } from "@/context/ThemeContext";
import { getChipStyles } from "@/theme/variants";
import { withAlpha } from "@/theme/color-utils";
import CustomButton from "@/components/CustomButton";
import { getBadgeVisuals } from "@/theme/badge-utils";
import { TransactionItem } from "../../components/TransactionItem";
import { useApp } from "../../context/AppContext";
import { ActivityEvent } from "@/types/activity";

type Payment = { id: string; status: string; amount?: number; currency?: string; created?: string };

export default function ActivityScreen() {

  const handleCapture = async (id: string) => {
    try {
      const { getApiBase } = require('../../lib/api');
      const apiBase = getApiBase();
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
      const { getApiBase } = require('../../lib/api');
      const apiBase = getApiBase();
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
  const { getApiBase } = require('../../lib/api');
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const PAY_PAGE_SIZE = 10;
  const [nextPaymentsCursor, setNextPaymentsCursor] = React.useState<string | null>(null);

  // Maps Activity screen status chips to payment statuses
  const paymentStatusMap: Record<string, string> = {
    completed: 'captured',
    pending: 'authorized',
    failed: 'failed',
    reversed: 'refunded',
  };

  const buildPaymentsQuery = (limit: number, cursor?: string) => {
    const apiBase = getApiBase();
    const types = Object.keys(typeFilter).filter((k) => (typeFilter as any)[k]);
    const statuses = Object.keys(statusFilter)
      .filter((k) => (statusFilter as any)[k])
      .map((k) => paymentStatusMap[k] || '')
      .filter(Boolean);
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (types.length) params.set('type', types.join(','));
    if (statuses.length) params.set('status', statuses.join(','));
    if (cursor) params.set('cursor', cursor);
    return `${apiBase.replace(/\/$/, "")}/v1/payments?${params.toString()}`;
  };

  const fetchPayments = async (reset: boolean) => {
    try {
      if (reset) {
        setLoading(true);
        setPayments([]);
        setNextPaymentsCursor(null);
      }
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const url = buildPaymentsQuery(PAY_PAGE_SIZE);
      const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const list: Payment[] = Array.isArray(data?.data) ? data.data : [];
      setPayments(list);
      setNextPaymentsCursor(data?.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load payments");
    } finally {
      if (reset) setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPayments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  React.useEffect(() => {
    // initial load
    fetchPayments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMorePayments = async () => {
    if (!nextPaymentsCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const url = buildPaymentsQuery(PAY_PAGE_SIZE, nextPaymentsCursor);
      const res = await fetch(url, { headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const list: Payment[] = Array.isArray(data?.data) ? data.data : [];
      setPayments(prev => {
        const seen = new Set(prev.map(p => p.id));
        const merged = [...prev];
        for (const item of list) if (!seen.has(item.id)) merged.push(item);
        return merged;
      });
      setNextPaymentsCursor(data?.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load more payments");
    } finally {
      setLoadingMore(false);
    }
  };
  const { colors } = useTheme();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [filters, setFilters] = useState({ income: true, expense: true, account: true, card: true });
  const [typeFilter, setTypeFilter] = useState({ deposit: true, transfer: true, withdraw: true, payment: true });
  const [statusFilter, setStatusFilter] = useState({ completed: true, pending: true, failed: true, reversed: true });

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

  React.useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('txTypeFilter');
        if (t) setTypeFilter(prev => ({ ...prev, ...JSON.parse(t) }));
        const s = await AsyncStorage.getItem('txStatusFilter');
        if (s) setStatusFilter(prev => ({ ...prev, ...JSON.parse(s) }));
      } catch {}
    })();
  }, []);
  React.useEffect(() => {
    AsyncStorage.setItem('txTypeFilter', JSON.stringify(typeFilter)).catch(() => {});
  }, [typeFilter]);
  React.useEffect(() => {
    AsyncStorage.setItem('txStatusFilter', JSON.stringify(statusFilter)).catch(() => {});
  }, [statusFilter]);

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

  const toggleType = (key: keyof typeof typeFilter) => {
    setTypeFilter(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.deposit && !next.transfer && !next.withdraw && !next.payment) {
        return prev;
      }
      return next;
    });
  };

  const toggleStatus = (key: keyof typeof statusFilter) => {
    setStatusFilter(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.completed && !next.pending && !next.failed && !next.reversed) {
        return prev;
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
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter((t) => new Date(t.date) >= startOfMonth);
        break;
      case "year":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filtered = filtered.filter((t) => new Date(t.date) >= startOfYear);
        break;
    }

    // Apply income/expense filter
    filtered = filtered.filter((transaction) => {
      if (transaction.amount > 0) return filters.income;
      if (transaction.amount < 0) return filters.expense;
      return true;
    });

    // Apply type filter
    filtered = filtered.filter((t) => (typeFilter as any)[t.type]);

    // Apply status filter
    filtered = filtered.filter((t) => (statusFilter as any)[t.status]);

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
          return d >= new Date(now2.getFullYear(), now2.getMonth(), 1);
        case "year":
          return d >= new Date(now2.getFullYear(), 0, 1);
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Activity</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginRight: 10 }]}
              onPress={() => setShowDateFilter(true)}
            >
              <Filter color={colors.textSecondary} size={20} />
            </TouchableOpacity>
            <Pressable
              android_ripple={{ color: withAlpha(colors.tintPrimary, 0.12) }}
              onPress={() => { setFilters({ income: true, expense: true, account: true, card: true }); setTypeFilter({ deposit: true, transfer: true, withdraw: true, payment: true }); setStatusFilter({ completed: true, pending: true, failed: true, reversed: true }); setDateFilter('all'); }}
              style={({ pressed }) => [
                { marginLeft: 0 },
                getChipStyles(colors, { tone: 'neutral', size: 'md' }).container,
                { borderRadius: 8, paddingHorizontal: 5 },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[getChipStyles(colors, { tone: 'neutral', size: 'md' }).text]}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.filterTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {(() => {
              const v = getBadgeVisuals(colors, { tone: 'neutral', size: 'md' });
              return (
                <View style={{ marginRight: 5 }}>
                  <CustomButton
                    title="All"
                    size="sm"
                    variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
                    onPress={setAllOn}
style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 }}

                    textStyle={{ color: v.textColor }}
                  />
                </View>
              );
            })()}

            {(() => {
              const v = getBadgeVisuals(colors, { tone: 'success', selected: filters.income, size: 'md' });
              return (
                <View style={{ marginRight: 5 }}>
                  <CustomButton
                    size="sm"
                    variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
                    onPress={() => toggleFilter('income')}
                    title="Income"
                    leftIcon={<ArrowDownLeft size={14} color={v.textColor as string} />}
style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 5, borderRadius: 8 }}
                    textStyle={{ color: v.textColor }}
                  />
                </View>
              );
            })()}

            {(() => {
              const v = getBadgeVisuals(colors, { tone: 'danger', selected: filters.expense, size: 'md' });
              return (
                <View style={{ marginRight: 5 }}>
                  <CustomButton
                    size="sm"
                    variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
                    onPress={() => toggleFilter('expense')}
                    title="Expense"
                    leftIcon={<ArrowUpRight size={14} color={v.textColor as string} />}
style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 }}
                    textStyle={{ color: v.textColor }}
                  />
                </View>
              );
            })()}

            {(() => {
              const v = getBadgeVisuals(colors, { tone: 'accent', selected: filters.account, size: 'md' });
              return (
                <View style={{ marginRight: 5 }}>
                  <CustomButton
                    size="sm"
                    variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
                    onPress={() => toggleFilter('account')}
                    title="Account"
                    leftIcon={<User size={14} color={v.textColor as string} />}
style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 5, borderRadius: 18 }}
                    textStyle={{ color: v.textColor }}
                  />
                </View>
              );
            })()}

            {(() => {
              const v = getBadgeVisuals(colors, { tone: 'accent', selected: filters.card, size: 'md' });
              return (
                <View style={{ marginRight: 5 }}>
                  <CustomButton
                    size="sm"
                    variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
                    onPress={() => toggleFilter('card')}
                    title="Cards"
                    leftIcon={<CardIcon size={14} color={v.textColor as string} />}
style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 5, borderRadius: 18 }}
                    textStyle={{ color: v.textColor }}
                  />
                </View>
              );
            })()}
          </ScrollView>
        </View>


        {/* Transaction Status Filters */}
        <View style={[styles.categoryChips, { paddingBottom: 4 }] }>
          {(['completed','pending','failed','reversed'] as const).map(key => {
            const tone = key === 'completed' ? 'success' : key === 'failed' ? 'danger' : 'warning';
            const v = getBadgeVisuals(colors, { tone: tone as any, selected: statusFilter[key], size: 'sm' });
            const title = key[0].toUpperCase() + key.slice(1);
            return (
              <View key={key} style={{ marginRight: 5 }}>
                <CustomButton size="sm" variant={v.textColor === '#fff' ? 'primary' : 'secondary'}
                  onPress={() => toggleStatus(key)}
                  title={title}
style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 5, borderRadius: 18 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.transactionsContainer}>
          <ScrollView
            style={styles.transactionsList}
            showsVerticalScrollIndicator={false}
          >
            {/* Empty state when there are no activities/payments/transactions */}
            {!loading && !error && activityCards.length === 0 && filteredTransactions.length === 0 && payments.length === 0 && (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>No activities yet</Text>
                <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
                  Once you add cards, make payments, or perform transfers, your activity will appear here.
                </Text>
              </View>
            )}

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
              <Text style={{ padding: 16, color: colors.negative }}>{error}</Text>
            )}
            {payments.map((p) => (
              <View key={p.id} style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
                <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Payment {p.id.slice(-6)}</Text>
                <Text style={{ color: colors.textSecondary }}>{p.status.toUpperCase()} • {p.amount ?? '-'} {p.currency ?? ''}</Text>
                <Text style={{ color: colors.textSecondary }}>{p.created ? new Date(p.created).toLocaleString() : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {p.status === 'authorized' && (
                    <TouchableOpacity onPress={() => handleCapture(p.id)} style={{ backgroundColor: colors.tintPrimary, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Capture</Text>
                    </TouchableOpacity>
                  )}
                  {(p.status === 'authorized' || p.status === 'captured') && (
                    <TouchableOpacity onPress={() => handleRefund(p.id)} style={{ backgroundColor: colors.negative, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Refund</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            {nextPaymentsCursor && (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <TouchableOpacity disabled={loadingMore} onPress={loadMorePayments} style={{ backgroundColor: colors.tintPrimary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, opacity: loadingMore ? 0.8 : 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{loadingMore ? 'Loading…' : 'Load more payments'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 6,
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  filterTabActive: {},
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  filterTabTextActive: {},
  categoryChips: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 0,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryChipActive: {},
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  categoryChipTextActive: {},
  transactionsContainer: {
    flex: 1,
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
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  activitySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  activityMeta: {
    fontSize: 11,
    marginTop: 4,
  },
});
