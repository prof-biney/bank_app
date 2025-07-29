import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CreditCard,
  MoveHorizontal as MoreHorizontal,
} from 'lucide-react-native';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BankCard } from '../../components/BankCard';
import { DateFilterModal } from '../../components/DateFilterModal';
import { NotificationModal } from '../../components/NotificationModal';
import { QuickAction } from '../../components/QuickAction';
import { TransactionItem } from '../../components/TransactionItem';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const { cards, activeCard, setActiveCard, transactions } = useApp();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showDateFilter, setShowDateFilter] = React.useState(false);
  const [dateFilter, setDateFilter] = React.useState('all');

  const getFilteredTransactions = () => {
    const now = new Date();
    let filteredTransactions = transactions;

    switch (dateFilter) {
      case 'today':
        filteredTransactions = transactions.filter((t) => {
          const transactionDate = new Date(t.date);
          return transactionDate.toDateString() === now.toDateString();
        });
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredTransactions = transactions.filter(
          (t) => new Date(t.date) >= weekAgo,
        );
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredTransactions = transactions.filter(
          (t) => new Date(t.date) >= monthAgo,
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
      case 'today':
        return 'Today, Dec 20';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      default:
        return 'All Transactions';
    }
  };

  const handleTransfer = () => {
    router.push('/transfer');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back!</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setShowNotifications(true)}
            >
              <Bell color="#374151" size={24} />
              <View style={styles.notificationBadge} />
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
              icon={<ArrowDownLeft color="#0F766E" size={24} />}
              label="Deposit"
              onPress={() => {}}
            />
            <QuickAction
              icon={<ArrowUpRight color="#0F766E" size={24} />}
              label="Transfer"
              onPress={handleTransfer}
            />
            <QuickAction
              icon={<CreditCard color="#0F766E" size={24} />}
              label="Withdraw"
              onPress={() => {}}
            />
            <QuickAction
              icon={<MoreHorizontal color="#0F766E" size={24} />}
              label="More"
              onPress={() => {}}
            />
          </View>

          <View style={styles.transactionsSection}>
            <View style={styles.sectionHeader}>
              <TouchableOpacity onPress={() => setShowDateFilter(true)}>
                <Text style={styles.sectionTitle}>{getDateFilterLabel()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
                <Text style={styles.seeAllText}>All transactions</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.transactionsList}>
              {recentTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </View>
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
    backgroundColor: '#F8FAFC',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  notificationButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  cardSection: {
    marginBottom: 32,
  },
  cardsScroll: {
    paddingLeft: 20,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  transactionsSection: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    minHeight: 300,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textDecorationLine: 'underline',
    textDecorationColor: '#0F766E',
  },
  seeAllText: {
    color: '#0F766E',
    fontSize: 14,
    fontWeight: '500',
  },
  transactionsList: {
    flex: 1,
  },
});
