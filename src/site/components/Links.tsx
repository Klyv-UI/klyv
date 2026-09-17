import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Surface, Text } from 'klyv'
import { findComponentByName } from '../data/catalog'

const chip =
  'inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] font-bold text-ink-soft transition-colors hover:bg-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Component names as links to their pages — the "built from" row. */
export function ComponentLinks({ names, label = 'Components' }: { names: string[]; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {names.map((name) => {
        const entry = findComponentByName(name)
        return (
          <li key={name}>
            {entry ? (
              <Link to={`/components/${entry.slug}`} className={chip}>
                {name}
              </Link>
            ) : (
              <span className={chip}>{name}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** A route on this site, or a URL somewhere else — which opens in a new tab and says so. */
export function DocLink({ label, to, href }: { label: string; to?: string; href?: string }) {
  if (to) {
    return (
      <Link to={to} className={chip}>
        {label}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${chip} gap-1`}>
      {label}
      <ExternalLink size={11} aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** The "no such thing" card, in the shape the component and block pages use. */
export function Missing({ title, children, to, label }: { title: string; children: ReactNode; to: string; label: string }) {
  return (
    <Surface variant="card" className="items-start gap-2 p-8">
      <Text as="h1" size="subtitle">
        {title}
      </Text>
      <Text size="body" weight="medium" tone="soft" leading="normal">
        {children}
      </Text>
      <Link to={to} className="mt-2 text-[13px] font-bold text-ink underline underline-offset-2">
        {label}
      </Link>
    </Surface>
  )
}
