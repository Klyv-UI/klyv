import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, RotateCcw, Upload } from 'lucide-react'
import {
  Badge,
  Button,
  Kbd,
  PaletteExtractor,
  Progress,
  Reveal,
  Switch,
  Tag,
  Text,
  VisuallyHidden,
  cn,
  type PaletteExtractorColor,
} from 'klyvui'
import { chooseAccent } from '../../lib/theme'
import { useAccent } from '../../components/useTheme'
import { Eyebrow } from '../../components/Eyebrow'

/**
 * "Make it yours": drop a logo anywhere on the page and the page becomes that
 * brand.
 *
 * A landing page usually asks a visitor to imagine the product in their
 * colours. This one does it for them. An image dragged onto any part of the
 * page — or pasted — is read by `PaletteExtractor`, entirely in the browser,
 * and its most vivid colour becomes the accent, so every component on the
 * site repaints in the visitor's brand at once. Any other colour it found is
 * one click away, and the previous accent is one click back.
 *
 * Nothing is uploaded: the file becomes a blob URL, the pixels are sampled on
 * a canvas, and the URL is revoked when it is replaced or the section leaves.
 * The three samples are drawn on a canvas too, so the idea works for someone
 * with no logo to hand.
 */
export function BrandDrop() {
  const accent = useAccent()
  const [image, setImage] = useState<{ src: string; alt: string; owned: boolean } | null>(null)
  const [palette, setPalette] = useState<PaletteExtractorColor[]>([])
  const [previous, setPrevious] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('')
  const [samples, setSamples] = useState<{ id: string; name: string; src: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  // Apply the first palette of each new image automatically; later changes
  // (the count slider, the refine toggle) leave the choice to the reader.
  const pendingAuto = useRef(false)
  const accentRef = useRef(accent)
  accentRef.current = accent

  useEffect(() => setSamples(SAMPLE_BRANDS.map((brand) => ({ id: brand.id, name: brand.name, src: drawSample(brand) }))), [])

  // A blob URL this section made is released when it is replaced or unmounted.
  useEffect(() => {
    if (!image?.owned) return
    const src = image.src
    return () => URL.revokeObjectURL(src)
  }, [image])

  const load = useCallback((src: string, alt: string, owned: boolean) => {
    pendingAuto.current = true
    setImage({ src, alt, owned })
    setStatus(`Reading the colours of ${alt}…`)
  }, [])

  const loadFile = useCallback(
    (file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) return
      load(URL.createObjectURL(file), file.name || 'your image', true)
    },
    [load],
  )

  const apply = useCallback((hex: string, announce = true) => {
    // Read the accent now, before it changes: an updater that read the ref
    // would run after the repaint and remember the new colour as the old.
    const before = accentRef.current
    setPrevious((kept) => kept ?? before)
    chooseAccent(hex)
    if (announce) setStatus(`Themed to ${hex.toUpperCase()}. Every component on this page follows.`)
  }, [])

  const onPalette = useCallback(
    (colors: PaletteExtractorColor[]) => {
      setPalette(colors)
      if (!pendingAuto.current || colors.length === 0) return
      pendingAuto.current = false
      apply(mostVivid(colors).hex)
    },
    [apply],
  )

  // The whole page is the drop target: dragging an image anywhere over it
  // raises the overlay, and pasting one works too.
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth += 1
      setDragging(true)
    }
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      loadFile(Array.from(event.dataTransfer?.files ?? []).find((file) => file.type.startsWith('image/')))
    }
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const file = Array.from(event.clipboardData?.files ?? []).find((entry) => entry.type.startsWith('image/'))
      if (!file) return
      event.preventDefault()
      loadFile(file)
      document.getElementById('make-it-yours')?.scrollIntoView({ block: 'center' })
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [loadFile])

  const undo = () => {
    if (!previous) return
    chooseAccent(previous)
    setStatus(`Back to ${previous.toUpperCase()}.`)
    setPrevious(null)
  }

  return (
    <section id="make-it-yours" aria-labelledby="make-it-yours-title" className="scroll-mt-24 px-3 py-1.5 sm:px-4 lg:px-5">
      <DropOverlay visible={dragging} />
      <Reveal>
        <div className="landing-panel landing-panel-band mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-10 rounded-[var(--radius-window)] border border-line px-5 py-12 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14 lg:px-12 lg:py-16">
          <div className="flex min-w-0 flex-col items-start gap-5">
            <Eyebrow>Make it yours</Eyebrow>
            <Text
              as="h2"
              id="make-it-yours-title"
              size="title"
              className="max-w-[14ch] text-balance text-[32px] leading-[1.02] tracking-[-0.045em] sm:text-[44px] lg:text-[52px]"
            >
              Drop your logo.{' '}
              <span className="text-ink-faint">This page becomes your brand.</span>
            </Text>
            <Text size="body" weight="medium" tone="soft" className="max-w-[46ch] text-[15px] leading-relaxed sm:text-[17px]">
              Drag a logo, a product shot or any photo onto this page — anywhere — or paste one. Its colours are read
              right here in your browser, nothing is uploaded, and the most vivid one themes every component you can
              see.
            </Text>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => inputRef.current?.click()} className="h-10 px-5">
                <Upload size={15} aria-hidden />
                Choose an image
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  loadFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Text as="span" size="caption" tone="faint" className="inline-flex items-center gap-1.5">
                or paste with
                <span className="inline-flex gap-1">
                  <Kbd>{isMac() ? '⌘' : 'Ctrl'}</Kbd>
                  <Kbd>V</Kbd>
                </span>
              </Text>
            </div>

            <div className="flex w-full flex-col gap-2.5 border-t border-line pt-5">
              <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
                No logo to hand? Try one of these
              </Text>
              <div className="flex flex-wrap gap-2">
                {samples.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => load(sample.src, `the ${sample.name} sample logo`, false)}
                    aria-pressed={image?.src === sample.src}
                    className={cn(
                      'flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[13px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      image?.src === sample.src && 'border-line-strong text-ink',
                    )}
                  >
                    <img src={sample.src} alt="" className="size-7 rounded-full object-cover" />
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>

            <VisuallyHidden>
              <span role="status" aria-live="polite">
                {status}
              </span>
            </VisuallyHidden>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {image ? (
              <>
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-tile)]">
                  <PaletteExtractor src={image.src} alt={image.alt} defaultCount={6} onPaletteChange={onPalette} />
                </div>
                <AccentChooser palette={palette} accent={accent} onChoose={apply} previous={previous} onUndo={undo} />
              </>
            ) : (
              <EmptyDrop onChoose={() => inputRef.current?.click()} />
            )}
            <LivePreview />
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ------------------------------------------------------------------ parts */

/** The whole-window overlay while an image is dragged over the page. */
function DropOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-[color-mix(in_oklab,var(--color-canvas)_70%,transparent)] p-6 backdrop-blur-md transition-opacity duration-200 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="flex size-full max-h-[640px] max-w-[1100px] flex-col items-center justify-center gap-4 rounded-[var(--radius-window)] border-2 border-dashed border-accent-strong bg-[color-mix(in_oklab,var(--color-accent-soft)_55%,transparent)] text-center">
        <span className="grid size-16 place-items-center rounded-full bg-accent text-accent-ink shadow-[var(--shadow-float)]">
          <ImagePlus size={28} aria-hidden />
        </span>
        <p className="m-0 text-[32px] font-extrabold tracking-[-0.04em] text-ink sm:text-[48px]">Drop to theme this page</p>
        <p className="m-0 text-[15px] font-medium text-ink-soft">Read in your browser. Nothing is uploaded.</p>
      </div>
    </div>
  )
}

/** Before an image arrives: the drop target, drawn as one. */
function EmptyDrop({ onChoose }: { onChoose: () => void }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className="group flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-surface px-6 text-center transition-colors hover:border-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-ink transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <ImagePlus size={24} aria-hidden />
      </span>
      <Text as="span" size="heading" className="text-[18px]">
        Drop an image anywhere on the page
      </Text>
      <Text as="span" size="caption" tone="soft">
        PNG, JPG, SVG or WebP — or click to choose one
      </Text>
    </button>
  )
}

/** Every extracted colour as an accent to try, with the current one marked. */
function AccentChooser({
  palette,
  accent,
  onChoose,
  previous,
  onUndo,
}: {
  palette: PaletteExtractorColor[]
  accent: string
  onChoose: (hex: string) => void
  previous: string | null
  onUndo: () => void
}) {
  if (palette.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Text as="span" size="label" weight="semibold" tone="soft" className="mr-1">
        Use as accent
      </Text>
      {palette.map((color) => {
        const active = color.hex.toLowerCase() === accent.toLowerCase()
        return (
          <button
            key={color.hex}
            type="button"
            aria-pressed={active}
            onClick={() => onChoose(color.hex)}
            className={cn(
              'grid size-9 place-items-center rounded-full border border-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none motion-reduce:hover:scale-100',
              active && 'ring-2 ring-ink ring-offset-2 ring-offset-canvas',
            )}
            style={{ background: color.hex, color: color.ink }}
          >
            {active && <Check size={15} strokeWidth={3} aria-hidden />}
            <VisuallyHidden>{color.hex.toUpperCase()}</VisuallyHidden>
          </button>
        )
      })}
      {previous && (
        <Button variant="ghost" size="sm" onClick={onUndo} className="ml-auto">
          <RotateCcw size={13} aria-hidden />
          Undo
        </Button>
      )}
    </div>
  )
}

/**
 * A few everyday components right beside the palette, so the repaint is seen
 * without scrolling — though the whole page has changed with them.
 */
function LivePreview() {
  const [on, setOn] = useState(true)
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5">
      <Button size="sm">Primary action</Button>
      <label className="flex items-center gap-2">
        <Switch checked={on} onChange={(event) => setOn(event.target.checked)} />
        <Text as="span" size="label" weight="semibold">
          Notifications
        </Text>
      </label>
      <Badge>New</Badge>
      <Tag size="sm" tone="accent">
        Pro plan
      </Tag>
      <Progress value={68} label="Onboarding progress" className="min-w-[120px] flex-1" />
    </div>
  )
}

/** The paste shortcut's modifier, as the reader's keyboard labels it. */
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/* ---------------------------------------------------------------- colour */

/**
 * The colour a brand most likely means: the most saturated one that covers
 * enough of the image not to be a stray highlight. Chroma leads rather than
 * coverage, because a logo's pale backing shape often covers more of the
 * image than the brand colour drawn on it. Pale tints are marked down for the
 * same reason, and near-white, near-black and greys are passed over, since a
 * logo's background is usually one of them.
 */
function mostVivid(colors: PaletteExtractorColor[]): PaletteExtractorColor {
  const candidates = colors.filter((color) => color.share >= 0.02 && color.oklch.c >= 0.04 && color.oklch.l > 0.2 && color.oklch.l < 0.95)
  if (candidates.length === 0) return colors[0]
  const score = (color: PaletteExtractorColor) => color.oklch.c * (color.oklch.l > 0.82 ? 0.55 : 1)
  return candidates.reduce((best, color) => (score(color) > score(best) ? color : best))
}

/* --------------------------------------------------------------- samples */

/** Invented brands, drawn rather than shipped as files. */
const SAMPLE_BRANDS = [
  { id: 'fernway', name: 'Fernway', colours: ['#0f8a6c', '#9be3c9'], shape: 'leaf' },
  { id: 'quillo', name: 'Quillo', colours: ['#e8572a', '#ffd3b8'], shape: 'ring' },
  { id: 'halcyon', name: 'Halcyon', colours: ['#4f46e5', '#c7c4ff'], shape: 'wave' },
] as const

/** A small square logo on a light ground, drawn once on a canvas. */
function drawSample(brand: (typeof SAMPLE_BRANDS)[number]): string {
  const size = 240
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return ''
  const [main, soft] = brand.colours
  context.fillStyle = '#f7f6f2'
  context.fillRect(0, 0, size, size)
  context.fillStyle = soft
  context.beginPath()
  context.arc(size / 2, size / 2, 92, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = main
  context.strokeStyle = main
  if (brand.shape === 'leaf') {
    context.beginPath()
    context.moveTo(size / 2, 52)
    context.quadraticCurveTo(200, size / 2, size / 2, 188)
    context.quadraticCurveTo(40, size / 2, size / 2, 52)
    context.fill()
  } else if (brand.shape === 'ring') {
    context.lineWidth = 28
    context.beginPath()
    context.arc(size / 2, size / 2, 56, 0, Math.PI * 2)
    context.stroke()
  } else {
    context.lineWidth = 22
    context.lineCap = 'round'
    for (const offset of [-34, 0, 34]) {
      context.beginPath()
      context.moveTo(62, size / 2 + offset)
      context.bezierCurveTo(100, size / 2 + offset - 28, 140, size / 2 + offset + 28, 178, size / 2 + offset)
      context.stroke()
    }
  }
  return canvas.toDataURL('image/png')
}
