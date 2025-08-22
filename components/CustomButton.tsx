import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View, StyleProp, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { getButtonStyles, ButtonVariant, ButtonSize } from "@/theme/variants";

type Props = {
  onPress?: () => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
  isLoading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
};

const CustomButton = ({
  onPress,
  title = "Click Me",
  style,
  textStyle,
  leftIcon,
  isLoading = false,
  variant = "primary",
  size = "md",
  disabled = false,
}: Props) => {
  const { colors } = useTheme();
  const styles = getButtonStyles(colors, { variant, size, disabled: isLoading || disabled });
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      disabled={isLoading || disabled}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {leftIcon ? <View style={{ marginRight: 6 }}>{leftIcon}</View> : null}
        {isLoading ? (
          <ActivityIndicator size="small" color={styles.text.color as string} />
        ) : (
          <Text style={[styles.text, textStyle]}>{title}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default CustomButton;
