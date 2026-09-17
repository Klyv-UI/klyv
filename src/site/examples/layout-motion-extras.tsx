import { useState } from 'react'
import { FileText, MessageSquare, Plus, Trash2 } from 'lucide-react'
import {
  AnimatedList,
  ArticlePager,
  Avatar,
  Badge,
  Button,
  Container,
  ContainerBleed,
  DownloadButton,
  IconButton,
  InfiniteScroll,
  LanguageSwitcher,
  LikeButton,
  MarkerHighlight,
  SegmentedControl,
  Stack,
  Surface,
  Text,
  VersionSwitcher,
  VersionSwitcherNotice,
  type AnimatedListAnimation,
  type MarkerHighlightVariant,
  type StackGap,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function Box({ children }: { children: React.ReactNode }) {
  return (
    <Surface variant="sunken" padding="sm" className="text-[12px] font-semibold text-ink-soft">
      {children}
    </Surface>
  )
}

/* ------------------------------------------------------------------ Stack */

function StackExample() {
  const [gap, setGap] = useState<'2' | '4' | '8'>('4')
  const [dividers, setDividers] = useState<'off' | 'on'>('on')
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <SegmentedControl
          label="Gap"
          size="sm"
          value={gap}
          onValueChange={setGap}
          options={[
            { value: '2', label: 'gap 2' },
            { value: '4', label: 'gap 4' },
            { value: '8', label: 'gap 8' },
          ]}
        />
        <SegmentedControl
          label="Dividers"
          size="sm"
          value={dividers}
          onValueChange={setDividers}
          options={[
            { value: 'off', label: 'No dividers' },
            { value: 'on', label: 'Dividers' },
          ]}
        />
      </div>
      <Surface variant="card" padding="lg">
        <Stack direction={{ base: 'column', md: 'row' }} gap={Number(gap) as StackGap} dividers={dividers === 'on'} align="stretch">
          {[
            ['Monthly spend', '$12,480'],
            ['Active cards', '18'],
            ['Pending receipts', '7'],
          ].map(([label, value]) => (
            <Stack key={label} gap={1} className="flex-1">
              <Text size="caption" tone="faint">
                {label}
              </Text>
              <Text size="subtitle">{value}</Text>
            </Stack>
          ))}
        </Stack>
      </Surface>
      <Text size="caption" tone="faint">
        Stacked below md, side by side above — the dividers turn with it.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ Container */

function ContainerExample() {
  const [size, setSize] = useState<'sm' | 'prose' | 'lg'>('prose')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Size"
        size="sm"
        value={size}
        onValueChange={setSize}
        className="self-start"
        options={[
          { value: 'sm', label: 'sm' },
          { value: 'prose', label: 'prose' },
          { value: 'lg', label: 'lg' },
        ]}
      />
      <div className="w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-app py-6">
        <Container size={size} className="flex flex-col gap-3">
          <Text size="heading">Quarterly close checklist</Text>
          <Text size="label" tone="soft" leading="normal">
            Reconcile every card account against the statement, chase the receipts that are still missing, and lock the
            period once the numbers agree. Anything posted after the lock moves to the next quarter automatically.
          </Text>
          <ContainerBleed>
            <div className="flex h-20 items-center justify-center bg-[color-mix(in_oklab,var(--color-accent)_24%,transparent)] text-[12px] font-bold text-ink">
              ContainerBleed runs to the gutter’s edge
            </div>
          </ContainerBleed>
          <Text size="label" tone="soft" leading="normal">
            The text column keeps its measure while the band above ignores the gutter.
          </Text>
        </Container>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ InfiniteScroll */

const NAMES = ['Ada Park', 'Bruno Silva', 'Chen Wei', 'Dara Okafor', 'Elif Kaya', 'Farah Nadeem', 'Gus Holm', 'Hana Sato', 'Ivo Marić', 'Jun Ito', 'Kofi Mensah', 'Lena Vogel', 'Mira Shah', 'Nils Berg', 'Omar Haddad', 'Pia Lund', 'Quinn Ross', 'Rae Kim']

function InfiniteScrollExample() {
  const [mode, setMode] = useState<'auto' | 'button'>('button')
  const [count, setCount] = useState(6)
  const [failNext, setFailNext] = useState(true)
  const hasMore = count < NAMES.length

  const loadMore = async () => {
    await wait(700)
    if (failNext) {
      setFailNext(false)
      throw new Error('The connection dropped. Nothing was lost.')
    }
    const added = Math.min(4, NAMES.length - count)
    setCount((value) => value + added)
    return added
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Mode"
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'button', label: 'Button' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCount(6)
            setFailNext(true)
          }}
        >
          Reset
        </Button>
      </div>
      <Surface variant="card" className="h-[320px] overflow-y-auto">
        <InfiniteScroll key={mode} mode={mode} hasMore={hasMore} onLoadMore={loadMore} itemNoun="member" endMessage="That’s everyone on the team">
          <ul aria-label="Team members" className="flex flex-col">
            {NAMES.slice(0, count).map((name, index) => (
              <li key={name} className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Avatar name={name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-ink">{name}</span>
                  <span className="block text-[11px] font-medium text-ink-faint">Joined {index + 2} weeks ago</span>
                </span>
              </li>
            ))}
          </ul>
        </InfiniteScroll>
      </Surface>
      <Text size="caption" tone="faint">
        The first load fails on purpose, to show the retry.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ LanguageSwitcher */

const LANGUAGES = [
  { value: 'en', nativeName: 'English', englishName: 'English' },
  { value: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { value: 'fr', nativeName: 'Français', englishName: 'French' },
  { value: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { value: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)' },
  { value: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  { value: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  { value: 'pl', nativeName: 'Polski', englishName: 'Polish' },
  { value: 'tr', nativeName: 'Türkçe', englishName: 'Turkish' },
  { value: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { value: 'ko', nativeName: '한국어', englishName: 'Korean' },
  { value: 'zh-Hans', nativeName: '简体中文', englishName: 'Chinese (Simplified)' },
  { value: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { value: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
]

function LanguageSwitcherExample() {
  const [locale, setLocale] = useState('de')
  const current = LANGUAGES.find((language) => language.value === locale)
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <LanguageSwitcher options={LANGUAGES} value={locale} onValueChange={setLocale} />
        <LanguageSwitcher options={LANGUAGES} value={locale} onValueChange={setLocale} variant="compact" label="Site language" />
      </div>
      <Text size="caption" tone="faint">
        Current locale: <span className="font-bold text-ink">{current?.englishName}</span> ({locale})
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ VersionSwitcher */

const VERSIONS = [
  { value: '4.0.0-beta', label: 'v4.0 beta', status: 'prerelease' as const },
  { value: '3.2', label: 'v3.2', status: 'latest' as const, hint: 'Aug 2026' },
  { value: '3.1', label: 'v3.1', hint: 'Mar 2026' },
  { value: '2.8', label: 'v2.8', status: 'deprecated' as const, hint: 'LTS ended' },
]

function VersionSwitcherExample() {
  const [version, setVersion] = useState('2.8')
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <Text size="body">Docs</Text>
        <VersionSwitcher versions={VERSIONS} value={version} onValueChange={setVersion} />
      </div>
      <VersionSwitcherNotice versions={VERSIONS} value={version} latestHref="#latest" />
      <Surface variant="card" padding="lg" className="gap-2">
        <Text size="heading">Authentication</Text>
        <Text size="label" tone="soft" leading="normal">
          Every request carries a bearer token in the Authorization header. Tokens expire after an hour.
        </Text>
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ DownloadButton */

function DownloadButtonExample() {
  const [fail, setFail] = useState(false)
  const simulate = async ({ signal, onProgress }: { signal: AbortSignal; onProgress: (fraction: number) => void }) => {
    for (let step = 1; step <= 20; step += 1) {
      if (signal.aborted) return
      await wait(120)
      onProgress(step / 20)
      if (fail && step === 12) throw new Error('Network error')
    }
  }
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Outcome"
        size="sm"
        value={fail ? 'fail' : 'succeed'}
        onValueChange={(value) => setFail(value === 'fail')}
        className="self-start"
        options={[
          { value: 'succeed', label: 'Succeeds' },
          { value: 'fail', label: 'Fails at 60%' },
        ]}
      />
      <Surface variant="card" padding="lg" className="flex-row flex-wrap items-center gap-4">
        <span className="flex size-10 items-center justify-center rounded-[var(--radius-glyph)] bg-surface-muted text-ink-soft">
          <FileText size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-ink">Q3 expense report</span>
          <span className="block text-[11px] font-medium text-ink-faint">Generated 17 Sep 2026</span>
        </span>
        <DownloadButton label="Download report" format="PDF" size={2_430_000} onDownload={simulate} />
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ LikeButton */

function LikeButtonExample() {
  const [flaky, setFlaky] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setError(null)
    await wait(600)
    if (flaky) throw new Error('Couldn’t save your like — it has been undone.')
  }
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Server"
        size="sm"
        value={flaky ? 'fail' : 'ok'}
        onValueChange={(value) => setFlaky(value === 'fail')}
        className="self-start"
        options={[
          { value: 'ok', label: 'Saves' },
          { value: 'fail', label: 'Rejects' },
        ]}
      />
      <Surface variant="card" padding="lg" className="gap-3">
        <div className="flex items-center gap-3">
          <Avatar name="Mira Shah" size="sm" />
          <Text size="body">Mira Shah</Text>
        </div>
        <Text size="label" tone="soft" leading="normal">
          Shipped the new approvals flow today. Receipts now attach themselves when the card is tapped.
        </Text>
        <div className="flex items-center gap-2">
          <LikeButton defaultCount={1204} onLikedChange={save} onError={(reason) => setError(reason instanceof Error ? reason.message : 'Failed')} />
          <Button variant="ghost" size="sm">
            <MessageSquare size={14} aria-hidden="true" />
            Reply
          </Button>
        </div>
        {error && (
          <Text size="caption" tone="danger" weight="semibold" role="alert">
            {error}
          </Text>
        )}
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ AnimatedList */

interface Task {
  id: string
  title: string
}

const TASK_POOL = ['Approve travel budget', 'Chase missing receipts', 'Renew the design tool licence', 'Close September books', 'Rotate the API key', 'Invite the new contractor', 'Archive old projects']

function AnimatedListExample() {
  const [tasks, setTasks] = useState<Task[]>(TASK_POOL.slice(0, 3).map((title, index) => ({ id: `t${index}`, title })))
  const [next, setNext] = useState(3)
  const [animation, setAnimation] = useState<AnimatedListAnimation>('slide-up')

  const add = () => {
    setTasks((current) => [{ id: `t${next}`, title: TASK_POOL[next % TASK_POOL.length] }, ...current])
    setNext((value) => value + 1)
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Animation"
          size="sm"
          value={animation}
          onValueChange={setAnimation}
          options={[
            { value: 'slide-up', label: 'Slide up' },
            { value: 'slide-right', label: 'Slide right' },
            { value: 'fade', label: 'Fade' },
            { value: 'scale', label: 'Scale' },
          ]}
        />
        <Button size="sm" onClick={add}>
          <Plus size={14} aria-hidden="true" />
          Add task
        </Button>
      </div>
      <Surface variant="card" padding="sm" className="min-h-[220px]">
        <AnimatedList
          aria-label="Open tasks"
          items={tasks}
          getKey={(task) => task.id}
          animation={animation}
          renderItem={(task) => (
            <div className="flex items-center gap-3 rounded-[var(--radius-glyph)] px-2 py-2 hover:bg-surface-sunken">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{task.title}</span>
              <IconButton icon={Trash2} label={`Remove ${task.title}`} size="xs" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))} />
            </div>
          )}
        />
        {tasks.length === 0 && (
          <Text size="label" tone="faint" className="px-2 py-6 text-center">
            Nothing left to do.
          </Text>
        )}
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ MarkerHighlight */

function MarkerHighlightExample() {
  const [variant, setVariant] = useState<MarkerHighlightVariant>('highlight')
  const [run, setRun] = useState(0)
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Style"
          size="sm"
          value={variant}
          onValueChange={setVariant}
          options={[
            { value: 'underline', label: 'Underline' },
            { value: 'highlight', label: 'Highlight' },
            { value: 'circle', label: 'Circle' },
            { value: 'box', label: 'Box' },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => setRun((value) => value + 1)}>
          Replay
        </Button>
      </div>
      <p key={`${variant}-${run}`} className="max-w-[520px] text-[28px] font-extrabold leading-[1.3] tracking-[-0.03em] text-ink">
        Expenses that <MarkerHighlight variant={variant}>file themselves</MarkerHighlight>, and reports your finance team
        will actually read.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ module */

export const demos: ExampleModule = {
  stack: {
    description:
      'The flex row and the flex column with spacing on the scale. Direction can change per breakpoint, so the common “stacked on a phone, side by side on a desk” layout needs no media query, and optional dividers are real elements that sit centred in the gap and turn with the direction. It renders any element through `as`, and inside a list its dividers become hidden list items so the markup stays valid.',
    sections: [
      { title: 'Responsive direction with dividers', Content: StackExample },
      {
        title: 'Alignment',
        stack: true,
        specimens: [
          { label: 'justify="between" align="center"', fill: true, node: <Stack direction="row" justify="between" align="center" className="w-full"><Box>Start</Box><Box>Middle</Box><Box>End</Box></Stack> },
          { label: 'wrap gap={2}', fill: true, node: <Stack as="ul" direction="row" wrap gap={2} aria-label="Tags">{['Travel', 'Software', 'Meals', 'Hardware', 'Training', 'Contractors'].map((tag) => <li key={tag}><Badge tone="neutral">{tag}</Badge></li>)}</Stack> },
        ],
      },
      rationale(
        'Hand-written flex layouts drift: gap-3 in one place, space-y-2.5 in the next, a stray margin on a last child.',
        'One primitive keeps gaps on the spacing scale and makes the responsive direction change a prop instead of a class list.',
        'Everywhere a group of things sits in a line — card bodies, toolbars, stat rows, form sections.',
        ['Tailwind flex utilities'],
      ),
    ],
    props: [
      { name: 'direction', type: "StackDirection | { base?, sm?, md?, lg? }", defaultValue: "'column'", description: 'Main axis, optionally per breakpoint.' },
      { name: 'gap', type: '0 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12', defaultValue: '3', description: 'Space between children on the spacing scale.' },
      { name: 'align', type: "'start' | 'center' | 'end' | 'stretch' | 'baseline'", description: 'Cross-axis alignment.' },
      { name: 'justify', type: "'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'", description: 'Main-axis distribution.' },
      { name: 'wrap', type: 'boolean', defaultValue: 'false', description: 'Let children wrap onto more lines.' },
      { name: 'dividers', type: 'boolean', defaultValue: 'false', description: 'Hairlines between children that turn with the direction.' },
      { name: 'as', type: 'ElementType', defaultValue: "'div'", description: 'Element to render.' },
    ],
  },

  container: {
    description:
      'The centred column a page sits in: a maximum width, auto margins and the site shell’s own gutter, 20px growing to 32px from lg. The presets are widths the site already uses — xl matches the header and footer, prose keeps a readable measure — so a page built with it lines up with the chrome around it. ContainerBleed lets one child run out to the gutter’s edge.',
    sections: [
      { title: 'Sizes and bleed', Content: ContainerExample },
      rationale(
        'Pages that each write their own max-width and padding end up with edges that do not line up with the header or with each other.',
        'The width presets and the gutter come from the site shell, so matching it is the default rather than a thing to remember.',
        'The outermost wrapper of a page or a page section, and around long-form text with the prose size.',
        ['Tailwind layout utilities'],
      ),
    ],
    props: [
      { name: 'size', type: "'sm' | 'md' | 'lg' | 'xl' | 'prose' | 'full'", defaultValue: "'xl'", description: 'Maximum width. xl is 1400px, matching the site shell.' },
      { name: 'gutters', type: 'boolean', defaultValue: 'true', description: 'Side padding: px-5, then lg:px-8.' },
      { name: 'as', type: 'ElementType', defaultValue: "'div'", description: 'Element to render — main, section, header.' },
    ],
  },

  'infinite-scroll': {
    description:
      'Loads the next page when the end of the list comes into view — with a real Load more button always present, because a sentinel is invisible to a keyboard user and silent to a screen reader. New items are announced with their count, a failure shows its reason and a retry that will not auto-fire again, and the end of the list is stated. The button is marked busy rather than disabled while loading, so focus stays on it.',
    sections: [
      { title: 'Team list', Content: InfiniteScrollExample },
      rationale(
        'Scroll-triggered loading strands keyboard users, says nothing to screen readers and hides failures as an endless spinner.',
        'The button is the real control and the observer is a shortcut to it, so every reader has a way to load more and hears what arrived.',
        'Activity feeds, search results and member lists where pagination numbers would add nothing.',
        ['Button', 'Spinner', 'Text', 'IntersectionObserver'],
      ),
    ],
    props: [
      { name: 'onLoadMore', type: '() => Promise<number | void>', description: 'Fetch the next page; resolve with how many arrived, reject to show the error.' },
      { name: 'hasMore', type: 'boolean', description: 'Whether anything is left. False shows the end message.' },
      { name: 'mode', type: "'auto' | 'button'", defaultValue: "'auto'", description: 'Load on scroll with a button fallback, or only on request.' },
      { name: 'rootMargin', type: 'string', defaultValue: "'200px'", description: 'How early to start loading.' },
      { name: 'itemNoun', type: 'string', defaultValue: "'item'", description: 'Used in announcements — “4 more members loaded”.' },
      { name: 'loadMoreLabel', type: 'string', defaultValue: "'Load more'", description: 'Label on the button.' },
      { name: 'endMessage', type: 'ReactNode', defaultValue: "'You’ve reached the end'", description: 'Shown when there is nothing left. null hides it.' },
    ],
  },

  'language-switcher': {
    description:
      'A locale picker that works for someone who cannot read the current language. Each language is written in its own words first with English second, the native name carries its own lang attribute so a screen reader pronounces it properly, and the trigger shows a globe. Past a handful of languages a filter field appears. It is a listbox with Select’s keyboard model; the compact variant is the globe alone for a crowded header.',
    sections: [
      { title: 'Full and compact', Content: LanguageSwitcherExample },
      rationale(
        'A switcher that lists “German” to a German speaker, or shows only the current language’s word for “Language”, is unusable by the people it is for.',
        'Native names, a lang attribute per option and a globe glyph make the control recognisable whatever the page is currently in.',
        'Site headers and footers, account settings, and the first screen of an onboarding flow.',
        ['Popover', 'internal icons'],
      ),
    ],
    props: [
      { name: 'options', type: 'LanguageSwitcherOption[]', description: '{ value, nativeName, englishName } per language.' },
      { name: 'value / defaultValue', type: 'string', description: 'Current locale, controlled or uncontrolled.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Called with the chosen locale.' },
      { name: 'variant', type: "'full' | 'compact'", defaultValue: "'full'", description: 'Show the current language, or the globe alone.' },
      { name: 'label', type: 'string', defaultValue: "'Language'", description: 'Accessible name for the trigger and list.' },
      { name: 'searchThreshold', type: 'number', defaultValue: '8', description: 'Show a filter from this many languages.' },
    ],
  },

  'version-switcher': {
    description:
      'Picks which version of the docs to read, with the status of every version beside it — Latest in the accent, Pre-release and Deprecated as neutral tags — in the list and in the trigger. VersionSwitcherNotice goes at the top of the page and says in one sentence that this is not the current version, with a link to the one that is; on the latest version it renders nothing.',
    sections: [
      { title: 'Reading an old version', Content: VersionSwitcherExample },
      rationale(
        'Search engines send readers to old docs, and a bare version number does not tell them they are reading instructions that no longer apply.',
        'The status travels with the number, and the notice turns it into a sentence with a way out.',
        'The header of a documentation site, with the notice in the docs layout above the article.',
        ['Popover', 'Badge', 'internal icons'],
      ),
    ],
    props: [
      { name: 'versions', type: 'VersionSwitcherVersion[]', description: '{ value, label, status?, hint? }, newest first.' },
      { name: 'value / defaultValue', type: 'string', description: 'The version being read. Defaults to the one marked latest.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Navigate to the chosen version here.' },
      { name: 'label', type: 'string', defaultValue: "'Documentation version'", description: 'Accessible name.' },
      { name: 'VersionSwitcherNotice latestHref', type: 'string', description: 'Link target for the latest docs.' },
    ],
  },

  'article-pager': {
    description:
      'Previous and next links at the foot of a doc page. Each says which way and where to — a small direction label and the destination’s title — inside its own named nav landmark. A single link keeps its side, so next on the first page stays on the right, and on a phone the pair stacks with previous first.',
    sections: [
      {
        title: 'Both, or one side',
        stack: true,
        specimens: [
          { label: 'previous and next', fill: true, node: <ArticlePager className="w-full" label="Guides pager" previous={{ title: 'Installation', href: '#installation' }} next={{ title: 'Theming and tokens', href: '#theming' }} /> },
          { label: 'first page — next only', fill: true, node: <ArticlePager className="w-full" label="Getting started pager" next={{ title: 'Your first component', href: '#first', label: 'Up next' }} /> },
          { label: 'last page — previous only', fill: true, node: <ArticlePager className="w-full" label="Reference pager" previous={{ title: 'Accessibility checklist', href: '#a11y' }} /> },
        ],
      },
      rationale(
        'Arrow-only pagers tell the reader the direction but not the destination, and unnamed navs are indistinguishable in a landmarks list.',
        'Titles in the links and a named landmark answer both, and the fixed sides keep forward where the eye expects it.',
        'The end of every article in a docs site, guide or course.',
        ['internal icons'],
      ),
    ],
    props: [
      { name: 'previous', type: '{ title, href, label? }', description: 'The article before. Omit on the first page.' },
      { name: 'next', type: '{ title, href, label? }', description: 'The article after. Omit on the last page.' },
      { name: 'label', type: 'string', defaultValue: "'Previous and next article'", description: 'Name of the nav landmark.' },
      { name: 'linkAs', type: 'ElementType', defaultValue: "'a'", description: 'A router link that accepts href.' },
    ],
  },

  'download-button': {
    description:
      'A download that shows it is happening: the size in the idle label, a ring filling with the percentage, a tick when done, and a retry when it fails. A cancel button sits beside it while it runs and aborts the signal handed to onDownload. The main button is never removed or disabled, so focus stays put, and starts, finishes, failures and cancels are announced — the percentage is not.',
    sections: [
      { title: 'Report download', Content: DownloadButtonExample },
      rationale(
        'A large file behind a plain link gives no feedback until the browser’s tray appears, so people click again and start a second download.',
        'One control that carries the whole lifecycle, with cancel and retry, answers “did it start?” and “did it work?” in place.',
        'Exports, reports, invoices and any generated file that takes more than a moment.',
        ['Button', 'IconButton', 'Spinner', 'internal icons'],
      ),
    ],
    props: [
      { name: 'onDownload', type: '({ signal, onProgress }) => Promise<void>', description: 'Does the download; report progress 0–1 and honour the signal.' },
      { name: 'label', type: 'string', defaultValue: "'Download'", description: 'Verb and object.' },
      { name: 'size', type: 'number', description: 'File size in bytes, shown in the label.' },
      { name: 'format', type: 'string', description: 'File type shown beside the size.' },
      { name: 'resetAfter', type: 'number', defaultValue: '4000', description: 'How long the done state stays, in ms. 0 keeps it.' },
      { name: 'variant', type: 'ButtonVariant', defaultValue: "'accent'", description: 'Button treatment.' },
      { name: 'buttonSize', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Button size.' },
    ],
  },

  'like-button': {
    description:
      'A toggle heart that responds at once: it fills and counts immediately, then calls onLikedChange, and if that promise rejects it rolls back to what the server still believes and tells onError. The state is aria-pressed with a name that never changes; the visible count is compact (1.2k) and the one read out is exact. Liking plays a small burst, skipped under reduced motion.',
    sections: [
      { title: 'Optimistic, with rollback', Content: LikeButtonExample, note: motionNote('the heart fills and the count changes with no pop or burst.') },
      {
        title: 'States',
        specimens: [
          { label: 'defaultCount={8}', node: <LikeButton defaultCount={8} label="Like comment" /> },
          { label: 'liked, 48.6k', node: <LikeButton defaultLiked defaultCount={48_620} label="Like post" /> },
          { label: 'size="sm" hideCount', node: <LikeButton size="sm" hideCount label="Favourite" /> },
        ],
      },
      rationale(
        'Waiting for the server before filling the heart makes the tap feel broken; not waiting leaves a like on screen that never saved.',
        'Optimistic update with rollback gives the instant response and keeps the screen honest when the request fails.',
        'Posts, comments, changelog entries and anywhere a reader can show appreciation with one tap.',
        ['usePrefersReducedMotion', 'Web Animations API'],
      ),
    ],
    props: [
      { name: 'liked / defaultLiked', type: 'boolean', description: 'Whether the reader has liked it, controlled or uncontrolled.' },
      { name: 'count / defaultCount', type: 'number', description: 'The count, including the reader’s own like.' },
      { name: 'onLikedChange', type: '(liked: boolean) => void | Promise<void>', description: 'Save the change; rejecting rolls it back.' },
      { name: 'onError', type: '(reason: unknown) => void', description: 'Told when a like is rolled back.' },
      { name: 'label', type: 'string', defaultValue: "'Like'", description: 'Accessible name, the same pressed or not.' },
      { name: 'countNoun', type: 'string', defaultValue: "'likes'", description: 'Used in the exact count read out.' },
      { name: 'hideCount', type: 'boolean', defaultValue: 'false', description: 'Heart alone.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Control height.' },
    ],
  },

  'animated-list': {
    description:
      'A list that animates what changed. Removed rows stay mounted while they fade and fold their height to zero, so the rows below close the gap instead of jumping; new rows open into place. Rows are matched by getKey, never by index, a leaving row is hidden from assistive technology at once, and focus inside it moves to the row that takes its place. Under reduced motion rows appear and disappear instantly.',
    sections: [
      { title: 'Task list', Content: AnimatedListExample, note: motionNote('rows are added and removed at once, with no transition.') },
      rationale(
        'Mapping an array to rows removes a row the instant it leaves, so no exit animation can run and everything below jumps.',
        'Keeping the leaving row mounted until its transition ends, and matching rows by key, is the part every list otherwise reimplements badly.',
        'Notification lists, task lists, uploaded files, chips added and removed by filters.',
        ['usePrefersReducedMotion', 'CSS grid-rows transition'],
      ),
    ],
    props: [
      { name: 'items', type: 'T[]', description: 'The current items.' },
      { name: 'getKey', type: '(item: T) => string', description: 'Stable identity per item.' },
      { name: 'renderItem', type: '(item: T) => ReactNode', description: 'Content for one row.' },
      { name: 'animation', type: "'fade' | 'slide-up' | 'slide-right' | 'scale'", defaultValue: "'slide-up'", description: 'How rows arrive and leave.' },
      { name: 'duration', type: 'number', defaultValue: '220', description: 'Transition length in ms.' },
      { name: 'animateInitial', type: 'boolean', defaultValue: 'false', description: 'Animate the first render too.' },
      { name: 'as', type: "'ul' | 'ol' | 'div'", defaultValue: "'ul'", description: 'List element.' },
    ],
  },

  'marker-highlight': {
    description:
      'Words marked the way a person would on paper — an underline, a highlighter swipe, a loose circle or a box — drawn in when the phrase scrolls into view. The mark is an SVG behind the text, so the words stay selectable, copy cleanly and read the same to a screen reader. The colour is the accent mixed toward transparent, lighter for the highlighter because the words sit on it, and under reduced motion the mark is simply there.',
    sections: [
      { title: 'Four styles', Content: MarkerHighlightExample, note: motionNote('the mark is drawn in full from the start.') },
      {
        title: 'Static',
        specimens: [
          { label: 'underline', node: <Text size="subtitle">Close the books <MarkerHighlight variant="underline" animate={false}>in a day</MarkerHighlight></Text> },
          { label: 'box tint={60}', node: <Text size="subtitle">Only <MarkerHighlight variant="box" tint={60} animate={false}>$12</MarkerHighlight> a seat</Text> },
        ],
      },
      rationale(
        'A colour change or flat background marks emphasis but does not draw the eye, and text effects that replace the words break selection and screen readers.',
        'A hand-drawn stroke behind untouched text gets the attention without costing readability or semantics.',
        'One phrase in a hero headline, a price, or the key claim in a section heading — sparingly.',
        ['useInView', 'usePrefersReducedMotion', 'inline SVG'],
      ),
    ],
    props: [
      { name: 'variant', type: "'underline' | 'highlight' | 'circle' | 'box'", defaultValue: "'underline'", description: 'Style of mark.' },
      { name: 'tint', type: 'number', description: 'Accent strength 0–100. Defaults to 35 for highlight, 100 otherwise.' },
      { name: 'animate', type: 'boolean', defaultValue: 'true', description: 'Draw in when scrolled into view.' },
      { name: 'duration', type: 'number', defaultValue: '700', description: 'Draw time in ms.' },
      { name: 'delay', type: 'number', defaultValue: '0', description: 'Wait before drawing, in ms.' },
    ],
  },
}
