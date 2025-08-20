import { Filter } from "lucide-react-native";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { DateFilterModal } from "../../components/DateFilterModal";
import { TransactionItem } from "../../components/TransactionItem";
import { useApp } from "../../context/AppContext";
import { ActivityEvent } from "@/types/activity";

export default function ActivityScreen() {
  const { transactions, activity } = useApp();
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [categories, setCategories] = useState<{
    transaction: boolean;
    account: boolean;
    card: boolean;
  }>({ transaction: true, account: true, card: true });

  const toggleCategory = (key: keyof typeof categories) => {
    setCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

    // Apply type filter
    filtered = filtered.filter((transaction) => {
      if (filter === "income") return transaction.amount > 0;
      if (filter === "expense") return transaction.amount < 0;
      return true; // 'all'
    });

    return filtered;
  };

  const activityCards = useMemo(() => {
    const events: ActivityEvent[] = activity.filter((evt) => {
      if (evt.category === "transaction" && !categories.transaction) return false;
      if (evt.category === "account" && !categories.account) return false;
      if (evt.category === "card" && !categories.card) return false;
      return true;
    });

    // Date filter for activity timeline
    const now = new Date();
    const inRange = (ts: string) => {
      const d = new Date(ts);
      switch (dateFilter) {
        case "today":
          return d.toDateString() === now.toDateString();
        case "week":
          return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case "month":
          return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default:
          return true;
      }
    };

    return events.filter((e) => inRange(e.timestamp));
  }, [activity, categories, dateFilter]);

  const filteredTransactions = getFilteredTransactions();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Activity</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowDateFilter(true)}
          >
            <Filter color="#374151" size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filter === "all" && styles.filterTabActive,
            ]}
            onPress={() => setFilter("all")}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === "all" && styles.filterTabTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filter === "income" && styles.filterTabActive,
            ]}
            onPress={() => setFilter("income")}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === "income" && styles.filterTabTextActive,
              ]}
            >
              Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filter === "expense" && styles.filterTabActive,
            ]}
            onPress={() => setFilter("expense")}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === "expense" && styles.filterTabTextActive,
              ]}
            >
              Expense
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category chips for activity types */}
        <View style={styles.categoryChips}>
          {([
            ["transaction", "Transactions"],
            ["account", "Account"],
            ["card", "Cards"],
          ] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.categoryChip,
                categories[key] && styles.categoryChipActive,
              ]}
              onPress={() => toggleCategory(key)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  categories[key] && styles.categoryChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.transactionsContainer}>
          <ScrollView
            style={styles.transactionsList}
            showsVerticalScrollIndicator={false}
          >
            {/* Activity timeline events (account, card, and transaction summaries) */}
            {activityCards.map((evt) => (
              <View key={evt.id} style={styles.activityItem}>
                <Text style={styles.activityTitle}>{evt.title}</Text>
                {evt.subtitle ? (
                  <Text style={styles.activitySubtitle}>{evt.subtitle}</Text>
                ) : null}
                <Text style={styles.activityMeta}>
                  {new Date(evt.timestamp).toLocaleString()}
                </Text>
              </View>
            ))}

            {/* Detailed transaction list (still shown for finances) */}
            {filteredTransactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </ScrollView>
        </View>

        <DateFilterModal
          visible={showDateFilter}
          onClose={() => setShowDateFilter(false)}
          selectedFilter={dateFilter}
          onFilterSelect={setDateFilter}
        />
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
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
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
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
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
});
