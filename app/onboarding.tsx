import { logger } from '@/lib/logger';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { CreditCard, Shield, Smartphone } from "lucide-react-native";
import React, { useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import CustomButton from "@/components/CustomButton";

const { width } = Dimensions.get("window");

export default function OnboardingScreen() {
  const { colors } = useTheme();

  const onboardingData = [
    {
      id: 1,
      title: "Secure Banking",
      subtitle: "Your money is protected with bank-level security and encryption",
      icon: <Shield color={colors.tintPrimary} size={80} />,
    },
    {
      id: 2,
      title: "Easy Transfers",
      subtitle: "Send money to friends and family instantly with just a few taps",
      icon: <CreditCard color={colors.tintPrimary} size={80} />,
    },
    {
      id: 3,
      title: "Mobile First",
      subtitle: "Manage your finances on the go with our intuitive mobile app",
      icon: <Smartphone color={colors.tintPrimary} size={80} />,
    },
  ];
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem("onboardingComplete", "true");
      router.replace("/(tabs)");
    } catch (error) {
      logger.error('SCREEN', "Error saving onboarding state:", error);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const currentData = onboardingData[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconContainer}>{currentData.icon}</View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{currentData.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{currentData.subtitle}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {onboardingData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                { backgroundColor: index === currentIndex ? colors.tintPrimary : colors.border },
                index === currentIndex ? { width: 24 } : null,
              ]}
            />
          ))}
        </View>

        <CustomButton
          title={currentIndex === onboardingData.length - 1 ? "Get Started" : "Next"}
          variant="primary"
          size="lg"
          onPress={handleNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  skipButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    alignItems: "center",
  },
  pagination: {
    flexDirection: "row",
    marginBottom: 32,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  // Unused styles removed - CustomButton handles styling
});
