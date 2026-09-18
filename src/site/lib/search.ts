import { tokenGroups } from 'klyv'
import { groups } from '../data/groups'
import { libraryItems, type LibraryItemType } from '../data/library'
import { releaseLabel, releases } from '../data/changelog'
import { DOC_ENTRIES, SITE_PAGES } from '../data/pages'
import { SEARCH_ALIASES } from '../data/taxonomy'

/**
 * The site-wide search index, and the ranking over it.
 *
 * Everything is built from data the site already has — the library index, the
 * page map, the token registry and the changelog — so nothing needs a server.
 * `search()` is a pure function of the index and a query; putting a remote
 * search behind the palette later means replacing that one call.
 *
 * Ranking, strongest first: the whole query as the title, a title prefix, a
 * word in the title starting with it, a substring, the same with spaces and
 * hyphens ignored ("datatable"), then keywords and tags, then the description.
 * A query of several words must find every word somewhere. Words of five
 * letters or more tolerate one typo against a title word, and a query that
 * matches nothing else can still match as a subsequence ("dtbl" → DataTable).
 */
export type SearchGroup =
  | 'Pages'
  | 'Components'
  | 'Blocks'
  | 'Templates'
  | 'Recipes'
  | 'Integrations'
  | 'Groups'
  | 'Documentation'
  | 'Tokens'
  | 'Changelog'

export interface SearchEntry {
  id: string
  title: string
  description?: string
  group: SearchGroup
  to: string
  /** Search-only terms. */
  keywords: string[]
  /** A nudge for things most people are after — pages and featured items. */
  boost?: number
  /** For the library item, when there is one — favourites, the New marker. */
  itemId?: string
  /** Tags the entry is mainly about; a synonym match on these ranks higher. */
  primaryTags?: string[]
}

interface IndexedEntry extends SearchEntry {
  normTitle: string
  titleWords: string[]
  compactTitle: string
  normKeywords: string
  normDescription: string
  normPrimaryTags: string
}

export interface SearchIndex {
  entries: IndexedEntry[]
  byPath: Map<string, IndexedEntry>
}

const GROUP_FOR: Record<LibraryItemType, SearchGroup> = {
  component: 'Components',
  block: 'Blocks',
  template: 'Templates',
  recipe: 'Recipes',
  integration: 'Integrations',
}

export const normalise = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Run before normalising, which lowercases: "DataTable" → "Data Table". */
const splitCamel = (text: string) => text.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

function prepare(entry: SearchEntry): IndexedEntry {
  const normTitle = normalise(splitCamel(entry.title))
  return {
    ...entry,
    normTitle,
    titleWords: normTitle.split(' '),
    compactTitle: normTitle.replace(/ /g, ''),
    normKeywords: ` ${normalise(entry.keywords.map(splitCamel).join(' '))} `,
    normDescription: normalise(entry.description ?? ''),
    normPrimaryTags: ` ${normalise((entry.primaryTags ?? []).join(' '))} `,
  }
}

export function buildSearchIndex(): SearchIndex {
  const entries: SearchEntry[] = []

  for (const page of SITE_PAGES) {
    entries.push({
      id: `page:${page.to}`,
      title: page.label,
      description: page.description,
      group: 'Pages',
      to: page.to,
      keywords: page.keywords ?? [],
      boost: 6,
    })
  }

  for (const item of libraryItems) {
    entries.push({
      id: item.id,
      title: item.name,
      description: item.type === 'component' ? `${item.category} · ${item.description}` : item.description,
      group: GROUP_FOR[item.type],
      to: item.to,
      keywords: [...item.keywords, ...item.tags, ...(item.uses ?? [])],
      boost: item.isFeatured ? 4 : 0,
      itemId: item.id,
      primaryTags: item.primaryTags,
    })
  }

  for (const group of groups) {
    entries.push({
      id: `group:${group.slug}`,
      title: group.id,
      description: group.tagline,
      group: 'Groups',
      to: `/components?group=${group.slug}`,
      keywords: [group.slug, ...group.sections],
    })
  }

  for (const doc of DOC_ENTRIES) {
    entries.push({
      id: `doc:${doc.to}:${doc.label}`,
      title: doc.label,
      description: doc.page,
      group: 'Documentation',
      to: doc.to,
      keywords: [doc.page, ...(doc.keywords ?? [])],
    })
  }

  for (const group of tokenGroups) {
    for (const token of group.tokens) {
      entries.push({
        id: `token:${token.cssVar}`,
        title: token.cssVar,
        description: `${group.title} · ${token.usage}`,
        group: 'Tokens',
        to: '/tokens',
        keywords: [token.name, group.title, group.kind, 'token'],
        boost: -2,
      })
    }
  }

  for (const release of releases) {
    entries.push({
      id: `release:${release.version}`,
      title: `${releaseLabel(release)} — ${release.title}`,
      description: release.summary,
      group: 'Changelog',
      to: `/changelog/${release.version}`,
      keywords: ['release', 'changelog', release.version],
    })
    for (const [index, change] of release.changes.entries()) {
      entries.push({
        id: `change:${release.version}:${index}`,
        title: change.title,
        description: `${releaseLabel(release)} · ${change.category}`,
        group: 'Changelog',
        to: `/changelog/${release.version}`,
        keywords: [change.category, change.commit ?? '', ...(change.links?.map((link) => link.label) ?? [])],
        boost: -3,
      })
    }
  }

  const prepared = entries.map(prepare)
  const byPath = new Map<string, IndexedEntry>()
  for (const entry of prepared) {
    // First writer wins: the page or item for a path, not a changelog line.
    if (!byPath.has(entry.to)) byPath.set(entry.to, entry)
  }
  return { entries: prepared, byPath }
}

/* ------------------------------------------------------------------ ranking */

/**
 * True when a and b differ by at most one insertion, deletion, substitution or
 * swap of two neighbouring letters — the four typos people actually make.
 */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) {
      i += 2
      j += 2
    } else if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** A tight subsequence scores up to 24; a loose one is no match. */
function subsequence(query: string, text: string): number {
  let from = 0
  let first = -1
  let last = -1
  for (const char of query) {
    const at = text.indexOf(char, from)
    if (at < 0) return 0
    if (first < 0) first = at
    last = at
    from = at + 1
  }
  const density = query.length / (last - first + 1)
  return density < 0.5 ? 0 : Math.round(24 * density)
}

function scoreWord(word: string, entry: IndexedEntry): number {
  const { normTitle, titleWords, compactTitle, normKeywords, normDescription } = entry
  if (normTitle === word) return 100
  if (normTitle.startsWith(word)) return 80
  if (titleWords.some((part) => part.startsWith(word))) return 66
  if (normTitle.includes(word)) return 52
  if (word.length > 2 && compactTitle.includes(word)) return 48
  if (normKeywords.includes(` ${word} `)) return 40
  if (normKeywords.includes(` ${word}`)) return 32
  if (word.length > 2 && normKeywords.includes(word)) return 22
  if (word.length >= 5 && (withinOneEdit(word, compactTitle) || titleWords.some((part) => withinOneEdit(word, part)))) {
    return 30
  }
  // The word is a synonym for a tag this entry carries: "login" → authentication.
  // A tag the entry is mainly about outranks one it only inherits from its
  // section, so "login" puts PasswordInput ahead of an IP allowlist.
  const aliases = SEARCH_ALIASES[word] ?? []
  if (aliases.some((tag) => entry.normPrimaryTags.includes(` ${tag} `))) return 28
  for (const tag of aliases) {
    if (normKeywords.includes(` ${tag} `)) return 26
  }
  if (word.length > 3 && normDescription.includes(word)) return 12
  return 0
}

export interface SearchHit {
  entry: SearchEntry
  score: number
}

export const GROUP_ORDER: SearchGroup[] = [
  'Pages',
  'Components',
  'Blocks',
  'Templates',
  'Recipes',
  'Integrations',
  'Groups',
  'Documentation',
  'Tokens',
  'Changelog',
]

/**
 * Ranked hits, at most `perGroup` from each group, in score order — so the
 * palette's groups come out ordered by their best hit.
 */
export function search(index: SearchIndex, query: string, perGroup = 6): SearchHit[] {
  const normalised = normalise(splitCamel(query))
  if (!normalised) return []
  const words = normalised.split(' ')
  const compact = normalised.replace(/ /g, '')

  const hits: SearchHit[] = []
  for (const entry of index.entries) {
    let score = 0
    let matchedAll = true
    for (const word of words) {
      const wordScore = scoreWord(word, entry)
      if (wordScore === 0) {
        matchedAll = false
        break
      }
      score += wordScore
    }

    if (!matchedAll) {
      // Last resort, for abbreviations: the whole query as a subsequence of
      // the title. Only for queries long enough to mean something.
      const fuzzy = compact.length >= 3 ? subsequence(compact, entry.compactTitle) : 0
      if (!fuzzy) continue
      score = fuzzy
    } else if (words.length > 1 && entry.normTitle.includes(normalised)) {
      score += 30 // the words, in order
    }

    hits.push({ entry, score: score + (entry.boost ?? 0) })
  }

  hits.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))

  const taken = new Map<SearchGroup, number>()
  return hits.filter((hit) => {
    const count = taken.get(hit.entry.group) ?? 0
    if (count >= perGroup) return false
    taken.set(hit.entry.group, count + 1)
    return true
  })
}
