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

const { width } = Dimensions.get("window");

const onboardingData = [
  {
    id: 1,
    title: "Secure Banking",
    subtitle: "Your money is protected with bank-level security and encryption",
    icon: <Shield color="#0F766E" size={80} />,
  },
  {
    id: 2,
    title: "Easy Transfers",
    subtitle: "Send money to friends and family instantly with just a few taps",
    icon: <CreditCard color="#0F766E" size={80} />,
  },
  {
    id: 3,
    title: "Mobile First",
    subtitle: "Manage your finances on the go with our intuitive mobile app",
    icon: <Smartphone color="#0F766E" size={80} />,
  },
];

export default function OnboardingScreen() {
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
      console.error("Error saving onboarding state:", error);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const currentData = onboardingData[currentIndex];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconContainer}>{currentData.icon}</View>

        <Text style={styles.title}>{currentData.title}</Text>
        <Text style={styles.subtitle}>{currentData.subtitle}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {onboardingData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === onboardingData.length - 1
              ? "Get Started"
              : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
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
    color: "#6B7280",
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
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
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
    backgroundColor: "#D1D5DB",
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: "#0F766E",
    width: 24,
  },
  nextButton: {
    backgroundColor: "#0F766E",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    minWidth: width - 48,
    alignItems: "center",
  },
  nextButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
