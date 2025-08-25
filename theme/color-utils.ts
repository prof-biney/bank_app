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

