import { logger } from '@/lib/logger';
import { router } from "expo-router";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, CreditCard, Plus } from "lucide-react-native";
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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BankCard } from "@/components/BankCard";
import { useApp } from "@/context/AppContext";
import { useAlert } from "@/context/AlertContext";
import { showAlertWithNotification } from "@/lib/notificationService";
import { useTheme } from "@/context/ThemeContext";
import CustomButton from "@/components/CustomButton";
import Badge from "@/components/ui/Badge";
import { getBadgeVisuals } from "@/theme/badge-utils";
import { MobileNetworkIcon } from "@/components/MobileNetworkIcon";
import { validatePhoneForNetwork, getNetworkInfo, formatPhoneForDisplay, type MobileNetwork } from "@/lib/phoneValidation";

export default function DepositScreen() {
  const { cards, activeCard, setActiveCard, makeDeposit } = useApp();
  const { showAlert } = useAlert();
  const [amount, setAmount] = useState("");
  const [escrowMethod, setEscrowMethod] = useState<'mobile_money' | 'bank_transfer' | 'cash'>('mobile_money');
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<
    "select-card" | "enter-details" | "mobile-money" | "confirm-deposit" | "escrow-instructions" | "processing"
  >("select-card");
  
  // Mobile money specific state
  const [mobileNetwork, setMobileNetwork] = useState<MobileNetwork>('mtn');
  const [mobileNumber, setMobileNumber] = useState("");
  const [reference, setReference] = useState("");
  const [phoneValidation, setPhoneValidation] = useState<{ isValid: boolean; error?: string; } | null>(null);
  
  // Escrow state
  const [depositId, setDepositId] = useState("");
  const [escrowInstructions, setEscrowInstructions] = useState<any>(null);
  const [expiresAt, setExpiresAt] = useState("");

  const handleCardSelect = (card: any) => {
    setActiveCard(card);
    setStep("enter-details");
  };

  const handleDetailsSubmit = () => {
    if (!amount || !activeCard) {
      showAlertWithNotification(showAlert, 'error', 'Please enter an amount and select a card.', 'Deposit Error');
      return;
    }

    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      showAlertWithNotification(showAlert, 'error', 'Please enter a valid amount.', 'Deposit Error');
      return;
    }
    
    if (depositAmount > 10000) {
      showAlertWithNotification(showAlert, 'error', 'Maximum deposit amount is GHS 10,000.', 'Deposit Error');
      return;
    }

    // If mobile money is selected, go to mobile money details screen
    if (escrowMethod === 'mobile_money') {
      setStep("mobile-money");
    } else {
      setStep("confirm-deposit");
    }
  };

  const handleMobileMoneySubmit = () => {
    if (!mobileNumber.trim()) {
      showAlertWithNotification(showAlert, 'error', 'Please enter your mobile money number.', 'Mobile Money Error');
      return;
    }

    // Validate phone number for selected network
    const validation = validatePhoneForNetwork(mobileNumber.trim(), mobileNetwork);
    if (!validation.isValid) {
      showAlertWithNotification(showAlert, 'error', validation.error || 'Invalid phone number', 'Mobile Money Error');
      return;
    }

    // Update the phone number to the formatted version
    if (validation.formattedNumber) {
      setMobileNumber(validation.formattedNumber);
    }

    setStep("confirm-deposit");
  };

  // Real-time phone validation
  const handlePhoneNumberChange = (text: string) => {
    setMobileNumber(text);
    
    if (text.trim()) {
      const validation = validatePhoneForNetwork(text.trim(), mobileNetwork);
      setPhoneValidation(validation);
    } else {
      setPhoneValidation(null);
    }
  };

  // Update validation when network changes
  const handleNetworkChange = (network: MobileNetwork) => {
    setMobileNetwork(network);
    
    // Re-validate current number with new network
    if (mobileNumber.trim()) {
      const validation = validatePhoneForNetwork(mobileNumber.trim(), network);
      setPhoneValidation(validation);
    }
  };

  const handleCreateDeposit = async () => {
    if (!activeCard || !amount) {
      showAlertWithNotification(showAlert, 'error', 'Please complete all required fields.', 'Deposit Error');
      return;
    }

    const depositAmount = parseFloat(amount);
    setIsProcessing(true);
    
    try {
      const result = await makeDeposit({
        cardId: activeCard.id,
        amount: depositAmount,
        currency: 'GHS',
        escrowMethod,
        description: description || `${escrowMethod.replace('_', ' ')} deposit`,
        ...(escrowMethod === 'mobile_money' && {
          mobileNetwork,
          mobileNumber,
          reference: reference || `DEP-${Date.now().toString().slice(-8)}`
        })
      });
      
      if (result.success && result.data) {
        setDepositId(result.data.id);
        setEscrowInstructions(result.data.instructions);
        setExpiresAt(result.data.expiresAt);
        setStep("escrow-instructions");
        
        showAlertWithNotification(
          showAlert,
          'info', 
          `Deposit request created successfully. Please follow the instructions to complete your payment.`,
          'Deposit Request Created'
        );
      } else {
        showAlertWithNotification(showAlert, 'error', result.error || 'Failed to create deposit request.', 'Deposit Failed');
      }
    } catch (error) {
      showAlertWithNotification(showAlert, 'error', 'An unexpected error occurred. Please try again.', 'Deposit Failed');
      logger.error('SCREEN', 'Deposit error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!depositId) {
      showAlertWithNotification(showAlert, 'error', 'No deposit request found.', 'Deposit Error');
      return;
    }

    setStep("processing");
    setIsProcessing(true);
    
    try {
      const result = await makeDeposit({
        depositId,
        action: 'confirm'
      });
      
      if (result.success && result.data) {
        showAlertWithNotification(
          showAlert,
          'success', 
          `GHS ${result.data.amount.toFixed(2)} has been successfully deposited to your card. New balance: GHS ${result.data.newBalance.toFixed(2)}.`,
          'Deposit Completed'
        );
        
        // Navigate back after a short delay
        setTimeout(() => {
          router.back();
        }, 2000);
      } else {
        showAlertWithNotification(showAlert, 'error', result.error || 'Deposit confirmation failed.', 'Deposit Failed');
        setStep("escrow-instructions"); // Go back to instructions
      }
    } catch (error) {
      showAlertWithNotification(showAlert, 'error', 'An unexpected error occurred. Please try again.', 'Deposit Failed');
      logger.error('SCREEN', 'Deposit confirmation error:', error);
      setStep("escrow-instructions"); // Go back to instructions
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    if (!expiresAt) return '';
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
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
          <Text style={[styles.title, { color: colors.textPrimary }]}>Deposit</Text>
          <View style={styles.placeholder} />
        </View>

        {step === "select-card" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose card to deposit into</Text>
            
            {cards.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={[styles.emptyStateIcon, { backgroundColor: colors.card }]}>
                  <CreditCard color={colors.textSecondary} size={48} style={{ opacity: 0.6 }} />
                </View>
                <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No cards available</Text>
                <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                  You need at least one card to make a deposit. Add a card to get started.
                </Text>
                <CustomButton
                  title="Add a Card"
                  variant="primary"
                  leftIcon={<Plus color="#fff" size={20} />}
                  onPress={() => router.push('/(tabs)/cards')}
                  style={styles.emptyStateCTA}
                />
              </View>
            ) : (
              <>
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
                  onPress={() => setStep("enter-details")}
                />
              </>
            )}
          </View>
        )}

        {step === "enter-details" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter deposit details</Text>

            <ScrollView style={styles.detailsForm} showsVerticalScrollIndicator={false}>
              {/* Amount Section */}
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

              {/* Quick Amounts */}
              <View style={styles.quickAmounts}>
                {["10", "20", "50", "100", "200", "500", "1000", "2000"].map((value) => {
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

              {/* Payment Method */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                <View style={styles.methodButtons}>
                  {[
                    { key: 'mobile_money' as const, label: 'Mobile Money', desc: '2-5 minutes' },
                    // { key: 'bank_transfer' as const, label: 'Bank Transfer', desc: '1-2 business days' },
                    // { key: 'cash' as const, label: 'Cash Deposit', desc: 'Immediate' }
                  ].map((method) => {
                    const isSelected = escrowMethod === method.key;
                    const v = getBadgeVisuals(colors, { tone: 'accent', selected: isSelected, size: 'lg' });
                    return (
                      <TouchableOpacity
                        key={method.key}
                        style={[
                          styles.methodButton,
                          { 
                            backgroundColor: v.backgroundColor,
                            borderColor: v.borderColor,
                            borderWidth: 1
                          }
                        ]}
                        onPress={() => setEscrowMethod(method.key)}
                      >
                        <Text style={[styles.methodLabel, { color: v.textColor }]}>{method.label}</Text>
                        <Text style={[styles.methodDesc, { color: v.textColor, opacity: 0.7 }]}>{method.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Optional Description */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g., Top up wallet"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </ScrollView>

            <View style={styles.detailsButtonContainer}>
              <CustomButton
                title="Continue"
                variant="primary"
                disabled={!amount}
                onPress={handleDetailsSubmit}
              />
            </View>
          </View>
        )}

        {step === "mobile-money" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Mobile Money Details</Text>

            <ScrollView style={styles.detailsForm} showsVerticalScrollIndicator={false}>
              {/* Network Selection */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Select Network</Text>
                <View style={styles.networkButtons}>
                  {(['mtn', 'telecel', 'airteltigo'] as const).map((networkKey) => {
                    const networkInfo = getNetworkInfo(networkKey);
                    const isSelected = mobileNetwork === networkKey;
                    return (
                      <TouchableOpacity
                        key={networkKey}
                        style={[
                          styles.networkButton,
                          { 
                            backgroundColor: isSelected ? networkInfo.color : colors.backgroundSecondary,
                            borderColor: isSelected ? networkInfo.color : colors.border,
                            borderWidth: 2
                          }
                        ]}
                        onPress={() => handleNetworkChange(networkKey)}
                      >
                        <MobileNetworkIcon network={networkKey} size={40} />
                        <Text style={[
                          styles.networkLabel, 
                          { color: isSelected ? (networkKey === 'mtn' ? colors.textPrimary : colors.card) : colors.textPrimary }
                        ]}>
                          {networkInfo.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Mobile Number */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Mobile Money Number</Text>
                
                {/* Network specific examples */}
                <Text style={[styles.networkHint, { color: colors.textSecondary }]}>
                  {getNetworkInfo(mobileNetwork).name} numbers: {getNetworkInfo(mobileNetwork).examples.join(', ')}
                </Text>
                
                <TextInput
                  style={[
                    styles.textInput, 
                    { 
                      color: colors.textPrimary, 
                      borderBottomColor: phoneValidation?.isValid === false ? colors.negative : 
                                          phoneValidation?.isValid === true ? colors.positive : colors.border
                    }
                  ]}
                  value={mobileNumber}
                  onChangeText={handlePhoneNumberChange}
                  placeholder={getNetworkInfo(mobileNetwork).examples[0]}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
                
                {/* Validation feedback */}
                {phoneValidation && (
                  <View style={styles.validationFeedback}>
                    {phoneValidation.isValid ? (
                      <Text style={[styles.validationText, { color: colors.positive }]}>✓ Valid {getNetworkInfo(mobileNetwork).name} number</Text>
                    ) : (
                      <Text style={[styles.validationText, { color: colors.negative }]}>✗ {phoneValidation.error}</Text>
                    )}
                  </View>
                )}
              </View>

              {/* Reference (Optional) */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Reference (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                  value={reference}
                  onChangeText={setReference}
                  placeholder="e.g., Top up wallet"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </ScrollView>

            <View style={styles.detailsButtonContainer}>
              <CustomButton
                title="Continue"
                variant="primary"
                disabled={!mobileNumber.trim() || phoneValidation?.isValid === false}
                onPress={handleMobileMoneySubmit}
              />
            </View>
          </View>
        )}

        {step === "confirm-deposit" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Confirm Deposit</Text>

            <ScrollView style={styles.confirmationScroll}>
              <View style={[styles.summarySection, { backgroundColor: colors.card }]}>
                <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Deposit Details</Text>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>GHS {parseFloat(amount || '0').toFixed(2)}</Text>
                </View>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>To Card</Text>
                  <View style={styles.summaryCardInfo}>
                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{activeCard?.cardHolderName}</Text>
                    <Text style={[styles.summarySecondary, { color: colors.textSecondary }]}>{activeCard?.cardNumber}</Text>
                  </View>
                </View>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                  <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                    {escrowMethod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
                
                {escrowMethod === 'mobile_money' && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Network</Text>
                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                      {getNetworkInfo(mobileNetwork).name}
                    </Text>
                  </View>
                )}
                
                {escrowMethod === 'mobile_money' && mobileNumber && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                      {formatPhoneForDisplay(mobileNumber)}
                    </Text>
                  </View>
                )}
                
                {activeCard && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>New Balance</Text>
                    <Text style={[styles.summaryValue, { color: colors.positive }]}>
                      GHS {(activeCard.balance + parseFloat(amount || '0')).toFixed(2)}
                    </Text>
                  </View>
                )}
                
                {description && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Description</Text>
                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{description}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.confirmationButtons}>
              <CustomButton
                title="Edit Details"
                variant="secondary"
                onPress={() => setStep("enter-details")}
                style={styles.editButton}
              />
              <CustomButton
                title={isProcessing ? "Creating..." : "Create Deposit"}
                variant="primary"
                disabled={isProcessing}
                onPress={handleCreateDeposit}
                style={styles.confirmButton}
              />
            </View>
          </View>
        )}

        {step === "escrow-instructions" && (
          <View style={styles.content}>
            <View style={styles.instructionsHeader}>
              <Clock color={colors.warning} size={24} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                Payment Instructions
              </Text>
              <Text style={[styles.expiryText, { color: colors.warning }]}>
                {formatTimeRemaining(expiresAt)}
              </Text>
            </View>

            <ScrollView style={styles.instructionsScroll}>
              {escrowInstructions && (
                <View style={[styles.instructionsSection, { backgroundColor: colors.card }]}>
                  <Text style={[styles.instructionsTitle, { color: colors.textPrimary }]}>
                    {escrowInstructions.method}
                  </Text>
                  
                  <View style={styles.stepsContainer}>
                    {escrowInstructions.steps.map((step: string, index: number) => (
                      <View key={index} style={styles.stepItem}>
                        <View style={[styles.stepNumber, { backgroundColor: colors.tintPrimary }]}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={[styles.stepText, { color: colors.textPrimary }]}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {escrowInstructions.reference && (
                    <View style={[styles.referenceBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                      <Text style={[styles.referenceLabel, { color: colors.textSecondary }]}>Reference Code:</Text>
                      <Text style={[styles.referenceCode, { color: colors.textPrimary }]}>{escrowInstructions.reference}</Text>
                    </View>
                  )}

                  <Text style={[styles.estimatedTime, { color: colors.textSecondary }]}>
                    Estimated processing time: {escrowInstructions.estimatedTime}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.instructionsButtons}>
              <CustomButton
                title="Cancel Deposit"
                variant="secondary"
                onPress={() => {
                  Alert.alert(
                    'Cancel Deposit',
                    'Are you sure you want to cancel this deposit request?',
                    [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes', onPress: () => router.back() }
                    ]
                  );
                }}
                style={styles.cancelButton}
              />
              <CustomButton
                title="I've Made Payment"
                variant="primary"
                onPress={handleConfirmPayment}
                style={styles.confirmPaymentButton}
              />
            </View>
          </View>
        )}

        {step === "processing" && (
          <View style={styles.content}>
            <View style={styles.processingContainer}>
              <View style={styles.processingIcon}>
                {isProcessing ? (
                  <Clock color={colors.warning} size={48} />
                ) : (
                  <CheckCircle color={colors.positive} size={48} />
                )}
              </View>
              
              <Text style={[styles.processingTitle, { color: colors.textPrimary }]}>
                {isProcessing ? "Processing Your Deposit..." : "Deposit Completed!"}
              </Text>
              
              <Text style={[styles.processingText, { color: colors.textSecondary }]}>
                {isProcessing 
                  ? "Please wait while we verify your payment and update your balance."
                  : "Your deposit has been successfully processed and your balance has been updated."
                }
              </Text>
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
  detailsForm: {
    flex: 1,
    marginBottom: 80,
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
  quickAmounts: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
    justifyContent: "space-between",
  },
  quickAmountButton: {
    width: "22%",
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: "600",
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
  methodButtons: {
    gap: 12,
  },
  methodButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  methodDesc: {
    fontSize: 14,
  },
  detailsButtonContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
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
  instructionsHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  expiryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  instructionsScroll: {
    flex: 1,
    marginBottom: 20,
  },
  instructionsSection: {
    borderRadius: 16,
    padding: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  stepsContainer: {
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  referenceBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: "center",
  },
  referenceLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  referenceCode: {
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  estimatedTime: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
  },
  instructionsButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  confirmPaymentButton: {
    flex: 2,
  },
  processingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  processingIcon: {
    marginBottom: 24,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  processingText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  networkButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  networkButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  networkLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  networkHint: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  validationFeedback: {
    marginTop: 8,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyStateCTA: {
    minWidth: 140,
  },
});
