import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { CheckCircle, Home, User, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { router } from 'expo-router';
import { withAlpha } from '@/theme/color-utils';

interface ProfileUpdateSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  updateType: 'profile' | 'password';
  updatedFields?: {
    name?: string;
    phoneNumber?: string;
  };
}

export default function ProfileUpdateSuccessModal({ 
  visible, 
  onClose, 
  updateType,
  updatedFields
}: ProfileUpdateSuccessModalProps) {
  const { colors } = useTheme();

  const handleGoHome = () => {
    onClose();
    router.replace('/(tabs)/');
  };

  const handleGoToProfile = () => {
    onClose();
    router.replace('/(tabs)/profile');
  };

  const getTitle = () => {
    return updateType === 'profile' ? 'Profile Updated!' : 'Password Updated!';
  };

  const getMessage = () => {
    if (updateType === 'password') {
      return 'Your password has been successfully updated. Please use your new password for future logins.';
    }
    
    const updatedFieldsList = [];
    if (updatedFields?.name) updatedFieldsList.push('name');
    if (updatedFields?.phoneNumber) updatedFieldsList.push('phone number');
    
    if (updatedFieldsList.length === 0) {
      return 'Your profile has been successfully updated.';
    }
    
    return `Your ${updatedFieldsList.join(' and ')} ${updatedFieldsList.length === 1 ? 'has' : 'have'} been successfully updated.`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
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
            {getTitle()}
          </Text>
          
          <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
            {getMessage()}
          </Text>

          {/* Update Details (for profile updates only) */}
          {updateType === 'profile' && updatedFields && (
            <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
              <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.detailsTitle, { color: colors.textPrimary }]}>
                  Updated Information
                </Text>

                {updatedFields.name && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {updatedFields.name}
                    </Text>
                  </View>
                )}

                {updatedFields.phoneNumber && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Phone Number</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {updatedFields.phoneNumber}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Updated</Text>
                  <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: 14 }]}>
                    {new Date().toLocaleString()}
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {/* Security Notice for Password Updates */}
          {updateType === 'password' && (
            <View style={[styles.securityNotice, { backgroundColor: withAlpha(colors.tintPrimary, 0.1), borderColor: colors.tintPrimary }]}>
              <Text style={[styles.securityNoticeText, { color: colors.tintPrimary }]}>
                🔒 For your security, please log out and log back in on other devices using your new password.
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { 
                backgroundColor: colors.card, 
                borderColor: colors.border 
              }]}
              onPress={handleGoToProfile}
            >
              <User color={colors.textSecondary} size={20} />
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                View Profile
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
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
    maxHeight: 200,
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
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  securityNotice: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  securityNoticeText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
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
    minHeight: 56,
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