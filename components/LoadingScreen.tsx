/**
 * LoadingScreen Component
 * 
 * A beautiful animated loading screen for app startup and authentication transitions.
 * Features banking-themed animations with smooth transitions and proper theming support.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { withAlpha } from '@/theme/color-utils';

interface LoadingScreenProps {
  message?: string;
  subtitle?: string;
  variant?: 'startup' | 'auth' | 'transition' | 'deposit' | 'transfer' | 'payment' | 'card-creation' | 'processing';
  showIcon?: boolean;
  action?: string; // Additional context for the action being performed
}

export function LoadingScreen({ 
  message = "Loading...", 
  subtitle = "Please wait while we prepare everything for you",
  variant = 'startup',
  showIcon = true,
  action
}: LoadingScreenProps) {
  const { colors } = useTheme();
  const { width } = Dimensions.get('window');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  
  // Dots animation for loading text
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous rotation animation for icon
    const rotationAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    // Pulse animation for icon
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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

    // Shimmer animation for background
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Loading dots animation
    const dotsAnimation = () => {
      const createDotAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(800), // Wait for other dots
          ])
        );
      };

      Animated.parallel([
        createDotAnimation(dot1Anim, 0),
        createDotAnimation(dot2Anim, 200),
        createDotAnimation(dot3Anim, 400),
      ]).start();
    };

    // Start animations
    if (variant === 'startup' || variant === 'auth') {
      rotationAnimation.start();
      shimmerAnimation.start();
    } else if (variant === 'deposit' || variant === 'transfer' || variant === 'payment' || variant === 'card-creation') {
      rotationAnimation.start(); // Rotate for processing actions
    } else {
      pulseAnimation.start();
    }
    
    dotsAnimation();

    // Cleanup
    return () => {
      rotationAnimation.stop();
      pulseAnimation.stop();
      shimmerAnimation.stop();
    };
  }, [variant]);

  const getIconName = () => {
    switch (variant) {
      case 'startup':
        return 'account-balance';
      case 'auth':
        return 'verified-user';
      case 'transition':
        return 'sync';
      case 'deposit':
        return 'account-balance-wallet';
      case 'transfer':
        return 'send';
      case 'payment':
        return 'payment';
      case 'card-creation':
        return 'credit-card';
      case 'processing':
        return 'hourglass-empty';
      default:
        return 'account-balance';
    }
  };

  const getContextualMessage = () => {
    if (message !== "Loading...") return message; // Use provided message if not default
    
    switch (variant) {
      case 'deposit':
        return action ? `Processing ${action}` : 'Processing your deposit';
      case 'transfer':
        return action ? `Processing ${action}` : 'Processing your transfer';
      case 'payment':
        return action ? `Processing ${action}` : 'Processing payment';
      case 'card-creation':
        return action ? `Creating ${action}` : 'Creating your card';
      case 'processing':
        return action ? `${action}` : 'Processing request';
      default:
        return message;
    }
  };

  const getContextualSubtitle = () => {
    if (subtitle !== "Please wait while we prepare everything for you") return subtitle; // Use provided subtitle if not default
    
    switch (variant) {
      case 'deposit':
        return 'Securing your funds and updating your account balance...';
      case 'transfer':
        return 'Transferring funds between accounts securely...';
      case 'payment':
        return 'Processing your payment with our secure system...';
      case 'card-creation':
        return 'Setting up your new card with banking features...';
      case 'processing':
        return 'This may take a moment. Please do not close the app...';
      default:
        return subtitle;
    }
  };

  const getGradientColors = () => {
    const primary = colors.tintPrimary;
    const secondary = withAlpha(primary, 0.8);
    const background = colors.background;
    
    switch (variant) {
      case 'startup':
        return [primary, secondary, background];
      case 'auth':
        return [primary, secondary, withAlpha(background, 0.9)];
      case 'transition':
        return [withAlpha(primary, 0.3), withAlpha(secondary, 0.2), background];
      case 'deposit':
      case 'transfer':
      case 'payment':
      case 'card-creation':
      case 'processing':
        return [primary, secondary, withAlpha(background, 0.9)];
      default:
        return [primary, secondary, background];
    }
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={getGradientColors()}
        locations={[0, 0.6, 1]}
        style={styles.gradient}
      >
        {/* Shimmer overlay for startup */}
        {variant === 'startup' && (
          <Animated.View
            style={[
              styles.shimmerOverlay,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          />
        )}

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon Section */}
          {showIcon && (
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: withAlpha('#FFFFFF', 0.1),
                  transform: [
                    { scale: pulseAnim },
                    ...(variant === 'startup' || variant === 'auth' || variant === 'deposit' || variant === 'transfer' || variant === 'payment' || variant === 'card-creation' ? [{ rotate }] : []),
                  ],
                },
              ]}
            >
              <View style={[styles.iconInner, { backgroundColor: withAlpha('#FFFFFF', 0.2) }]}>
                <MaterialIcons 
                  name={getIconName() as any} 
                  size={48} 
                  color="#FFFFFF" 
                />
              </View>
            </Animated.View>
          )}

          {/* Text Section */}
          <View style={styles.textContainer}>
            <View style={styles.messageContainer}>
              <Text style={[styles.message, { color: '#FFFFFF' }]}>
                {getContextualMessage()}
              </Text>
              
              {/* Animated loading dots */}
              <View style={styles.dotsContainer}>
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      opacity: dot1Anim,
                      transform: [{ scale: dot1Anim }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      opacity: dot2Anim,
                      transform: [{ scale: dot2Anim }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      opacity: dot3Anim,
                      transform: [{ scale: dot3Anim }],
                    },
                  ]}
                />
              </View>
            </View>
            
            {getContextualSubtitle() && (
              <Text style={[styles.subtitle, { color: withAlpha('#FFFFFF', 0.8) }]}>
                {getContextualSubtitle()}
              </Text>
            )}
          </View>

          {/* Progress indicator for longer loads */}
          {variant === 'startup' && (
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: withAlpha('#FFFFFF', 0.3),
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: '#FFFFFF',
                      transform: [{ translateX: shimmerTranslate }],
                    },
                  ]}
                />
              </Animated.View>
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ skewX: '-15deg' }],
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 2,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },
  progressContainer: {
    marginTop: 40,
    width: 200,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: 60,
    borderRadius: 2,
  },
});
