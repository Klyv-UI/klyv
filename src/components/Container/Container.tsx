import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'prose' | 'full'

const SIZES: Record<ContainerSize, string> = {
  sm: 'max-w-[640px]',
  md: 'max-w-[768px]',
  lg: 'max-w-[1024px]',
  xl: 'max-w-[1400px]',
  prose: 'max-w-[72ch]',
  full: 'max-w-none',
}

/** The page gutter. ContainerBleed undoes exactly this, so the two are kept together. */
const GUTTERS = 'px-5 lg:px-8'
const BLEED = '-mx-5 lg:-mx-8'

export interface ContainerOwnProps {
  /** Maximum content width. `xl` matches the site shell; `prose` keeps a comfortable line length. */
  size?: ContainerSize
  /** Side padding that keeps content off the viewport edge — 20px, then 32px from `lg`. */
  gutters?: boolean
  /** The page content. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export type ContainerProps<E extends ElementType = 'div'> = ContainerOwnProps & {
  /** The element to render — `main`, `section`, `header`. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof ContainerOwnProps | 'as'>

/**
 * The centred column a page's content sits in.
 *
 * Every page needs the same three things — a maximum width, auto margins and
 * a gutter that grows on a wider screen — and when each page writes them out
 * the edges stop lining up between the header, the body and the footer. The
 * presets are the widths the site already uses, and the gutter is the site
 * shell's own, so a page built with this aligns with the chrome around it.
 */
export function Container<E extends ElementType = 'div'>({
  as,
  size = 'xl',
  gutters = true,
  children,
  className,
  ...props
}: ContainerProps<E>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component className={cn('mx-auto w-full', SIZES[size], gutters && GUTTERS, className)} {...props}>
      {children}
    </Component>
  )
}

export interface ContainerBleedOwnProps {
  /** Content that should run to the container's outer edge — a full-width image, a scrolling row. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export type ContainerBleedProps<E extends ElementType = 'div'> = ContainerBleedOwnProps & {
  /** The element to render. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof ContainerBleedOwnProps | 'as'>

/**
 * Lets one child ignore the Container's gutters and reach its edge. It
 * cancels the gutter with a matching negative margin, so it only belongs
 * inside a Container that has them.
 */
export function ContainerBleed<E extends ElementType = 'div'>({
  as,
  children,
  className,
  ...props
}: ContainerBleedProps<E>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component className={cn(BLEED, className)} {...props}>
      {children}
    </Component>
  )
}
