'use client'

import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { Divider } from '../Divider'
import { IconTile } from '../IconTile'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'
import { EmptyState } from '../EmptyState'
import { List } from '../List'
import { ListItem } from '../ListItem'
import { Tabs } from '../Tabs'
import { Drawer } from '../Drawer'
import type { IconComponent } from '../../lib/types'

export type NotificationTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface NotificationEntry {
  id: string
  title: string
  description?: string
  /** Human-readable time, e.g. "4 minutes ago". */
  time: string
  icon?: IconComponent
  tone?: NotificationTone
  read?: boolean
  /** Grouping tab. Entries with no group land under "All" only. */
  group?: string
  onSelect?: () => void
}

export interface NotificationCenterProps {
  /** Whether the panel is showing. */
  open: boolean
  /** Called when the panel is dismissed. */
  onClose: () => void
  notifications: NotificationEntry[]
  onMarkRead: (id: string) => void
  onMarkAllRead?: () => void
  /** Panel title. */
  title?: string
  /** Merged last, so it wins. */
  className?: string
}

const TONE_DOTS: Record<NotificationTone, 'neutral' | 'success' | 'warning' | 'danger'> = {
  neutral: 'neutral',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
}

/**
 * The notification panel behind the bell: grouped into tabs, unread first, with
 * a way to clear the lot.
 *
 * The hard part of this pattern is not the list — it is the unread model. Here
 * unread is explicit state the caller owns, opening an item marks it read, and
 * the unread count is announced through the tab badge rather than by colour, so
 * the state survives being read aloud.
 *
 * It is a Drawer, so it inherits focus trapping, Escape and scroll lock instead
 * of being a floating panel that traps nothing.
 */
export function NotificationCenter({
  open,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  title = 'Notifications',
  className,
}: NotificationCenterProps) {
  const [tab, setTab] = useState('all')

  const groups = useMemo(() => {
    const names = [...new Set(notifications.map((entry) => entry.group).filter(Boolean))] as string[]
    return names
  }, [notifications])

  const unread = notifications.filter((entry) => !entry.read).length

  const forTab = (id: string) =>
    id === 'all'
      ? notifications
      : id === 'unread'
        ? notifications.filter((entry) => !entry.read)
        : notifications.filter((entry) => entry.group === id)

  const renderList = (id: string) => {
    const entries = [...forTab(id)].sort(
      (a, b) => Number(Boolean(a.read)) - Number(Boolean(b.read)),
    )

    if (entries.length === 0) {
      return (
        <EmptyState
          size="sm"
          title={id === 'unread' ? 'Nothing unread' : 'Nothing here'}
          description={
            id === 'unread' ? 'You are all caught up.' : 'New notifications will appear here.'
          }
        />
      )
    }

    return (
      <List label={`${title}, ${id}`}>
        {entries.map((entry) => (
          <ListItem
            key={entry.id}
            highlighted={!entry.read}
            onClick={() => {
              onMarkRead(entry.id)
              entry.onSelect?.()
            }}
            leading={
              <span className="relative">
                {entry.icon ? (
                  <IconTile icon={entry.icon} tone={entry.read ? 'muted' : 'accent'} />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded-[var(--radius-glyph)] bg-surface-muted">
                    <StatusDot tone={TONE_DOTS[entry.tone ?? 'neutral']} size="md" />
                  </span>
                )}
                {!entry.read && (
                  <StatusDot
                    ring
                    label="Unread"
                    className="pointer-events-none absolute -right-0.5 -top-0.5"
                  />
                )}
              </span>
            }
            title={entry.title}
            subtitle={entry.description}
            trailing={
              <Text as="span" size="caption" tone="faint" className="shrink-0">
                {entry.time}
              </Text>
            }
          />
        ))}
      </List>
    )
  }

  const tabs = [
    {
      value: 'all',
      label: 'All',
      badge: <Badge tone="neutral">{notifications.length}</Badge>,
      content: renderList('all'),
    },
    {
      value: 'unread',
      label: 'Unread',
      badge: unread > 0 ? <Badge>{unread}</Badge> : undefined,
      content: renderList('unread'),
    },
    ...groups.map((group) => ({ value: group, label: group, content: renderList(group) })),
  ]

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      title={title}
      className={className}
      footer={
        onMarkAllRead && (
          <div className="flex items-center justify-between gap-3">
            <Text size="caption" tone="faint" role="status" aria-live="polite">
              {unread === 0 ? 'All caught up' : `${unread} unread`}
            </Text>
            <Button variant="ghost" size="sm" disabled={unread === 0} onClick={onMarkAllRead}>
              Mark all read
            </Button>
          </div>
        )
      }
    >
      <div className={cn('flex flex-col gap-2')}>
        <Divider />
        <Tabs
          variant="underline"
          label={`${title} groups`}
          value={tab}
          onValueChange={setTab}
          items={tabs}
        />
      </div>
    </Drawer>
  )
}
