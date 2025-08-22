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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "../../components/BankCard";
import { useApp } from "../../context/AppContext";
import useAuthStore from "@/store/auth.store";

import AddCardModal from "@/components/modals/AddCardModal";
import ConfirmDialog from "@/components/modals/ConfirmDialog";

function AddCardButton() {
  const { showAlert } = useAlert();
  const { addCard } = useApp();
  const { user } = useAuthStore();

  const { getApiBase } = require('../../lib/api');
  const cardsUrl = `${getApiBase()}/v1/cards`;

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

export default function CardsScreen() {
  const { cards, activeCard, setActiveCard, removeCard, isLoadingCards } = useApp();
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const { showAlert } = useAlert();

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setConfirmVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Cards</Text>
          <Text style={styles.subtitle}>Manage your payment cards</Text>
          {cards.length > 0 && <AddCardButton />}
        </View>

          <ScrollView
            style={styles.cardsContainer}
            showsVerticalScrollIndicator={false}
          >
            {isLoadingCards && cards.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <ActivityIndicator size="large" color="#0F766E" />
                <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading cards...</Text>
              </View>
            ) : cards.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>No cards yet</Text>
                <Text style={{ marginTop: 8, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32 }}>
                  Add your first card to start making payments and tracking activity.
                </Text>
                <View style={{ marginTop: 16 }}>
                  <AddCardButton />
                </View>
              </View>
            ) : (
              cards.map((card) => (
                <View key={card.id} style={styles.cardWrapper}>
                  <BankCard
                    card={card}
                    selected={activeCard?.id === card.id}
                    onPress={() => setActiveCard(card)}
                    onDelete={() => handleDelete(card.id)}
                  />
                </View>
              ))
            )}
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
