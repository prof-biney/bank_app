/**
 * Enhanced Biometric UI Components Integration Example
 * 
 * This example demonstrates how to use the enhanced biometric components
 * together with the new hook for a complete biometric authentication experience.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';

// Enhanced Components
import EnhancedBiometricButton from '@/components/auth/EnhancedBiometricButton';
import BiometricLoadingIndicator from '@/components/auth/BiometricLoadingIndicator';
import { useBiometricMessages } from '@/context/BiometricToastContext';

// Auth Store
import useAuthStore from '@/store/auth.store';

interface EnhancedBiometricExampleProps {
  mode: 'login' | 'setup' | 'settings';
}

const EnhancedBiometricExample: React.FC<EnhancedBiometricExampleProps> = ({ mode }) => {
  const { colors } = useTheme();
  const { biometricEnabled, biometricType } = useAuthStore();
  const { state, authenticate, setup, disable, checkAvailability, reset } = useBiometricAuth();
  const biometricMessages = useBiometricMessages();

  // Initialize on mount
  useEffect(() => {
    checkAvailability();
    return () => reset(); // Cleanup on unmount
  }, [checkAvailability, reset]);

  const handleButtonPress = async () => {
    switch (mode) {
      case 'login':
        if (biometricEnabled && state.availability?.isAvailable) {
          await authenticate();
        } else {
          biometricMessages.showInfo('Setup Required', 'Please set up biometric authentication first');
        }
        break;
      
      case 'setup':
        if (state.availability?.isAvailable) {
          const success = await setup();
          if (success) {
            // Handle success - maybe navigate or update UI
            console.log('Biometric setup successful');
          }
        } else {
          biometricMessages.showWarning('Not Available', 'Biometric authentication is not available on this device');
        }
        break;
      
      case 'settings':
        if (biometricEnabled) {
          const success = await disable();
          if (success) {
            console.log('Biometric authentication disabled');
          }
        } else {
          if (state.availability?.isAvailable) {
            const success = await setup();
            if (success) {
              console.log('Biometric authentication enabled');
            }
          } else {
            biometricMessages.showWarning('Not Available', 'Biometric authentication is not available on this device');
          }
        }
        break;
    }
  };

  const getButtonLabel = () => {
    switch (mode) {
      case 'login':
        return biometricEnabled ? `Sign in with ${getBiometricTypeName()}` : 'Biometric Login';
      case 'setup':
        return `Set up ${getBiometricTypeName()}`;
      case 'settings':
        return biometricEnabled ? `Disable ${getBiometricTypeName()}` : `Enable ${getBiometricTypeName()}`;
      default:
        return 'Biometric Auth';
    }
  };

  const getBiometricTypeName = () => {
    switch (biometricType) {
      case 'faceId':
        return 'Face ID';
      case 'touchId':
        return 'Touch ID';
      case 'fingerprint':
        return 'Fingerprint';
      default:
        return 'Biometric';
    }
  };

  const getInstructions = () => {
    switch (mode) {
      case 'login':
        return biometricEnabled 
          ? `Use your ${getBiometricTypeName()} to sign in quickly and securely`
          : 'Biometric authentication is not set up. Please set it up in Settings.';
      case 'setup':
        return `Set up ${getBiometricTypeName()} authentication for quick and secure access to your account`;
      case 'settings':
        return biometricEnabled
          ? `${getBiometricTypeName()} is currently enabled. Tap to disable.`
          : `Enable ${getBiometricTypeName()} for quick and secure access`;
      default:
        return 'Biometric authentication';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {mode === 'login' ? 'Quick Sign In' : 
             mode === 'setup' ? 'Setup Authentication' : 
             'Biometric Settings'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {getInstructions()}
          </Text>
        </View>

        {/* Biometric Button */}
        <View style={styles.buttonContainer}>
          <EnhancedBiometricButton
            biometricType={biometricType}
            onPress={handleButtonPress}
            state={state.buttonState}
            size="large"
            variant={mode === 'settings' && biometricEnabled ? 'outline' : 'primary'}
            showLabel={true}
            customLabel={getButtonLabel()}
            disabled={!state.availability?.isAvailable && mode !== 'settings'}
          />
        </View>

        {/* Status Information */}
        <View style={styles.statusContainer}>
          {state.availability && !state.availability.isAvailable && (
            <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.statusTitle, { color: colors.destructive }]}>
                Not Available
              </Text>
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                {state.availability.error}
              </Text>
            </View>
          )}

          {biometricEnabled && state.availability?.isAvailable && (
            <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.statusTitle, { color: colors.positive }]}>
                Enabled
              </Text>
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                {getBiometricTypeName()} authentication is active
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Loading Overlay */}
      <BiometricLoadingIndicator
        visible={state.isLoading}
        biometricType={biometricType}
        stage={state.stage}
        message={state.message}
        progress={state.progress}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  statusContainer: {
    width: '100%',
    maxWidth: 320,
  },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default EnhancedBiometricExample;