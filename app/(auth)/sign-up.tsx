import CustomInput from "@/components/CustomInput";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SignUp = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    const success = await SignUp(name, email, password);
    setIsLoading(false);

    if (success) {
      router.replace("/onboarding");
    } else {
      Alert.alert("Error", "Failed to create account");
    }
  };

  return (
    <SafeAreaView className="">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="">
          <View className="">
            <Text className="">Create Account</Text>
            <Text className="">Join us today</Text>
          </View>

          <View className="">
            <View className="">
              <Text className="">Full Name</Text>
              <CustomInput />
            </View>
          </View>

          <View className="">
            <Text className="">Email</Text>
            <CustomInput />
          </View>

          <View className="">
            <Text className="">Password</Text>
            <CustomInput />
          </View>

          <TouchableOpacity
            className=""
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <Text className="">
              {isLoading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          <View className="">
            <Text className="">Already have an account? </Text>
            <Link href="/sign-in" className="">
              Sign In
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUp;
