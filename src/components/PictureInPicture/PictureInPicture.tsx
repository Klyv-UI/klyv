'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Text } from '../Text'

export interface PictureInPictureProps {
  /** The live content. It keeps its state when it moves into the floating window and back. */
  children: ReactNode
  /** Size of the floating window in CSS pixels. The browser may clamp it. */
  width?: number
  /** Height of the floating window in CSS pixels. */
  height?: number
  /** Label on the pop-out button. */
  openLabel?: string
  /** Label on the button that brings the content back. */
  closeLabel?: string
  /** Shown in place of the content while it is in the floating window. */
  placeholder?: ReactNode
  /** Shown beside the content where Document Picture-in-Picture is not available. */
  unsupportedMessage?: ReactNode
  /** Called when the window opens or closes, whichever side closed it. */
  onOpenChange?: (open: boolean) => void
  /** Merged last, so it wins. */
  className?: string
}

interface PictureInPictureApi {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
  window: Window | null
}

const api = () =>
  typeof window === 'undefined'
    ? undefined
    : (window as Window & { documentPictureInPicture?: PictureInPictureApi }).documentPictureInPicture

/** Copy every stylesheet into the new document. Rules are cloned where readable; cross-origin sheets are re-linked. */
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement('style')
      style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')
      target.head.append(style)
    } catch {
      if (!sheet.href) continue
      const link = target.createElement('link')
      link.rel = 'stylesheet'
      link.href = sheet.href
      target.head.append(link)
    }
  }
}

/**
 * The theme lives in attributes on the root — a class, a data-theme, custom properties set inline by an accent
 * picker — so they are mirrored rather than copied once.
 */
function mirrorRoot(target: Document) {
  const sync = () => {
    for (const name of ['class', 'style', 'data-theme', 'lang', 'dir']) {
      const value = document.documentElement.getAttribute(name)
      if (value === null) target.documentElement.removeAttribute(name)
      else target.documentElement.setAttribute(name, value)
    }
    target.body.className = document.body.className
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(document.documentElement, { attributes: true })
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/**
 * Pops a live piece of the page — a timer, a call, a checklist — into an always-on-top window, and puts it back when
 * that window closes.
 *
 * It uses Document Picture-in-Picture, which opens a real document rather than a video frame. The content is
 * rendered through a portal into a container that never changes; what moves is that container, appended to the
 * floating window’s body and back to its place in the page. React therefore never unmounts anything — a running
 * stopwatch keeps counting and a half-typed note keeps its text — and events keep working because React listens on
 * the portal container itself.
 *
 * A new document has no styles, so every stylesheet is copied across (re-linked where the rules are not readable), and
 * the root’s class, data-theme and inline custom properties are mirrored for as long as the window is open, so the
 * theme and accent follow the page. The window can only be opened from a click, which is why the component owns its
 * button. Where the API is missing the content stays in place and says why.
 */
export function PictureInPicture({
  children,
  width = 360,
  height = 240,
  openLabel = 'Pop out',
  closeLabel = 'Bring back',
  placeholder,
  unsupportedMessage = 'Popping this out needs Document Picture-in-Picture, which this browser does not support yet. It works in current Chrome and Edge.',
  onOpenChange,
  className,
}: PictureInPictureProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [holder] = useState(() => (typeof document === 'undefined' ? null : document.createElement('div')))
  const [floating, setFloating] = useState<Window | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(() => {
    setSupported(Boolean(api()))
  }, [])

  // At rest, the holder lives inside the host in the page.
  useEffect(() => {
    if (!holder || floating) return
    holder.className = 'contents'
    hostRef.current?.append(holder)
  }, [holder, floating])

  useEffect(() => {
    if (!floating || !holder) return
    const doc = floating.document
    copyStyles(doc)
    const stopMirroring = mirrorRoot(doc)
    doc.body.style.margin = '0'
    holder.className = 'min-h-screen bg-app p-3 text-ink'
    doc.body.append(holder)

    // `pagehide` fires however the window goes — its own close button, the page closing it, the tab navigating.
    const onClose = () => {
      stopMirroring()
      setFloating(null)
      onOpenChangeRef.current?.(false)
    }
    floating.addEventListener('pagehide', onClose, { once: true })
    return () => {
      floating.removeEventListener('pagehide', onClose)
      stopMirroring()
    }
  }, [floating, holder])

  // Close the window if the component goes away, so the content does not outlive its page.
  useEffect(() => () => floating?.close(), [floating])

  const open = async () => {
    const pip = api()
    if (!pip) return
    setFailure(null)
    try {
      const next = await pip.requestWindow({ width, height })
      setFloating(next)
      onOpenChangeRef.current?.(true)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The window could not be opened.')
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div ref={hostRef} className={cn(floating && 'hidden')} />
      {floating &&
        (placeholder ?? (
          <div className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-[var(--radius-tile)] border border-dashed border-line-strong bg-surface-sunken p-4 text-center">
            <Text size="label" weight="semibold">
              Showing in a floating window
            </Text>
            <Text size="caption" tone="faint">
              It stays on top of your other windows. Close it, or bring it back here.
            </Text>
          </div>
        ))}
      <div className="flex flex-wrap items-center gap-2">
        {supported && (
          <Button size="sm" variant="outline" onClick={floating ? () => floating.close() : open}>
            {floating ? closeLabel : openLabel}
          </Button>
        )}
        {supported === false && (
          <Text size="caption" tone="faint" role="note">
            {unsupportedMessage}
          </Text>
        )}
        {failure && (
          <Text size="caption" tone="faint" role="status">
            {failure}
          </Text>
        )}
      </div>
      {holder && createPortal(children, holder)}
    </div>
  )
}
