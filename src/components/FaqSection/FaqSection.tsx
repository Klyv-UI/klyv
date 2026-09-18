'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { plural } from '../../lib/format'
import { Accordion } from '../Accordion'
import { SearchField } from '../SearchField'
import { SegmentedControl } from '../SegmentedControl'
import { Text } from '../Text'

export interface FaqSectionItem {
  /** Also the anchor: `#billing-refunds` opens and scrolls to this question. */
  id: string
  question: string
  answer: ReactNode
  /** Plain-text answer, used for search and structured data when `answer` is not a string. */
  answerText?: string
  /** Filter group. Tabs appear once any item has one. */
  category?: string
}

export interface FaqSectionProps {
  items: FaqSectionItem[]
  title?: string
  /** A line under the title. */
  description?: ReactNode
  /** Level of the section heading. */
  headingLevel?: 'h2' | 'h3'
  /** Show the search field. */
  searchable?: boolean
  /** Actions for the “Still have questions?” area — usually a contact link or button. Omit to hide the area. */
  contact?: ReactNode
  /** Heading of the contact area. */
  contactTitle?: string
  /** A line under the contact heading — how and how fast you answer. */
  contactDescription?: ReactNode
  /** Emit FAQPage JSON-LD for the questions with plain-text answers. */
  structuredData?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const textOf = (item: FaqSectionItem) => item.answerText ?? (typeof item.answer === 'string' ? item.answer : '')

/**
 * A marketing FAQ that can be searched, filtered and linked into.
 *
 * Support teams answer the same question by pasting a link to it, so every
 * question is addressable: its id is an anchor, and arriving on
 * `#that-id` — on load or later — clears any filter that would hide it, opens
 * it and scrolls it into view. Search matches answers as well as questions,
 * since people search for the words in their problem rather than the heading
 * someone chose, and the number of matches is announced as it changes.
 *
 * The questions are an Accordion, so the open-one-at-a-time behaviour and its
 * keyboard model are the library’s own. `structuredData` writes FAQPage JSON-LD
 * from the plain-text answers, which is what search engines read for rich results.
 */
export function FaqSection({
  items,
  title = 'Frequently asked questions',
  description,
  headingLevel = 'h2',
  searchable = true,
  contact,
  contactTitle = 'Still have questions?',
  contactDescription,
  structuredData = false,
  className,
}: FaqSectionProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [target, setTarget] = useState<string | null>(null)
  const root = useRef<HTMLElement>(null)
  const headingId = useId()

  const categories = [...new Set(items.flatMap((item) => (item.category ? [item.category] : [])))]
  const needle = query.trim().toLowerCase()
  const visible = items.filter(
    (item) =>
      (category === 'all' || item.category === category) &&
      (!needle || `${item.question} ${textOf(item)}`.toLowerCase().includes(needle)),
  )

  useEffect(() => {
    const follow = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id || !items.some((item) => item.id === id)) return
      setQuery('')
      setCategory('all')
      setTarget(id)
    }
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [items])

  // Once the linked question is rendered and open, bring it into view and focus its trigger.
  useEffect(() => {
    if (!target) return
    const anchor = [...(root.current?.querySelectorAll<HTMLElement>('[data-faq-anchor]') ?? [])].find(
      (node) => node.dataset.faqAnchor === target,
    )
    const trigger = anchor?.closest('button')
    trigger?.scrollIntoView({ block: 'center' })
    trigger?.focus({ preventScroll: true })
  }, [target])

  const Heading = headingLevel
  const schema = structuredData
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items
          .filter((item) => textOf(item))
          .map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: textOf(item) },
          })),
      }).replace(/</g, '\\u003c')
    : null

  return (
    <section ref={root} className={cn('flex w-full flex-col gap-6', className)} aria-labelledby={headingId}>
      <div className="flex flex-col gap-2">
        <Heading id={headingId} className="m-0 text-[24px] font-extrabold tracking-[-0.03em] text-ink">{title}</Heading>
        {description && (
          <Text size="body" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>

      {(searchable || categories.length > 0) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {categories.length > 0 && (
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl
                label="Question category"
                size="sm"
                value={category}
                onValueChange={setCategory}
                options={[{ value: 'all', label: 'All' }, ...categories.map((value) => ({ value, label: value }))]}
              />
            </div>
          )}
          {searchable && (
            <SearchField
              label="Search questions"
              placeholder="Search questions"
              value={query}
              onValueChange={setQuery}
              containerClassName="sm:w-64"
            />
          )}
        </div>
      )}

      <Text as="p" size="caption" tone="faint" role="status" className={cn(!needle && category === 'all' && 'sr-only')}>
        {`${plural(visible.length, 'question')}${needle ? ` matching “${query.trim()}”` : ''}`}
      </Text>

      {visible.length > 0 ? (
        <Accordion
          // Remounting on a deep link is what opens the linked question, since Accordion keeps its own open state.
          key={target ?? 'faq'}
          defaultOpen={target ? [target] : []}
          items={visible.map((item) => ({
            id: item.id,
            title: item.question,
            meta: <span id={item.id} data-faq-anchor={item.id} className="block scroll-mt-24" />,
            content:
              typeof item.answer === 'string' ? (
                <Text size="body" tone="soft" leading="normal">
                  {item.answer}
                </Text>
              ) : (
                item.answer
              ),
          }))}
        />
      ) : (
        <div className="rounded-[var(--radius-tile)] border border-dashed border-line-strong p-6 text-center">
          <Text size="body" weight="bold">
            No questions match
          </Text>
          <Text size="label" tone="soft" className="mt-1">
            {contact ? 'Try fewer words, or ask us directly below.' : 'Try fewer or different words.'}
          </Text>
        </div>
      )}

      {contact && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-tile)] bg-surface-sunken p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Text size="heading" weight="bold">
              {contactTitle}
            </Text>
            {contactDescription && (
              <Text size="label" tone="soft" leading="normal">
                {contactDescription}
              </Text>
            )}
          </div>
          <div className="flex flex-wrap gap-2">{contact}</div>
        </div>
      )}

      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />}
    </section>
  )
}
