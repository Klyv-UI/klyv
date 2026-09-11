import { useState } from 'react'
import {
  AnnouncementBar,
  Button,
  ConsentManager,
  CookieBanner,
  FeedbackWidget,
  Modal,
  SegmentedControl,
  Text,
  type AnnouncementTone,
} from 'citrine'
import type { ExampleModule } from './types'
import { rationale } from './shared'

function AnnouncementExample() {
  const [tone, setTone] = useState<AnnouncementTone>('ink')
  const [key, setKey] = useState(0)
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Tone"
        size="sm"
        value={tone}
        onValueChange={setTone}
        className="self-start"
        options={[
          { value: 'ink', label: 'Ink' },
          { value: 'accent', label: 'Accent' },
          { value: 'muted', label: 'Muted' },
        ]}
      />
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
        <AnnouncementBar key={key} tone={tone} badge="New" href="#changelog" onDismiss={() => undefined}>
          Workflows can now post to any webhook.
        </AnnouncementBar>
        <div className="h-20 bg-app" />
      </div>
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setKey((value) => value + 1)}>
        Show it again
      </Button>
    </div>
  )
}

function FeedbackExample() {
  const [last, setLast] = useState<string>()
  return (
    <div className="flex w-full items-end justify-between gap-4">
      <Text size="caption" tone="faint" aria-live="polite" leading="normal">
        {last ?? 'Opens above, aligned to its right edge — where a feedback button usually sits.'}
      </Text>
      <FeedbackWidget
        categories={['Idea', 'Bug', 'Other']}
        onSubmit={async (feedback) => {
          await new Promise((resolve) => window.setTimeout(resolve, 600))
          setLast(`Received: rating ${feedback.rating ?? '—'}, ${feedback.category}, “${feedback.message || 'no message'}”`)
        }}
      />
    </div>
  )
}

const CATEGORIES = [
  { id: 'essential', label: 'Essential', description: 'Sign-in and security. The site does not work without these.', required: true },
  { id: 'analytics', label: 'Analytics', description: 'Which pages are read, so we can improve them.', recipients: ['Acme (first party)'] },
  { id: 'marketing', label: 'Marketing', description: 'Measuring which ads brought you here.', recipients: ['Ad networks'] },
]

function CookieExample() {
  const [choice, setChoice] = useState<string>()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<Record<string, boolean>>({ essential: true, analytics: false, marketing: false })

  return (
    <div className="flex w-full flex-col gap-3">
      {choice ? (
        <div className="flex items-center gap-3">
          <Text size="label" weight="semibold">
            {choice}
          </Text>
          <Button size="sm" variant="ghost" onClick={() => setChoice(undefined)}>
            Show the banner again
          </Button>
        </div>
      ) : (
        <CookieBanner
          position="inline"
          policyHref="#cookies"
          onAcceptAll={() => setChoice('Accepted all')}
          onRejectAll={() => setChoice('Rejected all optional cookies')}
          onCustomize={() => setOpen(true)}
        />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Cookie preferences" size="md">
        <ConsentManager
          label="Cookie categories"
          categories={CATEGORIES}
          value={value}
          onChange={setValue}
          onSave={(saved) => {
            setOpen(false)
            setChoice(`Saved: ${Object.entries(saved).filter(([, on]) => on).map(([id]) => id).join(', ')}`)
          }}
        />
      </Modal>
      <Text size="caption" tone="faint" leading="normal">
        Shown inline here. In an app use position="bottom" or "bottom-start" to float it over the page.
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  'announcement-bar': {
    description:
      'The thin strip across the top of a site or app — a launch, a webinar, scheduled maintenance. Dismissal is remembered per announcement, so closing last month’s launch does not hide next week’s outage notice.',
    sections: [
      { title: 'Example', bare: true, Content: AnnouncementExample },
      rationale(
        'Announcement strips are either undismissable or dismissed forever for every future message by one global flag.',
        'The caller keys the dismissal; a storage failure just shows it again. Accent text uses accent-ink so any brand colour stays legible.',
        'Above SiteHeader, above an app header, on a status page.',
        ['internal glyphs', 'accent-ink'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'One sentence.' },
      { name: 'badge / href / linkLabel', type: 'string', description: 'Qualifier and the link.' },
      { name: 'tone', type: "'ink' | 'accent' | 'muted'", defaultValue: 'ink', description: 'Ground colour.' },
      { name: 'storageKey / onDismiss', type: 'string / fn', description: 'Remember the dismissal under this key.' },
    ],
  },

  'feedback-widget': {
    description:
      '“How is it going?” behind a small button: a face, a sentence, and send. Either half is enough, and the thanks replaces the form so nobody wonders whether it went.',
    sections: [
      { title: 'Example', Content: FeedbackExample },
      rationale(
        'In-product feedback is usually a mailto link or a long survey; both get skipped.',
        'The faces are native radios — arrow keys move, each is announced by its word, not its emoji name — and errors keep the typed message.',
        'The app header, the help panel, the bottom corner of a dashboard.',
        ['Popover', 'Textarea', 'SegmentedControl', 'SuccessMark'],
      ),
    ],
    props: [
      { name: 'onSubmit', type: '({ rating, message, category? }) => void | Promise', description: 'Throw to show an error.' },
      { name: 'categories', type: 'string[]', description: 'Idea, Bug, Other.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', defaultValue: "'top' / 'end'", description: 'Where it opens.' },
    ],
  },

  'cookie-banner': {
    description:
      'The first-visit consent prompt, with Reject all exactly as easy as Accept all — same size, same style, one click. Customise opens ConsentManager for the per-category choice.',
    sections: [
      { title: 'Example', bare: true, Content: CookieExample },
      rationale(
        'The bright accept button over a pale reject link is the pattern regulators name, and it teaches visitors to distrust the site.',
        'It is a region, not a modal — it does not trap focus or block the page — and it hands the detailed choice to the existing ConsentManager.',
        'Marketing site first visit; the app when analytics are optional.',
        ['Surface', 'Button', 'ConsentManager', 'Modal'],
      ),
    ],
    props: [
      { name: 'onAcceptAll / onRejectAll', type: '() => void', description: 'Equal-weight choices.' },
      { name: 'onCustomize', type: '() => void', description: 'Open the detailed choice.' },
      { name: 'position', type: "'bottom' | 'bottom-start' | 'inline'", defaultValue: 'bottom', description: 'Floating bar, corner card, or in the flow.' },
      { name: 'title / children / policyHref', type: 'string / ReactNode / string', description: 'The copy.' },
    ],
  },
}
