import { logger } from '@/lib/logger';
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
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "@/components/BankCard";
import { DateFilterModal } from "@/components/DateFilterModal";
import { NotificationModal } from "@/components/NotificationModal";
import { QuickAction } from "@/components/QuickAction";
import { TransactionItem } from "@/components/TransactionItem";
import { ProfilePicture } from "@/components/ProfilePicture";
import { ClearDataModal } from "@/components/ClearDataModal";
import { TransactionAnalytics } from "@/components/TransactionAnalytics";
import AnalyticsReportsModal from "@/components/AnalyticsReportsModal";
import { useApp } from "@/context/AppContext";

import { useTheme } from "@/context/ThemeContext";

export default function HomeScreen() {
  const { cards, activeCard, setActiveCard, transactions, clearAllTransactions, notifications } = useApp();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showDateFilter, setShowDateFilter] = React.useState(false);
  const [dateFilter, setDateFilter] = React.useState("all");
  const [showClearTransactions, setShowClearTransactions] = React.useState(false);
  const [isClearingTransactions, setIsClearingTransactions] = React.useState(false);
  const [showAnalyticsReports, setShowAnalyticsReports] = React.useState(false);

  const { user } = useAuthStore();
  const unreadCount = React.useMemo(() => {
    const unreadNotifications = notifications.filter(n => n.unread && !n.archived);
    const count = unreadNotifications.length;
    logger.info('SCREEN', '[HomeScreen] Notification count calculation:', {
      totalNotifications: notifications.length,
      unreadCount: count,
      unreadNotifications: unreadNotifications,
      allNotifications: notifications,
    });
    return count;
  }, [notifications]);

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


  const handleDeposit = () => {
    router.push("/deposit");
  };


  const handleClearTransactions = async () => {
    setIsClearingTransactions(true);
    try {
      await clearAllTransactions();
      logger.info('SCREEN', 'Transactions cleared successfully, dismissing modal');
      setShowClearTransactions(false);
    } catch (error) {
      logger.error('SCREEN', 'Failed to clear transactions:', error);
    } finally {
      setIsClearingTransactions(false);
    }
  };

  const handleCancelClearTransactions = () => {
    setShowClearTransactions(false);
  };

  const { colors, transitionStyle } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[{ flex: 1 }, transitionStyle]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ProfilePicture
                name={user?.name}
                imageUrl={user?.avatar}
                size="medium"
                style={styles.headerProfilePicture}
              />
              <View style={styles.greetingContainer}>
                <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back!</Text>
                <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
              </View>
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
              onPress={handleDeposit}
            />
            <QuickAction
              icon={<ArrowUpRight color={colors.tintPrimary} size={24} />}
              label="Transfer"
              onPress={handleTransfer}
            />
            <QuickAction
              icon={<CreditCard color={colors.tintPrimary} size={24} />}
              label="Withdraw"
              onPress={() => router.push("/withdraw")}
            />
            <QuickAction
              icon={<MoreHorizontal color={colors.tintPrimary} size={24} />}
              label="More"
              onPress={() => setShowAnalyticsReports(true)}
            />
          </View>

          {/* Transaction Analytics */}
          <TransactionAnalytics />

          <View style={[styles.transactionsSection, { backgroundColor: colors.card }]}>
            {/* Sticky Header */}
            <View style={[styles.stickyHeader, { backgroundColor: colors.card }]}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => setShowDateFilter(true)}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, textDecorationColor: colors.tintPrimary }]}>{getDateFilterLabel()}</Text>
                  </TouchableOpacity>
                </View>
                {transactions.length > 0 && (
                  <TouchableOpacity onPress={() => setShowClearTransactions(true)}>
                    <Text style={[styles.clearAllText, { color: colors.negative }]}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={styles.transactionsList}
              contentContainerStyle={[styles.transactionsScrollContent, { paddingTop: 64 }]}
              showsVerticalScrollIndicator={true}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
              indicatorStyle="default"
            >
              {/* Empty state when no transactions */}
              {recentTransactions.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <CreditCard color={colors.textSecondary} size={48} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No transactions yet</Text>
                  <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                    Start by making a transfer or payment to see your transaction history here.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.emptyStateButton, { backgroundColor: colors.tintPrimary }]}
                    onPress={handleTransfer}
                  >
                    <Text style={styles.emptyStateButtonText}>Make a Transfer</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                recentTransactions.map((transaction) => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>

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

        <ClearDataModal
          visible={showClearTransactions}
          onClose={handleCancelClearTransactions}
          onConfirm={handleClearTransactions}
          dataType="transactions"
          count={transactions.length}
          isLoading={isClearingTransactions}
        />

        <AnalyticsReportsModal
          visible={showAnalyticsReports}
          onClose={() => setShowAnalyticsReports(false)}
        />
      </KeyboardAvoidingView>
      </Animated.View>
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
  content: {
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerProfilePicture: {
    marginRight: 12,
  },
  greetingContainer: {
    flex: 1,
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
    flex: 1,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Subtle shadow for gentle separation
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    paddingTop: 24,
    // Add a subtle border at the bottom for better separation
    borderBottomWidth: Platform.OS === 'ios' ? 0.5 : 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
  clearAllText: {
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
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateDescription: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
