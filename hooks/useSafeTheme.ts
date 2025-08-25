import { useTheme, type Theme } from '@/context/ThemeContext';

// Fallback theme for when ThemeContext is not available
const fallbackTheme: Theme = {
  isDark: false,
  colors: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    textPrimary: '#111827',
    textSecondary: '#374151',
    border: '#E5E7EB',
    tintPrimary: '#0F766E',
    positive: '#10B981',
    negative: '#EF4444',
    warning: '#F59E0B',
    errorBg: '#FEE2E2',
    successBg: '#ECFDF5',
    warningBg: '#FFFBEB',
    tintSoftBg: '#E6FFFA',
  },
  setDarkMode: () => {
    console.warn('ThemeContext not available - cannot toggle dark mode');
  },
};

/**
 * Safely use the theme context with a fallback when the provider is not available
 * This prevents the "useTheme must be used within ThemeProvider" error
 */
export function useSafeTheme(): Theme {
  try {
    return useTheme();
  } catch (error) {
    console.warn('ThemeContext not available, using fallback theme:', error);
    return fallbackTheme;
  }
}
