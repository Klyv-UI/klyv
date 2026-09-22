import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CodeBlock, Surface, Text, cn } from 'klyvui'
import { brand } from '../brand'
import { catalog } from '../data/catalog'
import { dependenciesOf } from '../data/dependencies'
import { bundleSource, sourceFilesFor } from '../data/source'

/**
 * The component's own implementation, and everything it needs to compile
 * somewhere else.
 *
 * A file on its own is not a usable answer: two thirds of this library imports
 * at least one sibling, so "copy this" without the dependency set hands someone
 * a paste that does not build. The set comes from a graph generated off the
 * real imports, which is the same graph the CLI resolves — what is listed here
 * is exactly what `klyvui add` writes.
 */
export function SourceCode({ component }: { component: string }) {
  const files = useMemo(() => sourceFilesFor(component), [component])
  const resolved = useMemo(() => dependenciesOf(component), [component])

  const [active, setActive] = useState(0)
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    setActive(0)
  }, [component])

  useEffect(() => {
    const file = files[active]
    if (!file) return

    let cancelled = false
    setCode(null)
    file.load().then((text) => {
      if (!cancelled) setCode(text)
    })

    return () => {
      cancelled = true
    }
  }, [files, active])

  if (files.length === 0) {
    return (
      <Text size="caption" tone="faint">
        No source found for {component}.
      </Text>
    )
  }

  const current = files[active]
  const brought = resolved.components.filter((name) => name !== component)
  const slugOf = (name: string) => catalog.find((entry) => entry.name === name)?.slug

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Install component={component} />
        <Requires brought={brought} shared={resolved.shared} slugOf={slugOf} />
      </div>

      {files.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Source files"
        >
          {files.map((file, index) => (
            <button
              key={file.path}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={cn(
                'rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors',
                index === active
                  ? 'bg-ink text-ink-inverse'
                  : 'bg-surface-muted text-ink-soft hover:bg-line-strong hover:text-ink',
              )}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}

      <CodeBlock
        // Remounting on file change resets the copy button and the collapsed
        // state, so a "Copied" flash never carries over to a file that was not
        // copied, and a new file starts clipped rather than mid-scroll.
        key={current.path}
        language={current.path}
        code={code ?? '…'}
        numbered
        collapsible
        collapsedLines={18}
      />

      <BundleButton component={component} paths={resolved.files} />
    </div>
  )
}

/* ----------------------------------------------------------------- install */

function Install({ component }: { component: string }) {
  const slug = catalog.find((entry) => entry.name === component)?.slug ?? component
  return (
    <div className="flex flex-col gap-2">
      <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
        Add it to your project
      </Text>
      <CodeBlock language="bash" code={`npx ${brand.pkg} add ${slug}`} highlight={false} />
      <Text size="caption" tone="faint" leading="normal">
        Writes the files below into <code className="font-mono">src/</code>, dependencies included.
        Or copy them by hand — the imports are relative, so nothing needs rewriting.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- requires */

function Requires({
  brought,
  shared,
  slugOf,
}: {
  brought: string[]
  shared: string[]
  slugOf: (name: string) => string | undefined
}) {
  return (
    <div className="flex flex-col gap-2">
      <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
        Depends on
      </Text>
      <Surface variant="sunken" padding="sm" className="h-full gap-2.5">
        {brought.length === 0 && shared.length === 0 ? (
          <Text size="caption" tone="soft">
            Nothing. This one stands alone.
          </Text>
        ) : (
          <>
            {brought.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {brought.map((name) => {
                  const slug = slugOf(name)
                  const label = (
                    <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:text-ink">
                      {name}
                    </span>
                  )
                  return slug ? (
                    <Link key={name} to={`/components/${slug}`} className="rounded-full">
                      {label}
                    </Link>
                  ) : (
                    <span key={name}>{label}</span>
                  )
                })}
              </div>
            )}
            {shared.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {shared.map((path) => (
                  <span
                    key={path}
                    className="rounded-full bg-surface px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-faint"
                  >
                    {path}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ bundle */

/**
 * Copies the whole dependency set as one paste.
 *
 * The sources are fetched only when the button is pressed — a page that
 * preloaded twenty files on the chance someone might want them would cost every
 * reader for the few who do.
 */
function BundleButton({ component, paths }: { component: string; paths: string[] }) {
  const [state, setState] = useState<'idle' | 'working' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    setState('idle')
  }, [component])

  const copy = async () => {
    setState('working')
    try {
      await navigator.clipboard.writeText(await bundleSource(paths))
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('failed')
    }
  }

  const label =
    state === 'working'
      ? 'Collecting…'
      : state === 'copied'
        ? `Copied ${paths.length} files`
        : state === 'failed'
          ? 'Could not copy'
          : `Copy all ${paths.length} files`

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        disabled={state === 'working'}
        className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-ink-inverse transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {label}
      </button>
      <Text size="caption" tone="faint" leading="normal">
        One paste, every file, each under a header saying where it goes.
      </Text>
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied' ? `${paths.length} files copied to clipboard` : ''}
      </span>
    </div>
  )
}
