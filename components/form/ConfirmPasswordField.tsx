import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { 
  FormFieldProps, 
  ConfirmPasswordValidationState, 
  validateConfirmPassword 
} from "./types";
import { formStyles } from "./styles";

/**
 * Props for the ConfirmPasswordField component
 */
interface ConfirmPasswordFieldProps extends Omit<FormFieldProps, 'validation' | 'onValidationChange'> {
  /**
   * The password to match against
   */
  password: string;
  
  /**
   * The validation state for the confirm password field
   */
  validation: ConfirmPasswordValidationState;
  
  /**
   * Callback for when the validation state changes
   */
  onValidationChange: (validation: ConfirmPasswordValidationState) => void;
}

/**
 * A reusable confirm password input field component with visibility toggle and validation
 */
const ConfirmPasswordField: React.FC<ConfirmPasswordFieldProps> = ({
  label = "Confirm Password",
  value,
  password,
  onChangeText,
  validation,
  onValidationChange,
  resetField,
  placeholder = "Confirm your password",
  ...rest
}) => {
  // State for password visibility
  const [showPassword, setShowPassword] = useState(false);
  
  // Validate confirm password when value or password changes
  useEffect(() => {
    if (validation.isTouched) {
      const confirmPasswordValidation = validateConfirmPassword(password, value);
      onValidationChange({
        ...validation,
        isValid: confirmPasswordValidation.isValid,
        errorMessage: confirmPasswordValidation.message,
        isPartialMatch: confirmPasswordValidation.isPartialMatch
      });
    }
    // Note: onValidationChange is intentionally excluded from the dependency array
    // to prevent infinite render loops, as it's an inline function recreated on each render
    // of the parent component
  }, [value, password, validation.isTouched, validation]);
  
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
                : validation.isPartialMatch
                  ? formStyles.partialMatchInput
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
              validation.isTouched && (validation.isValid || validation.isPartialMatch || (!validation.isValid && !validation.isPartialMatch && value.length > 0))
                ? formStyles.resetButton  // Validation icon is present
                : formStyles.resetButtonNoValidation  // Validation icon is not present
            } 
            onPress={resetField}
          >
            <Feather name="x" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
        
        {validation.isTouched && validation.isValid && (
          <View style={formStyles.validationIcon}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" />
          </View>
        )}
        
        {validation.isTouched && validation.isPartialMatch && (
          <View style={formStyles.validationIcon}>
            <MaterialIcons name="timelapse" size={20} color="#F59E0B" />
          </View>
        )}
        
        {validation.isTouched && !validation.isValid && 
          !validation.isPartialMatch && value.length > 0 && (
          <View style={formStyles.validationIcon}>
            <MaterialIcons name="error" size={20} color="#EF4444" />
          </View>
        )}
      </View>
      
      {validation.isTouched && validation.errorMessage ? (
        <Text style={formStyles.errorText}>{validation.errorMessage}</Text>
      ) : null}
    </View>
  );
};

export default ConfirmPasswordField;