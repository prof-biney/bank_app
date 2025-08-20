import PaystackPayment from "@/components/PaystackPayment";
import { useAlert } from "@/context/AlertContext";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { PaystackProvider, usePaystack } from "react-native-paystack-webview";
import {
  Currency,
  PaymentChannels,
} from "react-native-paystack-webview/production/lib/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "../../components/BankCard";
import { useApp } from "../../context/AppContext";

function AddCardButton() {
  const { showAlert } = useAlert();
  const { addCard } = useApp();
  const { popup } = usePaystack();

  const defaultEmail =
    process.env.EXPO_PUBLIC_PAYSTACK_DEFAULT_EMAIL || "example@example.com";

  const handleAddCard = () => {
    // Use a small verification transaction to tokenize card with Paystack
    popup.newTransaction({
      email: defaultEmail,
      amount: 100, // minimal amount in kobo/pesewas depending on currency
      reference: `CARD_ADD_${Date.now()}`,
      onSuccess: async () => {
        // Since this demo has no backend to verify and fetch authorization data,
        // we simulate card metadata creation here.
        const last4 = Math.floor(1000 + Math.random() * 9000).toString();
        const masked = `•••• •••• •••• ${last4}`;

        addCard({
          userId: "user1",
          cardNumber: masked,
          cardHolderName: "Card Holder",
          expiryDate: "12/29",
          cardType: "visa",
          cardColor: "#1F2937",
          balance: 0,
        });
        showAlert(
          "success",
          "Card added successfully. (Demo: tokenization simulated)",
          "Card Added"
        );
      },
      onCancel: () => {
        showAlert("info", "Card addition was cancelled.", "Cancelled");
      },
      onError: (err) => {
        showAlert("error", `Failed to add card: ${err.message}`, "Error");
      },
      onLoad: () => {},
    });
  };

  return (
    <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
      <Text style={styles.addButtonText}>+ Add Card</Text>
    </TouchableOpacity>
  );
}

export default function CardsScreen() {
  const { cards, activeCard, setActiveCard, removeCard } = useApp();
  const { showAlert } = useAlert();

  // Check for required environment variables
  const requiredEnvVars = ["EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY"];
  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingEnvVars.length > 0) {
    console.warn(
      `Missing required Paystack environment variables: ${missingEnvVars.join(", ")}`
    );
    console.warn(
      "Please check your .env file and make sure all required variables are defined."
    );
  }

  // Get Paystack configuration from environment variables with fallbacks
  const paystackPublicKey = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  const paystackCurrency =
    (process.env.EXPO_PUBLIC_PAYSTACK_CURRENCY as Currency) || "GHS";

  // Default payment channels
  const defaultChannels = ["card", "mobile_money", "bank"] as PaymentChannels;

  const handleDelete = (id: string) => {
    removeCard(id);
    showAlert("success", "Card removed successfully.", "Card Deleted");
  };

  return (
    <PaystackProvider
      debug={process.env.EXPO_PUBLIC_APP_ENV === "development"}
      publicKey={paystackPublicKey}
      currency={paystackCurrency}
      defaultChannels={defaultChannels}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.header}>
            <Text style={styles.title}>My Cards</Text>
            <Text style={styles.subtitle}>Manage your payment cards</Text>
            <AddCardButton />
          </View>

          <ScrollView
            style={styles.cardsContainer}
            showsVerticalScrollIndicator={false}
          >
            {cards.map((card) => (
              <View key={card.id} style={styles.cardWrapper}>
                <BankCard
                  card={card}
                  selected={activeCard?.id === card.id}
                  onPress={() => setActiveCard(card)}
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(card.id)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PaystackProvider>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 12,
  },
  addButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0F766E",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
  deleteButton: {
    marginTop: 8,
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontWeight: "600",
  },
});
