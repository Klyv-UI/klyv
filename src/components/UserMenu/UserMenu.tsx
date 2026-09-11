'use client'

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Avatar } from '../Avatar'
import { Divider } from '../Divider'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { Popover } from '../Popover'
import { ChevronDownIcon } from '../internal/icons'
import { useRovingFocus } from '../../lib/roving'

export interface UserMenuItem {
  id: string
  label: string
  icon?: IconComponent
  /** Right-aligned hint — a shortcut, a count. */
  meta?: ReactNode
  /** Render as a link. */
  href?: string
  onSelect?: () => void
}

export interface UserMenuProps {
  name: string
  email?: string
  avatarSrc?: string
  /** Plan or role shown beside the name — "Admin", "Pro". */
  badge?: string
  items: (UserMenuItem | 'separator')[]
  onSignOut?: () => void
  signOutLabel?: string
  /** Show the name beside the avatar in the trigger. */
  showName?: boolean
  className?: string
}

/**
 * The account menu behind the avatar: who is signed in, their settings, and the
 * way out.
 *
 * The identity header is not a menu item — it is who you are, not something to
 * do — so it sits above the `menu` rather than inside it, and the email is
 * there because "which account am I in?" is the most common reason to open it.
 * Sign out is always last and always present when offered; hiding it in a
 * submenu is a small dark pattern.
 */
export function UserMenu({
  name,
  email,
  avatarSrc,
  badge,
  items,
  onSignOut,
  signOutLabel = 'Sign out',
  showName = false,
  className,
}: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const actions: UserMenuItem[] = [
    ...items.filter((item): item is UserMenuItem => item !== 'separator'),
    ...(onSignOut ? [{ id: '__sign-out', label: signOutLabel, onSelect: onSignOut }] : []),
  ]
  const roving = useRovingFocus(actions.length)

  useEffect(() => {
    // The portalled menu exists by now; see WorkspaceSwitcher for why no frame.
    if (open) roving.focus(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const renderItem = (item: UserMenuItem, destructive = false) => {
    const index = actions.indexOf(item)
    const Icon = item.icon
    const style = cn(
      'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold outline-none transition-colors',
      destructive
        ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10'
        : 'text-ink hover:bg-surface-muted focus-visible:bg-surface-muted',
    )
    const content = (
      <>
        {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink-soft" />}
        <span className="flex-1">{item.label}</span>
        {item.meta && <span className="text-[11px] font-semibold text-ink-faint">{item.meta}</span>}
      </>
    )
    const common = {
      ref: roving.register(index),
      role: 'menuitem',
      tabIndex: index === roving.active ? 0 : -1,
      className: style,
      onClick: () => {
        item.onSelect?.()
        close()
      },
    }
    return item.href ? (
      <a href={item.href} {...common}>
        {content}
      </a>
    ) : (
      <button type="button" {...common}>
        {content}
      </button>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      label="Account"
      align="end"
      className="w-[min(280px,calc(100vw-24px))] p-1.5"
      trigger={
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={showName ? undefined : `Account menu for ${name}`}
          className={cn(
            'inline-flex items-center gap-2 rounded-full transition-colors',
            showName && 'py-1 pl-1 pr-2.5 hover:bg-surface-muted',
            className,
          )}
        >
          <Avatar name={name} src={avatarSrc} size="sm" />
          {showName && (
            <>
              <Text as="span" size="label" weight="bold" className="hidden sm:inline">
                {name}
              </Text>
              <ChevronDownIcon size={13} className="text-ink-faint" />
            </>
          )}
        </button>
      }
    >
      <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
        <Avatar name={name} src={avatarSrc} size="md" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Text as="span" size="body" truncate>
              {name}
            </Text>
            {badge && (
              <Tag size="sm" tone="accent">
                {badge}
              </Tag>
            )}
          </div>
          {email && (
            <Text as="span" size="caption" tone="faint" truncate>
              {email}
            </Text>
          )}
        </div>
      </div>
      <Divider />
      <div role="menu" aria-label="Account" onKeyDown={roving.onKeyDown} className="flex flex-col pt-1.5">
        {items.map((item, index) =>
          item === 'separator' ? (
            <Divider key={`separator-${index}`} className="my-1.5" />
          ) : (
            <Fragment key={item.id}>{renderItem(item)}</Fragment>
          ),
        )}
        {onSignOut && (
          <>
            <Divider className="my-1.5" />
            {renderItem(actions[actions.length - 1]!, true)}
          </>
        )}
      </div>
    </Popover>
  )
}
