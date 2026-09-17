'use client'

import { Fragment, useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { Field } from '../Field'
import { Select } from '../Select'
import { Surface } from '../Surface'
import { Text } from '../Text'

export interface NotificationPreferencesChannel {
  id: string
  /** Column heading — “Email”, “Push”. */
  label: string
}

export interface NotificationPreferencesEvent {
  id: string
  label: string
  description?: string
  /** Rows are grouped under this heading, in first-seen order. */
  category: string
  /** Channels this event can go to. Omit for all of them. */
  channels?: string[]
}

/** Event id → the channel ids it is delivered on. */
export type NotificationPreferencesValue = Record<string, string[]>

export type NotificationPreferencesDigest = 'off' | 'daily' | 'weekly'

export interface NotificationPreferencesSavePayload {
  value: NotificationPreferencesValue
  digest: NotificationPreferencesDigest
}

export interface NotificationPreferencesProps {
  events: NotificationPreferencesEvent[]
  /** The saved selections. Edits are a draft against this until saved. */
  value: NotificationPreferencesValue
  /** The saved digest frequency. */
  digest?: NotificationPreferencesDigest
  /** Called with the draft. Return a promise to show the saving state. */
  onSave: (payload: NotificationPreferencesSavePayload) => void | Promise<void>
  channels?: NotificationPreferencesChannel[]
  /** Merged last, so it wins. */
  className?: string
}

const DEFAULT_CHANNELS: NotificationPreferencesChannel[] = [
  { id: 'email', label: 'Email' },
  { id: 'push', label: 'Push' },
  { id: 'in-app', label: 'In-app' },
  { id: 'sms', label: 'SMS' },
]

const DIGESTS = [
  { value: 'off' as const, label: 'Send each one as it happens' },
  { value: 'daily' as const, label: 'Daily digest' },
  { value: 'weekly' as const, label: 'Weekly digest' },
]

const key = (value: NotificationPreferencesValue, digest: string) =>
  JSON.stringify([Object.keys(value).sort().map((id) => [id, [...value[id]].sort()]), digest])

/**
 * Which events reach you, and where — a grid of events down the side and
 * channels across the top, because that is the shape of the decision.
 *
 * Every checkbox is named for both its row and its column (“Email for Mentions”),
 * since a screen reader moving cell to cell otherwise hears “checkbox, checked”
 * forty times. Each column heading carries an “all” box that shows the mixed
 * state when some rows are on, which is the fastest way to turn SMS off entirely.
 *
 * Changes are a draft until saved. Preferences saved on every click make an
 * exploratory toggle a real one, and give no moment to see what changed; here
 * Save lights up only when the draft differs, and Discard puts it back.
 */
export function NotificationPreferences({
  events,
  value,
  digest = 'off',
  onSave,
  channels = DEFAULT_CHANNELS,
  className,
}: NotificationPreferencesProps) {
  const [draft, setDraft] = useState(value)
  const [draftDigest, setDraftDigest] = useState(digest)
  const [saving, setSaving] = useState(false)
  const savedKey = key(value, digest)

  // A new saved value from the caller resets the draft — after a save lands, or
  // when the settings load.
  useEffect(() => {
    setDraft(value)
    setDraftDigest(digest)
  }, [savedKey])

  const dirty = key(draft, draftDigest) !== savedKey
  const supports = (event: NotificationPreferencesEvent, channel: string) => !event.channels || event.channels.includes(channel)
  const isOn = (eventId: string, channel: string) => draft[eventId]?.includes(channel) ?? false

  const set = (eventId: string, channel: string, on: boolean) =>
    setDraft((current) => {
      const list = (current[eventId] ?? []).filter((id) => id !== channel)
      return { ...current, [eventId]: on ? [...list, channel] : list }
    })

  const setColumn = (channel: string, on: boolean) =>
    setDraft((current) => {
      const next = { ...current }
      for (const event of events) {
        if (!supports(event, channel)) continue
        const list = (next[event.id] ?? []).filter((id) => id !== channel)
        next[event.id] = on ? [...list, channel] : list
      }
      return next
    })

  const categories = [...new Set(events.map((event) => event.category))]

  const save = async () => {
    setSaving(true)
    try {
      await onSave({ value: draft, digest: draftDigest })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Surface variant="card" className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <caption className="sr-only">Notification delivery by event and channel</caption>
          <thead>
            <tr className="border-b border-line">
              <td className="px-5 py-3" />
              {channels.map((channel) => {
                const eligible = events.filter((event) => supports(event, channel.id))
                const on = eligible.filter((event) => isOn(event.id, channel.id)).length
                return (
                  <th key={channel.id} scope="col" className="w-20 px-2 py-3 text-center">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <Text as="span" size="label" weight="bold">
                        {channel.label}
                      </Text>
                      <Checkbox
                        boxSize="sm"
                        aria-label={`All ${channel.label} notifications`}
                        checked={eligible.length > 0 && on === eligible.length}
                        indeterminate={on > 0 && on < eligible.length}
                        disabled={eligible.length === 0}
                        onChange={() => setColumn(channel.id, on !== eligible.length)}
                      />
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          {categories.map((category) => (
            <tbody key={category}>
              <tr>
                <th scope="rowgroup" colSpan={channels.length + 1} className="bg-surface-sunken px-5 py-2">
                  <Text as="span" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                    {category}
                  </Text>
                </th>
              </tr>
              {events
                .filter((event) => event.category === category)
                .map((event) => (
                  <tr key={event.id} className="border-t border-line first:border-t-0">
                    <th scope="row" className="px-5 py-3 font-normal">
                      <Text as="span" size="body" className="block">
                        {event.label}
                      </Text>
                      {event.description && (
                        <Text as="span" size="caption" tone="faint" className="mt-1 block">
                          {event.description}
                        </Text>
                      )}
                    </th>
                    {channels.map((channel) => (
                      <td key={channel.id} className="px-2 py-3 text-center">
                        {supports(event, channel.id) ? (
                          <Checkbox
                            aria-label={`${channel.label} for ${event.label}`}
                            checked={isOn(event.id, channel.id)}
                            onChange={(change) => set(event.id, channel.id, change.target.checked)}
                          />
                        ) : (
                          <Fragment>
                            <span aria-hidden="true" className="text-ink-faint">
                              –
                            </span>
                            <span className="sr-only">{`${channel.label} not available`}</span>
                          </Fragment>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-line p-5 sm:flex-row sm:items-end sm:justify-between">
        <Field label="Email frequency" className="sm:w-64">
          <Select label="Email frequency" value={draftDigest} onValueChange={setDraftDigest} options={DIGESTS} fullWidth />
        </Field>
        <div className="flex items-center gap-2">
          {dirty && (
            <Text as="span" size="caption" tone="faint" role="status">
              Unsaved changes
            </Text>
          )}
          <Button
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => {
              setDraft(value)
              setDraftDigest(digest)
            }}
          >
            Discard
          </Button>
          <Button onClick={save} disabled={!dirty} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </Surface>
  )
}
