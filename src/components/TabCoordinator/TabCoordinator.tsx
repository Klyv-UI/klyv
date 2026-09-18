'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { Input } from '../Input'

/** How this browser lets tabs agree on a leader. */
export type TabCoordinatorMechanism = 'locks' | 'storage' | 'none'

export interface TabCoordinatorLeader {
  /** This tab holds the leadership. */
  isLeader: boolean
  /** A random id for this tab, stable for its lifetime. */
  tabId: string
  /** `locks` is the Web Locks API; `storage` a localStorage heartbeat; `none` means this tab is alone. */
  mechanism: TabCoordinatorMechanism
}

export interface TabCoordinatorLeaderOptions {
  /** Runs when this tab becomes the leader. Return a cleanup to run when it stops being one. */
  onAcquire?: () => void | (() => void)
  /** Set false to stand aside from the election. */
  enabled?: boolean
}

export interface TabCoordinatorMessage<T = unknown> {
  from: string
  data: T
  at: number
  /** Sent by this tab — a channel does not echo, so these are recorded locally. */
  own: boolean
}

export interface TabCoordinatorMessagesOptions<T> {
  /** Called for every message from another tab. */
  onMessage?: (message: TabCoordinatorMessage<T>) => void
  /** How many recent messages to keep in the returned list. 0 keeps none. */
  keep?: number
}

const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)

const HEARTBEAT = 1000
const EXPIRES = 3500

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Exactly one tab of the app is the leader. With the Web Locks API the tab
 * holds an exclusive lock for as long as it is open, and the browser hands it
 * to a waiting tab the moment the holder closes or crashes. Without it, tabs
 * keep a heartbeat in localStorage and a stale one is taken over.
 */
export function useTabLeader(name = 'klyv', { onAcquire, enabled = true }: TabCoordinatorLeaderOptions = {}): TabCoordinatorLeader {
  const [isLeader, setLeader] = useState(false)
  const [mechanism, setMechanism] = useState<TabCoordinatorMechanism>('none')
  const acquire = useRef(onAcquire)
  acquire.current = onAcquire

  useEffect(() => {
    if (!enabled) return
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    if (locks?.request) {
      setMechanism('locks')
      const controller = new AbortController()
      let release: (() => void) | undefined
      locks
        .request(`klyv-tab-leader:${name}`, { signal: controller.signal }, () => {
          setLeader(true)
          return new Promise<void>((resolve) => (release = resolve))
        })
        .catch(() => {})
      return () => {
        controller.abort()
        release?.()
        setLeader(false)
      }
    }

    const store = storage()
    if (!store) {
      setMechanism('none')
      setLeader(true)
      return () => setLeader(false)
    }
    setMechanism('storage')
    const key = `klyv-tab-leader:${name}`
    const read = (): { id: string; ts: number } | null => {
      try {
        return JSON.parse(store.getItem(key) ?? 'null')
      } catch {
        return null
      }
    }
    let confirm: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const current = read()
      if (!current || current.id === TAB_ID || Date.now() - current.ts > EXPIRES) {
        store.setItem(key, JSON.stringify({ id: TAB_ID, ts: Date.now() }))
        // Two tabs can claim in the same instant; the later write wins, so
        // only believe the claim once it has survived a moment.
        clearTimeout(confirm)
        confirm = setTimeout(() => setLeader(read()?.id === TAB_ID), 60)
      } else setLeader(false)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === key && event.newValue === null) tick()
    }
    const resign = () => {
      if (read()?.id === TAB_ID) store.removeItem(key)
    }
    tick()
    const timer = setInterval(tick, HEARTBEAT)
    window.addEventListener('storage', onStorage)
    window.addEventListener('pagehide', resign)
    return () => {
      clearInterval(timer)
      clearTimeout(confirm)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pagehide', resign)
      resign()
      setLeader(false)
    }
  }, [name, enabled])

  useEffect(() => {
    if (!isLeader) return
    const cleanup = acquire.current?.()
    return typeof cleanup === 'function' ? cleanup : undefined
  }, [isLeader])

  return { isLeader, tabId: TAB_ID, mechanism }
}

/**
 * A message bus between the tabs of one origin: BroadcastChannel where it
 * exists, and localStorage events where it does not.
 */
export function useTabMessages<T = unknown>(channel: string, { onMessage, keep = 50 }: TabCoordinatorMessagesOptions<T> = {}) {
  const [messages, setMessages] = useState<TabCoordinatorMessage<T>[]>([])
  const handler = useRef(onMessage)
  handler.current = onMessage
  const send = useRef<(payload: { from: string; data: T; at: number }) => void>(() => {})

  useEffect(() => {
    const receive = (payload: { from: string; data: T; at: number }) => {
      if (!payload || payload.from === TAB_ID) return
      const message = { ...payload, own: false }
      handler.current?.(message)
      if (keep > 0) setMessages((list) => [...list, message].slice(-keep))
    }
    if (typeof BroadcastChannel !== 'undefined') {
      const bus = new BroadcastChannel(`klyv-tab-bus:${channel}`)
      bus.onmessage = (event) => receive(event.data)
      send.current = (payload) => bus.postMessage(payload)
      return () => {
        send.current = () => {}
        bus.close()
      }
    }
    const store = storage()
    if (!store) return
    const key = `klyv-tab-bus:${channel}`
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return
      try {
        receive(JSON.parse(event.newValue))
      } catch {
        /* not ours */
      }
    }
    window.addEventListener('storage', onStorage)
    send.current = (payload) => {
      // A storage event fires only on change, so each message carries a nonce.
      store.setItem(key, JSON.stringify({ ...payload, nonce: Math.random() }))
      store.removeItem(key)
    }
    return () => {
      send.current = () => {}
      window.removeEventListener('storage', onStorage)
    }
  }, [channel, keep])

  const post = (data: T) => {
    const payload = { from: TAB_ID, data, at: Date.now() }
    send.current(payload)
    if (keep > 0) setMessages((list) => [...list, { ...payload, own: true }].slice(-keep))
  }

  return { messages, post, tabId: TAB_ID }
}

export interface TabCoordinatorProps {
  /** The election and channel name. Tabs with the same name coordinate. */
  name?: string
  /** Heading of the panel. */
  label?: string
  /** Runs when this tab becomes the leader; return a cleanup for when it stops. */
  onAcquire?: () => void | (() => void)
  /** Called when this tab gains or loses the leadership. */
  onLeaderChange?: (isLeader: boolean) => void
  /** Merged last, so it wins. */
  className?: string
}

type Presence = { kind: 'hello' | 'here' | 'bye'; leader: boolean }
type LogEntry = { id: number; at: number; text: string; from: string; tone: 'own' | 'peer' | 'system' }

const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * The state of cross-tab coordination, made visible: this tab’s role, the
 * other tabs it can hear, and the messages between them.
 *
 * Opening an app in three tabs usually means three sockets, three pollers and
 * three notification sounds. The fix is to elect one tab to do the work and
 * let the others listen — and this panel is what shows that working, for a
 * settings page or a debugging drawer. The hooks underneath are the real
 * product; use them without the panel.
 */
export function TabCoordinator({ name = 'klyv', label = 'Open tabs', onAcquire, onLeaderChange, className }: TabCoordinatorProps) {
  const uid = useId()
  const { isLeader, tabId, mechanism } = useTabLeader(name, { onAcquire })
  const [peers, setPeers] = useState<Record<string, { leader: boolean; seen: number }>>({})
  const [log, setLog] = useState<LogEntry[]>([])
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const counter = useRef(0)

  const append = (text: string, from: string, tone: LogEntry['tone'], at = Date.now()) =>
    setLog((list) => [...list, { id: ++counter.current, at, text, from, tone }].slice(-40))

  const presence = useTabMessages<Presence>(`${name}:presence`, {
    keep: 0,
    onMessage: ({ from, data }) => {
      if (data.kind === 'bye') {
        setPeers((list) => Object.fromEntries(Object.entries(list).filter(([id]) => id !== from)))
        append(`Tab ${from} closed`, from, 'system')
        return
      }
      if (data.kind === 'hello') {
        append(`Tab ${from} opened`, from, 'system')
        announce.current({ kind: 'here', leader: leaderRef.current })
      }
      setPeers((list) => ({ ...list, [from]: { leader: data.leader, seen: Date.now() } }))
    },
  })
  const bus = useTabMessages<string>(name, { keep: 0, onMessage: ({ from, data, at }) => append(data, from, 'peer', at) })

  const leaderRef = useRef(isLeader)
  leaderRef.current = isLeader
  const announce = useRef(presence.post)
  announce.current = presence.post

  useEffect(() => {
    announce.current({ kind: 'hello', leader: leaderRef.current })
    const beat = setInterval(() => {
      announce.current({ kind: 'here', leader: leaderRef.current })
      const time = Date.now()
      setNow(time)
      setPeers((list) => Object.fromEntries(Object.entries(list).filter(([, peer]) => time - peer.seen < 6000)))
    }, 2000)
    const leave = () => announce.current({ kind: 'bye', leader: false })
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(beat)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [name])

  const changed = useRef(onLeaderChange)
  changed.current = onLeaderChange
  const first = useRef(true)
  useEffect(() => {
    changed.current?.(isLeader)
    announce.current({ kind: 'here', leader: isLeader })
    if (first.current && !isLeader) {
      first.current = false
      return
    }
    first.current = false
    append(isLeader ? 'This tab became the leader' : 'This tab stepped down', tabId, 'system')
  }, [isLeader, tabId])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    bus.post(text)
    append(text, tabId, 'own')
    setDraft('')
  }

  const others = Object.entries(peers)
  const how = { locks: 'Web Locks', storage: 'localStorage heartbeat', none: 'not available — this tab acts alone' }[mechanism]

  return (
    <section aria-labelledby={`${uid}-title`} className={cn('flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h3 id={`${uid}-title`} className="text-[14px] font-bold text-ink">
            {label}
          </h3>
          <p className="text-[12px] font-medium text-ink-faint">Election by {how}</p>
        </div>
        <div className="flex items-center gap-2" role="status">
          <span className="font-mono text-[12px] text-ink-soft">{tabId}</span>
          <Badge tone={isLeader ? 'accent' : 'neutral'}>{isLeader ? 'Leader' : 'Follower'}</Badge>
        </div>
      </header>
      <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
        <div className="border-b border-line p-3 sm:border-b-0 sm:border-r">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Other tabs ({others.length})</h4>
          {others.length === 0 ? (
            <p className="text-[12px] font-medium text-ink-faint">None heard yet. Open this page in another tab.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {others.map(([id, peer]) => (
                <li key={id} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-mono text-ink">{id}</span>
                  <span className={cn('font-semibold', peer.leader ? 'text-accent-strong' : 'text-ink-faint')}>
                    {peer.leader ? 'leader' : `${Math.max(0, Math.round((now - peer.seen) / 1000))}s ago`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <div role="log" aria-label="Messages between tabs" className="h-44 overflow-y-auto p-3">
            <ol className="flex flex-col gap-1">
              {log.length === 0 && <li className="text-[12px] font-medium text-ink-faint">No messages yet.</li>}
              {log.map((entry) => (
                <li key={entry.id} className={cn('flex gap-2 text-[12px]', entry.tone === 'system' ? 'text-ink-faint' : 'text-ink')}>
                  <span className="shrink-0 font-mono tabular-nums text-ink-faint">{clock(entry.at)}</span>
                  {entry.tone !== 'system' && <span className="shrink-0 font-mono text-ink-soft">{entry.tone === 'own' ? 'you' : entry.from}</span>}
                  <span className="min-w-0 break-words font-medium">{entry.text}</span>
                </li>
              ))}
            </ol>
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-line p-2">
            <Input inputSize="sm" aria-label="Message to other tabs" placeholder="Say something to the other tabs" value={draft} onChange={(event) => setDraft(event.target.value)} containerClassName="flex-1" />
            <Button type="submit" size="sm" disabled={!draft.trim()}>
              Send
            </Button>
          </form>
        </div>
      </div>
    </section>
  )
}
