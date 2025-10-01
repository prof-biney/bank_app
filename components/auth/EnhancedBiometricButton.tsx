/**
 * EnhancedBiometricButton Component
 * 
 * Improved biometric authentication button with enhanced animations,
 * loading states, haptic feedback, and platform-specific styling.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { BiometricType } from '@/lib/biometric/biometric.service';

const { width } = Dimensions.get('window');

type ButtonState = 'idle' | 'loading' | 'authenticating' | 'success' | 'error';

interface EnhancedBiometricButtonProps {
  biometricType: BiometricType;
  onPress: () => void;
  state?: ButtonState;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
  showLabel?: boolean;
  customLabel?: string;
  hapticFeedback?: boolean;
}

const EnhancedBiometricButton: React.FC<EnhancedBiometricButtonProps> = ({
  biometricType,
  onPress,
  state = 'idle',
  disabled = false,
  size = 'medium',
  variant = 'primary',
  showLabel = true,
  customLabel,
  hapticFeedback = true,
}) => {
  const { colors } = useTheme();
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  // Local state for press animation
  const [isPressed, setIsPressed] = useState(false);

  // Button dimensions based on size
  const getDimensions = () => {
    switch (size) {
      case 'small':
        return { buttonSize: 48, iconSize: 20, fontSize: 12 };
      case 'medium':
        return { buttonSize: 64, iconSize: 28, fontSize: 14 };
      case 'large':
        return { buttonSize: 80, iconSize: 36, fontSize: 16 };
      default:
        return { buttonSize: 64, iconSize: 28, fontSize: 14 };
    }
  };

  const dimensions = getDimensions();

  // Get biometric icon
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

  // Get button label
  const getButtonLabel = () => {
    if (customLabel) return customLabel;
    
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

  // Get state-specific styling
  const getStateConfig = () => {
    const isDisabled = disabled || state === 'loading';
    
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isDisabled 
            ? colors.backgroundSecondary 
            : state === 'success' 
              ? colors.positive 
              : state === 'error' 
                ? colors.destructive 
                : colors.tintPrimary,
          textColor: isDisabled ? colors.textSecondary : '#FFFFFF',
          borderColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: isDisabled 
            ? colors.backgroundSecondary 
            : colors.card,
          textColor: isDisabled 
            ? colors.textSecondary 
            : state === 'success' 
              ? colors.positive 
              : state === 'error' 
                ? colors.destructive 
                : colors.textPrimary,
          borderColor: isDisabled 
            ? colors.border 
            : state === 'success' 
              ? colors.positive 
              : state === 'error' 
                ? colors.destructive 
                : colors.border,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          textColor: isDisabled 
            ? colors.textSecondary 
            : state === 'success' 
              ? colors.positive 
              : state === 'error' 
                ? colors.destructive 
                : colors.tintPrimary,
          borderColor: isDisabled 
            ? colors.border 
            : state === 'success' 
              ? colors.positive 
              : state === 'error' 
                ? colors.destructive 
                : colors.tintPrimary,
        };
      default:
        return {
          backgroundColor: colors.tintPrimary,
          textColor: '#FFFFFF',
          borderColor: 'transparent',
        };
    }
  };

  // Handle animations based on state
  useEffect(() => {
    switch (state) {
      case 'loading':
        // Continuous pulse
        const loadingPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        );
        loadingPulse.start();
        return () => loadingPulse.stop();

      case 'authenticating':
        // Shimmer effect
        const shimmerAnimation = Animated.loop(
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          })
        );
        shimmerAnimation.start();

        // Progress animation
        Animated.timing(progressAnim, {
          toValue: 0.8,
          duration: 3000,
          useNativeDriver: false,
        }).start();

        return () => {
          shimmerAnimation.stop();
          progressAnim.setValue(0);
        };

      case 'success':
        // Success bounce
        Animated.sequence([
          Animated.spring(bounceAnim, {
            toValue: 1.2,
            useNativeDriver: true,
            tension: 100,
            friction: 3,
          }),
          Animated.spring(bounceAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
        ]).start();

        if (hapticFeedback) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        break;

      case 'error':
        // Error shake
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();

        if (hapticFeedback) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        break;

      case 'idle':
        // Reset all animations
        pulseAnim.setValue(1);
        shimmerAnim.setValue(-1);
        progressAnim.setValue(0);
        bounceAnim.setValue(1);
        rotateAnim.setValue(0);
        break;
    }
  }, [state, hapticFeedback]);

  const handlePress = () => {
    if (disabled || state === 'loading' || state === 'authenticating') return;

    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Press animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 6,
      }),
    ]).start();

    onPress();
  };

  const handlePressIn = () => {
    setIsPressed(true);
    if (hapticFeedback && !disabled && state === 'idle') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  const stateConfig = getStateConfig();

  // Animation interpolations
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-dimensions.buttonSize, dimensions.buttonSize],
  });

  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.pressable,
          {
            transform: [{ scale: isPressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.button,
            {
              width: dimensions.buttonSize,
              height: dimensions.buttonSize,
              borderRadius: dimensions.buttonSize / 2,
              backgroundColor: stateConfig.backgroundColor,
              borderColor: stateConfig.borderColor,
              borderWidth: variant === 'outline' ? 2 : variant === 'secondary' ? 1 : 0,
              transform: [
                { scale: scaleAnim },
                { scale: pulseAnim },
                { scale: bounceAnim },
                { rotate: rotateInterpolation },
              ],
            },
          ]}
        >
          {/* Shimmer overlay for authenticating state */}
          {state === 'authenticating' && variant === 'primary' && (
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [{ translateX: shimmerTranslateX }],
                },
              ]}
            />
          )}

          {/* Progress ring for authenticating state */}
          {state === 'authenticating' && (
            <Animated.View
              style={[
                styles.progressRing,
                {
                  width: dimensions.buttonSize + 8,
                  height: dimensions.buttonSize + 8,
                  borderRadius: (dimensions.buttonSize + 8) / 2,
                  borderColor: stateConfig.textColor,
                },
              ]}
            />
          )}

          {/* Main icon */}
          <MaterialIcons
            name={state === 'success' ? 'check' : state === 'error' ? 'close' : getBiometricIcon() as any}
            size={dimensions.iconSize}
            color={stateConfig.textColor}
          />

          {/* Loading indicator dots */}
          {state === 'loading' && (
            <View style={styles.loadingDots}>
              <View style={[styles.dot, { backgroundColor: stateConfig.textColor }]} />
              <View style={[styles.dot, { backgroundColor: stateConfig.textColor }]} />
              <View style={[styles.dot, { backgroundColor: stateConfig.textColor }]} />
            </View>
          )}
        </Animated.View>
      </Pressable>

      {/* Label */}
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              fontSize: dimensions.fontSize,
              color: stateConfig.textColor,
              marginTop: size === 'small' ? 4 : size === 'large' ? 12 : 8,
            },
          ]}
        >
          {state === 'loading' ? 'Checking...' :
           state === 'authenticating' ? 'Authenticating...' :
           state === 'success' ? 'Success!' :
           state === 'error' ? 'Try again' :
           getButtonLabel()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '30%',
  },
  progressRing: {
    position: 'absolute',
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  loadingDots: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.85, // Improved visibility while still subtle
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default EnhancedBiometricButton;