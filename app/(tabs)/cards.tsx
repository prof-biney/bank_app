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
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "../../components/BankCard";
import { useApp } from "../../context/AppContext";

export default function CardsScreen() {
  const { cards, activeCard, setActiveCard } = useApp();

  return (
    <PaystackProvider
      debug
      publicKey="pk_test_4f1fd55a9201c20ad129ad496315324ed1ddb023"
      currency="GHS"
      defaultChannels={["card", "mobile_money", "bank"]}
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
