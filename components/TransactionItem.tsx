import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
} from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Transaction } from "../types/index";

interface TransactionItemProps {
  transaction: Transaction;
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const getTransactionIcon = () => {
    switch (transaction.type) {
      case "deposit":
        return <ArrowDownLeft color="#10B981" size={20} />;
      case "transfer":
        return <ArrowUpRight color="#EF4444" size={20} />;
      case "withdraw":
        return <Banknote color="#EF4444" size={20} />;
      case "payment":
        return <CreditCard color="#EF4444" size={20} />;
      default:
        return <CreditCard color="#6B7280" size={20} />;
    }
  };

  const getAmountColor = () => {
    return transaction.amount > 0 ? "#10B981" : "#EF4444";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>{getTransactionIcon()}</View>

      <View style={styles.details}>
        <Text style={styles.description}>{transaction.description}</Text>
        <Text style={styles.category}>{transaction.category}</Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: getAmountColor() }]}>
          {transaction.amount > 0 ? "+" : ""}$
          {Math.abs(transaction.amount).toFixed(2)}
        </Text>
        <Text style={styles.date}>{formatDate(transaction.date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
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
    color: "#1F2937",
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: "#6B7280",
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
    color: "#9CA3AF",
  },
});
