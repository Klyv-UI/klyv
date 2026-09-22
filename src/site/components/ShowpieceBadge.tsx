import { Sparkles } from 'lucide-react'
import { cn } from 'klyvui'

/**
 * The marker for showpieces. Deliberately unlike NewBadge: ink rather than
 * accent, a sparkle, and a slow sheen of the accent passing across it, so the
 * two tags are never read as one. The sheen stops under reduced motion and the
 * badge stays a still ink pill. Inside the current sidebar link it inverts,
 * like NewBadge, so it never sinks into the accent row.
 */
export function ShowpieceBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-2 py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.06em] text-ink-inverse',
        'bg-[linear-gradient(110deg,var(--color-ink)_35%,color-mix(in_oklab,var(--color-accent)_60%,var(--color-ink))_50%,var(--color-ink)_65%)] bg-[length:260%_100%]',
        'motion-safe:animate-[gradient-pan_6s_linear_infinite]',
        'group-aria-[current=page]:bg-surface group-aria-[current=page]:bg-none group-aria-[current=page]:text-ink',
        className,
      )}
    >
      <Sparkles size={10} strokeWidth={2.5} aria-hidden className="text-accent group-aria-[current=page]:text-ink" />
      Showpiece
    </span>
  )
}
