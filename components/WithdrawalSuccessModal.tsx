/**
 * WithdrawalSuccessModal Component
 * 
 * Displays detailed withdrawal success information with options to view receipt or go home.
 * Features include withdrawal details, fees breakdown, method-specific instructions, and action buttons.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { CheckCircle, X, FileText, Home, Clock, CreditCard } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import CustomButton from './CustomButton';
import Badge from './ui/Badge';
import { getBadgeVisuals } from '@/theme/badge-utils';

const { width, height } = Dimensions.get('window');

export interface WithdrawalSuccessData {
  amount: number;
  currency: string;
  fees: number;
  netAmount: number;
  withdrawalMethod: string;
  sourceNewBalance: number;
  reference: string;
  timestamp: string;
  transactionId: string;
  estimatedCompletionTime?: string;
  
  // Method-specific data
  recipientName?: string;
  mobileNumber?: string;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  receiverName?: string;
  pickupCode?: string;
  pickupProvider?: string;
  
  // Instructions
  instructions?: {
    method: string;
    steps: string[];
    reference: string;
    expiresAt?: string;
    mobileMoneyInstructions?: {
      network: string;
      shortCode: string;
      instructions: string[];
    };
    bankTransferInstructions?: {
      bankName: string;
      accountNumber: string;
      referenceNumber: string;
      processingTime: string;
    };
    cashPickupInstructions?: {
      provider: string;
      pickupCode: string;
      locations: Array<{
        name: string;
        address: string;
        hours: string;
      }>;
    };
  };
}

interface WithdrawalSuccessModalProps {
  visible: boolean;
  data: WithdrawalSuccessData | null;
  onClose: () => void;
  onViewReceipt?: () => void;
  onGoHome: () => void;
}

export default function WithdrawalSuccessModal({
  visible,
  data,
  onClose,
  onViewReceipt,
  onGoHome
}: WithdrawalSuccessModalProps) {
  const { colors } = useTheme();

  if (!data) return null;

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getMethodDisplayName = (method: string) => {
    switch (method) {
      case 'mobile_money': return 'Mobile Money';
      case 'bank_transfer': return 'Bank Transfer';
      case 'cash_pickup': return 'Cash Pickup';
      default: return method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'mobile_money': return '📱';
      case 'bank_transfer': return '🏦';
      case 'cash_pickup': return '💰';
      default: return '💳';
    }
  };

  const getBadgeVariant = (method: string) => {
    switch (method) {
      case 'mobile_money': return 'info';
      case 'bank_transfer': return 'warning';
      case 'cash_pickup': return 'success';
      default: return 'default';
    }
  };

  const dateTime = formatDateTime(data.timestamp);
  const badgeVariant = getBadgeVariant(data.withdrawalMethod);
  const badgeVisuals = getBadgeVisuals(badgeVariant, colors);

  const handleGoHome = () => {
    onClose();
    onGoHome();
  };

  const renderInstructions = () => {
    if (!data.instructions) return null;

    return (
      <View style={[styles.instructionsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.instructionsTitle, { color: colors.textPrimary }]}>
          Next Steps
        </Text>
        
        {data.instructions.steps.map((step, index) => (
          <View key={index} style={styles.instructionStep}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={[styles.stepNumberText, { color: colors.background }]}>
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>
              {step}
            </Text>
          </View>
        ))}

        {data.instructions.expiresAt && (
          <View style={[styles.expiryNotice, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <Clock size={16} color={colors.warning} />
            <Text style={[styles.expiryText, { color: colors.warning }]}>
              Instructions expire on {formatDateTime(data.instructions.expiresAt).date} at {formatDateTime(data.instructions.expiresAt).time}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderMethodSpecificDetails = () => {
    switch (data.withdrawalMethod) {
      case 'mobile_money':
        return (
          <View style={styles.methodDetails}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{data.mobileNumber}</Text>
            {data.instructions?.mobileMoneyInstructions?.network && (
              <>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Network</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {data.instructions.mobileMoneyInstructions.network.toUpperCase()}
                </Text>
              </>
            )}
          </View>
        );

      case 'bank_transfer':
        return (
          <View style={styles.methodDetails}>
            {data.bankName && (
              <>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Bank</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{data.bankName}</Text>
              </>
            )}
            {data.accountNumber && (
              <>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Account Number</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{data.accountNumber}</Text>
              </>
            )}
            {data.accountName && (
              <>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Account Name</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{data.accountName}</Text>
              </>
            )}
          </View>
        );

      case 'cash_pickup':
        return (
          <View style={styles.methodDetails}>
            {data.pickupProvider && (
              <>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Provider</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{data.pickupProvider}</Text>
              </>
            )}
            {data.receiverName && (
              <>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Receiver</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{data.receiverName}</Text>
              </>
            )}
            {data.pickupCode && (
              <>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Pickup Code</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary, fontWeight: '700' }]}>{data.pickupCode}</Text>
              </>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <CheckCircle size={24} color={colors.positive} />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Withdrawal Successful
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Success Icon and Amount */}
          <View style={styles.successSection}>
            <View style={[styles.successIcon, { backgroundColor: colors.positive + '20' }]}>
              <CheckCircle size={64} color={colors.positive} />
            </View>
            <Text style={[styles.successAmount, { color: colors.textPrimary }]}>
              {data.currency} {data.netAmount.toFixed(2)}
            </Text>
            <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
              Successfully withdrawn via {getMethodDisplayName(data.withdrawalMethod)}
            </Text>
            
            <Badge
              variant={badgeVariant}
              style={[styles.methodBadge, { backgroundColor: badgeVisuals.backgroundColor }]}
            >
              <Text style={[styles.methodBadgeText, { color: badgeVisuals.textColor }]}>
                {getMethodIcon(data.withdrawalMethod)} {getMethodDisplayName(data.withdrawalMethod)}
              </Text>
            </Badge>
          </View>

          {/* Transaction Details */}
          <View style={[styles.detailsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Transaction Details
            </Text>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {data.currency} {data.amount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Fees</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                {data.currency} {data.fees.toFixed(2)}
              </Text>
            </View>

            <View style={[styles.detailRow, styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textPrimary, fontWeight: '600' }]}>Net Amount</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary, fontWeight: '700' }]}>
                {data.currency} {data.netAmount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Reference</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary, fontFamily: 'monospace' }]}>
                {data.reference}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {dateTime.date} at {dateTime.time}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>New Balance</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary, fontWeight: '600' }]}>
                {data.currency} {data.sourceNewBalance.toFixed(2)}
              </Text>
            </View>

            {data.estimatedCompletionTime && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Processing Time</Text>
                <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                  {data.estimatedCompletionTime}
                </Text>
              </View>
            )}

            {/* Method-specific details */}
            {renderMethodSpecificDetails()}
          </View>

          {/* Instructions */}
          {renderInstructions()}
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {onViewReceipt && (
            <CustomButton
              title="View Receipt"
              variant="secondary"
              leftIcon={<FileText color={colors.primary} size={20} />}
              onPress={onViewReceipt}
              style={styles.actionButton}
            />
          )}
          <CustomButton
            title="Go to Home"
            variant="primary"
            leftIcon={<Home color="#fff" size={20} />}
            onPress={handleGoHome}
            style={styles.actionButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successAmount: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  methodBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  methodBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalRow: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 15,
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    textAlign: 'right',
    flex: 1,
  },
  methodDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  instructionsSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  expiryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  expiryText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});