'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'

export type PagedDocumentSize = 'a4' | 'letter'

export interface PagedDocumentBlock {
  id: string
  content: ReactNode
  /** Start this block on a new page. */
  breakBefore?: boolean
  /** Start a new page after this block. */
  breakAfter?: boolean
  /** Never end a page on this block — a heading stays with the paragraph under it. */
  keepWithNext?: boolean
}

export interface PagedDocumentPageInfo {
  page: number
  total: number
}

export interface PagedDocumentMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PagedDocumentProps {
  /** The content, in reading order. Blocks are never split; one taller than a page is flagged. */
  blocks: PagedDocumentBlock[]
  /** Paper size. */
  size?: PagedDocumentSize
  /** Page margins in millimetres — one number for all four sides. Header and footer sit inside the top and bottom margins. */
  margins?: number | PagedDocumentMargins
  /** Running header on every page. */
  header?: ReactNode | ((info: PagedDocumentPageInfo) => ReactNode)
  /** Running footer on every page. Defaults to “Page X of Y”. */
  footer?: ReactNode | ((info: PagedDocumentPageInfo) => ReactNode)
  /** Name of the document, for the landmark and the print button. */
  title: string
  /** Owns the page when printed: everything else is hidden and the pages print at full size. One per page. */
  printable?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const MM = 96 / 25.4
const PAPER: Record<PagedDocumentSize, { width: number; height: number; css: string }> = {
  a4: { width: 210 * MM, height: 297 * MM, css: 'A4' },
  letter: { width: 8.5 * 96, height: 11 * 96, css: 'letter' },
}

/**
 * Greedy page filling. A block goes on the current page if it fits; a
 * keep-with-next chain must fit as a whole or it moves over together.
 */
function paginate(blocks: PagedDocumentBlock[], heights: number[], limit: number) {
  const pages: number[][] = [[]]
  let used = 0
  const newPage = () => {
    if (pages[pages.length - 1].length === 0) return
    pages.push([])
    used = 0
  }
  blocks.forEach((block, index) => {
    if (block.breakBefore) newPage()
    let chain = heights[index]
    for (let next = index; blocks[next].keepWithNext && next + 1 < blocks.length && !blocks[next + 1].breakBefore; next += 1) chain += heights[next + 1]
    if (used + Math.min(chain, limit) > limit + 0.5) newPage()
    pages[pages.length - 1].push(index)
    used += heights[index]
    if (block.breakAfter && index < blocks.length - 1) newPage()
  })
  return pages
}

const run = (slot: PagedDocumentProps['header'], info: PagedDocumentPageInfo) => (typeof slot === 'function' ? slot(info) : slot)

/**
 * Content laid out on real pages — A4 or Letter, with margins, running headers
 * and footers, and page X of Y — for anything that will be printed or saved as
 * a PDF: an invoice, a contract, a report.
 *
 * Every block is rendered once off-screen at the page’s content width and
 * measured; pages are then filled in order, honouring break-before,
 * break-after and keep-with-next, so a heading never sits alone at the foot of
 * a page. It re-measures when fonts finish loading, since a fallback font
 * paginates differently. The preview is scaled to fit its container, and the
 * print stylesheet removes the scaling and everything around the document, so
 * the pages that print are the pages you saw.
 */
export function PagedDocument({
  blocks,
  size = 'a4',
  margins = 18,
  header,
  footer = ({ page, total }: PagedDocumentPageInfo) => `Page ${page} of ${total}`,
  title,
  printable = true,
  className,
}: PagedDocumentProps) {
  const paper = PAPER[size]
  const m = typeof margins === 'number' ? { top: margins, right: margins, bottom: margins, left: margins } : margins
  const box = { top: m.top * MM, right: m.right * MM, bottom: m.bottom * MM, left: m.left * MM }
  const contentWidth = paper.width - box.left - box.right
  const contentHeight = paper.height - box.top - box.bottom
  const measurer = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][]>(() => [blocks.map((_, index) => index)])
  const [heights, setHeights] = useState<number[]>([])
  const [zoom, setZoom] = useState<'fit' | '50' | '100'>('fit')
  const [available, setAvailable] = useState(0)

  useIsomorphicLayoutEffect(() => {
    const node = measurer.current
    if (!node) return
    const measure = () => {
      const measured = Array.from(node.children, (child) => child.getBoundingClientRect().height)
      setHeights(measured)
      setPages(paginate(blocks, measured, contentHeight))
    }
    measure()
    let live = true
    document.fonts?.ready.then(() => live && measure())
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [blocks, contentWidth, contentHeight])

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const measure = () => setAvailable(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const scale = zoom === 'fit' ? (available ? Math.min(1, (available - 32) / paper.width) : 0.5) : Number(zoom) / 100
  const total = pages.length

  return (
    <section aria-label={title} data-paged-document={printable ? '' : undefined} className={cn('flex w-full flex-col gap-3', className)}>
      {printable && (
        <style>{`@page { size: ${paper.css}; margin: 0 }
@media print {
  body * { visibility: hidden !important; }
  [data-paged-document], [data-paged-document] * { visibility: visible !important; }
  [data-paged-document] { position: absolute !important; inset: 0 auto auto 0 !important; width: auto !important; }
}`}</style>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="m-0 text-[12px] font-semibold text-ink-soft tabular">
          {total} {total === 1 ? 'page' : 'pages'} · {size === 'a4' ? 'A4' : 'US Letter'}
        </p>
        <div className="flex items-center gap-2">
          <SegmentedControl
            label="Zoom"
            size="sm"
            value={zoom}
            onValueChange={setZoom}
            options={[
              { value: 'fit', label: 'Fit' },
              { value: '50', label: '50%' },
              { value: '100', label: '100%' },
            ]}
          />
          {printable && (
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          )}
        </div>
      </div>

      <div ref={frame} className="relative max-h-[640px] overflow-auto rounded-[var(--radius-tile)] bg-surface-sunken p-4 print:max-h-none print:overflow-visible print:rounded-none print:bg-transparent print:p-0">
        {/* Off-screen copy at the content width, measured to decide where pages break. */}
        <div ref={measurer} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 print:hidden" style={{ width: contentWidth }}>
          {blocks.map((block) => (
            <div key={block.id} className="flow-root">
              {block.content}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 print:block">
          {pages.map((indexes, pageIndex) => {
            const info = { page: pageIndex + 1, total }
            const overflow = indexes.some((index) => (heights[index] ?? 0) > contentHeight + 0.5)
            return (
              <div
                key={pageIndex}
                className="shrink-0 print:!h-auto print:!w-auto print:break-after-page"
                style={{ width: paper.width * scale, height: paper.height * scale }}
              >
                <section
                  aria-label={`Page ${info.page} of ${total}`}
                  className="relative origin-top-left overflow-hidden bg-shell text-ink shadow-[var(--shadow-float)] print:!transform-none print:bg-white print:text-black print:shadow-none"
                  style={{ width: paper.width, height: paper.height, transform: `scale(${scale})` }}
                >
                  {header && (
                    <div className="absolute inset-x-0 top-0 flex items-end text-[10px] font-semibold text-ink-faint" style={{ height: box.top, padding: `0 ${box.right}px ${box.top * 0.3}px ${box.left}px` }}>
                      <div className="w-full">{run(header, info)}</div>
                    </div>
                  )}
                  <div className="absolute" style={{ top: box.top, left: box.left, width: contentWidth, height: contentHeight }}>
                    {indexes.map((index) => (
                      <div key={blocks[index].id} className="flow-root">
                        {blocks[index].content}
                      </div>
                    ))}
                  </div>
                  {footer && (
                    <div className="absolute inset-x-0 bottom-0 flex items-start text-[10px] font-semibold text-ink-faint tabular" style={{ height: box.bottom, padding: `${box.bottom * 0.3}px ${box.right}px 0 ${box.left}px` }}>
                      <div className="w-full">{run(footer, info)}</div>
                    </div>
                  )}
                  {overflow && (
                    <p className="absolute inset-x-0 bottom-0 m-0 bg-[color-mix(in_oklab,var(--color-danger)_14%,var(--color-shell))] px-3 py-1 text-[10px] font-bold text-danger print:hidden">
                      A block on this page is taller than the page and is cut off.
                    </p>
                  )}
                </section>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
