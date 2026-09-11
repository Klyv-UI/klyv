import { cn } from '../../lib/cn'
import { Avatar, type AvatarSize } from '../Avatar'
import { VisuallyHidden } from '../VisuallyHidden'

const OVERLAP: Record<AvatarSize, string> = {
  xs: '-ml-2',
  sm: '-ml-2.5',
  md: '-ml-3',
  lg: '-ml-3.5',
}

const PX: Record<AvatarSize, number> = { xs: 28, sm: 36, md: 40, lg: 48 }

export interface AvatarGroupProps {
  /** People, in display order. */
  people: { name: string; src?: string }[]
  /** How many to draw before collapsing the rest into a count. */
  max?: number
  size?: AvatarSize
  /** Accessible name for the group. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Overlapping avatars with an overflow count. The hidden names stay in the
 * accessibility tree, so the count is never the only way to know who is in it.
 */
export function AvatarGroup({ people, max = 4, size = 'sm', label, className }: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const hidden = people.slice(max)
  const px = PX[size]

  return (
    <span role="group" aria-label={label} className={cn('inline-flex items-center', className)}>
      {shown.map((person, index) => (
        <span key={person.name} className={index === 0 ? undefined : OVERLAP[size]}>
          <Avatar name={person.name} src={person.src} size={size} ring />
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-muted font-bold text-ink-soft ring-2 ring-white',
            OVERLAP[size],
          )}
          style={{ width: px, height: px, fontSize: Math.round(px * 0.32) }}
        >
          <span aria-hidden="true">+{hidden.length}</span>
          <VisuallyHidden>{hidden.map((person) => person.name).join(', ')}</VisuallyHidden>
        </span>
      )}
    </span>
  )
}
