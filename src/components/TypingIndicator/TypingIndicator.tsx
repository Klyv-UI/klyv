import type { CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface TypingIndicatorProps {
  /** Who is typing, in the order they started. Empty renders nothing. */
  names: string[]
  /** Names listed before the rest become a count. */
  max?: number
  /** Dots only, for a compact row. */
  dotsOnly?: boolean
  size?: 'sm' | 'md'
  /** Merged last, so it wins. */
  className?: string
}

/** "Sarah", "Sarah and Max", "Sarah, Max and 2 others". */
function phrase(names: string[], max: number): string {
  if (names.length === 1) return `${names[0]} is typing`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`
  if (names.length <= max) {
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing`
  }
  const rest = names.length - max
  return `${names.slice(0, max).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'} are typing`
}

/**
 * Three dots and a sentence saying who is writing.
 *
 * It renders nothing at all when nobody is typing, rather than an empty row
 * reserving space. A typing indicator that leaves a gap behind makes the
 * message list jump every time someone pauses.
 *
 * The sentence is built rather than templated, because "Sarah is typing",
 * "Sarah and Max are typing" and "Sarah, Max and 2 others are typing" are three
 * different grammatical shapes, and the usual `${names.join(', ')} are typing`
 * produces "Sarah are typing" for the commonest case of all.
 *
 * The live region is `aria-live="off"`. This is the rare case where announcing
 * every change is worse than staying quiet: typing starts and stops constantly,
 * and a screen reader narrating each transition would drown out the messages
 * themselves. The text is there to be read on demand, not pushed.
 */
export function TypingIndicator({
  names,
  max = 3,
  dotsOnly = false,
  size = 'md',
  className,
}: TypingIndicatorProps) {
  if (names.length === 0) return null

  const dot = size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'

  return (
    <div
      aria-live="off"
      className={cn('inline-flex items-center gap-2', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-surface-muted',
          size === 'sm' ? 'px-2 py-1.5' : 'px-2.5 py-2',
        )}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn('motion-safe-only inline-block rounded-full bg-ink-soft', dot)}
            style={
              {
                animation: 'typing-dot 1.2s ease-in-out infinite',
                animationDelay: `${index * 0.16}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>

      {!dotsOnly && (
        <Text size={size === 'sm' ? 'micro' : 'caption'} tone="soft" truncate>
          {phrase(names, max)}
        </Text>
      )}
    </div>
  )
}
