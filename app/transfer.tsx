import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useState } from "react";
import { 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "../components/BankCard";
import { useApp } from "../context/AppContext";
import { useAlert } from "../context/AlertContext";
import { Recipient } from "../types/index";
import { useTheme } from "@/context/ThemeContext";
import { getChipStyles } from "@/theme/variants";
import CustomButton from "@/components/CustomButton";
import { withAlpha } from "@/theme/color-utils";
import Badge from "@/components/ui/Badge";
import { getBadgeVisuals } from "@/theme/badge-utils";

export default function TransferScreen() {
  const { cards, activeCard, setActiveCard, addTransaction } = useApp();
  const { showAlert } = useAlert();
const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<
    "select-card" | "select-recipient" | "enter-amount"
  >("select-card");

  const handleCardSelect = (card: any) => {
    setActiveCard(card);
    setStep("select-recipient");
  };

const handleRecipientSelect = (name: string) => {
    const recipient: Recipient = {
      id: `manual.${Date.now()}`,
      name,
      avatar: "",
      accountNumber: "",
    };
    setSelectedRecipient(recipient);
    setStep("enter-amount");
  };

  const handleTransfer = () => {
    if (!activeCard || !selectedRecipient || !amount) {
      showAlert('error', 'Please complete all required fields.', 'Transfer Error');
      return;
    }

    const transferAmount = parseFloat(amount);
    
    if (isNaN(transferAmount) || transferAmount <= 0) {
      showAlert('error', 'Please enter a valid amount.', 'Transfer Error');
      return;
    }
    
    if (transferAmount > activeCard.balance) {
      showAlert('error', 'Insufficient funds for this transfer.', 'Transfer Error');
      return;
    }

    try {
      addTransaction({
        userId: activeCard.userId,
        cardId: activeCard.id,
        type: "transfer",
        amount: -transferAmount,
        description: `To ${selectedRecipient.name}`,
        recipient: selectedRecipient.name,
        category: "Transfer",
        status: "completed",
      });

      showAlert(
        'success', 
        `$${transferAmount.toFixed(2)} has been successfully transferred to ${selectedRecipient.name}.`,
        'Transfer Successful'
      );
      
      // Navigate back after a short delay to allow the user to see the alert
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      showAlert('error', 'An error occurred while processing your transfer. Please try again.', 'Transfer Failed');
      console.error('Transfer error:', error);
    }
  };

  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <ArrowLeft color={colors.textSecondary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Transfer</Text>
          <View style={styles.placeholder} />
        </View>

        {step === "select-card" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose cards</Text>
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
                  onPress={() => handleCardSelect(card)}
                />
              ))}
            </ScrollView>

            <CustomButton
              title="Continue"
              variant="primary"
              disabled={!activeCard}
              onPress={() => setStep("select-recipient")}
            />
          </View>
        )}

{step === "select-recipient" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter recipient name</Text>

            <View style={[styles.amountSection, { backgroundColor: colors.card }]}>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Recipient</Text>
              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="Full name"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.continueButton,
                !recipientName && styles.continueButtonDisabled,
              ]}
            >
              <CustomButton
                title="Continue"
                variant="primary"
                disabled={!recipientName.trim()}
                onPress={() => handleRecipientSelect(recipientName.trim())}
              />
            </TouchableOpacity>
          </View>
        )}

        {step === "enter-amount" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter amount</Text>

            <View style={[styles.amountSection, { backgroundColor: colors.card }]}>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={[styles.currencySymbol, { color: colors.textPrimary }]}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.quickAmounts}>
              {["5", "10", "15", "20", "50", "100", "200", "500"].map((value) => {
                const v = getBadgeVisuals(colors, { tone: 'accent', selected: amount === value, size: 'md' });
                return (
                  <Badge
                    key={value}
                    onPress={() => setAmount(value)}
                    bordered
                    borderColor={v.borderColor}
                    backgroundColor={v.backgroundColor}
                    textColor={v.textColor}
                    style={[styles.quickAmountButton]}
                  >
                    <Text style={[styles.quickAmountText, { color: v.textColor }]}>${value}</Text>
                  </Badge>
                );
              })}
            </View>

            <CustomButton
              title="Transfer"
              variant="primary"
              disabled={!amount}
              onPress={handleTransfer}
            />
          </View>
        )}
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  cardsScroll: {
    marginBottom: 40,
  },
  recipientsScroll: {
    marginBottom: 40,
    paddingVertical: 20,
  },
  amountSection: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 16,
    marginBottom: 16,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "bold",
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: "bold",
    minWidth: 100,
    textAlign: "center",
  },
  quickAmounts: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 40,
    justifyContent: "space-between",
  },
  quickAmountButton: {
    width: "22%",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 5,
  },
  quickAmountButtonActive: {
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: "600",
  },
  quickAmountTextActive: {
  },
  continueButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  continueButtonDisabled: {
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  transferButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  transferButtonDisabled: {
  },
  transferButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
