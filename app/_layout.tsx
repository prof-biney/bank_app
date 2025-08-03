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

function RootLayoutContent() {
  const { isLoading, fetchAuthenticatedUser } = useAuthStore();
  // const { user, isLoading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null
  );

  // useEffect(() => {
  //   checkOnboardingStatus();
  // }, []);

  useEffect(() => {
    fetchAuthenticatedUser();
  }, []);

  if (isLoading) {
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
          <AppProvider>
            <RootLayoutContent />
            <Alert />
          </AppProvider>
        </AuthProvider>
      </AlertProvider>

      <StatusBar style="dark" />
    </>
  );
}
