'use client'

import { useEffect, useState } from 'react'
import { onModeChange, onThemeChange } from '../theme'

/**
 * The pixel plumbing the image components share.
 *
 * Each of them starts the same way — decode a URL into pixels at a working
 * size, read a colour token as RGB for a canvas that cannot use CSS, and
 * repaint when the theme changes — and each of those has one subtle part
 * (cross-origin taint, a token written as `oklch()` or `color-mix()`, a theme
 * change that fires as a mode switch instead). One copy gets them right once.
 */

/** A decoded image and the pixels of its working copy. */
export interface LoadedPixels {
  image: HTMLImageElement
  /** Pixels at the working size: the natural size scaled so its long side is at most `maxSide`. */
  pixels: ImageData
  naturalWidth: number
  naturalHeight: number
}

/** Decode `src` and read its pixels, scaled down so the longer side is at most `maxSide`. */
export function loadPixels(src: string, maxSide = 720): Promise<LoadedPixels> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      const naturalWidth = image.naturalWidth || image.width
      const naturalHeight = image.naturalHeight || image.height
      if (!naturalWidth || !naturalHeight) return reject(new Error('The image has no size.'))
      const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(naturalHeight * scale))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return reject(new Error('This browser cannot draw on a canvas.'))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      try {
        resolve({ image, pixels: context.getImageData(0, 0, canvas.width, canvas.height), naturalWidth, naturalHeight })
      } catch {
        reject(new Error('The image is from another origin that does not allow its pixels to be read.'))
      }
    }
    image.onerror = () => reject(new Error('The image could not be decoded.'))
    image.src = src
  })
}

/**
 * A colour token resolved to RGB channels, by painting it into one pixel.
 * Works for any colour syntax the browser understands, including `oklch()` and `color-mix()`.
 */
export function tokenRgb(element: Element, name: string, fallback: [number, number, number]): [number, number, number] {
  const value = getComputedStyle(element).getPropertyValue(name).trim()
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const context = probe.getContext('2d', { willReadFrequently: true })
  if (!context || !value) return fallback
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/** A number that changes whenever the theme, accent or light/dark mode does — a dependency to repaint on. */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((value) => value + 1)
    const offTheme = onThemeChange(bump)
    const offMode = onModeChange(bump)
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', bump)
    return () => {
      offTheme()
      offMode()
      scheme.removeEventListener('change', bump)
    }
  }, [])
  return version
}

/**
 * Yield to the browser so a long computation can continue without freezing
 * input. A macrotask rather than an animation frame: frames stop in a hidden
 * tab, and the work should still finish there.
 */
export const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
