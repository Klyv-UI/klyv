import type { ComponentType } from 'react'

/**
 * Structural type for an icon component. Matches `lucide-react`'s `LucideIcon`
 * without importing it, so the library stays icon-library agnostic.
 */
export type IconComponent = ComponentType<{
  size?: number | string
  strokeWidth?: number | string
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

/** Sizing scale shared by the controls that support more than one size. */
export type ControlSize = 'sm' | 'md'
