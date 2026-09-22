import { useState } from 'react'
import { Calendar, FileText, Mail, Users, Pencil } from 'lucide-react'
import {
  BrandingSettings,
  Button,
  EmailVerification,
  FaqSection,
  IpAllowlist,
  NewsletterSignup,
  OAuthConsent,
  RoadmapBoard,
  SpinWheel,
  Text,
  TicTacToe,
  UsagePricingCalculator,
  type BrandingSettingsValue,
  type FaqSectionItem,
  type IpAllowlistEntry,
  type RoadmapBoardItem,
  type SpinWheelSegment,
  type UsagePricingCalculatorDimension,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------ spin wheel */

const PRIZES: SpinWheelSegment[] = [
  { id: 'ten', label: '10% off', weight: 3 },
  { id: 'ship', label: 'Free shipping', weight: 3 },
  { id: 'twenty', label: '20% off', weight: 2 },
  { id: 'mug', label: 'Team mug', weight: 1.5 },
  { id: 'again', label: 'Try again', weight: 2 },
  { id: 'year', label: 'A free year', weight: 0.5 },
]

function WheelExample() {
  const [history, setHistory] = useState<string[]>([])
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <SpinWheel segments={PRIZES} onSpinEnd={(segment) => setHistory((current) => [segment.label, ...current].slice(0, 5))} />
      {history.length > 0 && (
        <Text size="caption" tone="faint">{`Last spins: ${history.join(', ')}`}</Text>
      )}
    </div>
  )
}

const LUNCH: SpinWheelSegment[] = ['Ramen', 'Tacos', 'Salad bar', 'Pizza'].map((label) => ({ label }))

function DecisionExample() {
  return <SpinWheel segments={LUNCH} size={220} spinLabel="Pick lunch" duration={2600} turns={3} />
}

function RiggedExample() {
  return (
    <div className="flex flex-col items-center gap-2">
      <SpinWheel segments={PRIZES} winner="ship" size={220} spinLabel="Claim your prize" />
      <Text size="caption" tone="faint">
        winner=&quot;ship&quot; — decided on the server
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------ tic-tac-toe */

function TicTacToeExample() {
  return <TicTacToe />
}

function CasualExample() {
  const [results, setResults] = useState<string[]>([])
  return (
    <div className="flex flex-col gap-3">
      <TicTacToe opponent="computer" difficulty="casual" onGameEnd={(winner) => setResults((current) => [winner, ...current].slice(0, 6))} />
      <Text size="caption" tone="faint">{results.length ? `onGameEnd: ${results.join(', ')}` : 'onGameEnd has not fired yet.'}</Text>
    </div>
  )
}

/* ------------------------------------------------------------ faq */

const FAQS: FaqSectionItem[] = [
  {
    id: 'faq-trial',
    category: 'Billing',
    question: 'Do I need a credit card to start the trial?',
    answer: 'No. The 14-day trial starts without payment details, and nothing is charged unless you choose a plan before it ends.',
  },
  {
    id: 'faq-refunds',
    category: 'Billing',
    question: 'Can I get a refund on an annual plan?',
    answer: 'Yes, within 30 days of any annual charge. After that, cancelling stops renewal and you keep access until the period ends.',
  },
  {
    id: 'faq-seats',
    category: 'Billing',
    question: 'How are seats counted?',
    answer: 'A seat is anyone who can sign in. Guests with view-only links are free, and removed members stop counting on the next invoice.',
  },
  {
    id: 'faq-sso',
    category: 'Security',
    question: 'Do you support SAML single sign-on?',
    answer: 'SAML SSO with Okta, Microsoft Entra ID and Google Workspace is included on Business and Enterprise, along with SCIM provisioning.',
  },
  {
    id: 'faq-data',
    category: 'Security',
    question: 'Where is my data stored?',
    answerText: 'In the EU (Frankfurt) or the US (Oregon), chosen when the workspace is created. Backups stay in the same region.',
    answer: (
      <Text size="body" tone="soft" leading="normal">
        In the EU (Frankfurt) or the US (Oregon), chosen when the workspace is created. Backups stay in the same region —{' '}
        <a href="#data-residency" className="font-bold text-ink underline underline-offset-2">
          read the data residency page
        </a>
        .
      </Text>
    ),
  },
  {
    id: 'faq-export',
    category: 'Product',
    question: 'Can I export everything if I leave?',
    answer: 'Every project, comment and file exports as JSON and CSV from Settings → Data, at any time and on every plan.',
  },
  {
    id: 'faq-api',
    category: 'Product',
    question: 'Is there an API?',
    answer: 'A REST API and webhooks are available on all paid plans, with a rate limit of 600 requests per minute per workspace.',
  },
]

function FaqExample() {
  return (
    <FaqSection
      items={FAQS}
      description="Everything about plans, security and your data. Link straight to an answer with its #id."
      contact={
        <>
          <Button variant="outline" size="sm">
            <Mail size={14} aria-hidden="true" />
            Email support
          </Button>
          <Button size="sm">Book a call</Button>
        </>
      }
      contactDescription="A person replies within one working day."
      structuredData
    />
  )
}

// Ids are page-wide anchors, so the second section gets its own.
const LINKED = FAQS.slice(0, 6).map((item) => ({ ...item, id: item.id.replace('faq-', 'linked-') }))

function DeepLinkExample() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {['linked-refunds', 'linked-sso', 'linked-export'].map((id) => (
          <Button key={id} as="a" href={`#${id}`} variant="muted" size="sm">
            {`#${id}`}
          </Button>
        ))}
      </div>
      <FaqSection items={LINKED} title="Linked questions" headingLevel="h3" searchable={false} />
    </div>
  )
}

/* ------------------------------------------------------------ newsletter */

const subscribe = async ({ email }: { email: string }) => {
  await wait(900)
  if (email.startsWith('fail')) throw new Error('Our mail provider did not respond. Try again in a minute.')
  return email.startsWith('ada') ? ('already-subscribed' as const) : ('subscribed' as const)
}

function NewsletterCardExample() {
  return (
    <NewsletterSignup
      onSubscribe={subscribe}
      title="The Friday changelog"
      description="What shipped this week and what is coming next. One email, every Friday."
      consentLabel="I agree to receive product emails and accept the privacy policy."
      footnote="Unsubscribe with one click from any email."
    />
  )
}

function NewsletterInlineExample() {
  return (
    <div className="flex w-full flex-col gap-2">
      <Text size="body" weight="bold">
        Get release notes by email
      </Text>
      <NewsletterSignup variant="inline" title="Release notes" onSubscribe={subscribe} submitLabel="Notify me" />
    </div>
  )
}

/* ------------------------------------------------------------ pricing */

const DIMENSIONS: UsagePricingCalculatorDimension[] = [
  {
    id: 'seats',
    label: 'Seats',
    unit: 'seats',
    description: 'Everyone who can sign in',
    min: 1,
    max: 500,
    defaultValue: 12,
    included: 3,
    tiers: [{ upTo: 20, unitPrice: 12 }, { upTo: 100, unitPrice: 10 }, { unitPrice: 8 }],
    salesThreshold: 250,
  },
  {
    id: 'calls',
    label: 'API calls',
    unit: 'calls',
    description: 'Per month, priced per 1,000',
    min: 0,
    max: 5_000_000,
    step: 10_000,
    defaultValue: 250_000,
    included: 100_000,
    unitSize: 1000,
    tiers: [{ upTo: 1_000_000, unitPrice: 0.5 }, { unitPrice: 0.3 }],
  },
  {
    id: 'storage',
    label: 'Storage',
    unit: 'GB',
    description: 'Volume pricing — every GB at one rate',
    min: 0,
    max: 2000,
    step: 10,
    defaultValue: 50,
    included: 10,
    model: 'volume',
    tiers: [{ upTo: 100, unitPrice: 0.25 }, { upTo: 1000, unitPrice: 0.2 }, { unitPrice: 0.15 }],
  },
]

function PricingExample() {
  return (
    <UsagePricingCalculator
      dimensions={DIMENSIONS}
      basePrice={29}
      salesAction={
        <Button size="sm" className="self-start">
          Talk to sales
        </Button>
      }
    />
  )
}

function PricingControlledExample() {
  const [usage, setUsage] = useState({ seats: 300, calls: 1_200_000, storage: 400 })
  return (
    <div className="flex w-full flex-col gap-2">
      <UsagePricingCalculator
        dimensions={DIMENSIONS}
        value={usage}
        onValueChange={(next) => setUsage(next as typeof usage)}
        basePrice={29}
        defaultPeriod="yearly"
        salesAction={
          <Button size="sm" variant="outline" className="self-start">
            Get a quote
          </Button>
        }
      />
      <Text size="caption" tone="faint">{`value: ${JSON.stringify(usage)}`}</Text>
    </div>
  )
}

/* ------------------------------------------------------------ email verification */

function VerificationExample() {
  const [email, setEmail] = useState('harshil.mehta@northwind.dev')
  const [sends, setSends] = useState(1)
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <EmailVerification
        email={email}
        cooldown={20}
        expiresIn="24 hours"
        onResend={async () => {
          await wait(600)
          setSends((count) => count + 1)
        }}
        onChangeEmail={() => setEmail(email.startsWith('harshil') ? 'h.mehta@northwind.dev' : 'harshil.mehta@northwind.dev')}
        onVerifyCode={async (code) => {
          await wait(700)
          return code === '246810'
        }}
        verifiedAction={<Button fullWidth>Continue to workspace</Button>}
      />
      <Text size="caption" tone="faint">{`Emails sent: ${sends}. The code is 246810.`}</Text>
    </div>
  )
}

function VerifiedExample() {
  const [verified, setVerified] = useState(false)
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button variant="muted" size="sm" onClick={() => setVerified((value) => !value)}>
        {verified ? 'Reset' : 'Simulate the link clicked in another tab'}
      </Button>
      <EmailVerification
        email="ops@northwind.dev"
        verified={verified}
        sentOnMount={false}
        mailLinks={[]}
        onResend={() => wait(400)}
        verifiedAction={<Button fullWidth>Continue</Button>}
      />
    </div>
  )
}

/* ------------------------------------------------------------ oauth consent */

const SCOPES = [
  { id: 'profile', label: 'See your name and email address', icon: Users },
  { id: 'calendar', label: 'See and edit your calendar events', description: 'Create meetings, move them and delete them.', icon: Calendar, sensitive: true },
  { id: 'docs', label: 'Read your documents', description: 'Only documents in folders you share with the app.', icon: FileText },
  { id: 'write', label: 'Post comments as you', description: 'Comments will show your name.', icon: Pencil, sensitive: true },
]

function ConsentExample() {
  const [outcome, setOutcome] = useState<string | null>(null)
  const [account, setAccount] = useState(0)
  const accounts = [
    { name: 'Priya Raman', email: 'priya@northwind.dev' },
    { name: 'Priya Raman', email: 'priya.raman@gmail.com' },
  ]
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <OAuthConsent
        app={{ name: 'Cadence', publisher: 'Cadence Labs Ltd', verified: true }}
        productName="Northwind"
        account={accounts[account]}
        onSwitchAccount={() => setAccount((index) => (index + 1) % accounts.length)}
        scopes={SCOPES}
        redirectUri="https://app.cadence.so/oauth/callback?state=x81f"
        privacyUrl="#privacy"
        termsUrl="#terms"
        onAllow={async () => {
          await wait(900)
          setOutcome('Allowed — redirecting to app.cadence.so')
        }}
        onCancel={() => setOutcome('Cancelled — nothing was shared')}
      />
      <Text size="caption" tone="faint" role="status">
        {outcome ?? ''}
      </Text>
    </div>
  )
}

function UnverifiedExample() {
  return (
    <OAuthConsent
      app={{
        name: 'SheetSync',
        publisher: 'sheetsync-dev',
        verified: false,
        logo: <span className="flex size-full items-center justify-center bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] text-accent-ink">S</span>,
      }}
      account={{ name: 'Marcus Chen', email: 'marcus@northwind.dev' }}
      scopes={[{ id: 'mail', label: 'Read, send and delete your email', icon: Mail, sensitive: true }]}
      redirectUri="https://sheetsync-auth.herokuapp.com/cb"
      onAllow={() => wait(600)}
      onCancel={() => undefined}
    />
  )
}

/* ------------------------------------------------------------ ip allowlist */

const IP_ENTRIES: IpAllowlistEntry[] = [
  { id: 'office', value: '203.0.113.0/24', label: 'London office' },
  { id: 'vpn', value: '198.51.100.14', label: 'Corporate VPN egress' },
  { id: 'v6', value: '2001:db8:4f::/48', label: 'Data centre (IPv6)' },
]

function AllowlistExample() {
  const [entries, setEntries] = useState(IP_ENTRIES)
  const [enabled, setEnabled] = useState(true)
  return (
    <div className="flex w-full flex-col gap-2">
      <IpAllowlist entries={entries} onEntriesChange={setEntries} enabled={enabled} onEnabledChange={setEnabled} currentIp="203.0.113.42" />
      <Text size="caption" tone="faint">
        {`You are on 203.0.113.42, inside the London office range. Remove it to see the lock-out check. Enforcement: ${enabled ? 'on' : 'off'}.`}
      </Text>
    </div>
  )
}

function AllowlistOutsideExample() {
  return <IpAllowlist defaultEntries={IP_ENTRIES.slice(1)} defaultEnabled={false} currentIp="192.0.2.77" />
}

/* ------------------------------------------------------------ branding */

const LOGO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1b1f3b"/><path d="M18 44V20h8l12 15V20h8v24h-8L26 29v15z" fill="#fff"/></svg>',
  )

function BrandingExample() {
  const [saved, setSaved] = useState<BrandingSettingsValue>({ color: '#3b82f6', logoUrl: LOGO })
  return (
    <div className="flex w-full flex-col gap-2">
      <BrandingSettings
        value={saved}
        workspaceName="Northwind"
        onSave={async (next) => {
          await wait(800)
          setSaved(next)
        }}
      />
      <Text size="caption" tone="faint">{`Saved colour: ${saved.color}. The rest of this page keeps its own accent.`}</Text>
    </div>
  )
}

function BrandingStrictExample() {
  const [saved, setSaved] = useState<BrandingSettingsValue>({ color: '#fb923c' })
  return (
    <BrandingSettings
      value={saved}
      workspaceName="Harbour"
      minContrast={7}
      onSave={async (next) => {
        await wait(500)
        setSaved(next)
      }}
    />
  )
}

/* ------------------------------------------------------------ roadmap */

const ROADMAP: RoadmapBoardItem[] = [
  { id: 'r1', status: 'planned', title: 'Dark mode for the mobile app', description: 'Follow the system setting, with a manual override.', tags: ['Mobile'], votes: 214, comments: 38, voted: true },
  { id: 'r2', status: 'planned', title: 'Recurring tasks', description: 'Daily, weekly and custom schedules, with skip and snooze.', tags: ['Tasks'], votes: 176, comments: 22 },
  { id: 'r3', status: 'planned', title: 'Export to PDF', tags: ['Reports'], votes: 64, comments: 5 },
  { id: 'r4', status: 'in-progress', title: 'Offline editing', description: 'Edit without a connection; changes sync when you are back.', tags: ['Mobile', 'Sync'], votes: 302, comments: 61 },
  { id: 'r5', status: 'in-progress', title: 'Custom fields on tasks', tags: ['Tasks'], votes: 141, comments: 17 },
  { id: 'r6', status: 'shipped', title: 'Slack notifications', description: 'Per-project channels and a daily digest.', tags: ['Integrations'], votes: 188, comments: 29 },
  { id: 'r7', status: 'shipped', title: 'Two-factor authentication', tags: ['Security'], votes: 97, comments: 8 },
  { id: 'r8', status: 'shipped', title: 'Calendar sync', tags: ['Integrations', 'Sync'], votes: 133, comments: 14 },
]

function RoadmapExample() {
  const [suggested, setSuggested] = useState(false)
  return (
    <RoadmapBoard
      items={ROADMAP}
      onVote={() => wait(300)}
      suggest={
        <Button size="sm" onClick={() => setSuggested(true)}>
          {suggested ? 'Thanks — we read every one' : 'Suggest a feature'}
        </Button>
      }
    />
  )
}

/* ------------------------------------------------------------ module */

export const demos: ExampleModule = {
  'spin-wheel': {
    description:
      'A prize or decision wheel. The winner is picked before the wheel moves — weighted by each segment’s share, or handed in by the caller — and the wheel then decelerates onto it, so the slice sizes are the real odds. The result is written out and announced; under reduced motion the wheel turns straight to the answer.',
    sections: [
      { title: 'Weighted prizes', description: 'Slice size is the weight: “A free year” is a thin sliver because it is rare.', Content: WheelExample },
      {
        title: 'Decisions and fixed outcomes',
        bare: true,
        specimens: [
          { label: 'Equal segments', hint: 'shorter spin, fewer turns', node: <DecisionExample /> },
          { label: 'winner', hint: 'outcome from the server', node: <RiggedExample /> },
        ],
      },
      rationale(
        'Spin-to-win and random pickers usually read the result off wherever the animation stopped, which makes weighting dishonest and server-decided prizes impossible — and says nothing to a screen reader.',
        'Choosing first and animating to the choice keeps the odds visible and verifiable, and lets the reduced-motion path skip straight to the same result.',
        'Promotional sign-up rewards, team retros and stand-up pickers, giveaways at events.',
        ['Button', 'Text'],
      ),
    ],
    props: [
      { name: 'segments', type: 'SpinWheelSegment[]', description: 'label, optional id and weight (default 1). Clockwise from the pointer.' },
      { name: 'winner', type: 'string', description: 'Id or label to land on instead of a weighted random pick.' },
      { name: 'onSpinEnd', type: '(segment, index) => void', description: 'Called once the wheel has stopped.' },
      { name: 'onSpinStart', type: '() => void', description: 'Called as a spin starts.' },
      { name: 'duration', type: 'number', defaultValue: '4200', description: 'Spin length in milliseconds.' },
      { name: 'turns', type: 'number', defaultValue: '5', description: 'Whole turns before it settles.' },
      { name: 'size', type: 'number', defaultValue: '300', description: 'Diameter in pixels.' },
      { name: 'spinLabel', type: 'string', defaultValue: "'Spin'", description: 'Label on the button.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks spinning.' },
    ],
  },

  'tic-tac-toe': {
    description:
      'Noughts and crosses against a friend or the computer. The board is a grid of buttons with one tab stop and arrow-key movement, each named by position and mark — “top left, X” — and every move, win and draw is announced. The computer plays minimax: unbeatable on perfect, fallible on casual.',
    sections: [
      { title: 'Play', description: 'Use the arrow keys to move and Enter to play. Switch to two players to pass the keyboard.', Content: TicTacToeExample },
      { title: 'Casual computer', description: 'The computer blunders about a third of the time, so a win is possible.', Content: CasualExample },
      rationale(
        'Small browser games are almost always a grid of clickable divs, which cannot be reached by keyboard and give a screen reader nothing to say about the board.',
        'Real buttons in a grid with roving focus, position-and-mark names and a live region make the whole game playable by ear, at no cost to anyone playing by mouse.',
        'Onboarding delights, empty states and 404 pages, waiting screens during long jobs.',
        ['SegmentedControl', 'Button'],
      ),
    ],
    props: [
      { name: 'defaultOpponent', type: "'computer' | 'human'", defaultValue: "'computer'", description: 'Starting mode; the reader can switch it.' },
      { name: 'opponent', type: "'computer' | 'human'", description: 'Fix the mode and hide the switch.' },
      { name: 'difficulty', type: "'perfect' | 'casual'", defaultValue: "'perfect'", description: 'Perfect never loses; casual slips sometimes.' },
      { name: 'firstMove', type: "'X' | 'O'", defaultValue: "'X'", description: 'Which mark opens each game. Against the computer you are X.' },
      { name: 'onGameEnd', type: "(winner: 'X' | 'O' | 'draw') => void", description: 'Called when a game ends.' },
    ],
  },

  'faq-section': {
    description:
      'A marketing FAQ with category filters, search across questions and answers, and deep links: each question’s id is an anchor, and arriving on it opens the question, clears any filter hiding it and focuses it. Questions are an Accordion; a contact area answers “still stuck?”, and FAQPage structured data is one prop away.',
    sections: [
      { title: 'Filter, search and contact', description: 'Try searching for “region” — answers are searched as well as questions.', Content: FaqExample },
      { title: 'Deep links', description: 'Each link changes the hash; the matching question opens and takes focus.', Content: DeepLinkExample },
      rationale(
        'FAQ pages grow into a long wall of questions that support staff cannot link into and customers cannot search, so the same tickets keep arriving.',
        'Addressable questions let support answer with a link, search over answers matches the words people actually use, and structured data surfaces answers in search results.',
        'Pricing and product marketing pages, help centre landing pages, checkout reassurance.',
        ['Accordion', 'SearchField', 'SegmentedControl', 'Text'],
      ),
    ],
    props: [
      { name: 'items', type: 'FaqSectionItem[]', description: 'id (the anchor), question, answer, optional answerText and category.' },
      { name: 'title', type: 'string', defaultValue: "'Frequently asked questions'", description: 'Section heading.' },
      { name: 'description', type: 'ReactNode', description: 'A line under the title.' },
      { name: 'headingLevel', type: "'h2' | 'h3'", defaultValue: "'h2'", description: 'Level of the section heading.' },
      { name: 'searchable', type: 'boolean', defaultValue: 'true', description: 'Show the search field.' },
      { name: 'contact', type: 'ReactNode', description: 'Actions for the “Still have questions?” area. Omit to hide it.' },
      { name: 'contactTitle', type: 'string', defaultValue: "'Still have questions?'", description: 'Heading of the contact area.' },
      { name: 'contactDescription', type: 'ReactNode', description: 'How and how fast you answer.' },
      { name: 'structuredData', type: 'boolean', defaultValue: 'false', description: 'Emit FAQPage JSON-LD from plain-text answers.' },
    ],
  },

  'newsletter-signup': {
    description:
      'Email capture in a card or a single inline row. Validation runs on submit, consent is a real required checkbox when asked for, and each outcome has its own words: check your inbox, already subscribed, or what went wrong. A honeypot field hidden from people and assistive technology quietly absorbs bots.',
    sections: [
      {
        title: 'Card with consent',
        description: 'Addresses starting with “ada” are already subscribed; ones starting with “fail” show the error state.',
        Content: NewsletterCardExample,
      },
      { title: 'Inline', description: 'For footers and the end of articles. The label is visually hidden but still names the field.', Content: NewsletterInlineExample },
      rationale(
        'Newsletter forms say “Thanks!” whatever happened, so people who were already subscribed, whose request failed, or who now need to confirm by email are all left guessing.',
        'Distinct outcome states and an explicit double opt-in message cut duplicate sign-ups and unconfirmed addresses; a honeypot stops bots without a CAPTCHA in anyone’s way.',
        'Blog footers, changelog pages, marketing sites and waitlists.',
        ['Input', 'Checkbox', 'Button', 'InlineMessage', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'onSubscribe', type: "(payload: { email, consent }) => Promise<'subscribed' | 'already-subscribed' | void>", description: 'Subscribe the address. Reject to show the message.' },
      { name: 'variant', type: "'card' | 'inline'", defaultValue: "'card'", description: 'Card with heading, or a single row.' },
      { name: 'title', type: 'string', defaultValue: "'Get the newsletter'", description: 'Card heading; the form’s name inline.' },
      { name: 'description', type: 'ReactNode', description: 'What arrives and how often.' },
      { name: 'consentLabel', type: 'ReactNode', description: 'Shows a required consent checkbox with this label.' },
      { name: 'submitLabel', type: 'string', defaultValue: "'Subscribe'", description: 'Button label.' },
      { name: 'placeholder', type: 'string', defaultValue: "'you@example.com'", description: 'Field placeholder.' },
      { name: 'footnote', type: 'ReactNode', description: 'A line under the field — the unsubscribe promise.' },
    ],
  },

  'usage-pricing-calculator': {
    description:
      'A price estimator for metered plans. Each dimension — seats, API calls, storage — has a slider and a number field, priced through graduated or volume tiers with included units, and the breakdown shows what each one contributes. Monthly and yearly billing switch in place, and past a sales threshold the total gives way to a prompt to talk to sales.',
    sections: [
      { title: 'Estimate', description: 'Seats and API calls use graduated tiers; storage uses volume pricing.', Content: PricingExample },
      { title: 'Controlled, beyond the sales threshold', description: '300 seats is past the 250-seat threshold, so the list price is replaced.', Content: PricingControlledExample },
      rationale(
        'Tiered usage pricing is published as tables nobody can multiply through in their head, so prospects either guess high and leave or guess low and churn at the first invoice.',
        'Working the arithmetic in front of them, with a per-dimension breakdown, makes the price traceable; switching to a sales prompt at scale avoids quoting numbers nobody pays.',
        'Pricing pages for API, infrastructure and seat-plus-usage products; plan upgrade dialogs.',
        ['Slider', 'NumberInput', 'BillingToggle', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'dimensions', type: 'UsagePricingCalculatorDimension[]', description: 'id, label, unit, min, max, step, included, unitSize, model, tiers, salesThreshold.' },
      { name: 'value', type: 'Record<string, number>', description: 'Controlled usage by dimension id.' },
      { name: 'defaultValue', type: 'Record<string, number>', description: 'Starting usage when uncontrolled.' },
      { name: 'onValueChange', type: '(value) => void', description: 'Called as any dimension changes.' },
      { name: 'basePrice', type: 'number', defaultValue: '0', description: 'Flat monthly platform fee.' },
      { name: 'annualDiscount', type: 'number', defaultValue: '0.2', description: 'Share taken off when billed yearly.' },
      { name: 'defaultPeriod', type: "'monthly' | 'yearly'", defaultValue: "'monthly'", description: 'Starting billing period.' },
      { name: 'currency', type: 'string', defaultValue: "'$'", description: 'Currency symbol.' },
      { name: 'salesAction', type: 'ReactNode', description: 'Shown in place of the total past a sales threshold.' },
    ],
  },

  'email-verification': {
    description:
      'The “check your inbox” step with every way forward on one card: the masked address it went to, links straight to webmail, a code to type instead of clicking, resend with a visible countdown, and a way to change the address. Verifying — by code here or by link in another tab — swaps to a confirmed state and moves focus to it.',
    sections: [
      { title: 'Link or code', description: 'Type 246810 to verify; any other code is rejected and kept for correction.', Content: VerificationExample },
      { title: 'Verified elsewhere', description: 'Controlled verified state, for when the link is opened in another tab.', Content: VerifiedExample },
      rationale(
        'Sign-ups stall at email verification: the message is slow or in spam, the address had a typo, or the inbox is on another device — and the screen offers nothing but waiting.',
        'Each common failure gets a visible way out, and the resend countdown explains the wait while preventing the rapid re-sends that invalidate earlier links.',
        'Sign-up flows, changing an account email, inviting users to confirm an address.',
        ['InputOTP', 'Button', 'InlineMessage', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'email', type: 'string', description: 'The address the email went to. Shown masked.' },
      { name: 'onResend', type: '() => void | Promise<void>', description: 'Send again. Reject to show the message.' },
      { name: 'cooldown', type: 'number', defaultValue: '30', description: 'Seconds between sends.' },
      { name: 'sentOnMount', type: 'boolean', defaultValue: 'true', description: 'Start with the cooldown running.' },
      { name: 'onChangeEmail', type: '() => void', description: 'Use a different address. Hidden without it.' },
      { name: 'onVerifyCode', type: '(code) => boolean | void | Promise<boolean | void>', description: 'Check a typed code; false or a rejection marks it wrong. Hidden without it.' },
      { name: 'codeLength', type: 'number', defaultValue: '6', description: 'Characters in the code.' },
      { name: 'expiresIn', type: 'string', description: 'How long the link lasts, in words.' },
      { name: 'mailLinks', type: '{ label, href }[]', defaultValue: 'Gmail, Outlook', description: 'Webmail shortcuts. [] hides them.' },
      { name: 'verified', type: 'boolean', description: 'Controlled verified state.' },
      { name: 'verifiedAction', type: 'ReactNode', description: 'Shown once verified — usually Continue.' },
    ],
  },

  'oauth-consent': {
    description:
      'The authorisation screen a third-party app sends people to. It puts the app and its publisher’s verification first, then the account being granted with a way to switch, then the permissions in plain words with sensitive ones flagged and listed first, and the host it will redirect to. Allow and Cancel are the same size.',
    sections: [
      { title: 'Verified app', description: 'Switch account toggles between two sign-ins.', Content: ConsentExample },
      { title: 'Unverified publisher', description: 'An unverified app is called out in the header, before any permission is read.', Content: UnverifiedExample },
      rationale(
        'Consent screens are approved on reflex, which is exactly what consent phishing relies on: a plausible name, a broad scope buried in a list, and a redirect nobody reads.',
        'Ordering by risk — publisher trust, account, sensitive scopes, redirect host — puts the details that should stop someone where they will be seen in the second the screen gets.',
        'OAuth and OpenID Connect providers, “Sign in with” flows, marketplace app installs.',
        ['Avatar', 'Tag', 'Button', 'InlineMessage', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'app', type: 'OAuthConsentApp', description: 'name, optional logo, publisher and verified.' },
      { name: 'account', type: 'OAuthConsentAccount', description: 'name, email and avatarSrc of the signed-in account.' },
      { name: 'scopes', type: 'OAuthConsentScope[]', description: 'id, label, description, icon, sensitive.' },
      { name: 'redirectUri', type: 'string', description: 'Where the person is sent afterwards. The host is shown.' },
      { name: 'productName', type: 'string', description: 'Your product, as in “your Acme account”.' },
      { name: 'onAllow', type: '() => void | Promise<void>', description: 'Grant access. Reject to show the message.' },
      { name: 'onCancel', type: '() => void', description: 'Decline.' },
      { name: 'onSwitchAccount', type: '() => void', description: 'Sign in as someone else. Hidden without it.' },
      { name: 'privacyUrl', type: 'string', description: 'The app’s privacy policy.' },
      { name: 'termsUrl', type: 'string', description: 'The app’s terms of service.' },
    ],
  },

  'ip-allowlist': {
    description:
      'Restrict sign-in to known networks. Add IPv4 or IPv6 addresses and CIDR ranges with labels — validated, and stored as the network they actually match — and turn enforcement on and off with a confirmation. The admin’s current IP is checked against every change, so the setting warns before it can lock them out.',
    sections: [
      { title: 'Enforced, with you inside a range', description: 'Removing the London office range asks first, because it covers your address.', Content: AllowlistExample },
      { title: 'Off, with you outside the list', description: 'Turning it on offers to add your address first. Try typing 10.0.0.9/8.', Content: AllowlistOutsideExample },
      rationale(
        'IP allowlists fail in one expensive way: an admin enables enforcement without their own address on the list and locks out themselves — and often everyone else.',
        'Checking every change against the current IP turns that failure into a warning with a one-click fix, and canonicalising ranges shows what will really be enforced.',
        'Security settings for workspaces, API key restrictions, admin consoles for regulated customers.',
        ['Switch', 'Input', 'Tag', 'IconButton', 'ConfirmDialog', 'InlineMessage', 'Surface'],
      ),
    ],
    props: [
      { name: 'entries', type: 'IpAllowlistEntry[]', description: 'Controlled list of { id, value, label }.' },
      { name: 'defaultEntries', type: 'IpAllowlistEntry[]', defaultValue: '[]', description: 'Starting list when uncontrolled.' },
      { name: 'onEntriesChange', type: '(entries) => void', description: 'Called after an add or remove.' },
      { name: 'enabled', type: 'boolean', description: 'Controlled enforcement.' },
      { name: 'defaultEnabled', type: 'boolean', defaultValue: 'false', description: 'Starting enforcement when uncontrolled.' },
      { name: 'onEnabledChange', type: '(enabled) => void', description: 'Called after a confirmed switch.' },
      { name: 'currentIp', type: 'string', description: 'The admin’s own address, for the lock-out checks.' },
    ],
  },

  'branding-settings': {
    description:
      'A workspace’s logo and brand colour, with a live preview drawn through the library’s own accent derivation — applyAccent, scoped to the preview so the page around it never changes. The label contrast of the derived family is shown and checked against a configurable minimum; edits are a draft with Save, Discard and Reset to default.',
    sections: [
      { title: 'Logo and colour', description: 'Pick a colour: the preview’s hover step, tinted wash and label colour are the derived ones.', Content: BrandingExample },
      { title: 'Stricter contrast', description: 'minContrast={7}. Orange clears AA but not AAA, so the warning shows.', Content: BrandingStrictExample },
      rationale(
        'Branding pages show a colour swatch and leave admins to discover later that white labels on their yellow are unreadable, or that the hover state is invisible.',
        'Previewing with the exact derivation the product uses shows the real result before saving, and scoping it keeps the settings page stable while colours are tried.',
        'Workspace and white-label settings, customer portals, embeddable widgets themed per tenant.',
        ['ColorPicker', 'Button', 'InlineMessage', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'value', type: 'BrandingSettingsValue', description: 'The saved { color, logoUrl }. Edits are a draft against it.' },
      { name: 'onSave', type: '(value) => void | Promise<void>', description: 'Persist the draft. Reject to show the message.' },
      { name: 'onLogoUpload', type: '(file) => string | Promise<string>', description: 'Upload a logo and return its URL. Defaults to an object URL.' },
      { name: 'defaultColor', type: 'string', defaultValue: 'ACCENT_PRESETS[0].hex', description: 'Where Reset returns the colour to.' },
      { name: 'swatches', type: '{ value, label }[]', defaultValue: 'ACCENT_PRESETS', description: 'Named colours in the picker.' },
      { name: 'workspaceName', type: 'string', defaultValue: "'Workspace'", description: 'Shown in the preview.' },
      { name: 'minContrast', type: 'number', defaultValue: '4.5', description: 'Label contrast below this raises a warning.' },
      { name: 'maxLogoSize', type: 'number', defaultValue: '2 MB', description: 'Largest logo accepted, in bytes.' },
    ],
  },

  'roadmap-board': {
    description:
      'A public roadmap in Planned, In progress and Shipped columns. Cards carry a title, tags, a vote toggle that updates at once and rolls back if saving fails, and a comment count. Filter by tag, sort by votes, and on small screens the columns become tabs, one stage at a time.',
    sections: [
      { title: 'Board', description: 'Narrow the window to see the columns become tabs.', Content: RoadmapExample },
      rationale(
        'Public roadmaps are often a static image or a kanban built from divs: nobody can vote without a login wall, and on a phone three columns squeeze into slivers.',
        'Real lists per stage, pressed-state vote buttons named for their item, optimistic counts and a tabbed small-screen layout make it usable for everyone who arrives from a changelog link.',
        'Product feedback portals, changelog sidebars, customer community pages.',
        ['Tabs', 'Select', 'SegmentedControl', 'Tag', 'Text'],
      ),
    ],
    props: [
      { name: 'items', type: 'RoadmapBoardItem[]', description: 'id, title, description, status (column id), tags, votes, voted, comments, href.' },
      { name: 'columns', type: 'RoadmapBoardColumn[]', defaultValue: 'Planned, In progress, Shipped', description: 'id, label and optional description.' },
      { name: 'onVote', type: '(id, voted) => void | Promise<void>', description: 'Called after a toggle; a rejection rolls it back.' },
      { name: 'defaultSort', type: "'votes' | 'default'", defaultValue: "'votes'", description: 'Top voted, or the order items were passed in.' },
      { name: 'suggest', type: 'ReactNode', description: 'A slot beside the filters — usually “Suggest a feature”.' },
    ],
  },
}
