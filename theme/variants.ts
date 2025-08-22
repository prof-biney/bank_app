import { StyleSheet } from 'react-native';
import { ThemeColors } from '@/context/ThemeContext';
import { withAlpha, chooseReadableText } from '@/theme/color-utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export function getButtonStyles(colors: ThemeColors, opts: { variant?: ButtonVariant; size?: ButtonSize; disabled?: boolean } = {}) {
  const { variant = 'primary', size = 'md', disabled = false } = opts;

  const sizing = {
    sm: { height: 36, padH: 12, radius: 8, text: 14 },
    md: { height: 44, padH: 16, radius: 12, text: 16 },
    lg: { height: 52, padH: 20, radius: 14, text: 17 },
  }[size];

  let backgroundColor = 'transparent';
  let borderColor: string | undefined;
  let textColor = colors.textPrimary;

  switch (variant) {
    case 'primary':
      backgroundColor = colors.tintPrimary;
      textColor = chooseReadableText(colors.tintPrimary);
      break;
    case 'secondary':
      backgroundColor = colors.card;
      borderColor = colors.border;
      textColor = colors.textPrimary;
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      textColor = colors.tintPrimary;
      break;
    case 'danger':
      backgroundColor = colors.negative;
      textColor = chooseReadableText(colors.negative);
      break;
  }

  const container: any = {
    height: sizing.height,
    paddingHorizontal: sizing.padH,
    borderRadius: sizing.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor,
  };
  if (borderColor) {
    container.borderWidth = 1;
    container.borderColor = borderColor;
  }
  if (disabled) {
    container.opacity = 0.6;
  }

  const text = {
    fontSize: sizing.text,
    fontWeight: '700' as const,
    color: textColor,
  };

  return { container, text };
}

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export type ChipSize = 'sm' | 'md';

export function getChipStyles(colors: ThemeColors, opts: { tone?: ChipTone; size?: ChipSize; selected?: boolean } = {}) {
  const { tone = 'neutral', size = 'md', selected = false } = opts;

  const sizing = {
    sm: { height: 28, padH: 10, radius: 14, text: 12 },
    md: { height: 32, padH: 12, radius: 16, text: 13 },
  }[size];

  let bg = colors.card;
  let border = colors.border;
  let text = colors.textSecondary;

  const setSolid = (solid: string) => {
    bg = solid;
    border = solid;
    text = chooseReadableText(solid);
  };
  const setSoft = (toneColor: string, fallbackBg?: string) => {
    bg = fallbackBg || withAlpha(toneColor, 0.12);
    border = colors.border;
    text = toneColor;
  };

  switch (tone) {
    case 'neutral':
      if (selected) setSolid(colors.textSecondary); // subtle solid neutral
      else {
        bg = colors.card; border = colors.border; text = colors.textSecondary;
      }
      break;
    case 'accent':
      if (selected) setSolid(colors.tintPrimary);
      else { bg = colors.tintSoftBg; border = colors.border; text = colors.tintPrimary; }
      break;
    case 'success':
      if (selected) setSolid(colors.positive);
      else setSoft(colors.positive, withAlpha(colors.positive, 0.12));
      break;
    case 'warning':
      if (selected) setSolid(colors.warning);
      else setSoft(colors.warning, withAlpha(colors.warning, 0.12));
      break;
    case 'danger':
      if (selected) setSolid(colors.negative);
      else setSoft(colors.negative, withAlpha(colors.negative, 0.12));
      break;
  }

  return {
    container: {
      minHeight: sizing.height,
      paddingHorizontal: sizing.padH,
      borderRadius: sizing.radius,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: bg,
      borderColor: border,
      borderWidth: 1,
    },
    text: {
      fontSize: sizing.text,
      fontWeight: '600' as const,
      color: text,
    },
  };
}

