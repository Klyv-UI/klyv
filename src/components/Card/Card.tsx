import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Text } from '../Text'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Card title. Omit for a card with no header. */
  title?: string
  /** Right-aligned affordance in the header — a link, a button, a menu. */
  action?: ReactNode
  /** Heading level. The visual size never changes; only the semantics do. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  padded?: boolean
  /** The card body, under the title row. */
  children?: ReactNode
}

/**
 * The header shape all six dashboard cards share: a bold title on the left and
 * a quiet action on the right, over a card Surface.
 */
export function Card({
  title,
  action,
  headingLevel = 'h2',
  padded = true,
  children,
  className,
  ...props
}: CardProps) {
  return (
    <Surface variant="card" padding={padded ? 'lg' : 'none'} className={className} {...props}>
      {(title || action) && (
        <CardHeader title={title} action={action} headingLevel={headingLevel} />
      )}
      {children}
    </Surface>
  )
}

export interface CardHeaderProps {
  title?: string
  action?: ReactNode
  headingLevel?: 'h2' | 'h3' | 'h4'
  className?: string
}

/** Usable on its own when a card needs a header inside custom layout. */
export function CardHeader({ title, action, headingLevel = 'h2', className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      {title && (
        <Text as={headingLevel} size="heading" truncate>
          {title}
        </Text>
      )}
      {action}
    </div>
  )
}

/** Pushes itself to the bottom of a card, above any footer. */
export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-auto flex items-center gap-3 pt-3', className)}>{children}</div>
}
