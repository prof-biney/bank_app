import { useAlert } from "@/context/AlertContext";
import { useLoading } from "@/context/LoadingContext";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "@/components/BankCard";
import { useApp } from "@/context/AppContext";
import useAuthStore from "@/store/auth.store";
import { useTheme } from "@/context/ThemeContext";
import { getApiBase } from '@/lib/api';
import { logger } from "@/lib/logger";
import { getValidJWT } from '@/lib/jwt';
import { cardService, createCard, CreateCardData } from '@/lib/appwrite/cardService';

import AddCardModal from "@/components/modals/AddCardModal";
import ConfirmDialog from "@/components/modals/ConfirmDialog";
import CustomButton from "@/components/CustomButton";

function AddCardButton() {
  const { showAlert } = useAlert();
  const { startLoading, updateLoading, stopLoading, isLoading } = useLoading();
  const { cards, setActiveCard, addCard } = useApp();
  const { user } = useAuthStore();

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
  const close = () => {
    setVisible(false);
  };

  const handleSubmit = async (payload: { number: string; name: string; exp_month: string; exp_year: string; cvc: string }) => {
    logger.info('CARDS', '🚀 handleSubmit called');

    // Normalize number and compute last4 once
    const normalized = payload.number.replace(/\s+/g, "");
    const last4 = normalized.slice(-4);

    // Close modal immediately to show background processing
    close();

    const loadingId = startLoading('add_card', `Performing security checks for card ending in ${last4}...`);
    logger.info('CARDS', '⏳ Loading state set to true');

    try {
      logger.info('CARDS', 'Starting card validation and submission', {
        holderName: payload.name,
        last4,
        expiry: `${payload.exp_month}/${payload.exp_year}`,
        hasUser: Boolean(user),
      });

      // Validate user is authenticated
      logger.info('CARDS', '🔍 Checking user authentication', {
        hasUser: Boolean(user),
        userId: (user as any)?.id || (user as any)?.$id || 'missing',
        userIdField: (user as any)?.id ? 'id' : (user as any)?.$id ? '$id' : 'none',
      });

      const userId = (user as any)?.id || (user as any)?.$id;
      if (!userId) {
        logger.error('CARDS', 'User not authenticated');
        showAlert('error', 'Please sign in to add cards.', 'Authentication Required');
        stopLoading(loadingId);
        return;
      }

      logger.info('CARDS', '✅ User authentication validated successfully', { userId });

      // Check for duplicate cards in current state
      logger.info('CARDS', '🔍 Checking for duplicate cards', {
        cardsCount: cards.length,
        targetLast4: last4,
        targetName: payload.name.toLowerCase().trim(),
      });

      const existingCard = cards.find((card) => {
        const cardLast4 = (card.cardNumber || '').replace(/[^\d]/g, '').slice(-4);
        return (
          cardLast4 === last4 && card.cardHolderName.toLowerCase().trim() === payload.name.toLowerCase().trim()
        );
      });

      if (existingCard) {
        logger.warn('CARDS', 'Duplicate card detected', {
          existingCardId: existingCard.id,
          holderName: payload.name,
          last4,
        });
        showAlert('error', `A card ending in ${last4} for ${payload.name} already exists in your account.`, 'Duplicate Card');
        stopLoading(loadingId);
        return;
      }

      logger.info('CARDS', '✅ No duplicate cards found, proceeding to JWT');

      // Update loading message for JWT acquisition
      updateLoading(loadingId, `Authenticating card request for ${last4}...`);

  // Get JWT token for API calls (keeps compatibility with existing server API)
  logger.info('CARDS', '🔑 Attempting to get JWT token');
  // getValidJWT imported at module level
      let jwt: string | undefined;
      try {
        const jwtPromise = getValidJWT();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('JWT request timed out')), 10000)
        );

        jwt = await Promise.race([jwtPromise, timeoutPromise]);
        logger.info('CARDS', '✅ JWT token retrieved successfully');

        if (!jwt) {
          logger.error('CARDS', 'Failed to get valid JWT token');
          showAlert('error', 'Authentication failed. Please sign in again.', 'Authentication Error');
          stopLoading(loadingId);
          return;
        }
      } catch (jwtError) {
        logger.error('CARDS', 'JWT token acquisition failed', jwtError);
        showAlert('error', 'Authentication failed. Please sign in again.', 'Authentication Error');
        stopLoading(loadingId);
        return;
      }

      // Update loading message for duplicate checking
      updateLoading(loadingId, `Verifying card details for ${last4}...`);

      // Optional: Check duplicates on server before creating
      try {
        const checkUrl = `${cardsUrl}/check-duplicate`;
        logger.info('CARDS', 'Checking for duplicate cards on server', { checkUrl });
        const checkRes = await fetch(checkUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ last4, holderName: payload.name.trim() }),
        });

        logger.info('CARDS', '🗞️ Duplicate check response received', {
          status: checkRes.status,
          ok: checkRes.ok,
          statusText: checkRes.statusText,
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          logger.info('CARDS', '✅ Duplicate check response parsed', { checkData });
          if (checkData.exists) {
            logger.warn('CARDS', 'Server confirmed duplicate card exists');
            showAlert('error', `A card ending in ${last4} for ${payload.name} already exists on the server.`, 'Card Already Exists');
            stopLoading(loadingId);
            return;
          }
          logger.info('CARDS', 'No duplicate found on server, proceeding with creation');
        } else {
          logger.warn('CARDS', 'Duplicate check endpoint not available, proceeding with creation', {
            status: checkRes.status,
            statusText: checkRes.statusText,
          });
        }
      } catch (duplicateCheckError) {
        logger.warn('CARDS', 'Duplicate check request failed, proceeding with creation', duplicateCheckError);
      }

      logger.info('CARDS', '🔄 Duplicate check completed, continuing to card creation');

      // Update loading message for card creation
      updateLoading(loadingId, `Creating card record for ${last4}...`);

      // Create card using Appwrite card service
      const cardData: CreateCardData = {
        cardNumber: payload.number, // Full card number for Appwrite service
        cardHolderName: payload.name.trim(),
        expiryDate: `${payload.exp_month.padStart(2, '0')}/${payload.exp_year}`,
        cardType: 'card' as const, // Use 'card' as the default type
        cardColor: '#1D4ED8',
        balance: 0,
        currency: 'GHS',
        token: `card_token_${last4}_${Date.now()}`,
        isActive: true,
      };

      logger.info('CARDS', '💾 Creating card with Appwrite service', {
        last4,
        holderName: payload.name,
        userId: userId,
      });

      // Save to database using Appwrite service
      const createdCard = await createCard(cardData);

      logger.info('CARDS', '✅ Card created successfully in database', {
        cardId: createdCard.id,
        last4,
        holderName: createdCard.cardHolderName,
      });

      // Update loading message for final steps
      updateLoading(loadingId, `Finalizing card setup for ${last4}...`);

      // Add to local state via AppContext helper
      try {
        await addCard({
          userId: createdCard.userId,
          cardNumber: createdCard.cardNumber,
          cardHolderName: createdCard.cardHolderName,
          expiryDate: createdCard.expiryDate,
          cardType: createdCard.cardType,
          balance: createdCard.balance,
          isActive: createdCard.isActive,
          cardColor: createdCard.cardColor,
          currency: createdCard.currency,
          token: createdCard.token,
        });
      } catch (e) {
        // If addCard fails (e.g., duplicate), still set the created card as active
        logger.warn('CARDS', 'addCard failed, falling back to setting active card directly', e);
      }

      const localCard = {
        id: createdCard.id, // Use .id instead of .$id for Appwrite cards
        userId: createdCard.userId,
        cardNumber: createdCard.cardNumber,
        cardHolderName: createdCard.cardHolderName,
        expiryDate: createdCard.expiryDate,
        cardType: createdCard.cardType,
        balance: createdCard.balance,
        isActive: createdCard.isActive,
        cardColor: createdCard.cardColor,
        currency: createdCard.currency,
        token: createdCard.token,
      };

      setActiveCard(localCard);

      logger.info('CARDS', '✅ Card added to local state successfully');
      showAlert('success', `Card ending in ${last4} has been added successfully.`, 'Card Added');
      logger.info('CARDS', '✅ Card creation flow completed successfully');
    } catch (error: any) {
      logger.error('CARDS', '💥 EXCEPTION CAUGHT in handleSubmit', {
        errorType: typeof error,
        errorName: error?.name,
        message: error?.message,
        stack: error?.stack ? error.stack.slice(0, 500) : 'no-stack',
        errorObject: error,
      });

      let errorMessage = 'Failed to add card. Please try again.';
      if (error?.message) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('JWT') || error.message.includes('auth')) {
          errorMessage = 'Authentication failed. Please sign in again.';
        } else {
          errorMessage = error.message;
        }
      }

      showAlert('error', errorMessage, 'Error');
    } finally {
      logger.info('CARDS', '🔄 Setting loading state to false');
      stopLoading(loadingId);
      logger.info('CARDS', '✅ Loading state reset completed');
    }
  };

  return (
    <>
      <CustomButton onPress={open} title="+ Add Card" variant="primary" size="md" />
      <AddCardModal 
        visible={visible} 
        onClose={close} 
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </>
  );
}

export default function CardsScreen() {
  const { colors } = useTheme();
  const { cards, activeCard, setActiveCard, removeCard, isLoadingCards } = useApp();
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const { showAlert } = useAlert();
  const { startLoading, stopLoading } = useLoading();

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
        onConfirm={async () => {
          if (pendingDeleteId) {
            const cardToDelete = cards.find(c => c.id === pendingDeleteId);
            const last4 = cardToDelete?.cardNumber.slice(-4) || 'card';
            const loadingId = startLoading('delete_card', `Removing card ending in ${last4}...`);
            
            try {
              await removeCard(pendingDeleteId);
              showAlert('success', 'Card removed successfully.', 'Card Deleted');
            } catch (error) {
              logger.error('CARDS', 'Failed to delete card:', error);
              showAlert('error', 'Failed to remove card. Please try again.', 'Delete Failed');
            } finally {
              stopLoading(loadingId);
            }
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
