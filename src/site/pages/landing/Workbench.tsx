import { useState } from 'react'
import { Check, CircleDollarSign } from 'lucide-react'
import {
  AreaChart,
  AvatarGroup,
  Button,
  Card,
  Field,
  Input,
  SegmentedControl,
  StatCard,
  Surface,
  Switch,
  Tag,
  Text,
  cn,
} from 'citrine'
import { enter } from './primitives'

/**
 * The hero's product side: real components laid out the way a product would
 * use them — settings, a figure, a form, a chart — tilted back into the stage
 * from `lg`, and flat where there is no room for perspective.
 *
 * Nothing on it is a picture. Every switch switches, the form sends, and the
 * colour picked beside it repaints all of it at once. The tilt is static: a
 * plane that moved under the pointer would move the control being aimed at.
 */
export function HeroStack() {
  return (
    <div style={enter(220)} className="landing-enter relative min-w-0 lg:[perspective:2200px]">
      <div className="mx-auto grid w-full max-w-[620px] grid-cols-1 gap-3 sm:grid-cols-2 lg:mx-0 lg:w-[780px] lg:max-w-none lg:origin-left lg:[transform:rotateX(10deg)_rotateY(-18deg)_rotateZ(3deg)]">
        <NotificationsPanel className="sm:row-span-2" />
        <StatCard
          icon={CircleDollarSign}
          title="Monthly revenue"
          value="$48,290"
          // StatCard signs an upward trend itself.
          delta="12.4%"
          trend="up"
          caption="Against August"
          meter={{ value: 48290, total: 60000, label: 'Quarterly goal' }}
          className="h-full"
        />
        <InvitePanel className="hidden sm:flex" />
        <ChartPanel className="hidden lg:col-span-2 lg:flex" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ panels */

const TOPICS = [
  { id: 'mentions', label: 'Mentions', hint: 'When someone @mentions you' },
  { id: 'digest', label: 'Weekly digest', hint: 'A summary every Monday' },
  { id: 'releases', label: 'Product updates', hint: 'New components and releases' },
]

type Channel = 'email' | 'slack' | 'both'

/**
 * A settings card that works, not a picture of one.
 *
 * Deliberately not a sign-in form: a login in the hero read as "you need an
 * account to use this", and browsers autofilled real credentials into it.
 */
function NotificationsPanel({ className }: { className?: string }) {
  const [on, setOn] = useState<Record<string, boolean>>({ mentions: true, digest: true })
  const [channel, setChannel] = useState<Channel>('email')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const count = TOPICS.filter((topic) => on[topic.id]).length

  const save = () => {
    setState('saving')
    window.setTimeout(() => setState('saved'), 700)
  }

  return (
    // h2: the hero has only its h1 above this, and a level may not be skipped.
    <Card title="Notifications" headingLevel="h2" className={cn('h-full gap-4', className)}>
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {TOPICS.map((topic) => (
          <li key={topic.id}>
            <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <Text as="span" size="label" weight="semibold">
                  {topic.label}
                </Text>
                <Text as="span" size="caption" tone="faint">
                  {topic.hint}
                </Text>
              </span>
              <Switch
                switchSize="sm"
                checked={Boolean(on[topic.id])}
                onChange={(event) => {
                  setOn({ ...on, [topic.id]: event.target.checked })
                  setState('idle')
                }}
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <Text as="span" size="label" weight="semibold">
          Deliver by
        </Text>
        <SegmentedControl<Channel>
          label="Deliver by"
          size="sm"
          value={channel}
          onValueChange={(value) => {
            setChannel(value)
            setState('idle')
          }}
          options={[
            { value: 'email', label: 'Email' },
            { value: 'slack', label: 'Slack' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <Text as="span" size="caption" tone="faint" aria-live="polite" className="inline-flex items-center gap-1.5">
          {state === 'saved' ? (
            <>
              <Check size={13} strokeWidth={2.5} aria-hidden className="text-ink-soft" />
              Saved
            </>
          ) : (
            `${count} of ${TOPICS.length} on`
          )}
        </Text>
        <Button size="sm" loading={state === 'saving'} onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  )
}

const TEAM = [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }, { name: 'Alan Turing' }, { name: 'Katherine Johnson' }]

type Role = 'member' | 'admin'

/** An invite form that goes through the motions: send, then confirm. */
function InvitePanel({ className }: { className?: string }) {
  const [role, setRole] = useState<Role>('member')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  return (
    <Surface variant="card" padding="lg" className={cn('gap-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <Text size="heading">Invite a teammate</Text>
        <AvatarGroup people={TEAM} max={3} size="sm" label="Already on the team" />
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setState('sending')
          window.setTimeout(() => setState('sent'), 700)
        }}
      >
        <Field label="Email">
          <Input
            type="email"
            name="invite-email"
            autoComplete="off"
            placeholder="ada@example.com"
            onChange={() => setState('idle')}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl<Role>
            label="Role"
            size="sm"
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'member', label: 'Member' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Button type="submit" size="sm" loading={state === 'sending'}>
            {state === 'sent' ? 'Invite sent' : 'Send invite'}
          </Button>
        </div>
      </form>
    </Surface>
  )
}

const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
const REVENUE = [31, 34, 33, 38, 41, 44, 48].map((value) => value * 1000)
const COSTS = [22, 23, 25, 24, 26, 27, 29].map((value) => value * 1000)

function ChartPanel({ className }: { className?: string }) {
  return (
    <Surface variant="card" padding="lg" className={cn('gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <Text size="heading">Revenue and costs</Text>
        <Tag size="sm" tone="accent">
          Live
        </Tag>
      </div>
      <AreaChart
        label="Revenue and costs by month"
        categories={MONTHS}
        height={170}
        showGrid
        showLegend
        format={(value) => `$${Math.round(value / 1000)}k`}
        series={[
          { id: 'revenue', label: 'Revenue', values: REVENUE },
          { id: 'costs', label: 'Costs', values: COSTS },
        ]}
      />
    </Surface>
  )
}
