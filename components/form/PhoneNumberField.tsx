import React, { useEffect, useState, useRef } from "react";
import { 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  Animated,
  Modal,
  FlatList,
  Dimensions
} from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { 
  FormFieldProps, 
  PhoneNumberValidationState
} from "./types";
import { formStyles } from "./styles";
import { 
  parsePhoneNumberFromString, 
  getCountryCallingCode, 
  getExampleNumber, 
  getCountries 
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';

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

/**
 * Props for the PhoneNumberField component
 */
interface PhoneNumberFieldProps extends Omit<FormFieldProps, 'validation' | 'onValidationChange'> {
  /**
   * The validation state for the phone number field
   */
  validation: PhoneNumberValidationState;
  
  /**
   * Callback for when the validation state changes
   */
  onValidationChange: (validation: PhoneNumberValidationState) => void;
  
  /**
   * The country code (ISO 3166-1 alpha-2)
   */
  countryCode: string;
  
  /**
   * Callback for when the country code changes
   */
  onCountryCodeChange: (countryCode: string) => void;
}

/**
 * A reusable phone number input field component with country code selection
 */
const PhoneNumberField: React.FC<PhoneNumberFieldProps> = ({
  label = "Phone Number",
  value,
  onChangeText,
  validation,
  onValidationChange,
  resetField,
  countryCode,
  onCountryCodeChange,
  placeholder = "Enter phone number",
  ...rest
}) => {
  // Country selection modal visibility
  const [showCountryModal, setShowCountryModal] = useState(false);
  
  // Animated value for smooth width transition in digit count indicator
  const phoneAnimatedWidth = useRef(new Animated.Value(0)).current;
  
  // Phone number digit count state for animation
  const [phoneDigitProgress, setPhoneDigitProgress] = useState({
    percentage: 0, // 0-100 percentage
    color: "#EF4444", // Default to red (invalid)
  });
  
  // Get current country data
  const getCurrentCountry = () => countryData.find(country => country.code === countryCode) || countryData[0];
  
  // Validate phone number when value or country code changes
  useEffect(() => {
    if (validation.isTouched) {
      const phoneValidation = validatePhoneNumber(value, countryCode);
      
      onValidationChange({
        ...validation,
        isValid: phoneValidation.isValid,
        errorMessage: phoneValidation.message,
        digitCount: phoneValidation.digitCount,
        maxDigits: phoneValidation.maxDigits
      });
      
      // Update digit progress for animation
      updatePhoneDigitProgress(phoneValidation.digitCount, phoneValidation.maxDigits);
    }
    // Note: onValidationChange and validation are intentionally excluded from the dependency array
    // to prevent infinite render loops. onValidationChange is an inline function recreated on each render
    // of the parent component, and including the entire validation object would cause the effect to run
    // whenever any validation property changes, creating a potential loop when we update validation state.
  }, [value, countryCode, validation.isTouched]);
  
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
        maxDigits: validation.maxDigits
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
      console.log('Error validating phone number:', error);
      return { 
        isValid: false, 
        message: "Error validating phone number", 
        digitCount,
        maxDigits: validation.maxDigits
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
  
  // Function to update max digits based on country
  const updateMaxDigitsForCountry = (country: string) => {
    try {
      // Get example number for the country
      const exampleNumber = getExampleNumber(country, examples);
      
      if (exampleNumber) {
        // Get the national number (without country code)
        const nationalNumber = exampleNumber.nationalNumber;
        
        // Update validation state with the expected number of digits
        onValidationChange({
          ...validation,
          maxDigits: nationalNumber.length
        });
      }
    } catch (error) {
      console.log('Error getting example number:', error);
      // Default to 10 digits (US standard) if there's an error
      onValidationChange({
        ...validation,
        maxDigits: 10
      });
    }
  };
  
  // Handle text change
  const handleChangeText = (text: string) => {
    // Only allow digits, spaces, and dashes
    const formattedText = text.replace(/[^\d\s-]/g, '');
    
    // Limit input to max digits
    const digitsOnly = formattedText.replace(/\D/g, '');
    if (digitsOnly.length <= validation.maxDigits) {
      onChangeText(formattedText);
    }
    
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
  };
  
  // Handle country selection
  const handleCountrySelect = (code: string) => {
    onCountryCodeChange(code);
    updateMaxDigitsForCountry(code);
    setShowCountryModal(false);
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
        <View style={formStyles.modalOverlay}>
          <View style={formStyles.modalContainer}>
            <View style={formStyles.modalHeader}>
              <Text style={formStyles.modalTitle}>Select Country</Text>
              <TouchableOpacity 
                style={formStyles.modalCloseButton}
                onPress={() => setShowCountryModal(false)}
              >
                <Feather name="x" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={countryData}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={formStyles.countryItem}
                  onPress={() => handleCountrySelect(item.code)}
                >
                  <Text style={formStyles.countryFlag}>{item.flag}</Text>
                  <View style={formStyles.countryInfo}>
                    <Text style={formStyles.countryName}>{item.name}</Text>
                    <Text style={formStyles.countryCode}>+{getCountryCallingCode(item.code)}</Text>
                  </View>
                  {countryCode === item.code && (
                    <MaterialIcons name="check" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              )}
              style={formStyles.countryList}
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={formStyles.inputContainer}>
      <Text style={formStyles.label}>{label}</Text>
      <View style={formStyles.phoneInputContainer}>
        {/* Country code selector */}
        <TouchableOpacity 
          style={formStyles.countryCodeSelector}
          onPress={() => setShowCountryModal(true)}
        >
          <Text style={formStyles.countryFlag}>{getCurrentCountry().flag}</Text>
          <Text style={formStyles.countryCodeText}>+{getCountryCallingCode(countryCode)}</Text>
          <Feather name="chevron-down" size={16} color="#6B7280" />
        </TouchableOpacity>
        
        {/* Phone number input */}
        <View style={formStyles.phoneInputWrapper}>
          <TextInput
            style={[
              formStyles.phoneInput,
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
            keyboardType="phone-pad"
            {...rest}
          />
          {value.length > 0 && (
            <TouchableOpacity 
              style={formStyles.phoneResetButton} 
              onPress={handleReset}
            >
              <Feather name="x" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
          {validation.isTouched && validation.isValid && (
            <View style={formStyles.phoneValidationIcon}>
              <MaterialIcons name="check-circle" size={20} color="#10B981" />
            </View>
          )}
          {validation.isTouched && !validation.isValid && value.length > 0 && (
            <View style={formStyles.phoneValidationIcon}>
              <MaterialIcons name="error" size={20} color="#EF4444" />
            </View>
          )}
        </View>
      </View>
      
      {/* Digit count validator */}
      {value.length > 0 && (
        <View style={formStyles.phoneDigitContainer}>
          <View style={formStyles.phoneDigitLabels}>
            <Text style={formStyles.phoneDigitText}>
              Digit Count: {validation.digitCount}/{validation.maxDigits}
            </Text>
            <Text style={[formStyles.phoneDigitStatusText, { color: phoneDigitProgress.color }]}>
              {validation.digitCount === validation.maxDigits 
                ? "Complete" 
                : `${validation.maxDigits - validation.digitCount} more needed`}
            </Text>
          </View>
          <View style={formStyles.phoneDigitTrack}>
            <Animated.View 
              style={[
                formStyles.phoneDigitBar, 
                { 
                  width: phoneAnimatedWidth.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  }),
                  backgroundColor: phoneDigitProgress.color
                }
              ]} 
            />
          </View>
        </View>
      )}
      
      {validation.isTouched && validation.errorMessage ? (
        <Text style={formStyles.errorText}>{validation.errorMessage}</Text>
      ) : null}
      
      {/* Render the country selection modal */}
      {renderCountrySelectionModal()}
    </View>
  );
};

export default PhoneNumberField;