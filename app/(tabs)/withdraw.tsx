/**
 * Withdrawal Screen
 * 
 * Provides comprehensive withdrawal functionality with multiple withdrawal methods
 * tailored for the Ghanaian financial ecosystem including mobile money, bank transfers,
 * and cash pickup options.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useApp } from '@/context/AppContext';
import useAuthStore from '@/store/auth.store';
import { withdrawalService, type WithdrawalRequest, type WithdrawalMethod } from '@/lib/appwrite';

type TabType = 'mobile_money' | 'bank_transfer' | 'cash_pickup';

// Mobile Money Providers in Ghana
const MOBILE_MONEY_PROVIDERS = [
  { id: 'mtn', name: 'MTN Mobile Money', icon: '📱', color: '#FFD700' },
  { id: 'vodafone', name: 'Telecel Cash', icon: '📱', color: '#E60026' },
  { id: 'airteltigo', name: 'AirtelTigo Money', icon: '📱', color: '#FF6B35' },
];

// Major Ghanaian Banks
const GHANA_BANKS = [
  { id: 'gcb', name: 'GCB Bank Limited', shortName: 'GCB' },
  { id: 'ecobank', name: 'Ecobank Ghana', shortName: 'Ecobank' },
  { id: 'stanbic', name: 'Stanbic Bank Ghana', shortName: 'Stanbic' },
  { id: 'fidelity', name: 'Fidelity Bank Ghana', shortName: 'Fidelity' },
  { id: 'cal_bank', name: 'CAL Bank', shortName: 'CAL Bank' },
  { id: 'standard_chartered', name: 'Standard Chartered Bank Ghana', shortName: 'Standard Chartered' },
  { id: 'absa', name: 'Absa Bank Ghana', shortName: 'Absa' },
  { id: 'access_bank', name: 'Access Bank Ghana', shortName: 'Access Bank' },
  { id: 'gtbank', name: 'Guaranty Trust Bank Ghana', shortName: 'GTBank' },
  { id: 'unibank', name: 'Universal Merchant Bank', shortName: 'UMB' },
];

// Cash Pickup Providers
const CASH_PICKUP_PROVIDERS = [
  { id: 'western_union', name: 'Western Union', icon: '💰' },
  { id: 'moneygram', name: 'MoneyGram', icon: '💳' },
  { id: 'ria', name: 'Ria Money Transfer', icon: '💵' },
];

export default function WithdrawScreen() {
  const { cards, makeTransaction, refreshCardBalances } = useApp();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('mobile_money');
  const [selectedCard, setSelectedCard] = useState(cards[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const withdrawalAmount = parseFloat(amount);
      const selectedCardData = cards.find(card => card.id === selectedCard);
      
      if (!selectedCardData) {
        Alert.alert('Error', 'Please select a valid card');
        return;
      }

      // Prepare withdrawal request based on selected method
      let withdrawalRequest: WithdrawalRequest;
      
      if (activeTab === 'mobile_money') {
        withdrawalRequest = {
          cardId: selectedCard,
          amount: withdrawalAmount,
          method: 'mobile_money' as WithdrawalMethod,
          mobileMoneyDetails: {
            provider: selectedProvider,
            phoneNumber: mobileNumber
          }
        };
      } else if (activeTab === 'bank_transfer') {
        withdrawalRequest = {
          cardId: selectedCard,
          amount: withdrawalAmount,
          method: 'bank_transfer' as WithdrawalMethod,
          bankTransferDetails: {
            bankCode: selectedBank,
            accountNumber: accountNumber,
            accountName: accountName
          }
        };
      } else {
        withdrawalRequest = {
          cardId: selectedCard,
          amount: withdrawalAmount,
          method: 'cash_pickup' as WithdrawalMethod,
          cashPickupDetails: {
            provider: selectedPickupProvider,
            recipientName: recipientName,
            recipientPhone: recipientPhone
          }
        };
      }

      // Process withdrawal
      const result = await withdrawalService.processWithdrawal(withdrawalRequest);

      if (result.success) {
        // Create transaction record
        await makeTransaction({
          type: 'withdrawal',
          amount: withdrawalAmount,
          fromCardId: selectedCard,
          description: `Withdrawal via ${getMethodDisplayName()}`,
          fee: result.fee || 0
        });

        // Refresh balances
        await refreshCardBalances();

        // Show success with instructions
        Alert.alert(
          'Withdrawal Initiated',
          result.instructions,
          [
            {
              text: 'OK',
              onPress: () => {
                resetForm();
                router.push('/(root)/(tabs)/home');
              }
            }
          ]
        );
      } else {
        Alert.alert('Withdrawal Failed', result.message || 'Unable to process withdrawal');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      Alert.alert('Error', 'Failed to process withdrawal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!selectedCard) {
      Alert.alert('Error', 'Please select a card');
      return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const withdrawalAmount = parseFloat(amount);
    const selectedCardData = cards.find(card => card.id === selectedCard);
    
    if (!selectedCardData || selectedCardData.balance < withdrawalAmount) {
      Alert.alert('Error', 'Insufficient balance');
      return false;
    }

    if (activeTab === 'mobile_money') {
      if (!selectedProvider) {
        Alert.alert('Error', 'Please select a mobile money provider');
        return false;
      }
      if (!mobileNumber || mobileNumber.length < 10) {
        Alert.alert('Error', 'Please enter a valid mobile number');
        return false;
      }
    } else if (activeTab === 'bank_transfer') {
      if (!selectedBank) {
        Alert.alert('Error', 'Please select a bank');
        return false;
      }
      if (!accountNumber || accountNumber.length < 10) {
        Alert.alert('Error', 'Please enter a valid account number');
        return false;
      }
      if (!accountName.trim()) {
        Alert.alert('Error', 'Please enter account holder name');
        return false;
      }
    } else {
      if (!selectedPickupProvider) {
        Alert.alert('Error', 'Please select a pickup provider');
        return false;
      }
      if (!recipientName.trim()) {
        Alert.alert('Error', 'Please enter recipient name');
        return false;
      }
      if (!recipientPhone || recipientPhone.length < 10) {
        Alert.alert('Error', 'Please enter a valid recipient phone number');
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mobile_money':
        return (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Mobile Money Provider</Text>
            {MOBILE_MONEY_PROVIDERS.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                style={[
                  styles.optionButton,
                  selectedProvider === provider.id && styles.optionButtonSelected
                ]}
                onPress={() => setSelectedProvider(provider.id)}
              >
                <Text style={styles.providerIcon}>{provider.icon}</Text>
                <Text style={[
                  styles.optionText,
                  selectedProvider === provider.id && styles.optionTextSelected
                ]}>
                  {provider.name}
                </Text>
              </TouchableOpacity>
            ))}
            
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., 024XXXXXXX"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>
        );

      case 'bank_transfer':
        return (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Bank</Text>
            <ScrollView style={styles.bankList} showsVerticalScrollIndicator={false}>
              {GHANA_BANKS.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  style={[
                    styles.optionButton,
                    selectedBank === bank.id && styles.optionButtonSelected
                  ]}
                  onPress={() => setSelectedBank(bank.id)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedBank === bank.id && styles.optionTextSelected
                  ]}>
                    {bank.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={styles.inputLabel}>Account Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter account number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
            />
            
            <Text style={styles.inputLabel}>Account Holder Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter full name as on account"
              value={accountName}
              onChangeText={setAccountName}
            />
          </View>
        );

      case 'cash_pickup':
        return (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Pickup Provider</Text>
            {CASH_PICKUP_PROVIDERS.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                style={[
                  styles.optionButton,
                  selectedPickupProvider === provider.id && styles.optionButtonSelected
                ]}
                onPress={() => setSelectedPickupProvider(provider.id)}
              >
                <Text style={styles.providerIcon}>{provider.icon}</Text>
                <Text style={[
                  styles.optionText,
                  selectedPickupProvider === provider.id && styles.optionTextSelected
                ]}>
                  {provider.name}
                </Text>
              </TouchableOpacity>
            ))}
            
            <Text style={styles.inputLabel}>Recipient Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Full name of recipient"
              value={recipientName}
              onChangeText={setRecipientName}
            />
            
            <Text style={styles.inputLabel}>Recipient Phone</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., 024XXXXXXX"
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              keyboardType="phone-pad"
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw Money</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Card Selection */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Select Card</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {cards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  style={[
                    styles.cardOption,
                    selectedCard === card.id && styles.cardOptionSelected
                  ]}
                  onPress={() => setSelectedCard(card.id)}
                >
                  <Text style={styles.cardName}>{card.cardHolderName}</Text>
                  <Text style={styles.cardBalance}>
                    GH₵ {card.balance?.toFixed(2) || '0.00'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Amount Input */}
          <View style={styles.amountSection}>
            <Text style={styles.inputLabel}>Amount to Withdraw</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>GH₵</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Method Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'mobile_money' && styles.activeTab]}
              onPress={() => setActiveTab('mobile_money')}
            >
              <Text style={[styles.tabText, activeTab === 'mobile_money' && styles.activeTabText]}>
                Mobile Money
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'bank_transfer' && styles.activeTab]}
              onPress={() => setActiveTab('bank_transfer')}
            >
              <Text style={[styles.tabText, activeTab === 'bank_transfer' && styles.activeTabText]}>
                Bank Transfer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'cash_pickup' && styles.activeTab]}
              onPress={() => setActiveTab('cash_pickup')}
            >
              <Text style={[styles.tabText, activeTab === 'cash_pickup' && styles.activeTabText]}>
                Cash Pickup
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {renderTabContent()}
        </ScrollView>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleWithdrawal}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Withdraw Money</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  cardOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cardOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  cardName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  cardBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 4,
  },
  amountSection: {
    marginTop: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    paddingVertical: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    padding: 4,
    marginTop: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
  },
  formSection: {
    marginTop: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  providerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    color: '#007AFF',
  },
  bankList: {
    maxHeight: 200,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});