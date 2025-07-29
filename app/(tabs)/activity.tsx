import { Filter } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DateFilterModal } from "../../components/DateFilterModal";
import { TransactionItem } from "../../components/TransactionItem";
import { useApp } from "../../context/AppContext";

export default function ActivityScreen() {
  const { transactions } = useApp();
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");

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

        <View style={styles.transactionsContainer}>
          <ScrollView
            style={styles.transactionsList}
            showsVerticalScrollIndicator={false}
          >
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
