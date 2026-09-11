import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CodeXml, Eye, Palette } from 'lucide-react'
import {
  ACCENT_PRESETS,
  Badge,
  Button,
  Card,
  CodeBlock,
  Field,
  InlineMessage,
  Input,
  PasswordInput,
  SegmentedControl,
  Text,
  VisuallyHidden,
  applyAccent,
  cn,
  deriveAccent,
  saveAccent,
} from 'citrine'
import { useAccent } from '../../components/useTheme'
import { brand } from '../../brand'
import { blockCount } from '../../data/blocks'
import { componentCount } from '../../data/catalog'
import { componentEvidence } from '../../data/evidence'
import { InstallCommand, TokenSwatch } from './primitives'

const axeClean = Object.values(componentEvidence).filter((entry) => entry.axe).length

/**
 * The hero: what this is, in one sentence, and the product doing it.
 *
 * The visual is not a screenshot. It is a small window onto the three things
 * the library does for one screen — the screen itself, built from real
 * components; the code that produces it; and the one colour that themes it —
 * and each tab is live.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
      {/* A hairline grid, faded out from the top left, and one faint wash of the
          accent. Both are drawn from tokens, so they repaint with the rest. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(var(--color-line-strong)_1px,transparent_1px),linear-gradient(90deg,var(--color-line-strong)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(70%_60%_at_20%_0%,#000_10%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_85%_20%,color-mix(in_oklab,var(--color-accent)_12%,transparent),transparent_70%)]"
      />

      <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-12 px-5 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="flex min-w-0 flex-col items-start gap-7">
          <a
            href="#platform"
            className="group inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Badge>New</Badge>
            <Text as="span" size="micro" weight="bold" tone="soft" truncate>
              Composer, smart search and a personal workspace
            </Text>
            <ArrowRight size={12} aria-hidden className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </a>

          <h1
            id="hero-title"
            className="max-w-[15ch] text-balance text-[42px] font-extrabold leading-[1] tracking-[-0.045em] text-ink sm:text-[56px] lg:text-[64px]"
          >
            Production React UI, themed by{' '}
            {/* A flat marker under the words rather than a gradient: the accent
                is the subject of the sentence, so it is the accent exactly. */}
            <span className="relative isolate whitespace-nowrap">
              <span aria-hidden className="absolute inset-x-[-0.06em] bottom-[0.06em] -z-10 h-[0.34em] rounded-[0.08em] bg-accent" />
              one colour
            </span>
          </h1>

          <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[54ch] sm:text-[16px]">
            {componentCount} accessible components and {blockCount} finished screens. Install them, copy them as
            source, or assemble them in the Composer — then change one colour and every one of them follows.
          </Text>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button as={Link} to="/getting-started">
              Get started
              <ArrowRight size={14} aria-hidden />
            </Button>
            <Button as={Link} to="/composer" variant="outline">
              Open the Composer
            </Button>
          </div>

          <InstallCommand className="w-full sm:w-auto" />

          <ul aria-label="At a glance" className="flex flex-wrap gap-x-5 gap-y-2">
            {[`${axeClean} components pass axe`, 'Two runtime dependencies', 'TypeScript · ESM · Server Components'].map((fact) => (
              <li key={fact} className="inline-flex items-center gap-1.5">
                <Check size={13} strokeWidth={2.5} aria-hidden className="text-ink-faint" />
                <Text as="span" size="caption" weight="semibold" tone="soft">
                  {fact}
                </Text>
              </li>
            ))}
          </ul>
        </div>

        <ProductWindow />
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- product window */

type View = 'preview' | 'code' | 'theme'

const HERO_CODE = `import { Button, Card, Field, Input, PasswordInput } from '${brand.pkg}'

export default function SignIn() {
  return (
    <Card title="Welcome back">
      <form className="flex flex-col gap-4">
        <Field label="Email">
          <Input type="email" placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <PasswordInput />
        </Field>
        <Button type="submit" fullWidth>
          Continue
        </Button>
      </form>
    </Card>
  )
}`

function ProductWindow() {
  const [view, setView] = useState<View>('preview')

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[620px] lg:max-w-none">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-window)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
            </span>
            <Text as="span" size="caption" weight="semibold" tone="faint" className="truncate font-mono">
              SignIn.tsx
            </Text>
          </div>
          <SegmentedControl<View>
            label="Example view"
            size="sm"
            value={view}
            onValueChange={setView}
            options={[
              { value: 'preview', label: 'Preview', icon: Eye },
              { value: 'code', label: 'Code', icon: CodeXml },
              { value: 'theme', label: 'Theme', icon: Palette },
            ]}
          />
        </div>

        {/* One fixed height for all three views, so switching never moves the page. */}
        <div className="h-[440px] overflow-y-auto">
          {view === 'preview' && <PreviewView />}
          {view === 'code' && (
            <div className="p-3 sm:p-4 [&_pre]:text-[12px]">
              <CodeBlock language="tsx" code={HERO_CODE} numbered />
            </div>
          )}
          {view === 'theme' && <ThemeView />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <Text as="span" size="caption" tone="faint">
            Card · Field · Input · PasswordInput · Button
          </Text>
          <Link to="/composer" className="rounded-md text-[12px] font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Build your own in the Composer →
          </Link>
        </div>
      </div>
    </div>
  )
}

/** The screen itself — a working form, not a picture of one. */
function PreviewView() {
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setState('pending')
    window.setTimeout(() => setState('done'), 700)
  }

  return (
    <div className="grid min-h-full place-items-center bg-app p-5 sm:p-8">
      {/* h2, not h3: the hero has only its h1 above this, and a level may not be skipped. */}
      <Card title="Welcome back" headingLevel="h2" className="w-full max-w-[340px]">
        <form className="flex flex-col gap-4" onSubmit={submit} aria-label="Example sign-in">
          <Field label="Email">
            <Input type="email" placeholder="you@example.com" autoComplete="off" />
          </Field>
          <Field label="Password">
            <PasswordInput autoComplete="off" />
          </Field>
          <Button type="submit" fullWidth loading={state === 'pending'}>
            Continue
          </Button>
          <div aria-live="polite" className="min-h-[18px]">
            {state === 'done' && (
              <InlineMessage tone="success">Signed in — every part of this form is a library component.</InlineMessage>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}

/** The one colour, and the four values derived from it. */
function ThemeView() {
  const hex = useAccent()
  const family = deriveAccent(hex)

  const pick = (next: string) => {
    applyAccent(next)
    saveAccent(next)
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <Text size="heading">Pick an accent</Text>
        <Text size="caption" tone="soft" leading="normal">
          The whole page repaints — this window, the header, every button. Nothing in the library names a colour.
        </Text>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((preset) => {
          const active = preset.hex.toLowerCase() === hex.toLowerCase()
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => pick(preset.hex)}
              aria-pressed={active}
              title={preset.name}
              className={cn(
                'size-10 rounded-[12px] border border-line-strong transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100',
                active && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
              )}
              style={{ background: preset.hex }}
            >
              <VisuallyHidden>{preset.name}</VisuallyHidden>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TokenSwatch compact token="--color-accent" value={family.accent} />
        <TokenSwatch compact token="--color-accent-strong" value={family.strong} />
        <TokenSwatch compact token="--color-accent-soft" value={family.soft} />
        <TokenSwatch compact token="--color-accent-ink" value={family.ink} />
      </div>

      <CodeBlock language="ts" code={`import { applyAccent } from '${brand.pkg}'\n\napplyAccent('${hex}')`} />
    </div>
  )
}
