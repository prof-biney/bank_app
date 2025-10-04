import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { CheckCircle, Home, Receipt, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { router } from 'expo-router';

interface DepositSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  depositData: {
    amount: number;
    currency: string;
    cardId: string;
    transactionId: string;
    newBalance: number;
    reference?: string;
    method?: string;
  } | null;
}

const { width: screenWidth } = Dimensions.get('window');

export function DepositSuccessModal({ 
  visible, 
  onClose, 
  depositData
}: DepositSuccessModalProps) {
  const { colors } = useTheme();
  const [scaleValue] = React.useState(new Animated.Value(0));
  const [opacityValue] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleValue, opacityValue]);

  const handleGoHome = () => {
    onClose();
    router.push('/(tabs)/');
  };

  const handleViewReceipt = () => {
    // TODO: Implement receipt view functionality
    onClose();
    router.push('/(tabs)/activity');
  };

  if (!depositData) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: opacityValue,
          },
        ]}
      >
        {/* Fallback blur effect using semi-transparent overlay */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]} />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [{ scale: scaleValue }],
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.background }]}
            onPress={onClose}
          >
            <X color={colors.textSecondary} size={20} />
          </TouchableOpacity>

          {/* Success Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.tintPrimary + '15' }]}>
            <CheckCircle color={colors.tintPrimary} size={48} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Deposit Successful!
          </Text>

          {/* Amount */}
          <Text style={[styles.amount, { color: colors.tintPrimary }]}>
            {depositData.currency} {depositData.amount.toFixed(2)}
          </Text>

          {/* Details */}
          <View style={[styles.detailsContainer, { backgroundColor: colors.background }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                New Balance:
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {depositData.currency} {depositData.newBalance.toFixed(2)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Transaction ID:
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={1}>
                {depositData.transactionId}
              </Text>
            </View>

            {depositData.reference && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Reference:
                </Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {depositData.reference}
                </Text>
              </View>
            )}

            {depositData.method && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Method:
                </Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {depositData.method}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Date:
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {new Date().toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Success Message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Your deposit has been processed successfully. The funds have been added to your account.
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                { backgroundColor: colors.background, borderColor: colors.border }
              ]}
              onPress={handleViewReceipt}
            >
              <Receipt color={colors.textPrimary} size={18} />
              <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
                View Receipt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: colors.tintPrimary }
              ]}
              onPress={handleGoHome}
            >
              <Home color="#FFFFFF" size={18} />
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                Go to Home
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  detailsContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});