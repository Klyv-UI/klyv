'use client'

import { useId, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { IconButton } from '../IconButton'
import { InlineMessage } from '../InlineMessage'
import { Input } from '../Input'
import { Surface } from '../Surface'
import { Switch } from '../Switch'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { CrossIcon } from '../internal/icons'

export interface IpAllowlistEntry {
  id: string
  /** An address or CIDR range — 203.0.113.7, 10.0.0.0/8, 2001:db8::/32. */
  value: string
  /** What it is — “Office VPN”. */
  label?: string
}

export interface IpAllowlistProps {
  /** Controlled list. */
  entries?: IpAllowlistEntry[]
  /** Starting list when uncontrolled. */
  defaultEntries?: IpAllowlistEntry[]
  onEntriesChange?: (entries: IpAllowlistEntry[]) => void
  /** Controlled enforcement. */
  enabled?: boolean
  /** Starting enforcement when uncontrolled. */
  defaultEnabled?: boolean
  onEnabledChange?: (enabled: boolean) => void
  /** The address this admin is connecting from, used to warn before they lock themselves out. */
  currentIp?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Parsed {
  version: 4 | 6
  bytes: number[]
  prefix: number
}

const parseV4 = (text: string) => {
  const parts = text.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null
  return parts.map(Number)
}

const parseV6 = (text: string) => {
  if (!/^[0-9a-fA-F:]+$/.test(text) || (text.match(/::/g) ?? []).length > 1) return null
  const [head, tail] = text.includes('::') ? text.split('::') : [text, undefined]
  const groups = (side: string) => (side ? side.split(':') : [])
  const left = groups(head)
  const right = tail === undefined ? [] : groups(tail)
  if ([...left, ...right].some((group) => !/^[0-9a-fA-F]{1,4}$/.test(group))) return null
  const missing = 8 - left.length - right.length
  if (tail === undefined ? missing !== 0 : missing < 1) return null
  const all = [...left, ...Array(tail === undefined ? 0 : missing).fill('0'), ...right].map((group) => parseInt(group, 16))
  return all.flatMap((group) => [group >> 8, group & 255])
}

/** An address or CIDR range, or null when it is neither. */
const parse = (input: string): Parsed | null => {
  const [address, prefixText, extra] = input.trim().split('/')
  if (extra !== undefined || !address) return null
  const v4 = parseV4(address)
  const bytes = v4 ?? parseV6(address)
  if (!bytes) return null
  const max = v4 ? 32 : 128
  if (prefixText !== undefined && !/^\d{1,3}$/.test(prefixText)) return null
  const prefix = prefixText === undefined ? max : Number(prefixText)
  if (prefix > max) return null
  return { version: v4 ? 4 : 6, bytes, prefix }
}

const masked = ({ bytes, prefix }: Parsed) =>
  bytes.map((byte, index) => {
    const bits = Math.max(0, Math.min(8, prefix - index * 8))
    return byte & ((0xff << (8 - bits)) & 0xff)
  })

const format = (parsed: Parsed) => {
  const bytes = masked(parsed)
  const max = parsed.version === 4 ? 32 : 128
  const suffix = parsed.prefix === max ? '' : `/${parsed.prefix}`
  if (parsed.version === 4) return `${bytes.join('.')}${suffix}`
  const groups = Array.from({ length: 8 }, (_, index) => ((bytes[index * 2] << 8) | bytes[index * 2 + 1]).toString(16))
  // Collapse the longest run of zero groups, as addresses are conventionally written.
  let best = { start: -1, length: 0 }
  for (let start = 0; start < 8; start += 1) {
    let length = 0
    while (start + length < 8 && groups[start + length] === '0') length += 1
    if (length > best.length && length > 1) best = { start, length }
  }
  const text =
    best.start < 0
      ? groups.join(':')
      : `${groups.slice(0, best.start).join(':')}::${groups.slice(best.start + best.length).join(':')}`
  return `${text}${suffix}`
}

const covers = (range: Parsed, address: Parsed) =>
  range.version === address.version &&
  masked(range).every((byte, index) => byte === masked({ ...address, prefix: range.prefix })[index])

/**
 * Restrict sign-in to known networks, without locking out the admin doing it.
 *
 * An IP allowlist is a setting whose most common failure is self-inflicted:
 * enforcement goes on, the admin’s own address is not on the list, and the next
 * request is refused. So the admin’s current IP is taken as a prop and checked
 * against every change. While enforcement is on and that address is not covered,
 * a warning says so with a one-click fix; turning enforcement on offers to add
 * it first; and removing the entry that covers it asks before doing so.
 *
 * Addresses are validated as IPv4 or IPv6, with or without a CIDR prefix, and
 * stored in canonical form — a range typed with host bits set is written as the
 * network it actually matches, so the list shows what is enforced rather than
 * what was typed.
 */
export function IpAllowlist({
  entries: controlledEntries,
  defaultEntries = [],
  onEntriesChange,
  enabled: controlledEnabled,
  defaultEnabled = false,
  onEnabledChange,
  currentIp,
  className,
}: IpAllowlistProps) {
  const id = useId()
  const [ownEntries, setOwnEntries] = useState(defaultEntries)
  const [ownEnabled, setOwnEnabled] = useState(defaultEnabled)
  const entries = controlledEntries ?? ownEntries
  const enabled = controlledEnabled ?? ownEnabled
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'enable' | 'disable' } | { kind: 'remove'; entry: IpAllowlistEntry } | null>(null)

  const current = currentIp ? parse(currentIp) : null
  const isCovered = (list: IpAllowlistEntry[]) =>
    !current || list.some((entry) => {
      const range = parse(entry.value)
      return range ? covers(range, current) : false
    })
  const covered = isCovered(entries)

  const setEntries = (next: IpAllowlistEntry[]) => {
    if (controlledEntries === undefined) setOwnEntries(next)
    onEntriesChange?.(next)
  }
  const setEnabled = (next: boolean) => {
    if (controlledEnabled === undefined) setOwnEnabled(next)
    onEnabledChange?.(next)
  }
  const makeEntry = (value: string, entryLabel?: string): IpAllowlistEntry => ({
    id: `ip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    value,
    label: entryLabel || undefined,
  })
  const withCurrent = () => (current && !covered ? [...entries, makeEntry(format(current), 'Your current IP')] : entries)

  const add = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parse(address)
    if (!parsed) {
      setError('Enter an IPv4 or IPv6 address, optionally with a CIDR prefix such as /24.')
      return
    }
    const value = format(parsed)
    if (entries.some((entry) => entry.value === value)) {
      setError(`${value} is already on the list.`)
      return
    }
    setEntries([...entries, makeEntry(value, label.trim())])
    setAddress('')
    setLabel('')
    setError(null)
  }

  const preview = parse(address)
  const normalised = preview ? format(preview) : null
  const removeLocksOut = (entry: IpAllowlistEntry) => enabled && covered && !isCovered(entries.filter((item) => item.id !== entry.id))

  return (
    <Surface variant="card" className={cn('flex w-full flex-col', className)}>
      <div className="flex items-start justify-between gap-6 border-b border-line p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-enforce`} className="text-[14px] font-bold text-ink">
            Restrict access by IP address
          </label>
          <Text size="label" tone="soft" leading="normal">
            {enabled
              ? 'Only requests from the addresses below can sign in or use the API.'
              : 'Off — members can sign in from any network.'}
          </Text>
        </div>
        <Switch
          id={`${id}-enforce`}
          checked={enabled}
          disabled={!enabled && entries.length === 0 && !current}
          onChange={() => setConfirm({ kind: enabled ? 'disable' : 'enable' })}
        />
      </div>

      {enabled && !covered && currentIp && (
        <div className="flex flex-col gap-2 border-b border-line bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <InlineMessage tone="danger" live>
            {`Your current IP, ${currentIp}, is not on the list. You will be locked out when this session ends.`}
          </InlineMessage>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEntries(withCurrent())}>
            Add my IP
          </Button>
        </div>
      )}

      {entries.length > 0 ? (
        <ul className="m-0 flex list-none flex-col divide-y divide-line p-0" aria-label="Allowed addresses">
          {entries.map((entry) => {
            const range = parse(entry.value)
            const yours = Boolean(range && current && covers(range, current))
            return (
              <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="break-all font-mono text-[13px] font-bold text-ink">{entry.value}</span>
                    {range && range.prefix < (range.version === 4 ? 32 : 128) && (
                      <Tag size="sm" tone="neutral">
                        Range
                      </Tag>
                    )}
                    {yours && (
                      <Tag size="sm" tone="accent">
                        Includes you
                      </Tag>
                    )}
                  </span>
                  {entry.label && (
                    <Text as="span" size="caption" tone="faint" truncate>
                      {entry.label}
                    </Text>
                  )}
                </div>
                <IconButton
                  icon={CrossIcon}
                  label={`Remove ${entry.value}`}
                  size="sm"
                  onClick={() => {
                    if (removeLocksOut(entry)) setConfirm({ kind: 'remove', entry })
                    else setEntries(entries.filter((item) => item.id !== entry.id))
                  }}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <Text as="p" size="label" tone="faint" className="px-5 py-6 text-center">
          No addresses yet. Add your office or VPN range below.
        </Text>
      )}

      <form onSubmit={add} noValidate className="flex flex-col gap-2 border-t border-line p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={`${id}-address`} className="text-[12px] font-bold text-ink">
              Address or CIDR range
            </label>
            <Input
              id={`${id}-address`}
              value={address}
              placeholder="203.0.113.0/24"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : normalised && normalised !== address.trim() ? `${id}-normal` : undefined}
              onChange={(change) => {
                setAddress(change.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 sm:w-40">
            <label htmlFor={`${id}-label`} className="text-[12px] font-bold text-ink">
              Label <span className="font-medium text-ink-faint">(optional)</span>
            </label>
            <Input id={`${id}-label`} value={label} placeholder="Office VPN" onChange={(change) => setLabel(change.target.value)} />
          </div>
          <Button type="submit" variant="muted" className="shrink-0">
            Add
          </Button>
        </div>
        {error ? (
          <InlineMessage tone="danger" id={`${id}-error`}>
            {error}
          </InlineMessage>
        ) : (
          normalised &&
          normalised !== address.trim() && (
            <InlineMessage tone="hint" id={`${id}-normal`}>
              {`Will be saved as ${normalised}`}
            </InlineMessage>
          )
        )}
        {current && !covered && preview && current.version === preview.version && !covers(preview, current) && (
          <InlineMessage tone="warning">{`This does not include your current IP, ${currentIp}.`}</InlineMessage>
        )}
      </form>

      <ConfirmDialog
        open={confirm?.kind === 'enable'}
        onClose={() => setConfirm(null)}
        title="Turn on IP restrictions?"
        description={
          covered
            ? `Sign-in and API access will be refused from any address not on the list. ${currentIp ? `Your current IP, ${currentIp}, is included.` : ''}`.trim()
            : `Your current IP, ${currentIp}, is not on the list, so you would be locked out. It will be added before restrictions turn on.`
        }
        confirmLabel={covered ? 'Turn on' : 'Add my IP and turn on'}
        onConfirm={() => {
          setEntries(withCurrent())
          setEnabled(true)
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'disable'}
        onClose={() => setConfirm(null)}
        title="Turn off IP restrictions?"
        description="Members will be able to sign in and use the API from any network. The list is kept for when you turn it back on."
        confirmLabel="Turn off"
        destructive
        onConfirm={() => {
          setEnabled(false)
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'remove'}
        onClose={() => setConfirm(null)}
        title="Remove the entry that includes you?"
        description={`${confirm?.kind === 'remove' ? confirm.entry.value : ''} covers your current IP, ${currentIp}. Without it you will be locked out when this session ends.`}
        confirmLabel="Remove anyway"
        destructive
        onConfirm={() => {
          if (confirm?.kind === 'remove') setEntries(entries.filter((item) => item.id !== confirm.entry.id))
          setConfirm(null)
        }}
      />
    </Surface>
  )
}
