import { useState } from 'react'
import { Inbox, Info, Sparkles, TriangleAlert } from 'lucide-react'
import {
  Alert,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineMessage,
  Input,
  Label,
  LoadingOverlay,
  Skeleton,
  SuccessMark,
  Surface,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'

function LoadingOverlayExample() {
  const [busy, setBusy] = useState(true)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <div className="relative w-full max-w-[340px]" aria-busy={busy}>
        <Card title="Exchange Money">
          <div className="mt-3 flex flex-col gap-2">
            <Surface variant="field" padding="md">
              <Text size="caption" tone="faint">
                From
              </Text>
              <Text size="amount" tabular className="mt-1.5">
                $ 500
              </Text>
            </Surface>
            <Surface variant="sunken" padding="sm" className="flex-row justify-between">
              <Text size="label" tone="faint">
                Currency rate
              </Text>
              <Text size="label" weight="bold" tabular>
                1 USD = 0,73 GBP
              </Text>
            </Surface>
          </div>
        </Card>
        <LoadingOverlay active={busy} label="Fetching the latest rate" showLabel blur />
      </div>
      <Button size="sm" variant="outline" onClick={() => setBusy((previous) => !previous)}>
        {busy ? 'Finish loading' : 'Start loading'}
      </Button>
    </div>
  )
}

function SuccessMarkExample() {
  const [done, setDone] = useState(false)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Card className="w-full max-w-[320px] items-center gap-3 py-8">
        {done ? (
          <>
            <SuccessMark size="lg" label="Transfer sent" />
            <Text size="subtitle">Transfer sent</Text>
            <Text size="caption" tone="faint">
              £369.41 is on its way to Sarah Rosewood.
            </Text>
          </>
        ) : (
          <>
            <Skeleton shape="circle" width={72} height={72} />
            <Skeleton width={140} />
          </>
        )}
      </Card>
      <Button size="sm" variant="outline" onClick={() => setDone((previous) => !previous)}>
        {done ? 'Reset' : 'Complete the transfer'}
      </Button>
    </div>
  )
}

function AlertDismissExample() {
  const [shown, setShown] = useState(true)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      {shown ? (
        <Alert
          tone="accent"
          icon={Sparkles}
          title="Your cashback is ready"
          onDismiss={() => setShown(false)}
          action={
            <Button size="sm" variant="outline">
              Withdraw
            </Button>
          }
          className="w-full max-w-[460px]"
        >
          $1,154.00 has been credited and can be withdrawn at any time.
        </Alert>
      ) : (
        <Text size="caption" tone="faint">
          Dismissed.
        </Text>
      )}
      {!shown && (
        <Button size="sm" variant="outline" onClick={() => setShown(true)}>
          Bring it back
        </Button>
      )}
    </div>
  )
}

function InlineMessageExample() {
  const [value, setValue] = useState('')
  const tooLong = value.length > 12
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-1.5">
      <Label htmlFor="im-demo">Reference</Label>
      <Input
        id="im-demo"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        invalid={tooLong}
        aria-describedby="im-demo-message"
        placeholder="Type more than 12 characters"
      />
      <InlineMessage id="im-demo-message" tone={tooLong ? 'danger' : 'hint'} live={tooLong}>
        {tooLong ? 'Keep the reference under 12 characters.' : 'Shown on the recipient statement.'}
      </InlineMessage>
    </div>
  )
}

export const demos: ExampleModule = {
  alert: {
    description:
      'A persistent message block. The tone is carried by a coloured rail rather than a full colour wash, so an alert sits inside a card without competing with it — and so tone is never the only signal. Warning and danger announce assertively; the rest are polite.',
    sections: [
      {
        title: 'Tones',
        stack: true,
        specimens: [
          {
            label: 'neutral',
            fill: true,
            node: (
              <Alert icon={Info} title="Scheduled maintenance" className="w-full max-w-[460px]">
                Transfers will be paused on Sunday between 02:00 and 04:00.
              </Alert>
            ),
          },
          {
            label: 'accent',
            fill: true,
            node: (
              <Alert tone="accent" icon={Sparkles} title="Cashback available" className="w-full max-w-[460px]">
                $1,154.00 is ready to withdraw.
              </Alert>
            ),
          },
          {
            label: 'success',
            fill: true,
            node: (
              <Alert tone="success" title="Transfer sent" className="w-full max-w-[460px]">
                £369.41 is on its way to Sarah Rosewood.
              </Alert>
            ),
          },
          {
            label: 'warning',
            hint: 'Announced assertively',
            fill: true,
            node: (
              <Alert tone="warning" icon={TriangleAlert} title="Card expires soon" className="w-full max-w-[460px]">
                Your card ending 5199 expires in June. Order a replacement to avoid interruption.
              </Alert>
            ),
          },
          {
            label: 'danger',
            hint: 'Announced assertively',
            fill: true,
            node: (
              <Alert tone="danger" title="Payment failed" className="w-full max-w-[460px]">
                The bank declined the transfer. No money has left your account.
              </Alert>
            ),
          },
        ],
      },
      {
        title: 'Actions and dismissal',
        bare: true,
        Content: AlertDismissExample,
        note: 'Set live only for alerts that appear in response to something. An alert present on page load does not need announcing — it will be read in document order anyway.',
      },
      {
        title: 'Minimal',
        specimens: [
          {
            label: 'title only',
            fill: true,
            node: <Alert title="Nothing to do here." className="w-full max-w-[460px]" />,
          },
          {
            label: 'body only',
            fill: true,
            node: (
              <Alert className="w-full max-w-[460px]">
                Rates refresh every 60 seconds.
              </Alert>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'tone', type: "'neutral' | 'accent' | 'success' | 'warning' | 'danger'", defaultValue: "'neutral'", description: 'Colour of the rail.' },
      { name: 'title / children', type: 'string / ReactNode', description: 'Heading and body.' },
      { name: 'icon', type: 'IconComponent', description: 'Glyph before the text.' },
      { name: 'action', type: 'ReactNode', description: 'Right-aligned affordance.' },
      { name: 'onDismiss', type: '() => void', description: 'Adds a dismiss control.' },
      { name: 'live', type: 'boolean', defaultValue: 'false', description: 'Announce on appearance.' },
    ],
  },

  'inline-message': {
    description:
      'The one-line form of Alert, for the message under a field. Deliberately unboxed: a bordered block under every input makes a form feel like a list of problems. Each tone carries a glyph as well as a colour.',
    sections: [
      {
        title: 'Tones',
        stack: true,
        specimens: [
          { label: 'hint', fill: true, node: <InlineMessage>Shown on the recipient statement.</InlineMessage> },
          { label: 'success', fill: true, node: <InlineMessage tone="success">Account number verified.</InlineMessage> },
          { label: 'warning', fill: true, node: <InlineMessage tone="warning">This transfer will arrive after the weekend.</InlineMessage> },
          { label: 'danger', fill: true, node: <InlineMessage tone="danger">Enter a number between 1 and 2000.</InlineMessage> },
        ],
      },
      {
        title: 'Wired to a field',
        description: 'Type more than twelve characters. The message swaps to an error, becomes live and the field is marked invalid.',
        bare: true,
        Content: InlineMessageExample,
        note: 'Pass the same id to aria-describedby on the control. Field does this wiring for you.',
      },
    ],
    props: [
      { name: 'tone', type: "'hint' | 'success' | 'warning' | 'danger'", defaultValue: "'hint'", description: 'Colour and glyph.' },
      { name: 'live', type: 'boolean', defaultValue: 'false', description: 'Announce changes politely.' },
      { name: 'id', type: 'string', description: 'Point aria-describedby at this.' },
    ],
  },

  banner: {
    description:
      'A full-width announcement across the top of a region. Distinct from Alert: Alert reports the state of something on the page, a Banner announces something about the product, and it fills its container edge to edge.',
    sections: [
      {
        title: 'Tones',
        stack: true,
        specimens: [
          {
            label: 'accent',
            fill: true,
            node: (
              <Banner
                title="Smart banking makes life different"
                icon={Sparkles}
                action={<Button variant="white" size="sm">Order yours</Button>}
                onDismiss={() => undefined}
                className="w-full"
              >
                Get your green credit card now and get $100 in cashback.
              </Banner>
            ),
          },
          {
            label: 'neutral',
            fill: true,
            node: (
              <Banner tone="neutral" title="You are viewing a demo account" className="w-full">
                Figures are illustrative and no transfers can be made.
              </Banner>
            ),
          },
          {
            label: 'ink',
            fill: true,
            node: (
              <Banner
                tone="ink"
                title="New: instant transfers"
                action={<Button variant="white" size="sm">See how</Button>}
                className="w-full"
              >
                Money arrives in under a minute for most recipients.
              </Banner>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'tone', type: "'accent' | 'neutral' | 'ink'", defaultValue: "'accent'", description: 'Surface treatment.' },
      { name: 'title / children', type: 'string / ReactNode', description: 'Heading and body.' },
      { name: 'action / onDismiss', type: 'ReactNode / () => void', description: 'Affordance and dismissal.' },
    ],
  },

  'empty-state': {
    description:
      'What a region shows when it has nothing to show. The description should say what will fill the space and how — "No transactions yet" alone tells the reader nothing they did not already know.',
    sections: [
      {
        title: 'Sizes',
        stack: true,
        specimens: [
          {
            label: 'md',
            hint: 'A whole card or page region',
            fill: true,
            node: (
              <Surface variant="card" className="w-full max-w-[440px]">
                <EmptyState
                  icon={Inbox}
                  title="No transactions yet"
                  description="Once money moves in or out of this account, it will appear here with a running balance."
                  action={<Button size="sm">Make a transfer</Button>}
                  secondaryAction={<Button size="sm" variant="ghost">Import a statement</Button>}
                />
              </Surface>
            ),
          },
          {
            label: 'sm',
            hint: 'Inside a card that already has a header',
            fill: true,
            node: (
              <Card title="Cashback partners" className="w-full max-w-[440px]">
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title="No partners yet"
                  description="Partners appear here once you shop with them."
                />
              </Card>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'icon / title / description', type: 'IconComponent / string / ReactNode', description: 'The three parts.' },
      { name: 'action / secondaryAction', type: 'ReactNode', description: 'Affordances under the copy.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Vertical padding and heading size.' },
    ],
  },

  'error-state': {
    description:
      'EmptyState for a failure rather than an absence. It is announced as an alert and always offers a way forward, because a dead end with no retry is the one error state a user cannot act on. The technical detail is optional and kept quiet.',
    sections: [
      {
        title: 'Default',
        stack: true,
        specimens: [
          {
            label: 'with retry',
            fill: true,
            node: (
              <Surface variant="card" className="w-full max-w-[440px]">
                <ErrorState action={<Button size="sm" variant="outline">Try again</Button>} />
              </Surface>
            ),
          },
          {
            label: 'with detail',
            hint: 'For something a support agent can use',
            fill: true,
            node: (
              <Surface variant="card" className="w-full max-w-[440px]">
                <ErrorState
                  title="Rates are unavailable"
                  description="We could not reach the exchange service. Your balance is unaffected."
                  detail="RATE_SERVICE_TIMEOUT / req_8f21c4"
                  action={<Button size="sm" variant="outline">Retry</Button>}
                />
              </Surface>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'title / description', type: 'string / ReactNode', description: 'Defaults cover the generic case.' },
      { name: 'detail', type: 'string', description: 'Technical detail, shown small and monospaced.' },
      { name: 'action', type: 'ReactNode', description: 'The retry. Almost always supply one.' },
    ],
  },

  'loading-overlay': {
    description:
      'A scrim over the region it sits in. It covers the content rather than replacing it, so the layout cannot shift while loading. When the shape of the incoming content is known, prefer Skeleton — it tells the reader more.',
    sections: [
      {
        title: 'Example',
        description: 'Place it inside a relatively positioned container and set aria-busy on that container.',
        bare: true,
        Content: LoadingOverlayExample,
        note: 'The overlay reports progress, but the container is what is busy — so aria-busy belongs on the container, not on the overlay.',
      },
    ],
    props: [
      { name: 'active', type: 'boolean', description: 'Whether the overlay shows.' },
      { name: 'label', type: 'string', defaultValue: "'Loading'", description: 'Announced, and shown when showLabel is set.' },
      { name: 'showLabel', type: 'boolean', defaultValue: 'false', description: 'Show the label under the spinner.' },
      { name: 'blur', type: 'boolean', defaultValue: 'false', description: 'Blur the content behind the scrim.' },
    ],
  },

  'success-mark': {
    description:
      'The confirmation tick at the end of a flow. The stroke draws itself once on mount; under prefers-reduced-motion it simply appears complete. It is a status region, so the confirmation is announced rather than only drawn.',
    sections: [
      {
        title: 'Sizes',
        specimens: [
          { label: 'sm', node: <SuccessMark size="sm" label="Saved" /> },
          { label: 'md', node: <SuccessMark size="md" label="Saved" /> },
          { label: 'lg', node: <SuccessMark size="lg" label="Saved" /> },
          { label: 'bare', hint: 'No disc, for use on a coloured surface', node: <SuccessMark size="md" bare label="Saved" /> },
        ],
      },
      {
        title: 'In a flow',
        description: 'Toggle it to replay the draw.',
        bare: true,
        Content: SuccessMarkExample,
      },
    ],
    props: [
      { name: 'size', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: '32 · 48 · 72px.' },
      { name: 'label', type: 'string', defaultValue: "'Done'", description: 'Announced when it appears.' },
      { name: 'bare', type: 'boolean', defaultValue: 'false', description: 'Tick only, without the accent disc.' },
    ],
  },
}
