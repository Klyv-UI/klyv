'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  value: number
  min?: number
  max?: number
}

/**
 * A native range input restyled against the track tokens. The filled portion
 * is painted with a gradient so the fill matches on every browser without a
 * second element to keep in sync.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, value, min = 0, max = 100, disabled, style, ...props },
  ref,
) {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100

  return (
    <input
      type="range"
      ref={ref}
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      style={{
        background: `linear-gradient(to right, var(--color-accent-strong) ${percent}%, var(--color-line-strong) ${percent}%)`,
        ...style,
      }}
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full',
        '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none',
        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
        '[&::-webkit-slider-thumb]:shadow-[var(--shadow-float)]',
        '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full',
        '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
        '[&::-moz-range-thumb]:shadow-[var(--shadow-float)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
})
