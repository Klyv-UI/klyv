'use client'

import { useMemo } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<AvatarSize, number> = { xs: 28, sm: 36, md: 40, lg: 48 }

/** Deterministic soft tint, so a person keeps the same colour everywhere. */
const TINTS = [
  'bg-[#F0E7DC] text-[#6E563E]',
  'bg-[#E6EDD9] text-[#556731]',
  'bg-[#E8E9E4] text-[#5F6359]',
  'bg-[#EFE6E0] text-[#745749]',
]

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export interface AvatarProps {
  /** Full name — drives the initials, the tint and the accessible name. */
  name: string
  src?: string
  size?: AvatarSize
  /** White halo, for avatars sitting on a busy surface. */
  ring?: boolean
  /** Merged last, so it wins. */
  className?: string
}

export function Avatar({ name, src, size = 'sm', ring = false, className }: AvatarProps) {
  const tint = useMemo(() => {
    const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
    return TINTS[sum % TINTS.length]
  }, [name])

  const px = SIZES[size]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold',
        !src && tint,
        ring && 'ring-2 ring-white',
        className,
      )}
      style={{ width: px, height: px, fontSize: Math.round(px * 0.36) }}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
      <VisuallyHidden>{name}</VisuallyHidden>
    </span>
  )
}
