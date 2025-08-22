import { CreditCard, Wifi, Trash2, Check } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card } from "../types/index";
import { useTheme } from "@/context/ThemeContext";
import { chooseReadableText, withAlpha } from "@/theme/color-utils";

interface BankCardProps {
  card: Card;
  onPress?: () => void;
  selected?: boolean;
  onDelete?: () => void;
}

export function BankCard({ card, onPress, selected, onDelete }: BankCardProps) {
  const { colors } = useTheme();
  const bg = card.cardColor;
  const textOnCard = chooseReadableText(bg);
  const subTextOnCard = withAlpha(textOnCard, 0.7);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: selected ? colors.tintPrimary : undefined, borderWidth: selected ? 2 : 0 },
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.9}
    >
      {onDelete && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={[styles.deleteFab, { backgroundColor: withAlpha(colors.negative, 0.12) }]}
          accessibilityLabel="Delete card"
        >
          <Trash2 color={colors.negative} size={18} />
        </TouchableOpacity>
      )}

      <View style={styles.cardHeader}>
        <CreditCard color={textOnCard} size={24} />
        <Wifi color={textOnCard} size={20} />
      </View>

      <View style={styles.cardNumber}>
        <Text style={[styles.cardNumberText, { color: textOnCard }]}>{card.cardNumber}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={[styles.balanceLabel, { color: subTextOnCard }]}>Balance</Text>
          <Text style={[styles.balanceAmount, { color: textOnCard }]}>
            $
            {card.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardHolderName, { color: textOnCard }]}>{card.cardHolderName}</Text>
          <Text style={[styles.expiryDate, { color: subTextOnCard }]}>{card.expiryDate}</Text>
        </View>
      </View>

      {selected && (
        <View style={[styles.selectedIndicator, { backgroundColor: colors.tintPrimary }]}>
          <View style={[styles.checkmark, { backgroundColor: chooseReadableText(colors.tintPrimary) }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 300,
    height: 180,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteFab: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardNumber: {
    marginBottom: 20,
  },
  cardNumberText: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  balanceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: "bold",
  },
  cardInfo: {
    alignItems: "flex-end",
  },
  cardHolderName: {
    fontSize: 12,
    fontWeight: "500",
  },
  expiryDate: {
    fontSize: 12,
  },
  selectedIndicator: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
