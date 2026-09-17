'use client'

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { Kbd } from '../Kbd'
import { Modal } from '../Modal'
import { Text } from '../Text'
import { SearchIcon } from '../internal/icons'

export interface KeyboardShortcutsDialogShortcut {
  /** What the shortcut does — “Open command palette”. */
  label: string
  /**
   * Keys pressed together, in order. `mod` becomes ⌘ on Apple devices and Ctrl
   * elsewhere; `alt`, `shift`, `enter`, arrows and `esc` get their platform glyphs.
   */
  keys: string[]
  /** Press the keys one after another (“G then I”) rather than together. */
  sequence?: boolean
}

export interface KeyboardShortcutsDialogGroup {
  /** The area of the product — “Navigation”, “Editor”. */
  title: string
  shortcuts: KeyboardShortcutsDialogShortcut[]
}

export type KeyboardShortcutsDialogPlatform = 'auto' | 'mac' | 'other'

export interface KeyboardShortcutsDialogProps {
  /** Shortcuts, grouped by area. */
  groups: KeyboardShortcutsDialogGroup[]
  /** Whether the dialog is showing. Omit to let the component manage it. */
  open?: boolean
  /** Starting state when uncontrolled. */
  defaultOpen?: boolean
  /** Called whenever the dialog asks to open or close. */
  onOpenChange?: (open: boolean) => void
  /** The key that opens the dialog from anywhere on the page. `false` turns it off. */
  hotkey?: string | false
  /** Which modifier glyphs to show. `auto` reads the device. */
  platform?: KeyboardShortcutsDialogPlatform
  /** Visible title. */
  title?: string
  /** Show the filter field. */
  searchable?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const GLYPHS: Record<string, { mac: string; other: string; spoken: string }> = {
  mod: { mac: '⌘', other: 'Ctrl', spoken: 'Command' },
  ctrl: { mac: '⌃', other: 'Ctrl', spoken: 'Control' },
  alt: { mac: '⌥', other: 'Alt', spoken: 'Option' },
  shift: { mac: '⇧', other: 'Shift', spoken: 'Shift' },
  enter: { mac: '↵', other: 'Enter', spoken: 'Enter' },
  esc: { mac: 'Esc', other: 'Esc', spoken: 'Escape' },
  up: { mac: '↑', other: '↑', spoken: 'Up arrow' },
  down: { mac: '↓', other: '↓', spoken: 'Down arrow' },
  left: { mac: '←', other: '←', spoken: 'Left arrow' },
  right: { mac: '→', other: '→', spoken: 'Right arrow' },
  backspace: { mac: '⌫', other: 'Backspace', spoken: 'Backspace' },
}

function describeKey(key: string, mac: boolean) {
  const known = GLYPHS[key.toLowerCase()]
  if (!known) return { shown: key.length === 1 ? key.toUpperCase() : key, spoken: key.length === 1 ? key.toUpperCase() : key }
  // On other platforms "mod" is read as Control, not Command.
  const spoken = !mac && key.toLowerCase() === 'mod' ? 'Control' : !mac && key.toLowerCase() === 'alt' ? 'Alt' : known.spoken
  return { shown: mac ? known.mac : known.other, spoken }
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * Every shortcut in the product, on one screen, opened with “?” the way most
 * web apps have taught people to expect.
 *
 * Keys are written once as `mod+k` and drawn for the device reading them — ⌘
 * on a Mac, Ctrl on Windows — because a list that says ⌘ to a Windows user is
 * a list they cannot use. Each glyph also carries its spoken name, since a
 * screen reader reads “⌘” as nothing at all. The hotkey ignores presses made
 * while typing, so a question mark in a comment never opens a dialog.
 */
export function KeyboardShortcutsDialog({
  groups,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  hotkey = '?',
  platform = 'auto',
  title = 'Keyboard shortcuts',
  searchable = true,
  className,
}: KeyboardShortcutsDialogProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const open = openProp ?? ownOpen
  const [query, setQuery] = useState('')
  const [detectedMac, setDetectedMac] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchId = useId()

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next)
    if (!next) setQuery('')
  }
  const setOpenRef = useRef(setOpen)
  setOpenRef.current = setOpen

  // Read after mount so the server and the first client render agree.
  useEffect(() => {
    setDetectedMac(typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform))
  }, [])
  const mac = platform === 'auto' ? detectedMac : platform === 'mac'

  useEffect(() => {
    if (!hotkey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== hotkey || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      event.preventDefault()
      setOpenRef.current(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [hotkey])

  // The dialog's focus trap lands on its first control, the close button, once
  // mounted. The filter is what someone opening this list wants, so it takes
  // focus a frame later.
  useEffect(() => {
    if (!open || !searchable) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open, searchable])

  const needle = query.trim().toLowerCase()
  const matches = (group: KeyboardShortcutsDialogGroup, shortcut: KeyboardShortcutsDialogShortcut) =>
    !needle ||
    shortcut.label.toLowerCase().includes(needle) ||
    group.title.toLowerCase().includes(needle) ||
    shortcut.keys.some((key) => describeKey(key, mac).shown.toLowerCase() === needle || key.toLowerCase() === needle)

  const visible = groups
    .map((group) => ({ ...group, shortcuts: group.shortcuts.filter((shortcut) => matches(group, shortcut)) }))
    .filter((group) => group.shortcuts.length > 0)
  const total = visible.reduce((sum, group) => sum + group.shortcuts.length, 0)

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={title} size="lg" className={cn('gap-4', className)}>
      {searchable && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={searchId} className="sr-only">
            Filter shortcuts
          </label>
          <Input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by action or key"
            leading={<SearchIcon size={15} />}
            autoComplete="off"
          />
          <Text as="p" size="caption" tone="faint" role="status" className={needle ? undefined : 'sr-only'}>
            {total === 1 ? '1 shortcut' : `${total} shortcuts`}
          </Text>
        </div>
      )}

      {visible.length === 0 ? (
        <Text size="body" weight="medium" tone="faint" className="py-8 text-center">
          No shortcut matches “{query.trim()}”.
        </Text>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {visible.map((group) => (
            <section key={group.title} className="flex min-w-0 flex-col gap-2">
              <Text as="h3" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                {group.title}
              </Text>
              <dl className="m-0 flex flex-col divide-y divide-line">
                {group.shortcuts.map((shortcut) => (
                  <div key={`${shortcut.label}-${shortcut.keys.join('+')}`} className="flex items-center justify-between gap-4 py-2">
                    <dt className="min-w-0">
                      <Text as="span" size="body" weight="medium">
                        {shortcut.label}
                      </Text>
                    </dt>
                    <dd className="m-0 flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key, index) => {
                        const { shown, spoken } = describeKey(key, mac)
                        return (
                          <Fragment key={`${key}-${index}`}>
                            {index > 0 && (
                              <Text as="span" size="micro" weight="medium" tone="faint">
                                {shortcut.sequence ? 'then' : <span className="sr-only">plus</span>}
                              </Text>
                            )}
                            <Kbd>
                              <span aria-hidden="true">{shown}</span>
                              <span className="sr-only">{spoken}</span>
                            </Kbd>
                          </Fragment>
                        )
                      })}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      {hotkey && (
        <Text size="caption" tone="faint" className="flex items-center gap-1.5">
          Press <Kbd>{hotkey}</Kbd> anywhere to open this list.
        </Text>
      )}
    </Modal>
  )
}
