import React, { createContext, useContext, useMemo, useState } from 'react';
import { ColorSchemeName } from 'react-native';

export type Theme = {
  isDark: boolean;
  colors: {
    background: string;
    card: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    tintPrimary: string;
    errorBg: string;
    successBg: string;
    warningBg: string;
  };
  setDarkMode: (value: boolean) => void;
};

const ThemeContext = createContext<Theme | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  const colors = useMemo(
    () => ({
      background: isDark ? '#121212' : '#F8FAFC',
      card: isDark ? '#1E1E1E' : '#FFFFFF',
      textPrimary: isDark ? '#F3F4F6' : '#111827',
      textSecondary: isDark ? '#C7CBD1' : '#374151',
      border: isDark ? '#2A2E35' : '#E5E7EB',
      tintPrimary: '#0F766E',
      errorBg: isDark ? '#2A1515' : '#FEE2E2',
      successBg: isDark ? '#0F2A21' : '#ECFDF5',
      warningBg: isDark ? '#2A2312' : '#FFFBEB',
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
