'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { Text } from '../Text'

export interface EmailViewerAddress {
  name?: string
  email: string
}

export interface EmailViewerAttachment {
  name: string
  /** Bytes. */
  size: number
  /** MIME type, shown as the file kind. */
  type?: string
  /** Where to download it from. Without it the attachment is listed but not linked. */
  href?: string
  /** Content-ID for inline images — `cid:` references in the body resolve to `href`. */
  contentId?: string
}

export interface EmailViewerProps {
  subject: string
  from: EmailViewerAddress
  to: EmailViewerAddress[]
  cc?: EmailViewerAddress[]
  date: Date
  /** The message body. Treated as hostile: it never runs script and never shares this page’s origin. */
  html: string
  attachments?: EmailViewerAttachment[]
  /** Load remote images from the start — for senders the reader has already trusted. */
  defaultShowImages?: boolean
  /** Called when the reader chooses to load remote images. */
  onShowImages?: () => void
  /** Merged last, so it wins. */
  className?: string
}

const NO_ATTACHMENTS: EmailViewerAttachment[] = []
const REMOTE = /^\s*(https?:)?\/\//i
const DANGEROUS_URL = /^\s*(javascript|vbscript|data:text\/html)/i
const QUOTES = 'blockquote, .gmail_quote, .gmail_extra, .yahoo_quoted, .protonmail_quote, #divRplyFwdMsg, #appendonsend'
const STRIP = 'script, noscript, iframe, frame, frameset, object, embed, applet, base, meta, link, title'

/* The iframe has no access to the page’s tokens, so it is painted with CSS
   system colours: an email is written for a white page, and Canvas is one. */
const BASE =
  'html{color-scheme:light}body{margin:0;padding:16px;font:14px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:CanvasText;background:Canvas;overflow-wrap:anywhere}' +
  'img{max-width:100%}img[data-blocked]{outline:1px dashed GrayText;outline-offset:-1px}a{color:LinkText}table{max-width:100%}'

interface Prepared {
  head: string
  body: string
  blocked: number
  quotes: number
}

/** Rewrites url(…) in CSS, blocking remote ones unless images are allowed. */
function rewriteCss(css: string, allow: boolean, cid: (url: string) => string, count: () => void) {
  return css
    .replace(/@import[^;]+;?/gi, '')
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (whole, _quote, url: string) => {
      if (url.startsWith('cid:')) return `url("${cid(url)}")`
      if (REMOTE.test(url) && !allow) {
        count()
        return 'url("")'
      }
      return DANGEROUS_URL.test(url) ? 'url("")' : whole
    })
}

/**
 * Parses the body inertly (DOMParser runs nothing and fetches nothing), strips
 * active content, and blocks remote resources — images, srcset candidates,
 * backgrounds, CSS urls — until the reader allows them.
 */
function prepare(html: string, allowImages: boolean, showQuotes: boolean, attachments: EmailViewerAttachment[]): Prepared {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let blocked = 0
  const count = () => (blocked += 1)
  const cid = (url: string) => attachments.find((file) => file.contentId && `cid:${file.contentId}` === url)?.href ?? ''

  doc.querySelectorAll(STRIP).forEach((node) => node.remove())

  let quotes = 0
  if (!showQuotes) {
    for (const quote of Array.from(doc.body.querySelectorAll(QUOTES))) {
      if (!quote.isConnected || quote.parentElement?.closest(QUOTES)) continue
      // Outlook marks where the quoted message starts; everything after it is the quote.
      if (quote.id === 'divRplyFwdMsg' || quote.id === 'appendonsend') {
        let next = quote.nextSibling
        while (next) {
          const after = next.nextSibling
          next.remove()
          next = after
        }
      }
      quote.remove()
      quotes += 1
    }
  } else {
    quotes = doc.body.querySelectorAll(QUOTES).length
  }

  for (const element of Array.from(doc.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'formaction' || name === 'action') element.removeAttribute(attribute.name)
      else if (['href', 'src', 'xlink:href', 'poster', 'background'].includes(name) && DANGEROUS_URL.test(attribute.value)) element.removeAttribute(attribute.name)
    }
    if (element.tagName === 'A') {
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
    for (const name of ['src', 'poster', 'background']) {
      const value = element.getAttribute(name)
      if (value === null) continue
      if (value.startsWith('cid:')) element.setAttribute(name, cid(value))
      else if (REMOTE.test(value) && !allowImages) {
        element.removeAttribute(name)
        element.setAttribute('data-blocked', '')
        count()
      }
    }
    const srcset = element.getAttribute('srcset')
    if (srcset !== null && !allowImages && srcset.split(',').some((candidate) => REMOTE.test(candidate))) {
      element.removeAttribute('srcset')
      element.setAttribute('data-blocked', '')
      if (!element.hasAttribute('src') || element.tagName === 'SOURCE') count()
    }
    const style = element.getAttribute('style')
    if (style) element.setAttribute('style', rewriteCss(style, allowImages, cid, count))
  }
  doc.querySelectorAll('style').forEach((node) => (node.textContent = rewriteCss(node.textContent ?? '', allowImages, cid, count)))

  const head = Array.from(doc.querySelectorAll('style'), (node) => {
    const markup = node.outerHTML
    node.remove()
    return markup
  }).join('')
  return { head, body: doc.body.innerHTML, blocked, quotes }
}

const who = (address: EmailViewerAddress) => (address.name ? `${address.name} <${address.email}>` : address.email)

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

/**
 * An email message, rendered as safely as an inbox has to render one.
 *
 * The body is somebody else’s HTML, so it goes into a sandboxed iframe with
 * neither scripts nor this page’s origin, and its markup is cleaned first:
 * event handlers, script-bearing URLs, frames and embeds are removed, and a
 * content security policy inside the frame backs that up. Remote images and
 * CSS backgrounds are blocked by rewriting their URLs — a tracking pixel tells
 * the sender you opened the message — until the reader chooses “Show images”.
 * Quoted replies (Gmail, Apple Mail, Outlook) are folded away behind one
 * button, because the new part of a reply is usually three lines on top of
 * thirty. A frame without same-origin access cannot be measured, so the same
 * cleaned markup is laid out in a hidden, inert shadow root beside it and the
 * frame takes that height — no inner scrollbar. The frame appears only once
 * that height is known, so the message never lands at a guess and then jumps.
 */
export function EmailViewer({
  subject,
  from,
  to,
  cc = [],
  date,
  html,
  attachments = NO_ATTACHMENTS,
  defaultShowImages = false,
  onShowImages,
  className,
}: EmailViewerProps) {
  const [showImages, setShowImages] = useState(defaultShowImages)
  const [showQuotes, setShowQuotes] = useState(false)
  const [height, setHeight] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const measureHost = useRef<HTMLDivElement>(null)

  const prepared = useMemo(() => {
    try {
      return prepare(html, showImages, showQuotes, attachments)
    } catch {
      return null
    }
  }, [html, showImages, showQuotes, attachments])

  // The quote count before folding, so the toggle keeps its label once expanded.
  useEffect(() => {
    if (prepared && !showQuotes) setTotal(prepared.quotes)
  }, [prepared, showQuotes])

  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:${showImages ? ' https: http:' : ''}; font-src data:${showImages ? ' https:' : ''}; media-src data:`
  const srcDoc = prepared
    ? `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>${BASE}</style>${prepared.head}</head><body>${prepared.body}</body></html>`
    : ''

  // Lay the same markup out in a shadow root and read its height.
  useEffect(() => {
    const host = measureHost.current
    if (!host || !prepared) return
    host.setAttribute('inert', '')
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const scoped = prepared.head.replace(/:host\b/g, ':not(*)').replace(/(^|[\s,>+~{}])(html|body)(?=[\s,.{:#[>+~])/g, '$1.email-root')
    root.innerHTML = `<style>${BASE.replace(/\bhtml\b|\bbody\b/g, '.email-root')}</style>${scoped}<div class="email-root">${prepared.body}</div>`
    const measure = () => {
      const content = root.querySelector('.email-root') as HTMLElement | null
      const next = Math.ceil(content?.getBoundingClientRect().height ?? 0)
      if (next > 0) setHeight(next + 2)
    }
    measure()
    const observer = new ResizeObserver(measure)
    const content = root.querySelector('.email-root')
    if (content) observer.observe(content)
    root.querySelectorAll('img').forEach((image) => image.addEventListener('load', measure))
    return () => observer.disconnect()
  }, [prepared])

  const recipients = (label: string, list: EmailViewerAddress[]) =>
    list.length > 0 && (
      <div className="flex gap-2">
        <dt className="w-8 shrink-0 text-ink-faint">{label}</dt>
        <dd className="min-w-0 break-words">{list.map(who).join(', ')}</dd>
      </div>
    )

  return (
    <article className={cn('flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)} aria-label={subject}>
      <header className="flex flex-col gap-3 border-b border-line p-4">
        <Text as="h3" size="subtitle" leading="tight">{subject}</Text>
        <div className="flex items-start gap-3">
          <Avatar name={from.name ?? from.email} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Text as="span" size="body" weight="bold" className="min-w-0 break-words">
                {from.name ?? from.email}
                {from.name && <span className="ml-1.5 font-medium text-ink-faint">{`<${from.email}>`}</span>}
              </Text>
              <Text as="time" size="caption" tone="faint" dateTime={date.toISOString()}>
                {date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </div>
            <dl className="flex flex-col gap-0.5 text-[12px] font-medium text-ink-soft">
              {recipients('To', to)}
              {recipients('Cc', cc)}
            </dl>
          </div>
        </div>
      </header>

      {prepared && prepared.blocked > 0 && !showImages && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-sunken px-4 py-2.5">
          <Text size="caption" tone="soft" leading="normal" className="mr-auto">
            {`${prepared.blocked} remote ${prepared.blocked === 1 ? 'image was' : 'images were'} blocked, so the sender cannot tell you opened this.`}
          </Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowImages(true)
              onShowImages?.()
            }}
          >
            Show images
          </Button>
        </div>
      )}

      <div className="relative">
        {!prepared ? (
          <Text size="label" tone="faint" className="p-4">This message could not be displayed.</Text>
        ) : height === null ? (
          // The frame waits for its measured height, so the message never
          // appears at a guessed size and then jumps.
          <Text size="label" tone="faint" role="status" className="min-h-40 p-4">Loading message…</Text>
        ) : (
          <iframe
            title={`Message: ${subject}`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            className="block w-full border-0 bg-white"
            style={{ height }}
          />
        )}
        <div ref={measureHost} aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, visibility: 'hidden', pointerEvents: 'none' }} />
      </div>

      {total > 0 && (
        <div className="px-4 pb-3">
          <Button size="sm" variant="ghost" aria-expanded={showQuotes} onClick={() => setShowQuotes((open) => !open)}>
            {showQuotes ? 'Hide quoted text' : `Show quoted text${total > 1 ? ` (${total})` : ''}`}
          </Button>
        </div>
      )}

      {attachments.filter((file) => !file.contentId).length > 0 && (
        <section aria-label="Attachments" className="border-t border-line p-4">
          <ul className="flex flex-wrap gap-2">
            {attachments
              .filter((file) => !file.contentId)
              .map((file) => {
                const body = (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-muted font-mono text-[9px] font-bold uppercase text-ink-soft">
                      {(file.name.split('.').pop() ?? 'file').slice(0, 4)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[12px] font-semibold text-ink">{file.name}</span>
                      <span className="text-[11px] font-medium text-ink-faint">{size(file.size)}</span>
                    </span>
                  </>
                )
                const box = 'flex w-56 items-center gap-2.5 rounded-[var(--radius-tile)] border border-line px-2.5 py-2'
                return (
                  <li key={file.name}>
                    {file.href ? (
                      <a href={file.href} download={file.name} className={cn(box, 'hover:bg-surface-muted')} aria-label={`Download ${file.name}, ${size(file.size)}`}>
                        {body}
                      </a>
                    ) : (
                      <div className={box}>{body}</div>
                    )}
                  </li>
                )
              })}
          </ul>
        </section>
      )}
    </article>
  )
}
