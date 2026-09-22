import { useState } from 'react'
import { Meter, Progress, Surface, Text } from 'klyvui'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { NumberControl, Playground, SelectControl, ToggleControl } from '../../components/Playground'

const SIZES = ['sm', 'md'] as const

export default function ProgressPage() {
  const [value, setValue] = useState(64)
  const [size, setSize] = useState<'sm' | 'md'>('md')
  const [indeterminate, setIndeterminate] = useState(false)

  return (
    <DocPage
      name="Progress"
      description="Continuous progress, for quantities that really are fractional — an upload, a storage quota, a percentage of a goal. When progress is a count of discrete things, reach for Meter instead: that is what the design itself uses everywhere, and the two are deliberately kept apart."
      propNotes={[
            { name: 'value', type: 'number', defaultValue: '0', description: 'Current value, clamped to the 0–max range.' },
            { name: 'max', type: 'number', defaultValue: '100', description: 'Upper bound.' },
            {
              name: 'label',
              type: 'string',
              description: 'Required. What is progressing; becomes the accessible name.',
            },
            { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: '4px or 6px track.' },
            {
              name: 'indeterminate',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Work is happening but the proportion is unknown.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <div className="w-[280px]">
            <Progress value={64} label="Upload progress" />
          </div>
        </Preview>
      </Section>

      <Section title="Sizes" description="4px and 6px. Anything thicker starts reading as a container.">
        <Preview stack>
          {SIZES.map((option) => (
            <Specimen key={option} label={option} hint={option === 'sm' ? '4px' : '6px'} fill>
              <div className="w-full max-w-[280px]">
                <Progress value={64} size={option} label={`Progress ${option}`} />
              </div>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section title="Values" description="value is clamped against max, so out-of-range input cannot overflow the track.">
        <Preview stack>
          {[0, 35, 100].map((amount) => (
            <Specimen key={amount} label={`${amount}%`} fill>
              <div className="w-full max-w-[280px]">
                <Progress value={amount} label={`${amount} percent`} />
              </div>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Determinate transitions its width; indeterminate shows that work is happening without claiming a proportion."
      >
        <Preview stack>
          <Specimen label="determinate" hint="aria-valuenow is set" fill>
            <div className="w-full max-w-[280px]">
              <Progress value={64} label="Determinate" />
            </div>
          </Specimen>
          <Specimen label="indeterminate" hint="aria-valuenow is omitted" fill>
            <div className="w-full max-w-[280px]">
              <Progress indeterminate label="Indeterminate" />
            </div>
          </Specimen>
        </Preview>
        <Note>
          When <Code>indeterminate</Code> is set, <Code>aria-valuenow</Code> is left off entirely.
          Reporting a fake value is worse than reporting none — a screen reader would announce
          progress that is not real.
        </Note>
      </Section>

      <Section
        title="Progress or Meter?"
        description="The distinction is whether the quantity is continuous or countable. Both are shown here on the same underlying fraction."
      >
        <Preview stack>
          <Specimen label="Progress" hint="3.6 GB of 5 GB — a genuine fraction" fill>
            <div className="w-full max-w-[300px]">
              <Progress value={72} label="Storage used" />
            </div>
          </Specimen>
          <Specimen label="Meter" hint="3 of 6 instalments — a count, so every unit is drawn" fill>
            <div className="w-full max-w-[300px]">
              <Meter value={3} total={6} label="Instalments paid" />
            </div>
          </Specimen>
        </Preview>
      </Section>

      <Section title="Examples" description="A goal card, where the figure carries the precision and the bar carries the shape.">
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[320px] gap-2">
            <div className="flex items-baseline justify-between">
              <Text size="label" tone="faint">
                Savings goal
              </Text>
              <Text size="caption" weight="bold" tone="soft" tabular>
                72%
              </Text>
            </div>
            <Text size="title" tabular>
              $3,600.00
            </Text>
            <Progress value={72} label="Savings goal progress" className="mt-1" />
            <Text size="caption" tone="faint">
              $1,400.00 left of $5,000.00
            </Text>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <div className="w-full max-w-[300px]">
              <Progress
                value={value}
                size={size}
                indeterminate={indeterminate}
                label="Playground progress"
              />
            </div>
          }
          controls={
            <>
              <NumberControl label="value" value={value} min={0} max={100} onChange={setValue} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <ToggleControl
                label="indeterminate"
                checked={indeterminate}
                onChange={setIndeterminate}
              />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
