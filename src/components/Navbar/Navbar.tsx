'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Avatar, type AvatarProps } from '../Avatar'
import { IconButton } from '../IconButton'
import { StatusDot } from '../StatusDot'
import { Wordmark } from '../Wordmark'
import { SearchField } from '../SearchField'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'
import { Toolbar } from '../Toolbar'
import { CrossIcon, SearchIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface NavbarUtility {
  id: string
  label: string
  icon: IconComponent
  /** Shows an unread marker. */
  badge?: boolean
  onSelect?: () => void
}

export interface NavbarProps<T extends string = string> {
  /** Product name for the lockup. */
  brand: string
  /** Custom mark inside the lockup. */
  brandMark?: ReactNode
  /** Primary sections. Rendered as a SegmentedControl from xl up. */
  sections?: SegmentedOption<T>[]
  value?: T
  onValueChange?: (value: T) => void
  /** Icon cluster on the right. */
  utilities?: NavbarUtility[]
  /** Identity. */
  user?: Pick<AvatarProps, 'name' | 'src'>
  /** Adds an expanding search. */
  searchable?: boolean
  /** Placeholder for the search field. */
  searchPlaceholder?: string
  /** Called as the query changes. */
  onSearch?: (query: string) => void
  /** Opens the mobile navigation. Shown below xl. */
  onOpenMenu?: () => void
  /** Glyph for the menu button shown on narrow viewports. */
  menuIcon?: IconComponent
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The application header: lockup, primary navigation, utilities and identity.
 *
 * Search replaces the utility cluster rather than sitting beside it, which is
 * how the dashboard keeps the header to one row at every width. The nav
 * collapses into a menu trigger below xl.
 */
export function Navbar<T extends string = string>({
  brand,
  brandMark,
  sections,
  value,
  onValueChange,
  utilities = [],
  user,
  searchable = false,
  searchPlaceholder = 'Search',
  onSearch,
  onOpenMenu,
  menuIcon,
  className,
}: NavbarProps<T>) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
    onSearch?.('')
  }

  return (
    <header className={cn('flex h-[76px] shrink-0 items-center gap-4 px-5 lg:px-6', className)}>
      <Wordmark name={brand} mark={brandMark} size="sm" />

      {sections && value !== undefined && onValueChange && (
        <SegmentedControl
          options={sections}
          value={value}
          onValueChange={onValueChange}
          label="Primary"
          className="ml-auto hidden xl:inline-flex"
        />
      )}

      <div className={cn('ml-auto flex items-center gap-2.5 xl:ml-6', searchOpen && 'flex-1')}>
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <SearchField
              value={query}
              onValueChange={(next) => {
                setQuery(next)
                onSearch?.(next)
              }}
              placeholder={searchPlaceholder}
              label="Search"
              containerClassName="min-w-0 flex-1"
            />
            <IconButton icon={CrossIcon} label="Close search" size="sm" onClick={closeSearch} />
          </div>
        ) : (
          (utilities.length > 0 || searchable) && (
            <Toolbar label="Utilities">
              {searchable && (
                <IconButton
                  icon={SearchIcon}
                  label="Search"
                  size="sm"
                  className="text-ink"
                  onClick={() => setSearchOpen(true)}
                />
              )}
              {utilities.map((utility) => (
                <span key={utility.id} className="relative inline-flex">
                  <IconButton
                    icon={utility.icon}
                    label={utility.label}
                    size="sm"
                    className="text-ink"
                    onClick={utility.onSelect}
                  />
                  {utility.badge && (
                    <StatusDot
                      ring
                      label={`${utility.label} has updates`}
                      className="pointer-events-none absolute right-2 top-2"
                    />
                  )}
                </span>
              ))}
            </Toolbar>
          )
        )}

        {user && <Avatar name={user.name} src={user.src} size="md" ring />}

        {onOpenMenu && menuIcon && (
          <IconButton
            icon={menuIcon}
            label="Open menu"
            tone="white"
            onClick={onOpenMenu}
            className="xl:hidden"
          />
        )}
      </div>
    </header>
  )
}
