import { StatusDot, type StatusDotTone } from '../StatusDot'
import { Tag } from '../Tag'

/**
 * The dot-and-word status used across the kit — a subscription, an invoice, an
 * integration, an invitation. Always a word as well as a colour: "Past due" in
 * red and "Paid" in green are indistinguishable to one reader in twelve.
 */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusDotTone
  children: string
  className?: string
}) {
  return (
    <Tag size="sm" className={className}>
      <StatusDot tone={tone} />
      {children}
    </Tag>
  )
}

/** Display-scale type the marketing sections share. The app scale stops at 30px. */
export const DISPLAY_XL =
  'text-[clamp(34px,5.4vw,60px)] font-extrabold leading-[1.03] tracking-[-0.045em] text-balance'
export const DISPLAY_LG =
  'text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-balance'
