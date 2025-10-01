/**
 * LoadingAnimation Component
 * 
 * A reusable loading animation component with customizable content, messages,
 * and styling. Supports different loading states and provides consistent
 * loading UX across the application.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Modal,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { BlurView } from 'expo-blur';

export interface LoadingAnimationProps {
  /** Whether the loading animation is visible */
  visible: boolean;
  
  /** Main loading message */
  message?: string;
  
  /** Secondary/detailed message */
  subtitle?: string;
  
  /** Loading animation type */
  type?: 'spinner' | 'dots' | 'pulse' | 'bars';
  
  /** Size of the loading animation */
  size?: 'small' | 'medium' | 'large';
  
  /** Whether to show as an overlay modal */
  overlay?: boolean;
  
  /** Custom loading color */
  color?: string;
  
  /** Whether to show blur background (overlay mode) */
  blur?: boolean;
  
  /** Animation speed multiplier */
  speed?: number;
  
  /** Custom styles for the container */
  containerStyle?: any;
  
  /** Custom styles for the message text */
  messageStyle?: any;
  
  /** Custom styles for the subtitle text */
  subtitleStyle?: any;
}

const { width: screenWidth } = Dimensions.get('window');

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  visible,
  message = 'Loading...',
  subtitle,
  type = 'spinner',
  size = 'medium',
  overlay = true,
  color,
  blur = true,
  speed = 1,
  containerStyle,
  messageStyle,
  subtitleStyle,
}) => {
  const { colors } = useTheme();
  const [animatedValues] = React.useState(() => ({
    spinner: new Animated.Value(0),
    dots: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)],
    pulse: new Animated.Value(0),
    bars: [
      new Animated.Value(0),
      new Animated.Value(0),
      new Animated.Value(0),
      new Animated.Value(0),
    ],
  }));

  const loadingColor = color || colors.primary;

  // Size configurations
  const sizeConfig = {
    small: { container: 60, spinner: 24, dot: 6, bar: 16 },
    medium: { container: 80, spinner: 32, dot: 8, bar: 20 },
    large: { container: 100, spinner: 40, dot: 10, bar: 24 },
  };

  const config = sizeConfig[size];

  // Animation effects
  React.useEffect(() => {
    if (!visible) return;

    const animations: Animated.CompositeAnimation[] = [];

    switch (type) {
      case 'spinner':
        const spinnerAnimation = Animated.loop(
          Animated.timing(animatedValues.spinner, {
            toValue: 1,
            duration: 1000 / speed,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        animations.push(spinnerAnimation);
        break;

      case 'dots':
        const dotAnimations = animatedValues.dots.map((dot, index) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(index * 200 / speed),
              Animated.timing(dot, {
                toValue: 1,
                duration: 600 / speed,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(dot, {
                toValue: 0,
                duration: 600 / speed,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          )
        );
        animations.push(...dotAnimations);
        break;

      case 'pulse':
        const pulseAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(animatedValues.pulse, {
              toValue: 1,
              duration: 800 / speed,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(animatedValues.pulse, {
              toValue: 0,
              duration: 800 / speed,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        animations.push(pulseAnimation);
        break;

      case 'bars':
        const barAnimations = animatedValues.bars.map((bar, index) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(index * 150 / speed),
              Animated.timing(bar, {
                toValue: 1,
                duration: 500 / speed,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(bar, {
                toValue: 0,
                duration: 500 / speed,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          )
        );
        animations.push(...barAnimations);
        break;
    }

    animations.forEach(animation => animation.start());

    return () => {
      animations.forEach(animation => animation.stop());
      // Reset values
      animatedValues.spinner.setValue(0);
      animatedValues.dots.forEach(dot => dot.setValue(0));
      animatedValues.pulse.setValue(0);
      animatedValues.bars.forEach(bar => bar.setValue(0));
    };
  }, [visible, type, speed, animatedValues]);

  const renderSpinner = () => {
    const spin = animatedValues.spinner.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Animated.View
        style={[
          styles.spinner,
          {
            width: config.spinner,
            height: config.spinner,
            borderColor: `${loadingColor}20`,
            borderTopColor: loadingColor,
            transform: [{ rotate: spin }],
          },
        ]}
      />
    );
  };

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {animatedValues.dots.map((dot, index) => {
        const scale = dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1.2],
        });

        const opacity = dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: config.dot,
                height: config.dot,
                backgroundColor: loadingColor,
                transform: [{ scale }],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );

  const renderPulse = () => {
    const scale = animatedValues.pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1.2],
    });

    const opacity = animatedValues.pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1],
    });

    return (
      <Animated.View
        style={[
          styles.pulse,
          {
            width: config.spinner,
            height: config.spinner,
            backgroundColor: loadingColor,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  const renderBars = () => (
    <View style={styles.barsContainer}>
      {animatedValues.bars.map((bar, index) => {
        const scaleY = bar.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                width: config.bar * 0.2,
                height: config.bar,
                backgroundColor: loadingColor,
                transform: [{ scaleY }],
              },
            ]}
          />
        );
      })}
    </View>
  );

  const renderAnimation = () => {
    switch (type) {
      case 'spinner':
        return renderSpinner();
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'bars':
        return renderBars();
      default:
        return renderSpinner();
    }
  };

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: overlay ? colors.surfaceVariant : 'transparent',
          minHeight: config.container + 60,
        },
        containerStyle,
      ]}
    >
      <View style={styles.animationContainer}>
        {renderAnimation()}
      </View>
      
      {message && (
        <Text
          style={[
            styles.message,
            { color: colors.textPrimary },
            messageStyle,
          ]}
        >
          {message}
        </Text>
      )}
      
      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary },
            subtitleStyle,
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );

  if (!visible) {
    return null;
  }

  if (overlay) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          {blur ? (
            <BlurView intensity={20} style={styles.blurContainer}>
              {content}
            </BlurView>
          ) : (
            <View style={[styles.blurContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              {content}
            </View>
          )}
        </View>
      </Modal>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    maxWidth: screenWidth * 0.8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  animationContainer: {
    marginBottom: 16,
  },
  spinner: {
    borderWidth: 3,
    borderRadius: 50,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 50,
    marginHorizontal: 3,
  },
  pulse: {
    borderRadius: 50,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 24,
  },
  bar: {
    marginHorizontal: 1,
    borderRadius: 2,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default LoadingAnimation;