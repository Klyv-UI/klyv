import { useState } from 'react'
import { Bell, CreditCard, ShieldCheck, UserRound } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Surface,
  Switch,
  Tabs,
  Text,
  Textarea,
} from 'citrine'

/**
 * A settings screen.
 *
 * The save bar is part of the page rather than a floating toast: settings are
 * edited in bursts, and a control that scrolls away with the form is a control
 * people miss. Each switch is a real input, so the whole panel is reachable by
 * keyboard in the order it reads.
 */
type TabKey = 'profile' | 'notifications' | 'security' | 'billing'

export default function SettingsBlock() {
  const [tab, setTab] = useState<TabKey>('profile')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  const touch = () => {
    setDirty(true)
    setSaved(false)
  }

  const save = () => {
    setDirty(false)
    setSaved(true)
  }

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-6">
      <PageHeader
        title="Settings"
        description="Applies to your account across every workspace you belong to."
      />

      {saved && (
        <Alert tone="success" live onDismiss={() => setSaved(false)}>
          Your changes have been saved.
        </Alert>
      )}

      <Tabs
        label="Settings sections"
        value={tab}
        onValueChange={(value) => setTab(value as TabKey)}
        variant="underline"
        items={[
          {
            value: 'profile',
            label: 'Profile',
            icon: UserRound,
            content: (
              <div className="flex flex-col gap-3 pt-4">
                <Card title="Who you are">
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Display name">
                      <Input defaultValue="Priya Raman" onChange={touch} />
                    </Field>
                    <Field label="Job title">
                      <Input defaultValue="Head of Operations" onChange={touch} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Bio" hint="Shown on your profile and in handover notes.">
                        <Textarea
                          rows={3}
                          resize="vertical"
                          defaultValue="Runs the northern corridor. Twelve years in freight, mostly nights."
                          onChange={touch}
                        />
                      </Field>
                    </div>
                  </div>
                </Card>

                <Card title="Regional">
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                      label="Language"
                      value="en-GB"
                      onValueChange={touch}
                      fullWidth
                      options={[
                        { value: 'en-GB', label: 'English (UK)' },
                        { value: 'de-DE', label: 'Deutsch' },
                        { value: 'pl-PL', label: 'Polski' },
                      ]}
                    />
                    <Select
                      label="Time zone"
                      value="cet"
                      onValueChange={touch}
                      fullWidth
                      options={[
                        { value: 'cet', label: 'Central European Time' },
                        { value: 'gmt', label: 'Greenwich Mean Time' },
                        { value: 'eet', label: 'Eastern European Time' },
                      ]}
                    />
                  </div>
                </Card>
              </div>
            ),
          },
          {
            value: 'notifications',
            label: 'Notifications',
            icon: Bell,
            content: (
              <div className="pt-4">
                <Card title="What reaches you">
                  <div className="mt-2 flex flex-col">
                    {NOTIFICATIONS.map((row) => (
                      <ToggleRow key={row.id} {...row} onToggle={touch} />
                    ))}
                  </div>
                </Card>
              </div>
            ),
          },
          {
            value: 'security',
            label: 'Security',
            icon: ShieldCheck,
            content: (
              <div className="flex flex-col gap-3 pt-4">
                <Card title="Access">
                  <div className="mt-2 flex flex-col">
                    <ToggleRow
                      id="2fa"
                      title="Two-factor authentication"
                      description="Required for everyone with dispatch permissions."
                      defaultOn
                      onToggle={touch}
                    />
                    <ToggleRow
                      id="sessions"
                      title="Sign out idle sessions"
                      description="Ends any session after 30 minutes without activity."
                      defaultOn
                      onToggle={touch}
                    />
                  </div>
                </Card>
                <Card title="Danger zone">
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Text size="caption" tone="soft" leading="normal" className="max-w-[46ch]">
                      Deleting the account removes your dispatch history. Consignment records are
                      kept for seven years for compliance.
                    </Text>
                    <Button variant="outline" size="sm">
                      Delete account
                    </Button>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            value: 'billing',
            label: 'Billing',
            icon: CreditCard,
            badge: '2',
            content: (
              <div className="pt-4">
                <Card title="Plan">
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <Text size="heading">Fleet — 240 vehicles</Text>
                      <Text size="caption" tone="faint">
                        Renews 1 April. Two invoices need attention.
                      </Text>
                    </div>
                    <Button size="sm" variant="outline">
                      Manage plan
                    </Button>
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />

      <Surface
        variant="card"
        padding="sm"
        className="sticky bottom-4 flex-row items-center justify-between gap-3"
      >
        <Text size="caption" weight="semibold" tone={dirty ? 'default' : 'faint'}>
          {dirty ? 'You have unsaved changes' : 'Everything is up to date'}
        </Text>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setDirty(false)}>
            Discard
          </Button>
          <Button size="sm" disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        </div>
      </Surface>
    </div>
  )
}

function ToggleRow({
  id,
  title,
  description,
  defaultOn = false,
  onToggle,
}: {
  id: string
  title: string
  description: string
  defaultOn?: boolean
  onToggle: () => void
}) {
  const [on, setOn] = useState(defaultOn)

  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text size="caption" weight="bold">
          {title}
        </Text>
        <Text size="caption" tone="faint" leading="normal">
          {description}
        </Text>
      </div>
      <Switch
        id={id}
        aria-label={title}
        checked={on}
        onChange={(event) => {
          setOn(event.target.checked)
          onToggle()
        }}
      />
    </div>
  )
}

const NOTIFICATIONS = [
  {
    id: 'delays',
    title: 'Delay warnings',
    description: 'When a consignment slips outside its promised window.',
    defaultOn: true,
  },
  {
    id: 'handover',
    title: 'Shift handover',
    description: 'A summary at the end of each shift, to you and your deputy.',
    defaultOn: true,
  },
  {
    id: 'digest',
    title: 'Weekly digest',
    description: 'On-time rate, dwell and exceptions for the week.',
    defaultOn: false,
  },
  {
    id: 'marketing',
    title: 'Product news',
    description: 'Occasional notes about what has shipped.',
    defaultOn: false,
  },
]
