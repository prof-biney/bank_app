import { Link, router } from "expo-router";
import React, { useState, useEffect } from "react";
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
import { Feather, MaterialIcons } from "@expo/vector-icons";
// Import reusable form components
import { 
  EmailField, 
  PasswordField,
  ValidationState
} from "@/components/form";

export default function SignInScreen() {
  // const [email, setEmail] = useState("");
  // const [password, setPassword] = useState("");
  // const [isLoading, setIsLoading] = useState(false);
  // const { signIn } = useAuth();

  const { login } = useAuthStore();
  const { showAlert } = useAlert();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  // Validation states
  const [validation, setValidation] = useState({
    email: { isValid: false, isTouched: false, errorMessage: "" },
    password: { isValid: false, isTouched: false, errorMessage: "" },
  });

  // Email validation function with enhanced regex
  const isValidEmail = (email: string): { isValid: boolean; message: string } => {
    // More comprehensive email regex that checks for proper format
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    
    if (!email) {
      return { isValid: false, message: "Email is required" };
    }
    
    if (!emailRegex.test(email)) {
      return { isValid: false, message: "Please enter a valid email address" };
    }
    
    return { isValid: true, message: "" };
  };
  
  // Function to handle field reset
  const resetField = (field: 'email' | 'password') => {
    setForm(prev => ({ ...prev, [field]: "" }));
    // Reset validation but keep it as touched
    setValidation(prev => ({
      ...prev,
      [field]: { isValid: false, isTouched: true, errorMessage: "" }
    }));
  };
  
  // Real-time validation as user types
  useEffect(() => {
    if (validation.email.isTouched) {
      const emailValidation = isValidEmail(form.email);
      setValidation(prev => ({
        ...prev,
        email: { 
          ...prev.email, 
          isValid: emailValidation.isValid, 
          errorMessage: emailValidation.message 
        }
      }));
    }
  }, [form.email]);

  // Validate all fields and return if the form is valid
  const validateForm = (): boolean => {
    const emailValidation = isValidEmail(form.email);
    
    // Update validation state for all fields
    setValidation({
      email: { 
        isValid: emailValidation.isValid, 
        isTouched: true, 
        errorMessage: emailValidation.message 
      },
      password: { 
        isValid: !!form.password, 
        isTouched: true, 
        errorMessage: form.password ? "" : "Password is required" 
      }
    });
    
    // Form is valid if all fields are valid
    return emailValidation.isValid && !!form.password;
  };

  const submit = async () => {
    const { email, password } = form;

    // Validate all fields
    if (!validateForm()) {
      // Show alert for the first error found
      if (!validation.email.isValid) {
        showAlert('error', validation.email.errorMessage, 'Sign In Error');
        return;
      }
      if (!validation.password.isValid) {
        showAlert('error', 'Please enter your password', 'Sign In Error');
        return;
      }
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
            <EmailField
              label="Email"
              value={form.email}
              onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
              validation={validation.email as ValidationState}
              onValidationChange={(newValidation) => 
                setValidation(prev => ({
                  ...prev,
                  email: newValidation
                }))
              }
              resetField={() => resetField('email')}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <PasswordField
              label="Password"
              value={form.password}
              onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
              validation={validation.password as ValidationState}
              onValidationChange={(newValidation) => 
                setValidation(prev => ({
                  ...prev,
                  password: newValidation
                }))
              }
              resetField={() => resetField('password')}
              placeholder="Enter your password"
              enableValidation={false}
              showStrengthMeter={false}
            />

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
  inputWrapper: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    paddingRight: 40, // Space for the icons
  },
  validInput: {
    borderColor: "#10B981", // Green border for valid input
  },
  invalidInput: {
    borderColor: "#EF4444", // Red border for invalid input
  },
  resetButton: {
    position: "absolute",
    right: 31, // Moved 5px to the right from the original position (was 36)
    padding: 4,
  },
  visibilityToggle: {
    position: "absolute",
    right: 10, // Positioned to the right of the cross icon
    padding: 4,
  },
  validationIcon: {
    position: "absolute",
    right: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
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
