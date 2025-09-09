import { logger } from '@/utils/logger';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  PlusCircle,
  Wallet,
} from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Transaction } from "@/types/index";
import { useTheme } from "@/context/ThemeContext";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";

interface TransactionItemProps {
  transaction: Transaction;
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const { colors } = useTheme();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const getTransactionIcon = () => {
    switch (transaction.type) {
      case "deposit":
        return <PlusCircle color={colors.positive} size={20} />;
      case "transfer":
        return <ArrowUpRight color={colors.negative} size={20} />;
      case "withdraw":
        return <Banknote color={colors.negative} size={20} />;
      case "payment":
        return <CreditCard color={colors.negative} size={20} />;
      default:
        return <Wallet color={colors.textSecondary} size={20} />;
    }
  };

  const getAmountColor = () => {
    // For deposits, always show positive (green) as they increase balance
    if (transaction.type === "deposit") {
      return colors.positive;
    }
    return transaction.amount > 0 ? colors.positive : colors.negative;
  };

  const getTransactionDescription = () => {
    if (transaction.type === "deposit") {
      if (transaction.status === "pending") {
        return `Deposit (Pending) - ${transaction.description}`;
      }
      return `Deposit - ${transaction.description}`;
    }
    return transaction.description;
  };

  const getTransactionCategory = () => {
    if (transaction.type === "deposit") {
      return transaction.status === "pending" ? "Pending Deposit" : "Account Funding";
    }
    return transaction.category;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.container, { 
          backgroundColor: colors.card,
          shadowColor: colors.textPrimary,
        }]}
        onPress={() => setShowDetailModal(true)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>{getTransactionIcon()}</View>

        <View style={styles.details}>
          <Text 
            style={[styles.description, { color: colors.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {getTransactionDescription()}
          </Text>
          <Text 
            style={[styles.category, { color: colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {getTransactionCategory()}
          </Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: getAmountColor() }]}>
            {(transaction.type === "deposit" || transaction.amount > 0) ? "+" : ""}GHS 
            {Math.abs(transaction.amount).toFixed(2)}
          </Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(transaction.date)}</Text>
        </View>
      </TouchableOpacity>

      <TransactionDetailModal
        visible={showDetailModal}
        transaction={transaction}
        onClose={() => setShowDetailModal(false)}
        onTransactionUpdated={() => {
          // Transaction updated - the AppContext will handle state updates
          logger.info('UI', 'Transaction updated:', transaction.id);
        }}
        onTransactionDeleted={() => {
          // Transaction deleted - the AppContext will handle state updates
          logger.info('UI', 'Transaction deleted:', transaction.id);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  details: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
});
