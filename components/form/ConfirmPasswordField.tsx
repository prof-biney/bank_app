import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { 
  FormFieldProps, 
  ConfirmPasswordValidationState, 
  validateConfirmPassword 
} from "./types";
import { useFormStyles } from "./styles";

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
    // Note: onValidationChange and validation are intentionally excluded from the dependency array
    // to prevent infinite render loops. onValidationChange is an inline function recreated on each render
    // of the parent component, and including the entire validation object would cause the effect to run
    // whenever any validation property changes, creating a potential loop when we update validation state.
  }, [value, password, validation.isTouched]);
  
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

  const styles = useFormStyles();
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            validation.isTouched && (
              validation.isValid 
                ? styles.validInput 
                : validation.isPartialMatch
                  ? styles.partialMatchInput
                  : validation.errorMessage 
                    ? styles.invalidInput 
                    : null
            )
          ]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={undefined}
          secureTextEntry={!showPassword}
          {...rest}
        />
        {/* Password visibility toggle */}
        <TouchableOpacity 
          style={styles.visibilityToggle} 
          onPress={togglePasswordVisibility}
        >
          <Feather 
            name={showPassword ? "eye-off" : "eye"} 
            size={20} 
            color={styles?.label?.color || '#6B7280'} 
          />
        </TouchableOpacity>
        
        {value.length > 0 && (
          <TouchableOpacity 
            style={
              // Use the appropriate style based on whether validation icon is present
              validation.isTouched && (validation.isValid || validation.isPartialMatch || (!validation.isValid && !validation.isPartialMatch && value.length > 0))
                ? styles.resetButton  // Validation icon is present
                : styles.resetButtonNoValidation  // Validation icon is not present
            } 
            onPress={resetField}
          >
            <Feather name="x" size={18} color={styles?.label?.color || '#6B7280'} />
          </TouchableOpacity>
        )}
        
        {validation.isTouched && validation.isValid && (
          <View style={styles.validationIcon}>
            <MaterialIcons name="check-circle" size={20} color={styles?.validInput?.borderColor || '#10B981'} />
          </View>
        )}
        
        {validation.isTouched && validation.isPartialMatch && (
          <View style={styles.validationIcon}>
            <MaterialIcons name="timelapse" size={20} color={styles?.partialMatchInput?.borderColor || '#F59E0B'} />
          </View>
        )}
        
        {validation.isTouched && !validation.isValid && 
          !validation.isPartialMatch && value.length > 0 && (
          <View style={styles.validationIcon}>
            <MaterialIcons name="error" size={20} color={styles?.invalidInput?.borderColor || '#EF4444'} />
          </View>
        )}
      </View>
      
      {validation.isTouched && validation.errorMessage ? (
        <Text style={styles.errorText}>{validation.errorMessage}</Text>
      ) : null}
    </View>
  );
};

export default ConfirmPasswordField;