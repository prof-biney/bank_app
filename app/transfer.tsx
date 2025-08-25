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
import { BankCard } from "@/components/BankCard";
import { useApp } from "@/context/AppContext";
import { useAlert } from "@/context/AlertContext";
import { showAlertWithNotification } from "@/lib/notificationService";
import { Recipient } from "@/types/index";
import { useTheme } from "@/context/ThemeContext";
import { getChipStyles } from "@/theme/variants";
import CustomButton from "@/components/CustomButton";
import { withAlpha } from "@/theme/color-utils";
import Badge from "@/components/ui/Badge";
import { getBadgeVisuals } from "@/theme/badge-utils";

export default function TransferScreen() {
  const { cards, activeCard, setActiveCard, makeTransfer } = useApp();
  const { showAlert } = useAlert();
  const [recipientCardNumber, setRecipientCardNumber] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [step, setStep] = useState<
    "select-card" | "select-recipient" | "enter-amount" | "confirm-transfer"
  >("select-card");

  const handleCardSelect = (card: any) => {
    setActiveCard(card);
    setStep("select-recipient");
  };

  const formatCardNumber = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    // Format as XXXX XXXX XXXX XXXX
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleCardNumberChange = (input: string) => {
    const formatted = formatCardNumber(input);
    // Limit to 19 characters (16 digits + 3 spaces)
    if (formatted.length <= 19) {
      setRecipientCardNumber(formatted);
    }
  };

  const handleRecipientSelect = (cardNumber: string) => {
    setStep("enter-amount");
  };

  const validateCardNumber = (cardNumber: string) => {
    const digits = cardNumber.replace(/\s/g, '');
    return digits.length >= 12; // Minimum 12 digits for a card number
  };

  const findCardByNumber = (cardNumber: string) => {
    const digits = cardNumber.replace(/\s/g, '');
    return cards.find(card => {
      const cardDigits = card.cardNumber.replace(/[^\d]/g, '');
      return cardDigits === digits;
    });
  };

  const handleTransfer = async () => {
    console.log('[TransferScreen] handleTransfer called');
    
    if (!activeCard || !recipientCardNumber || !amount) {
      console.log('[TransferScreen] Missing required fields:', { activeCard: !!activeCard, recipientCardNumber, amount });
      showAlertWithNotification(showAlert, 'error', 'Please complete all required fields.', 'Transfer Error');
      return;
    }

    // Validate card number format
    if (!validateCardNumber(recipientCardNumber)) {
      showAlertWithNotification(showAlert, 'error', 'Please enter a valid card number (minimum 12 digits).', 'Invalid Card Number');
      return;
    }

    const transferAmount = parseFloat(amount);
    
    if (isNaN(transferAmount) || transferAmount <= 0) {
      console.log('[TransferScreen] Invalid amount:', { amount, transferAmount });
      showAlertWithNotification(showAlert, 'error', 'Please enter a valid amount.', 'Transfer Error');
      return;
    }
    
    if (transferAmount > activeCard.balance) {
      console.log('[TransferScreen] Insufficient funds:', { transferAmount, balance: activeCard.balance });
      showAlertWithNotification(showAlert, 'error', 'Insufficient funds for this transfer.', 'Transfer Error');
      return;
    }

    // Check if transferring to the same card
    const sourceCardDigits = activeCard.cardNumber.replace(/[^\d]/g, '');
    const recipientCardDigits = recipientCardNumber.replace(/\s/g, '');
    
    if (sourceCardDigits === recipientCardDigits) {
      showAlertWithNotification(showAlert, 'error', 'Cannot transfer to the same card. Please select a different recipient card.', 'Transfer Error');
      return;
    }

    console.log('[TransferScreen] Starting transfer:', {
      cardId: activeCard.id,
      amount: transferAmount,
      recipientCardNumber
    });
    
    setIsTransferring(true);
    
    try {
      const result = await makeTransfer(
        activeCard.id,
        transferAmount,
        recipientCardNumber,
        `Transfer To: ${recipientCardNumber}`
      );
      
      if (result.success) {
        const recipientCard = findCardByNumber(recipientCardNumber);
        const recipientDisplay = recipientCard ? 
          `${recipientCard.cardHolderName} (${recipientCardNumber})` : 
          recipientName ? `${recipientName} (${recipientCardNumber})` : recipientCardNumber;
        
        showAlertWithNotification(
          showAlert,
          'success', 
          `GHS ${transferAmount.toFixed(2)} has been successfully transferred to ${recipientDisplay}.${result.recipientNewBalance ? ` Recipient balance: GHS ${result.recipientNewBalance.toFixed(2)}.` : ''} Your balance: GHS ${result.newBalance?.toFixed(2) || 'N/A'}`,
          'Transfer Successful'
        );
        
        // Navigate back after a short delay to allow the user to see the alert
        setTimeout(() => {
          router.back();
        }, 2000);
      } else {
        showAlertWithNotification(showAlert, 'error', result.error || 'An error occurred while processing your transfer.', 'Transfer Failed');
      }
    } catch (error) {
      showAlertWithNotification(showAlert, 'error', 'An unexpected error occurred. Please try again.', 'Transfer Failed');
      console.error('Transfer error:', error);
    } finally {
      setIsTransferring(false);
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
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter recipient details</Text>

            <ScrollView style={styles.recipientForm} showsVerticalScrollIndicator={false}>
              {/* Recipient Name Field */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Recipient Name</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="Enter recipient's full name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                />
              </View>

              {/* Card Number Field */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Recipient Card Number</Text>
                <TextInput
                  style={[styles.cardNumberTextInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                  value={recipientCardNumber}
                  onChangeText={handleCardNumberChange}
                  placeholder="XXXX XXXX XXXX XXXX"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
                
                {/* Show matched card holder name if found */}
                {recipientCardNumber && validateCardNumber(recipientCardNumber) && (
                  <View style={styles.cardHolderInfo}>
                    {(() => {
                      const matchedCard = findCardByNumber(recipientCardNumber);
                      if (matchedCard) {
                        return (
                          <Text style={[styles.cardHolderName, { color: colors.positive }]}>
                            ✓ {matchedCard.cardHolderName} (Your Card)
                          </Text>
                        );
                      }
                      return (
                        <Text style={[styles.cardHolderName, { color: colors.textSecondary }]}>
                          External Card
                        </Text>
                      );
                    })()}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.recipientButtonContainer}>
              <CustomButton
                title="Continue"
                variant="primary"
                disabled={!validateCardNumber(recipientCardNumber) || !recipientName.trim()}
                onPress={() => handleRecipientSelect(recipientCardNumber.trim())}
              />
            </View>
          </View>
        )}

        {step === "enter-amount" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter amount</Text>

            <View style={[styles.amountSection, { backgroundColor: colors.card }]}>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={[styles.currencySymbol, { color: colors.textPrimary }]}>GHS</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.textPrimary }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
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
                    <Text style={[styles.quickAmountText, { color: v.textColor }]}>GHS {value}</Text>
                  </Badge>
                );
              })}
            </View>

            <CustomButton
              title="Review Transfer"
              variant="primary"
              disabled={!amount}
              onPress={() => setStep("confirm-transfer")}
            />
          </View>
        )}

        {step === "confirm-transfer" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Confirm Transfer</Text>

            <ScrollView style={styles.confirmationScroll}>
              {/* Transfer Summary */}
              <View style={[styles.summarySection, { backgroundColor: colors.card }]}>
                <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Transfer Details</Text>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>GHS {parseFloat(amount || '0').toFixed(2)}</Text>
                </View>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>From</Text>
                  <View style={styles.summaryCardInfo}>
                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{activeCard?.cardHolderName}</Text>
                    <Text style={[styles.summarySecondary, { color: colors.textSecondary }]}>{activeCard?.cardNumber}</Text>
                  </View>
                </View>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>To</Text>
                  <View style={styles.summaryCardInfo}>
                    {(() => {
                      const recipientCard = findCardByNumber(recipientCardNumber);
                      if (recipientCard) {
                        return (
                          <>
                            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{recipientCard.cardHolderName}</Text>
                            <Text style={[styles.summarySecondary, { color: colors.positive }]}>{recipientCardNumber} (Your Card)</Text>
                          </>
                        );
                      }
                      return (
                        <>
                          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{recipientName || 'External Card'}</Text>
                          <Text style={[styles.summarySecondary, { color: colors.textSecondary }]}>{recipientCardNumber}</Text>
                        </>
                      );
                    })()}
                  </View>
                </View>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Transfer Type</Text>
                  <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                    {findCardByNumber(recipientCardNumber) ? 'Internal Transfer' : 'External Transfer'}
                  </Text>
                </View>
                
                {activeCard && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Remaining Balance</Text>
                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>GHS {(activeCard.balance - parseFloat(amount || '0')).toFixed(2)}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.confirmationButtons}>
              <CustomButton
                title="Edit Transfer"
                variant="secondary"
                onPress={() => setStep("enter-amount")}
                style={styles.editButton}
              />
              <CustomButton
                title={isTransferring ? "Processing..." : "Confirm Transfer"}
                variant="primary"
                disabled={isTransferring}
                onPress={handleTransfer}
                style={styles.confirmButton}
              />
            </View>
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
  cardNumberInput: {
    fontSize: 24,
    fontWeight: "bold",
    minWidth: 200,
    textAlign: "center",
    letterSpacing: 2,
  },
  cardHolderInfo: {
    marginTop: 16,
    alignItems: "center",
  },
  cardHolderName: {
    fontSize: 16,
    fontWeight: "600",
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
  confirmationScroll: {
    flex: 1,
    marginBottom: 20,
  },
  summarySection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  summaryCardInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  summarySecondary: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmationButtons: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
  recipientForm: {
    flex: 1,
    marginBottom: 80,
  },
  inputSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  cardNumberTextInput: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 1,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    textAlign: "center",
  },
  recipientButtonContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
});
