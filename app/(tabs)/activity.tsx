import { Filter, ArrowDownLeft, ArrowUpRight, User, CreditCard as CardIcon } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateFilterModal } from "@/components/DateFilterModal";
import ActivityLogItem from "@/components/activity/ActivityLogItem";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
import { useTheme } from "@/context/ThemeContext";
import CustomButton from "@/components/CustomButton";
import { getBadgeVisuals } from "@/theme/badge-utils";
import { TransactionItem } from "@/components/TransactionItem";
import { useApp } from "@/context/AppContext";
import { ActivityEvent } from "@/types/activity";

type Payment = {
  id: string;
  status: string;
  amount?: number;
  currency?: string;
  created?: string;
};

const DEFAULT_FILTERS = { income: true, expense: true, account: true, card: true } as const;
const DEFAULT_TYPE_FILTER = { deposit: true, transfer: true, withdraw: true, payment: true } as const;
const DEFAULT_STATUS_FILTER = { completed: true, pending: true, failed: true, reversed: true } as const;

// Map UI status chips -> server payment statuses (only used when narrowing)
const PAYMENT_STATUS_MAP: Record<keyof typeof DEFAULT_STATUS_FILTER, string> = {
  completed: "captured",
  pending: "authorized",
  failed: "failed",
  reversed: "refunded",
};

// Normalize diverse transaction statuses -> UI statuses
const TX_STATUS_MAP: Record<string, keyof typeof DEFAULT_STATUS_FILTER> = {
	captured: "completed",
  authorized: "pending",
  pending: "pending",
  failed: "failed",
  refunded: "reversed",
  reversed: "reversed",
  success: "completed",
  completed: "completed"
};

// Normalize diverse transaction types -> UI types
const TX_TYPE_MAP: Record<string, keyof typeof DEFAULT_TYPE_FILTER> = {
	deposit: "deposit",
  transfer: "transfer",
  withdraw: "withdraw",
  payment: "payment",
  card_payment: "payment",
  purchase: "payment"
};

function normalizeTxStatus(raw?: string): keyof typeof DEFAULT_STATUS_FILTER | undefined {
  if (!raw) return undefined;
  const k = raw.toLowerCase();
  return TX_STATUS_MAP[k] || undefined;
}

function normalizeTxType(raw?: string): keyof typeof DEFAULT_TYPE_FILTER | undefined {
  if (!raw) return undefined;
  const k = raw.toLowerCase();
  return TX_TYPE_MAP[k] || undefined;
}

function coalesceTimestamp(evt: any): Date | null {
  const raw = evt?.timestamp || evt?.createdAt || evt?.date || evt?.created || null;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export default function ActivityScreen() {
  const { transactions, activity } = useApp();
  const { getApiBase } = require("@/lib/api");

  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const PAY_PAGE_SIZE = 10;
  const [nextPaymentsCursor, setNextPaymentsCursor] = React.useState<string | null>(null);

  const { colors } = useTheme();
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [typeFilter, setTypeFilter] = useState({ ...DEFAULT_TYPE_FILTER });
  const [statusFilter, setStatusFilter] = useState({ ...DEFAULT_STATUS_FILTER });

  // Persist UI chip filters (income/expense/account/card)
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("activityFilters");
        if (raw) setFilters(prev => ({ ...prev, ...JSON.parse(raw) }));
      } catch {}
    })();
  }, []);
  React.useEffect(() => {
    AsyncStorage.setItem("activityFilters", JSON.stringify(filters)).catch(() => {});
  }, [filters]);

  // Persist transaction type/status filters
  React.useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem("txTypeFilter");
        if (t) setTypeFilter(prev => ({ ...prev, ...JSON.parse(t) }));
        const s = await AsyncStorage.getItem("txStatusFilter");
        if (s) setStatusFilter(prev => ({ ...prev, ...JSON.parse(s) }));
      } catch {}
    })();
  }, []);
  React.useEffect(() => {
    AsyncStorage.setItem("txTypeFilter", JSON.stringify(typeFilter)).catch(() => {});
  }, [typeFilter]);
  React.useEffect(() => {
    AsyncStorage.setItem("txStatusFilter", JSON.stringify(statusFilter)).catch(() => {});
  }, [statusFilter]);

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.income && !next.expense && !next.account && !next.card) return prev;
      return next;
    });
  };
  const toggleType = (key: keyof typeof typeFilter) => {
    setTypeFilter(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.deposit && !next.transfer && !next.withdraw && !next.payment) return prev;
      return next;
    });
  };
  const toggleStatus = (key: keyof typeof statusFilter) => {
    setStatusFilter(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.completed && !next.pending && !next.failed && !next.reversed) return prev;
      return next;
    });
  };
  const setAllOn = () => setFilters({ ...DEFAULT_FILTERS });

  // Date check helper
  const inRange = React.useCallback(
    (date: Date | null) => {
      if (!date) return true; // tolerate unknown timestamp
      const now = new Date();
      switch (dateFilter) {
        case "today":
          return date.toDateString() === now.toDateString();
        case "week":
          return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case "month":
          return date >= new Date(now.getFullYear(), now.getMonth(), 1);
        case "year":
          return date >= new Date(now.getFullYear(), 0, 1);
        default:
          return true;
      }
    },
    [dateFilter]
  );

  // Filtered transactions with normalization and tolerant fallbacks
  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];

    let list = [...transactions];

    // Date filter
    list = list.filter(t => inRange(new Date(t.date)));

    // Income/expense filter
    list = list.filter(t => {
      if (typeof t.amount === "number") {
        if (t.amount > 0) return filters.income;
        if (t.amount < 0) return filters.expense;
      }
      // Amount missing or zero → include if either is on
      return filters.income || filters.expense;
    });

    // Type filter (normalize unknowns; include if unknown)
    list = list.filter(t => {
      const norm = normalizeTxType(t.type);
      return norm ? typeFilter[norm] : true;
    });

    // Status filter (normalize unknowns; include if unknown)
    list = list.filter(t => {
      const norm = normalizeTxStatus(t.status);
      return norm ? statusFilter[norm] : true;
    });

    return list;
  }, [transactions, inRange, filters, typeFilter, statusFilter]);

  // Activity timeline with tolerant category + timestamp
  const activityCards = useMemo(() => {
    if (!Array.isArray(activity)) return [];
		const acceptedCategory = (cat?: string) => {
			if (!cat) return "transaction";
			const c = cat.toLowerCase();
			if (["transaction", "account", "card"].includes(c)) return c;
			if (c.startsWith("card_")) return "card";
			return "transaction";
		};

    const events = activity.filter(evt => {
      const c = acceptedCategory(evt.category);
      if (c === "transaction") {
        const amt = typeof evt.amount === "number" ? evt.amount : 0;
        if (amt > 0) return filters.income;
        if (amt < 0) return filters.expense;
        return filters.income || filters.expense;
      }
      if (c === "account") return filters.account;
      if (c === "card") return filters.card;
      // Unknown → include
      return true;
    });

    return events.filter(e => inRange(coalesceTimestamp(e)));
  }, [activity, filters, inRange]);

  // Build /v1/payments query, only narrowing when user actually narrowed
  const buildPaymentsQuery = (limit: number, cursor?: string) => {
    const apiBase = getApiBase();
    const params = new URLSearchParams();
    params.set("limit", String(limit));

    const selectedTypes = Object.entries(typeFilter)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (selectedTypes.length > 0 && selectedTypes.length < Object.keys(DEFAULT_TYPE_FILTER).length) {
      params.set("type", selectedTypes.join(","));
    }

    const selectedStatuses = Object.entries(statusFilter)
      .filter(([, v]) => v)
      .map(([k]) => k as keyof typeof DEFAULT_STATUS_FILTER)
      .map(k => PAYMENT_STATUS_MAP[k]);
    if (selectedStatuses.length > 0 && selectedStatuses.length < Object.keys(DEFAULT_STATUS_FILTER).length) {
      params.set("status", selectedStatuses.join(","));
    }

    if (cursor) params.set("cursor", cursor);

    return `${apiBase.replace(/\/$/, "")}/v1/payments?${params.toString()}`;
  };

  const fetchPayments = async (reset: boolean) => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setPayments([]);
        setNextPaymentsCursor(null);
      }
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const url = buildPaymentsQuery(PAY_PAGE_SIZE);
      const res = await fetch(url, {
        headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      });
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

  const loadMorePayments = async () => {
    if (!nextPaymentsCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const url = buildPaymentsQuery(PAY_PAGE_SIZE, nextPaymentsCursor);
      const res = await fetch(url, {
        headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      });
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

  // Single consolidated effect for fetching payments
  const filterSignature = useMemo(
    () => JSON.stringify({ typeFilter, statusFilter }),
    [typeFilter, statusFilter]
  );
  React.useEffect(() => {
    fetchPayments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Activity</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.card }]}
              onPress={() => setShowDateFilter(true)}
            >
              <Filter color={colors.textSecondary} size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Type chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterTabs, { marginBottom: 0 }]}
          contentContainerStyle={styles.filterScrollContent}
        >
          {(() => {
            const v = getBadgeVisuals(colors, { tone: "neutral", size: "md" });
            return (
              <View style={{ marginRight: 5 }}>
                <CustomButton
                  title="All"
                  size="sm"
                  isFilterAction
                  variant={v.textColor === "#fff" ? "primary" : "secondary"}
                  onPress={setAllOn}
                  style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })()}

          {(() => {
            const v = getBadgeVisuals(colors, { tone: "success", selected: filters.income, size: "md" });
            return (
              <View style={{ marginRight: 5 }}>
                <CustomButton
                  size="sm"
                  isFilterAction
                  variant={v.textColor === "#fff" ? "primary" : "secondary"}
                  onPress={() => toggleFilter("income")}
                  title="Income"
                  leftIcon={<ArrowDownLeft size={14} color={v.textColor as string} />}
                  style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })()}

          {(() => {
            const v = getBadgeVisuals(colors, { tone: "danger", selected: filters.expense, size: "md" });
            return (
              <View style={{ marginRight: 5 }}>
                <CustomButton
                  size="sm"
                  isFilterAction
                  variant={v.textColor === "#fff" ? "primary" : "secondary"}
                  onPress={() => toggleFilter("expense")}
                  title="Expense"
                  leftIcon={<ArrowUpRight size={14} color={v.textColor as string} />}
                  style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })()}

          {(() => {
            const v = getBadgeVisuals(colors, { tone: "accent", selected: filters.account, size: "md" });
            return (
              <View style={{ marginRight: 5 }}>
                <CustomButton
                  size="sm"
                  isFilterAction
                  variant={v.textColor === "#fff" ? "primary" : "secondary"}
                  onPress={() => toggleFilter("account")}
                  title="Account"
                  leftIcon={<User size={14} color={v.textColor as string} />}
                  style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })()}

          {(() => {
            const v = getBadgeVisuals(colors, { tone: "accent", selected: filters.card, size: "md" });
            return (
              <View style={{ marginRight: 5 }}>
                <CustomButton
                  size="sm"
                  isFilterAction
                  variant={v.textColor === "#fff" ? "primary" : "secondary"}
                  onPress={() => toggleFilter("card")}
                  title="Cards"
                  leftIcon={<CardIcon size={14} color={v.textColor as string} />}
                  style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })()}
        </ScrollView>

        {/* Status chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterTabs, { marginBottom: 8 }]}
          contentContainerStyle={styles.filterScrollContent}
        >
          {(["completed", "pending", "failed", "reversed"] as const).map(key => {
            const tone = key === "completed" ? "success" : key === "failed" ? "danger" : "warning";
            const v = getBadgeVisuals(colors, { tone: tone as any, selected: statusFilter[key], size: "sm" });
            const title = key[0].toUpperCase() + key.slice(1);
            return (
              <View key={key} style={{ marginRight: 5 }}>
                <CustomButton
                  size="sm"
                  isFilterAction
                  variant={v.textColor === "#fff" ? "primary" : "secondary"}
                  onPress={() => toggleStatus(key)}
                  title={title}
                  style={{ backgroundColor: v.backgroundColor, borderColor: v.borderColor, borderWidth: 1 }}
                  textStyle={{ color: v.textColor }}
                />
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.transactionsContainer}>
          <ScrollView style={styles.transactionsList} showsVerticalScrollIndicator={false}>
            {!loading &&
              !error &&
              activityCards.length === 0 &&
              filteredTransactions.length === 0 &&
              payments.length === 0 && (
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>
                    No activities yet
                  </Text>
                  <Text
                    style={{ marginTop: 8, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 32 }}
                  >
                    Once you add cards, make payments, or perform transfers, your activity will appear here.
                  </Text>
                </View>
              )}

            {activityCards.map(evt => (
              <ActivityLogItem
                key={evt.id}
                event={evt}
                themeColors={colors}
                onPress={e => {
                  setSelected(e);
                  setShowDetail(true);
                }}
              />
            ))}

            {filteredTransactions.map(transaction => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}

            {loading && <Text style={{ padding: 16, color: colors.textSecondary }}>Loading payments…</Text>}
            {error && <Text style={{ padding: 16, color: colors.negative }}>{error}</Text>}

            {payments.map(p => (
              <View
                key={p.id}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                  Payment {p.id.slice(-6)}
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  {p.status.toUpperCase()} • {p.amount ?? "-"} {p.currency ?? ""}
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  {p.created ? new Date(p.created).toLocaleString() : ""}
                </Text>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {p.status === "authorized" && (
                    <TouchableOpacity
                      onPress={() => handleCapture(p.id)}
                      style={{
                        backgroundColor: colors.tintPrimary,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "600" }}>Capture</Text>
                    </TouchableOpacity>
                  )}
                  {(p.status === "authorized" || p.status === "captured") && (
                    <TouchableOpacity
                      onPress={() => handleRefund(p.id)}
                      style={{
                        backgroundColor: colors.negative,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "600" }}>Refund</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {nextPaymentsCursor && (
              <View style={{ padding: 16, alignItems: "center" }}>
                <TouchableOpacity
                  disabled={loadingMore}
                  onPress={loadMorePayments}
                  style={{
                    backgroundColor: colors.tintPrimary,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 8,
                    opacity: loadingMore ? 0.8 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    {loadingMore ? "Loading…" : "Load more payments"}
                  </Text>
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

  async function handleCapture(id: string) {
    try {
      const { getApiBase } = require("@/lib/api");
      const apiBase = getApiBase();
      const url = `${apiBase.replace(/\/$/, "")}/v1/payments/${id}/capture`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = {};
      if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
      const res = await fetch(url, { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPayments(prev => prev.map(p => (p.id === id ? { ...p, status: "captured" } : p)));
    } catch (e) {}
  }

  async function handleRefund(id: string) {
    try {
      const { getApiBase } = require("@/lib/api");
      const apiBase = getApiBase();
      const url = `${apiBase.replace(/\/$/, "")}/v1/payments/${id}/refund`;
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const headers: any = {};
      if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
      const res = await fetch(url, { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPayments(prev => prev.map(p => (p.id === id ? { ...p, status: "refunded" } : p)));
    } catch (e) {}
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardContainer: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: { fontSize: 28, fontWeight: "bold" },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTabs: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 0, marginBottom: 0 },
  filterScrollContent: { paddingRight: 8 },
  transactionsContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 8,
    paddingTop: 8,
  },
  transactionsList: { flex: 1 },
});

