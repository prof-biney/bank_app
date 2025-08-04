import React, { useEffect } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { FormFieldProps, ValidationState, validateEmail } from "./types";
import { formStyles } from "./styles";

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
    // Note: onValidationChange is intentionally excluded from the dependency array
    // to prevent infinite render loops, as it's an inline function recreated on each render
    // of the parent component
  }, [value, validation.isTouched, validation]);

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
          keyboardType="email-address"
          autoCapitalize="none"
          {...rest}
        />
        {value.length > 0 && (
          <TouchableOpacity 
            style={formStyles.emailResetButton} 
            onPress={resetField}
          >
            <Feather name="x" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
        {validation.isTouched && validation.isValid && (
          <View style={formStyles.emailValidationIcon}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" />
          </View>
        )}
        {validation.isTouched && !validation.isValid && value.length > 0 && (
          <View style={formStyles.emailValidationIcon}>
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

export default EmailField;