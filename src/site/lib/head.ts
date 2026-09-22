import { brand } from '../brand'
import { findComponent } from '../data/catalog'
import { findBlock } from '../data/blocks'
import { SITE_PAGES } from '../data/pages'

/**
 * The document head, per route.
 *
 * A single-page app keeps the head it was served unless something changes it,
 * so every page shared a title, one description and one canonical URL — which
 * is what a search engine, a link preview and a browser tab all read. The
 * title also has to be right for a screen reader, which announces it on
 * navigation.
 *
 * Everything here is derived from the data the pages themselves render, so a
 * new component or block is described without being listed again.
 */

const DESCRIPTIONS: Record<string, string> = {
  '/': brand.pitch,
}

function meta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, name)
    document.head.append(tag)
  }
  tag.content = content
}

function canonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.append(link)
  }
  link.href = url
}

/** The title and description for a path, or the site's own when it has none. */
export function headFor(pathname: string): { title: string; description: string } {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : '/'
  // "Klyv — an accent-led…", matching the title the document is served with.
  const site = `${brand.name} — ${brand.tagline.replace(/\.$/, '').replace(/^./, (letter) => letter.toLowerCase())}`

  // The landing page is the site itself, not the "Overview" entry in the nav.
  if (path === '/') return { title: site, description: DESCRIPTIONS['/'] }

  const component = path.startsWith('/components/') ? findComponent(path.slice('/components/'.length)) : undefined
  if (component) {
    const article = /^[AEIOU]/.test(component.group) ? 'An' : 'A'
    return {
      title: `${component.name} — ${brand.name} React component`,
      description: `${component.blurb} ${article} ${component.group} component in ${brand.name}, with live examples, its props and its source.`,
    }
  }

  const block = path.startsWith('/blocks/') ? findBlock(path.slice('/blocks/'.length)) : undefined
  if (block) {
    return {
      title: `${block.name} — ${brand.name} block`,
      description: `${block.blurb} A finished screen assembled from ${brand.name} components, with its full source.`,
    }
  }

  const page = SITE_PAGES.find((entry) => entry.to === path)
  if (page) return { title: `${page.label} — ${brand.name}`, description: page.description }

  // A path with data behind it that is not in the nav — a template, a recipe,
  // an integration, a release. Its own page sets the heading; the tab says
  // where it is.
  const [section] = path.split('/').filter(Boolean)
  if (section) {
    const label = section.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
    return { title: `${label} — ${brand.name}`, description: brand.pitch }
  }
  return { title: site, description: brand.pitch }
}

/** Writes the head for a path. Called on every navigation. */
export function applyHead(pathname: string) {
  const { title, description } = headFor(pathname)
  const url = `${brand.url}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`

  document.title = title
  meta('description', description)
  canonical(url)
  meta('og:title', title, 'property')
  meta('og:description', description, 'property')
  meta('og:url', url, 'property')
  meta('twitter:title', title)
  meta('twitter:description', description)
}
