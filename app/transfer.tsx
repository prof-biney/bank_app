import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BankCard } from "../components/BankCard";
import { RecipientItem } from "../components/RecipientItem";
import { useApp } from "../context/AppContext";
import { mockRecipients } from "../lib/mockdata";
import { Recipient } from "../types/index";

export default function TransferScreen() {
  const { cards, activeCard, setActiveCard, addTransaction } = useApp();
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<
    "select-card" | "select-recipient" | "enter-amount"
  >("select-card");

  const handleCardSelect = (card: any) => {
    setActiveCard(card);
    setStep("select-recipient");
  };

  const handleRecipientSelect = (recipient: Recipient) => {
    setSelectedRecipient(recipient);
    setStep("enter-amount");
  };

  const handleTransfer = () => {
    if (!activeCard || !selectedRecipient || !amount) return;

    const transferAmount = parseFloat(amount);

    addTransaction({
      userId: "user1",
      cardId: activeCard.id,
      type: "transfer",
      amount: -transferAmount,
      description: `To ${selectedRecipient.name}`,
      recipient: selectedRecipient.name,
      category: "Transfer",
      status: "completed",
    });

    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft color="#374151" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Transfer</Text>
          <View style={styles.placeholder} />
        </View>

        {step === "select-card" && (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Choose cards</Text>
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

            <TouchableOpacity
              style={[
                styles.continueButton,
                !activeCard && styles.continueButtonDisabled,
              ]}
              onPress={() => setStep("select-recipient")}
              disabled={!activeCard}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "select-recipient" && (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Choose recipients</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.recipientsScroll}
            >
              {mockRecipients.map((recipient) => (
                <RecipientItem
                  key={recipient.id}
                  recipient={recipient}
                  selected={selectedRecipient?.id === recipient.id}
                  onPress={() => handleRecipientSelect(recipient)}
                />
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.continueButton,
                !selectedRecipient && styles.continueButtonDisabled,
              ]}
              onPress={() => setStep("enter-amount")}
              disabled={!selectedRecipient}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "enter-amount" && (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Enter amount</Text>

            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
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
              {["5", "10", "15", "20", "50", "100", "200", "500"].map(
                (value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.quickAmountButton,
                      amount === value && styles.quickAmountButtonActive,
                    ]}
                    onPress={() => setAmount(value)}
                  >
                    <Text
                      style={[
                        styles.quickAmountText,
                        amount === value && styles.quickAmountTextActive,
                      ]}
                    >
                      ${value}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.transferButton,
                !amount && styles.transferButtonDisabled,
              ]}
              onPress={handleTransfer}
              disabled={!amount}
            >
              <Text style={styles.transferButtonText}>Transfer</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
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
    color: "#1F2937",
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
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 16,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1F2937",
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#1F2937",
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
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "white",
    alignItems: "center",
    marginBottom: 12,
  },
  quickAmountButtonActive: {
    backgroundColor: "#0F766E",
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  quickAmountTextActive: {
    color: "white",
  },
  continueButton: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  continueButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  continueButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  transferButton: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  transferButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  transferButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
