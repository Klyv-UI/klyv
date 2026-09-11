import type { IconComponent } from '../../lib/types'

/**
 * Glyphs the library draws for itself.
 *
 * Components that need a chevron, a cross or a tick cannot take one as
 * a prop — the glyph is part of the control, not content. Drawing them here
 * keeps the library free of an icon-package dependency, and keeps these few
 * shapes consistent with each other.
 *
 * Anything that is genuinely content still arrives through an `icon` prop.
 */
function make(path: React.ReactNode, viewBox = '0 0 16 16'): IconComponent {
  return function Glyph({ size = 16, strokeWidth = 2.25, className, ...rest }) {
    return (
      <svg
        viewBox={viewBox}
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...rest}
      >
        {path}
      </svg>
    )
  }
}

export const CrossIcon = make(<path d="M4 4l8 8M12 4l-8 8" />)
export const ChevronDownIcon = make(<path d="M4 6l4 4 4-4" />)
export const ChevronUpIcon = make(<path d="M12 10L8 6l-4 4" />)
export const ChevronLeftIcon = make(<path d="M10 3.5L5.5 8l4.5 4.5" />)
export const ChevronRightIcon = make(<path d="M6 3.5L10.5 8 6 12.5" />)
export const CheckIcon = make(<path d="M3 8.5l3.5 3.5L13 5" />)
export const CopyIcon = make(
  <>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.75" />
    <path d="M10.5 3.5v-.25A1.75 1.75 0 008.75 1.5h-5.5A1.75 1.75 0 001.5 3.25v5.5a1.75 1.75 0 001.75 1.75h.25" />
  </>,
)
export const PencilIcon = make(<path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z" />)
export const SearchIcon = make(
  <>
    <circle cx="7.25" cy="7.25" r="4.25" />
    <path d="M10.5 10.5L13.5 13.5" />
  </>,
)
export const EyeIcon = make(
  <>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </>,
)
export const EyeOffIcon = make(
  <>
    <path d="M6.2 3.7A6.6 6.6 0 018 3.5C12 3.5 14.5 8 14.5 8a11 11 0 01-2.2 2.7M9.8 12.3a6.6 6.6 0 01-1.8.2C4 12.5 1.5 8 1.5 8a11 11 0 012.4-2.9" />
    <path d="M2 2l12 12" />
  </>,
)
export const PlusIcon = make(<path d="M8 3.5v9M3.5 8h9" />)
export const MinusIcon = make(<path d="M3.5 8h9" />)
export const AlertIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.4v.2" />
  </>,
  '0 0 24 24',
)
export const StarIcon: IconComponent = function StarIcon({ size = 16, className, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95L12 2.6z" />
    </svg>
  )
}
