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

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  // const [form, setForm] = useState({
  //   email: "",
  //   password: "",
  // });

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    const success = await signIn(email, password);
    setIsLoading(false);

    if (success) {
      router.replace("/(tabs)");
    } else {
      Alert.alert("Error", "Invalid credentials");
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
            <Text className="text-white text-3xl font-bold mb-2">
              Welcome Back
            </Text>
            <Text className="text-white/80 text-base">
              Sign in to your account
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-6 shadow-lg">
            {/* <CustomInput
              placeholder="Enter your email"
              value={form.email}
              label="Email"
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, email: text }))
              }
              keyboardType="email-address"
            /> */}

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

            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Password
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-gray-50"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              className={`bg-teal-700 rounded-lg py-4 items-center mt-2 ${
                isLoading ? "opacity-60" : ""
              }`}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              <Text className="text-white text-base font-semibold">
                {isLoading ? "Signing In..." : "Sign In"}
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-gray-500">
                Don&apos;t have an account?
              </Text>
              <Link href="/(auth)/sign-up" className="ml-1">
                <Text className="text-sm font-semibold text-teal-700">
                  Sign Up
                </Text>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
