import React, { useEffect } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { FormFieldProps, ValidationState, validateName } from "./types";
import { formStyles } from "./styles";

/**
 * Props for the FullNameField component
 */
interface FullNameFieldProps extends FormFieldProps {}

/**
 * A reusable full name input field component with validation
 */
const FullNameField: React.FC<FullNameFieldProps> = ({
  label = "Full Name",
  value,
  onChangeText,
  validation,
  onValidationChange,
  resetField,
  placeholder = "Enter your full name",
  ...rest
}) => {
  // Validate name when value changes
  useEffect(() => {
    if (validation.isTouched) {
      const nameValidation = validateName(value);
      onValidationChange({
        ...validation,
        isValid: nameValidation.isValid,
        errorMessage: nameValidation.message
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
          {...rest}
        />
        {value.length > 0 && (
          <TouchableOpacity 
            style={formStyles.nameResetButton} 
            onPress={resetField}
          >
            <Feather name="x" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
        {validation.isTouched && validation.isValid && (
          <View style={formStyles.nameValidationIcon}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" />
          </View>
        )}
        {validation.isTouched && !validation.isValid && value.length > 0 && (
          <View style={formStyles.nameValidationIcon}>
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

export default FullNameField;