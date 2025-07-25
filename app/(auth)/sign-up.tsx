import { clsx } from "clsx";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function SignUpScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    const success = await signUp(name, email, password);
    setIsLoading(false);

    if (success) {
      router.replace("/onboarding");
    } else {
      Alert.alert("Error", "Failed to create account");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-teal-700">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-12">
            <Text className="text-4xl font-bold text-white mb-2">
              Create Account
            </Text>
            <Text className="text-base text-white/80">Join us today</Text>
          </View>

          <View className="bg-white rounded-xl p-6 shadow-md elevation-8">
            {/* Full Name */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-gray-50"
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
              />
            </View>

            {/* Email */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Email
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-gray-50"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Password
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-gray-50"
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                secureTextEntry
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className={clsx(
                "bg-teal-700 rounded-lg py-4 items-center mt-2",
                isLoading && "opacity-60"
              )}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              <Text className="text-white text-base font-semibold">
                {isLoading ? "Creating Account..." : "Create Account"}
              </Text>
            </TouchableOpacity>

            {/* Footer */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-gray-500">
                Already have an account?{" "}
              </Text>
              <Link href="/(auth)/sign-in" className="ml-1">
                <Text className="text-sm font-semibold text-teal-700">
                  Sign In
                </Text>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
