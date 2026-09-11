/**
 * WCAG contrast, in the one place that owns the arithmetic.
 *
 * The theme needs it to pick an accent's label colour; any component handed a
 * colour by its caller needs it for exactly the same reason. Two copies of this
 * would be two chances to get it subtly wrong, so there is one.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value
  const number = Number.parseInt(full, 16)
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
}

/** WCAG relative luminance — what decides whether ink is dark or light. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG contrast ratio between two hex colours, from 1 to 21.
 *
 * Exported because the question "is this readable on that?" comes up the
 * moment anyone picks an accent of their own, and the answer should not
 * need a second library.
 */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Black or white, whichever can be read on `background`.
 *
 * For any colour at all one of the two clears 4.58:1, because the two ratios
 * cross at a luminance of 0.229 — so this is a guarantee rather than a hope.
 * Use it wherever a caller supplies a colour and the component has to put text
 * on it: a fixed `text-white` hands unreadable labels to every bright hue.
 */
export function readableInk(background: string): '#ffffff' | '#000000' {
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
    ? '#000000'
    : '#ffffff'
}
