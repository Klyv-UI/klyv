import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Popover, Text, cn } from 'klyvui'
import { AccentPicker } from './AccentPicker'
import { useAccent } from './useTheme'

/**
 * The accent picker, folded into one control for the header.
 *
 * Eleven swatches in a row took a third of the header and competed with the
 * navigation for attention. The current colour is the button; the choices are
 * one click away. Focus moves into the panel on open and back on close,
 * because the panel is portalled to the end of the document.
 */
export function AccentMenu({ className }: { className?: string }) {
  const hex = useAccent()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() =>
      panelRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"], button')?.focus({ preventScroll: true }),
    )
    return () => window.clearTimeout(timer)
  }, [open])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) triggerRef.current?.querySelector('button')?.focus()
  }

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      label="Accent colour"
      className="w-[236px] p-3"
      trigger={
        <span ref={triggerRef} className={cn('inline-flex', className)}>
          <button
            type="button"
            aria-label="Accent colour"
            aria-expanded={open}
            aria-haspopup="dialog"
            className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface pl-1.5 pr-2 transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span aria-hidden className="size-6 rounded-full border border-black/10" style={{ background: hex }} />
            <ChevronDown size={13} aria-hidden className={cn('text-ink-faint transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
          </button>
        </span>
      }
    >
      <div ref={panelRef} className="flex flex-col gap-2.5">
        <Text size="caption" weight="bold">
          Accent
        </Text>
        <AccentPicker compact />
        <Text size="micro" tone="faint" leading="normal">
          One hue repaints every component on the page.
        </Text>
        <Link
          to="/themes"
          onClick={() => setOpen(false)}
          className="flex items-center justify-between gap-2 rounded-[var(--radius-10)] border border-line px-2.5 py-2 text-[12px] font-bold text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Base, radius, font and style
          <ArrowRight size={13} aria-hidden className="text-ink-faint" />
        </Link>
      </div>
    </Popover>
  )
}
