import React, { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { ColorSchemeName, useColorScheme, Appearance, Animated, ViewStyle } from 'react-native';
import { withAlpha } from '@/theme/color-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeColors = {
  // Core backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;
  cardSecondary: string;
  surface: string;
  surfaceSecondary: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Interactive elements
  border: string;
  borderSecondary: string;
  tintPrimary: string;
  tintSecondary: string;
  
  // Semantic colors
  positive: string;
  negative: string;
  warning: string;
  info: string;
  
  // Semantic backgrounds
  errorBg: string;
  successBg: string;
  warningBg: string;
  infoBg: string;
  tintSoftBg: string;
  
  // Overlay and modal colors
  overlay: string;
  modalBackground: string;
  
  // Input and form colors
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;
  
  // Tab bar colors
  tabBarBackground: string;
  tabBarBorder: string;
  
  // Shadow colors
  shadowColor: string;
};

export type Theme = {
  isDark: boolean;
  themeMode: ThemeMode;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  setDarkMode: (value: boolean) => void; // Legacy support
  transitionStyle: ViewStyle; // For smooth theme transitions
};

const THEME_STORAGE_KEY = '@bankapp:theme_mode';

const ThemeContext = createContext<Theme | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Determine if we should use dark mode
  const isDark = useMemo(() => {
    switch (themeMode) {
      case 'dark':
        return true;
      case 'light':
        return false;
      case 'system':
      default:
        return systemColorScheme === 'dark';
    }
  }, [themeMode, systemColorScheme]);

  // Load saved theme preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      }
    };
    loadThemePreference();
  }, []);

  // Enhanced color system with better dark mode UX - softer colors for eye comfort
  const colors = useMemo<ThemeColors>(
    () => ({
      // Core backgrounds - Soft dark colors that are easier on the eyes
      background: isDark ? '#0F0F0F' : '#FFFFFF', // Very dark gray instead of pure black
      backgroundSecondary: isDark ? '#171717' : '#F8FAFC', // Slightly lighter
      card: isDark ? '#1A1A1A' : '#FFFFFF', // Soft dark gray
      cardSecondary: isDark ? '#262626' : '#F1F5F9', // Warmer dark gray
      surface: isDark ? '#1F1F1F' : '#FFFFFF', // Comfortable dark surface
      surfaceSecondary: isDark ? '#2A2A2A' : '#F8FAFC', // Elevated surface
      
      // Text colors with comfortable contrast - not pure white to reduce glare
      textPrimary: isDark ? '#F5F5F5' : '#0F172A', // Soft white instead of pure white
      textSecondary: isDark ? '#B3B3B3' : '#475569', // Warmer gray
      textTertiary: isDark ? '#8C8C8C' : '#64748B', // Muted gray
      textInverse: isDark ? '#0F172A' : '#FFFFFF',
      
      // Interactive elements - softer borders
      border: isDark ? '#333333' : '#E2E8F0', // Lighter border for less harshness
      borderSecondary: isDark ? '#404040' : '#CBD5E1', // Secondary borders
      tintPrimary: isDark ? '#10B981' : '#0F766E', // Slightly softer teal
      tintSecondary: isDark ? '#0891B2' : '#0284C7',
      
      // Semantic colors - slightly muted for comfort
      positive: isDark ? '#10B981' : '#16A34A', // Softer green
      negative: isDark ? '#EF4444' : '#DC2626', // Softer red
      warning: isDark ? '#F59E0B' : '#D97706', // Softer amber
      info: isDark ? '#3B82F6' : '#2563EB', // Softer blue
      
      // Semantic backgrounds - darker but not harsh
      errorBg: isDark ? '#2D1B1B' : '#FEE2E2', // Warmer error background
      successBg: isDark ? '#1B2D1B' : '#DCFCE7', // Warmer success background
      warningBg: isDark ? '#2D2A1B' : '#FEF3C7', // Warmer warning background
      infoBg: isDark ? '#1B1E2D' : '#DBEAFE', // Warmer info background
      tintSoftBg: isDark ? withAlpha('#10B981', 0.12) : withAlpha('#0F766E', 0.08),
      
      // Overlay and modal colors - softer overlays
      overlay: withAlpha('#000000', isDark ? 0.7 : 0.5), // Less intense overlay
      modalBackground: isDark ? '#262626' : '#FFFFFF', // Comfortable modal background
      
      // Input and form colors - softer and more comfortable
      inputBackground: isDark ? '#262626' : '#FFFFFF', // Comfortable input background
      inputBorder: isDark ? '#404040' : '#D1D5DB', // Softer input border
      inputPlaceholder: isDark ? '#999999' : '#9CA3AF', // Better contrast placeholder
      
      // Tab bar colors - comfortable navigation
      tabBarBackground: isDark ? '#1A1A1A' : '#FFFFFF', // Softer tab bar
      tabBarBorder: isDark ? '#333333' : '#E5E7EB', // Visible but not harsh border
      
      // Shadow colors - softer shadows
      shadowColor: isDark ? '#000000' : '#000000',
    }),
    [isDark]
  );

  // Animate theme transitions
  const animateThemeTransition = () => {
    setIsTransitioning(true);
    
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0.95,
      duration: 150,
      useNativeDriver: false,
    }).start(() => {
      // Fade back in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  // Save theme preference
  const setThemeMode = async (mode: ThemeMode) => {
    // Only animate if theme is actually changing
    const newIsDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');
    const currentIsDark = isDark;
    
    if (newIsDark !== currentIsDark) {
      animateThemeTransition();
    }
    
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
      setThemeModeState(mode); // Still update state even if save fails
    }
  };

  // Legacy support for setDarkMode
  const setDarkMode = (value: boolean) => {
    setThemeMode(value ? 'dark' : 'light');
  };

  // Create transition style for smooth theme changes
  const transitionStyle: ViewStyle = {
    opacity: fadeAnim,
    transform: [
      {
        scale: fadeAnim.interpolate({
          inputRange: [0.95, 1],
          outputRange: [0.98, 1],
        }),
      },
    ],
  };

  const value: Theme = {
    isDark,
    themeMode,
    colors,
    setThemeMode,
    setDarkMode,
    transitionStyle,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
