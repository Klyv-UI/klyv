'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Select } from '../Select'

export type VisionSimulatorMode =
  | 'none'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia'
  | 'blur'
  | 'low-contrast'

export interface VisionSimulatorProps {
  /** The interface to preview. It is only filtered, never changed. */
  children: ReactNode
  /** The simulated condition. Omit to let the component manage it. */
  value?: VisionSimulatorMode
  /** Starting condition when uncontrolled. */
  defaultValue?: VisionSimulatorMode
  /** Called when the picker changes the condition. */
  onValueChange?: (value: VisionSimulatorMode) => void
  /** Show the built-in picker above the content. */
  showPicker?: boolean
  /** Accessible name of the picker. */
  label?: string
  /** Merged onto the wrapper. */
  className?: string
}

/**
 * Machado, Oliveira & Fernandes (2009), severity 1.0 — full dichromacy. They are
 * defined on linear RGB, which is what SVG filters work in by default.
 */
const MACHADO: Record<'protanopia' | 'deuteranopia' | 'tritanopia', string> = {
  protanopia: '0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0',
  deuteranopia: '0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0',
  tritanopia: '1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.303900 0 0  0 0 0 1 0',
}

/** Rec. 709 luminance on every channel: no hue at all. */
const ACHROMATOPSIA = '0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0'

const OPTIONS: { value: VisionSimulatorMode; label: string }[] = [
  { value: 'none', label: 'Typical vision' },
  { value: 'protanopia', label: 'Protanopia (no red cones)' },
  { value: 'deuteranopia', label: 'Deuteranopia (no green cones)' },
  { value: 'tritanopia', label: 'Tritanopia (no blue cones)' },
  { value: 'achromatopsia', label: 'Achromatopsia (no colour)' },
  { value: 'blur', label: 'Blurred vision' },
  { value: 'low-contrast', label: 'Low contrast sensitivity' },
]

/**
 * Shows an interface the way people with a colour-vision deficiency or low
 * vision see it, without leaving the page.
 *
 * “Is the red/green status readable?” is usually answered by guessing. This
 * wraps real content and runs it through SVG colour-matrix filters defined in
 * the page — the Machado et al. (2009) matrices for protanopia, deuteranopia
 * and tritanopia, a luminance matrix for achromatopsia, and a blur and a
 * contrast squeeze for low vision — so the answer is on screen. The content
 * stays live and interactive; only its pixels are filtered, and nothing in
 * the accessibility tree changes.
 */
export function VisionSimulator({
  children,
  value: valueProp,
  defaultValue = 'none',
  onValueChange,
  showPicker = true,
  label = 'Simulated vision',
  className,
}: VisionSimulatorProps) {
  const [own, setOwn] = useState<VisionSimulatorMode>(defaultValue)
  const value = valueProp ?? own
  // useId returns colons, which are not valid inside url(#…) without escaping.
  const base = `klyv-vision-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const change = (next: VisionSimulatorMode) => {
    if (valueProp === undefined) setOwn(next)
    onValueChange?.(next)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute size-0 overflow-hidden">
        <defs>
          {(Object.keys(MACHADO) as (keyof typeof MACHADO)[]).map((mode) => (
            <filter key={mode} id={`${base}-${mode}`}>
              <feColorMatrix type="matrix" values={MACHADO[mode]} />
            </filter>
          ))}
          <filter id={`${base}-achromatopsia`}>
            <feColorMatrix type="matrix" values={ACHROMATOPSIA} />
          </filter>
          <filter id={`${base}-blur`}>
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id={`${base}-low-contrast`} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.45" intercept="0.3" />
              <feFuncG type="linear" slope="0.45" intercept="0.3" />
              <feFuncB type="linear" slope="0.45" intercept="0.3" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      {showPicker && (
        <Select<VisionSimulatorMode> label={label} value={value} onValueChange={change} options={OPTIONS} className="self-start" />
      )}
      <div data-vision={value} style={value === 'none' ? undefined : { filter: `url(#${base}-${value})` }}>
        {children}
      </div>
    </div>
  )
}
