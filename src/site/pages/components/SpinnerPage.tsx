import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button, IconButton, Spinner, Surface, Text, type SpinnerSize } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, ToggleControl } from '../../components/Playground'

const SIZES: SpinnerSize[] = ['sm', 'md']

export default function SpinnerPage() {
  const [size, setSize] = useState<SpinnerSize>('md')
  const [labelled, setLabelled] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <DocPage
      name="Spinner"
      description="A busy indicator. It exists because Button and IconButton both need a loading state, and that state has to render something. It inherits currentColor, so it reads correctly on every variant without a tone prop of its own."
      propNotes={[
            {
              name: 'size',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: '14px or 16px.',
            },
            {
              name: 'label',
              type: 'string',
              description:
                'Makes it a role=status live region. Omit inside a control that already sets aria-busy.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Spinner />
        </Preview>
      </Section>

      <Section title="Sizes" description="14px and 16px, matching the two control heights.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? '14px' : '16px'}>
              <Spinner size={value} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Colour"
        description="There is no tone prop. The spinner takes the text colour of whatever contains it, which is why it stays legible on accent, on muted and on white."
      >
        <Preview>
          <Specimen label="on surface" hint="Inherits ink">
            <Spinner />
          </Specimen>
          <Specimen label="on accent" hint="Inherits accent-ink">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink">
              <Spinner />
            </span>
          </Specimen>
          <Specimen label="on ink" hint="Inherits white">
            <span className="flex size-11 items-center justify-center rounded-full bg-ink text-ink-inverse">
              <Spinner />
            </span>
          </Specimen>
          <Specimen label="faint" hint="className sets the colour">
            <Spinner className="text-ink-faint" />
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="States"
        description="A spinner is only ever spinning. What varies is whether it announces itself — inside a control that already sets aria-busy, it must not."
      >
        <Preview>
          <Specimen label="decorative" hint="aria-hidden; used inside Button">
            <Spinner />
          </Specimen>
          <Specimen label="labelled" hint="role=status; used standalone">
            <Spinner label="Loading transactions" />
          </Specimen>
        </Preview>
        <Note>
          Passing <Code>label</Code> makes the spinner a live region. Button and IconButton render
          it without one, because those controls already carry <Code>aria-busy</Code>.
        </Note>
      </Section>

      <Section title="Examples" description="Where the library actually renders it.">
        <Preview stack>
          <div className="flex flex-wrap items-center gap-5">
            <Specimen label="Button loading">
              <Button loading>Send</Button>
            </Specimen>
            <Specimen label="IconButton loading">
              <IconButton icon={Send} label="Send" tone="accent" loading />
            </Specimen>
            <Specimen label="Live" hint="Toggle it in the controls below">
              <Button loading={busy} onClick={() => setBusy(true)}>
                {busy ? 'Sending' : 'Send'}
              </Button>
            </Specimen>
          </div>
          <Surface variant="sunken" padding="sm" className="flex-row items-center gap-3">
            <Spinner label="Loading transactions" className="text-ink-faint" />
            <Text size="caption" weight="medium" tone="faint">
              Standalone, beside its own copy — the pattern for a loading section.
            </Text>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <div className="flex flex-col items-center gap-4">
              <Spinner size={size} label={labelled ? 'Loading' : undefined} />
              <Button size="sm" variant="outline" onClick={() => setBusy((previous) => !previous)}>
                {busy ? 'Stop the button' : 'Load the button'}
              </Button>
              <Button loading={busy}>Send</Button>
            </div>
          }
          controls={
            <>
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <ToggleControl label="label" checked={labelled} onChange={setLabelled} />
              <ToggleControl label="button loading" checked={busy} onChange={setBusy} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
