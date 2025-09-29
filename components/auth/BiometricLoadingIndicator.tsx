/**
 * BiometricLoadingIndicator Component
 * 
 * Specialized loading indicator for biometric operations with
 * animated icons, status messages, and progress indicators.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { BiometricType } from '@/lib/biometric/biometric.service';

const { width } = Dimensions.get('window');

interface BiometricLoadingIndicatorProps {
  visible: boolean;
  biometricType: BiometricType;
  stage: 'checking' | 'authenticating' | 'processing' | 'success' | 'error';
  message?: string;
  progress?: number; // 0-100
}

const BiometricLoadingIndicator: React.FC<BiometricLoadingIndicatorProps> = ({
  visible,
  biometricType,
  stage,
  message,
  progress = 0,
}) => {
  const { colors } = useTheme();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Animate visibility
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Animate based on stage
  useEffect(() => {
    if (!visible) return;

    switch (stage) {
      case 'checking':
        // Gentle pulse for availability checking
        const checkingPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
          ])
        );
        checkingPulse.start();
        return () => checkingPulse.stop();

      case 'authenticating':
        // Faster pulse with wave effect for active authentication
        const authPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );

        const waveEffect = Animated.loop(
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          })
        );

        authPulse.start();
        waveEffect.start();
        return () => {
          authPulse.stop();
          waveEffect.stop();
        };

      case 'processing':
        // Rotation for processing
        const rotateAnimation = Animated.loop(
          Animated.timing(iconRotateAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          })
        );
        rotateAnimation.start();
        return () => rotateAnimation.stop();

      case 'success':
        // Success bounce
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            useNativeDriver: true,
            tension: 65,
            friction: 4,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 65,
            friction: 8,
          }),
        ]).start();
        break;

      case 'error':
        // Error shake
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
        break;
    }
  }, [stage, visible]);

  // Animate progress
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'faceId':
        return Platform.OS === 'ios' ? 'face' : 'face-recognition';
      case 'touchId':
      case 'fingerprint':
        return 'fingerprint';
      default:
        return 'security';
    }
  };

  const getStageColor = () => {
    switch (stage) {
      case 'checking':
        return colors.textSecondary;
      case 'authenticating':
        return colors.tintPrimary;
      case 'processing':
        return colors.tintPrimary;
      case 'success':
        return colors.positive;
      case 'error':
        return colors.destructive;
      default:
        return colors.textSecondary;
    }
  };

  const getDefaultMessage = () => {
    switch (stage) {
      case 'checking':
        return 'Checking biometric availability...';
      case 'authenticating':
        return biometricType === 'faceId' 
          ? 'Look at the camera' 
          : 'Touch the sensor';
      case 'processing':
        return 'Processing authentication...';
      case 'success':
        return 'Authentication successful!';
      case 'error':
        return 'Authentication failed';
      default:
        return 'Please wait...';
    }
  };

  const iconRotation = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const waveScale = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.3, 1],
  });

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.1, 0.3],
  });

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }
      ]}
      pointerEvents="none"
    >
      <View style={[styles.backdrop, { backgroundColor: colors.background + '95' }]}>
        <View style={[styles.content, { backgroundColor: colors.card }]}>
          {/* Animated waves for authentication stage */}
          {stage === 'authenticating' && (
            <>
              <Animated.View 
                style={[
                  styles.wave,
                  styles.wave1,
                  {
                    backgroundColor: getStageColor(),
                    transform: [{ scale: waveScale }],
                    opacity: waveOpacity,
                  }
                ]}
              />
              <Animated.View 
                style={[
                  styles.wave,
                  styles.wave2,
                  {
                    backgroundColor: getStageColor(),
                    transform: [{ scale: waveScale }],
                    opacity: waveOpacity,
                  }
                ]}
              />
              <Animated.View 
                style={[
                  styles.wave,
                  styles.wave3,
                  {
                    backgroundColor: getStageColor(),
                    transform: [{ scale: waveScale }],
                    opacity: waveOpacity,
                  }
                ]}
              />
            </>
          )}

          {/* Main icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: pulseAnim },
                  { rotate: stage === 'processing' ? iconRotation : '0deg' },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[getStageColor(), getStageColor() + '80']}
              style={styles.iconGradient}
            >
              <MaterialIcons
                name={getBiometricIcon() as any}
                size={48}
                color="#FFFFFF"
              />
            </LinearGradient>
          </Animated.View>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textPrimary }]}>
            {message || getDefaultMessage()}
          </Text>

          {/* Progress bar for certain stages */}
          {(stage === 'processing' || progress > 0) && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBackground, { backgroundColor: colors.border }]}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: getStageColor(),
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Stage-specific additional elements */}
          {stage === 'authenticating' && biometricType === 'faceId' && (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Position your face in the camera view
            </Text>
          )}

          {stage === 'authenticating' && (biometricType === 'touchId' || biometricType === 'fingerprint') && (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Place your finger on the sensor
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    maxWidth: width * 0.8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  progressBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  wave: {
    position: 'absolute',
    borderRadius: 100,
  },
  wave1: {
    width: 120,
    height: 120,
    top: '50%',
    left: '50%',
    marginTop: -60,
    marginLeft: -60,
  },
  wave2: {
    width: 160,
    height: 160,
    top: '50%',
    left: '50%',
    marginTop: -80,
    marginLeft: -80,
  },
  wave3: {
    width: 200,
    height: 200,
    top: '50%',
    left: '50%',
    marginTop: -100,
    marginLeft: -100,
  },
});

export default BiometricLoadingIndicator;