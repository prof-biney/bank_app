import { logger } from '@/lib/logger';
import { AppProvider } from "@/context/AppContext";
import { AlertProvider } from "@/context/AlertContext";
import { AuthProvider } from "@/context/AuthContext";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import useAuthStore from "@/store/auth.store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "./global.css";
// Import URL polyfill for React Native compatibility with Appwrite SDK
import 'react-native-url-polyfill/auto';
import { Alert } from "@/components/Alert";
import { ThemeProvider } from "@/context/ThemeContext";
import { initializeErrorSuppression } from "@/config/errorSuppression";
import { LoadingScreen } from "@/components/LoadingScreen";

// Initialize error suppression configuration
initializeErrorSuppression();

function RootLayoutContent() {
  const { isLoading, fetchAuthenticatedUser, isAuthenticated, user } = useAuthStore();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null
  );
  const [providersReady, setProvidersReady] = useState(false);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingStatus = await AsyncStorage.getItem("onboardingComplete");
      setOnboardingComplete(onboardingStatus === "true");
      logger.info('SCREEN', '[RootLayout] Onboarding status checked:', onboardingStatus === "true");
    } catch (error) {
      logger.warn('SCREEN', '[RootLayout] Failed to check onboarding status:', error);
      setOnboardingComplete(false);
    }
  };

  // Check onboarding status when user authentication changes
  useEffect(() => {
    if (isAuthenticated && user) {
      logger.info('SCREEN', '[RootLayout] User authenticated, checking onboarding status');
      checkOnboardingStatus();
    } else if (!isAuthenticated) {
      // Reset onboarding status when user logs out
      logger.info('SCREEN', '[RootLayout] User not authenticated, resetting onboarding status');
      setOnboardingComplete(null);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchAuthenticatedUser();
  }, []);

  // Ensure providers are fully initialized
  useEffect(() => {
    const timer = setTimeout(() => {
      setProvidersReady(true);
    }, 100); // Small delay to ensure all providers are mounted
    
    return () => clearTimeout(timer);
  }, []);

  // Don't render navigation stack until providers are ready and onboarding status is determined
  // This prevents navigation errors and ensures proper routing
  if (isLoading || !providersReady) {
    logger.info('SCREEN', '[RootLayout] Loading or providers not ready, showing loading state');
    return (
      <LoadingScreen 
        variant="startup"
        message="Welcome"
        subtitle="Initializing your banking experience..."
      />
    );
  }
  
  // If user is authenticated but onboarding status is still loading, wait
  if (isAuthenticated && onboardingComplete === null) {
    logger.info('SCREEN', '[RootLayout] User authenticated but onboarding status loading, waiting...');
    return (
      <LoadingScreen 
        variant="transition"
        message="Preparing your account"
        subtitle="Just a moment while we set things up..."
      />
    );
  }
  
  logger.info('SCREEN', '[RootLayout] Rendering navigation stack:', {
    isAuthenticated,
    onboardingComplete,
    providersReady
  });

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="transfer" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="help-support" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <>
      <AlertProvider>
        <AuthProvider>
          <ThemeProvider>
            <AppProvider>
              <RootLayoutContent />
              <Alert />
            </AppProvider>
          </ThemeProvider>
        </AuthProvider>
      </AlertProvider>

      <StatusBar style="dark" />
    </>
  );
}
