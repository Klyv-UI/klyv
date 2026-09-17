import { Badge, cn } from 'klyv'

/**
 * The marker for components added in the SaaS release. It is the library's own
 * accent Badge rather than a new colour, so "new" reads as part of the system.
 * Inside a sidebar link it inverts when that link is the current page, where an
 * accent badge on an accent row would disappear.
 */
export function NewBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn(
        'shrink-0 uppercase tracking-[0.06em] group-aria-[current=page]:bg-surface group-aria-[current=page]:text-ink',
        className,
      )}
    >
      New
    </Badge>
  )
}
