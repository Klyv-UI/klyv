import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'

export type DiffKind = 'added' | 'removed' | 'unchanged'

export interface DiffLine {
  kind: DiffKind
  /** Line number on the left side. Omit for added lines. */
  before?: number
  /** Line number on the right side. Omit for removed lines. */
  after?: number
  content: string
}

export interface DiffViewProps {
  lines: DiffLine[]
  /** Labels for the two sides. */
  titles?: [string, string]
  /** Merged last, so it wins. */
  className?: string
}

const ROWS: Record<DiffKind, string> = {
  added: 'bg-accent-soft/40',
  removed: 'bg-danger/10',
  unchanged: '',
}

const MARKS: Record<DiffKind, string> = { added: '+', removed: '-', unchanged: ' ' }

/**
 * A unified diff on the line and surface tokens.
 *
 * Every changed line carries a leading plus or minus as text, not only a
 * background tint — so the change is legible in a screen reader, in print, and
 * to anyone who cannot distinguish the two tints.
 */
export function DiffView({ lines, titles, className }: DiffViewProps) {
  const added = lines.filter((line) => line.kind === 'added').length
  const removed = lines.filter((line) => line.kind === 'removed').length

  return (
    <Surface variant="sunken" className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <Text size="caption" weight="semibold" tone="soft">
          {titles ? `${titles[0]} to ${titles[1]}` : 'Changes'}
        </Text>
        <div className="flex gap-1.5">
          <Tag size="sm" tone="accent">
            +{added}
          </Tag>
          <Tag size="sm">-{removed}</Tag>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
          <caption className="sr-only">
            {added} lines added, {removed} lines removed
          </caption>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className={ROWS[line.kind]}>
                <td className="w-10 select-none px-2 text-right text-ink-faint">
                  {line.before ?? ''}
                </td>
                <td className="w-10 select-none px-2 text-right text-ink-faint">
                  {line.after ?? ''}
                </td>
                <td className="w-4 select-none pl-1 text-ink-soft">{MARKS[line.kind]}</td>
                <td className="whitespace-pre px-2 py-0.5 text-ink-soft">{line.content}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  )
}
