import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
} from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
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
    <View className="flex-row items-center py-4 px-5 bg-white border-b border-gray-100">
      <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center mr-3">
        {getTransactionIcon()}
      </View>

      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-800 mb-1">
          {transaction.description}
        </Text>
        <Text className="text-sm text-gray-500">{transaction.category}</Text>
      </View>

      <View className="items-end">
        <Text
          className="text-base font-bold mb-1"
          style={{ color: getAmountColor() }}
        >
          {transaction.amount > 0 ? "+" : ""}$
          {Math.abs(transaction.amount).toFixed(2)}
        </Text>
        <Text className="text-xs text-gray-400">
          {formatDate(transaction.date)}
        </Text>
      </View>
    </View>
  );
}
