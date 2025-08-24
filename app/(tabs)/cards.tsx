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
import { useTheme } from "@/context/ThemeContext";

import AddCardModal from "@/components/modals/AddCardModal";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import CustomButton from "@/components/CustomButton";

function AddCardButton() {
  const { showAlert } = useAlert();
  const { addCard } = useApp();
  const { user } = useAuthStore();
  const { colors } = useTheme();

  const { getApiBase } = require('../../lib/api');
  
  let cardsUrl;
  try {
    const apiBase = getApiBase();
    cardsUrl = `${apiBase}/v1/cards`;
    console.log('[AddCard] API Configuration:', { apiBase, cardsUrl });
  } catch (error) {
    console.error('[AddCard] API Configuration Error:', error);
    throw error;
  }

  const [visible, setVisible] = React.useState(false);
  const open = () => setVisible(true);
  const close = () => setVisible(false);

  const handleSubmit = async (payload: { number: string; name: string; exp_month: string; exp_year: string; cvc: string }) => {
    try {
      const { getValidJWT, refreshAppwriteJWT } = require('../../lib/jwt');
      
      // Get a valid JWT token
      let jwt = await getValidJWT();
      const normalized = payload.number.replace(/\s+/g, "");
      const last4In = normalized.slice(-4);
      console.log('[AddCard] Submitting', { hasJwt: Boolean(jwt), last4: last4In });
      
      const makeRequest = async (token: string | undefined) => {
        const requestBody = {
          number: normalized,
          name: payload.name,
          exp_month: Number(payload.exp_month),
          exp_year: Number(payload.exp_year),
          cvc: payload.cvc,
        };
        
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Idempotency-Key": `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
        
        // Log the request details
        console.log('[AddCard] Request Details:', {
          url: cardsUrl,
          method: 'POST',
          headers: {
            ...headers,
            // Mask the authorization token for security
            Authorization: token ? `Bearer ${token.slice(0, 10)}...` : 'none'
          },
          body: {
            ...requestBody,
            // Mask sensitive card data in logs
            number: `${normalized.slice(0, 4)}****${normalized.slice(-4)}`,
            cvc: '***'
          }
        });
        
        return await fetch(cardsUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      };
      
      let res = await makeRequest(jwt);
      
      // If we get a 401, try refreshing the token once
      if (res.status === 401 && jwt) {
        console.log('[AddCard] Got 401, refreshing JWT and retrying...');
        jwt = await refreshAppwriteJWT();
        if (jwt) {
          res = await makeRequest(jwt);
        }
      }
      
      const raw = await res.text();
      let data: any = raw;
      try { data = JSON.parse(raw); } catch {}
      
      // Log the response details
      console.log('[AddCard] Response Details:', {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        rawBody: raw,
        parsedBody: data
      });
      
      if (!res.ok) {
        console.error('[AddCard] Error response', { 
          status: res.status, 
          statusText: res.statusText,
          url: cardsUrl,
          data,
          rawBody: raw
        });
        
        // For 500 errors, provide more detailed context
        if (res.status === 500) {
          console.error('[AddCard] Server Error Details:', {
            'Possible causes': [
              'Server misconfiguration (missing environment variables)',
              'Database connection issues',
              'Invalid card data validation',
              'Appwrite authentication issues'
            ],
            'Check server logs': 'Look for detailed error information in your server logs'
          });
        }
        
        const msg = (data && typeof data === 'object' && (data as any).error === "validation_error")
          ? JSON.stringify((data as any).details)
          : (data && typeof data === 'object' && ((data as any).message || (data as any).error)) || `HTTP ${res.status}: ${res.statusText || 'Server Error'}`;
        throw new Error(msg);
      }
      console.log('[AddCard] Success', { status: res.status, last4: data?.authorization?.last4 || last4In });
      const last4 = data?.authorization?.last4 || last4In || "0000";
      const brand = (data?.authorization?.brand || "visa").toLowerCase();
      const expMonth = String(data?.authorization?.exp_month || payload.exp_month).padStart(2, "0");
      const expYear = String(data?.authorization?.exp_year || payload.exp_year).slice(-2);
      const masked = `•••• •••• •••• ${last4}`;
      const holder = data?.customer?.name || payload.name || "Card Holder";

      // Default starting balance GHS 40,000
      const startingBalance = 40000;

      addCard({
        userId: (user as any)?.accountId || (user as any)?.$id || "",
        cardNumber: masked,
        cardHolderName: holder,
        expiryDate: `${expMonth}/${expYear}`,
        cardType: brand,
        cardColor: "#1F2937",
        balance: startingBalance,
        token: data?.token,
        currency: 'GHS',
      });
      showAlert("success", "Card added successfully.", "Card Added");
      close();
    } catch (e: any) {
      console.error('[AddCard] Exception', { message: e?.message, stack: e?.stack });
      showAlert("error", e?.message || "Failed to add card", "Error");
    }
  };

  return (
    <>
      <CustomButton onPress={open} title="+ Add Card" variant="primary" size="md" />
      <AddCardModal visible={visible} onClose={close} onSubmit={handleSubmit} />
    </>
  );
}

export default function CardsScreen() {
  const { colors } = useTheme();
  const { cards, activeCard, setActiveCard, removeCard, isLoadingCards } = useApp();
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const { showAlert } = useAlert();

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setConfirmVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>My Cards</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Manage your payment cards</Text>
          {cards.length > 0 && <AddCardButton />}
        </View>

        <ScrollView
          style={styles.cardsContainer}
          contentContainerStyle={styles.cardsContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={false}
        >
          {isLoadingCards && cards.length === 0 ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.tintPrimary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading cards...</Text>
            </View>
          ) : cards.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No cards yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Add your first card to start making payments and tracking activity.
              </Text>
              <View style={styles.emptyButton}>
                <AddCardButton />
              </View>
            </View>
          ) : (
            <>
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
            </>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardsContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  cardWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 24,
  },
});
