import { router } from "expo-router";
import { ArrowLeft, Bell, Globe, Shield, BarChart3, ChevronRight } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { StyleSheet, Text, TouchableOpacity, View, Animated, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CustomSwitch } from "@/components/ui/CustomSwitch";
import useAuthStore from "@/store/auth.store";
import { withAlpha, createMutedColor } from "@/theme/color-utils";
import { useBiometricMessages } from "@/context/BiometricToastContext";
import { checkBiometricAvailability, BiometricAvailability } from "@/lib/biometric/biometric.service";
import { useAlert } from "@/context/AlertContext";
import ConfirmDialog from "@/components/modals/ConfirmDialog";

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
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showBiometricDisableConfirm, setShowBiometricDisableConfirm] = useState(false);
  
  const availableLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'ar', name: 'العربية' }
  ];
  
  // Handle navigation back with fallback
  const handleGoBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        // Fallback to profile screen if we can't go back
        router.push('/(tabs)/profile');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Last resort fallback to profile
      router.replace('/(tabs)/profile');
    }
  };
  
  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [notificationsValue, analyticsValue, languageValue] = await Promise.all([
          AsyncStorage.getItem('settings_notifications'),
          AsyncStorage.getItem('settings_analytics'),
          AsyncStorage.getItem('settings_language')
        ]);
        
        if (notificationsValue !== null) {
          setNotificationsEnabled(JSON.parse(notificationsValue));
        }
        if (analyticsValue !== null) {
          setAnalyticsEnabled(JSON.parse(analyticsValue));
        }
        if (languageValue !== null) {
          setSelectedLanguage(languageValue);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
  }, []);
  
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
      // Disable biometric authentication - show confirmation
      setShowBiometricDisableConfirm(true);
    }
  };
  
  // Handle biometric disable confirmation
  const handleBiometricDisableConfirm = async () => {
    setShowBiometricDisableConfirm(false);
    try {
      await disableBiometric();
      biometricMessages.authDisabled();
    } catch (error) {
      console.error('Error disabling biometrics:', error);
      biometricMessages.genericError('disable biometric authentication');
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[{ flex: 1 }, transitionStyle]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleGoBack}
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
                    color: notificationsEnabled ? colors.textPrimary : createMutedColor(colors.textPrimary, colors.background),
                    fontWeight: notificationsEnabled ? '700' : '600'
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
                // Persist to storage
                AsyncStorage.setItem('settings_notifications', JSON.stringify(value));
                // Show confirmation
                showAlert(
                  'success',
                  value ? 'You will now receive push notifications about account activity.' 
                        : 'You will no longer receive push notifications.',
                  'Notifications ' + (value ? 'Enabled' : 'Disabled')
                );
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
                    color: biometricEnabled ? colors.textPrimary : createMutedColor(colors.textPrimary, colors.background),
                    fontWeight: biometricEnabled ? '700' : '600'
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
                    color: analyticsEnabled ? colors.textPrimary : createMutedColor(colors.textPrimary, colors.background),
                    fontWeight: analyticsEnabled ? '700' : '600'
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
                // Persist to storage
                AsyncStorage.setItem('settings_analytics', JSON.stringify(value));
                // Show confirmation with more details
                showAlert(
                  'success',
                  value ? 'Anonymous usage data will be collected to help improve the app. No personal information is shared.' 
                        : 'No usage data will be collected.',
                  'Analytics ' + (value ? 'Enabled' : 'Disabled')
                );
              }}
              accessibilityLabel="Toggle analytics data sharing"
              accessibilityHint="Enables or disables sharing of anonymous usage analytics"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>General</Text>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => setShowLanguageSelector(true)}
          >
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
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{selectedLanguage}</Text>
              <ChevronRight color={colors.textSecondary} size={20} style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
        </View>
          </View>
        </ScrollView>
      </Animated.View>
      
      {/* Language Selector Modal */}
      <Modal
        visible={showLanguageSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.languageModal, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Language</Text>
              <TouchableOpacity 
                onPress={() => setShowLanguageSelector(false)}
                style={styles.modalCloseButton}
              >
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.languageList}>
              {availableLanguages.map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.languageOption,
                    selectedLanguage === language.name && {
                      backgroundColor: colors.tintPrimary + '20'
                    }
                  ]}
                  onPress={() => {
                    setSelectedLanguage(language.name);
                    AsyncStorage.setItem('settings_language', language.name);
                    setShowLanguageSelector(false);
                    showAlert(
                      'success',
                      `Language has been set to ${language.name}. Please restart the app for changes to take full effect.`,
                      'Language Updated'
                    );
                  }}
                >
                  <Text style={[
                    styles.languageText,
                    { 
                      color: selectedLanguage === language.name ? colors.tintPrimary : colors.textPrimary,
                      fontWeight: selectedLanguage === language.name ? '600' : '400'
                    }
                  ]}>
                    {language.name}
                  </Text>
                  {selectedLanguage === language.name && (
                    <View style={[styles.selectedIndicator, { backgroundColor: colors.tintPrimary }]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Biometric Disable Confirmation Dialog */}
      <ConfirmDialog
        visible={showBiometricDisableConfirm}
        title="Disable Biometric Authentication"
        message="Are you sure you want to disable biometric authentication? You will need to use your password to sign in."
        confirmText="Disable"
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleBiometricDisableConfirm}
        onCancel={() => setShowBiometricDisableConfirm(false)}
        leftIcon={<Shield color={colors.negative} size={20} />}
      />
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
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  languageModal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '500',
  },
  languageList: {
    maxHeight: 300,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  languageText: {
    fontSize: 16,
    flex: 1,
  },
  selectedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
