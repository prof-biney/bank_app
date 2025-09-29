import { router } from "expo-router";
import { ArrowLeft, Bell, Globe, Shield, BarChart3 } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { StyleSheet, Text, TouchableOpacity, View, Animated, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CustomSwitch } from "@/components/ui/CustomSwitch";
import useAuthStore from "@/store/auth.store";
import { useAlert } from "@/context/AlertContext";
import { useBiometricMessages } from "@/context/BiometricToastContext";
import { checkBiometricAvailability, BiometricAvailability } from "@/lib/biometric/biometric.service";

export default function SettingsScreen() {
  const { colors, transitionStyle } = useTheme();
  const { showAlert } = useAlert();
  const biometricMessages = useBiometricMessages();
  
  const {
    biometricEnabled,
    biometricType,
    setupBiometric,
    disableBiometric,
    checkBiometricAvailability: checkBiometricAvailabilityStore,
    loadBiometricState,
  } = useAuthStore();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [biometricAvailability, setBiometricAvailability] = useState<BiometricAvailability | null>(null);
  const [isSettingUpBiometric, setIsSettingUpBiometric] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Initialize biometric state on mount (non-blocking)
  useEffect(() => {
    // Use setTimeout to prevent blocking UI rendering
    const timeoutId = setTimeout(() => {
      initializeBiometricState();
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Check biometric availability (optimized)
  const initializeBiometricState = async () => {
    try {
      // Load stored biometric state in background
      const loadBiometricPromise = loadBiometricState();
      
      // Check current hardware availability in parallel
      const availabilityPromise = checkBiometricAvailability();
      
      // Wait for both operations
      const [, availability] = await Promise.all([
        loadBiometricPromise,
        availabilityPromise
      ]);
      
      setBiometricAvailability(availability);
    } catch (error) {
      console.error('Error initializing biometric state:', error);
      // Don't show error immediately on screen load
      setTimeout(() => {
        biometricMessages.genericError('check biometric availability');
      }, 1000);
    } finally {
      // Mark initialization as complete
      setIsInitializing(false);
    }
  };
  
  // Handler for biometric toggle
  const handleBiometricToggle = async (value: boolean) => {
    if (!biometricAvailability?.isAvailable && value) {
      if (biometricAvailability?.reason === 'hardware_not_available') {
        biometricMessages.hardwareNotAvailable();
      } else if (biometricAvailability?.reason === 'no_biometrics_enrolled') {
        biometricMessages.noBiometricsEnrolled();
      } else {
        biometricMessages.genericError('enable biometric authentication');
      }
      return;
    }
    
    if (value) {
      // Enable biometric authentication
      setIsSettingUpBiometric(true);
      try {
        const result = await setupBiometric();
        
        if (result.success) {
          biometricMessages.setupSuccess(result.biometricType);
        } else {
          // Setup failed or was canceled
          biometricMessages.setupFailed(result.error);
        }
      } catch (error) {
        console.error('Error setting up biometrics:', error);
        biometricMessages.setupFailed('An unexpected error occurred during setup');
      } finally {
        setIsSettingUpBiometric(false);
      }
    } else {
      // Disable biometric authentication
      try {
        // Confirm with user
        Alert.alert(
          'Disable Biometric Authentication',
          'Are you sure you want to disable biometric authentication? You will need to use your password to sign in.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                try {
                  await disableBiometric();
                  biometricMessages.authDisabled();
                } catch (error) {
                  console.error('Error disabling biometrics:', error);
                  biometricMessages.genericError('disable biometric authentication');
                }
              },
            },
          ],
        );
      } catch (error) {
        console.error('Error disabling biometrics:', error);
        biometricMessages.genericError('disable biometric authentication');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[{ flex: 1 }, transitionStyle]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <ArrowLeft color={colors.textSecondary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.themeToggleContainer}>
                <ThemeToggle size="small" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[
                  styles.settingText, 
                  { 
                    color: colors.textPrimary,
                    fontWeight: '600'
                  }
                ]}>Theme</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Choose your preferred app theme</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Bell 
                color={notificationsEnabled ? colors.tintPrimary : colors.textSecondary} 
                size={20} 
              />
              <View style={styles.settingTextContainer}>
                <Text style={[
                  styles.settingText, 
                  { 
                    color: notificationsEnabled ? colors.textPrimary : colors.textPrimary,
                    fontWeight: notificationsEnabled ? '700' : '600',
                    opacity: notificationsEnabled ? 1 : 0.85
                  }
                ]}>Push Notifications</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Receive notifications about account activity</Text>
              </View>
            </View>
            <CustomSwitch
              value={notificationsEnabled}
              onValueChange={(value) => {
                // Immediate visual feedback
                setNotificationsEnabled(value);
                // Add haptic feedback for better UX
                // HapticFeedback.impact(HapticFeedback.ImpactFeedbackStyle.Light);
              }}
              accessibilityLabel="Toggle push notifications"
              accessibilityHint="Enables or disables push notifications for account activity"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Security</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Shield 
                color={biometricEnabled ? colors.tintPrimary : colors.textSecondary} 
                size={20} 
              />
              <View style={styles.settingTextContainer}>
                <Text style={[
                  styles.settingText, 
                  { 
                    color: biometricEnabled ? colors.textPrimary : colors.textPrimary,
                    fontWeight: biometricEnabled ? '700' : '600',
                    opacity: biometricEnabled ? 1 : 0.85
                  }
                ]}>Biometric Authentication</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Sign in with Face ID, Touch ID, or fingerprint</Text>
              </View>
            </View>
            <CustomSwitch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              disabled={isSettingUpBiometric || isInitializing}
              accessibilityLabel="Toggle biometric authentication"
              accessibilityHint="Enables or disables biometric authentication for sign in"
            />
            {isSettingUpBiometric && (
              <View style={styles.biometricStatusIndicator}>
                <Text style={[styles.biometricStatus, { color: colors.textSecondary }]}>Setting up...</Text>
              </View>
            )}
            {isInitializing && (
              <View style={styles.biometricStatusIndicator}>
                <Text style={[styles.biometricStatus, { color: colors.textSecondary }]}>Loading...</Text>
              </View>
            )}
            {biometricEnabled && biometricType && (
              <View style={styles.biometricTypeIndicator}>
                <Text style={[styles.biometricType, { color: colors.textSecondary }]}>
                  {biometricType === 'faceId' ? 'Face ID' : 
                   biometricType === 'touchId' ? 'Touch ID' : 
                   'Fingerprint'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Privacy</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <BarChart3 
                color={analyticsEnabled ? colors.tintPrimary : colors.textSecondary} 
                size={20} 
              />
              <View style={styles.settingTextContainer}>
                <Text style={[
                  styles.settingText, 
                  { 
                    color: analyticsEnabled ? colors.textPrimary : colors.textPrimary,
                    fontWeight: analyticsEnabled ? '700' : '600',
                    opacity: analyticsEnabled ? 1 : 0.85
                  }
                ]}>Share Analytics Data</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Help improve our services by sharing anonymous usage data</Text>
              </View>
            </View>
            <CustomSwitch
              value={analyticsEnabled}
              onValueChange={(value) => {
                // Immediate visual feedback
                setAnalyticsEnabled(value);
                // Add haptic feedback for better UX
                // HapticFeedback.impact(HapticFeedback.ImpactFeedbackStyle.Light);
              }}
              accessibilityLabel="Toggle analytics data sharing"
              accessibilityHint="Enables or disables sharing of anonymous usage analytics"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>General</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Globe color={colors.textSecondary} size={20} />
              <View style={styles.settingTextContainer}>
                <Text style={[
                  styles.settingText, 
                  { 
                    color: colors.textPrimary,
                    fontWeight: '600'
                  }
                ]}>Language</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Choose your preferred language</Text>
              </View>
            </View>
            <Text style={[styles.settingValue, { color: colors.textSecondary }]}>English</Text>
          </TouchableOpacity>
        </View>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40, // Extra padding at bottom for comfortable scrolling
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    minHeight: 64,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  settingText: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.75,
    letterSpacing: 0.1,
  },
  settingValue: {
    fontSize: 16,
  },
  themeToggleContainer: {
    marginRight: 4, // Align with other icons
    marginTop: -2, // Center vertically with text
  },
  biometricStatusIndicator: {
    marginLeft: 8,
  },
  biometricStatus: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  biometricTypeIndicator: {
    marginLeft: 8,
  },
  biometricType: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
});
