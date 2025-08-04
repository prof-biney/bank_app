import PaystackPayment from "@/components/PaystackPayment";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PaystackProvider } from "react-native-paystack-webview";
import {
  Currency,
  PaymentChannels,
} from "react-native-paystack-webview/production/lib/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "../../components/BankCard";
import { useApp } from "../../context/AppContext";

export default function CardsScreen() {
  const { cards, activeCard, setActiveCard } = useApp();

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
          </View>

          <PaystackPayment />

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
    paddingBottom: 24,
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
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
});
