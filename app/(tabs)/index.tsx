import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CreditCard,
  MoveHorizontal as MoreHorizontal,
} from "lucide-react-native";
import React from "react";
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
import { BankCard } from "../../components/BankCard";
import { DateFilterModal } from "../../components/DateFilterModal";
import { NotificationModal } from "../../components/NotificationModal";
import { QuickAction } from "../../components/QuickAction";
import { TransactionItem } from "../../components/TransactionItem";
import { useApp } from "../../context/AppContext";

import { useTheme } from "@/context/ThemeContext";

export default function HomeScreen() {
  const { cards, activeCard, setActiveCard, transactions } = useApp();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showDateFilter, setShowDateFilter] = React.useState(false);
  const [dateFilter, setDateFilter] = React.useState("all");

  const { user } = useAuthStore();
  const { notifications } = useApp();
  const unreadCount = React.useMemo(() => notifications.filter(n => n.unread).length, [notifications]);

  const getFilteredTransactions = () => {
    const now = new Date();
    let filteredTransactions = transactions;

    switch (dateFilter) {
      case "today":
        filteredTransactions = transactions.filter((t) => {
          const transactionDate = new Date(t.date);
          return transactionDate.toDateString() === now.toDateString();
        });
        break;
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredTransactions = transactions.filter(
          (t) => new Date(t.date) >= weekAgo
        );
        break;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredTransactions = transactions.filter(
          (t) => new Date(t.date) >= monthAgo
        );
        break;
      default:
        filteredTransactions = transactions;
    }

    return filteredTransactions.slice(0, 10);
  };

  const recentTransactions = getFilteredTransactions();


  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case "today":
        return "Today, Dec 20";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      default:
        return "All Transactions";
    }
  };

  const handleTransfer = () => {
    router.push("/transfer");
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back!</Text>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
            </View>
            <TouchableOpacity
              style={[styles.notificationButton, { backgroundColor: colors.card }]}
              onPress={() => setShowNotifications(true)}
            >
              <Bell color={colors.textSecondary} size={24} />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadgeCount, { backgroundColor: colors.negative }]}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.cardSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.cardsScroll}
            >
              {cards.map((card) => (
                <BankCard
                  key={card.id}
                  card={card}
                  selected={activeCard?.id === card.id}
                  onPress={() => setActiveCard(card)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.quickActions}>
            <QuickAction
              icon={<ArrowDownLeft color={colors.tintPrimary} size={24} />}
              label="Deposit"
              onPress={() => {}}
            />
            <QuickAction
              icon={<ArrowUpRight color={colors.tintPrimary} size={24} />}
              label="Transfer"
              onPress={handleTransfer}
            />
            <QuickAction
              icon={<CreditCard color={colors.tintPrimary} size={24} />}
              label="Withdraw"
              onPress={() => {}}
            />
            <QuickAction
              icon={<MoreHorizontal color={colors.tintPrimary} size={24} />}
              label="More"
              onPress={() => {}}
            />
          </View>

          <View style={[styles.transactionsSection, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setShowDateFilter(true)}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, textDecorationColor: colors.tintPrimary }]}>{getDateFilterLabel()}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => router.push("/(tabs)/activity")}>
                  <Text style={[styles.seeAllText, { color: colors.tintPrimary }]}>All transactions</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.transactionsList}
              contentContainerStyle={styles.transactionsScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {recentTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <NotificationModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
        />

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
  greeting: {
    fontSize: 16,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  notificationButton: {
    position: "relative",
    width: 44,
    height: 44,
    borderRadius: 22,
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
  notificationBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationBadgeCount: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  cardSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardsScroll: {
    marginBottom: 32,
  },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  transactionsSection: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    minHeight: 300,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  transactionsList: {
    flex: 1,
    maxHeight: 400, // Limit height so it can scroll within the section
  },
  transactionsScrollContent: {
    paddingBottom: 20,
  },
});
