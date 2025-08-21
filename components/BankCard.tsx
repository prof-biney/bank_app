import { CreditCard, Wifi, Trash2 } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card } from "../types/index";

interface BankCardProps {
  card: Card;
  onPress?: () => void;
  selected?: boolean;
  onDelete?: () => void;
}

export function BankCard({ card, onPress, selected, onDelete }: BankCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: card.cardColor },
        selected && styles.selectedCard,
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
          style={styles.deleteFab}
          accessibilityLabel="Delete card"
        >
          <Trash2 color="#B91C1C" size={18} />
        </TouchableOpacity>
      )}

      <View style={styles.cardHeader}>
        <CreditCard color="white" size={24} />
        <Wifi color="white" size={20} />
      </View>

      <View style={styles.cardNumber}>
        <Text style={styles.cardNumberText}>{card.cardNumber}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceAmount}>
            $
            {card.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardHolderName}>{card.cardHolderName}</Text>
          <Text style={styles.expiryDate}>{card.expiryDate}</Text>
        </View>
      </View>

      {selected && (
        <View style={styles.selectedIndicator}>
          <View style={styles.checkmark} />
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
  selectedCard: {
    borderWidth: 2,
    borderColor: "#0F766E",
  },
  deleteFab: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: "#FEE2E2",
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
    color: "white",
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
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    marginBottom: 4,
  },
  balanceAmount: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  cardInfo: {
    alignItems: "flex-end",
  },
  cardHolderName: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  expiryDate: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
  },
  selectedIndicator: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0F766E",
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
  },
});
