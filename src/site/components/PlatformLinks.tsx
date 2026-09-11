import { Github, MessageCircle, Package, Twitter } from 'lucide-react'
import { cn, type IconComponent } from 'citrine'
import { brand } from '../brand'

type LinkId = (typeof brand.links)[number]['id']

const ICONS: Record<LinkId, IconComponent> = {
  github: Github,
  npm: Package,
  discord: MessageCircle,
  x: Twitter,
}

/**
 * The project's places elsewhere, as icon links. Each opens in a new tab and
 * says so to assistive technology, since an icon alone gives no warning.
 * The list and its hrefs live in `brand.ts`.
 */
export function PlatformLinks({ only, className }: { only?: LinkId[]; className?: string }) {
  const links = only ? brand.links.filter((link) => only.includes(link.id)) : brand.links

  return (
    <ul aria-label={`${brand.name} elsewhere`} className={cn('flex items-center gap-1.5', className)}>
      {links.map((link) => {
        const Icon = ICONS[link.id]
        return (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${link.label} (opens in a new tab)`}
              title={link.label}
              className="grid size-9 place-items-center rounded-full border border-line bg-surface text-ink-soft transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon size={15} aria-hidden />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
