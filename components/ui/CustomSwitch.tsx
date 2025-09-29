/**
 * CustomSwitch Component
 * 
 * A professional, accessible switch component following modern UI/UX standards.
 * Features:
 * - High contrast colors for visibility in all states
 * - Proper sizing following platform guidelines (iOS: 51x31, Android: 52x32)
 * - Smooth spring animations
 * - Haptic feedback
 * - Full accessibility support
 * - Theme-aware colors with proper contrast ratios
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { withAlpha } from '@/theme/color-utils';

interface CustomSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function CustomSwitch({
  value,
  onValueChange,
  disabled = false,
  size = 'medium',
  accessible = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CustomSwitchProps) {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get size dimensions based on platform standards and size prop
  const getSizeDimensions = () => {
    // iOS HIG: 51x31 points, Android Material: 52x32 dp
    const platformBase = Platform.OS === 'ios' 
      ? { trackWidth: 51, trackHeight: 31, thumbSize: 27 }
      : { trackWidth: 52, trackHeight: 32, thumbSize: 28 };
    
    switch (size) {
      case 'small':
        return {
          trackWidth: Math.round(platformBase.trackWidth * 0.8),
          trackHeight: Math.round(platformBase.trackHeight * 0.8),
          thumbSize: Math.round(platformBase.thumbSize * 0.8),
          thumbMargin: 2,
        };
      case 'large':
        return {
          trackWidth: Math.round(platformBase.trackWidth * 1.2),
          trackHeight: Math.round(platformBase.trackHeight * 1.2),
          thumbSize: Math.round(platformBase.thumbSize * 1.2),
          thumbMargin: 2,
        };
      default: // medium
        return {
          trackWidth: platformBase.trackWidth,
          trackHeight: platformBase.trackHeight,
          thumbSize: platformBase.thumbSize,
          thumbMargin: 2,
        };
    }
  };

  const dimensions = getSizeDimensions();

  // Animate to new state when value changes
  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  }, [value, animatedValue]);

  // Handle press with haptic feedback and animations
  const handlePress = () => {
    if (disabled) return;

    // Press animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
    ]).start();

    // Haptic feedback on iOS
    if (Platform.OS === 'ios') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        // Haptics not available, continue without feedback
      }
    }

    // Call the change handler
    onValueChange(!value);
  };

  // Professional color scheme following Material Design and iOS HIG
  const getTrackColors = () => {
    if (disabled) {
      return {
        off: withAlpha(colors.textSecondary, 0.12), // Subtle disabled state
        on: withAlpha(colors.tintPrimary, 0.38),    // Recognizable but muted
      };
    }
    
    return {
      off: colors.border,                          // Clear inactive state
      on: colors.tintPrimary,                     // Strong active state
    };
  };
  
  const trackColors = getTrackColors();
  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [trackColors.off, trackColors.on],
  });
  
  // Track border for better definition (following Material Design 3)
  const trackBorderColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      disabled ? 'transparent' : colors.borderSecondary,
      disabled ? 'transparent' : 'transparent',
    ],
  });

  // Calculate thumb position with proper margins
  const thumbTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      dimensions.thumbMargin,
      dimensions.trackWidth - dimensions.thumbSize - dimensions.thumbMargin,
    ],
  });

  // Professional thumb colors with high contrast
  const getThumbColors = () => {
    if (disabled) {
      return {
        off: colors.surface,
        on: '#FFFFFF',
      };
    }
    
    return {
      off: '#FFFFFF',                             // Always white for contrast
      on: '#FFFFFF',                             // Always white for contrast
    };
  };
  
  const thumbColors = getThumbColors();
  const thumbColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [thumbColors.off, thumbColors.on],
  });

  // Enhanced shadow system
  const thumbShadow = {
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: Platform.OS === 'ios' ? 2 : 1,
    },
    shadowOpacity: disabled ? 0.1 : (Platform.OS === 'ios' ? 0.3 : 0.2),
    shadowRadius: Platform.OS === 'ios' ? 4 : 2,
    elevation: Platform.OS === 'android' ? (disabled ? 1 : 3) : 0,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      accessible={accessible}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[
        styles.container,
        {
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: dimensions.trackWidth,
            height: dimensions.trackHeight,
            borderRadius: dimensions.trackHeight / 2,
            backgroundColor: trackColor,
            borderWidth: Platform.OS === 'android' ? 1 : 0,
            borderColor: trackBorderColor,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: dimensions.thumbSize,
              height: dimensions.thumbSize,
              borderRadius: dimensions.thumbSize / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX: thumbTranslateX }],
              ...thumbShadow,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    // Minimum touch target size following accessibility guidelines
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  track: {
    justifyContent: 'center',
    position: 'relative',
    // Ensure track has good contrast outline
    ...Platform.select({
      ios: {
        // iOS doesn't typically use borders on switches
      },
      android: {
        // Android Material Design uses subtle borders
      },
    }),
  },
  thumb: {
    position: 'absolute',
    // Professional elevation/shadow system
    // Shadow properties are now handled in the thumbShadow object
    // for better control and platform-specific styling
  },
});
