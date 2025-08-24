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

function RootLayoutContent() {
  const { isLoading, fetchAuthenticatedUser } = useAuthStore();
  // const { user, isLoading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null
  );
  const [providersReady, setProvidersReady] = useState(false);

  // useEffect(() => {
  //   checkOnboardingStatus();
  // }, []);

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

  if (isLoading || !providersReady) {
    return null;
  }

  const checkOnboardingStatus = async () => {
    try {
      const onboardingStatus = await AsyncStorage.getItem("onboardingComplete");
      setOnboardingComplete(onboardingStatus === "true");
    } catch {
      setOnboardingComplete(false);
    }
  };

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
