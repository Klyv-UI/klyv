'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { InlineMessage } from '../InlineMessage'
import { ConfirmDialog } from '../ConfirmDialog'

export interface DangerAction {
  id: string
  title: string
  description: ReactNode
  /** Button text — "Delete workspace". */
  actionLabel: string
  onConfirm: () => void | Promise<void>
  confirmTitle?: string
  /** Plain text for the dialog body. Defaults to a warning built from the title. */
  confirmDescription?: string
  /** Require this typed exactly — the workspace name, usually. */
  confirmationText?: string
}

export interface DangerZoneProps {
  actions: DangerAction[]
  title?: string
  description?: ReactNode
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * The irreversible actions, gathered at the bottom of a settings page and
 * fenced off from everything else.
 *
 * Each goes through a confirmation that states what will be lost, and the most
 * destructive can require the resource's name typed out. If the action fails,
 * the reason stays on the row that caused it — a toast that fades after four
 * seconds is the wrong place to say why a workspace was not deleted.
 */
export function DangerZone({
  actions,
  title = 'Danger zone',
  description,
  headingLevel: Heading = 'h2',
  className,
}: DangerZoneProps) {
  const [pending, setPending] = useState<DangerAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await pending.onConfirm()
      setErrors(({ [pending.id]: _cleared, ...rest }) => rest)
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [pending.id]: error instanceof Error ? error.message : 'That did not work. Nothing was changed.',
      }))
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-1">
        <Heading className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-danger">{title}</Heading>
        {description && (
          <Text size="label" weight="medium" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>

      <Surface variant="card" className="divide-y divide-line border-danger/40">
        {actions.map((action) => (
          <div key={action.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-col gap-1">
              <Text size="body">{action.title}</Text>
              <Text size="caption" weight="medium" tone="soft" leading="normal">
                {action.description}
              </Text>
              {errors[action.id] && (
                <InlineMessage tone="danger" live className="mt-1">
                  {errors[action.id]}
                </InlineMessage>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPending(action)}
              className="border-danger/40 text-danger hover:bg-danger/10"
            >
              {action.actionLabel}
            </Button>
          </div>
        ))}
      </Surface>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void confirm()}
        destructive
        busy={busy}
        title={pending?.confirmTitle ?? `${pending?.actionLabel ?? ''}?`}
        description={pending?.confirmDescription ?? 'This cannot be undone.'}
        confirmLabel={pending?.actionLabel}
        confirmationText={pending?.confirmationText}
      />
    </section>
  )
}
