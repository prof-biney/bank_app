/**
 * BiometricSetupModal Component
 * 
 * A comprehensive modal for setting up biometric authentication with intelligent
 * Face ID guidance, lighting detection, and user-friendly setup flow.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { BlurView } from 'expo-blur';
import BiometricAuthButton from './BiometricAuthButton';
import { 
  BiometricType, 
  BiometricAvailability,
  checkBiometricAvailability,
  BiometricAuthResult 
} from '@/lib/biometric/biometric.service';

const { width, height } = Dimensions.get('window');

interface BiometricSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSetup: () => Promise<BiometricAuthResult>;
  onSkip: () => void;
}

interface SetupGuideStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  action?: string;
}

const BiometricSetupModal: React.FC<BiometricSetupModalProps> = ({
  visible,
  onClose,
  onSetup,
  onSkip,
}) => {
  const { colors } = useTheme();
  const [biometricAvailability, setBiometricAvailability] = useState<BiometricAvailability | null>(null);
  const [currentStep, setCurrentStep] = useState<'intro' | 'guide' | 'setup' | 'success' | 'error'>('intro');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  // Check biometric availability when modal opens
  useEffect(() => {
    if (visible) {
      initializeBiometrics();
      animateIn();
    } else {
      animateOut();
    }
  }, [visible]);

  const initializeBiometrics = async () => {
    try {
      const availability = await checkBiometricAvailability();
      setBiometricAvailability(availability);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const animateIn = () => {
    setCurrentStep('intro');
    
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getBiometricDetails = () => {
    if (!biometricAvailability?.isAvailable) return null;

    switch (biometricAvailability.biometricType) {
      case 'faceId':
        return {
          title: 'Set Up Face ID',
          description: 'Use your face to securely sign in to your account',
          icon: 'face',
          setupSteps: [
            {
              id: 'lighting',
              title: 'Check Your Lighting',
              description: 'Make sure your face is well-lit and clearly visible to the front camera',
              icon: 'wb-sunny',
              action: 'Position yourself in good lighting'
            },
            {
              id: 'position',
              title: 'Position Your Face',
              description: 'Hold your device at arm\'s length and look directly at the front camera',
              icon: 'center-focus-weak',
              action: 'Center your face in the frame'
            },
            {
              id: 'stability',
              title: 'Stay Still',
              description: 'Keep your head steady during the setup process',
              icon: 'accessibility',
              action: 'Hold still during scanning'
            }
          ]
        };
      case 'touchId':
        return {
          title: 'Set Up Touch ID',
          description: 'Use your fingerprint to securely sign in to your account',
          icon: 'fingerprint',
          setupSteps: [
            {
              id: 'clean',
              title: 'Clean Your Finger',
              description: 'Make sure your finger and the Touch ID sensor are clean and dry',
              icon: 'cleaning-services',
              action: 'Clean finger and sensor'
            },
            {
              id: 'placement',
              title: 'Finger Placement',
              description: 'Place your finger fully on the Touch ID sensor',
              icon: 'touch-app',
              action: 'Cover the entire sensor'
            },
            {
              id: 'angles',
              title: 'Different Angles',
              description: 'The system will ask you to lift and place your finger multiple times',
              icon: 'rotate-right',
              action: 'Follow the on-screen prompts'
            }
          ]
        };
      case 'fingerprint':
        return {
          title: 'Set Up Fingerprint',
          description: 'Use your fingerprint to securely sign in to your account',
          icon: 'fingerprint',
          setupSteps: [
            {
              id: 'clean',
              title: 'Clean Your Finger',
              description: 'Make sure your finger and the fingerprint sensor are clean and dry',
              icon: 'cleaning-services',
              action: 'Clean finger and sensor'
            },
            {
              id: 'placement',
              title: 'Finger Placement',
              description: 'Place your finger on the fingerprint sensor when prompted',
              icon: 'touch-app',
              action: 'Follow sensor prompts'
            },
            {
              id: 'completion',
              title: 'Complete Setup',
              description: 'Follow the on-screen instructions to complete fingerprint enrollment',
              icon: 'done',
              action: 'Complete enrollment'
            }
          ]
        };
      default:
        return null;
    }
  };

  const biometricDetails = getBiometricDetails();

  const handleSetup = async () => {
    if (!biometricAvailability?.isAvailable) {
      setSetupError('Biometric authentication is not available on this device');
      setCurrentStep('error');
      return;
    }

    setIsSettingUp(true);
    setSetupError(null);
    
    try {
      const result = await onSetup();
      
      if (result.success) {
        setCurrentStep('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Success animation
        Animated.spring(successAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }).start();
        
        // Auto close after success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setSetupError(getIntelligentErrorMessage(result.error || 'Setup failed'));
        setCurrentStep('error');
        setRetryCount(prev => prev + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
      setSetupError('An unexpected error occurred during setup');
      setCurrentStep('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSettingUp(false);
    }
  };

  const getIntelligentErrorMessage = (error: string): string => {
    const errorLower = error.toLowerCase();
    
    // Face ID specific intelligent prompts
    if (biometricAvailability?.biometricType === 'faceId') {
      if (errorLower.includes('lighting') || errorLower.includes('dark') || errorLower.includes('light')) {
        return 'Lighting Issue Detected\n\n• Move to a well-lit area\n• Avoid backlighting (don\'t sit in front of bright windows)\n• Make sure light is evenly distributed on your face';
      }
      
      if (errorLower.includes('face') || errorLower.includes('position') || errorLower.includes('angle')) {
        return 'Face Position Issue\n\n• Hold your device at arm\'s length\n• Look directly at the front camera\n• Keep your entire face visible in the frame\n• Don\'t tilt your head too much';
      }
      
      if (errorLower.includes('covered') || errorLower.includes('obstruct')) {
        return 'Face Visibility Issue\n\n• Remove sunglasses, masks, or hats if wearing them\n• Make sure nothing is covering your face\n• Ensure your face is clearly visible';
      }
      
      if (errorLower.includes('move') || errorLower.includes('still') || errorLower.includes('motion')) {
        return 'Movement Detected\n\n• Hold your device steady\n• Keep your head still during setup\n• Don\'t move around during the process';
      }
      
      if (errorLower.includes('multiple') || errorLower.includes('retry') || retryCount > 1) {
        return 'Multiple Attempts Detected\n\n• Take a break and try again in better conditions\n• Ensure optimal lighting and positioning\n• Consider setting up fingerprint instead if available';
      }
    }
    
    // Touch ID / Fingerprint specific prompts
    if (biometricAvailability?.biometricType === 'touchId' || biometricAvailability?.biometricType === 'fingerprint') {
      if (errorLower.includes('clean') || errorLower.includes('dry') || errorLower.includes('moisture')) {
        return 'Sensor Cleanliness Issue\n\n• Clean the sensor with a soft, dry cloth\n• Make sure your finger is clean and dry\n• Remove any lotion or moisture from your finger';
      }
      
      if (errorLower.includes('placement') || errorLower.includes('position') || errorLower.includes('coverage')) {
        return 'Finger Placement Issue\n\n• Place your finger fully on the sensor\n• Don\'t press too hard or too lightly\n• Make sure you\'re covering the entire sensor area';
      }
    }
    
    // Generic prompts
    if (errorLower.includes('cancel') || errorLower.includes('user')) {
      return 'Setup was cancelled. You can always set up biometric authentication later from Settings.';
    }
    
    if (errorLower.includes('hardware') || errorLower.includes('not available')) {
      return 'Biometric hardware is currently unavailable. Please try again later or contact support if the issue persists.';
    }
    
    // Default error with helpful suggestion
    return `${error}\n\nTip: Make sure your device conditions are optimal and try again. You can also set this up later from Settings.`;
  };

  const handleRetry = () => {
    if (retryCount >= 3) {
      // After 3 retries, suggest alternative or skip
      setCurrentStep('intro');
      setRetryCount(0);
    } else {
      setCurrentStep('guide');
      setSetupError(null);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
    onClose();
  };

  const renderIntroContent = () => (
    <View style={styles.content}>
      <View style={styles.iconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: colors.tintPrimary }]}>
          <MaterialIcons 
            name={biometricDetails?.icon as any || 'security'} 
            size={48} 
            color="#FFFFFF" 
          />
        </View>
      </View>
      
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {biometricDetails?.title || 'Set Up Biometric Authentication'}
      </Text>
      
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {biometricDetails?.description || 'Secure your account with biometric authentication'}
      </Text>
      
      <View style={styles.benefits}>
        <View style={styles.benefit}>
          <MaterialIcons name="speed" size={20} color={colors.tintPrimary} />
          <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
            Quick and secure sign-in
          </Text>
        </View>
        <View style={styles.benefit}>
          <MaterialIcons name="security" size={20} color={colors.tintPrimary} />
          <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
            Enhanced account security
          </Text>
        </View>
        <View style={styles.benefit}>
          <MaterialIcons name="phone-android" size={20} color={colors.tintPrimary} />
          <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
            Works with your device's built-in security
          </Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.skipButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleSkip}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
        
        <LinearGradient
          colors={[colors.tintPrimary, colors.tintPrimary + '90']}
          style={styles.setupButton}
        >
          <TouchableOpacity
            style={styles.setupButtonInner}
            onPress={() => setCurrentStep('guide')}
          >
            <Text style={styles.setupButtonText}>Continue</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  const renderGuideContent = () => (
    <View style={styles.content}>
      <View style={styles.guideHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep('intro')}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
          Setup Guide
        </Text>
      </View>
      
      <Text style={[styles.guideDescription, { color: colors.textSecondary }]}>
        Follow these steps for the best setup experience:
      </Text>
      
      <View style={styles.steps}>
        {biometricDetails?.setupSteps.map((step: SetupGuideStep, index: number) => (
          <View key={step.id} style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.tintPrimary }]}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepContent}>
              <View style={styles.stepHeader}>
                <MaterialIcons name={step.icon as any} size={20} color={colors.tintPrimary} />
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                  {step.title}
                </Text>
              </View>
              <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                {step.description}
              </Text>
              {step.action && (
                <Text style={[styles.stepAction, { color: colors.tintPrimary }]}>
                  → {step.action}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
      
      <View style={styles.actions}>
        <LinearGradient
          colors={[colors.tintPrimary, colors.tintPrimary + '90']}
          style={[styles.setupButton, { width: '100%' }]}
        >
          <TouchableOpacity
            style={styles.setupButtonInner}
            onPress={handleSetup}
            disabled={isSettingUp}
          >
            <Text style={styles.setupButtonText}>
              {isSettingUp ? 'Setting Up...' : 'Start Setup'}
            </Text>
            {!isSettingUp && (
              <MaterialIcons name="security" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  const renderSetupContent = () => (
    <View style={styles.content}>
      <View style={styles.setupProgress}>
        <Text style={[styles.setupTitle, { color: colors.textPrimary }]}>
          Setting up biometric authentication...
        </Text>
        <Text style={[styles.setupDescription, { color: colors.textSecondary }]}>
          Follow the prompts on your device
        </Text>
      </View>
    </View>
  );

  const renderSuccessContent = () => (
    <Animated.View 
      style={[
        styles.content,
        styles.successContent,
        { transform: [{ scale: successAnim }] }
      ]}
    >
      <View style={[styles.successIcon, { backgroundColor: colors.positive }]}>
        <MaterialIcons name="check" size={48} color="#FFFFFF" />
      </View>
      
      <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
        Setup Complete!
      </Text>
      
      <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
        Biometric authentication has been enabled for your account
      </Text>
    </Animated.View>
  );

  const renderErrorContent = () => (
    <View style={styles.content}>
      <View style={[styles.errorIcon, { backgroundColor: colors.destructive }]}>
        <MaterialIcons name="error-outline" size={48} color="#FFFFFF" />
      </View>
      
      <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
        Setup Failed
      </Text>
      
      <Text style={[styles.errorDescription, { color: colors.textSecondary }]}>
        {setupError}
      </Text>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.skipButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleSkip}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            {retryCount >= 3 ? 'Set up later' : 'Skip for now'}
          </Text>
        </TouchableOpacity>
        
        <LinearGradient
          colors={[colors.tintPrimary, colors.tintPrimary + '90']}
          style={styles.setupButton}
        >
          <TouchableOpacity
            style={styles.setupButtonInner}
            onPress={handleRetry}
          >
            <Text style={styles.setupButtonText}>
              {retryCount >= 3 ? 'Start Over' : 'Try Again'}
            </Text>
            <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'intro':
        return renderIntroContent();
      case 'guide':
        return renderGuideContent();
      case 'setup':
        return renderSetupContent();
      case 'success':
        return renderSuccessContent();
      case 'error':
        return renderErrorContent();
      default:
        return renderIntroContent();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.5)" />
      
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: fadeAnim }
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={50} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        )}
      </Animated.View>
      
      <Animated.View
        style={[
          styles.modal,
          {
            backgroundColor: colors.background,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ],
          }
        ]}
      >
        {currentStep !== 'success' && currentStep !== 'setup' && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <MaterialIcons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        
        {renderCurrentStep()}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
    paddingTop: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 32,
  },
  
  // Intro styles
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  benefits: {
    marginBottom: 40,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitText: {
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
  },
  
  // Guide styles
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  guideTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  guideDescription: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  steps: {
    marginBottom: 32,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  stepAction: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Setup styles
  setupProgress: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  setupDescription: {
    fontSize: 16,
    textAlign: 'center',
  },
  
  // Success styles
  successContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Error styles
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 32,
    textAlign: 'left',
  },
  
  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  setupButton: {
    flex: 1,
    borderRadius: 16,
  },
  setupButtonInner: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
});

export default BiometricSetupModal;