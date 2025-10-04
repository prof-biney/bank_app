import { TextInputProps } from "react-native";

/**
 * Base validation state interface for form fields
 */
export interface ValidationState {
  isValid: boolean;
  isTouched: boolean;
  errorMessage: string;
}

/**
 * Extended validation state for password confirmation
 */
export interface ConfirmPasswordValidationState extends ValidationState {
  isPartialMatch: boolean;
}

/**
 * Extended validation state for phone number
 */
export interface PhoneNumberValidationState extends ValidationState {
  digitCount: number;
  maxDigits: number;
}

/**
 * Password strength level
 */
export interface PasswordStrength {
  score: number; // 0-100 score
  level: number; // 0: none, 1: weak, 2: medium, 3: strong, 4: very strong
  color: string; // Color representing the strength level
}

/**
 * Base props for all form field components
 */
export interface FormFieldProps extends Omit<TextInputProps, 'onChangeText'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  validation: ValidationState;
  onValidationChange: (validation: ValidationState) => void;
  resetField: () => void;
}

/**
 * Email validation function with enhanced regex
 */
export const validateEmail = (email: string): { isValid: boolean; message: string } => {
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
 * Full name validation function
 */
export const validateName = (name: string): { isValid: boolean; message: string } => {
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

/**
 * Password strength validation
 */
export const validatePassword = (
  password: string,
  enableValidation: boolean = true
): { isValid: boolean; message: string } => {
  if (!password) {
    return { isValid: false, message: "Password is required" };
  }
  
  // If validation is disabled, just check if password exists
  if (!enableValidation) {
    return { isValid: true, message: "" };
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

/**
 * Confirm password validation with letter-by-letter matching
 */
export const validateConfirmPassword = (
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

/**
 * Calculate password strength score (0-100)
 */
export const calculatePasswordStrength = (password: string): number => {
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

/**
 * Get password strength details based on score
 */
export const getPasswordStrength = (score: number): PasswordStrength => {
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
  
  return { score, level, color };
};

/**
 * Update password strength function that combines calculation and strength mapping
 */
export const updatePasswordStrength = (password: string): PasswordStrength => {
  const score = calculatePasswordStrength(password);
  return getPasswordStrength(score);
};

/**
 * Create initial validation state
 */
export const createInitialValidationState = (): ValidationState => ({
  isValid: false,
  isTouched: false,
  errorMessage: "",
});

/**
 * Create initial phone number validation state
 */
export const createInitialPhoneNumberValidationState = (): PhoneNumberValidationState => ({
  isValid: false,
  isTouched: false,
  errorMessage: "",
  digitCount: 0,
  maxDigits: 10,
});

/**
 * Create initial confirm password validation state
 */
export const createInitialConfirmPasswordValidationState = (): ConfirmPasswordValidationState => ({
  isValid: false,
  isTouched: false,
  errorMessage: "",
  isPartialMatch: false,
});
