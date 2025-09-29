/**
 * BiometricToast Component
 * 
 * Specialized toast notifications for biometric operations with
 * haptic feedback, icons, and smooth animations.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

const { width, height } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'center' | 'bottom';

interface BiometricToastProps {
  visible: boolean;
  type: ToastType;
  title: string;
  message?: string;
  position?: ToastPosition;
  duration?: number; // in milliseconds
  onDismiss: () => void;
  hapticFeedback?: boolean;
}

const BiometricToast: React.FC<BiometricToastProps> = ({
  visible,
  type,
  title,
  message,
  position = 'top',
  duration = 4000,
  onDismiss,
  hapticFeedback = true,
}) => {
  const { colors } = useTheme();

  // Animation values
  const translateY = useRef(new Animated.Value(position === 'bottom' ? 100 : -100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const progressWidth = useRef(new Animated.Value(100)).current;

  // Auto dismiss timer
  const dismissTimerRef = useRef<NodeJS.Timeout>();

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (position === 'top' && gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        } else if (position === 'bottom' && gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 50;
        const shouldDismiss = 
          (position === 'top' && gestureState.dy < -threshold) ||
          (position === 'bottom' && gestureState.dy > threshold);

        if (shouldDismiss) {
          hideToast();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const showToast = () => {
    // Trigger haptic feedback
    if (hapticFeedback) {
      switch (type) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    }

    // Reset progress
    progressWidth.setValue(100);

    // Show animation
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }),
    ]).start();

    // Start progress animation
    Animated.timing(progressWidth, {
      toValue: 0,
      duration: duration,
      useNativeDriver: false,
    }).start();

    // Auto dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    
    dismissTimerRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  };

  const hideToast = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'bottom' ? 100 : -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  useEffect(() => {
    if (visible) {
      showToast();
    } else {
      hideToast();
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [visible]);

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle',
          colors: [colors.positive, colors.positive + '80'],
          backgroundColor: colors.positive + '15',
          borderColor: colors.positive + '30',
        };
      case 'error':
        return {
          icon: 'error',
          colors: [colors.destructive, colors.destructive + '80'],
          backgroundColor: colors.destructive + '15',
          borderColor: colors.destructive + '30',
        };
      case 'warning':
        return {
          icon: 'warning',
          colors: [colors.warning || '#FF9500', (colors.warning || '#FF9500') + '80'],
          backgroundColor: (colors.warning || '#FF9500') + '15',
          borderColor: (colors.warning || '#FF9500') + '30',
        };
      case 'info':
        return {
          icon: 'info',
          colors: [colors.tintPrimary, colors.tintPrimary + '80'],
          backgroundColor: colors.tintPrimary + '15',
          borderColor: colors.tintPrimary + '30',
        };
      default:
        return {
          icon: 'info',
          colors: [colors.textSecondary, colors.textSecondary + '80'],
          backgroundColor: colors.textSecondary + '15',
          borderColor: colors.textSecondary + '30',
        };
    }
  };

  const getPositionStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      left: 16,
      right: 16,
      zIndex: 1000,
    };

    switch (position) {
      case 'top':
        return {
          ...baseStyle,
          top: Platform.OS === 'ios' ? 60 : 40,
        };
      case 'center':
        return {
          ...baseStyle,
          top: height / 2 - 50,
        };
      case 'bottom':
        return {
          ...baseStyle,
          bottom: Platform.OS === 'ios' ? 100 : 80,
        };
      default:
        return {
          ...baseStyle,
          top: Platform.OS === 'ios' ? 60 : 40,
        };
    }
  };

  const config = getToastConfig();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        getPositionStyle(),
        {
          opacity,
          transform: [
            { translateY },
            { scale },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: config.backgroundColor,
            borderColor: config.borderColor,
          },
        ]}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: config.colors[0],
                width: progressWidth.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={config.colors}
              style={styles.iconGradient}
            >
              <MaterialIcons
                name={config.icon as any}
                size={24}
                color="#FFFFFF"
              />
            </LinearGradient>
          </View>

          {/* Text content */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {title}
            </Text>
            {message && (
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </Text>
            )}
          </View>

          {/* Dismiss indicator */}
          <View style={styles.dismissIndicator}>
            <MaterialIcons
              name="drag-handle"
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 20,
  },
  message: {
    fontSize: 14,
    lineHeight: 18,
  },
  dismissIndicator: {
    opacity: 0.5,
  },
});

export default BiometricToast;