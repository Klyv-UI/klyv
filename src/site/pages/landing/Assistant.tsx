import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Search, Sparkles } from 'lucide-react'
import {
  ChatThread,
  Kbd,
  MessageComposer,
  Reveal,
  ShimmerText,
  Tag,
  Text,
  cn,
  type ChatThreadMessage,
} from 'klyv'
import { blocks } from '../../data/blocks'
import { componentCount, findComponentByName } from '../../data/catalog'
import { LandingSection, SectionLink, WindowDots } from './primitives'

/**
 * A preview of the component assistant, which ships in the next release.
 *
 * The rest of this page is real components running, and so is this section:
 * the thread is ChatThread, the box is MessageComposer, the busy label is
 * ShimmerText, and every card beside it is a real catalogue entry whose link
 * works. What is not real yet is the understanding — the three conversations
 * are scripted, the section says so in as many words, and the badge says when
 * the real thing arrives. Nothing here pretends to be answering.
 *
 * Typing is allowed, because a text box that cannot be typed in reads as
 * broken. Anything sent gets the honest reply: this is not switched on yet,
 * and here are the two ways to search that are.
 */

/** A recommendation: a catalogue name, and why the assistant picked it. */
interface Match {
  name: string
  why: string
}

interface Conversation {
  id: string
  /** What the visitor asked — also the label on the chip that replays it. */
  prompt: string
  /** The assistant's sentence. Its matches are shown beside the thread. */
  reply: string
  matches: Match[]
  /** A finished screen that already puts those components together. */
  block?: string
}

const CONVERSATIONS: Conversation[] = [
  {
    id: 'hero',
    prompt: 'Find me a modern hero section for a SaaS website.',
    reply:
      'Here are the hero sections that match. HeroSection is the one to start from — announcement, promise, two actions and the product, on the display scale. The other two are what usually sits directly under it.',
    matches: [
      { name: 'HeroSection', why: 'The first screen of a marketing site, not an in-app banner' },
      { name: 'LogoCloud', why: 'The proof strip a hero is usually followed by' },
      { name: 'FeatureGrid', why: 'Benefit-led features, the section after the fold' },
      { name: 'AuroraSurface', why: 'Drifting light behind the hero, and it holds 60fps' },
    ],
    block: 'saas-landing',
  },
  {
    id: 'pricing',
    prompt: 'I need a pricing component with monthly and yearly billing.',
    reply:
      'Four of them have billing periods. PricingTable is the whole section — plans behind a period switch, with the yearly saving computed from the plans rather than typed in. Take BillingToggle on its own if you already have the cards.',
    matches: [
      { name: 'PricingTable', why: 'Plans behind a period switch, saving computed from the plans' },
      { name: 'BillingToggle', why: 'Monthly or yearly on its own, saving pinned beside the track' },
      { name: 'PricingCard', why: 'One plan — the highlighted popular tier' },
      { name: 'FeatureComparison', why: 'The plan-by-feature matrix that sits under the cards' },
    ],
  },
  {
    id: 'usage',
    prompt: 'Show a customer how much of their plan they have used.',
    reply:
      'That is an entitlement over a billing period, so UsageMeter — unlimited and over-the-limit are states of their own there, rather than a bar that quietly fills up. The rest is what a plan screen puts around it.',
    matches: [
      { name: 'UsageMeter', why: 'Seats, storage and MAUs over a billing period' },
      { name: 'UsagePricingCalculator', why: 'What the next tier would cost, with the arithmetic shown' },
      { name: 'UpgradePrompt', why: 'The upsell to show once they are near the limit' },
      { name: 'PlanSummary', why: 'The plan, its status, and the one date that matters next' },
    ],
  },
]

/** What the assistant says to anything typed, until it can actually answer. */
const NOT_YET =
  'I am not switched on yet — natural-language search ships in the next release. Until then: ⌘K searches every component, screen, recipe and token, and Find My UI asks two questions and recommends from the answers.'

const ASSISTANT = { id: 'klyv', name: 'Klyv Assistant' }
const VISITOR = { id: 'you', name: 'You' }

export function Assistant() {
  // One clock for the whole thread, so the scripted times never drift apart
  // between renders and the day divider stays on today.
  const start = useRef(Date.now() - 4 * 60_000).current
  const clock = useRef(0)
  const at = () => start + (clock.current += 45_000)

  const first = CONVERSATIONS[0]
  const [messages, setMessages] = useState<ChatThreadMessage[]>(() => [
    { id: 'q-hero', author: VISITOR, body: first.prompt, sentAt: start, status: 'read' },
    { id: 'a-hero', author: ASSISTANT, body: first.reply, sentAt: start + 20_000 },
  ])
  const [answered, setAnswered] = useState(first.id)
  const [thinking, setThinking] = useState(false)

  // Every timer this section starts, cleared when it leaves — a reply landing
  // after the visitor has moved on would set state on an unmounted tree.
  const timers = useRef<number[]>([])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(window.clearTimeout)
  }, [])
  const later = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms))

  const ask = (conversation: Conversation) => {
    if (thinking) return
    setMessages((list) => [
      ...list,
      { id: `q-${conversation.id}-${list.length}`, author: VISITOR, body: conversation.prompt, sentAt: at(), status: 'read' },
    ])
    setThinking(true)
    later(1100, () => {
      setThinking(false)
      setAnswered(conversation.id)
      setMessages((list) => [
        ...list,
        { id: `a-${conversation.id}-${list.length}`, author: ASSISTANT, body: conversation.reply, sentAt: at() },
      ])
    })
  }

  const send = (text: string) => {
    setMessages((list) => [...list, { id: `q-typed-${list.length}`, author: VISITOR, body: text, sentAt: at(), status: 'read' }])
    setThinking(true)
    later(900, () => {
      setThinking(false)
      setMessages((list) => [...list, { id: `a-typed-${list.length}`, author: ASSISTANT, body: NOT_YET, sentAt: at() }])
    })
  }

  const current = CONVERSATIONS.find((entry) => entry.id === answered) ?? first

  return (
    <LandingSection
      id="assistant"
      index={7}
      eyebrow="Component assistant"
      title="Say what you are building."
      tail="Get the components that fit."
      lede={`Describing a screen is easier than knowing what it is called. In the next release the assistant reads what you are after and recommends from all ${componentCount} components, screens and recipes — with the reason it picked each one.`}
      action={<ComingSoon />}
      band
    >
      <Reveal>
        <div className="overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface shadow-[var(--shadow-window)]">
          {/* Window chrome, so the preview reads as the product it will be —
              and carries the badge a second time, right at the chat itself. */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
            <WindowDots />
            <span className="flex min-w-0 items-center gap-2">
              <Sparkles size={13} strokeWidth={2.5} aria-hidden className="shrink-0 text-accent" />
              <Text as="span" size="caption" weight="bold" truncate>
                Klyv Assistant
              </Text>
            </span>
            <Tag size="sm" tone="outline" className="ml-auto shrink-0">
              Coming soon
            </Tag>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <div className="flex min-w-0 flex-col border-line lg:border-r">
              <ChatThread
                messages={messages}
                currentUserId={VISITOR.id}
                label="Component assistant preview"
                className="h-[340px]"
              />
              {/* The busy label sits under the thread rather than inside it, so
                  it never becomes a message the log announces twice. It holds
                  its row whether or not it is showing, so the composer below
                  does not jump as a reply is worked out. */}
              <div className="h-5 px-4">
                {thinking && (
                  <ShimmerText className="text-[12px] font-semibold">Reading {componentCount} components…</ShimmerText>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
                    Try one
                  </Text>
                  {CONVERSATIONS.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => ask(conversation)}
                      disabled={thinking}
                      aria-pressed={answered === conversation.id}
                      className={cn(
                        'max-w-full truncate rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
                        answered === conversation.id && 'border-accent-strong text-ink',
                      )}
                    >
                      {conversation.prompt}
                    </button>
                  ))}
                </div>
                <MessageComposer
                  label="Ask the component assistant"
                  placeholder="Describe the screen you are building…"
                  maxRows={3}
                  sending={thinking}
                  onSend={({ text }) => send(text)}
                />
              </div>
            </div>

            <Results conversation={current} />
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <Text size="caption" tone="faint" leading="normal" className="max-w-[78ch]">
            Labelled honestly: the chat, the thread and the cards above are real components from this library, and
            every recommendation links to its real page. The answers are scripted until the assistant ships — search
            and Find My UI already work.
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2">
              <Search size={13} aria-hidden className="text-ink-faint" />
              <Text as="span" size="caption" weight="semibold" tone="soft">
                Search everything with
              </Text>
              <span className="inline-flex items-center gap-1">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </span>
            <SectionLink to="/find">
              <Compass size={12} aria-hidden className="mr-0.5" />
              Find My UI, today
            </SectionLink>
          </div>
        </div>
      </Reveal>
    </LandingSection>
  )
}

/** The recommendations beside the thread — real entries, real links. */
function Results({ conversation }: { conversation: Conversation }) {
  const block = conversation.block ? blocks.find((entry) => entry.slug === conversation.block) : undefined

  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-line bg-surface-sunken p-4 lg:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <Text as="h3" size="caption" weight="bold" className="uppercase tracking-[0.14em] text-ink-soft">
          Recommended
        </Text>
        <Text as="span" size="micro" weight="bold" tone="faint" tabular>
          {conversation.matches.length} of {componentCount}
        </Text>
      </div>

      <ul className="flex flex-col gap-2">
        {conversation.matches.map((match) => {
          const entry = findComponentByName(match.name)
          if (!entry) return null
          return (
            <li key={match.name}>
              <Link
                to={`/components/${entry.slug}`}
                className="group flex items-start gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-3 transition-colors hover:border-line-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <Text as="span" size="label" weight="bold">
                      {entry.name}
                    </Text>
                    <Text as="span" size="micro" weight="semibold" tone="faint" truncate>
                      {entry.group} · {entry.section}
                    </Text>
                  </span>
                  <Text as="span" size="caption" tone="soft" leading="normal">
                    {match.why}
                  </Text>
                </span>
                <ArrowRight
                  size={13}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            </li>
          )
        })}
      </ul>

      {block && (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3">
          <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
            Or start from a finished screen
          </Text>
          <SectionLink to={`/blocks/${block.slug}`}>{block.name} — built from these</SectionLink>
        </div>
      )}
    </div>
  )
}

/** The badge that says this is next, not now. */
function ComingSoon() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--color-accent-strong)_40%,transparent)] bg-accent-soft px-3 py-1.5">
      <Sparkles size={13} strokeWidth={2.5} aria-hidden className="text-ink" />
      <Text as="span" size="label" weight="bold">
        Coming soon
      </Text>
      <Text as="span" size="label" weight="semibold" tone="soft">
        in the next release
      </Text>
    </span>
  )
}
