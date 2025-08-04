import { useAlert } from "@/context/AlertContext";
import { createUser } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
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
import { Feather, MaterialIcons } from "@expo/vector-icons";

export default function SignUpScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  // Validation states
  const [validation, setValidation] = useState({
    name: { isValid: false, isTouched: false, errorMessage: "" },
    email: { isValid: false, isTouched: false, errorMessage: "" },
    password: { isValid: false, isTouched: false, errorMessage: "" },
  });
  const { login } = useAuthStore();
  const { showAlert } = useAlert();

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

  // Name validation function
  const validateName = (name: string): { isValid: boolean; message: string } => {
    if (!name) {
      return { isValid: false, message: "Name is required" };
    }
    
    if (name.trim().length < 2) {
      return { isValid: false, message: "Name must be at least 2 characters long" };
    }
    
    return { isValid: true, message: "" };
  };

  // Password strength validation
  const validatePassword = (
    password: string
  ): { isValid: boolean; message: string } => {
    if (!password) {
      return { isValid: false, message: "Password is required" };
    }
    
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
  
  // Real-time validation as user types
  useEffect(() => {
    if (validation.name.isTouched) {
      const nameValidation = validateName(form.name);
      setValidation(prev => ({
        ...prev,
        name: { 
          ...prev.name, 
          isValid: nameValidation.isValid, 
          errorMessage: nameValidation.message 
        }
      }));
    }
  }, [form.name]);
  
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
  
  useEffect(() => {
    if (validation.password.isTouched) {
      const passwordValidation = validatePassword(form.password);
      setValidation(prev => ({
        ...prev,
        password: { 
          ...prev.password, 
          isValid: passwordValidation.isValid, 
          errorMessage: passwordValidation.message 
        }
      }));
    }
  }, [form.password]);

  // Function to handle field reset
  const resetField = (field: 'name' | 'email' | 'password') => {
    setForm(prev => ({ ...prev, [field]: "" }));
    // Reset validation but keep it as touched
    setValidation(prev => ({
      ...prev,
      [field]: { isValid: false, isTouched: true, errorMessage: "" }
    }));
  };

  // Validate all fields and return if the form is valid
  const validateForm = (): boolean => {
    const nameValidation = validateName(form.name);
    const emailValidation = isValidEmail(form.email);
    const passwordValidation = validatePassword(form.password);
    
    // Update validation state for all fields
    setValidation({
      name: { 
        isValid: nameValidation.isValid, 
        isTouched: true, 
        errorMessage: nameValidation.message 
      },
      email: { 
        isValid: emailValidation.isValid, 
        isTouched: true, 
        errorMessage: emailValidation.message 
      },
      password: { 
        isValid: passwordValidation.isValid, 
        isTouched: true, 
        errorMessage: passwordValidation.message 
      }
    });
    
    // Form is valid if all fields are valid
    return nameValidation.isValid && emailValidation.isValid && passwordValidation.isValid;
  };

  const submit = async () => {
    const { name, email, password } = form;

    // Validate all fields
    if (!validateForm()) {
      // Show alert for the first error found
      if (!validation.name.isValid) {
        showAlert("error", validation.name.errorMessage, "Sign Up Error");
        return;
      }
      if (!validation.email.isValid) {
        showAlert("error", validation.email.errorMessage, "Sign Up Error");
        return;
      }
      if (!validation.password.isValid) {
        showAlert("error", validation.password.errorMessage, "Password Requirements");
        return;
      }
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
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    validation.name.isTouched && (
                      validation.name.isValid 
                        ? styles.validInput 
                        : validation.name.errorMessage 
                          ? styles.invalidInput 
                          : null
                    )
                  ]}
                  value={form.name}
                  onChangeText={(text) => {
                    setForm((prev) => ({ ...prev, name: text }));
                    if (!validation.name.isTouched) {
                      setValidation(prev => ({
                        ...prev,
                        name: { ...prev.name, isTouched: true }
                      }));
                    }
                  }}
                  placeholder="Enter your full name"
                />
                {form.name.length > 0 && (
                  <TouchableOpacity 
                    style={styles.resetButton} 
                    onPress={() => resetField('name')}
                  >
                    <Feather name="x" size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}
                {validation.name.isTouched && validation.name.isValid && (
                  <View style={styles.validationIcon}>
                    <MaterialIcons name="check-circle" size={20} color="#10B981" />
                  </View>
                )}
                {validation.name.isTouched && !validation.name.isValid && form.name.length > 0 && (
                  <View style={styles.validationIcon}>
                    <MaterialIcons name="error" size={20} color="#EF4444" />
                  </View>
                )}
              </View>
              {validation.name.isTouched && validation.name.errorMessage ? (
                <Text style={styles.errorText}>{validation.name.errorMessage}</Text>
              ) : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    validation.email.isTouched && (
                      validation.email.isValid 
                        ? styles.validInput 
                        : validation.email.errorMessage 
                          ? styles.invalidInput 
                          : null
                    )
                  ]}
                  value={form.email}
                  onChangeText={(text) => {
                    setForm((prev) => ({ ...prev, email: text }));
                    if (!validation.email.isTouched) {
                      setValidation(prev => ({
                        ...prev,
                        email: { ...prev.email, isTouched: true }
                      }));
                    }
                  }}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {form.email.length > 0 && (
                  <TouchableOpacity 
                    style={styles.resetButton} 
                    onPress={() => resetField('email')}
                  >
                    <Feather name="x" size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}
                {validation.email.isTouched && validation.email.isValid && (
                  <View style={styles.validationIcon}>
                    <MaterialIcons name="check-circle" size={20} color="#10B981" />
                  </View>
                )}
                {validation.email.isTouched && !validation.email.isValid && form.email.length > 0 && (
                  <View style={styles.validationIcon}>
                    <MaterialIcons name="error" size={20} color="#EF4444" />
                  </View>
                )}
              </View>
              {validation.email.isTouched && validation.email.errorMessage ? (
                <Text style={styles.errorText}>{validation.email.errorMessage}</Text>
              ) : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    validation.password.isTouched && (
                      validation.password.isValid 
                        ? styles.validInput 
                        : validation.password.errorMessage 
                          ? styles.invalidInput 
                          : null
                    )
                  ]}
                  value={form.password}
                  onChangeText={(text) => {
                    setForm((prev) => ({ ...prev, password: text }));
                    if (!validation.password.isTouched) {
                      setValidation(prev => ({
                        ...prev,
                        password: { ...prev.password, isTouched: true }
                      }));
                    }
                  }}
                  placeholder="Create a password"
                  secureTextEntry
                />
                {form.password.length > 0 && (
                  <TouchableOpacity 
                    style={styles.resetButton} 
                    onPress={() => resetField('password')}
                  >
                    <Feather name="x" size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}
                {validation.password.isTouched && validation.password.isValid && (
                  <View style={styles.validationIcon}>
                    <MaterialIcons name="check-circle" size={20} color="#10B981" />
                  </View>
                )}
                {validation.password.isTouched && !validation.password.isValid && form.password.length > 0 && (
                  <View style={styles.validationIcon}>
                    <MaterialIcons name="error" size={20} color="#EF4444" />
                  </View>
                )}
              </View>
              {validation.password.isTouched && validation.password.errorMessage ? (
                <Text style={styles.errorText}>{validation.password.errorMessage}</Text>
              ) : null}
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
    right: 36,
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
