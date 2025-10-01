/**
 * CustomSplashScreen Component
 * 
 * A sophisticated animated splash screen with progress tracking for app initialization.
 * Features smooth animations, sleek progress slider, and realistic build progress simulation.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { withAlpha } from '@/theme/color-utils';
import { useSplashScreen } from '@/context/SplashScreenContext';

interface ProgressStage {
  label: string;
  duration: number;
  targetProgress: number;
}

interface CustomSplashScreenProps {
  onComplete?: () => void;
  skipAnimation?: boolean;
  testMode?: boolean; // For faster testing
  externalProgress?: number; // Progress from external source (0-100)
  externalLabel?: string; // Label from external source
  useExternalProgress?: boolean; // Whether to use external or internal progress
}

const PROGRESS_STAGES: ProgressStage[] = [
  { label: 'Initializing app...', duration: 800, targetProgress: 15 },
  { label: 'Loading security modules...', duration: 600, targetProgress: 30 },
  { label: 'Preparing authentication...', duration: 700, targetProgress: 50 },
  { label: 'Loading banking services...', duration: 900, targetProgress: 75 },
  { label: 'Finalizing setup...', duration: 600, targetProgress: 95 },
  { label: 'Ready!', duration: 300, targetProgress: 100 },
];

export function CustomSplashScreen({ 
  onComplete, 
  skipAnimation = false, 
  testMode = false,
  useExternalProgress = true
}: CustomSplashScreenProps) {
  const { colors } = useTheme();
  const { width, height } = Dimensions.get('window');
  const splashContext = useSplashScreen();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Progress state
  const [currentStage, setCurrentStage] = useState(0);
  const [progressLabel, setProgressLabel] = useState(PROGRESS_STAGES[0].label);
  const [progress, setProgress] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  
  // Use external progress if available
  const displayProgress = useExternalProgress ? splashContext.state.progress : progress;
  const displayLabel = useExternalProgress ? splashContext.state.stage : progressLabel;
  
  // Watch for external completion
  useEffect(() => {
    if (useExternalProgress && displayProgress >= 100 && !hasCompleted) {
      setHasCompleted(true);
      
      // Small delay to show 100% before calling onComplete
      setTimeout(() => {
        onComplete?.();
      }, 800);
    }
  }, [useExternalProgress, displayProgress, onComplete, hasCompleted]);
  
  // Particle animation values (for extra visual flair)
  const particleAnims = useRef(
    Array.from({ length: 12 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    startSplashAnimation();
  }, []);

  const startSplashAnimation = async () => {
    if (skipAnimation) {
      onComplete?.();
      return;
    }

    // Start initial animations
    Animated.parallel([
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      // Scale up logo
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      // Fade in text
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Start continuous animations
    startContinuousAnimations();
    
    // Start particle animations
    startParticleAnimations();
    
    // Start progress simulation only if not using external progress
    if (!useExternalProgress) {
      await simulateProgress();
      
      // Complete splash screen
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }
  };

  const startContinuousAnimations = () => {
    // Logo rotation
    const logoRotation = Animated.loop(
      Animated.timing(logoRotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );

    // Shimmer effect
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(shimmerAnim, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // Glow effect
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    );

    logoRotation.start();
    shimmerAnimation.start();
    glowAnimation.start();
  };

  const startParticleAnimations = () => {
    const animateParticle = (index: number) => {
      const particle = particleAnims[index];
      const angle = (index / particleAnims.length) * 2 * Math.PI;
      const radius = 150 + Math.random() * 100;
      
      const sequence = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200), // Staggered start
          Animated.parallel([
            Animated.timing(particle.opacity, {
              toValue: 0.6,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(particle.translateX, {
              toValue: Math.cos(angle) * radius,
              duration: 8000,
              useNativeDriver: true,
              easing: Easing.linear,
            }),
            Animated.timing(particle.translateY, {
              toValue: Math.sin(angle) * radius,
              duration: 8000,
              useNativeDriver: true,
              easing: Easing.linear,
            }),
          ]),
          Animated.parallel([
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      
      sequence.start();
    };

    particleAnims.forEach((_, index) => animateParticle(index));
  };

  const simulateProgress = async () => {
    const stageDurations = testMode 
      ? PROGRESS_STAGES.map(stage => ({ ...stage, duration: stage.duration / 5 }))
      : PROGRESS_STAGES;

    for (let i = 0; i < stageDurations.length; i++) {
      const stage = stageDurations[i];
      
      // Update label
      setProgressLabel(stage.label);
      
      // Animate progress
      await new Promise<void>((resolve) => {
        Animated.timing(progressAnim, {
          toValue: stage.targetProgress,
          duration: stage.duration,
          useNativeDriver: false,
          easing: Easing.out(Easing.quad),
        }).start(resolve);
      });
      
      // Update state
      setCurrentStage(i + 1);
      setProgress(stage.targetProgress);
      
      // Small delay between stages
      await new Promise(resolve => setTimeout(resolve, testMode ? 50 : 100));
    }
  };

  // Interpolated values
  const logoRotate = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-width * 2, width * 2],
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  // Calculate progress width based on display progress
  const progressWidthValue = (displayProgress / 100) * (width - 80);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <LinearGradient
        colors={[
          colors.tintPrimary,
          withAlpha(colors.tintPrimary, 0.9),
          withAlpha(colors.tintPrimary, 0.7),
          colors.background,
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      >
        {/* Shimmer overlay */}
        <Animated.View
          style={[
            styles.shimmerOverlay,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />

        {/* Particles */}
        {particleAnims.map((particle, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                opacity: particle.opacity,
                transform: [
                  { translateX: particle.translateX },
                  { translateY: particle.translateY },
                  { scale: particle.scale },
                ],
              },
            ]}
          />
        ))}

        {/* Main content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo section */}
          <View style={styles.logoSection}>
            {/* Glow effect */}
            <Animated.View
              style={[
                styles.logoGlow,
                {
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            />
            
            {/* Logo container */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [
                    { rotate: logoRotate },
                    { scale: scaleAnim },
                  ],
                },
              ]}
            >
              <View style={[styles.logoInner, { backgroundColor: withAlpha('#FFFFFF', 0.2) }]}>
                <MaterialIcons 
                  name="account-balance" 
                  size={56} 
                  color="#FFFFFF" 
                />
              </View>
            </Animated.View>
          </View>

          {/* App title */}
          <Animated.View
            style={[
              styles.titleContainer,
              { opacity: textFadeAnim },
            ]}
          >
            <Text style={styles.appTitle}>BankApp</Text>
            <Text style={styles.appSubtitle}>Your Digital Banking Partner</Text>
          </Animated.View>

          {/* Progress section */}
          <Animated.View
            style={[
              styles.progressSection,
              { opacity: textFadeAnim },
            ]}
          >
            {/* Progress label */}
            <Text style={styles.progressLabel}>{displayLabel}</Text>
            
            {/* Progress bar container */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarBackground, { backgroundColor: withAlpha('#FFFFFF', 0.2) }]}>
                {/* Progress fill */}
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressWidthValue,
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                />
                
                {/* Progress shine effect */}
                <Animated.View
                  style={[
                    styles.progressShine,
                    {
                      transform: [{ translateX: shimmerTranslate }],
                    },
                  ]}
                />
              </View>
              
              {/* Progress percentage */}
              <Animated.Text style={styles.progressPercentage}>
                {Math.round(displayProgress)}%
              </Animated.Text>
            </View>
          </Animated.View>
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
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -100,
    right: -100,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 200,
    transform: [{ skewX: '-15deg' }],
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    zIndex: 1,
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  progressSection: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 20,
    minHeight: 24,
  },
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarBackground: {
    height: 6,
    width: '100%',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  progressShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 60,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 12,
    textAlign: 'center',
  },
});