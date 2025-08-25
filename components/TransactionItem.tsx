import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
} from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Transaction } from "../types/index";
import { useTheme } from "@/context/ThemeContext";

interface TransactionItemProps {
  transaction: Transaction;
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const { colors } = useTheme();
  const getTransactionIcon = () => {
    switch (transaction.type) {
      case "deposit":
        return <ArrowDownLeft color={colors.positive} size={20} />;
      case "transfer":
        return <ArrowUpRight color={colors.negative} size={20} />;
      case "withdraw":
        return <Banknote color={colors.negative} size={20} />;
      case "payment":
        return <CreditCard color={colors.negative} size={20} />;
      default:
        return <CreditCard color={colors.textSecondary} size={20} />;
    }
  };

  const getAmountColor = () => {
    return transaction.amount > 0 ? colors.positive : colors.negative;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={[styles.container, { 
      backgroundColor: colors.card,
      shadowColor: colors.textPrimary,
    }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>{getTransactionIcon()}</View>

      <View style={styles.details}>
        <Text 
          style={[styles.description, { color: colors.textPrimary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {transaction.description}
        </Text>
        <Text 
          style={[styles.category, { color: colors.textSecondary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {transaction.category}
        </Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: getAmountColor() }]}>
          {transaction.amount > 0 ? "+" : ""}GHS 
          {Math.abs(transaction.amount).toFixed(2)}
        </Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(transaction.date)}</Text>
      </View>
    </View>
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
