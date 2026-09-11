'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, type ButtonSize } from '../Button'
import { IconButton } from '../IconButton'
import { CheckIcon, CopyIcon } from '../internal/icons'
import { VisuallyHidden } from '../VisuallyHidden'

export interface CopyButtonProps {
  /** What goes on the clipboard. */
  value: string
  /** The visible label, and the accessible name when icon-only. */
  label?: string
  copiedLabel?: string
  failedLabel?: string
  /** Show the glyph alone. The label is still announced. */
  iconOnly?: boolean
  size?: ButtonSize
  /** Called after a successful copy. */
  onCopy?: (value: string) => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Puts a value on the clipboard, and says so.
 *
 * The confirmation is announced through a polite live region as well as
 * shown, because a glyph that turns into a tick is invisible to a screen
 * reader. The copied state lasts long enough to read and then resets itself.
 * When the clipboard is unavailable — an insecure origin, a denied
 * permission — it says the copy failed rather than pretending it worked.
 */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  failedLabel = 'Copy failed',
  iconOnly = false,
  size = 'sm',
  onCopy,
  className,
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const reset = useRef(0)

  useEffect(() => () => window.clearTimeout(reset.current), [])

  const copy = async () => {
    window.clearTimeout(reset.current)
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
      onCopy?.(value)
    } catch {
      setState('failed')
    }
    reset.current = window.setTimeout(() => setState('idle'), 1800)
  }

  const Glyph = state === 'copied' ? CheckIcon : CopyIcon
  const text = state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : label

  return (
    <>
      {iconOnly ? (
        <IconButton icon={Glyph} label={text} tone="muted" size={size} onClick={copy} className={className} />
      ) : (
        <Button variant="muted" size={size} onClick={copy} className={className}>
          <Glyph size={size === 'sm' ? 13 : 15} />
          {text}
        </Button>
      )}
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {state === 'idle' ? '' : text}
        </span>
      </VisuallyHidden>
    </>
  )
}
