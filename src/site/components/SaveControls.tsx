import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderPlus, Heart } from 'lucide-react'
import { Button, Checkbox, IconButton, Input, Popover, Text, cn, type IconComponent } from 'klyvui'
import { saved, useIsFavorite, useSaved } from '../lib/saved'

/** Lucide's heart, filled — so "saved" is a shape change, not only a colour. */
const FilledHeart: IconComponent = (props) => <Heart {...props} fill="currentColor" />

/**
 * ♡ Favorite / ♥ Favorited.
 *
 * A toggle button, announced with aria-pressed, so a screen reader hears the
 * state rather than a label that silently changed. Each button subscribes to
 * its own item only, so saving one does not re-render every card on the page.
 */
export function FavoriteButton({
  itemId,
  name,
  variant = 'button',
  className,
}: {
  itemId: string
  name: string
  variant?: 'button' | 'icon'
  className?: string
}) {
  const favorite = useIsFavorite(itemId)
  const toggle = () => saved.toggleFavorite(itemId)

  if (variant === 'icon') {
    return (
      <IconButton
        icon={favorite ? FilledHeart : Heart}
        label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
        aria-pressed={favorite}
        size="sm"
        tone="bare"
        onClick={toggle}
        className={cn(favorite && 'text-accent-strong', className)}
      />
    )
  }

  return (
    <Button size="sm" variant="outline" aria-pressed={favorite} onClick={toggle} className={className}>
      {favorite ? (
        <FilledHeart size={14} aria-hidden className="text-accent-strong" />
      ) : (
        <Heart size={14} aria-hidden />
      )}
      {favorite ? 'Favorited' : 'Favorite'}
    </Button>
  )
}

/**
 * Files an item into collections, or starts a new one with it.
 *
 * Popover positions the panel and closes it on Escape or an outside click;
 * this adds the focus handling a panel of form controls needs — focus moves
 * into it on open and back to the trigger on close — because the panel is
 * portalled to the end of the document, where Tab would never reach it.
 */
export function CollectionPicker({ itemId, name }: { itemId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const { collections } = useSaved()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const inCount = collections.filter((collection) => collection.items.includes(itemId)).length

  useEffect(() => {
    if (!open) return
    // A timeout rather than a frame: frames do not run in a background tab,
    // and focus has to land whether or not the page is being painted. The
    // panel starts off-screen while Popover measures it, so no scrolling.
    const timer = window.setTimeout(() =>
      panelRef.current?.querySelector<HTMLElement>('input, button, a')?.focus({ preventScroll: true }),
    )
    return () => window.clearTimeout(timer)
  }, [open])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) triggerRef.current?.querySelector('button')?.focus()
  }

  const create = () => {
    if (!draft.trim()) return
    saved.createCollection(draft, [itemId])
    setDraft('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      label={`Collections for ${name}`}
      className="w-[272px] p-3"
      trigger={
        <span ref={triggerRef} className="inline-flex">
          <Button size="sm" variant="outline" aria-expanded={open} aria-haspopup="dialog">
            <FolderPlus size={14} aria-hidden />
            {inCount > 0 ? `In ${inCount}` : 'Collect'}
          </Button>
        </span>
      }
    >
      <div ref={panelRef} className="flex flex-col gap-3">
        <Text size="caption" weight="bold">
          Add {name} to a collection
        </Text>

        {collections.length === 0 ? (
          <Text size="caption" tone="faint" leading="normal">
            No collections yet. Name one below and {name} goes straight in.
          </Text>
        ) : (
          <ul className="-mx-1 flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
            {collections.map((collection) => {
              const inside = collection.items.includes(itemId)
              return (
                <li key={collection.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-surface-muted">
                    <Checkbox
                      boxSize="sm"
                      checked={inside}
                      onChange={() =>
                        inside
                          ? saved.removeFromCollection(collection.id, itemId)
                          : saved.addToCollection(collection.id, itemId)
                      }
                    />
                    <Text as="span" size="caption" weight="semibold" truncate className="min-w-0 flex-1">
                      {collection.name}
                    </Text>
                    <Text as="span" size="micro" weight="semibold" tone="faint" tabular>
                      {collection.items.length}
                    </Text>
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            create()
          }}
          className="flex items-center gap-1.5 border-t border-line pt-3"
        >
          <Input
            inputSize="sm"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="New collection"
            aria-label="New collection name"
            containerClassName="min-w-0 flex-1"
          />
          <Button size="sm" variant="muted" type="submit" disabled={!draft.trim()}>
            Create
          </Button>
        </form>

        <Link
          to="/saved"
          onClick={() => setOpen(false)}
          className="w-fit rounded-md text-[11.5px] font-bold text-ink-faint transition-colors hover:text-ink"
        >
          Manage saved items
        </Link>
      </div>
    </Popover>
  )
}

/** Both, as they sit beside a page title. */
export function SaveControls({ itemId, name }: { itemId: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <FavoriteButton itemId={itemId} name={name} />
      <CollectionPicker itemId={itemId} name={name} />
    </div>
  )
}
