import { useEffect, useState } from 'react'
import { Text, contrastRatio, deriveAccent, cn } from 'klyv'

/**
 * What the chosen accent does to legibility, as numbers.
 *
 * The derivation promises that any hue stays readable. This is the page
 * checking that promise out loud for whichever hue is picked — including a
 * custom one from the colour input, which is where it would break if it broke.
 *
 * Two pairs are measured, because they are the two places accent colour meets
 * text: a label sitting on a filled accent (every primary button), and body
 * text sitting on the soft wash (every selected row). Both use the 4.5:1 WCAG
 * threshold for normal-size text.
 */
export function ContrastReadout({ hex, className }: { hex: string; className?: string }) {
  const family = deriveAccent(hex)

  // The page ink and the wash in effect both depend on the theme, so they are
  // read off the document rather than assumed.
  const [page, setPage] = useState({ ink: '#17191c', wash: family.soft })

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    setPage({
      ink: styles.getPropertyValue('--color-ink').trim() || '#17191c',
      wash: styles.getPropertyValue('--color-accent-soft').trim() || family.soft,
    })
  }, [hex, family.soft])

  const pairs = [
    { label: 'Label on accent', ratio: contrastRatio(family.ink, family.accent), fg: family.ink, bg: family.accent },
    { label: 'Text on wash', ratio: contrastRatio(page.ink, page.wash), fg: page.ink, bg: page.wash },
  ]

  return (
    <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}>
      {pairs.map((pair) => (
        <Pair key={pair.label} {...pair} />
      ))}
    </div>
  )
}

function Pair({
  label,
  ratio,
  fg,
  bg,
}: {
  label: string
  ratio: number
  fg: string
  bg: string
}) {
  const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fails'
  const passes = ratio >= 4.5

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-tile)] border border-line p-2.5">
      <span
        aria-hidden="true"
        className="grid h-9 w-11 shrink-0 place-items-center rounded-[8px] text-[13px] font-extrabold"
        style={{ background: bg, color: fg }}
      >
        Aa
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
          {label}
        </Text>
        <div className="flex items-baseline gap-2">
          <Text size="body" weight="extrabold" tabular>
            {ratio.toFixed(1)}:1
          </Text>
          <span
            className={cn(
              'text-[11px] font-bold',
              passes ? 'text-success' : 'text-danger',
            )}
          >
            {grade}
          </span>
        </div>
      </div>
    </div>
  )
}
