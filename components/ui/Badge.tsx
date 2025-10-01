import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { createVibrancColor } from "@/theme/color-utils";

interface BadgeProps {
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  bordered?: boolean;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  paddingHorizontal?: number;
  paddingVertical?: number;
  marginRight?: number;
  marginBottom?: number;
  radius?: number;
  style?: any;
  textStyle?: any;
  testID?: string;
}

export default function Badge({
  label,
  children,
  onPress,
  bordered = true,
  borderColor,
  backgroundColor,
  textColor,
  paddingHorizontal = 5,
  paddingVertical = 5,
  marginRight = 5,
  marginBottom = 5,
  radius = 14,
  style,
  textStyle,
  testID,
}: BadgeProps) {
  const { colors } = useTheme();
  const containerStyle: any = {
    backgroundColor: backgroundColor ?? colors.card,
    borderColor: borderColor ?? colors.border,
    borderWidth: bordered ? 1 : 0,
    paddingHorizontal,
    paddingVertical,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight,
    marginBottom,
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          containerStyle, 
          pressed && { 
            backgroundColor: createVibrancColor(backgroundColor ?? colors.card, 0.1),
            borderColor: createVibrancColor(borderColor ?? colors.border, 0.1)
          }, 
          style
        ]}
      >
        {label ? (
          <Text style={[{ color: textColor ?? colors.textSecondary, fontWeight: '600', fontSize: 13 }, textStyle]}>{label}</Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[containerStyle, style]}>
      {label ? (
        <Text style={[{ color: textColor ?? colors.textSecondary, fontWeight: '600', fontSize: 13 }, textStyle]}>{label}</Text>
      ) : (
        children
      )}
    </View>
  );
}

