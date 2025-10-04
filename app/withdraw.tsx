/**
 * Enhanced Withdrawal Screen
 * 
 * Provides comprehensive withdrawal functionality with multiple withdrawal methods
 * tailored for the Ghanaian financial ecosystem including mobile money, bank transfers,
 * and cash pickup options. Enhanced with database integration, success modals, and proper error handling.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Plus } from 'lucide-react-native';
import { router } from 'expo-router';

import { useApp } from '@/context/AppContext';
import useAuthStore from '@/store/auth.store';
import type { WithdrawalMethod, GhanaianMobileNetwork, GhanaianBank, CashPickupProvider } from '@/lib/appwrite/withdrawalService';
import { useAlert } from '@/context/AlertContext';
import LoadingAnimation from '@/components/LoadingAnimation';
import { useLoading, LOADING_CONFIGS } from '@/hooks/useLoading';
import { useBiometricToast } from '@/context/BiometricToastContext';
import WithdrawalSuccessModal, { WithdrawalSuccessData } from '@/components/WithdrawalSuccessModal';
import { useTheme } from '@/context/ThemeContext';
import CustomButton from '@/components/CustomButton';
import Badge from '@/components/ui/Badge';
import { getBadgeVisuals } from '@/theme/badge-utils';
import { BankCard } from '@/components/BankCard';
import { logger } from '@/lib/logger';

type TabType = 'mobile_money' | 'bank_transfer' | 'cash_pickup';

// Mobile Money Providers in Ghana
const MOBILE_MONEY_PROVIDERS = [
  { id: 'mtn' as GhanaianMobileNetwork, name: 'MTN Mobile Money', icon: '📱', color: '#FFD700' },
  { id: 'telecel' as GhanaianMobileNetwork, name: 'Telecel Cash', icon: '📱', color: '#E60026' },
  { id: 'airteltigo' as GhanaianMobileNetwork, name: 'AirtelTigo Money', icon: '📱', color: '#FF6B35' },
];

// Major Ghanaian Banks
const GHANA_BANKS = [
  { id: 'gcb' as GhanaianBank, name: 'GCB Bank Limited', shortName: 'GCB' },
  { id: 'ecobank' as GhanaianBank, name: 'Ecobank Ghana', shortName: 'Ecobank' },
  { id: 'stanbic' as GhanaianBank, name: 'Stanbic Bank Ghana', shortName: 'Stanbic' },
  { id: 'fidelity' as GhanaianBank, name: 'Fidelity Bank Ghana', shortName: 'Fidelity' },
  { id: 'cal_bank' as GhanaianBank, name: 'CAL Bank', shortName: 'CAL Bank' },
  { id: 'standard_chartered' as GhanaianBank, name: 'Standard Chartered Bank Ghana', shortName: 'Standard Chartered' },
  { id: 'absa' as GhanaianBank, name: 'Absa Bank Ghana', shortName: 'Absa' },
  { id: 'gt_bank' as GhanaianBank, name: 'Guaranty Trust Bank Ghana', shortName: 'GTBank' },
  { id: 'uba' as GhanaianBank, name: 'United Bank for Africa', shortName: 'UBA' },
];

// Cash Pickup Providers
const CASH_PICKUP_PROVIDERS = [
  { id: 'western_union' as CashPickupProvider, name: 'Western Union', icon: '💰' },
  { id: 'moneygram' as CashPickupProvider, name: 'MoneyGram', icon: '💳' },
  { id: 'super_express' as CashPickupProvider, name: 'Super Express Services', icon: '💵' },
];

export default function WithdrawScreen() {
  const { cards, activeCard, setActiveCard, makeWithdrawal } = useApp();
  const { user } = useAuthStore();
  const { showAlert } = useAlert();
  const { showSuccess, showError } = useBiometricToast();
  const { loading, withLoading } = useLoading();
  const { colors } = useTheme();
  
  // Multi-step state
  const [step, setStep] = useState<'select-card' | 'select-method' | 'enter-details' | 'confirm-withdrawal'>('select-card');
  
  // Form states
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('mobile_money');
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [withdrawalSuccessData, setWithdrawalSuccessData] = useState<WithdrawalSuccessData | null>(null);

  // Mobile Money States
  const [selectedProvider, setSelectedProvider] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Bank Transfer States
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // Cash Pickup States
  const [selectedPickupProvider, setSelectedPickupProvider] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const handleWithdrawal = async () => {
    logger.info('SCREEN', '[WithdrawScreen] Enhanced withdrawal called');
    
    if (!validateForm()) return;

    const withdrawalAmount = parseFloat(amount);
    
    if (!activeCard) {
      showError('Withdrawal Error', 'Please select a card to withdraw from.');
      return;
    }

    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      showError('Withdrawal Error', 'Please enter a valid amount.');
      return;
    }

    if (activeCard.balance < withdrawalAmount) {
      showError('Insufficient Funds', 'You do not have enough balance for this withdrawal.');
      return;
    }

    // Prepare withdrawal details based on selected method
    let withdrawalDetails: any = {};
    let displayName = '';
    
    if (activeTab === 'mobile_money') {
      withdrawalDetails = {
        mobileNetwork: selectedProvider as GhanaianMobileNetwork,
        mobileNumber: mobileNumber,
        recipientName: recipientName || user?.name || 'Account Holder'
      };
      displayName = `${selectedProvider.toUpperCase()} (${mobileNumber})`;
    } else if (activeTab === 'bank_transfer') {
      withdrawalDetails = {
        bankName: selectedBank as GhanaianBank,
        accountNumber: accountNumber,
        accountName: accountName
      };
      displayName = `${accountName} (${accountNumber})`;
    } else {
      withdrawalDetails = {
        pickupProvider: selectedPickupProvider as CashPickupProvider,
        receiverName: recipientName,
        receiverPhone: recipientPhone,
        receiverIdType: 'ghana_card', // Default ID type
        receiverIdNumber: 'GHA-XXXXXXXX-X' // Placeholder
      };
      displayName = `${recipientName} (${selectedPickupProvider})`;
    }

    logger.info('SCREEN', '[WithdrawScreen] Starting enhanced withdrawal via AppContext:', {
      cardId: activeCard.id,
      amount: withdrawalAmount,
      method: activeTab,
      displayName
    });
    
    try {
      logger.info('SCREEN', '[WithdrawScreen] About to call makeWithdrawal with details:', {
        cardId: activeCard.id,
        amount: withdrawalAmount,
        method: activeTab,
        details: withdrawalDetails
      });
      
      const result = await withLoading(
        async () => {
          const withdrawalResult = await makeWithdrawal(
            activeCard.id,
            withdrawalAmount,
            activeTab,
            withdrawalDetails,
            `Withdrawal via ${getMethodDisplayName()}`
          );
          
          logger.info('SCREEN', '[WithdrawScreen] makeWithdrawal result:', withdrawalResult);
          return withdrawalResult;
        },
        {
          ...LOADING_CONFIGS.PROCESS_TRANSACTION,
          message: `Processing withdrawal of GHS ${withdrawalAmount.toFixed(2)}...`,
          subtitle: `Via ${getMethodDisplayName()}`
        }
      );
      
      logger.info('SCREEN', '[WithdrawScreen] Final result from withLoading:', result);
      
      if (result?.success) {
        // Prepare success modal data
        const successData: WithdrawalSuccessData = {
          amount: withdrawalAmount,
          currency: 'GHS',
          fees: 0, // Will be calculated by service
          netAmount: withdrawalAmount, // Will be updated by service
          withdrawalMethod: activeTab,
          sourceNewBalance: result.newBalance || activeCard.balance - withdrawalAmount,
          reference: result.reference || `WD-${Date.now().toString().slice(-8)}`,
          timestamp: new Date().toISOString(),
          transactionId: result.transactionId || `TXN-${Date.now()}`,
          estimatedCompletionTime: getEstimatedCompletionTime(activeTab),
          instructions: result.instructions,
          
          // Method-specific data
          ...withdrawalDetails
        };
        
        setWithdrawalSuccessData(successData);
        setShowSuccessModal(true);
        
        // Show success toast notification
        showSuccess(
          'Withdrawal Successful',
          `GHS ${withdrawalAmount.toFixed(2)} withdrawn successfully via ${getMethodDisplayName()}`
        );
        
        logger.info('SCREEN', '[WithdrawScreen] Enhanced withdrawal completed successfully', {
          transactionId: result.transactionId,
          newBalance: result.newBalance,
          reference: result.reference
        });
        
      } else {
        logger.error('SCREEN', '[WithdrawScreen] Withdrawal failed with result:', result);
        showError(
          'Withdrawal Failed',
          result?.error || 'An error occurred while processing your withdrawal.'
        );
      }
    } catch (error) {
      logger.error('SCREEN', '[WithdrawScreen] Withdrawal exception:', error);
      
      // Show specific error message if available
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      
      showError(
        'Withdrawal Failed',
        errorMessage
      );
    }
  };

  const getEstimatedCompletionTime = (method: TabType): string => {
    switch (method) {
      case 'mobile_money':
        return '2-15 minutes';
      case 'bank_transfer':
        return '1-2 business days';
      case 'cash_pickup':
        return '15-30 minutes';
      default:
        return '1-2 hours';
    }
  };

  const handleCardSelect = (card: any) => {
    setActiveCard(card);
    setStep('select-method');
  };

  const resetForm = () => {
    setAmount('');
    setSelectedProvider('');
    setMobileNumber('');
    setSelectedBank('');
    setAccountNumber('');
    setAccountName('');
    setSelectedPickupProvider('');
    setRecipientName('');
    setRecipientPhone('');
  };

  const handleCancel = () => {
    resetForm();
    router.push('/(tabs)');
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setWithdrawalSuccessData(null);
    resetForm();
    setStep('select-card');
    // Navigate to home after closing success modal
    setTimeout(() => {
      router.push('/(tabs)');
    }, 300);
  };

  const handleGoHome = () => {
    // Close modal and navigate to home
    setShowSuccessModal(false);
    setWithdrawalSuccessData(null);
    resetForm();
    router.push('/(tabs)');
  };

  const validateForm = (): boolean => {
    if (!activeCard) {
      showError('Validation Error', 'Please select a card');
      return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showError('Validation Error', 'Please enter a valid amount');
      return false;
    }

    const withdrawalAmount = parseFloat(amount);
    
    if (activeCard.balance < withdrawalAmount) {
      showError('Insufficient Balance', 'You do not have enough balance for this withdrawal');
      return false;
    }

    if (activeTab === 'mobile_money') {
      if (!selectedProvider) {
        showError('Validation Error', 'Please select a mobile money provider');
        return false;
      }
      if (!recipientName.trim()) {
        showError('Validation Error', 'Please enter recipient name');
        return false;
      }
      if (!mobileNumber || mobileNumber.length < 10) {
        showError('Validation Error', 'Please enter a valid mobile number');
        return false;
      }
    } else if (activeTab === 'bank_transfer') {
      if (!selectedBank) {
        showError('Validation Error', 'Please select a bank');
        return false;
      }
      if (!accountNumber || accountNumber.length < 10) {
        showError('Validation Error', 'Please enter a valid account number');
        return false;
      }
      if (!accountName.trim()) {
        showError('Validation Error', 'Please enter account holder name');
        return false;
      }
    } else {
      if (!selectedPickupProvider) {
        showError('Validation Error', 'Please select a pickup provider');
        return false;
      }
      if (!recipientName.trim()) {
        showError('Validation Error', 'Please enter recipient name');
        return false;
      }
      if (!recipientPhone || recipientPhone.length < 10) {
        showError('Validation Error', 'Please enter a valid recipient phone number');
        return false;
      }
    }

    return true;
  };

  const getMethodDisplayName = (): string => {
    if (activeTab === 'mobile_money') {
      const provider = MOBILE_MONEY_PROVIDERS.find(p => p.id === selectedProvider);
      return provider?.name || 'Mobile Money';
    } else if (activeTab === 'bank_transfer') {
      const bank = GHANA_BANKS.find(b => b.id === selectedBank);
      return bank?.shortName || 'Bank Transfer';
    } else {
      const provider = CASH_PICKUP_PROVIDERS.find(p => p.id === selectedPickupProvider);
      return provider?.name || 'Cash Pickup';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mobile_money':
        return (
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Select Mobile Money Provider</Text>
            {MOBILE_MONEY_PROVIDERS.map((provider) => {
              const isSelected = selectedProvider === provider.id;
              return (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.enhancedOptionButton,
                    { 
                      backgroundColor: isSelected ? colors.primary : colors.card, 
                      borderColor: isSelected ? colors.primary : colors.border 
                    },
                    isSelected && styles.enhancedOptionButtonSelected
                  ]}
                  onPress={() => setSelectedProvider(provider.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionButtonContent}>
                    <Text style={[
                      styles.enhancedProviderIcon, 
                      { color: isSelected ? '#ffffff' : colors.textSecondary }
                    ]}>
                      {provider.icon}
                    </Text>
                    <View style={styles.providerTextContainer}>
                      <Text style={[
                        styles.enhancedOptionText,
                        { color: isSelected ? '#ffffff' : colors.textPrimary }
                      ]}>
                        {provider.name}
                      </Text>
                      <Text style={[
                        styles.providerSubtext,
                        { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
                      ]}>
                        {provider.id === 'mtn' && 'MTN Mobile Money'}
                        {provider.id === 'telecel' && 'Telecel Cash'}
                        {provider.id === 'airteltigo' && 'AirtelTigo Money'}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Text style={styles.enhancedSelectedIndicator}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Recipient Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Enter recipient's full name"
              placeholderTextColor={colors.textSecondary}
              value={recipientName}
              onChangeText={setRecipientName}
              autoCapitalize="words"
            />
            
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Mobile Number</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g., 024XXXXXXX"
              placeholderTextColor={colors.textSecondary}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
              maxLength={15}
            />
            {selectedProvider && (
              <Text style={[styles.networkHint, { color: colors.textSecondary }]}>
                {selectedProvider === 'mtn' && 'MTN numbers start with: 024, 025, 053, 054, 055, 059'}
                {selectedProvider === 'telecel' && 'Telecel numbers start with: 020, 027, 028, 057'}
                {selectedProvider === 'airteltigo' && 'AirtelTigo numbers start with: 026, 056, 078'}
              </Text>
            )}
          </View>
        );

      case 'bank_transfer':
        return (
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Select Bank</Text>
            <View style={styles.bankSelectionContainer}>
              <Text style={[styles.bankSelectionHint, { color: colors.textSecondary }]}>Scroll to see all banks</Text>
              <ScrollView 
                style={[styles.bankList, { backgroundColor: colors.card, borderColor: colors.border }]} 
                showsVerticalScrollIndicator={true}
                indicatorStyle="default"
                bounces={true}
                contentContainerStyle={styles.bankListContent}
              >
                {GHANA_BANKS.map((bank, index) => {
                  const isSelected = selectedBank === bank.id;
                  return (
                    <TouchableOpacity
                      key={bank.id}
                      style={[
                        styles.enhancedBankButton,
                        { 
                          backgroundColor: isSelected ? colors.primary : colors.background, 
                          borderColor: isSelected ? colors.primary : colors.border 
                        },
                        isSelected && styles.enhancedOptionButtonSelected,
                        index === GHANA_BANKS.length - 1 && styles.lastBankOption
                      ]}
                      onPress={() => setSelectedBank(bank.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.bankOptionContent}>
                        <Text style={[
                          styles.enhancedOptionText,
                          { color: isSelected ? '#ffffff' : colors.textPrimary }
                        ]}>
                          {bank.name}
                        </Text>
                        <Text style={[
                          styles.bankShortName,
                          { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
                        ]}>
                          {bank.shortName}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={styles.enhancedSelectedIndicator}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Account Number</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Enter account number"
              placeholderTextColor={colors.textSecondary}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
            />
            
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Account Holder Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Enter full name as on account"
              placeholderTextColor={colors.textSecondary}
              value={accountName}
              onChangeText={setAccountName}
            />
          </View>
        );

      case 'cash_pickup':
        return (
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Select Pickup Provider</Text>
            {CASH_PICKUP_PROVIDERS.map((provider) => {
              const isSelected = selectedPickupProvider === provider.id;
              return (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.enhancedOptionButton,
                    { 
                      backgroundColor: isSelected ? colors.primary : colors.card, 
                      borderColor: isSelected ? colors.primary : colors.border 
                    },
                    isSelected && styles.enhancedOptionButtonSelected
                  ]}
                  onPress={() => setSelectedPickupProvider(provider.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionButtonContent}>
                    <Text style={[
                      styles.enhancedProviderIcon, 
                      { color: isSelected ? '#ffffff' : colors.textSecondary }
                    ]}>
                      {provider.icon}
                    </Text>
                    <View style={styles.providerTextContainer}>
                      <Text style={[
                        styles.enhancedOptionText,
                        { color: isSelected ? '#ffffff' : colors.textPrimary }
                      ]}>
                        {provider.name}
                      </Text>
                      <Text style={[
                        styles.providerSubtext,
                        { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
                      ]}>
                        {provider.id === 'western_union' && 'Global money transfer'}
                        {provider.id === 'moneygram' && 'International remittance'}
                        {provider.id === 'super_express' && 'Local pickup service'}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Text style={styles.enhancedSelectedIndicator}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Recipient Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Full name of recipient"
              placeholderTextColor={colors.textSecondary}
              value={recipientName}
              onChangeText={setRecipientName}
            />
            
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Recipient Phone</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g., 024XXXXXXX"
              placeholderTextColor={colors.textSecondary}
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              keyboardType="phone-pad"
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <ArrowLeft color={colors.textSecondary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Withdraw Money</Text>
          <View style={styles.placeholder} />
        </View>

        {step === "select-card" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose card</Text>
            
            {cards.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={[styles.emptyStateIcon, { backgroundColor: colors.card }]}>
                  <CreditCard color={colors.textSecondary} size={48} style={{ opacity: 0.6 }} />
                </View>
                <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No cards available</Text>
                <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                  You need at least one card to make a withdrawal. Add a card to get started.
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
                  onPress={() => setStep("select-method")}
                />
              </>
            )}
          </View>
        )}

        {step === "select-method" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Select withdrawal method</Text>
            
            {/* Method Tabs */}
            <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.tab, 
                  { backgroundColor: colors.card, borderColor: colors.border },
                  activeTab === 'mobile_money' && [styles.activeTab, { backgroundColor: colors.primary, borderColor: colors.primary }]
                ]}
                onPress={() => setActiveTab('mobile_money')}
                activeOpacity={0.8}
              >
                <View style={styles.tabContent}>
                  <Text style={[styles.tabIcon, activeTab === 'mobile_money' && { color: '#ffffff' }]}>📱</Text>
                  <Text style={[
                    styles.tabText, 
                    { color: colors.textSecondary }, 
                    activeTab === 'mobile_money' && [styles.activeTabText, { color: '#ffffff' }]
                  ]}>
                    Mobile Money
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.tab, 
                  { backgroundColor: colors.card, borderColor: colors.border },
                  activeTab === 'bank_transfer' && [styles.activeTab, { backgroundColor: colors.primary, borderColor: colors.primary }]
                ]}
                onPress={() => setActiveTab('bank_transfer')}
                activeOpacity={0.8}
              >
                <View style={styles.tabContent}>
                  <Text style={[styles.tabIcon, activeTab === 'bank_transfer' && { color: '#ffffff' }]}>🏦</Text>
                  <Text style={[
                    styles.tabText, 
                    { color: colors.textSecondary }, 
                    activeTab === 'bank_transfer' && [styles.activeTabText, { color: '#ffffff' }]
                  ]}>
                    Bank Transfer
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.tab, 
                  { backgroundColor: colors.card, borderColor: colors.border },
                  activeTab === 'cash_pickup' && [styles.activeTab, { backgroundColor: colors.primary, borderColor: colors.primary }]
                ]}
                onPress={() => setActiveTab('cash_pickup')}
                activeOpacity={0.8}
              >
                <View style={styles.tabContent}>
                  <Text style={[styles.tabIcon, activeTab === 'cash_pickup' && { color: '#ffffff' }]}>💰</Text>
                  <Text style={[
                    styles.tabText, 
                    { color: colors.textSecondary }, 
                    activeTab === 'cash_pickup' && [styles.activeTabText, { color: '#ffffff' }]
                  ]}>
                    Cash Pickup
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.stepActions}>
              <CustomButton
                title="Back"
                variant="secondary"
                onPress={() => setStep("select-card")}
                style={styles.stepButton}
              />
              <CustomButton
                title="Continue"
                variant="primary"
                onPress={() => setStep("enter-details")}
                style={styles.stepButton}
              />
            </View>
          </View>
        )}

        {step === "enter-details" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Enter withdrawal details</Text>
            
            {/* Amount Input */}
            <View style={[styles.amountSection, { backgroundColor: colors.card }]}>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Amount to Withdraw</Text>
              <View style={styles.amountInputContainer}>
                <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>GHS</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.textPrimary }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              {activeCard && (
                <Text style={[styles.balanceHint, { color: colors.textSecondary }]}>
                  Available: GHS {activeCard.balance.toFixed(2)}
                </Text>
              )}
            </View>

            <ScrollView style={styles.detailsForm} showsVerticalScrollIndicator={false}>
              {renderTabContent()}
            </ScrollView>

            <View style={styles.stepActions}>
              <CustomButton
                title="Back"
                variant="secondary"
                onPress={() => setStep("select-method")}
                style={styles.stepButton}
              />
              <CustomButton
                title="Review Withdrawal"
                variant="primary"
                disabled={!amount}
                onPress={() => setStep("confirm-withdrawal")}
                style={styles.stepButton}
              />
            </View>
          </View>
        )}

        {step === "confirm-withdrawal" && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Confirm Withdrawal</Text>

            <ScrollView style={styles.confirmationScroll}>
              {/* Withdrawal Summary */}
              <View style={[styles.summarySection, { backgroundColor: colors.card }]}>
                <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Withdrawal Details</Text>
                
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
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Method</Text>
                  <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                    {getMethodDisplayName()}
                  </Text>
                </View>
                
                {/* Recipient Details */}
                {activeTab === 'mobile_money' && recipientName && mobileNumber && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Recipient Name</Text>
                      <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                        {recipientName}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
                      <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                        {mobileNumber}
                      </Text>
                    </View>
                  </>
                )}
                
                {activeTab === 'bank_transfer' && accountName && accountNumber && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Account Holder</Text>
                      <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                        {accountName}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Account Number</Text>
                      <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                        {accountNumber}
                      </Text>
                    </View>
                  </>
                )}
                
                {activeTab === 'cash_pickup' && recipientName && recipientPhone && (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Recipient Name</Text>
                      <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                        {recipientName}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Recipient Phone</Text>
                      <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                        {recipientPhone}
                      </Text>
                    </View>
                  </>
                )}
                
                {activeCard && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Remaining Balance</Text>
                    <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>GHS {(activeCard.balance - parseFloat(amount || '0')).toFixed(2)}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.stepActions}>
              <CustomButton
                title="Edit Details"
                variant="secondary"
                onPress={() => setStep("enter-details")}
                style={styles.stepButton}
              />
              <CustomButton
                title="Confirm Withdrawal"
                variant="primary"
                onPress={handleWithdrawal}
                style={styles.stepButton}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      
      <LoadingAnimation
        visible={loading.visible}
        message={loading.message}
        subtitle={loading.subtitle}
        type={loading.type}
        size={loading.size}
      />

      <WithdrawalSuccessModal
        visible={showSuccessModal}
        data={withdrawalSuccessData}
        onClose={handleSuccessModalClose}
        onGoHome={handleGoHome}
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
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    minWidth: 160,
  },
  cardsScroll: {
    marginBottom: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 6,
    marginBottom: 32,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 3,
    minHeight: 56,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 4,
    opacity: 0.8,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  activeTabText: {
    fontWeight: '700',
  },
  stepActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  stepButton: {
    flex: 1,
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
  balanceHint: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  detailsForm: {
    flex: 1,
  },
  formSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    minHeight: 60,
  },
  optionButtonSelected: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  providerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  bankSelectionContainer: {
    marginBottom: 16,
  },
  bankSelectionHint: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bankList: {
    maxHeight: 240,
    borderRadius: 8,
    borderWidth: 1,
  },
  bankListContent: {
    paddingVertical: 4,
  },
  bankOptionContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bankShortName: {
    fontSize: 12,
    marginTop: 2,
  },
  bankShortNameSelected: {
    fontWeight: '600',
  },
  selectedIndicator: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  lastBankOption: {
    marginBottom: 0,
  },
  confirmationScroll: {
    flex: 1,
  },
  summarySection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 15,
    flex: 1,
  },
  summaryValue: {
    fontSize: 15,
    textAlign: 'right',
    flex: 1,
    fontWeight: '500',
  },
  summaryCardInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  summarySecondary: {
    fontSize: 13,
    marginTop: 2,
  },
  networkHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
  // Enhanced UI styles
  enhancedOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    minHeight: 75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  enhancedOptionButtonSelected: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  enhancedBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    minHeight: 65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  optionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  enhancedProviderIcon: {
    fontSize: 24,
    marginRight: 16,
    width: 32,
    textAlign: 'center',
  },
  providerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  enhancedOptionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  providerSubtext: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.9,
  },
  enhancedSelectedIndicator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
});
