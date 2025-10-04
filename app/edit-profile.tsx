import { logger } from '@/lib/logger';
import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import { navigateAfterLogout } from "@/lib/safeNavigation";
import {
  ArrowLeft,
  User,
  Phone,
  Lock,
} from "lucide-react-native";
import React, { useState, useCallback, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { useAlert } from '@/context/AlertContext';
import { useBiometricToast } from '@/context/BiometricToastContext';
import { SafeAreaView } from "react-native-safe-area-context";
import ProfileUpdateSuccessModal from '@/components/ProfileUpdateSuccessModal';

import { useTheme } from "@/context/ThemeContext";
import LoadingAnimation from '@/components/LoadingAnimation';
import { useLoading, LOADING_CONFIGS } from '@/hooks/useLoading';

// Form components
import { FullNameField } from '@/components/form';
import { PhoneNumberField } from '@/components/form';
import { PasswordField } from '@/components/form';
import { ConfirmPasswordField } from '@/components/form';
import {
  ValidationState,
  PhoneNumberValidationState,
  ConfirmPasswordValidationState,
  createInitialValidationState,
  createInitialPhoneNumberValidationState,
  createInitialConfirmPasswordValidationState,
} from '@/components/form/types';

// Phone validation
import {
  validatePhoneForNetwork,
  detectNetwork,
  MobileNetwork,
  toInternationalFormat,
  formatPhoneForDisplay,
} from '@/lib/phoneValidation';

// Auth service for password updates
import { account } from '@/lib/appwrite/config';

export default function EditProfileScreen() {
  const { user, updateUserProfile } = useAuthStore();
  const { showAlert } = useAlert();
  const { showSuccess, showError } = useBiometricToast();
  const { loading, withLoading } = useLoading();
  const { colors } = useTheme();

  // Form state
  const [name, setName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('GH'); // Default to Ghana
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Validation states
  const [nameValidation, setNameValidation] = useState<ValidationState>(createInitialValidationState());
  const [phoneValidation, setPhoneValidation] = useState<PhoneNumberValidationState>(createInitialPhoneNumberValidationState());
  const [currentPasswordValidation, setCurrentPasswordValidation] = useState<ValidationState>(createInitialValidationState());
  const [newPasswordValidation, setNewPasswordValidation] = useState<ValidationState>(createInitialValidationState());
  const [confirmPasswordValidation, setConfirmPasswordValidation] = useState<ConfirmPasswordValidationState>(createInitialConfirmPasswordValidationState());

  // Section states for showing/hiding different update sections
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  
  // Modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalUpdateType, setModalUpdateType] = useState<'profile' | 'password'>('profile');
  const [modalUpdatedFields, setModalUpdatedFields] = useState<{ name?: string; phoneNumber?: string }>({});

  const handleGoBack = useCallback(() => {
    logger.debug('SCREEN', 'Edit profile back button pressed');
    router.back();
  }, []);

  const handleSaveProfile = useCallback(async () => {
    try {
      logger.debug('SCREEN', 'Save profile button pressed');
      
      // Validate required fields
      if (!name.trim()) {
        showAlert('error', 'Please enter your full name', 'Validation Error');
        return;
      }

      // Validate phone number if provided
      if (phoneNumber.trim()) {
        // First try to detect if it's a Ghanaian number
        const detectedNetwork = detectNetwork(phoneNumber);
        if (detectedNetwork) {
          // Use Ghanaian validation
          const phoneValidationResult = validatePhoneForNetwork(phoneNumber, detectedNetwork);
          if (!phoneValidationResult.isValid) {
            showAlert('error', phoneValidationResult.error || 'Invalid phone number', 'Invalid Phone Number');
            return;
          }
        } else {
          // Fall back to generic international validation for non-Ghanaian numbers
          try {
            const { parsePhoneNumberFromString } = await import('libphonenumber-js');
            const parsedNumber = parsePhoneNumberFromString(phoneNumber, countryCode as any);
            if (!parsedNumber || !parsedNumber.isValid()) {
              showAlert('error', 'Please enter a valid phone number for the selected country', 'Invalid Phone Number');
              return;
            }
          } catch (error) {
            showAlert('error', 'Please enter a valid phone number', 'Invalid Phone Number');
            return;
          }
        }
      }

      // Update profile
      await withLoading(async () => {
        const updates: { name?: string; phoneNumber?: string } = {};
        
        if (name.trim() !== user?.name) {
          updates.name = name.trim();
        }
        
        if (phoneNumber.trim()) {
          const formattedPhone = toInternationalFormat(phoneNumber);
          updates.phoneNumber = formattedPhone;
        }

        if (Object.keys(updates).length > 0) {
          await updateUserProfile(updates);
          
          // Prepare modal data
          const updatedFields: { name?: string; phoneNumber?: string } = {};
          if (updates.name) updatedFields.name = updates.name;
          if (updates.phoneNumber) updatedFields.phoneNumber = updates.phoneNumber;
          
          // Show success modal
          setModalUpdateType('profile');
          setModalUpdatedFields(updatedFields);
          setShowSuccessModal(true);
          
          // Also show toast notification
          showSuccess('Profile Updated', 'Your profile has been updated successfully!');
        } else {
          showAlert('info', 'No changes to save', 'Info');
        }
      }, LOADING_CONFIGS.GENERAL);
    } catch (error) {
      logger.error('SCREEN', 'Profile update error:', error);
      showError('Update Failed', error instanceof Error ? error.message : 'Failed to update profile');
    }
  }, [name, phoneNumber, updateUserProfile, showSuccess, showError, withLoading, user?.name]);

  const handleChangePassword = useCallback(async () => {
    try {
      logger.debug('SCREEN', 'Change password button pressed');
      
      // Validate required fields
      if (!currentPassword.trim()) {
        showAlert('error', 'Please enter your current password', 'Validation Error');
        return;
      }
      
      if (!newPassword.trim()) {
        showAlert('error', 'Please enter a new password', 'Validation Error');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        showAlert('error', 'New passwords do not match', 'Validation Error');
        return;
      }
      
      if (newPassword.length < 8) {
        showAlert('error', 'Password must be at least 8 characters long', 'Validation Error');
        return;
      }

      // Update password
      await withLoading(async () => {
        await account.updatePassword(newPassword, currentPassword);
        
        // Clear password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
        
        // Show success modal
        setModalUpdateType('password');
        setModalUpdatedFields({});
        setShowSuccessModal(true);
        
        // Also show toast notification
        showSuccess('Password Updated', 'Your password has been updated successfully!');
      }, LOADING_CONFIGS.GENERAL);
    } catch (error) {
      logger.error('SCREEN', 'Password update error:', error);
      showError('Password Update Failed', error instanceof Error ? error.message : 'Failed to update password');
    }
  }, [currentPassword, newPassword, confirmPassword, showSuccess, showError, withLoading]);

  const resetNameField = useCallback(() => {
    setName('');
    setNameValidation(createInitialValidationState());
  }, []);

  const resetPhoneField = useCallback(() => {
    setPhoneNumber('');
    setPhoneValidation(createInitialPhoneNumberValidationState());
  }, []);

  const resetCurrentPasswordField = useCallback(() => {
    setCurrentPassword('');
    setCurrentPasswordValidation(createInitialValidationState());
  }, []);

  const resetNewPasswordField = useCallback(() => {
    setNewPassword('');
    setNewPasswordValidation(createInitialValidationState());
  }, []);

  const resetConfirmPasswordField = useCallback(() => {
    setConfirmPassword('');
    setConfirmPasswordValidation(createInitialConfirmPasswordValidationState());
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color={colors.textPrimary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Edit Profile</Text>
        </View>

        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Information Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <User color={colors.textSecondary} size={20} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Profile Information</Text>
            </View>

            <FullNameField
              label="Full Name"
              value={name}
              onChangeText={setName}
              validation={nameValidation}
              onValidationChange={setNameValidation}
              resetField={resetNameField}
              placeholder="Enter your full name"
              autoCapitalize="words"
            />

            <PhoneNumberField
              label="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              validation={phoneValidation}
              onValidationChange={setPhoneValidation}
              resetField={resetPhoneField}
              countryCode={countryCode}
              onCountryCodeChange={setCountryCode}
              placeholder="Enter your phone number"
            />

            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveProfile}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Save Profile Changes</Text>
            </TouchableOpacity>
          </View>

          {/* Password Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowPasswordSection(!showPasswordSection)}
              activeOpacity={0.7}
            >
              <Lock color={colors.textSecondary} size={20} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Change Password</Text>
              <Text style={[styles.expandText, { color: colors.textSecondary }]}>
                {showPasswordSection ? 'Collapse' : 'Expand'}
              </Text>
            </TouchableOpacity>

            {showPasswordSection && (
              <View style={styles.passwordFields}>
                <PasswordField
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  validation={currentPasswordValidation}
                  onValidationChange={setCurrentPasswordValidation}
                  resetField={resetCurrentPasswordField}
                  placeholder="Enter your current password"
                  enableValidation={false}
                />

                <PasswordField
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  validation={newPasswordValidation}
                  onValidationChange={setNewPasswordValidation}
                  resetField={resetNewPasswordField}
                  placeholder="Enter your new password"
                  enableValidation={true}
                  showStrengthMeter={true}
                />

                <ConfirmPasswordField
                  label="Confirm New Password"
                  value={confirmPassword}
                  password={newPassword}
                  onChangeText={setConfirmPassword}
                  validation={confirmPasswordValidation}
                  onValidationChange={setConfirmPasswordValidation}
                  resetField={resetConfirmPasswordField}
                  placeholder="Confirm your new password"
                />

                <TouchableOpacity 
                  style={[styles.changePasswordButton, { backgroundColor: colors.primary }]}
                  onPress={handleChangePassword}
                  activeOpacity={0.8}
                >
                  <Text style={styles.changePasswordButtonText}>Change Password</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      <LoadingAnimation
        visible={loading.visible}
        message={loading.message}
        subtitle={loading.subtitle}
        type={loading.type}
        size={loading.size}
      />
      
      <ProfileUpdateSuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        updateType={modalUpdateType}
        updatedFields={modalUpdatedFields}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  expandText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 56,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  passwordFields: {
    marginTop: 12,
  },
  changePasswordButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 56,
  },
  changePasswordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});