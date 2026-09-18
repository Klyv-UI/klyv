'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface BlurHashImageSource {
  /** RGBA bytes, four per pixel, row by row — an `ImageData` qualifies. */
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export interface BlurHashImageProps {
  /** The BlurHash string, usually stored next to the image URL. */
  hash: string
  /** The real image. */
  src: string
  /** Describes the real image. */
  alt: string
  /** Intrinsic width. With `height`, sets the box's aspect ratio so nothing shifts on load. */
  width: number
  height: number
  /** Contrast of the placeholder. 1 is as encoded; higher is punchier. */
  punch?: number
  /** Width in pixels the placeholder is decoded at before being scaled up. */
  resolution?: number
  /** Called once the real image has loaded. */
  onLoad?: () => void
  /** Merged last, so it wins. */
  className?: string
}

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

const decode83 = (text: string) => [...text].reduce((value, char) => {
  const digit = DIGITS.indexOf(char)
  if (digit === -1) throw new Error(`Invalid BlurHash character “${char}”`)
  return value * 83 + digit
}, 0)

const encode83 = (value: number, length: number) => {
  let out = ''
  for (let i = 1; i <= length; i += 1) out += DIGITS[Math.floor(value / 83 ** (length - i)) % 83]
  return out
}

const toLinear = (value: number) => {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toSrgb = (value: number) => {
  const v = Math.max(0, Math.min(1, value))
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255)
}
const signPow = (value: number, exponent: number) => Math.sign(value) * Math.abs(value) ** exponent

/**
 * RGBA pixels, `width` × `height`, from a BlurHash string.
 *
 * The hash is a handful of DCT coefficients in base 83: one character for the
 * component counts, one for the AC scale, four for the average colour, then
 * two per remaining component. Decoding sums those cosines at every pixel.
 */
export function decodeBlurHash(hash: string, width: number, height: number, punch = 1): Uint8ClampedArray {
  const sizeFlag = decode83(hash[0] ?? '')
  const countY = Math.floor(sizeFlag / 9) + 1
  const countX = (sizeFlag % 9) + 1
  if (hash.length !== 4 + 2 * countX * countY) throw new Error('BlurHash length does not match its component count')
  const maximum = ((decode83(hash[1]) + 1) / 166) * punch

  const colours: [number, number, number][] = []
  const dc = decode83(hash.slice(2, 6))
  colours.push([toLinear(dc >> 16), toLinear((dc >> 8) & 255), toLinear(dc & 255)])
  for (let i = 1; i < countX * countY; i += 1) {
    const value = decode83(hash.slice(4 + i * 2, 6 + i * 2))
    const channel = (quantised: number) => signPow((quantised - 9) / 9, 2) * maximum
    colours.push([channel(Math.floor(value / 361)), channel(Math.floor(value / 19) % 19), channel(value % 19)])
  }

  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      for (let j = 0; j < countY; j += 1) {
        for (let i = 0; i < countX; i += 1) {
          const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height)
          const colour = colours[i + j * countX]
          r += colour[0] * basis
          g += colour[1] * basis
          b += colour[2] * basis
        }
      }
      const at = 4 * (x + y * width)
      pixels[at] = toSrgb(r)
      pixels[at + 1] = toSrgb(g)
      pixels[at + 2] = toSrgb(b)
      pixels[at + 3] = 255
    }
  }
  return pixels
}

/**
 * A BlurHash string for an image. Encode a small copy — 32 to 64 pixels
 * across — since the hash keeps only the lowest frequencies anyway and the
 * cost grows with every pixel.
 */
export function encodeBlurHash(image: BlurHashImageSource, componentsX = 4, componentsY = 3): string {
  if (componentsX < 1 || componentsX > 9 || componentsY < 1 || componentsY > 9) throw new Error('BlurHash components must be 1 to 9')
  const { data, width, height } = image
  const factors: [number, number, number][] = []
  for (let j = 0; j < componentsY; j += 1) {
    for (let i = 0; i < componentsX; i += 1) {
      const normalisation = i === 0 && j === 0 ? 1 : 2
      let r = 0
      let g = 0
      let b = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const basis = normalisation * Math.cos((Math.PI * i * x) / width) * Math.cos((Math.PI * j * y) / height)
          const at = 4 * (x + y * width)
          r += basis * toLinear(data[at])
          g += basis * toLinear(data[at + 1])
          b += basis * toLinear(data[at + 2])
        }
      }
      const scale = 1 / (width * height)
      factors.push([r * scale, g * scale, b * scale])
    }
  }

  const [dc, ...ac] = factors
  let hash = encode83(componentsX - 1 + (componentsY - 1) * 9, 1)
  let maximum = 1
  if (ac.length) {
    const actual = Math.max(...ac.flat().map(Math.abs))
    const quantised = Math.max(0, Math.min(82, Math.floor(actual * 166 - 0.5)))
    maximum = (quantised + 1) / 166
    hash += encode83(quantised, 1)
  } else hash += encode83(0, 1)
  hash += encode83((toSrgb(dc[0]) << 16) + (toSrgb(dc[1]) << 8) + toSrgb(dc[2]), 4)
  const quantise = (value: number) => Math.max(0, Math.min(18, Math.floor(signPow(value / maximum, 0.5) * 9 + 9.5)))
  for (const [r, g, b] of ac) hash += encode83(quantise(r) * 361 + quantise(g) * 19 + quantise(b), 2)
  return hash
}

/**
 * An image that shows a blurred impression of itself while it loads.
 *
 * A grey box says “something is coming”; a BlurHash says what — the colours
 * and rough layout of the photo — in about thirty characters that can travel
 * inside the JSON that already lists the image. It is decoded here at a few
 * dozen pixels and scaled up by the browser, which does the blurring for free.
 *
 * The box takes its aspect ratio from `width` and `height`, so the page does
 * not move when the image arrives, and the real image fades in over the
 * placeholder — or simply appears, under reduced motion.
 */
export function BlurHashImage({ hash, src, alt, width, height, punch = 1, resolution = 32, onLoad, className }: BlurHashImageProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const placeholderWidth = Math.max(4, Math.round(resolution))
  const placeholderHeight = Math.max(4, Math.round((resolution * height) / width))

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    try {
      const pixels = decodeBlurHash(hash, placeholderWidth, placeholderHeight, punch)
      const frame = context.createImageData(placeholderWidth, placeholderHeight)
      frame.data.set(pixels)
      context.putImageData(frame, 0, 0)
    } catch {
      context.clearRect(0, 0, placeholderWidth, placeholderHeight)
    }
  }, [hash, placeholderWidth, placeholderHeight, punch])

  useEffect(() => {
    // A cached image can finish before React attaches onLoad.
    const node = image.current
    setLoaded(Boolean(node?.complete && node.naturalWidth))
  }, [src])

  return (
    <div className={cn('relative w-full overflow-hidden rounded-[var(--radius-card)] bg-surface-sunken', className)} style={{ aspectRatio: `${width} / ${height}` }}>
      <canvas ref={canvas} width={placeholderWidth} height={placeholderHeight} aria-hidden="true" className="absolute inset-0 size-full" />
      <img
        ref={image}
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        onLoad={() => {
          setLoaded(true)
          onLoad?.()
        }}
        className={cn(
          'absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
