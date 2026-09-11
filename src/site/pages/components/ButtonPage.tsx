import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Surface, Text, type ButtonSize, type ButtonVariant } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl, ToggleControl } from '../../components/Playground'

const VARIANTS: { value: ButtonVariant; usage: string }[] = [
  { value: 'accent', usage: 'Send · Swap' },
  { value: 'muted', usage: 'Payments · QR · More' },
  { value: 'outline', usage: 'Withdraw' },
  { value: 'white', usage: 'Order Yours Now' },
  { value: 'ghost', usage: 'Inline affordances' },
]

const VARIANT_NAMES = VARIANTS.map((variant) => variant.value)
const SIZES: ButtonSize[] = ['sm', 'md']

export default function ButtonPage() {
  const [variant, setVariant] = useState<ButtonVariant>('accent')
  const [size, setSize] = useState<ButtonSize>('md')
  const [label, setLabel] = useState('Order Yours Now')
  const [disabled, setDisabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fullWidth, setFullWidth] = useState(false)
  const [clicks, setClicks] = useState(0)

  return (
    <DocPage
      name="Button"
      description="A labelled action. Five variants cover the emphasis levels the design actually distinguishes — from the accent primary on a card to the quiet ghost used inline. Height, radius and weight are fixed so buttons always line up with the fields and pills beside them."
      propNotes={[
            {
              name: 'variant',
              type: "'accent' | 'muted' | 'outline' | 'white' | 'ghost'",
              defaultValue: "'accent'",
              description: 'Emphasis level.',
            },
            {
              name: 'size',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: 'Control height: 32px or 40px.',
            },
            {
              name: 'loading',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Prefixes a spinner, sets aria-busy and blocks interaction.',
            },
            {
              name: 'fullWidth',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Stretch to the container width.',
            },
            {
              name: '…props',
              type: 'ComponentPropsWithoutRef<E>',
              description:
                'Everything the rendered element takes — a native button by default, or whatever as names. On a button, type defaults to "button"; set type="submit" explicitly inside a form.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Button>Send</Button>
        </Preview>
      </Section>

      <Section
        title="Variants"
        description="Each one is traceable to a place in the design. There is no destructive or success variant because the design has no destructive or success button."
      >
        <Preview>
          {VARIANTS.map(({ value, usage }) => (
            <Specimen key={value} label={value} hint={usage}>
              <Button variant={value}>Withdraw</Button>
            </Specimen>
          ))}
        </Preview>
        <Note>
          <Code>white</Code> carries the float shadow so it reads on the accent banner;{' '}
          <Code>outline</Code> is flat because it only ever sits on a card.
        </Note>
      </Section>

      <Section title="Sizes" description="Two heights: 32px inside a card, 40px everywhere else.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? 'h-8 · 12px' : 'h-10 · 13px'}>
              <Button size={value} variant="outline">
                Withdraw
              </Button>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Hover and active are live — point at or press the first two. Focus-visible appears on keyboard focus only, so tab into the row."
      >
        <Preview>
          <Specimen label="default">
            <Button>Send</Button>
          </Specimen>
          <Specimen label="hover" hint="accent → accent-strong">
            <Button className="bg-accent-strong">Send</Button>
          </Specimen>
          <Specimen label="focus-visible" hint="Tab to this button">
            <Button>Send</Button>
          </Specimen>
          <Specimen label="disabled" hint="40% opacity, pointer events off">
            <Button disabled>Send</Button>
          </Specimen>
          <Specimen label="loading" hint="Spinner, aria-busy, non-interactive">
            <Button loading>Send</Button>
          </Specimen>
        </Preview>
        <Note>
          <Code>loading</Code> implies <Code>disabled</Code> and sets <Code>aria-busy</Code>, so a
          submit cannot fire twice.
        </Note>
      </Section>

      <Section
        title="As a link"
        description="When the action goes somewhere, render the button as the link. A button nested inside a link is invalid — assistive technology meets two controls for one action — so as puts the button's look on the element that actually navigates."
      >
        <Preview>
          <Specimen label="as={Link}" hint="A real anchor, router-aware">
            <Button as={Link} to="/getting-started">
              Get started
            </Button>
          </Specimen>
          <Specimen label="as={Link}" hint="Any variant carries over">
            <Button as={Link} to="/components" variant="outline">
              Browse components
            </Button>
          </Specimen>
          <Specimen label="disabled link" hint="aria-disabled, out of the tab order">
            <Button as={Link} to="/getting-started" disabled>
              Get started
            </Button>
          </Specimen>
        </Preview>
        <Note>
          A link has no <Code>disabled</Code> attribute, so on anything that is not a button the state
          becomes <Code>aria-disabled</Code>, the element leaves the tab order and ignores the
          pointer. It is announced as unavailable rather than silently doing nothing.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="How the design actually uses it."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Surface variant="card" padding="lg" className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <Text size="label" weight="medium" tone="faint">
                Available Cashback
              </Text>
              <Button variant="outline" size="sm">
                Withdraw
              </Button>
            </div>
            <Text size="title" tabular>
              $1,154.00
            </Text>
            <Text size="caption" weight="medium" tone="faint">
              Cashback Partners card — a quiet action beside a figure.
            </Text>
          </Surface>

          <Surface
            variant="card"
            padding="lg"
            className="items-start justify-between gap-4 border-0 bg-accent shadow-none"
          >
            <Text size="subtitle" tone="accent" leading="normal">
              Smart banking
              <br />
              makes life different.
            </Text>
            <Button variant="white">Order Yours Now</Button>
          </Surface>
        </div>
      </Section>

      <Section title="Playground">
        <Playground
          background={variant === 'white' ? 'accent' : 'surface'}
          stage={
            <div className="flex w-full max-w-[320px] flex-col items-center gap-3">
              <Button
                variant={variant}
                size={size}
                disabled={disabled}
                loading={loading}
                fullWidth={fullWidth}
                onClick={() => setClicks((count) => count + 1)}
              >
                {label}
              </Button>
              <Text size="caption" weight="medium" tone={variant === 'white' ? 'accent' : 'faint'}>
                Clicked {clicks} {clicks === 1 ? 'time' : 'times'}
              </Text>
            </div>
          }
          controls={
            <>
              <SelectControl
                label="variant"
                value={variant}
                options={VARIANT_NAMES}
                onChange={setVariant}
              />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <TextControl label="label" value={label} onChange={setLabel} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
              <ToggleControl label="loading" checked={loading} onChange={setLoading} />
              <ToggleControl label="fullWidth" checked={fullWidth} onChange={setFullWidth} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
