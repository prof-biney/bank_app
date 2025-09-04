import { StyleSheet, Dimensions } from "react-native";
import { useMemo } from "react";
import { useTheme } from "@/context/ThemeContext";

/**
 * Theme-aware shared styles for form field components
 */
export const useFormStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
    // Container for the entire input field
    inputContainer: {
      marginBottom: 20,
    },

    // Label for the input field
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },

    // Wrapper for the input field and icons
    inputWrapper: {
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
    },

    // Base input field style
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      paddingRight: 40,
      shadowColor: colors.shadowColor,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },

    // Valid input style
    validInput: {
      borderColor: colors.positive, // Green border for valid input
    },

    // Partial match input style (for confirm password)
    partialMatchInput: {
      borderColor: colors.warning, // Amber border for partial match
    },

    // Invalid input style
    invalidInput: {
      borderColor: colors.negative, // Red border for invalid input
    },

    // Reset button (cross icon)
    resetButton: {
      position: "absolute",
      right: 58, // Default position when validation icon is present
      padding: 4,
    },

    // Reset button when validation icon is not present
    resetButtonNoValidation: {
      position: "absolute",
      right: 36, // Takes the position of the validation icon
      padding: 4,
    },

    // Visibility toggle button (eye icon)
    visibilityToggle: {
      position: "absolute",
      right: 12, // Moved from 68 to 12 (where checkmark/info icons were)
      padding: 4,
    },

    // Validation icon (checkmark/error)
    validationIcon: {
      position: "absolute",
      right: 36, // Moved from 12 to 36 (where cross icon was)
      padding: 4,
    },

    // Error text
    errorText: {
      color: colors.negative,
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
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
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
      backgroundColor: colors.inputBackground,
      marginRight: 8,
      minWidth: 80,
      shadowColor: colors.shadowColor,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },

    countryFlag: {
      fontSize: 20,
      marginRight: 8,
    },

    countryCodeText: {
      fontSize: 16,
      color: colors.textSecondary,
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
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      paddingRight: 40,
      shadowColor: colors.shadowColor,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
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
      color: colors.textSecondary,
    },

    phoneDigitStatusText: {
      fontSize: 12,
      fontWeight: "600",
    },

    phoneDigitTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: "hidden",
    },

    phoneDigitBar: {
      height: "100%",
      borderRadius: 3,
      // Width and backgroundColor are set dynamically
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
      color: colors.textSecondary,
    },

    passwordStrengthLevelText: {
      fontSize: 12,
      fontWeight: "600",
    },

    passwordStrengthTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: "hidden",
    },

    passwordStrengthBar: {
      height: "100%",
      borderRadius: 3,
      // Width and backgroundColor are set dynamically
    },

    // Country selection modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },

    modalContainer: {
      width: Dimensions.get("window").width * 0.9,
      maxHeight: Dimensions.get("window").height * 0.7,
      backgroundColor: colors.modalBackground,
      borderRadius: 20,
      overflow: "hidden",
      shadowColor: colors.shadowColor,
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    },

    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
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
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },

    countryInfo: {
      flex: 1,
      marginLeft: 12,
    },

    countryName: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "500",
    },

    countryCode: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
  }), [colors]);
};
