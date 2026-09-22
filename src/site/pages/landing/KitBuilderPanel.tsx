import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, X } from 'lucide-react'
import { CodeBlock, FuzzyFinder, Text, VisuallyHidden, cn, type FuzzyFinderItem } from 'klyvui'
import { brand } from '../../brand'
import { catalog, findComponentByName } from '../../data/catalog'
import { dependenciesOf } from '../../data/dependencies'
import { moduleSizes } from '../../data/module-sizes'
import { library, sizes } from '../../data/sizes'

/**
 * The kit builder's working half: a picker, the weighing, and the command.
 *
 * Weighing a set is not adding up its members. Each component's published
 * size already includes everything it imports, so two that share a Button
 * would count it twice. Here every member is resolved to its modules with the
 * same `dependenciesOf` the CLI uses, the union is taken, and each module is
 * counted once from its measured size in the real build. The difference
 * between that and the naive sum is shown too, because it is the reason the
 * number can be trusted.
 *
 * Gzip is measured per module, so the sum is an upper bound — a bundle
 * compresses better than its parts — and it is labelled "at most". The
 * unminified byte count is exact.
 */

/** Ready-made sets, so the numbers mean something before anything is picked. */
const KITS = [
  { id: 'observability', label: 'Observability', names: ['TraceWaterfall', 'FlameGraph', 'ErrorBudget', 'LogPatterns', 'TimeSeriesExplorer'] },
  { id: 'dashboard', label: 'Dashboard', names: ['DataTable', 'AreaChart', 'StatCard', 'Tabs', 'DatePicker', 'Select'] },
  { id: 'sign-in', label: 'Sign-in', names: ['Field', 'Input', 'PasswordInput', 'Checkbox', 'Button', 'SocialLoginButtons'] },
  { id: 'editor', label: 'Editor', names: ['RichTextEditor', 'CommentAnchors', 'Avatar', 'Toast', 'CommandPalette'] },
] as const

const ITEMS: FuzzyFinderItem[] = catalog
  .filter((entry) => entry.name in sizes)
  .map((entry) => ({ id: entry.name, label: entry.name, detail: `${entry.group} · ${entry.blurb}` }))

const kB = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 2 : 1)} kB`

/** The set's cost, with each module counted once. */
function weigh(names: string[]) {
  const owners = new Map<string, string[]>()
  const brought = new Set<string>()
  const external = new Set<string>()
  for (const name of names) {
    const resolved = dependenciesOf(name)
    for (const file of resolved.files) {
      if (!moduleSizes[file]) continue // barrels fold away in the build
      const list = owners.get(file) ?? []
      list.push(name)
      owners.set(file, list)
    }
    for (const component of resolved.components) if (component !== name) brought.add(component)
    for (const pkg of resolved.external) external.add(pkg)
  }
  for (const name of names) brought.delete(name)

  let bytes = 0
  let gzip = 0
  let sharedGzip = 0
  const own = new Map<string, number>(names.map((name) => [name, 0]))
  for (const [file, list] of owners) {
    const size = moduleSizes[file]
    bytes += size.bytes
    gzip += size.gzip
    if (list.length === 1) own.set(list[0], (own.get(list[0]) ?? 0) + size.gzip)
    else sharedGzip += size.gzip
  }
  const naive = names.reduce((sum, name) => sum + (sizes[name]?.gzip ?? 0), 0)

  return { bytes, gzip, naive, modules: owners.size, brought: [...brought].sort(), external: [...external].sort(), own, sharedGzip }
}

/** Shades of the accent for the bar, deepening toward the ink; shared code is neutral. */
const shade = (index: number) => `color-mix(in oklab, var(--color-accent) ${100 - ((index * 13) % 65)}%, var(--color-ink))`

export default function KitBuilderPanel() {
  const [kit, setKit] = useState<string[]>([...KITS[0].names])
  const result = useMemo(() => weigh(kit), [kit])

  const add = (name: string) => setKit((current) => (current.includes(name) ? current : [...current, name]))
  const remove = (name: string) => setKit((current) => current.filter((entry) => entry !== name))
  const activeKit = KITS.find((entry) => entry.names.length === kit.length && entry.names.every((name) => kit.includes(name)))

  const slugs = kit.map((name) => findComponentByName(name)?.slug).filter(Boolean)
  const command = kit.length
    ? `npx ${brand.pkg} add ${slugs.join(' ')}\n\n# or, from the package\nimport { ${kit.join(', ')} } from '${brand.pkg}'`
    : `npx ${brand.pkg} add …`
  const saved = result.naive - result.gzip
  const share = result.gzip / library.gzip

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* The picker. */}
      <div className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-2">
          <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
            Start from a kit
          </Text>
          <div role="group" aria-label="Starter kits" className="flex flex-wrap gap-1.5">
            {KITS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={activeKit?.id === entry.id}
                onClick={() => setKit([...entry.names])}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  activeKit?.id === entry.id
                    ? 'border-transparent bg-accent text-accent-ink'
                    : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
            Or add any of {ITEMS.length}
          </Text>
          <FuzzyFinder items={ITEMS} label="Add a component to the kit" placeholder="Search components…" height={300} onSelect={(item) => add(item.id)} />
        </div>
      </div>

      {/* The weighing. */}
      <div className="flex min-w-0 flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <ul aria-label="In the kit" className="flex min-h-9 flex-wrap gap-1.5">
          {kit.length === 0 && (
            <li>
              <Text size="caption" tone="soft">
                Nothing yet — start from a kit or search for a component.
              </Text>
            </li>
          )}
          {kit.map((name, index) => (
            <li key={name}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken py-1 pl-2.5 pr-1 text-[12.5px] font-semibold text-ink">
                <span aria-hidden className="size-2 rounded-full" style={{ background: shade(index) }} />
                {name}
                <button
                  type="button"
                  onClick={() => remove(name)}
                  className="grid size-5 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X size={12} aria-hidden />
                  <VisuallyHidden>Remove {name}</VisuallyHidden>
                </button>
              </span>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 sm:grid-cols-4" aria-live="polite">
          <Figure label="gzipped, at most" value={kB(result.gzip)} lead />
          <Figure label="unminified, exact" value={kB(result.bytes)} />
          <Figure label="modules" value={String(result.modules)} />
          <Figure label="of the whole library" value={`${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`} />
        </dl>

        {kit.length > 0 && (
          <div className="flex flex-col gap-3">
            <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-full bg-track">
              {kit.map((name, index) => (
                <span
                  key={name}
                  className="h-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${((result.own.get(name) ?? 0) / Math.max(1, result.gzip)) * 100}%`, background: shade(index) }}
                />
              ))}
              <span
                className="h-full bg-line-strong transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${(result.sharedGzip / Math.max(1, result.gzip)) * 100}%` }}
              />
            </div>
            <table className="w-full text-left text-[13px]">
              <caption className="sr-only">What each component adds on its own, gzipped</caption>
              <tbody>
                {kit.map((name, index) => (
                  <tr key={name} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-1.5 pr-3 font-semibold text-ink">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: shade(index) }} />
                        <Link to={`/components/${findComponentByName(name)?.slug ?? ''}`} className="hover:underline">
                          {name}
                        </Link>
                      </span>
                    </th>
                    <td className="py-1.5 text-right font-mono tabular-nums text-ink-soft">{kB(result.own.get(name) ?? 0)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="py-1.5 pr-3 font-semibold text-ink-soft">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="size-2 rounded-full bg-line-strong" />
                      Shared between them, counted once
                    </span>
                  </th>
                  <td className="py-1.5 text-right font-mono tabular-nums text-ink-soft">{kB(result.sharedGzip)}</td>
                </tr>
              </tbody>
            </table>
            {saved > 0 && (
              <Text size="caption" tone="soft" leading="normal">
                Added up one by one, these would read {kB(result.naive)}. Counting the code they share once saves{' '}
                <strong className="font-bold text-ink">{kB(saved)}</strong>
                {result.brought.length > 0 && (
                  <>
                    , and brings in {result.brought.length} more component{result.brought.length === 1 ? '' : 's'} they
                    build on — {result.brought.slice(0, 6).join(', ')}
                    {result.brought.length > 6 ? '…' : ''}
                  </>
                )}
                . Runtime packages: {result.external.join(', ') || 'none'}.
              </Text>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <Text as="span" size="label" weight="semibold" className="inline-flex items-center gap-2">
            <Package size={14} aria-hidden className="text-ink-faint" />
            Take exactly this
          </Text>
          <CodeBlock language="bash" code={command} />
        </div>
      </div>
    </div>
  )
}

function Figure({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="order-2">
        <Text as="span" size="caption" tone="soft">
          {label}
        </Text>
      </dt>
      <dd className={cn('order-1 font-extrabold tabular-nums tracking-[-0.04em] text-ink', lead ? 'text-[34px] leading-none' : 'text-[24px] leading-none')}>
        {value}
      </dd>
    </div>
  )
}
