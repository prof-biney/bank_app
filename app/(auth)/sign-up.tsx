import { useAlert } from "@/context/AlertContext";
// Firebase imports removed - using Appwrite auth service
import { authService } from "@/lib/appwrite/auth";
import useAuthStore from "@/store/auth.store";
import { Link, router } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Modal,
  FlatList,
  Dimensions,
  ScrollView,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { parsePhoneNumberFromString, getCountryCallingCode, getExampleNumber, getCountries } from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';
// Import reusable form components
import { 
  FullNameField, 
  EmailField, 
  PhoneNumberField, 
  PasswordField, 
  ConfirmPasswordField,
  ValidationState,
  PhoneNumberValidationState,
  ConfirmPasswordValidationState
} from "@/components/form";
import { withAlpha } from "@/theme/color-utils";
import LoadingAnimation from '@/components/LoadingAnimation';
import { useLoading, LOADING_CONFIGS } from '@/hooks/useLoading';
import { logger } from "@/lib/logger";
import BiometricSetupModal from '@/components/auth/BiometricSetupModal';
import { useBiometricMessages } from '@/context/BiometricToastContext';

// Get all available countries and create a comprehensive country data array
// This uses the getCountries function from libphonenumber-js to get all country codes
// Then creates an array with country code, name, and flag emoji
// Finally sorts the array alphabetically by country name
const countryData = getCountries()
  .map(code => {
    // Create flag emoji from country code
    // Country code is converted to regional indicator symbols (Unicode)
    const flag = code
      .toUpperCase()
      .split('')
      .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
      .join('');
    
    // Get country name (fallback to code if name can't be determined)
    let name;
    try {
      // This is a simple approach to get country names
      // In a production app, you might want to use a more comprehensive library
      // like i18n-iso-countries or a custom mapping
      const exampleNumber = getExampleNumber(code, examples);
      name = exampleNumber ? exampleNumber.country : code;
      
      // Format country name (convert country codes to proper names where possible)
      switch (code) {
        case 'US': name = 'United States'; break;
        case 'GB': name = 'United Kingdom'; break;
        case 'AE': name = 'United Arab Emirates'; break;
        case 'DO': name = 'Dominican Republic'; break;
        case 'KR': name = 'South Korea'; break;
        case 'RU': name = 'Russia'; break;
        // Add more mappings as needed
        default: 
          // Convert country code to title case if no specific mapping
          if (name === code) {
            name = code;
          }
      }
    } catch (error) {
      name = code;
    }
    
    return { code, name, flag };
  })
  // Sort alphabetically by country name
  .sort((a, b) => a.name.localeCompare(b.name));

export default function SignUpScreen() {
  const { colors } = useTheme();
  const { loading, withLoading } = useLoading();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  // Country code state (default to US)
  const [countryCode, setCountryCode] = useState("US");
  // Country selection modal visibility
  const [showCountryModal, setShowCountryModal] = useState(false);
  // Get current country data
  const getCurrentCountry = () => countryData.find(country => country.code === countryCode) || countryData[0];
  
  // Validation states
  const [validation, setValidation] = useState({
    name: { isValid: false, isTouched: false, errorMessage: "" },
    email: { isValid: false, isTouched: false, errorMessage: "" },
    phoneNumber: { isValid: false, isTouched: false, errorMessage: "", digitCount: 0, maxDigits: 10 },
    password: { isValid: false, isTouched: false, errorMessage: "" },
    confirmPassword: { isValid: false, isTouched: false, errorMessage: "", isPartialMatch: false },
  });
  
  // Phone number digit count state for animation
  const [phoneDigitProgress, setPhoneDigitProgress] = useState({
    percentage: 0, // 0-100 percentage
    color: "#EF4444", // Default to red (invalid)
  });
  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0, // 0-100 score
    level: 0, // 0: none, 1: weak, 2: medium, 3: strong, 4: very strong
    color: "#EF4444", // Default to red (weak)
  });
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Animated values for smooth transitions
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const phoneAnimatedWidth = useRef(new Animated.Value(0)).current;
  const { login, isAuthenticated, fetchAuthenticatedUser, setupBiometric } = useAuthStore();
  const { showAlert } = useAlert();
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
  
  // Biometric setup state
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  
  const biometricMessages = useBiometricMessages();
  
  // Function to detect user's country based on IP address
  const detectUserCountry = async () => {
    try {
      // Use a geolocation API to detect the user's country
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data && data.country_code) {
        // Update country code state
        setCountryCode(data.country_code);
        
        // Update max digits based on the detected country
        updateMaxDigitsForCountry(data.country_code);
      }
    } catch (error) {
      logger.info('SCREEN', 'Error detecting country:', error);
      // Default to US if detection fails
      setCountryCode('US');
      updateMaxDigitsForCountry('US');
    }
  };
  
  // Function to update max digits based on country
  const updateMaxDigitsForCountry = (country: string) => {
    try {
      // Get example number for the country
      const exampleNumber = getExampleNumber(country, examples);
      
      if (exampleNumber) {
        // Get the national number (without country code)
        const nationalNumber = exampleNumber.nationalNumber;
        
        // Update validation state with the expected number of digits
        setValidation(prev => ({
          ...prev,
          phoneNumber: {
            ...prev.phoneNumber,
            maxDigits: nationalNumber.length
          }
        }));
      }
    } catch (error) {
      logger.info('SCREEN', 'Error getting example number:', error);
      // Default to 10 digits (US standard) if there's an error
      setValidation(prev => ({
        ...prev,
        phoneNumber: {
          ...prev.phoneNumber,
          maxDigits: 10
        }
      }));
    }
  };
  
  // Phone number validation function
  const validatePhoneNumber = (phoneNumber: string, country: string): { 
    isValid: boolean; 
    message: string; 
    digitCount: number;
    maxDigits: number;
  } => {
    if (!phoneNumber) {
      return { 
        isValid: false, 
        message: "Phone number is required", 
        digitCount: 0,
        maxDigits: validation.phoneNumber.maxDigits
      };
    }
    
    // Remove any non-digit characters for counting
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const digitCount = digitsOnly.length;
    
    try {
      // Parse the phone number with the country code
      const parsedNumber = parsePhoneNumberFromString(phoneNumber, country);
      
      // Get example number to determine expected length
      const exampleNumber = getExampleNumber(country, examples);
      const maxDigits = exampleNumber ? exampleNumber.nationalNumber.length : 10;
      
      // Check if the number is valid for the country
      if (parsedNumber && parsedNumber.isValid()) {
        return { 
          isValid: true, 
          message: "", 
          digitCount,
          maxDigits
        };
      }
      
      // If we have the right number of digits but the number is still invalid
      if (digitCount === maxDigits && (!parsedNumber || !parsedNumber.isValid())) {
        return { 
          isValid: false, 
          message: "Invalid phone number format for selected country", 
          digitCount,
          maxDigits
        };
      }
      
      // If we don't have enough digits yet
      if (digitCount < maxDigits) {
        const remaining = maxDigits - digitCount;
        return { 
          isValid: false, 
          message: `${remaining} more digit${remaining !== 1 ? 's' : ''} needed`, 
          digitCount,
          maxDigits
        };
      }
      
      // If we have too many digits
      if (digitCount > maxDigits) {
        return { 
          isValid: false, 
          message: `Too many digits. Expected ${maxDigits}`, 
          digitCount,
          maxDigits
        };
      }
      
      return { 
        isValid: false, 
        message: "Invalid phone number", 
        digitCount,
        maxDigits
      };
    } catch (error) {
      logger.info('SCREEN', 'Error validating phone number:', error);
      return { 
        isValid: false, 
        message: "Error validating phone number", 
        digitCount,
        maxDigits: validation.phoneNumber.maxDigits
      };
    }
  };
  
  // Update phone digit progress based on validation
  const updatePhoneDigitProgress = (digitCount: number, maxDigits: number) => {
    // Calculate percentage (0-100)
    const percentage = Math.min(100, Math.round((digitCount / maxDigits) * 100));
    
    // Determine color based on percentage
    let color = "#EF4444"; // Red (default/invalid)
    
    if (percentage === 0) {
      color = "#EF4444"; // Red
    } else if (percentage < 50) {
      color = "#EF4444"; // Red
    } else if (percentage < 75) {
      color = "#F59E0B"; // Amber
    } else if (percentage < 100) {
      color = "#10B981"; // Green
    } else {
      color = "#059669"; // Dark green (complete)
    }
    
    // Update state
    setPhoneDigitProgress({ percentage, color });
    
    // Animate width for smooth transition
    Animated.timing(phoneAnimatedWidth, {
      toValue: percentage,
      duration: 300,
      useNativeDriver: false, // width changes can't use native driver
    }).start();
  };

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

  /**
   * Validates the full name input with the following rules:
   * 1. Name is required
   * 2. Name must be at least 2 characters long
   * 3. Name must contain at least two words (first and last name)
   * 4. Each word in the name must be at least 3 letters long
   * 
   * @param name - The full name to validate
   * @returns Object with validation result and error message if invalid
   */
  const validateName = (name: string): { isValid: boolean; message: string } => {
    if (!name) {
      return { isValid: false, message: "Name is required" };
    }
  
    if (name.trim().length < 2) {
      return { isValid: false, message: "Name must be at least 2 characters long" };
    }
  
    // Check if the name contains at least one space (multiple words)
    if (!name.trim().includes(' ')) {
      return { isValid: false, message: "Please enter your full name (first and last name)" };
    }
    
    // Check if each word has at least 3 letters
    const words = name.trim().split(/\s+/);
    for (const word of words) {
      if (word.length < 3) {
        return { isValid: false, message: "Each part of your name must be at least 3 letters long" };
      }
    }
  
    return { isValid: true, message: "" };
  };

  // Calculate password strength score (0-100)
  const calculatePasswordStrength = (password: string): number => {
    if (!password) return 0;
    
    let score = 0;
    
    // Length contribution (up to 25 points)
    const lengthScore = Math.min(25, password.length * 2);
    score += lengthScore;
    
    // Character variety contribution
    if (/[0-9]/.test(password)) score += 15; // Numbers
    if (/[a-z]/.test(password)) score += 10; // Lowercase
    if (/[A-Z]/.test(password)) score += 15; // Uppercase
    if (/[^a-zA-Z0-9]/.test(password)) score += 20; // Special chars
    
    // Bonus for combination of character types
    let typesCount = 0;
    if (/[0-9]/.test(password)) typesCount++;
    if (/[a-z]/.test(password)) typesCount++;
    if (/[A-Z]/.test(password)) typesCount++;
    if (/[^a-zA-Z0-9]/.test(password)) typesCount++;
    
    if (typesCount >= 3) score += 15;
    
    return Math.min(100, score);
  };
  
  // Update password strength state based on score
  const updatePasswordStrength = (password: string) => {
    const score = calculatePasswordStrength(password);
    let level = 0;
    let color = "#EF4444"; // Red (default/weak)
    
    if (score === 0) {
      level = 0;
    } else if (score < 40) {
      level = 1; // Weak
      color = "#EF4444"; // Red
    } else if (score < 70) {
      level = 2; // Medium
      color = "#F59E0B"; // Amber
    } else if (score < 90) {
      level = 3; // Strong
      color = "#10B981"; // Green
    } else {
      level = 4; // Very strong
      color = "#059669"; // Dark green
    }
    
    // Update the state for text labels
    setPasswordStrength({ score, level, color });
    
    // Animate width for smooth transition
    Animated.timing(animatedWidth, {
      toValue: score,
      duration: 300,
      useNativeDriver: false, // width changes can't use native driver
    }).start();
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
  
  // Confirm password validation with letter-by-letter matching
  const validateConfirmPassword = (
    password: string,
    confirmPassword: string
  ): { isValid: boolean; message: string; isPartialMatch: boolean } => {
    if (!confirmPassword) {
      return { isValid: false, message: "Please confirm your password", isPartialMatch: false };
    }
  
    // Check if the confirm password matches the password up to its current length
    const passwordSubstring = password.substring(0, confirmPassword.length);
  
    if (passwordSubstring !== confirmPassword) {
      return { isValid: false, message: "Passwords do not match", isPartialMatch: false };
    }
  
    // It's a partial match if the user is correctly typing but hasn't completed the password
    if (password !== confirmPassword) {
      return { 
        isValid: false, 
        message: "Please complete the password confirmation", 
        isPartialMatch: true 
      };
    }
  
    // Full match - passwords are identical
    return { isValid: true, message: "", isPartialMatch: false };
  };
  
  // Detect user's country on component mount
  useEffect(() => {
    detectUserCountry();
  }, []);
  
  // Monitor authentication state changes for navigation
  useEffect(() => {
    if (isAuthenticated && showSuccessAlert) {
      // User is now authenticated and we've shown the success alert
      // Navigate to the onboarding screen
      const timer = setTimeout(() => {
        router.replace("/onboarding");
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
  
  // Validate phone number as user types
  useEffect(() => {
    if (validation.phoneNumber.isTouched) {
      const phoneValidation = validatePhoneNumber(form.phoneNumber, countryCode);
      
      setValidation(prev => ({
        ...prev,
        phoneNumber: { 
          ...prev.phoneNumber, 
          isValid: phoneValidation.isValid, 
          errorMessage: phoneValidation.message,
          digitCount: phoneValidation.digitCount,
          maxDigits: phoneValidation.maxDigits
        }
      }));
      
      // Update digit progress for animation
      updatePhoneDigitProgress(phoneValidation.digitCount, phoneValidation.maxDigits);
    }
  }, [form.phoneNumber, countryCode]);
  
  // Replace the password validation effect
  useEffect(() => {
    if (validation.password.isTouched) {
      const passwordValidation = validatePassword(form.password);
      setValidation(prev => ({
        ...prev,
        password: { 
          ...prev.password, 
          isValid: passwordValidation.isValid, 
          errorMessage: passwordValidation.message 
        },  // Add comma here
      }));
      
      // Update password strength whenever password changes
      updatePasswordStrength(form.password);
      
      // Also validate confirm password if it's been touched
      if (validation.confirmPassword.isTouched) {
        const confirmPasswordValidation = validateConfirmPassword(
          form.password,
          form.confirmPassword
        );
        setValidation(prev => ({
          ...prev,
          confirmPassword: {
            ...prev.confirmPassword,
            isValid: confirmPasswordValidation.isValid,
            errorMessage: confirmPasswordValidation.message,
            isPartialMatch: confirmPasswordValidation.isPartialMatch
          }
        }));
      }
    }
  }, [form.password]);
  
  // Validate confirm password when it changes
  useEffect(() => {
    if (validation.confirmPassword.isTouched) {
      const confirmPasswordValidation = validateConfirmPassword(
        form.password,
        form.confirmPassword
      );
      setValidation(prev => ({
        ...prev,
        confirmPassword: {
          ...prev.confirmPassword,
          isValid: confirmPasswordValidation.isValid,
          errorMessage: confirmPasswordValidation.message,
          isPartialMatch: confirmPasswordValidation.isPartialMatch
        }
      }));
    }
  }, [form.confirmPassword, form.password]);

  // Function to handle field reset
  const resetField = (field: 'name' | 'email' | 'phoneNumber' | 'password' | 'confirmPassword') => {
    setForm(prev => ({ ...prev, [field]: "" }));
    
    // Reset validation but keep it as touched
    if (field === 'phoneNumber') {
      // Special handling for phone number to preserve maxDigits
      setValidation(prev => ({
        ...prev,
        phoneNumber: { 
          ...prev.phoneNumber, 
          isValid: false, 
          isTouched: true, 
          errorMessage: "",
          digitCount: 0
        }
      }));
      
      // Reset phone digit progress
      setPhoneDigitProgress({
        percentage: 0,
        color: "#EF4444"
      });
      
      // Reset animated width with animation
      Animated.timing(phoneAnimatedWidth, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      // Standard reset for other fields
      setValidation(prev => ({
        ...prev,
        [field]: { 
          ...prev[field],
          isValid: false, 
          isTouched: true, 
          errorMessage: "" 
        }
      }));
    }
    
    // Reset password strength if password field is reset
    if (field === 'password') {
      // Reset state
      setPasswordStrength({
        score: 0,
        level: 0,
        color: "#EF4444"
      });
      
      // Reset animated width with animation for smooth transition
      Animated.timing(animatedWidth, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // Validate all fields and return if the form is valid
  const validateForm = (): boolean => {
    const nameValidation = validateName(form.name);
    const emailValidation = isValidEmail(form.email);
    const phoneValidation = validatePhoneNumber(form.phoneNumber, countryCode);
    const passwordValidation = validatePassword(form.password);
    const confirmPasswordValidation = validateConfirmPassword(form.password, form.confirmPassword);
    
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
      phoneNumber: {
        isValid: phoneValidation.isValid,
        isTouched: true,
        errorMessage: phoneValidation.message,
        digitCount: phoneValidation.digitCount,
        maxDigits: phoneValidation.maxDigits
      },
      password: { 
        isValid: passwordValidation.isValid, 
        isTouched: true, 
        errorMessage: passwordValidation.message 
      },
      confirmPassword: {
        isValid: confirmPasswordValidation.isValid,
        isTouched: true,
        errorMessage: confirmPasswordValidation.message,
        isPartialMatch: confirmPasswordValidation.isPartialMatch
      }
    });
    
    // Update phone digit progress
    updatePhoneDigitProgress(phoneValidation.digitCount, phoneValidation.maxDigits);
    
    // Form is valid if all fields are valid and confirm password is not just a partial match
    return nameValidation.isValid && 
           emailValidation.isValid && 
           phoneValidation.isValid &&
           passwordValidation.isValid && 
           confirmPasswordValidation.isValid &&
           !confirmPasswordValidation.isPartialMatch;
  };

  const submit = async () => {
    const { name, email, phoneNumber, password } = form;

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
      if (!validation.phoneNumber.isValid) {
        showAlert("error", validation.phoneNumber.errorMessage, "Phone Number Error");
        return;
      }
      if (!validation.password.isValid) {
        showAlert("error", validation.password.errorMessage, "Password Requirements");
        return;
      }
      if (!validation.confirmPassword.isValid) {
        showAlert("error", validation.confirmPassword.errorMessage, "Password Mismatch");
        return;
      }
      return;
    }

    try {
      await withLoading(async () => {
        logger.debug('AUTH', '[SignUp] Attempting to create user account');

        // Format phone number with country code
        const formattedPhoneNumber = `+${getCountryCallingCode(countryCode)}${phoneNumber.replace(/\D/g, '')}`;

        // Create user account using Appwrite auth service
        const user = await authService.register({
          email,
          name,
          password,
        });

        logger.debug('AUTH', '[SignUp] User account created successfully:', { userId: user.$id });

      // Confirm the user document exists in the database. Use a small retry helper
      // because writes may take a short moment to be readable.
      const fetchWithRetry = async (id: string, attempts = 3, delayMs = 600) => {
        let lastErr: any = null;
        for (let i = 0; i < attempts; i++) {
          try {
            const res = await authService.getUserProfile(id);
            return res;
          } catch (e) {
            lastErr = e;
            logger.warn('AUTH', `[SignUp] fetchUser attempt ${i + 1} failed, retrying in ${delayMs}ms`, e);
            // small backoff
            // don't await on the last iteration
            if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        throw lastErr;
      };

      let userData: any = null;
      userData = await fetchWithRetry(user.$id, 3, 600);

      if (!userData || !userData.$id) {
        throw new Error('User document not found after account creation');
      }

      logger.debug('AUTH', '[SignUp] User data fetched successfully:', { userId: userData.$id });

      // Attempt to ensure auth store state is updated by performing login and then
      // fetching the authenticated user into the global store. If login fails we
      // still consider the account created but navigation may not proceed.
      try {
        await login(email, password);
        // Ensure the global auth store fetches and sets the authenticated user
        try {
          await fetchAuthenticatedUser();
        } catch (fetchAuthErr) {
          logger.warn('AUTH', '[SignUp] fetchAuthenticatedUser after login failed (non-fatal):', fetchAuthErr);
        }
      } catch (loginErr) {
        logger.warn('AUTH', '[SignUp] Login after createUser failed (non-fatal):', loginErr);
      }

      // Show success message and offer biometric setup
      showAlert('success', 'Your account has been created successfully!', 'Welcome!');
      setShowSuccessAlert(true);
      setAccountCreated(true);
      
      // Show biometric setup modal instead of immediately navigating
      setShowBiometricSetup(true);
      }, LOADING_CONFIGS.REGISTER);
    } catch (err: any) {
      setShowSuccessAlert(false);
      // Log full error object for debugging
      logger.error('AUTH', '[SignUp] Error during signup (full):', { err });

      // If SDK provides structured error fields, include them in logs
      if ((err as any)?.code) logger.error('AUTH', '[SignUp] SDK error code:', (err as any).code);
      if ((err as any)?.response) logger.error('AUTH', '[SignUp] SDK response:', (err as any).response);

      // Derive friendly message
      let message = 'Failed to create account. Please try again.';
      let serverDetails = '';
      if (typeof err === 'string') {
        message = err;
      } else if (err?.message) {
        message = err.message;
      } else if ((err as any)?.response?.message) {
        message = (err as any).response.message;
      }

      // Append server error details for diagnostics (kept concise for users)
      if ((err as any)?.response?.message) serverDetails = (err as any).response.message;
      else if ((err as any)?.message) serverDetails = (err as any).message;

      const title = message.includes('email already exists') ? 'Email Already Registered' : 'Sign Up Error';
      const alertMessage = serverDetails ? `${message}
\nDetails: ${serverDetails}
If this persists, contact support.` : `${message}
If this persists, contact support.`;

      showAlert('error', alertMessage, title);
    }
  };
  
  // Biometric setup handlers
  const handleBiometricSetup = async () => {
    try {
      const result = await setupBiometric();
      
      if (result.success) {
        biometricMessages.setupSuccess(result.biometricType);
      } else {
        biometricMessages.setupFailed(result.error);
      }
      
      return result;
    } catch (error) {
      logger.error('AUTH', 'Biometric setup error in sign-up:', error);
      biometricMessages.setupFailed('An unexpected error occurred during setup');
      return {
        success: false,
        error: 'Failed to set up biometric authentication',
      };
    }
  };
  
  const handleBiometricSetupClose = () => {
    setShowBiometricSetup(false);
    // Navigate to onboarding after closing the modal
    if (accountCreated) {
      router.replace('/onboarding');
    }
  };
  
  const handleBiometricSkip = () => {
    // User chose to skip biometric setup
    logger.info('AUTH', 'User skipped biometric setup during sign-up');
    biometricMessages.showInfo(
      'Biometric Setup Skipped',
      'You can enable biometric authentication later in Settings'
    );
  };

  // Country selection modal component
  const renderCountrySelectionModal = () => {
    return (
      <Modal
        visible={showCountryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowCountryModal(false)}
              >
                <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={countryData}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => {
                    setCountryCode(item.code);
                    updateMaxDigitsForCountry(item.code);
                    setShowCountryModal(false);
                  }}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{item.name}</Text>
                    <Text style={styles.countryCode}>+{getCountryCallingCode(item.code)}</Text>
                  </View>
                  {countryCode === item.code && (
                    <MaterialIcons name="check" size={20} color={colors.positive} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.countryList}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // const { width } = Dimensions.get('window');

  // Loading handled by LoadingAnimation component

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[
          colors.tintPrimary,
          withAlpha(colors.tintPrimary, 0.8),
          colors.background
        ]}
        locations={[0, 0.5, 1]}
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
              <Text style={styles.heroTitle}>Join Us Today</Text>
              <Text style={styles.heroSubtitle}>Create your account and start your financial journey with confidence.</Text>
            </View>

            {/* Form Card */}
            <View style={[styles.formCard, { backgroundColor: colors.card }]}>
              <View style={styles.formHeader}>
                <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Create Account</Text>
                <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>Fill in your information below</Text>
              </View>

              <View style={styles.formContent}>
                {/* Personal Information Section */}
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
                  
                  <FullNameField
                    label="Full Name"
                    value={form.name}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                    validation={validation.name as ValidationState}
                    onValidationChange={(newValidation) => 
                      setValidation(prev => ({
                        ...prev,
                        name: newValidation
                      }))
                    }
                    resetField={() => resetField('name')}
                    placeholder="Enter your full name"
                  />

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
                  
                  <PhoneNumberField
                    label="Phone Number"
                    value={form.phoneNumber}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, phoneNumber: text }))}
                    validation={validation.phoneNumber as PhoneNumberValidationState}
                    onValidationChange={(newValidation) => 
                      setValidation(prev => ({
                        ...prev,
                        phoneNumber: newValidation
                      }))
                    }
                    resetField={() => resetField('phoneNumber')}
                    countryCode={countryCode}
                    onCountryCodeChange={setCountryCode}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Stylish Divider */}
                <View style={styles.sectionDivider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <View style={[styles.dividerIconContainer, { backgroundColor: colors.card }]}>
                    <MaterialIcons name="verified-user" size={16} color={colors.tintPrimary} />
                  </View>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Security Section */}
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account Security</Text>
                  
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
                    placeholder="Create a secure password"
                    enableValidation={true}
                    showStrengthMeter={true}
                  />
                  
                  <ConfirmPasswordField
                    label="Confirm Password"
                    value={form.confirmPassword}
                    password={form.password}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, confirmPassword: text }))}
                    validation={validation.confirmPassword as ConfirmPasswordValidationState}
                    onValidationChange={(newValidation) => 
                      setValidation(prev => ({
                        ...prev,
                        confirmPassword: newValidation
                      }))
                    }
                    resetField={() => resetField('confirmPassword')}
                    placeholder="Re-enter your password"
                  />
                </View>

                <LinearGradient
                  colors={[colors.tintPrimary, withAlpha(colors.tintPrimary, 0.8)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.gradientButton,
                    loading.visible && styles.buttonDisabled
                  ]}
                >
                  <TouchableOpacity
                    style={styles.buttonInner}
                    onPress={submit}
                    disabled={loading.visible}
                  >
                    {loading.visible ? (
                      <View style={styles.loadingContainer}>
                        <MaterialIcons name="hourglass-empty" size={20} color="#FFFFFF" />
                        <Text style={styles.loadingText}>Creating Account...</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.gradientButtonText}>Create Account</Text>
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
                Already have an account?
              </Text>
              <Link href="/(auth)/sign-in" style={styles.footerLink}>
                <Text style={[styles.footerLinkText, { color: colors.tintPrimary }]}>
                  Sign In
                </Text>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      
      {/* Enhanced Country Selection Modal */}
      {renderCountrySelectionModal()}
      
      {/* Biometric Setup Modal */}
      <BiometricSetupModal
        visible={showBiometricSetup}
        onClose={handleBiometricSetupClose}
        onSetup={handleBiometricSetup}
        onSkip={handleBiometricSkip}
      />
      
      <LoadingAnimation
        visible={loading.visible}
        message={loading.message}
        subtitle={loading.subtitle}
        type={loading.type}
        size={loading.size}
      />
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
    paddingTop: 50,
    paddingBottom: 30,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 34,
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
    maxWidth: 300,
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
    fontSize: 15,
    opacity: 0.7,
  },
  formContent: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  
  // Form Section Styles
  formSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    opacity: 0.8,
  },
  
  // Stylish Divider Styles
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    marginHorizontal: -8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  dividerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F766E',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  
  // Button Styles
  gradientButton: {
    borderRadius: 16,
    marginTop: 16,
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
  
  // Footer Styles
  authFooter: {
    alignItems: 'center',
    paddingBottom: 40,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  // Style for input placeholders with reduced font size
  placeholderText: {
    fontSize: 15, // 1pt smaller than the regular input text
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
    fontSize: 15, // Reduced from 16pt to 15pt for placeholder text
    paddingRight: 40, // Space for the icons
  },
  // Phone number input styles
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  countryCodeSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginRight: 8,
    minWidth: 80,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 16,
    color: "#374151",
    marginRight: 4,
  },
  phoneInputWrapper: {
    flex: 1,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15, // Reduced from 16pt to 15pt for placeholder text
    paddingRight: 40, // Space for the icons
  },
  // Phone digit count validator styles
  phoneDigitContainer: {
    marginTop: 8,
  },
  phoneDigitLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  phoneDigitText: {
    fontSize: 12,
    color: "#6B7280",
  },
  phoneDigitStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  phoneDigitTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  phoneDigitBar: {
    height: "100%",
    borderRadius: 3,
    // Width and backgroundColor are set dynamically
  },
  validInput: {
  },
  partialMatchInput: {
  },
  invalidInput: {
  },
  /**
   * Icon positioning:
   * The positions of icons have been rearranged according to requirements:
   * 1. Eye icons (password visibility toggle) are now where checkmark/info icons were
   * 2. Checkmark/info icons are now where the cross (reset) icon was
   * 3. Cross icon is now in a new position (where eye icons were)
   */
  resetButton: {
    position: "absolute",
    right: 58, // Moved 10px closer to the checkmark/info icon
    padding: 4,
  },
  // Special positioning for full name field icons (moved 25px to the right)
  nameResetButton: {
    position: "absolute",
    right: 33, // Moved 25px to the right from the standard position
    padding: 4,
  },
  nameValidationIcon: {
    position: "absolute",
    right: 11, // Moved 25px to the right from the standard position
    padding: 4,
  },
  // Special positioning for email field icons (moved 25px to the right)
  emailResetButton: {
    position: "absolute",
    right: 33, // Moved 25px to the right from the standard position
    padding: 4,
  },
  emailValidationIcon: {
    position: "absolute",
    right: 11, // Moved 25px to the right from the standard position
    padding: 4,
  },
  // Special positioning for phone number field icons (moved 25px to the right)
  phoneResetButton: {
    position: "absolute",
    right: 33, // Moved 25px to the right from the standard position
    padding: 4,
  },
  phoneValidationIcon: {
    position: "absolute",
    right: 11, // Moved 25px to the right from the standard position
    padding: 4,
  },
  visibilityToggle: {
    position: "absolute",
    right: 12, // Moved from 68 to 12 (where checkmark/info icons were)
    padding: 4,
  },
  validationIcon: {
    position: "absolute",
    right: 36, // Moved from 12 to 36 (where cross icon was)
    padding: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  // Country selection modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: Dimensions.get("window").width * 0.9,
    maxHeight: Dimensions.get("window").height * 0.7,
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalCloseButton: {
    padding: 4,
  },
  countryList: {
    maxHeight: Dimensions.get("window").height * 0.6,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  countryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  countryName: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  countryCode: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  // Password strength styles
  passwordStrengthContainer: {
    marginTop: 8,
  },
  passwordStrengthLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  passwordStrengthText: {
    fontSize: 12,
    color: "#6B7280",
  },
  passwordStrengthLevelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  passwordStrengthTrack: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  passwordStrengthBar: {
    height: "100%",
    borderRadius: 3,
    // Width and backgroundColor are set dynamically
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
  footerLink: {
    padding: 8,
  },
  footerLinkText: {
    fontSize: 16,
    fontWeight: '600',
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
