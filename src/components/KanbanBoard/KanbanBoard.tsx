'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Card } from '../Card'

export interface KanbanCard {
  id: string
  title: string
  /** Rendered under the title — tags, an avatar, an amount. */
  meta?: ReactNode
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
}

export interface KanbanBoardProps {
  columns: KanbanColumn[]
  onMove: (cardId: string, toColumnId: string, toIndex: number) => void
  /** Accessible name for the board. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Columns of cards that can be moved between them.
 *
 * Dragging is the pointer affordance, but every card also exposes explicit move
 * controls that appear on focus — a board that can only be reordered by drag is
 * unusable by keyboard, and drag-and-drop has no keyboard equivalent of its own.
 */
export function KanbanBoard({ columns, onMove, label, className }: KanbanBoardProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const columnOf = (cardId: string) => columns.find((column) => column.cards.some((card) => card.id === cardId))

  return (
    <div
      role="group"
      aria-label={label}
      // `relative` makes the scroller the containing block for the visually
      // hidden labels inside its cards; without it they escaped the clip and
      // widened the whole page wherever the board was narrower than its columns.
      className={cn('no-scrollbar relative flex gap-3 overflow-x-auto pb-2', className)}
    >
      {columns.map((column) => (
        <section
          key={column.id}
          aria-label={`${column.title}, ${column.cards.length} cards`}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(column.id)
          }}
          onDragLeave={() => setOver((previous) => (previous === column.id ? null : previous))}
          onDrop={() => {
            if (dragging) onMove(dragging, column.id, column.cards.length)
            setDragging(null)
            setOver(null)
          }}
          className={cn(
            'flex w-[260px] shrink-0 flex-col gap-2 rounded-[var(--radius-card)] bg-app p-2.5 transition-colors',
            over === column.id && 'bg-accent-soft/40',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <Text size="caption" weight="bold" tone="soft" className="uppercase tracking-wider">
              {column.title}
            </Text>
            <Badge tone="neutral">{column.cards.length}</Badge>
          </div>

          <ul className="flex flex-col gap-2">
            {column.cards.map((card, index) => {
              const currentIndex = columns.findIndex((entry) => entry.id === column.id)
              return (
                <li key={card.id}>
                  <Card
                    padded={false}
                    className={cn(
                      'group cursor-grab p-3 transition-shadow active:cursor-grabbing',
                      dragging === card.id && 'opacity-50',
                    )}
                  >
                    <div
                      draggable
                      onDragStart={() => setDragging(card.id)}
                      onDragEnd={() => {
                        setDragging(null)
                        setOver(null)
                      }}
                    >
                      <Text truncate>{card.title}</Text>
                      {card.meta && <div className="mt-2">{card.meta}</div>}
                    </div>

                    <div className="mt-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      {currentIndex > 0 && (
                        <MoveButton
                          onClick={() => onMove(card.id, columns[currentIndex - 1].id, index)}
                          label={`Move ${card.title} to ${columns[currentIndex - 1].title}`}
                          glyph="←"
                        />
                      )}
                      {currentIndex < columns.length - 1 && (
                        <MoveButton
                          onClick={() => onMove(card.id, columns[currentIndex + 1].id, index)}
                          label={`Move ${card.title} to ${columns[currentIndex + 1].title}`}
                          glyph="→"
                        />
                      )}
                    </div>
                  </Card>
                </li>
              )
            })}
            {column.cards.length === 0 && (
              <li>
                <Surface variant="tile" padding="md" className="items-center border-dashed">
                  <Text size="caption" tone="faint">
                    Nothing here
                  </Text>
                </Surface>
              </li>
            )}
          </ul>
        </section>
      ))}
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {dragging ? `Moving ${columnOf(dragging)?.title ?? ''}` : ''}
        </span>
      </VisuallyHidden>
    </div>
  )
}

function MoveButton({ onClick, label, glyph }: { onClick: () => void; label: string; glyph: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-ink-soft transition-colors hover:bg-line-strong hover:text-ink"
    >
      <span aria-hidden="true">{glyph}</span>
      <VisuallyHidden>{label}</VisuallyHidden>
    </button>
  )
}
