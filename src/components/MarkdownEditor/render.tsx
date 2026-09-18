import type { ReactNode } from 'react'

/**
 * A deliberately small Markdown reader: headings, paragraphs, bold, italic,
 * inline and fenced code, links, quotes and lists.
 *
 * It builds React elements and never an HTML string, so there is nothing to
 * sanitise: text is text, whatever it contains. Links are the one way content
 * could act, and only safe schemes become anchors.
 */

const INLINE = /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/g

/** http, https, mailto, or a relative address. Everything else is rendered as plain text. */
export function isSafeMarkdownHref(href: string): boolean {
  const trimmed = href.trim()
  if (/^(https?:|mailto:)/i.test(trimmed)) return true
  // No scheme at all: a path, a fragment or a query.
  return !/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.startsWith('//')
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const pattern = new RegExp(INLINE.source, 'g')
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const [token, code, link, strong] = match
    const k = `${key}-${match.index}`
    if (code) {
      out.push(
        <code key={k} className="rounded-[var(--radius-5)] bg-surface-muted px-1 py-0.5 font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (link) {
      const split = token.indexOf('](')
      const words = token.slice(1, split)
      const href = token.slice(split + 2, -1)
      out.push(
        isSafeMarkdownHref(href) ? (
          <a key={k} href={href} className="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" rel="noreferrer noopener" target={/^https?:/i.test(href) ? '_blank' : undefined}>
            {inline(words, k)}
          </a>
        ) : (
          <span key={k}>{inline(words, k)}</span>
        ),
      )
    } else if (strong) {
      out.push(<strong key={k} className="font-bold">{inline(token.slice(2, -2), k)}</strong>)
    } else {
      out.push(<em key={k}>{inline(token.slice(1, -1), k)}</em>)
    }
    last = match.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function renderMarkdown(source: string, headingLevel: 2 | 3 | 4 = 3): ReactNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0

  const collect = (test: (line: string) => boolean) => {
    const taken: string[] = []
    while (index < lines.length && test(lines[index])) taken.push(lines[index++])
    return taken
  }

  while (index < lines.length) {
    const line = lines[index]
    const key = `b${index}`

    if (!line.trim()) {
      index += 1
    } else if (line.startsWith('```')) {
      index += 1
      const code = collect((candidate) => !candidate.startsWith('```'))
      index += 1
      blocks.push(
        <pre key={key} className="my-2 overflow-x-auto rounded-[var(--radius-10)] bg-surface-muted px-3 py-2 font-mono text-[12px]">
          <code>{code.join('\n')}</code>
        </pre>,
      )
    } else if (/^#{1,3}\s/.test(line)) {
      const depth = line.match(/^#+/)![0].length
      const Tag = `h${Math.min(6, headingLevel + depth - 1)}` as 'h2'
      const size = ['text-[17px]', 'text-[15px]', 'text-[13px]'][depth - 1]
      blocks.push(
        <Tag key={key} className={`mb-1.5 mt-3 font-extrabold tracking-[-0.01em] first:mt-0 ${size}`}>
          {inline(line.replace(/^#+\s+/, ''), key)}
        </Tag>,
      )
      index += 1
    } else if (line.startsWith('>')) {
      const quoted = collect((candidate) => candidate.startsWith('>')).map((candidate) => candidate.replace(/^>\s?/, ''))
      blocks.push(
        <blockquote key={key} className="my-2 border-l-2 border-line-strong pl-3 text-ink-soft">
          {inline(quoted.join(' '), key)}
        </blockquote>,
      )
    } else if (/^\s*[-*+]\s/.test(line) || /^\s*\d+[.)]\s/.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/
      const items = collect((candidate) => marker.test(candidate))
      const List = ordered ? 'ol' : 'ul'
      blocks.push(
        <List key={key} className={`my-2 flex flex-col gap-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item.replace(marker, ''), `${key}-${itemIndex}`)}</li>
          ))}
        </List>,
      )
    } else {
      const paragraph = collect((candidate) => Boolean(candidate.trim()) && !/^(```|#{1,3}\s|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(candidate))
      blocks.push(
        <p key={key} className="my-2 first:mt-0 last:mb-0">
          {inline(paragraph.join(' '), key)}
        </p>,
      )
    }
  }

  return blocks
}
