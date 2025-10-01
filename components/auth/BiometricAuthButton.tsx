/**
 * BiometricAuthButton Component
 * 
 * A comprehensive biometric authentication button with platform-specific icons,
 * animations, loading states, and error handling.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { BiometricType } from '@/lib/biometric/biometric.service';
import { createMutedColor } from '@/theme/color-utils';

const { width } = Dimensions.get('window');

interface BiometricAuthButtonProps {
  /** Type of biometric authentication */
  biometricType: BiometricType;
  /** Button press handler */
  onPress: () => void;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error state that triggers shake animation */
  hasError?: boolean;
  /** Custom button text */
  text?: string;
  /** Button size variant */
  size?: 'small' | 'medium' | 'large';
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline';
}

const BiometricAuthButton: React.FC<BiometricAuthButtonProps> = ({
  biometricType,
  onPress,
  loading = false,
  disabled = false,
  hasError = false,
  text,
  size = 'large',
  variant = 'primary',
}) => {
  const { colors } = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Get biometric icon and text
  const getBiometricDetails = () => {
    switch (biometricType) {
      case 'faceId':
        return {
          icon: Platform.OS === 'ios' ? 'face' : 'face-recognition',
          defaultText: 'Use Face ID',
          description: 'Authenticate with Face ID',
        };
      case 'touchId':
        return {
          icon: 'fingerprint',
          defaultText: 'Use Touch ID',
          description: 'Authenticate with Touch ID',
        };
      case 'fingerprint':
        return {
          icon: 'fingerprint',
          defaultText: 'Use Fingerprint',
          description: 'Authenticate with fingerprint',
        };
      default:
        return {
          icon: 'lock',
          defaultText: 'Use Biometrics',
          description: 'Authenticate with biometrics',
        };
    }
  };

  const biometricDetails = getBiometricDetails();
  const displayText = text || biometricDetails.defaultText;

  // Size configurations
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          height: 44,
          iconSize: 20,
          fontSize: 14,
          paddingHorizontal: 16,
          borderRadius: 8,
        };
      case 'medium':
        return {
          height: 48,
          iconSize: 24,
          fontSize: 16,
          paddingHorizontal: 20,
          borderRadius: 12,
        };
      case 'large':
      default:
        return {
          height: 56,
          iconSize: 28,
          fontSize: 18,
          paddingHorizontal: 24,
          borderRadius: 16,
        };
    }
  };

  const sizeConfig = getSizeConfig();

  // Get variant styles with disabled state handling
  const getVariantStyles = () => {
    const baseStyles = {
      backgroundColor: disabled ? createMutedColor(colors.tintPrimary, colors.background) : colors.tintPrimary,
      borderColor: disabled ? createMutedColor(colors.tintPrimary, colors.background) : colors.tintPrimary,
      textColor: disabled ? createMutedColor('#FFFFFF', colors.background) : '#FFFFFF',
    };

    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: disabled ? createMutedColor(colors.card, colors.background) : colors.card,
          borderColor: disabled ? createMutedColor(colors.border, colors.background) : colors.border,
          textColor: disabled ? createMutedColor(colors.textPrimary, colors.background) : colors.textPrimary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? createMutedColor(colors.tintPrimary, colors.background) : colors.tintPrimary,
          textColor: disabled ? createMutedColor(colors.tintPrimary, colors.background) : colors.tintPrimary,
        };
      case 'primary':
      default:
        return baseStyles;
    }
  };

  const variantStyles = getVariantStyles();

  // Handle press animations
  const handlePressIn = () => {
    if (disabled || loading) return;
    
    setIsPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    
    setIsPressed(false);
    
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Error shake animation
  useEffect(() => {
    if (hasError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      const shakeSequence = Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]);
      
      shakeSequence.start();
    }
  }, [hasError, shakeAnim]);

  // Loading pulse animation
  useEffect(() => {
    if (loading) {
      const pulseSequence = Animated.loop(
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
      
      pulseSequence.start();
      
      return () => {
        pulseSequence.stop();
      };
    } else {
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, pulseAnim]);

  // Disabled state animation - removed opacity change since colors handle it
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: 1, // Always full opacity - colors provide the disabled state
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [disabled, opacityAnim]);

  const animatedStyle = {
    transform: [
      { scale: scaleAnim },
      { translateX: shakeAnim },
      { scale: pulseAnim },
    ],
    opacity: opacityAnim,
  };

  const buttonStyle = [
    styles.button,
    {
      height: sizeConfig.height,
      paddingHorizontal: sizeConfig.paddingHorizontal,
      borderRadius: sizeConfig.borderRadius,
      backgroundColor: variantStyles.backgroundColor,
      borderColor: variantStyles.borderColor,
      borderWidth: variant === 'outline' ? 2 : 0,
    },
    disabled && styles.disabled,
  ];

  const iconColor = hasError 
    ? colors.destructive 
    : variantStyles.textColor;

  const textColor = hasError 
    ? colors.destructive 
    : variantStyles.textColor;

  return (
    <Animated.View style={[animatedStyle]}>
      <TouchableOpacity
        style={buttonStyle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        accessibilityLabel={biometricDetails.description}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator 
              size={sizeConfig.iconSize > 24 ? "large" : "small"} 
              color={iconColor}
              style={styles.loadingIcon}
            />
          ) : (
            <MaterialIcons
              name={biometricDetails.icon as any}
              size={sizeConfig.iconSize}
              color={iconColor}
              style={styles.icon}
            />
          )}
          <Text 
            style={[
              styles.text, 
              { 
                fontSize: sizeConfig.fontSize, 
                color: textColor,
              }
            ]}
            numberOfLines={1}
          >
            {loading ? 'Authenticating...' : displayText}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    maxWidth: width * 0.8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  loadingIcon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  disabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default BiometricAuthButton;