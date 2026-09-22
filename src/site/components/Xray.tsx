import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, ExternalLink, ScanSearch } from 'lucide-react'
import { Kbd, Text, VisuallyHidden, cn } from 'klyvui'
import { brand } from '../brand'
import { catalog, findComponentByName } from '../data/catalog'
import { chainAt, type XrayChain } from '../lib/xray'

/**
 * X-ray: point at a running screen and it names the component under the
 * pointer, and the ones it sits inside.
 *
 * "Which component is this?" is the question every screenshot in every
 * component library leaves unanswered. Here the screen is real, so the answer
 * is real too: React's own tree is read back and each name checked against
 * the catalogue (see `lib/xray`), so what it reports is always a component a
 * reader can go and look up.
 *
 * While it is on, clicks are caught rather than delivered — the point is to
 * inspect the screen, and a click that submitted its form would take it away —
 * and the click pins what is under the pointer so the label can be used. The
 * outline follows scrolling and resizing, since the element it measured moves
 * with both.
 */
/** Only names in the catalogue are reported, so helpers never surface. */
const KNOWN: ReadonlySet<string> = new Set(catalog.map((entry) => entry.name))

export function Xray({ enabled, onExit, children }: { enabled: boolean; onExit: () => void; children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [hit, setHit] = useState<{ chain: XrayChain; box: DOMRect } | null>(null)
  const [pinned, setPinned] = useState(false)
  const [copied, setCopied] = useState(false)
  const target = useRef<Element | null>(null)
  const navigate = useNavigate()

  const measure = useCallback(
    (node: Element | null) => {
      if (!node) return
      const chain = chainAt(node, KNOWN)
      if (chain.length === 0) {
        setHit(null)
        return
      }
      target.current = node
      setHit({ chain, box: node.getBoundingClientRect() })
    },
    [],
  )

  // The outline is measured, so it has to be measured again whenever what it
  // measured could have moved.
  useEffect(() => {
    if (!enabled) return
    const again = () => {
      if (target.current) setHit((current) => (current ? { ...current, box: target.current!.getBoundingClientRect() } : current))
    }
    window.addEventListener('scroll', again, true)
    window.addEventListener('resize', again)
    return () => {
      window.removeEventListener('scroll', again, true)
      window.removeEventListener('resize', again)
    }
  }, [enabled])

  const name = hit?.chain[0]
  const entry = name ? findComponentByName(name) : undefined

  const copy = useCallback(async () => {
    if (!name) return
    try {
      await navigator.clipboard.writeText(`import { ${name} } from '${brand.pkg}'`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }, [name])

  // While X-ray is on it owns the keyboard shortcuts it advertises.
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit()
        return
      }
      if (!name) return
      if (event.key === 'c' || event.key === 'C') void copy()
      if (event.key === 'Enter' && entry) navigate(`/components/${entry.slug}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, name, entry, copy, navigate, onExit])

  useEffect(() => {
    if (!enabled) {
      setHit(null)
      setPinned(false)
      target.current = null
    }
  }, [enabled])

  return (
    <div
      ref={wrapperRef}
      className={cn('relative', enabled && 'cursor-crosshair')}
      onPointerMove={(event) => {
        if (!enabled || pinned) return
        measure(event.target as Element)
      }}
      onPointerLeave={() => {
        if (enabled && !pinned) setHit(null)
      }}
      onClickCapture={(event) => {
        if (!enabled) return
        // Inspecting a screen should never operate it.
        event.preventDefault()
        event.stopPropagation()
        measure(event.target as Element)
        setPinned((was) => !was)
      }}
    >
      {children}

      {enabled && hit && name && (
        <>
          {/* The outline, drawn over the element it measured. */}
          <div
            aria-hidden
            className="pointer-events-none fixed z-40 rounded-[6px] border-2 border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)]"
            style={{ left: hit.box.left - 2, top: hit.box.top - 2, width: hit.box.width + 4, height: hit.box.height + 4 }}
          />
          {/* Its name, the components it sits in, and what can be done with it. */}
          <div
            className="pointer-events-auto fixed z-40 flex max-w-[min(92vw,520px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-surface px-3 py-2 shadow-[var(--shadow-float)]"
            style={{
              left: Math.max(8, Math.min(hit.box.left, window.innerWidth - 340)),
              top: hit.box.top > 56 ? hit.box.top - 46 : hit.box.bottom + 10,
            }}
          >
            <Text as="span" size="caption" weight="bold" className="font-mono text-[12px]">
              {`<${name} />`}
            </Text>
            {hit.chain.length > 1 && (
              <Text as="span" size="caption" tone="faint" className="font-mono text-[11px]">
                in {hit.chain.slice(1).join(' ‹ ')}
              </Text>
            )}
            <span className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copied ? <Check size={11} strokeWidth={3} aria-hidden /> : <Copy size={11} aria-hidden />}
                {copied ? 'Copied' : 'Import'}
              </button>
              {entry && (
                <button
                  type="button"
                  onClick={() => navigate(`/components/${entry.slug}`)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ExternalLink size={11} aria-hidden />
                  Docs
                </button>
              )}
            </span>
            <VisuallyHidden>
              <span role="status" aria-live="polite">
                {copied ? `import { ${name} } from '${brand.pkg}' copied` : `${name}${hit.chain.length > 1 ? `, inside ${hit.chain.slice(1).join(', ')}` : ''}`}
              </span>
            </VisuallyHidden>
          </div>
        </>
      )}

      {enabled && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-line bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] px-4 py-2 shadow-[var(--shadow-float)] backdrop-blur-md">
            <Text as="span" size="caption" weight="bold" className="inline-flex items-center gap-1.5">
              <ScanSearch size={13} aria-hidden className="text-accent-strong" />
              X-ray
            </Text>
            <Text as="span" size="caption" tone="soft" className="text-[12px]">
              {pinned ? 'Pinned — click again to follow the pointer' : 'Point at the screen'}
            </Text>
            <span className="flex items-center gap-1.5">
              <Kbd>C</Kbd>
              <Text as="span" size="micro" tone="faint">
                import
              </Text>
              <Kbd>↵</Kbd>
              <Text as="span" size="micro" tone="faint">
                docs
              </Text>
              <Kbd>Esc</Kbd>
              <Text as="span" size="micro" tone="faint">
                off
              </Text>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
