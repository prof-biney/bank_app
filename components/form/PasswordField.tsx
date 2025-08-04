import React, { useEffect, useState, useRef } from "react";
import { Text, TextInput, TouchableOpacity, View, Animated } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { 
  FormFieldProps, 
  ValidationState, 
  validatePassword, 
  calculatePasswordStrength,
  getPasswordStrength,
  PasswordStrength
} from "./types";
import { formStyles } from "./styles";

/**
 * Props for the PasswordField component
 */
interface PasswordFieldProps extends FormFieldProps {
  /**
   * Whether to enable password validation (default: true)
   * Set to false for sign-in screen
   */
  enableValidation?: boolean;
  
  /**
   * Whether to show password strength meter (default: false)
   * Only applicable when enableValidation is true
   */
  showStrengthMeter?: boolean;
}

/**
 * A reusable password input field component with visibility toggle and optional validation
 */
const PasswordField: React.FC<PasswordFieldProps> = ({
  label = "Password",
  value,
  onChangeText,
  validation,
  onValidationChange,
  resetField,
  placeholder = "Enter your password",
  enableValidation = true,
  showStrengthMeter = false,
  ...rest
}) => {
  // State for password visibility
  const [showPassword, setShowPassword] = useState(false);
  
  // State for password strength
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    level: 0,
    color: "#EF4444"
  });
  
  // Animated value for smooth width transition in strength meter
  const animatedWidth = useRef(new Animated.Value(0)).current;
  
  // Validate password when value changes
  useEffect(() => {
    if (validation.isTouched) {
      const passwordValidation = validatePassword(value, enableValidation);
      onValidationChange({
        ...validation,
        isValid: passwordValidation.isValid,
        errorMessage: passwordValidation.message
      });
      
      // Update password strength if validation is enabled
      if (enableValidation) {
        updatePasswordStrength(value);
      }
    }
  }, [value, validation.isTouched, enableValidation, onValidationChange]);
  
  // Update password strength
  const updatePasswordStrength = (password: string) => {
    const score = calculatePasswordStrength(password);
    const strength = getPasswordStrength(score);
    
    // Update state
    setPasswordStrength(strength);
    
    // Animate width for smooth transition
    Animated.timing(animatedWidth, {
      toValue: strength.score,
      duration: 300,
      useNativeDriver: false, // width changes can't use native driver
    }).start();
  };
  
  // Handle text change
  const handleChangeText = (text: string) => {
    onChangeText(text);
    if (!validation.isTouched) {
      onValidationChange({
        ...validation,
        isTouched: true
      });
    }
  };
  
  // Handle reset
  const handleReset = () => {
    resetField();
    
    // Reset animated width with animation for smooth transition
    Animated.timing(animatedWidth, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };
  
  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View style={formStyles.inputContainer}>
      <Text style={formStyles.label}>{label}</Text>
      <View style={formStyles.inputWrapper}>
        <TextInput
          style={[
            formStyles.input,
            validation.isTouched && (
              validation.isValid 
                ? formStyles.validInput 
                : validation.errorMessage 
                  ? formStyles.invalidInput 
                  : null
            )
          ]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          secureTextEntry={!showPassword}
          {...rest}
        />
        {/* Password visibility toggle */}
        <TouchableOpacity 
          style={formStyles.visibilityToggle} 
          onPress={togglePasswordVisibility}
        >
          <Feather 
            name={showPassword ? "eye-off" : "eye"} 
            size={20} 
            color="#6B7280" 
          />
        </TouchableOpacity>
        
        {value.length > 0 && (
          <TouchableOpacity 
            style={
              // Use the appropriate style based on whether validation icon is present
              enableValidation && validation.isTouched && (validation.isValid || (!validation.isValid && value.length > 0))
                ? formStyles.resetButton  // Validation icon is present
                : formStyles.resetButtonNoValidation  // Validation icon is not present
            } 
            onPress={handleReset}
          >
            <Feather name="x" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
        
        {enableValidation && validation.isTouched && validation.isValid && (
          <View style={formStyles.validationIcon}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" />
          </View>
        )}
        
        {enableValidation && validation.isTouched && !validation.isValid && value.length > 0 && (
          <View style={formStyles.validationIcon}>
            <MaterialIcons name="error" size={20} color="#EF4444" />
          </View>
        )}
      </View>
      
      {validation.isTouched && validation.errorMessage ? (
        <Text style={formStyles.errorText}>{validation.errorMessage}</Text>
      ) : null}
      
      {/* Password strength meter */}
      {enableValidation && showStrengthMeter && value.length > 0 && (
        <View style={formStyles.passwordStrengthContainer}>
          <View style={formStyles.passwordStrengthLabels}>
            <Text style={formStyles.passwordStrengthText}>
              Password Strength:
            </Text>
            <Text style={[formStyles.passwordStrengthLevelText, { color: passwordStrength.color }]}>
              {passwordStrength.level === 0 ? "" :
               passwordStrength.level === 1 ? "Weak" :
               passwordStrength.level === 2 ? "Medium" :
               passwordStrength.level === 3 ? "Strong" : "Very Strong"}
            </Text>
          </View>
          <View style={formStyles.passwordStrengthTrack}>
            <Animated.View 
              style={[
                formStyles.passwordStrengthBar, 
                { 
                  width: animatedWidth.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  }),
                  backgroundColor: passwordStrength.color
                }
              ]} 
            />
          </View>
        </View>
      )}
    </View>
  );
};

export default PasswordField;