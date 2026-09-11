'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface MaskedValueProps {
  /** The real value. Only rendered while it is revealed. */
  value: string
  /** What it is — "Account number", "Card number". Used in every announcement. */
  label: string
  /** Characters left visible while masked. */
  tail?: number
  /** Milliseconds before it hides itself again. 0 keeps it shown. */
  hideAfter?: number
  /** Group the revealed value — 4 for a card number, 0 to leave it alone. */
  group?: number
  /** Offer a copy button. Copying never reveals. */
  copyable?: boolean
  /** Copy this instead of `value` — the unformatted form, usually. */
  copyValue?: string
  /** Merged last, so it wins. */
  className?: string
}

const MASK = '•'

/**
 * A sensitive value shown as dots until someone asks for it.
 *
 * The real value is not in the DOM while it is masked. Rendering the whole
 * thing and hiding it with CSS or a `-webkit-text-security` font puts a card
 * number in the accessibility tree, in the page source, in a screenshot tool's
 * text layer, and in any extension reading the document — all of which defeats
 * the point of masking it at all.
 *
 * It re-hides itself after a while, because the risk is not the moment of
 * revealing, it is the twenty minutes afterwards with the number sitting on a
 * screen in an office.
 *
 * Copy is separate from reveal, and does not trigger it. Wanting the value in
 * the clipboard is not the same as wanting it on screen, and treating them as
 * one forces a shoulder-surfing risk on anyone who just needed to paste it.
 */
export function MaskedValue({
  value,
  label,
  tail = 4,
  hideAfter = 20_000,
  group = 0,
  copyable = true,
  copyValue,
  className,
}: MaskedValueProps) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!revealed || hideAfter <= 0) return
    timer.current = window.setTimeout(() => setRevealed(false), hideAfter)
    return () => window.clearTimeout(timer.current)
  }, [hideAfter, revealed])

  useEffect(() => {
    if (!copied) return
    const reset = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(reset)
  }, [copied])

  const visible = tail > 0 ? value.slice(-tail) : ''
  const masked = `${MASK.repeat(Math.max(0, value.length - visible.length))}${visible}`

  const grouped =
    group > 0
      ? (revealed ? value : masked).replace(new RegExp(`(.{${group}})`, 'g'), '$1 ').trim()
      : revealed
        ? value
        : masked

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue ?? value)
      setCopied(true)
    } catch {
      // Clipboard refused — no permission, or an insecure origin. Reveal it
      // instead, so the value can still be read and typed by hand.
      setRevealed(true)
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Text as="span" size="body" tabular aria-hidden="true">
        {grouped}
      </Text>

      {/* Announced properly, without ever putting the digits in the tree. */}
      <VisuallyHidden>
        {label}: {revealed ? value.split('').join(' ') : `hidden, ending ${visible}`}
      </VisuallyHidden>

      <button
        type="button"
        aria-pressed={revealed}
        onClick={() => setRevealed((current) => !current)}
        className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
      >
        {revealed ? 'Hide' : 'Reveal'}
      </button>

      {copyable && (
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}

      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {copied ? `${label} copied` : revealed ? `${label} shown` : ''}
        </span>
      </VisuallyHidden>
    </span>
  )
}
