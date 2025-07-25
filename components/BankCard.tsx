import { Card } from "@/types";
import cn from "clsx";
import { CreditCard, View, Wifi } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity } from "react-native";

interface BankCardProps {
  card: Card;
  onPress: () => void;
  selected: boolean;
}

const BankCard = ({ card, onPress, selected }: BankCardProps) => {
  return (
    <TouchableOpacity
      className={cn(
        "w-[300px] h-[180px] rounded-xl p-5 mx-2 shadow-lg elevation-8",
        selected && "border-2 border-teal-700"
      )}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Card Header */}
      <View className="flex-row justify-between items-center mb-5">
        <CreditCard color="white" size={24} />
        <Wifi color="white" size={20} />
      </View>

      {/* Card Number */}
      <View className="mb-5">
        <Text className="text-white text-lg font-semibold tracking-widest">
          {card.cardNumber}
        </Text>
      </View>

      {/* Card Footer */}
      <View className="flex-row justify-between items-end">
        <View>
          <Text className="text-white/70 text-xs mb-1">Balance</Text>
          <Text className="text-white text-2xl font-bold">
            $
            {card.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View className="items-end">
          <Text className="text-white text-xs font-medium">
            {card.cardHolderName}
          </Text>
          <Text className="text-white/70 text-xs">{card.expiryDate}</Text>
        </View>
      </View>

      {selected && (
        <View className="absolute top-4 right-4 w-6 h-6 rounded-full bg-teal-700 justify-center items-center">
          <View className="w-2 h-2 rounded-full bg-white" />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default BankCard;
