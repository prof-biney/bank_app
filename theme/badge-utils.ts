import { ThemeColors } from "@/context/ThemeContext";
import type { ChipTone, ChipSize } from "@/theme/variants";
import { withAlpha } from "@/theme/color-utils";

export type BadgeVisuals = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  rippleColor: string;
};

function toneBaseColor(colors: ThemeColors, tone: ChipTone): string {
  switch (tone) {
    case 'success':
      return colors.positive;
    case 'danger':
      return colors.negative;
    case 'warning':
      return colors.warning;
    case 'accent':
      return colors.tintPrimary;
    case 'neutral':
    default:
      return colors.tintPrimary; // neutral interactions still feel good with primary ripple
  }
}

export function getBadgeVisuals(
  colors: ThemeColors,
  opts: { tone: ChipTone; selected?: boolean; size?: ChipSize }
): BadgeVisuals {
  const { tone, selected = false } = opts;
  const base = toneBaseColor(colors, tone);
  const rippleColor = withAlpha(base, 0.12);
  if (selected) {
    return {
      backgroundColor: base,
      borderColor: base,
      textColor: '#fff',
      rippleColor,
    };
  }
  return {
    backgroundColor: withAlpha(base, 0.1),
    borderColor: withAlpha(base, 0.2),
    textColor: base,
    rippleColor,
  };
}

