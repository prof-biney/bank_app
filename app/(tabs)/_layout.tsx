import { logger } from '@/lib/logger';
import useAuthStore from "@/store/auth.store";
import { Redirect, Tabs } from "expo-router";
import { Activity, CreditCard, House, User, Wallet } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStore();
  const { colors } = useTheme();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingStatus();
    }
  }, [isAuthenticated]);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingStatus = await AsyncStorage.getItem("onboardingComplete");
      setOnboardingComplete(onboardingStatus === "true");
      logger.info('SCREEN', '[TabLayout] Onboarding status:', onboardingStatus === "true");
    } catch (error) {
      logger.warn('SCREEN', '[TabLayout] Failed to check onboarding status:', error);
      setOnboardingComplete(false);
    }
  };

  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;
  
  // If onboarding status is still being checked, don't redirect yet
  if (onboardingComplete === null) {
    logger.info('SCREEN', '[TabLayout] Onboarding status still loading, waiting...');
    return (
      <LoadingScreen 
        variant="transition"
        message="Preparing your dashboard"
        subtitle="Loading your financial overview..."
      />
    );
  }
  
  // If user is authenticated but hasn't completed onboarding, redirect to onboarding
  if (isAuthenticated && !onboardingComplete) {
    logger.info('SCREEN', '[TabLayout] User authenticated but onboarding not complete, redirecting to onboarding');
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 1,
          borderTopColor: colors.tabBarBorder,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          shadowColor: colors.shadowColor,
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.tintPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ size, color }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: "Cards",
          tabBarIcon: ({ size, color }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ size, color }) => (
            <Activity size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarIcon: ({ size, color }) => (
            <Wallet size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
