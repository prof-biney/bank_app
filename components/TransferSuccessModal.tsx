import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { CheckCircle, Home, Receipt, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { router } from 'expo-router';
import { withAlpha } from '@/theme/color-utils';

interface TransferSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  transferData: {
    amount: number;
    currency: string;
    recipientName: string;
    recipientCardNumber: string;
    sourceNewBalance: number;
    recipientNewBalance?: number;
    transactionId: string;
    reference: string;
    timestamp: string;
  } | null;
}

export default function TransferSuccessModal({ 
  visible, 
  onClose, 
  transferData 
}: TransferSuccessModalProps) {
  const { colors } = useTheme();

  if (!transferData) return null;

  const handleGoHome = () => {
    onClose();
    router.replace('/(tabs)/');
  };

  const handleViewReceipt = () => {
    onClose();
    // Navigate to receipt/transaction detail screen
    router.push(`/transaction-detail?id=${transferData.transactionId}`);
  };

  const formatCardNumber = (cardNumber: string) => {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length <= 4) return cardNumber;
    return `****-****-****-${cleaned.slice(-4)}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: withAlpha(colors.textPrimary, 0.5) }]}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Success Icon */}
          <View style={[styles.iconContainer, { backgroundColor: withAlpha('#10B981', 0.1) }]}>
            <CheckCircle color="#10B981" size={48} />
          </View>

          {/* Success Message */}
          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
            Transfer Successful!
          </Text>
          
          <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
            {transferData.currency} {transferData.amount.toFixed(2)} has been successfully transferred to {transferData.recipientName}
          </Text>

          {/* Transfer Details */}
          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.detailsTitle, { color: colors.textPrimary }]}>
                Transfer Details
              </Text>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {transferData.currency} {transferData.amount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>To</Text>
                <View style={styles.detailValueContainer}>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                    {transferData.recipientName}
                  </Text>
                  <Text style={[styles.detailSecondary, { color: colors.textSecondary }]}>
                    {formatCardNumber(transferData.recipientCardNumber)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Your New Balance</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {transferData.currency} {transferData.sourceNewBalance.toFixed(2)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
                <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: 14 }]} numberOfLines={1}>
                  {transferData.transactionId}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Reference</Text>
                <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: 14 }]}>
                  {transferData.reference}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
                <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: 14 }]}>
                  {new Date(transferData.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { 
                backgroundColor: colors.card, 
                borderColor: colors.border 
              }]}
              onPress={handleViewReceipt}
            >
              <Receipt color={colors.textSecondary} size={20} />
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                View Receipt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.tintPrimary }]}
              onPress={handleGoHome}
            >
              <Home color="#FFFFFF" size={20} />
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                Go Home
              </Text>
              <ArrowRight color="#FFFFFF" size={16} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  detailsContainer: {
    maxHeight: 300,
    marginBottom: 24,
  },
  detailsCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValueContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
  },
  detailSecondary: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    flex: 2,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});