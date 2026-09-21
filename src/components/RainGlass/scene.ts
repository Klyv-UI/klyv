'use client'

import { rainGlassRandom } from './simulation'

/** The built-in backgrounds, drawn in code so the component needs no image and no network. */
export type RainGlassScene = 'city' | 'bokeh'

export type RainGlassRgb = [number, number, number]

export interface RainGlassPalette {
  dark: boolean
  surface: RainGlassRgb
  ink: RainGlassRgb
  accent: RainGlassRgb
  warning: RainGlassRgb
  danger: RainGlassRgb
  success: RainGlassRgb
}

const css = ([r, g, b]: RainGlassRgb, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`
const mix = (a: RainGlassRgb, b: RainGlassRgb, t: number): RainGlassRgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const WHITE: RainGlassRgb = [255, 255, 255]
const BLACK: RainGlassRgb = [0, 0, 0]

/** One out-of-focus light: a soft disc with the slightly brighter rim a real lens gives it. */
function bokeh(context: CanvasRenderingContext2D, x: number, y: number, r: number, colour: RainGlassRgb, alpha: number) {
  const fill = context.createRadialGradient(x, y, 0, x, y, r)
  fill.addColorStop(0, css(colour, alpha * 0.55))
  fill.addColorStop(0.72, css(colour, alpha * 0.7))
  fill.addColorStop(0.9, css(mix(colour, WHITE, 0.25), alpha * 0.85))
  fill.addColorStop(1, css(colour, 0))
  context.fillStyle = fill
  context.beginPath()
  context.arc(x, y, r, 0, Math.PI * 2)
  context.fill()
}

/**
 * Paint a built-in scene at the canvas’s size. Both scenes follow the theme: a night street on a dark page, a wet
 * overcast afternoon on a light one, lit in the accent and the status colours.
 */
export function paintRainGlassScene(canvas: HTMLCanvasElement, scene: RainGlassScene, palette: RainGlassPalette) {
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = canvas
  const random = rainGlassRandom(scene === 'city' ? 11 : 23)
  const { dark, surface, ink, accent, warning, danger, success } = palette
  const unit = Math.max(width, height) / 900

  // Sky: deep and cool at night, pale and bright by day, warmed at the horizon by the street.
  const night = mix(surface, BLACK, 0.55)
  const top = dark ? mix(night, accent, 0.06) : mix(surface, ink, 0.1)
  const horizon = dark ? mix(night, warning, 0.16) : mix(surface, accent, 0.18)
  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, css(top))
  sky.addColorStop(0.62, css(horizon))
  sky.addColorStop(1, css(dark ? mix(night, accent, 0.1) : mix(surface, ink, 0.2)))
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)

  const lights = [warning, accent, danger, WHITE, success, warning, WHITE]
  const pick = () => lights[Math.floor(random() * lights.length)]!

  if (scene === 'city') {
    // Two rows of buildings, the far one hazier, each with a grid of windows some of which are lit.
    for (const [depth, haze] of [
      [0.5, 0.55],
      [0.64, 0.2],
    ] as const) {
      let x = -random() * 40 * unit
      while (x < width) {
        const w = (50 + random() * 120) * unit
        const h = height * (0.25 + random() * 0.4) * (depth === 0.5 ? 1.2 : 0.9)
        const base = height * (depth + 0.1)
        const body = dark ? mix(mix(night, BLACK, 0.3), top, haze) : mix(mix(surface, ink, 0.5), horizon, haze)
        context.fillStyle = css(body)
        context.fillRect(x, base - h, w, h + height)
        const size = 6 * unit
        const gap = 7 * unit
        for (let wy = base - h + gap; wy < base - gap; wy += size + gap) {
          for (let wx = x + gap; wx < x + w - size; wx += size + gap) {
            if (random() > (dark ? 0.42 : 0.2)) continue
            const glow = mix(pick(), WHITE, 0.2)
            context.fillStyle = css(glow, (dark ? 0.55 : 0.35) * (0.5 + random() * 0.5) * (1 - haze * 0.6))
            context.fillRect(wx, wy, size, size * 1.3)
          }
        }
        x += w + random() * 12 * unit
      }
    }
    // The street: a wet band that reflects everything above it.
    const street = context.createLinearGradient(0, height * 0.72, 0, height)
    street.addColorStop(0, css(dark ? mix(night, BLACK, 0.4) : mix(surface, ink, 0.35)))
    street.addColorStop(1, css(dark ? mix(night, warning, 0.08) : mix(surface, ink, 0.2)))
    context.fillStyle = street
    context.fillRect(0, height * 0.74, width, height)
    // Headlights and tail lights as long smears, then the street lamps as big bokeh.
    context.globalCompositeOperation = dark ? 'lighter' : 'source-over'
    for (let i = 0; i < 26; i++) {
      const colour = random() < 0.5 ? danger : mix(warning, WHITE, 0.6)
      const y = height * (0.76 + random() * 0.16)
      const x = random() * width
      const length = (60 + random() * 180) * unit
      const smear = context.createLinearGradient(x, 0, x + length, 0)
      smear.addColorStop(0, css(colour, 0))
      smear.addColorStop(0.5, css(colour, dark ? 0.55 : 0.4))
      smear.addColorStop(1, css(colour, 0))
      context.fillStyle = smear
      context.fillRect(x, y, length, (2 + random() * 4) * unit)
    }
    for (let i = 0; i < 34; i++) {
      const y = height * (0.35 + random() * 0.6)
      bokeh(context, random() * width, y, (14 + random() * 46) * unit, pick(), dark ? 0.32 + random() * 0.3 : 0.22 + random() * 0.2)
    }
  } else {
    // Bokeh: layered discs, big and faint behind, small and bright in front.
    context.globalCompositeOperation = dark ? 'lighter' : 'source-over'
    for (let layer = 0; layer < 3; layer++) {
      const count = [18, 34, 50][layer]!
      for (let i = 0; i < count; i++) {
        const r = [90, 46, 20][layer]! * (0.6 + random() * 0.8) * unit
        const alpha = (dark ? [0.16, 0.28, 0.45] : [0.14, 0.22, 0.3])[layer]! * (0.6 + random() * 0.6)
        bokeh(context, random() * width, random() * height, r, pick(), alpha)
      }
    }
  }
  context.globalCompositeOperation = 'source-over'
}

/** Draw an image or canvas to cover the target, cropping the longer side, as `object-fit: cover` would. */
export function coverRainGlassImage(canvas: HTMLCanvasElement, source: CanvasImageSource, sw: number, sh: number) {
  const context = canvas.getContext('2d')
  if (!context || !sw || !sh) return
  const scale = Math.max(canvas.width / sw, canvas.height / sh)
  const w = sw * scale
  const h = sh * scale
  context.drawImage(source, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
}

/**
 * A wide, smooth blur by repeated halving and doubling. Works everywhere, unlike the canvas `filter` property, and
 * a chain of bilinear steps is close enough to a Gaussian for fogged glass.
 */
export function blurRainGlassImage(source: HTMLCanvasElement, target: HTMLCanvasElement, levels = 4) {
  const steps: HTMLCanvasElement[] = []
  let current: HTMLCanvasElement = source
  for (let i = 0; i < levels; i++) {
    const next = document.createElement('canvas')
    next.width = Math.max(1, Math.round(current.width / 2))
    next.height = Math.max(1, Math.round(current.height / 2))
    const context = next.getContext('2d')
    if (!context) break
    context.imageSmoothingQuality = 'high'
    context.drawImage(current, 0, 0, next.width, next.height)
    steps.push(next)
    current = next
  }
  for (let i = steps.length - 2; i >= 0; i--) {
    const up = steps[i]!
    const context = up.getContext('2d')!
    context.imageSmoothingQuality = 'high'
    context.drawImage(current, 0, 0, up.width, up.height)
    current = up
  }
  const context = target.getContext('2d')
  if (!context) return
  context.imageSmoothingQuality = 'high'
  context.drawImage(current, 0, 0, target.width, target.height)
}
