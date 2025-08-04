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
// import { useAuth } from "../../context/AuthContext";
import useAuthStore from "@/store/auth.store";
import { useAlert } from "@/context/AlertContext";

export default function SignInScreen() {
  // const [email, setEmail] = useState("");
  // const [password, setPassword] = useState("");
  // const [isLoading, setIsLoading] = useState(false);
  // const { signIn } = useAuth();

  const { login } = useAuthStore();
  const { showAlert } = useAlert();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const submit = async () => {
    const { email, password } = form;

    // Check if fields are empty
    if (!email || !password) {
      showAlert('error', 'Please fill in all fields', 'Sign In Error');
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      showAlert('error', 'Please enter a valid email address', 'Sign In Error');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);

      // Show success message before navigation
      showAlert('success', 'You have successfully signed in.', 'Welcome Back');
      
      // Navigate after a short delay to allow the user to see the alert
      setTimeout(() => {
        router.replace("/");
      }, 1000);
    } catch (error: any) {
      // Handle specific error types with more descriptive messages
      let errorMessage = 'Authentication failed. Please try again.';
      let errorTitle = 'Sign In Error';
      
      if (error.message) {
        if (error.message.includes('Invalid credentials')) {
          errorMessage = 'The email or password you entered is incorrect. Please try again.';
        } else if (error.message.includes('Rate limit')) {
          errorMessage = 'Too many login attempts. Please try again later.';
          errorTitle = 'Rate Limit Exceeded';
        } else if (error.message.includes('User not found')) {
          errorMessage = 'No account found with this email. Please check your email or sign up.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
          errorTitle = 'Connection Error';
        } else {
          // Use the original error message if it's available
          errorMessage = error.message;
        }
      }
      
      showAlert('error', errorMessage, errorTitle);
      console.log('Sign in error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleSignIn = async () => {
  //   if (!email || !password) {
  //     Alert.alert("Error", "Please fill in all fields");
  //     return;
  //   }

  //   setIsLoading(true);
  //   const success = await signIn(email, password);
  //   setIsLoading(false);

  //   if (success) {
  //     router.replace("/(tabs)");
  //   } else {
  //     Alert.alert("Error", "Invalid credentials");
  //   }
  // };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <View style={styles.form}>
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
                placeholder="Enter your password"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={submit}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Text>
            </TouchableOpacity>

            {/* <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.buttonText}>Go Home</Text>
            </TouchableOpacity> */}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don&apos;t have an account?{" "}
              </Text>
              <Link href="/(auth)/sign-up" style={styles.link}>
                <Text style={styles.linkText}>Sign Up</Text>
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
