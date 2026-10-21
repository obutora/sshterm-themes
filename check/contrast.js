// WCAG 2 contrast: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

/** The gallery's least contrast of the 前景 on the 背景. */
export const MIN_CONTRAST = 4.5;

const channels = (hex) => [1, 3, 5, 7].map((i) => parseInt(hex.slice(i, i + 2) || 'FF', 16));

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * The contrast ratio (1–21) of [foreground] on [background], both `#RRGGBB`
 * or `#RRGGBBAA`. The 前景 is laid over the 背景 by its opacity; the 背景's
 * own opacity is not counted (what is behind the terminal is not known).
 */
export function contrastRatio(foreground, background) {
  const [fr, fg, fb, fa] = channels(foreground);
  const bg = channels(background).slice(0, 3);
  const a = fa / 255;
  const over = [fr, fg, fb].map((c, i) => c * a + bg[i] * (1 - a));
  const [hi, lo] = [luminance(over), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
