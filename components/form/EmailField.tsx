import React, { useEffect } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { FormFieldProps, ValidationState, validateEmail } from "./types";
import { useFormStyles } from "./styles";
import { useTheme } from "@/context/ThemeContext";

/**
 * Props for the EmailField component
 */
interface EmailFieldProps extends FormFieldProps {}

/**
 * A reusable email input field component with validation
 */
const EmailField: React.FC<EmailFieldProps> = ({
  label = "Email",
  value,
  onChangeText,
  validation,
  onValidationChange,
  resetField,
  placeholder = "Enter your email",
  ...rest
}) => {
  // Validate email when value changes
  useEffect(() => {
    if (validation.isTouched) {
      const emailValidation = validateEmail(value);
      onValidationChange({
        ...validation,
        isValid: emailValidation.isValid,
        errorMessage: emailValidation.message
      });
    }
    // Note: onValidationChange and validation are intentionally excluded from the dependency array
    // to prevent infinite render loops. onValidationChange is an inline function recreated on each render
    // of the parent component, and including the entire validation object would cause the effect to run
    // whenever any validation property changes, creating a potential loop when we update validation state.
  }, [value, validation.isTouched]);

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

  const styles = useFormStyles();
  const { colors } = useTheme();
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
                : validation.errorMessage 
                  ? styles.invalidInput 
                  : null
            )
          ]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          {...rest}
        />
        {value.length > 0 && (
          <TouchableOpacity 
            style={styles.emailResetButton} 
            onPress={resetField}
          >
            <Feather name="x" size={18} color={styles?.label?.color || '#6B7280'} />
          </TouchableOpacity>
        )}
        {validation.isTouched && validation.isValid && (
          <View style={styles.emailValidationIcon}>
            <MaterialIcons name="check-circle" size={20} color={styles?.validInput?.borderColor || '#10B981'} />
          </View>
        )}
        {validation.isTouched && !validation.isValid && value.length > 0 && (
          <View style={styles.emailValidationIcon}>
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

export default EmailField;