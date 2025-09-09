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
import { BankCard } from "@/components/BankCard";
import { useApp } from "@/context/AppContext";
import useAuthStore from "@/store/auth.store";
import { useTheme } from "@/context/ThemeContext";
import { logger } from "@/lib/logger";

import AddCardModal from "@/components/modals/AddCardModal";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import CustomButton from "@/components/CustomButton";

function AddCardButton() {
  const { showAlert } = useAlert();
  const { addCard, cards } = useApp();
  const { user } = useAuthStore();
  const { colors } = useTheme();

  const { getApiBase } = require('@/lib/api');
  
  let cardsUrl;
  try {
    const apiBase = getApiBase();
    cardsUrl = `${apiBase}/v1/cards`;
        logger.info('CARDS', 'API Configuration:', { apiBase, cardsUrl });
  } catch (error) {
      logger.error('CARDS', 'API Configuration Error:', error);
    throw error;
  }

  const [visible, setVisible] = React.useState(false);
  const open = () => setVisible(true);
  const close = () => setVisible(false);

  const handleSubmit = async (payload: { number: string; name: string; exp_month: string; exp_year: string; cvc: string }) => {
    try {
      const normalized = payload.number.replace(/\s+/g, "");
      const last4 = normalized.slice(-4);
      
      logger.info('CARDS', 'Starting card validation and submission', { 
        holderName: payload.name, 
        last4,
        expiry: `${payload.exp_month}/${payload.exp_year}`
      });
      
      // Check for duplicate cards in current state
      const existingCard = cards.find(card => {
        const cardLast4 = card.cardNumber.replace(/[^\d]/g, '').slice(-4);
        return cardLast4 === last4 && 
               card.cardHolderName.toLowerCase().trim() === payload.name.toLowerCase().trim();
      });
      
      if (existingCard) {
        logger.warn('CARDS', 'Duplicate card detected', {
          existingCardId: existingCard.id,
          holderName: payload.name,
          last4
        });
        showAlert(
          "error", 
          `A card ending in ${last4} for ${payload.name} already exists in your account.`,
          "Duplicate Card"
        );
        return;
      }
      
      // Additional server-side duplicate check via API
      const { getValidJWT } = require('@/lib/jwt');
      const jwt = await getValidJWT();
      
      // Check duplicates on server before creating
      try {
        const checkUrl = `${cardsUrl}/check-duplicate`;
        const checkRes = await fetch(checkUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
          },
          body: JSON.stringify({
            last4,
            holderName: payload.name.trim()
          })
        });
        
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists) {
            logger.warn('CARDS', 'Server confirmed duplicate card exists');
            showAlert(
              "error", 
              `A card ending in ${last4} for ${payload.name} already exists in your account.`,
              "Card Already Exists"
            );
            return;
          }
        } else {
          logger.warn('CARDS', 'Duplicate check failed, proceeding with creation');
        }
      } catch (duplicateCheckError) {
        logger.warn('CARDS', 'Duplicate check request failed, proceeding', duplicateCheckError);
      }
      
      // Create card data object for AppContext
      const cardData = {
        userId: user?.id || '',
        cardNumber: `****-****-****-${last4}`, // Masked for security
        cardHolderName: payload.name.trim(),
        expiryDate: `${payload.exp_month.padStart(2, '0')}/${payload.exp_year}`,
        cardType: 'credit' as const,
        balance: 0,
        isActive: true,
        cardColor: '#1D4ED8',
        currency: 'GHS',
        token: undefined // Will be set by server
      };
      
      logger.info('CARDS', 'Creating card via server API', { last4, holderName: payload.name });
      
      // Make server API call first
      const requestBody = {
        number: normalized,
        name: payload.name.trim(),
        exp_month: Number(payload.exp_month),
        exp_year: Number(payload.exp_year),
        cvc: payload.cvc,
      };
      
      const headers = {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        "Idempotency-Key": `card-${last4}-${payload.name.replace(/\s+/g, '-')}-${Date.now()}`,
      };
      
      const res = await fetch(cardsUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
      
      const rawResponse = await res.text();
      let serverData: any = rawResponse;
      try { 
        serverData = JSON.parse(rawResponse); 
      } catch {
        logger.error('CARDS', 'Failed to parse server response', { rawResponse });
      }
      
      if (!res.ok) {
        logger.error('CARDS', 'Server card creation failed', { 
          status: res.status, 
          response: serverData 
        });
        
        // Handle specific error cases
        if (res.status === 409) {
          showAlert("error", "This card already exists in your account.", "Duplicate Card");
          return;
        }
        
        const errorMsg = (serverData && typeof serverData === 'object' && serverData.error) || 
                        `Server error: ${res.status} ${res.statusText}`;
        throw new Error(errorMsg);
      }
      
      logger.info('CARDS', 'Server card creation successful', { 
        cardId: serverData.id,
        last4: serverData.authorization?.last4 
      });
      
      // Update card data with server response
      const finalCardData = {
        ...cardData,
        token: serverData.token,
        cardNumber: `****-****-****-${serverData.authorization?.last4 || last4}`
      };
      
      // Use AppContext addCard to handle local state and Appwrite persistence
      await addCard(finalCardData);
      
      logger.info('CARDS', 'Card successfully added to local state and Appwrite');
      
      // Show success alert and close modal
      showAlert("success", `Card ending in ${last4} has been added successfully.`, "Card Added");
      close();
      
    } catch (error: any) {
      logger.error('CARDS', 'Card creation failed', { 
        message: error?.message, 
        stack: error?.stack 
      });
      
      const errorMessage = error?.message || "Failed to add card. Please try again.";
      showAlert("error", errorMessage, "Error");
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
