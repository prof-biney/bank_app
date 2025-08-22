import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export type CardProps = {
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  padding?: number;
  radius?: number;
  elevation?: number;
  bordered?: boolean;
};

export default function Card({
  style,
  children,
  onPress,
  onLongPress,
  padding = 16,
  radius = 12,
  elevation = 2,
  bordered = true,
}: CardProps) {
  const { colors } = useTheme();

  const base: any = [
    styles.base,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      padding,
      borderRadius: radius,
      shadowOpacity: elevation > 0 ? 0.05 : 0,
      shadowRadius: elevation,
      elevation,
      borderWidth: bordered ? 1 : 0,
    },
  ];

  if (Array.isArray(style)) base.push(...style);
  else if (style) base.push(style);

  const Comp: any = onPress || onLongPress ? Pressable : View;

  return (
    <Comp style={base} onPress={onPress} onLongPress={onLongPress}>
      {children}
    </Comp>
  );
}

const styles = StyleSheet.create({
  base: {
    marginBottom: 16,
  },
});

