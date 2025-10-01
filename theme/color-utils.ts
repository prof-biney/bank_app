export function withAlpha(hexOrRgba: string, alpha: number): string {
  // If already rgba(...), replace alpha
  const rgbaMatch = /^rgba?\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)(?:,(\s*[0-9.]+\s*))?\)$/i.exec(hexOrRgba);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // If hex like #RRGGBB or #RGB
  let hex = hexOrRgba.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) {
    // Fallback to original if not recognized
    return hexOrRgba;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function chooseReadableText(bgColor: string, light = '#FFFFFF', dark = '#0B1220'): string {
  // Very naive luminance approximation; sufficient for our accents
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(bgColor.trim());
  if (!hexMatch) return light;
  const hex = hexMatch[1];
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  // Relative luminance approximation
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.5 ? dark : light;
}

/**
 * Create a lighter/muted version of a color for inactive states
 * instead of using opacity which reduces visibility
 */
export function createMutedColor(color: string, surfaceColor: string = '#FFFFFF'): string {
  // Parse the color and surface color to RGB
  const parseColor = (colorStr: string) => {
    const hex = colorStr.replace('#', '');
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
    return { r: 255, g: 255, b: 255 }; // fallback to white
  };

  const colorRgb = parseColor(color);
  const surfaceRgb = parseColor(surfaceColor);

  // Blend the color with the surface to create a muted version
  // This is similar to opacity but maintains better visibility
  const blendFactor = 0.3; // Similar to 30% opacity but better visibility
  const r = Math.round(colorRgb.r * blendFactor + surfaceRgb.r * (1 - blendFactor));
  const g = Math.round(colorRgb.g * blendFactor + surfaceRgb.g * (1 - blendFactor));
  const b = Math.round(colorRgb.b * blendFactor + surfaceRgb.b * (1 - blendFactor));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Create a darker/more vibrant version of a color for active states
 */
export function createVibrancColor(color: string, factor: number = 0.15): string {
  const parseColor = (colorStr: string) => {
    const hex = colorStr.replace('#', '');
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
    return { r: 0, g: 0, b: 0 }; // fallback to black
  };

  const { r, g, b } = parseColor(color);
  
  // Make color more vibrant by adjusting towards extreme values
  const vibrateChannel = (channel: number) => {
    if (channel > 127) {
      // Light colors get lighter but not too much
      return Math.min(255, Math.round(channel + (255 - channel) * factor));
    } else {
      // Dark colors get darker
      return Math.max(0, Math.round(channel * (1 - factor)));
    }
  };

  const newR = vibrateChannel(r);
  const newG = vibrateChannel(g);
  const newB = vibrateChannel(b);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Get appropriate disabled colors that maintain visibility
 */
export function getDisabledColors(baseColor: string, surfaceColor: string = '#FFFFFF') {
  return {
    background: createMutedColor(baseColor, surfaceColor),
    text: createMutedColor('#000000', surfaceColor),
    border: createMutedColor('#cccccc', surfaceColor)
  };
}

