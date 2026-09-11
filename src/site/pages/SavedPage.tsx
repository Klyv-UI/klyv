import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, X } from 'lucide-react'
import { Button, ConfirmDialog, CopyButton, EmptyState, IconButton, InlineEdit, Input, Surface, Text } from 'citrine'
import { Section } from '../components/Doc'
import { ItemCard } from '../components/ItemCard'
import { PageIntro } from '../components/PageIntro'
import { CollectionPicker } from '../components/SaveControls'
import { findItem, itemTypeLabel } from '../data/library'
import { saved, useSaved, type Collection } from '../lib/saved'

/**
 * Favourites and collections, managed in one place.
 *
 * Everything here is kept in this browser; the page says so, and offers the
 * whole state as JSON so nothing saved is ever trapped. Items are stored by
 * id, so an entry for something that has since left the library is shown as
 * missing, with a way to remove it, rather than vanishing.
 */
const selectClass =
  'h-9 w-full rounded-[10px] border border-line bg-surface px-2.5 text-[12px] font-semibold text-ink outline-none transition-colors hover:border-line-strong focus:border-line-strong focus-visible:ring-2 focus-visible:ring-accent'

export default function SavedPage() {
  const state = useSaved()
  const [draft, setDraft] = useState('')

  const create = () => {
    if (!draft.trim()) return
    saved.createCollection(draft)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        title="Saved"
        meta="Kept in this browser. Nothing is sent anywhere."
        actions={
          (state.favorites.length > 0 || state.collections.length > 0) && (
            <CopyButton value={JSON.stringify(state, null, 2)} label="Copy as JSON" />
          )
        }
      >
        Your favourites, and the collections you file them into. Use Favorite and Collect on any component,
        block, template, recipe or integration.
      </PageIntro>

      <Section title="Favorites" description={`${state.favorites.length} saved`}>
        {state.favorites.length === 0 ? (
          <Surface variant="card" padding="lg">
            <EmptyState
              icon={Heart}
              title="Nothing saved yet"
              description="Press Favorite on anything in the library and it appears here."
              action={
                <Button as={Link} to="/components" size="sm" variant="outline">
                  Browse the components
                </Button>
              }
            />
          </Surface>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {state.favorites.map((id) => {
              const item = findItem(id)
              return (
                <li key={id}>
                  {item ? (
                    <ItemCard item={item} headingLevel="h3" footer={<CollectionPicker itemId={item.id} name={item.name} />} />
                  ) : (
                    <MissingItem id={id} onRemove={() => saved.removeFavorite(id)} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Collections" description="Group saved items by project, screen or anything else.">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create()
          }}
          className="flex max-w-[480px] items-center gap-2"
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="SaaS dashboard"
            aria-label="New collection name"
            containerClassName="min-w-0 flex-1"
          />
          <Button type="submit" disabled={!draft.trim()}>
            Create collection
          </Button>
        </form>

        {state.collections.length === 0 ? (
          <Text size="caption" tone="faint">
            No collections yet.
          </Text>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {state.collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                others={state.collections.filter((other) => other.id !== collection.id)}
                favorites={state.favorites}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function MissingItem({ id, onRemove }: { id: string; onRemove: () => void }) {
  return (
    <Surface variant="tile" padding="md" className="h-full flex-row items-start justify-between gap-2">
      <div className="flex flex-col gap-0.5">
        <Text size="caption" weight="bold">
          No longer in the library
        </Text>
        <Text size="micro" tone="faint" className="font-mono">
          {id}
        </Text>
      </div>
      <IconButton icon={X} label={`Remove ${id}`} size="sm" tone="bare" onClick={onRemove} />
    </Surface>
  )
}

function CollectionCard({
  collection,
  others,
  favorites,
}: {
  collection: Collection
  others: Collection[]
  favorites: string[]
}) {
  const [confirming, setConfirming] = useState(false)
  const addId = useId()
  const addable = favorites.filter((id) => !collection.items.includes(id) && findItem(id))

  return (
    <Surface variant="card" padding="lg" className="gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="min-w-0">
            <InlineEdit
              value={collection.name}
              label={`Collection name, ${collection.name}`}
              onSave={(name) => saved.renameCollection(collection.id, name)}
              validate={(name) => (name.trim() ? undefined : 'A collection needs a name.')}
            />
          </h3>
          <Text size="micro" weight="semibold" tone="faint" tabular>
            {collection.items.length} {collection.items.length === 1 ? 'item' : 'items'}
          </Text>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} className="hover:text-danger">
          Delete
        </Button>
      </div>

      {collection.items.length === 0 ? (
        <Text size="caption" tone="faint" leading="normal">
          Empty. Add a favourite below, or press Collect on any item’s page.
        </Text>
      ) : (
        <ul className="flex flex-col">
          {collection.items.map((id) => {
            const item = findItem(id)
            return (
              <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2 last:border-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  {item ? (
                    <Link to={item.to} className="truncate rounded-sm text-[13px] font-bold text-ink hover:underline">
                      {item.name}
                    </Link>
                  ) : (
                    <Text size="caption" weight="bold" tone="faint">
                      No longer in the library
                    </Text>
                  )}
                  <Text size="micro" tone="faint">
                    {item ? itemTypeLabel(item.type) : id}
                  </Text>
                </div>
                {others.length > 0 && (
                  <select
                    aria-label={`Move ${item?.name ?? id} to another collection`}
                    value=""
                    onChange={(event) => event.target.value && saved.moveItem(id, collection.id, event.target.value)}
                    className={`${selectClass} w-auto max-w-[180px]`}
                  >
                    <option value="">Move to…</option>
                    {others.map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                  </select>
                )}
                <IconButton
                  icon={X}
                  label={`Remove ${item?.name ?? id} from ${collection.name}`}
                  size="sm"
                  tone="bare"
                  onClick={() => saved.removeFromCollection(collection.id, id)}
                />
              </li>
            )
          })}
        </ul>
      )}

      {addable.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={addId}>
            <Text as="span" size="caption" weight="semibold" tone="soft">
              Add a favourite
            </Text>
          </label>
          <select
            id={addId}
            value=""
            onChange={(event) => event.target.value && saved.addToCollection(collection.id, event.target.value)}
            className={selectClass}
          >
            <option value="">Choose…</option>
            {addable.map((id) => (
              <option key={id} value={id}>
                {findItem(id)?.name} · {itemTypeLabel(findItem(id)!.type)}
              </option>
            ))}
          </select>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          saved.deleteCollection(collection.id)
          setConfirming(false)
        }}
        title={`Delete “${collection.name}”?`}
        description="Only the collection goes. Everything in it stays in your favourites and in any other collection it is filed in."
        confirmLabel="Delete collection"
        destructive
      />
    </Surface>
  )
}
