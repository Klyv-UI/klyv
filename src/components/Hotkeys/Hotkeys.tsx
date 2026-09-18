'use client'

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

export interface HotkeysOptions {
  /** Scope the shortcut belongs to. It only fires while that scope is active. */
  scope?: string
  /** Turn the shortcut off without unregistering it from the list. */
  enabled?: boolean
  /** Fire even while an input, textarea, select or contenteditable has focus. */
  allowInInputs?: boolean
  /** What it does — shown by `useRegisteredHotkeys` consumers such as a shortcuts dialog. */
  description?: string
  /** Heading it is listed under — “Navigation”, “Compose”. */
  group?: string
  /** Stop the browser’s own handling of the key. On by default. */
  preventDefault?: boolean
}

export interface HotkeysRegistration {
  id: string
  /** The combo as written — `mod+k`, `g i`. */
  combo: string
  /** Keys in KeyboardShortcutsDialog form: `['mod', 'k']`, or one entry per step of a sequence. */
  keys: string[]
  /** True for a sequence like `g i`, pressed one after another. */
  sequence: boolean
  scope: string
  enabled: boolean
  description?: string
  group?: string
  /** Whether it would fire right now: enabled, and its scope is active. */
  active: boolean
}

export interface HotkeysProps {
  children: ReactNode
  /** Milliseconds allowed between the steps of a sequence. */
  sequenceTimeout?: number
  /** Scopes active from the start, besides `global`. */
  initialScopes?: string[]
  /** Listen only to key presses inside this element rather than the whole document. */
  contained?: boolean
  /** Merged onto the wrapper when `contained`. */
  className?: string
}

export interface HotkeysScopeOptions {
  /** Whether the scope is on. Defaults to true, i.e. for as long as the caller is mounted. */
  active?: boolean
  /** Suspend every scope activated before this one — a modal dialog. */
  exclusive?: boolean
}

interface Chord {
  key: string
  mod: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

interface Entry {
  id: string
  combo: string
  steps: Chord[]
  options: HotkeysOptions
  handler: { current: (event: KeyboardEvent) => void }
  order: number
}

interface ScopeFrame {
  token: string
  scope: string
  exclusive: boolean
}

const ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  plus: '+',
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  option: 'alt',
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

function parseChord(text: string): Chord {
  const chord: Chord = { key: '', mod: false, ctrl: false, meta: false, alt: false, shift: false }
  // `mod++` is mod plus the plus key, so split on a plus that has something after it.
  const parts = text.toLowerCase().split(/\+(?!$)/)
  for (const raw of parts) {
    const part = ALIASES[raw] ?? raw
    if (part === 'mod' || part === 'ctrl' || part === 'meta' || part === 'alt' || part === 'shift') chord[part] = true
    else chord.key = part
  }
  return chord
}

const parseCombo = (combo: string) => combo.trim().split(/\s+/).map(parseChord)

// Letters and digits by position, so Alt+K on a Mac (which types ˚) still reads as K.
const fromCode = (code: string) => (/^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : /^Digit\d$/.test(code) ? code.slice(5) : '')

function matches(chord: Chord, event: KeyboardEvent, mac: boolean) {
  const key = event.key.toLowerCase()
  if (chord.key !== key && chord.key !== fromCode(event.code)) return false
  const wantMeta = chord.meta || (chord.mod && mac)
  const wantCtrl = chord.ctrl || (chord.mod && !mac)
  // A symbol such as ? needs Shift on most layouts; the combo should not have to say so.
  const symbol = chord.key.length === 1 && !/[a-z0-9]/.test(chord.key)
  return (
    event.metaKey === wantMeta &&
    event.ctrlKey === wantCtrl &&
    event.altKey === chord.alt &&
    (symbol && !chord.shift ? true : event.shiftKey === chord.shift)
  )
}

const chordKeys = (chord: Chord) => {
  const keys: string[] = []
  if (chord.mod) keys.push('mod')
  if (chord.ctrl) keys.push('ctrl')
  if (chord.meta) keys.push('meta')
  if (chord.alt) keys.push('alt')
  if (chord.shift) keys.push('shift')
  keys.push(chord.key === ' ' ? 'space' : chord.key === 'escape' ? 'esc' : chord.key.replace(/^arrow/, ''))
  return keys
}

const signature = (steps: Chord[]) => steps.map((step) => chordKeys(step).join('+')).join(' ')

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.getAttribute('role') === 'textbox')

// Read through globalThis: the library ships without Node's types, and a bare
// `process` would not type-check in a browser build.
const isDev = () =>
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production'

class HotkeysStore {
  entries = new Map<string, Entry>()
  scopes: ScopeFrame[] = []
  private listeners = new Set<() => void>()
  private snapshot: HotkeysRegistration[] = []
  private buffer: { event: KeyboardEvent; at: number }[] = []
  private counter = 0
  mac = false
  timeout = 1000

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private emit() {
    const active = this.activeScopes()
    this.snapshot = [...this.entries.values()]
      .sort((a, b) => a.order - b.order)
      .map((entry) => ({
        id: entry.id,
        combo: entry.combo,
        keys: entry.steps.length > 1 ? entry.steps.map((step) => chordKeys(step).join('+')) : chordKeys(entry.steps[0]),
        sequence: entry.steps.length > 1,
        scope: entry.options.scope ?? 'global',
        enabled: entry.options.enabled ?? true,
        description: entry.options.description,
        group: entry.options.group,
        active: (entry.options.enabled ?? true) && active.includes(entry.options.scope ?? 'global'),
      }))
    this.listeners.forEach((listener) => listener())
  }

  /** `global` plus everything activated since the most recent exclusive scope. */
  activeScopes() {
    let start = 0
    this.scopes.forEach((frame, index) => {
      if (frame.exclusive) start = index
    })
    const live = this.scopes.slice(start).map((frame) => frame.scope)
    const exclusive = this.scopes.some((frame) => frame.exclusive)
    return exclusive ? live : ['global', ...live]
  }

  pushScope(frame: ScopeFrame) {
    this.scopes = [...this.scopes, frame]
    this.emit()
  }

  popScope(token: string) {
    this.scopes = this.scopes.filter((frame) => frame.token !== token)
    this.emit()
  }

  set(id: string, combo: string, options: HotkeysOptions, handler: Entry['handler']) {
    const existing = this.entries.get(id)
    const steps = parseCombo(combo)
    const entry: Entry = { id, combo, steps, options, handler, order: existing?.order ?? (this.counter += 1) }
    const changed = !existing || existing.combo !== combo || existing.options.scope !== options.scope
    if (isDev() && changed && (options.enabled ?? true)) {
      const scope = options.scope ?? 'global'
      const sig = signature(steps)
      for (const other of this.entries.values()) {
        if (other.id === id || (other.options.enabled ?? true) === false) continue
        if ((other.options.scope ?? 'global') === scope && signature(other.steps) === sig) {
          console.warn(`[klyv] Hotkey “${combo}” is registered twice in scope “${scope}”. The newer handler wins.`)
        }
      }
    }
    this.entries.set(id, entry)
    this.emit()
  }

  delete(id: string) {
    this.entries.delete(id)
    this.emit()
  }

  handle = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || MODIFIERS.has(event.key)) return
    const now = Date.now()
    this.buffer = [...this.buffer.filter((press) => now - press.at <= this.timeout), { event, at: now }].slice(-4)
    const typing = isTyping(event.target)
    const active = this.activeScopes()

    let best: Entry | null = null
    for (const entry of this.entries.values()) {
      const { enabled = true, allowInInputs = false, scope = 'global' } = entry.options
      if (!enabled || !active.includes(scope) || (typing && !allowInInputs)) continue
      const { steps } = entry
      if (steps.length > this.buffer.length) continue
      const tail = this.buffer.slice(-steps.length)
      if (!steps.every((step, index) => matches(step, tail[index].event, this.mac))) continue
      // Longer sequences beat single keys; among equals, the newest registration wins.
      if (!best || steps.length > best.steps.length || (steps.length === best.steps.length && entry.order > best.order)) {
        best = entry
      }
    }
    if (!best) {
      // A key typed into a field is not the first step of a sequence.
      if (typing) this.buffer = this.buffer.slice(0, -1)
      return
    }
    if (best.options.preventDefault ?? true) event.preventDefault()
    this.buffer = []
    best.handler.current(event)
  }
}

const HotkeysContext = createContext<HotkeysStore | null>(null)

/**
 * One keyboard shortcut registry for the whole app.
 *
 * Shortcuts wired one `keydown` listener at a time collide silently: two
 * components claim `k`, a dialog’s shortcuts keep firing under it, and nobody
 * can list what exists. Here every shortcut registers with `useHotkey`, so the
 * registry knows them all: it resolves `mod` to ⌘ or Ctrl for the device,
 * matches sequences like `g i` within a timeout, ignores keys typed into
 * fields unless asked, and warns in development when a combo is claimed twice
 * in one scope. Scopes let a dialog take over the keyboard while it is open
 * and hand it back when it closes. `useRegisteredHotkeys` reads the live list,
 * so the shortcuts dialog is generated from the shortcuts that actually exist.
 */
export function Hotkeys({ children, sequenceTimeout = 1000, initialScopes = [], contained = false, className }: HotkeysProps) {
  const [store] = useState(() => {
    const created = new HotkeysStore()
    created.scopes = initialScopes.map((scope) => ({ token: `initial-${scope}`, scope, exclusive: false }))
    return created
  })
  store.timeout = sequenceTimeout

  // Read after mount so the server and the first client render agree.
  useEffect(() => {
    store.mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  }, [store])

  useEffect(() => {
    if (contained) return
    document.addEventListener('keydown', store.handle)
    return () => document.removeEventListener('keydown', store.handle)
  }, [store, contained])

  return (
    <HotkeysContext.Provider value={store}>
      {contained ? (
        <div className={className} onKeyDown={(event: ReactKeyboardEvent) => store.handle(event.nativeEvent)}>
          {children}
        </div>
      ) : (
        children
      )}
    </HotkeysContext.Provider>
  )
}

/** The same component under the name most apps look for. */
export const HotkeysProvider = Hotkeys

function useStore(caller: string) {
  const store = useContext(HotkeysContext)
  if (!store && isDev()) console.warn(`[klyv] ${caller} was called outside <Hotkeys>. It does nothing there.`)
  return store
}

/** Register a shortcut for as long as the calling component is mounted. */
export function useHotkey(combo: string, handler: (event: KeyboardEvent) => void, options: HotkeysOptions = {}) {
  const store = useStore('useHotkey')
  const id = useId()
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const { scope, enabled, allowInInputs, description, group, preventDefault } = options

  useEffect(() => {
    if (!store) return
    store.set(id, combo, { scope, enabled, allowInInputs, description, group, preventDefault }, handlerRef)
  }, [store, id, combo, scope, enabled, allowInInputs, description, group, preventDefault])

  useEffect(() => {
    if (!store) return
    return () => store.delete(id)
  }, [store, id])
}

/** Activate a scope while the caller is mounted and `active` is true — a dialog’s own shortcuts. */
export function useHotkeyScope(scope: string, { active = true, exclusive = false }: HotkeysScopeOptions = {}) {
  const store = useStore('useHotkeyScope')
  const token = useId()
  useEffect(() => {
    if (!store || !active) return
    store.pushScope({ token, scope, exclusive })
    return () => store.popScope(token)
  }, [store, token, scope, active, exclusive])
}

const EMPTY: HotkeysRegistration[] = []
const noop = () => () => {}

/** Every registered shortcut, live, in registration order. */
export function useRegisteredHotkeys(): HotkeysRegistration[] {
  const store = useContext(HotkeysContext)
  return useSyncExternalStore(store?.subscribe ?? noop, store?.getSnapshot ?? (() => EMPTY), () => EMPTY)
}

/** The scopes currently able to fire, `global` first unless an exclusive scope suspended it. */
export function useActiveHotkeyScopes(): string[] {
  const list = useRegisteredHotkeys()
  const store = useContext(HotkeysContext)
  return useMemo(() => store?.activeScopes() ?? ['global'], [store, list])
}
