import { AppProvider } from "@/context/AppContext";
import { AlertProvider } from "@/context/AlertContext";
import { AuthProvider } from "@/context/AuthContext";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import "./global.css";
// Import URL polyfill for React Native compatibility with Appwrite SDK
import 'react-native-url-polyfill/auto';
import { Alert } from "@/components/Alert";
import { ThemeProvider } from "@/context/ThemeContext";
import { LoadingProvider } from "@/context/LoadingContext";
import { initializeErrorSuppression } from "@/config/errorSuppression";
import { BiometricToastProvider } from "@/context/BiometricToastContext";
import { SplashScreenProvider } from "@/context/SplashScreenContext";
import * as SplashScreen from 'expo-splash-screen';
import { logger } from '@/lib/logger';

// Initialize error suppression configuration
initializeErrorSuppression();

// Keep the native splash screen visible initially
SplashScreen.preventAutoHideAsync().catch((error) => {
  logger.warn('APP', 'Failed to prevent auto hide of splash screen:', error);
});

function RootLayoutContent() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="transfer" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="help-support" />
      <Stack.Screen name="deposit" />
      <Stack.Screen name="withdraw" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <View style={{ flex: 1 }}>
      <SplashScreenProvider autoHide={false}>
        <AlertProvider>
          <AuthProvider>
            <ThemeProvider>
              <BiometricToastProvider>
                <LoadingProvider>
                  <AppProvider>
                    <RootLayoutContent />
                    <Alert />
                  </AppProvider>
                </LoadingProvider>
              </BiometricToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </AlertProvider>
      </SplashScreenProvider>

      <StatusBar style="auto" />
    </View>
  );
}
