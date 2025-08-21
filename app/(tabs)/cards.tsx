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
  Alert,
} from "react-native";
import { PaystackProvider, usePaystack } from "react-native-paystack-webview";
import {
  Currency,
  PaymentChannels,
} from "react-native-paystack-webview/production/lib/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "../../components/BankCard";
import { useApp } from "../../context/AppContext";
import useAuthStore from "@/store/auth.store";

import AddCardModal from "@/components/modals/AddCardModal";

function AddCardButton() {
  const { showAlert } = useAlert();
  const { addCard } = useApp();
  const { user } = useAuthStore();

  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
  const deriveCardsUrl = () => {
    try {
      const u = new URL(apiBase);
      // Android emulator special host if using localhost/127.0.0.1
      const isLocalHost = ["localhost", "127.0.0.1"].includes(u.hostname);
      // eslint-disable-next-line no-undef
      const isAndroid = Platform.OS === 'android';
      if (isLocalHost && isAndroid) {
        u.hostname = '10.0.2.2';
      }
      u.pathname = u.pathname.replace(/\/$/, "");
      u.pathname = `${u.pathname}/v1/cards`;
      return u.toString();
    } catch {
      return `${apiBase.replace(/\/$/, "")}/v1/cards`;
    }
  };
  const cardsUrl = deriveCardsUrl();

  const [visible, setVisible] = React.useState(false);
  const open = () => setVisible(true);
  const close = () => setVisible(false);

  const handleSubmit = async (payload: { number: string; name: string; exp_month: string; exp_year: string; cvc: string }) => {
    try {
      // Obtain Appwrite JWT from your auth layer if available
      const jwt = (global as any).__APPWRITE_JWT__ || undefined;
      const res = await fetch(cardsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          number: payload.number.replace(/\s+/g, ""),
          name: payload.name,
          exp_month: Number(payload.exp_month),
          exp_year: Number(payload.exp_year),
          cvc: payload.cvc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error === "validation_error" ? JSON.stringify(data.details) : (data?.error || `HTTP ${res.status}`);
        throw new Error(msg);
      }
      const last4 = data?.authorization?.last4 || "0000";
      const brand = (data?.authorization?.brand || "visa").toLowerCase();
      const expMonth = String(data?.authorization?.exp_month || payload.exp_month).padStart(2, "0");
      const expYear = String(data?.authorization?.exp_year || payload.exp_year).slice(-2);
      const masked = `•••• •••• •••• ${last4}`;
      const holder = data?.customer?.name || payload.name || "Card Holder";

      addCard({
        userId: (user as any)?.accountId || (user as any)?.$id || "",
        cardNumber: masked,
        cardHolderName: holder,
        expiryDate: `${expMonth}/${expYear}`,
        cardType: brand,
        cardColor: "#1F2937",
      });
      showAlert("success", "Card added successfully.", "Card Added");
      close();
    } catch (e: any) {
      showAlert("error", e?.message || "Failed to add card", "Error");
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.addButton} onPress={open}>
        <Text style={styles.addButtonText}>+ Add Card</Text>
      </TouchableOpacity>
      <AddCardModal visible={visible} onClose={close} onSubmit={handleSubmit} />
    </>
  );
}

import ConfirmDialog from "@/components/modals/ConfirmDialog";

export default function CardsScreen() {
  const { cards, activeCard, setActiveCard, removeCard } = useApp();
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
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
    setPendingDeleteId(id);
    setConfirmVisible(true);
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
                  onDelete={() => handleDelete(card.id)}
                />
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      <ConfirmDialog
        visible={confirmVisible}
        title="Remove card"
        message="Are you sure you want to remove this card? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        tone="danger"
        onCancel={() => { setConfirmVisible(false); setPendingDeleteId(null); }}
        onConfirm={() => {
          if (pendingDeleteId) {
            removeCard(pendingDeleteId);
            showAlert('success', 'Card removed successfully.', 'Card Deleted');
          }
          setConfirmVisible(false);
          setPendingDeleteId(null);
        }}
      />
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
});
