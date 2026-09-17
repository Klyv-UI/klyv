import { useState } from 'react'
import { Linkedin, Mail, Smile, Twitter } from 'lucide-react'
import {
  Button,
  ChatThread,
  CommentThread,
  FeatureFlags,
  IconButton,
  MessageComposer,
  NotificationPreferences,
  NpsSurvey,
  ReferralCard,
  Text,
  Toggletip,
  Tooltip,
  type ChatThreadMessage,
  type CommentThreadComment,
  type FeatureFlagsFlag,
  type MessageComposerAttachment,
  type NotificationPreferencesDigest,
  type NotificationPreferencesValue,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

const MINUTE = 60_000
const now = Date.now()

const ME = { id: 'me', name: 'Priya Raman' }
const JONAS = { id: 'jonas', name: 'Jonas Weber' }
const AMARA = { id: 'amara', name: 'Amara Okafor' }

const INITIAL_MESSAGES: ChatThreadMessage[] = [
  { id: 'm1', author: JONAS, body: 'Morning! Did the migration finish overnight?', sentAt: now - 26 * 60 * MINUTE },
  { id: 'm2', author: ME, body: 'It did — 1.2M rows, no errors.', sentAt: now - 25 * 60 * MINUTE, status: 'read' },
  { id: 'm3', author: AMARA, body: 'Checkout latency is up about 40ms since 9:00.', sentAt: now - 42 * MINUTE },
  { id: 'm4', author: AMARA, body: 'Could be the new index. Can someone take a look?', sentAt: now - 41 * MINUTE },
  { id: 'm5', author: ME, body: 'On it.', sentAt: now - 30 * MINUTE, status: 'read' },
  { id: 'm6', author: ME, body: 'Found it: the planner skips the index for carts with over 50 items. Patch is up.', sentAt: now - 28 * MINUTE, status: 'sent' },
]

const REPLIES = ['Nice catch, approving now.', 'Deploying to staging.', 'Latency is back to normal 🎉']

function ChatExample() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [typing, setTyping] = useState<string[]>([])
  const [reply, setReply] = useState(0)

  const send = (text: string) => {
    const id = `m${Date.now()}`
    setMessages((list) => [...list, { id, author: ME, body: text, sentAt: Date.now(), status: 'sending' }])
    window.setTimeout(() => setMessages((list) => list.map((m) => (m.id === id ? { ...m, status: 'sent' } : m))), 700)
  }

  const incoming = () => {
    setTyping([JONAS.name])
    window.setTimeout(() => {
      setTyping([])
      setMessages((list) => [...list, { id: `r${Date.now()}`, author: JONAS, body: REPLIES[reply % REPLIES.length], sentAt: Date.now() }])
      setReply((n) => n + 1)
    }, 1200)
  }

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <ChatThread messages={messages} currentUserId={ME.id} typing={typing} label="#checkout-oncall" className="h-[360px] rounded-[var(--radius-card)] border border-line bg-surface" />
      <MessageComposer onSend={({ text }) => send(text)} label="Message #checkout-oncall" placeholder="Message #checkout-oncall" />
      <Button variant="outline" size="sm" className="self-start" onClick={incoming}>
        Simulate a reply (scroll up first to see the jump button)
      </Button>
    </div>
  )
}

function ComposerExample() {
  const [attachments, setAttachments] = useState<MessageComposerAttachment[]>([
    { id: 'a1', name: 'latency-p95.png', meta: '184 KB' },
    { id: 'a2', name: 'explain-analyze.txt', meta: '3 KB' },
  ])
  const [sent, setSent] = useState<string[]>([])

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <MessageComposer
        maxLength={280}
        attachments={attachments}
        onRemoveAttachment={(id) => setAttachments((list) => list.filter((file) => file.id !== id))}
        onAttach={() => setAttachments((list) => [...list, { id: `a${Date.now()}`, name: `screenshot-${list.length + 1}.png`, meta: '240 KB' }])}
        actions={
          <Tooltip content="Emoji">
            <IconButton icon={Smile} label="Insert emoji" size="sm" />
          </Tooltip>
        }
        onSend={async ({ text, attachments: files }) => {
          await new Promise((resolve) => window.setTimeout(resolve, 900))
          setSent((list) => [`${text || '(no text)'} · ${files.length} file${files.length === 1 ? '' : 's'}`, ...list])
          setAttachments([])
        }}
      />
      {sent.length > 0 && (
        <Text size="caption" tone="faint">
          Last sent: {sent[0]}
        </Text>
      )}
    </div>
  )
}

const INITIAL_COMMENTS: CommentThreadComment[] = [
  {
    id: 'c1',
    author: AMARA,
    body: 'Should the empty state link to the import guide, or open the importer directly?',
    createdAt: now - 3 * 60 * MINUTE,
    reactions: [{ emoji: '👀', count: 2, reacted: false }],
    replies: [
      {
        id: 'c2',
        author: ME,
        body: 'Open the importer. The guide is one click away from there, and most people already have a CSV.',
        createdAt: now - 150 * MINUTE,
        reactions: [{ emoji: '👍', count: 3, reacted: true }],
        replies: [{ id: 'c3', author: JONAS, body: 'Agreed. Our funnel shows 70% drop-off on the guide page.', createdAt: now - 95 * MINUTE }],
      },
    ],
  },
]

function mapTree(list: CommentThreadComment[], fn: (c: CommentThreadComment) => CommentThreadComment | null): CommentThreadComment[] {
  return list.flatMap((comment) => {
    const next = fn(comment)
    return next ? [{ ...next, replies: next.replies ? mapTree(next.replies, fn) : undefined }] : []
  })
}

function CommentExample() {
  const [comments, setComments] = useState(INITIAL_COMMENTS)
  const [resolved, setResolved] = useState(false)

  const reply = (parentId: string | null, body: string) => {
    const comment: CommentThreadComment = { id: `c${Date.now()}`, author: ME, body, createdAt: Date.now() }
    if (parentId === null) setComments((list) => [...list, comment])
    else setComments((list) => mapTree(list, (c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), comment] } : c)))
  }

  return (
    <div className="w-full max-w-[600px]">
      <CommentThread
        comments={comments}
        currentUserId={ME.id}
        onReply={reply}
        onEdit={(id, body) => setComments((list) => mapTree(list, (c) => (c.id === id ? { ...c, body, editedAt: Date.now() } : c)))}
        onDelete={(id) => setComments((list) => mapTree(list, (c) => (c.id === id ? null : c)))}
        onReact={(id, emoji) =>
          setComments((list) =>
            mapTree(list, (c) => {
              if (c.id !== id) return c
              const existing = c.reactions?.find((r) => r.emoji === emoji)
              const others = (c.reactions ?? []).filter((r) => r.emoji !== emoji)
              const reacted = !existing?.reacted
              const count = (existing?.count ?? 0) + (reacted ? 1 : -1)
              return { ...c, reactions: count > 0 ? [...others, { emoji, count, reacted }] : others }
            }),
          )
        }
        resolved={resolved}
        onResolvedChange={setResolved}
      />
    </div>
  )
}

function ToggletipExample() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1">
        <Text as="span" size="label" weight="semibold" tone="soft">
          Billable seats
        </Text>
        <Toggletip label="About billable seats">
          A seat is anyone who signed in during the billing period. Guests and deactivated members are free.{' '}
          <a href="#seats">How seats are counted</a>
        </Toggletip>
      </div>
      <div className="flex items-center gap-1">
        <Text as="span" size="label" weight="semibold" tone="soft">
          Data retention
        </Text>
        <Toggletip label="About data retention" placement="right" align="start">
          Events older than 13 months are aggregated into daily totals. Raw events cannot be restored afterwards.
        </Toggletip>
      </div>
    </div>
  )
}

const EVENTS = [
  { id: 'mention', label: 'Mentions', description: 'Someone @mentions you in a comment or chat', category: 'Collaboration' },
  { id: 'assigned', label: 'Assigned to you', category: 'Collaboration' },
  { id: 'comment', label: 'Comments on your work', category: 'Collaboration', channels: ['email', 'push', 'in-app'] },
  { id: 'invoice', label: 'Invoices and receipts', category: 'Billing', channels: ['email'] },
  { id: 'payment-failed', label: 'Failed payments', category: 'Billing', channels: ['email', 'sms', 'in-app'] },
  { id: 'login', label: 'New sign-in', description: 'From a device we have not seen before', category: 'Security' },
]

function PreferencesExample() {
  const [saved, setSaved] = useState<NotificationPreferencesValue>({
    mention: ['email', 'push', 'in-app'],
    assigned: ['in-app'],
    comment: ['in-app'],
    invoice: ['email'],
    'payment-failed': ['email', 'in-app'],
    login: ['email', 'push'],
  })
  const [digest, setDigest] = useState<NotificationPreferencesDigest>('daily')

  return (
    <NotificationPreferences
      className="w-full"
      events={EVENTS}
      value={saved}
      digest={digest}
      onSave={async (payload) => {
        await new Promise((resolve) => window.setTimeout(resolve, 800))
        setSaved(payload.value)
        setDigest(payload.digest)
      }}
    />
  )
}

const FLAGS: FeatureFlagsFlag[] = [
  { key: 'new-billing-page', description: 'The redesigned plan and invoice screens.', enabled: { development: true, staging: true, production: false }, rollout: 25 },
  { key: 'ai-summaries', description: 'Thread summaries in the inbox sidebar.', enabled: { development: true, staging: false, production: false }, rollout: 10 },
  { key: 'legacy-export-v1', description: 'CSV export through the old worker.', enabled: { development: true, staging: true, production: true }, rollout: 100, stale: true },
  { key: 'realtime-cursors', description: 'Live cursors in shared documents.', enabled: { development: true, staging: true, production: true }, rollout: 50 },
]

function FlagsExample() {
  const [flags, setFlags] = useState(FLAGS)
  const update = (key: string, patch: (flag: FeatureFlagsFlag) => FeatureFlagsFlag) => setFlags((list) => list.map((flag) => (flag.key === key ? patch(flag) : flag)))

  return (
    <FeatureFlags
      className="w-full"
      flags={flags}
      onToggle={(key, env, enabled) => update(key, (flag) => ({ ...flag, enabled: { ...flag.enabled, [env]: enabled } }))}
      onRolloutChange={(key, rollout) => update(key, (flag) => ({ ...flag, rollout }))}
    />
  )
}

function NpsExample() {
  const [key, setKey] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) {
    return (
      <Button variant="outline" size="sm" onClick={() => { setDismissed(false); setKey((k) => k + 1) }}>
        Show the survey again
      </Button>
    )
  }
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <NpsSurvey
        key={key}
        question="How likely are you to recommend Klyv to a friend or colleague?"
        onSubmit={() => new Promise((resolve) => window.setTimeout(resolve, 700))}
        onDismiss={() => setDismissed(true)}
      />
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setKey((k) => k + 1)}>
        Reset
      </Button>
    </div>
  )
}

export const demos: ExampleModule = {
  'chat-thread': {
    description:
      'A conversation log that groups runs of messages by sender and time, marks day changes, shows delivery state on your own messages and follows new messages only while you are at the bottom — scroll up to reread and it offers a jump button instead of pulling you down.',
    sections: [
      { title: 'Live thread', description: 'Send a message, or simulate a reply after scrolling up.', bare: true, Content: ChatExample },
      rationale(
        'Chat UIs that autoscroll on every message make it impossible to reread anything during a busy conversation, and a bubble per message with its own avatar and time turns a thread into noise.',
        'Grouping by sender and a five-minute gap mirrors how people actually talk; pinning only while at the bottom respects a reader who scrolled up; a polite log role announces arrivals without interrupting.',
        'Support inboxes, team chat, in-app messaging, on-call channels.',
        ['Avatar', 'Text', 'TypingIndicator', 'internal glyphs'],
      ),
    ],
    props: [
      { name: 'messages', type: 'ChatThreadMessage[]', description: '{ id, author, body, sentAt, status? }, oldest first.' },
      { name: 'currentUserId', type: 'string', description: 'Whose messages sit on the right in the accent.' },
      { name: 'typing', type: 'string[]', defaultValue: '[]', description: 'Names shown in the typing indicator.' },
      { name: 'label', type: 'string', defaultValue: "'Conversation'", description: 'Accessible name for the log.' },
      { name: 'groupGap', type: 'number', defaultValue: '5', description: 'Minutes between messages that start a new group.' },
      { name: 'pinThreshold', type: 'number', defaultValue: '48', description: 'Pixels from the bottom that still count as following.' },
    ],
  },

  'message-composer': {
    description:
      'The text box under a conversation: grows with its content up to a few lines, sends on Enter (or Ctrl+Enter when configured), carries removable attachment chips and slots for attach and emoji controls, and blocks send while empty, over the limit or already sending.',
    sections: [
      { title: 'With attachments and a limit', description: 'Sending waits 900ms to show the busy state.', bare: true, Content: ComposerExample },
      {
        title: 'Variants',
        stack: true,
        specimens: [
          { label: 'sendOnEnter={false}', fill: true, node: <MessageComposer sendOnEnter={false} onSend={() => undefined} label="Long-form reply" placeholder="Enter adds a line; Ctrl+Enter sends" /> },
          { label: 'disabled', fill: true, node: <MessageComposer disabled onSend={() => undefined} label="Archived channel message" placeholder="This channel is archived" /> },
        ],
      },
      rationale(
        'A plain textarea either sends half-written messages on Enter or makes people hunt for a send button, and a hard maxlength silently cuts pasted text.',
        'Auto-growth keeps short messages compact and long ones readable; IME composition never triggers a send; the limit is shown and enforced at send time rather than by truncation.',
        'Under ChatThread, in comment boxes, support widgets and DMs.',
        ['IconButton', 'Tag', 'internal glyphs'],
      ),
    ],
    props: [
      { name: 'value / defaultValue / onValueChange', type: 'string', description: 'Controlled or uncontrolled text.' },
      { name: 'onSend', type: '(payload) => void | Promise<void>', description: 'Receives { text, attachments }; a promise shows the sending state.' },
      { name: 'attachments / onRemoveAttachment', type: 'MessageComposerAttachment[]', description: 'Chips above the field, each with a remove button.' },
      { name: 'onAttach', type: '() => void', description: 'Shows the attach button.' },
      { name: 'actions', type: 'ReactNode', description: 'Extra controls — an emoji picker trigger.' },
      { name: 'sendOnEnter', type: 'boolean', defaultValue: 'true', description: 'When false, Enter adds a line and Ctrl/⌘+Enter sends.' },
      { name: 'maxLength', type: 'number', description: 'Character limit with a counter; send is blocked past it.' },
      { name: 'maxRows', type: 'number', defaultValue: '6', description: 'Lines before the field scrolls.' },
      { name: 'sending / disabled', type: 'boolean', defaultValue: 'false', description: 'External busy state; blocks the whole control.' },
    ],
  },

  'comment-thread': {
    description:
      'Threaded discussion with a depth cap, relative times, inline reply and edit, reactions, delete with an inline confirmation, collapsible replies and a resolve toggle that settles the thread.',
    sections: [
      { title: 'Live thread', description: 'Reply at the third level to see the mention fallback. Your own comments can be edited and deleted.', bare: true, Content: CommentExample },
      rationale(
        'Unbounded nesting collapses into a narrow staircase, and review threads that never close keep getting reopened by stray replies.',
        'A three-level cap with @mention fallback keeps threads readable; editing and deleting are limited to your own comments; resolving removes every composer so a settled decision stays settled.',
        'Document and design review, pull request discussion, task comments.',
        ['Avatar', 'Badge', 'Button', 'RelativeTime', 'Text', 'Textarea'],
      ),
    ],
    props: [
      { name: 'comments', type: 'CommentThreadComment[]', description: 'Tree of { id, author, body, createdAt, editedAt?, reactions?, replies? }.' },
      { name: 'currentUserId', type: 'string', description: 'Whose comments get Edit and Delete.' },
      { name: 'onReply', type: '(parentId: string | null, body) => void', description: 'null adds a top-level comment.' },
      { name: 'onEdit / onDelete', type: 'function', description: 'Edit and delete the current person’s comments.' },
      { name: 'onReact', type: '(id, emoji) => void', description: 'Toggle a reaction. Omit to hide reactions.' },
      { name: 'reactionChoices', type: 'string[]', defaultValue: "['👍', '🎉', '👀']", description: 'Reactions offered on every comment.' },
      { name: 'maxDepth', type: 'number', defaultValue: '3', description: 'Nesting levels before replies go to the parent.' },
      { name: 'resolved / onResolvedChange', type: 'boolean', defaultValue: 'false', description: 'Resolve state and the control for it.' },
    ],
  },

  toggletip: {
    description:
      'An “i” button that opens a small explanation on click, Enter or Space and closes on the same, Escape or a click elsewhere. Unlike Tooltip, it is never hover-only, can hold links, and announces its content through a live region when opened.',
    sections: [
      { title: 'Beside labels', description: 'Click or press Enter on the “i”. Escape closes it.', Content: ToggletipExample },
      rationale(
        'Help text hidden in a hover tooltip is unreachable on touch, vanishes before a link inside it can be clicked, and is silent for screen reader users.',
        'A toggle button with aria-expanded makes the explanation something you ask for and keep; the live region reads it out because the bubble itself is portalled away from the button.',
        'Settings labels, pricing footnotes, form fields that need a paragraph of context.',
        ['Popover'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Names the button — “About billable seats”.' },
      { name: 'children', type: 'ReactNode', description: 'The explanation. Links are fine.' },
      { name: 'open / defaultOpen / onOpenChange', type: 'boolean', defaultValue: 'false', description: 'Controlled or uncontrolled open state.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', defaultValue: "'top' / 'center'", description: 'Where the bubble sits.' },
      { name: 'icon', type: 'IconComponent', description: 'Replaces the “i” glyph.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'sm'", description: '24px or 32px button.' },
    ],
  },

  'notification-preferences': {
    description:
      'A matrix of events by channel with a labelled checkbox in every cell, “all” boxes with a mixed state in each column heading, a digest frequency and a draft that only saves when you say so.',
    sections: [
      { title: 'Settings page', description: 'Change a few boxes, then Save or Discard.', bare: true, Content: PreferencesExample },
      rationale(
        'Notification settings as a long list of toggles hide the real question — which events, on which channels — and autosaving every click turns exploration into real changes.',
        'A grid matches the decision; each checkbox names its row and column for screen readers; column toggles make “no SMS at all” one click; a dirty-tracked draft makes changes reviewable.',
        'Account settings, workspace notification defaults, per-project overrides.',
        ['Button', 'Checkbox', 'Field', 'Select', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'events', type: 'NotificationPreferencesEvent[]', description: '{ id, label, description?, category, channels? }.' },
      { name: 'value', type: 'Record<string, string[]>', description: 'Saved selections: event id → channel ids.' },
      { name: 'digest', type: "'off' | 'daily' | 'weekly'", defaultValue: "'off'", description: 'Saved email frequency.' },
      { name: 'onSave', type: '(payload) => void | Promise<void>', description: 'Receives { value, digest } from the draft.' },
      { name: 'channels', type: 'NotificationPreferencesChannel[]', defaultValue: 'Email, Push, In-app, SMS', description: 'Columns, in order.' },
    ],
  },

  'feature-flags': {
    description:
      'Feature flags with a key, description, a switch per environment, a rollout slider and a Stale marker, filtered by search — and a confirmation before anything is switched on in production.',
    sections: [
      { title: 'Flag list', description: 'Turn a flag on in Prod to see the confirmation. Dev and Staging switch instantly.', bare: true, Content: FlagsExample },
      rationale(
        'Flag dashboards either confirm every toggle, which trains people to click through, or none, which lets a misclick ship to every customer.',
        'Only enabling in a protected environment asks, and the question names the flag and its rollout; turning off never asks, because off is the incident response.',
        'Internal admin, developer platform settings, release management.',
        ['ConfirmDialog', 'SearchField', 'Slider', 'Surface', 'Switch', 'Text', 'StatusPill'],
      ),
    ],
    props: [
      { name: 'flags', type: 'FeatureFlagsFlag[]', description: '{ key, description?, enabled, rollout, stale? }.' },
      { name: 'onToggle', type: '(key, environment, enabled) => void', description: 'Called after confirmation where one is needed.' },
      { name: 'onRolloutChange', type: '(key, rollout) => void', description: 'Shows the rollout slider.' },
      { name: 'environments', type: 'FeatureFlagsEnvironment[]', defaultValue: 'Dev, Staging, Prod (protected)', description: '{ id, label, protected? } columns.' },
    ],
  },

  'referral-card': {
    description:
      'A referral programme on one card: the offer, the invite link with copy and share buttons, progress to the next reward tier in words, and everyone invited so far with their status.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: () => (
          <ReferralCard
            className="w-full max-w-[520px]"
            link="https://klyvui.xyz/r/priya-7Q2F"
            reward={
              <>
                Friends get <strong className="text-ink">30% off</strong> their first three months. You get a free month for every two who subscribe.
              </>
            }
            tiers={[
              { count: 2, reward: '1 month free' },
              { count: 5, reward: '3 months free' },
              { count: 10, reward: 'a year of Pro' },
            ]}
            share={[
              { label: 'Email', href: 'mailto:?subject=Try%20Klyv&body=https%3A%2F%2Fklyvui.xyz%2Fr%2Fpriya-7Q2F', icon: Mail },
              { label: 'X', href: 'https://x.com/intent/post?url=https%3A%2F%2Fklyvui.xyz%2Fr%2Fpriya-7Q2F', icon: Twitter },
              { label: 'LinkedIn', href: 'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fklyvui.xyz%2Fr%2Fpriya-7Q2F', icon: Linkedin },
            ]}
            referrals={[
              { id: 'r1', name: 'Jonas Weber', status: 'rewarded', detail: 'Subscribed 2 Sep' },
              { id: 'r2', name: 'Amara Okafor', status: 'joined', detail: 'Joined 11 Sep' },
              { id: 'r3', name: 'Lena Fischer', status: 'joined', detail: 'Joined 14 Sep' },
              { id: 'r4', name: 'Diego Alvarez', status: 'invited', detail: 'Invited 15 Sep' },
            ]}
          />
        ),
      },
      rationale(
        'Referral pages bury the reward below the link and show progress as an unlabelled bar, so people share once and never again.',
        'The offer comes first, progress is stated as “N more friends for X”, and only friends who actually joined count — matching what the programme pays for.',
        'Account menus, post-upgrade moments, a dedicated invite page.',
        ['Avatar', 'Button', 'CopyButton', 'Input', 'Progress', 'Surface', 'Text', 'StatusPill'],
      ),
    ],
    props: [
      { name: 'link', type: 'string', description: 'The personal invite link.' },
      { name: 'reward', type: 'ReactNode', description: 'The offer, both sides of it.' },
      { name: 'tiers', type: 'ReferralCardTier[]', defaultValue: '[]', description: '{ count, reward }, lowest first.' },
      { name: 'referrals', type: 'ReferralCardReferral[]', defaultValue: '[]', description: "{ id, name, status: 'invited' | 'joined' | 'rewarded', detail? }." },
      { name: 'share', type: 'ReferralCardShareTarget[]', defaultValue: '[]', description: '{ label, href, icon? } share links.' },
      { name: 'title', type: 'ReactNode', defaultValue: "'Invite friends'", description: 'Card heading.' },
    ],
  },

  'nps-survey': {
    description:
      'The 0–10 recommendation question as real radio buttons, with bands for not likely, maybe and very likely, a follow-up that adapts to the score, a submit and thank-you state, and a dismiss button — as a card or inline.',
    sections: [
      { title: 'Card', description: 'Pick a score to see the follow-up change between 6, 8 and 10.', bare: true, Content: NpsExample },
      {
        title: 'Inline',
        specimens: [
          {
            label: 'variant="inline"',
            fill: true,
            node: <NpsSurvey variant="inline" defaultValue={9} question="How likely are you to recommend the new editor?" onSubmit={() => undefined} className="w-full" />,
          },
        ],
      },
      rationale(
        'NPS widgets that submit on the first tap lose the comment — the useful half — and a generic “any comments?” gets the fewest answers.',
        'Native radios give arrow-key movement and “8 of 11” for free; the follow-up asks detractors what to fix, passives what would make it a 10, and promoters what they value.',
        'In-app after a meaningful milestone, a post-support email landing page, a quarterly check-in.',
        ['Button', 'IconButton', 'Surface', 'Text', 'Textarea'],
      ),
    ],
    props: [
      { name: 'question', type: 'string', description: 'The recommendation question. Name the product.' },
      { name: 'value / defaultValue / onValueChange', type: 'number | null', defaultValue: 'null', description: 'Controlled or uncontrolled score.' },
      { name: 'onSubmit', type: '(response) => void | Promise<void>', description: 'Receives { score, category, comment }.' },
      { name: 'onDismiss', type: '() => void', description: 'Shows a close button.' },
      { name: 'followUp', type: 'Partial<Record<NpsSurveyCategory, string>>', description: 'Override the follow-up per detractor, passive, promoter.' },
      { name: 'thanks', type: 'ReactNode', description: 'Replaces the thank-you line.' },
      { name: 'variant', type: "'card' | 'inline'", defaultValue: "'card'", description: 'Panel or flat.' },
    ],
  },
}
