'use client'

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Text } from '../Text'

export interface SlideDeckSlideProps {
  /** What the slide shows. Size text in `em` and it scales with the deck. */
  children?: ReactNode
  /** Speaker notes, shown only in the presenter view. */
  notes?: string
  /** Short name for the overview and announcements. Defaults to the slide number. */
  title?: string
  /** Merged last, so it wins. */
  className?: string
}

/** One slide. Its props are read by SlideDeck; on its own it is just a layout box. */
export function SlideDeckSlide({ children, className }: SlideDeckSlideProps) {
  return <div className={cn('flex size-full flex-col justify-center gap-[0.6em]', className)}>{children}</div>
}

export interface SlideDeckProps {
  /** SlideDeckSlide elements, one per slide. */
  children?: ReactNode
  /** Or: slides as text, separated by `---`. `#` and `##` headings, `-` bullets, `>` quotes, **bold**, `code`; notes after a line reading `Note:`. */
  markdown?: string
  /** Controlled slide index, from 0. */
  index?: number
  /** Starting slide when uncontrolled. */
  defaultIndex?: number
  /** Called with the new index on every move. */
  onIndexChange?: (index: number) => void
  /** Keep the slide in the URL as `#<hash>-3`. Pass false when a page holds more than one deck. */
  hash?: string | false
  /** Accessible name of the deck. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

interface ParsedSlide {
  content: ReactNode
  notes: string
  title: string
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).map((part, i) =>
    part.startsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('`') ? (
      <code key={i} className="rounded-[var(--radius-4)] bg-surface-sunken px-[0.3em] font-mono text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    ) : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** Parses the markdown-ish source into slides. Exported for previews and tests. */
export function parseSlideDeckMarkdown(source: string): ParsedSlide[] {
  return source
    .split(/^\s*---\s*$/m)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const [body = '', notes = ''] = chunk.split(/^\s*(?:Note|Notes):\s*$/im)
      const blocks: ReactNode[] = []
      let list: string[] = []
      const flush = () => {
        if (list.length) blocks.push(<ul key={blocks.length} className="flex list-disc flex-col gap-[0.3em] pl-[1.2em]">{list.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>)
        list = []
      }
      let title = ''
      for (const line of body.split('\n').map((entry) => entry.trim())) {
        const bullet = /^[-*]\s+(.*)/.exec(line)
        if (bullet) {
          list.push(bullet[1]!)
          continue
        }
        flush()
        if (!line) continue
        if (line.startsWith('## ')) blocks.push(<p key={blocks.length} className="text-[1.35em] font-bold text-ink-soft">{inline(line.slice(3))}</p>)
        else if (line.startsWith('# ')) {
          title ||= line.slice(2)
          blocks.push(<p key={blocks.length} className="text-[2.2em] font-extrabold leading-[1.05] tracking-[-0.03em]">{inline(line.slice(2))}</p>)
        } else if (line.startsWith('> ')) blocks.push(<blockquote key={blocks.length} className="border-l-[0.2em] border-accent pl-[0.8em] text-[1.2em] italic">{inline(line.slice(2))}</blockquote>)
        else blocks.push(<p key={blocks.length}>{inline(line)}</p>)
      }
      flush()
      return { content: <SlideDeckSlide>{blocks}</SlideDeckSlide>, notes: notes.trim(), title: title || `Slide ${index + 1}` }
    })
}

const presenterPage = (channel: string, head: string, rootAttributes: string) => `<!doctype html><html ${rootAttributes}><head><meta charset="utf-8"><title>Presenter view</title>${head}</head>
<body class="bg-app font-sans text-ink"><main class="grid min-h-screen grid-cols-[3fr_2fr] gap-5 p-6">
<section class="flex flex-col gap-3"><div class="flex items-center justify-between"><strong id="count" class="text-[18px]"></strong><span class="flex items-center gap-2"><span id="clock" class="font-mono text-[22px] font-bold tabular-nums">00:00</span><button id="reset" class="rounded-full border border-line px-3 py-1 text-[12px] font-bold">Reset</button></span></div>
<div class="@container aspect-video overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-[5cqw] text-[2.6cqw]" id="current"></div>
<div class="flex gap-2"><button id="prev" class="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-bold">Previous</button><button id="next" class="rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink">Next</button></div></section>
<section class="flex flex-col gap-3"><strong class="text-[12px] uppercase tracking-wider text-ink-faint">Up next</strong>
<div class="@container aspect-video overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-[5cqw] text-[2.6cqw]" id="upnext"></div>
<strong class="text-[12px] uppercase tracking-wider text-ink-faint">Notes</strong><div id="notes" class="whitespace-pre-wrap text-[17px] font-medium leading-[1.6]"></div></section></main>
<script>
const bus = new BroadcastChannel(${JSON.stringify(channel)});
let started = Date.now();
const $ = (id) => document.getElementById(id);
bus.onmessage = (event) => {
  const s = event.data;
  if (s.type === 'closed') return window.close();
  if (s.type !== 'state') return;
  $('count').textContent = 'Slide ' + (s.index + 1) + ' of ' + s.total + ' · ' + s.title;
  $('current').innerHTML = s.current;
  $('upnext').innerHTML = s.next || '<p class="text-ink-faint">End of deck</p>';
  $('notes').textContent = s.notes || 'No notes for this slide.';
  document.title = 'Presenter · ' + s.title;
};
const go = (to) => bus.postMessage({ type: 'nav', to });
$('prev').onclick = () => go('prev');
$('next').onclick = () => go('next');
$('reset').onclick = () => { started = Date.now(); tick(); };
document.addEventListener('keydown', (e) => {
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go('next'); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go('prev'); }
});
const tick = () => { const s = Math.floor((Date.now() - started) / 1000); $('clock').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
setInterval(tick, 1000);
bus.postMessage({ type: 'hello' });
</script></body></html>`

/** The page's theme lives on <html> — class, data attributes, inline variables — so the second window copies it. */
const rootAttributes = () =>
  [...document.documentElement.attributes].map((attribute) => `${attribute.name}="${attribute.value.replace(/"/g, '&quot;')}"`).join(' ')

/**
 * A presentation that runs in the page: keyboard, a URL per slide, fullscreen,
 * an overview of every slide, and a presenter view in a second window.
 *
 * The presenter window is a separate document, so it cannot share React state;
 * it talks to the deck over a BroadcastChannel instead — the deck sends the
 * current slide, the next one and the notes, and either window can move the
 * deck. That is also what lets the presenter view sit on a laptop screen while
 * the deck is fullscreen on a projector. Slide text is sized in container
 * units, so the same slide reads the same on the stage, in the overview and in
 * the presenter preview.
 */
export function SlideDeck({ children, markdown, index, defaultIndex = 0, onIndexChange, hash = 'slide', label = 'Presentation', className }: SlideDeckProps) {
  const slides: ParsedSlide[] = markdown
    ? parseSlideDeckMarkdown(markdown)
    : Children.toArray(children)
        .filter(isValidElement)
        .map((child, i) => {
          const props = (child as ReactElement<SlideDeckSlideProps>).props
          return { content: child, notes: props.notes ?? '', title: props.title ?? `Slide ${i + 1}` }
        })
  const total = slides.length
  const [own, setOwn] = useState(defaultIndex)
  const current = Math.min(Math.max(index ?? own, 0), Math.max(total - 1, 0))
  const [overview, setOverview] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [notice, setNotice] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const busRef = useRef<BroadcastChannel | null>(null)
  // useId alone repeats across tabs of the same page, and two decks would steer each other.
  const [nonce] = useState(() => Math.random().toString(36).slice(2, 8))
  const channel = `klyv-slide-deck-${useId().replace(/[^a-zA-Z0-9]/g, '')}-${nonce}`
  const goRef = useRef<(to: number | 'next' | 'prev') => void>(() => undefined)

  const go = (to: number | 'next' | 'prev') => {
    const target = to === 'next' ? current + 1 : to === 'prev' ? current - 1 : to
    const next = Math.min(Math.max(target, 0), total - 1)
    if (next === current || total === 0) return
    if (index === undefined) setOwn(next)
    onIndexChange?.(next)
  }
  goRef.current = go

  // The hash is read once on arrival and followed on back/forward.
  useEffect(() => {
    if (!hash) return
    const read = () => {
      const match = new RegExp(`^#${hash}-(\\d+)$`).exec(window.location.hash)
      if (match) goRef.current(Number(match[1]) - 1)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [hash])

  useEffect(() => {
    if (!hash || total === 0) return
    const url = `${window.location.pathname}${window.location.search}#${hash}-${current + 1}`
    if (window.location.hash !== `#${hash}-${current + 1}`) window.history.replaceState(window.history.state, '', url)
  }, [hash, current, total])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const publish = () =>
    busRef.current?.postMessage({
      type: 'state',
      index: current,
      total,
      title: slides[current]?.title ?? '',
      notes: slides[current]?.notes ?? '',
      current: stageRef.current?.innerHTML ?? '',
      next: current + 1 < total ? nextRef.current?.innerHTML ?? '' : null,
    })
  const publishRef = useRef(publish)
  publishRef.current = publish

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const bus = new BroadcastChannel(channel)
    busRef.current = bus
    bus.onmessage = (event: MessageEvent<{ type: string; to?: number | 'next' | 'prev' }>) => {
      if (event.data.type === 'hello') publishRef.current()
      if (event.data.type === 'nav' && event.data.to !== undefined) goRef.current(event.data.to)
    }
    return () => {
      bus.postMessage({ type: 'closed' })
      bus.close()
    }
  }, [channel])

  useEffect(() => publish())

  const openPresenter = () => {
    if (typeof BroadcastChannel === 'undefined') return setNotice('This browser has no BroadcastChannel, so the presenter view cannot follow the deck.')
    const head = [...document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]')]
      .map((node) => (node instanceof HTMLLinkElement ? `<link rel="stylesheet" href="${node.href}">` : node.outerHTML))
      .join('')
    const page = URL.createObjectURL(new Blob([presenterPage(channel, head, rootAttributes())], { type: 'text/html' }))
    const opened = window.open(page, channel, 'width=1100,height=720')
    setNotice(opened ? 'Presenter view opened in a new window.' : 'The pop-up was blocked. Allow pop-ups for this page to open the presenter view.')
    setTimeout(() => URL.revokeObjectURL(page), 60_000)
  }

  const toggleFullscreen = () => {
    const root = rootRef.current
    if (!root?.requestFullscreen) return setNotice('Fullscreen is not available here.')
    if (document.fullscreenElement) void document.exitFullscreen()
    else root.requestFullscreen().catch(() => setNotice('The browser refused fullscreen.'))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return
    const keys: Record<string, () => void> = {
      ArrowRight: () => go('next'),
      PageDown: () => go('next'),
      ' ': () => go('next'),
      ArrowLeft: () => go('prev'),
      PageUp: () => go('prev'),
      Home: () => go(0),
      End: () => go(total - 1),
      o: () => setOverview((open) => !open),
      f: toggleFullscreen,
      s: openPresenter,
      Escape: () => setOverview(false),
    }
    if (overview && event.key !== 'Escape' && event.key !== 'o') return
    const action = keys[event.key]
    if (!action || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    action()
  }

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(gridRef.current?.querySelectorAll('button') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const columns = getComputedStyle(gridRef.current!).gridTemplateColumns.split(' ').length || 1
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key]
    if (step === undefined || at === -1) return
    event.preventDefault()
    buttons[Math.min(Math.max(at + step, 0), buttons.length - 1)]?.focus()
  }

  useEffect(() => {
    if (overview) gridRef.current?.querySelectorAll('button')[current]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview])

  const choose = (i: number) => {
    go(i)
    setOverview(false)
    rootRef.current?.focus()
  }

  const frame = '@container aspect-video w-full overflow-hidden bg-surface p-[5cqw] text-[2.6cqw] font-medium leading-[1.35] text-ink'

  return (
    <section
      ref={rootRef}
      tabIndex={0}
      aria-label={label}
      aria-roledescription="slide deck"
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-full flex-col gap-3 outline-offset-4',
        fullscreen && 'justify-center bg-app p-6',
        className,
      )}
    >
      {overview ? (
        <div ref={gridRef} role="group" aria-label="All slides" onKeyDown={onGridKey} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {slides.map((slide, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}. ${slide.title}`}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => choose(i)}
              className={cn('overflow-hidden rounded-[var(--radius-tile)] border-2 text-left', i === current ? 'border-accent-strong' : 'border-line hover:border-line-strong')}
            >
              <div aria-hidden="true" className={cn(frame, 'pointer-events-none')}>
                {slide.content}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)]">
          <div ref={stageRef} role="group" aria-roledescription="slide" aria-label={`${current + 1} of ${total}: ${slides[current]?.title ?? ''}`} className={frame}>
            {slides[current]?.content}
          </div>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-track">
            <div className="h-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${total ? ((current + 1) / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      <div hidden ref={nextRef}>
        {slides[current + 1]?.content}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => go('prev')} disabled={current === 0 || overview}>
          Previous
        </Button>
        <Button size="sm" onClick={() => go('next')} disabled={current >= total - 1 || overview}>
          Next
        </Button>
        <Text as="span" size="label" weight="bold" tabular className="px-1" aria-hidden="true">
          {current + 1} / {total}
        </Text>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" aria-pressed={overview} onClick={() => setOverview((open) => !open)}>
          Overview
        </Button>
        <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
          {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Button>
        <Button size="sm" variant="ghost" onClick={openPresenter}>
          Presenter view
        </Button>
      </div>
      <Text size="caption" tone="faint" role="status">
        {notice || `Slide ${current + 1} of ${total}. Arrows move, O for overview, F for fullscreen, S for the presenter view.`}
      </Text>
    </section>
  )
}
