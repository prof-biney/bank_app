import { logger } from '@/lib/logger';
import { Link, router } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
// import { useAuth } from "../../context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import useAuthStore from "@/store/auth.store";

// Import reusable form components
import { 
  EmailField, 
  PasswordField,
  ValidationState
} from "@/components/form";
import { useTheme } from "@/context/ThemeContext";
import { chooseReadableText, withAlpha } from "@/theme/color-utils";
import { LoadingScreen } from "@/components/LoadingScreen";


export default function SignInScreen() {
  const { login, isAuthenticated } = useAuthStore();
  const { showAlert } = useAlert();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const isValidEmail = (
    email: string
  ): { isValid: boolean; message: string } => {
    // More comprehensive email regex that checks for proper format
    const emailRegex =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    if (!email) {
      return { isValid: false, message: "Email is required" };
    }

    if (!emailRegex.test(email)) {
      return { isValid: false, message: "Please enter a valid email address" };
    }

    return { isValid: true, message: "" };
  };

  // Function to handle field reset
  const resetField = (field: "email" | "password") => {
    setForm((prev) => ({ ...prev, [field]: "" }));
    // Reset validation but keep it as touched
    setValidation((prev) => ({
      ...prev,
      [field]: { isValid: false, isTouched: true, errorMessage: "" },
    }));
  };

  // Real-time validation as user types
  useEffect(() => {
    if (validation.email.isTouched) {
      const emailValidation = isValidEmail(form.email);
      setValidation((prev) => ({
        ...prev,
        email: {
          ...prev.email,
          isValid: emailValidation.isValid,
          errorMessage: emailValidation.message,
        },
      }));
    }
  }, [form.email, validation.email.isTouched]);

  // Monitor authentication state changes for navigation
  useEffect(() => {
    if (isAuthenticated && showSuccessAlert) {
      // User is now authenticated and we've shown the success alert
      // Navigate to the home screen
      const timer = setTimeout(() => {
        router.replace("/");
        setIsSubmitting(false);
        setShowSuccessAlert(false);
      }, 1200); // Small delay to ensure smooth transition
      
      navigationTimeoutRef.current = timer;
      
      return () => {
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }
      };
    }
  }, [isAuthenticated, showSuccessAlert]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Validate all fields and return if the form is valid
  const validateForm = (): boolean => {
    const emailValidation = isValidEmail(form.email);

    // Update validation state for all fields
    setValidation({
      email: {
        isValid: emailValidation.isValid,
        isTouched: true,
        errorMessage: emailValidation.message,
      },
      password: {
        isValid: !!form.password,
        isTouched: true,
        errorMessage: form.password ? "" : "Password is required",
      },
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
        showAlert("error", validation.email.errorMessage, "Sign In Error");
        return;
      }
      if (!validation.password.isValid) {
        showAlert("error", "Please enter your password", "Sign In Error");
        return;
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);

      // Show success message and set flag for navigation monitoring
      showAlert("success", "You have successfully signed in.", "Welcome Back");
      setShowSuccessAlert(true);
      
      // Navigation will be handled by the authentication state monitoring effect
    } catch (error: any) {
      // Handle specific error types with more descriptive messages
      let errorMessage = "Authentication failed. Please try again.";
      let errorTitle = "Sign In Error";

      if (error.message) {
        if (error.message.includes("Invalid credentials")) {
          errorMessage =
            "The email or password you entered is incorrect. Please try again.";
        } else if (error.message.includes("Rate limit")) {
          errorMessage = "Too many login attempts. Please try again later.";
          errorTitle = "Rate Limit Exceeded";
        } else if (error.message.includes("User not found")) {
          errorMessage =
            "No account found with this email. Please check your email or sign up.";
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
      logger.info('SCREEN', "Sign in error:", error);
      setShowSuccessAlert(false); // Reset success alert state on error
    } finally {
      setIsSubmitting(false);
    }
  };


  const { colors, transitionStyle } = useTheme();
  const { width } = Dimensions.get('window');

  // Show loading screen during authentication process
  if (isSubmitting) {
    return (
      <LoadingScreen 
        variant="auth"
        message="Signing you in"
        subtitle="Verifying your credentials and preparing your dashboard..."
        action="sign-in process"
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[{ flex: 1 }, transitionStyle]}>
      <LinearGradient
        colors={[
          colors.tintPrimary,
          withAlpha(colors.tintPrimary, 0.8),
          colors.background
        ]}
        locations={[0, 0.6, 1]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={styles.logoContainer}>
                <View style={[styles.logoCircle, { backgroundColor: withAlpha('#FFFFFF', 0.2) }]}>
                  <MaterialIcons name="account-balance" size={32} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.heroTitle}>Welcome Back</Text>
              <Text style={styles.heroSubtitle}>Your finances await. Sign in to continue your journey.</Text>
            </View>


            {/* Form Card */}
            <View style={[styles.formCard, { backgroundColor: colors.card }]}>
              <View style={styles.formHeader}>
                <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Sign In</Text>
                <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>Access your account</Text>
              </View>

              <View style={styles.formContent}>
                <EmailField
                  label="Email Address"
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
                  placeholder="Enter your email address"
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

                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={[styles.forgotPasswordText, { color: colors.tintPrimary }]}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>

                <LinearGradient
                  colors={[colors.tintPrimary, withAlpha(colors.tintPrimary, 0.8)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.gradientButton,
                    isSubmitting && styles.buttonDisabled
                  ]}
                >
                  <TouchableOpacity
                    style={styles.buttonInner}
                    onPress={submit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <View style={styles.loadingContainer}>
                        <MaterialIcons name="hourglass-empty" size={20} color="#FFFFFF" />
                        <Text style={styles.loadingText}>Signing In...</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.gradientButtonText}>Sign In</Text>
                        <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.authFooter}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Don't have an account yet?
              </Text>
              <Link href="/(auth)/sign-up" style={styles.footerLink}>
                <Text style={[styles.footerLinkText, { color: colors.tintPrimary }]}>
                  Create Account
                </Text>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  
  // Hero Section Styles
  heroSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  
  // Form Card Styles
  formCard: {
    borderRadius: 24,
    padding: 0,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  formHeader: {
    padding: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  formContent: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  
  // Button Styles
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 24,
    padding: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gradientButton: {
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#0F766E',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonInner: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  
  // Footer Styles
  authFooter: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 15,
    marginBottom: 8,
  },
  footerLink: {
    padding: 8,
  },
  footerLinkText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Legacy styles (keeping for compatibility)
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    paddingRight: 40,
  },
  validInput: {},
  invalidInput: {},
  resetButton: {
    position: "absolute",
    right: 31,
    padding: 4,
  },
  visibilityToggle: {
    position: "absolute",
    right: 10,
    padding: 4,
  },
  validationIcon: {
    position: "absolute",
    right: 12,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  link: {
    marginLeft: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
