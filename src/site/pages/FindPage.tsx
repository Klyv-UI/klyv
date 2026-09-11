import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, Checkbox, EmptyState, Radio, Stepper, Surface, Tag, Text, cn } from 'citrine'
import { ItemCard } from '../components/ItemCard'
import { PageIntro } from '../components/PageIntro'
import { ITEM_TYPES } from '../data/library'
import { NEEDS, PROJECT_TYPES, tagLabel } from '../data/taxonomy'
import { recommend } from '../lib/recommend'
import { saved } from '../lib/saved'

/**
 * Find My UI: two questions, then what to use.
 *
 * The answers live in the URL, so a result is a link, the back button steps
 * back through the questions, and a refresh does not lose anything. The
 * recommendations come from `recommend()`, which reads only the shared tags —
 * nothing here knows which component suits which product.
 */
const STEPS = [
  { id: 'build', label: 'What are you building?' },
  { id: 'need', label: 'What do you need?' },
  { id: 'results', label: 'Recommended for you' },
]

const STEP_PARAM = ['build', 'needs', 'results'] as const

const choiceCard =
  'flex h-full cursor-pointer items-start gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-3.5 transition-colors hover:border-line-strong has-[:checked]:border-accent-strong has-[:checked]:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent'

export default function FindPage() {
  const [params, setParams] = useSearchParams()
  const project = PROJECT_TYPES.find((entry) => entry.id === params.get('type'))?.id ?? null
  const needs = (params.get('needs') ?? '').split(',').filter((id) => NEEDS.some((need) => need.id === id))
  const needsKey = needs.join(',')
  const requested = STEP_PARAM.indexOf((params.get('step') ?? 'build') as (typeof STEP_PARAM)[number])
  // Never land past a question that has not been answered.
  const step = !project ? 0 : Math.max(0, requested)

  const go = (patch: { type?: string | null; needs?: string[]; step?: number }) => {
    const next = new URLSearchParams(params)
    if (patch.type !== undefined) {
      if (patch.type) next.set('type', patch.type)
      else next.delete('type')
    }
    if (patch.needs !== undefined) {
      if (patch.needs.length) next.set('needs', patch.needs.join(','))
      else next.delete('needs')
    }
    if (patch.step !== undefined) next.set('step', STEP_PARAM[patch.step] ?? 'build')
    setParams(next)
  }

  // Move focus to the new step's heading, so a keyboard or screen reader user
  // lands on the question rather than on a button that has just disappeared.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const toggleNeed = (id: string) =>
    go({ needs: needs.includes(id) ? needs.filter((need) => need !== id) : [...needs, id] })

  const canFinish = needs.length > 0 || (project !== null && project !== 'other')

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title="Find My UI">
        Two questions, then the components, blocks, templates and recipes that fit. The picks come from the
        same tags search uses, so every recommendation says why it is here.
      </PageIntro>

      <Stepper
        steps={STEPS}
        current={step}
        label="Find My UI progress"
        onStepSelect={(index) => index < step && go({ step: index })}
      />

      {step === 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="contents">
            <h2 ref={headingRef} tabIndex={-1} className="outline-none">
              <Text as="span" size="subtitle">
                What are you building?
              </Text>
            </h2>
          </legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {PROJECT_TYPES.map((type) => (
              <label key={type.id} className={choiceCard}>
                <Radio name="project" value={type.id} checked={project === type.id} onChange={() => go({ type: type.id })} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Text as="span" size="body" weight="bold">
                    {type.label}
                  </Text>
                  <Text as="span" size="caption" tone="faint" leading="normal">
                    {type.description}
                  </Text>
                </span>
              </label>
            ))}
          </div>
          <div>
            <Button disabled={!project} onClick={() => go({ step: 1 })}>
              Continue
            </Button>
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="contents">
            <h2 ref={headingRef} tabIndex={-1} className="outline-none">
              <Text as="span" size="subtitle">
                What do you need?
              </Text>
            </h2>
          </legend>
          <Text size="caption" tone="soft">
            Choose as many as apply.
          </Text>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
            {NEEDS.map((need) => (
              <label key={need.id} className={choiceCard}>
                <Checkbox checked={needs.includes(need.id)} onChange={() => toggleNeed(need.id)} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Text as="span" size="body" weight="bold">
                    {need.label}
                  </Text>
                  <Text as="span" size="caption" tone="faint" leading="normal">
                    {need.description}
                  </Text>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => go({ step: 0 })}>
              Back
            </Button>
            <Button disabled={!canFinish} onClick={() => go({ step: 2 })}>
              Show recommendations
            </Button>
            {!canFinish && (
              <Text size="caption" tone="faint">
                Pick at least one need.
              </Text>
            )}
          </div>
        </fieldset>
      )}

      {step === 2 && project && (
        <Results project={project} needsKey={needsKey} headingRef={headingRef} onChange={() => go({ step: 1 })} onRestart={() => setParams({})} />
      )}
    </div>
  )
}

function Results({
  project,
  needsKey,
  headingRef,
  onChange,
  onRestart,
}: {
  project: string
  needsKey: string
  headingRef: React.RefObject<HTMLHeadingElement>
  onChange: () => void
  onRestart: () => void
}) {
  const needs = useMemo(() => (needsKey ? needsKey.split(',') : []), [needsKey])
  const results = useMemo(() => recommend(project, needs), [project, needs])
  const [savedTo, setSavedTo] = useState<string | null>(null)

  const projectType = PROJECT_TYPES.find((entry) => entry.id === project)
  const all = ITEM_TYPES.flatMap((type) => results[type.id])
  const needList = needs.map(tagLabel)
  const summary = [
    `For ${projectType?.phrase ?? 'your project'}`,
    needList.length
      ? ` that needs ${needList.length > 1 ? `${needList.slice(0, -1).join(', ')} and ${needList[needList.length - 1]}` : needList[0]}`
      : '',
  ].join('')

  const saveAll = () => {
    const name = `${projectType && projectType.id !== 'other' ? projectType.label : 'My'} UI`
    saved.createCollection(name, all.map((entry) => entry.item.id))
    setSavedTo(name)
  }

  return (
    <section aria-labelledby="find-results" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="find-results" ref={headingRef} tabIndex={-1} className="outline-none">
            <Text as="span" size="subtitle">
              Recommended for you
            </Text>
          </h2>
          <Text size="caption" tone="soft">
            {summary}. {all.length} picks.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onChange}>
            Change answers
          </Button>
          <Button variant="ghost" size="sm" onClick={onRestart}>
            Start over
          </Button>
          {all.length > 0 && (
            <Button size="sm" onClick={saveAll} disabled={savedTo !== null}>
              Save all to a collection
            </Button>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {savedTo && (
          <Surface variant="sunken" padding="sm">
            <Text size="caption" weight="semibold">
              Saved {all.length} items to “{savedTo}”.{' '}
              <Link to="/saved" className="underline underline-offset-2">
                Open your collections
              </Link>
            </Text>
          </Surface>
        )}
      </div>

      {all.length === 0 ? (
        <Surface variant="card" padding="lg">
          <EmptyState
            icon={Compass}
            title="Nothing fits those answers yet"
            description="Try another need, or search for what the screen does."
            action={
              <Button size="sm" variant="outline" onClick={onChange}>
                Change answers
              </Button>
            }
          />
        </Surface>
      ) : (
        ITEM_TYPES.map((type) => {
          const entries = results[type.id]
          if (entries.length === 0) return null
          return (
            <section key={type.id} aria-labelledby={`find-${type.id}`} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2.5">
                <Text as="h3" id={`find-${type.id}`} size="heading">
                  {type.many}
                </Text>
                <Text size="caption" weight="bold" tone="faint" tabular>
                  {entries.length}
                </Text>
              </div>
              <div className={cn('grid grid-cols-1 gap-2.5 sm:grid-cols-2', type.id === 'component' && 'xl:grid-cols-3')}>
                {entries.map(({ item, matched }) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    showType={false}
                    headingLevel="h4"
                    footer={
                      <div className="flex flex-wrap items-center gap-1">
                        {matched.length > 0 ? (
                          matched.map((tag) => (
                            <Tag key={tag} size="sm" tone="accent">
                              {tagLabel(tag)}
                            </Tag>
                          ))
                        ) : (
                          <Tag size="sm">Fits {projectType?.phrase}</Tag>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )
        })
      )}
    </section>
  )
}
