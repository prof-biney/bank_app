import React, { createContext, useContext, useMemo, useState } from 'react';
import { ColorSchemeName } from 'react-native';
import { withAlpha } from '@/theme/color-utils';

export type ThemeColors = {
  background: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  tintPrimary: string;
  // semantic accent tokens
  positive: string;
  negative: string;
  warning: string;
  // soft backgrounds
  errorBg: string;
  successBg: string;
  warningBg: string;
  tintSoftBg: string;
};

export type Theme = {
  isDark: boolean;
  colors: ThemeColors;
  setDarkMode: (value: boolean) => void;
};

const ThemeContext = createContext<Theme | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  const colors = useMemo<ThemeColors>(
    () => ({
      // Dark mode uses a slate/neutral palette for professional contrast and readability
      background: isDark ? '#0B1220' : '#F8FAFC',   // slate-950-ish vs light
      card:       isDark ? '#111827' : '#FFFFFF',   // slate-900 vs white
      textPrimary:   isDark ? '#E5E7EB' : '#111827', // slate-200 vs near-black
      textSecondary: isDark ? '#9CA3AF' : '#374151', // slate-400 vs slate-700
      border:     isDark ? '#1F2937' : '#E5E7EB',   // slate-800 vs slate-200
      tintPrimary: '#0F766E',                       // brand accent (teal-700)
      // Semantic accent tokens
      positive: '#10B981',
      negative: '#EF4444',
      warning:  '#F59E0B',
      // Semantic surfaces for status
      errorBg:   isDark ? '#3A1D1D' : '#FEE2E2',
      successBg: isDark ? '#102A24' : '#ECFDF5',
      warningBg: isDark ? '#2A2314' : '#FFFBEB',
      // Soft accent background for chips/pills
      tintSoftBg: isDark ? withAlpha('#0F766E', 0.24) : withAlpha('#0F766E', 0.1),
    }),
    [isDark]
  );

  const value: Theme = {
    isDark,
    colors,
    setDarkMode: setIsDark,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
