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
import { Alert } from "@/components/Alert";
import { ThemeProvider } from "@/context/ThemeContext";
import { initializeErrorSuppression } from "@/config/errorSuppression";

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
      console.log('[RootLayout] Onboarding status checked:', onboardingStatus === "true");
    } catch (error) {
      console.warn('[RootLayout] Failed to check onboarding status:', error);
      setOnboardingComplete(false);
    }
  };

  // Check onboarding status when user authentication changes
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[RootLayout] User authenticated, checking onboarding status');
      checkOnboardingStatus();
    } else if (!isAuthenticated) {
      // Reset onboarding status when user logs out
      console.log('[RootLayout] User not authenticated, resetting onboarding status');
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
    console.log('[RootLayout] Loading or providers not ready, showing loading state');
    return null;
  }
  
  // If user is authenticated but onboarding status is still loading, wait
  if (isAuthenticated && onboardingComplete === null) {
    console.log('[RootLayout] User authenticated but onboarding status loading, waiting...');
    return null;
  }
  
  console.log('[RootLayout] Rendering navigation stack:', {
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
