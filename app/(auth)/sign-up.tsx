import { useAlert } from "@/context/AlertContext";
import { createUser } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function SignUpScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const { login } = useAuthStore();
  const { showAlert } = useAlert();

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password strength validation
  const validatePassword = (
    password: string
  ): { isValid: boolean; message: string } => {
    if (password.length < 8) {
      return {
        isValid: false,
        message: "Password must be at least 8 characters long",
      };
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      return {
        isValid: false,
        message: "Password must contain at least one number",
      };
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        message: "Password must contain at least one uppercase letter",
      };
    }

    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>=-]/.test(password)) {
      return {
        isValid: false,
        message: "Password must contain at least one special character",
      };
    }

    return { isValid: true, message: "" };
  };

  const submit = async () => {
    const { name, email, password } = form;

    // Check if fields are empty
    if (!name || !email || !password) {
      showAlert("error", "Please fill in all fields", "Sign Up Error");
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      showAlert("error", "Please enter a valid email address", "Sign Up Error");
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      showAlert("error", passwordValidation.message, "Password Requirements");
      return;
    }

    // Validate name (at least 2 characters)
    if (name.trim().length < 2) {
      showAlert(
        "error",
        "Name must be at least 2 characters long",
        "Sign Up Error"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await createUser({ email, name, password });

      // login
      await login(email, password);

      // Show success message before navigation
      showAlert(
        "success",
        "Your account has been created successfully.",
        "Welcome!"
      );

      // Navigate after a short delay to allow the user to see the alert
      setTimeout(() => {
        router.replace("/onboarding");
      }, 500);
    } catch (error: any) {
      // Handle specific error types with more descriptive messages
      let errorMessage = "Failed to create account. Please try again.";
      let errorTitle = "Sign Up Error";

      if (error.message) {
        if (error.message.includes("email already exists")) {
          errorMessage =
            "An account with this email already exists. Please use a different email or sign in.";
          errorTitle = "Email Already Registered";
        } else if (error.message.includes("invalid email")) {
          errorMessage =
            "The email address format is invalid. Please check and try again.";
        } else if (error.message.includes("password")) {
          errorMessage =
            "The password does not meet security requirements. Please try a different password.";
          errorTitle = "Password Error";
        } else if (error.message.includes("network")) {
          errorMessage =
            "Network error. Please check your internet connection and try again.";
          errorTitle = "Connection Error";
        } else {
          // Use the original error message if it's available
          errorMessage = error.message;
        }
      }

      showAlert("error", errorMessage, errorTitle);
      console.log("Sign up error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us today</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, name: text }))
                }
                placeholder="Enter your full name"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, email: text }))
                }
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, password: text }))
                }
                placeholder="Create a password"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={submit}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/sign-in" style={styles.link}>
                <Text style={styles.linkText}>Sign In</Text>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F766E",
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  form: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
  },
  button: {
    backgroundColor: "#0F766E",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#6B7280",
    fontSize: 14,
  },
  link: {
    marginLeft: 4,
  },
  linkText: {
    color: "#0F766E",
    fontSize: 14,
    fontWeight: "600",
  },
});
