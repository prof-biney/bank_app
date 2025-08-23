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
  /** Apply standardized filter-action button sizing (chips in drawers/screens/modals) */
  isFilterAction?: boolean;
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
  isFilterAction = false,
}: Props) => {
  const { colors } = useTheme();
  const styles = getButtonStyles(colors, { variant, size, disabled: isLoading || disabled });
  // Filter action overrides: ensure fixed size and centering for chips
  const filterOverrides: ViewStyle | undefined = isFilterAction
    ? {
        width: 100,
        height: 40,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
      }
    : undefined;

  return (
    <TouchableOpacity
      style={[styles.container, filterOverrides as any, style]}
      onPress={onPress}
      disabled={isLoading || disabled}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {leftIcon ? <View style={{ marginRight: 6 }}>{leftIcon}</View> : null}
        {isLoading ? (
          <ActivityIndicator size="small" color={styles.text.color as string} />
        ) : (
          <Text
            numberOfLines={isFilterAction ? 1 : undefined}
            ellipsizeMode={isFilterAction ? 'tail' : 'clip'}
            style={[
              styles.text,
              isFilterAction ? { maxWidth: '100%', flexShrink: 1 } : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default CustomButton;
