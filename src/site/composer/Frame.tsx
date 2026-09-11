import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders its children inside an iframe, in this React tree.
 *
 * The point is the viewport: a canvas that is merely a narrower box still
 * answers every media query at the window's width, so a "mobile" preview of a
 * responsive component would show its desktop layout. Inside an iframe, `sm:`
 * and `md:` answer to the frame.
 *
 * The frame borrows the page's stylesheets and mirrors the theme — the accent
 * variables and the mode live on the root element — so a composition looks
 * exactly as it would on the page. Children are portalled in, so context,
 * state and event handlers work as if the frame were not there.
 */
export function Frame({
  title,
  children,
  onWindow,
  className,
  style,
}: {
  title: string
  children: ReactNode
  /** The frame's window, for keyboard shortcuts that must work while focus is inside it. */
  onWindow?: (win: Window | null) => void
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const onWindowRef = useRef(onWindow)
  onWindowRef.current = onWindow

  useEffect(() => {
    const iframe = ref.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return

    doc.open()
    doc.write('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>')
    doc.close()

    // Stylesheets: cloned now, and re-cloned whenever the page's change — Vite
    // swaps style tags in place during development.
    const cloned: Node[] = []
    const syncStyles = () => {
      for (const node of cloned.splice(0)) node.parentNode?.removeChild(node)
      for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
        const copy = node.cloneNode(true)
        cloned.push(copy)
        doc.head.appendChild(copy)
      }
    }
    syncStyles()
    const headWatcher = new MutationObserver(syncStyles)
    headWatcher.observe(document.head, { childList: true, subtree: true, characterData: true })

    // Theme: the accent is inline style on <html>, the mode a data attribute.
    const syncTheme = () => {
      const from = document.documentElement
      const to = doc.documentElement
      to.setAttribute('style', from.getAttribute('style') ?? '')
      if (from.dataset.theme) to.dataset.theme = from.dataset.theme
      else delete to.dataset.theme
    }
    syncTheme()
    const themeWatcher = new MutationObserver(syncTheme)
    themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] })

    doc.body.style.margin = '0'
    doc.body.className = 'bg-app'
    const root = doc.createElement('div')
    doc.body.appendChild(root)
    setMount(root)
    onWindowRef.current?.(iframe.contentWindow)

    return () => {
      headWatcher.disconnect()
      themeWatcher.disconnect()
      setMount(null)
      onWindowRef.current?.(null)
    }
  }, [])

  return (
    <iframe ref={ref} title={title} className={className} style={style}>
      {mount && createPortal(children, mount)}
    </iframe>
  )
}
