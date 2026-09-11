import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'

export type IconTileTone = 'muted' | 'accent'
export type IconTileSize = 'sm' | 'md' | 'lg'

const SIZES: Record<IconTileSize, number> = { sm: 28, md: 36, lg: 44 }

export interface IconTileProps {
  icon: IconComponent
  tone?: IconTileTone
  size?: IconTileSize
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Static rounded glyph plate that identifies a row or tile. Decorative by
 * design — the row's own text carries the meaning, so it is `aria-hidden`.
 */
export function IconTile({ icon: Icon, tone = 'muted', size = 'md', className }: IconTileProps) {
  const px = SIZES[size]

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-glyph)]',
        tone === 'accent' ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-ink',
        className,
      )}
      style={{ width: px, height: px }}
    >
      <Icon size={Math.round(px * 0.5)} strokeWidth={2} />
    </span>
  )
}
