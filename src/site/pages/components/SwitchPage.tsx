import { useState } from 'react'
import { Divider, Label, Surface, Switch, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, ToggleControl } from '../../components/Playground'

const SIZES = ['sm', 'md'] as const

const SETTINGS = [
  { id: 'push', label: 'Push notifications', hint: 'Payment alerts on this device' },
  { id: 'digest', label: 'Weekly digest', hint: 'A summary every Monday' },
  { id: 'offers', label: 'Partner offers', hint: 'Cashback deals from partners' },
]

export default function SwitchPage() {
  const [switchSize, setSwitchSize] = useState<'sm' | 'md'>('md')
  const [checked, setChecked] = useState(true)
  const [disabled, setDisabled] = useState(false)
  const [settings, setSettings] = useState<Record<string, boolean>>({
    push: true,
    digest: false,
    offers: true,
  })

  return (
    <DocPage
      name="Switch"
      description="A native checkbox presented as a track and knob. Use it for a setting that takes effect immediately; use Checkbox when the change only applies once a form is submitted. Because the underlying control is still a checkbox, it submits with a form and toggles with the space key."
      propNotes={[
            {
              name: 'switchSize',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: 'Named switchSize because size is a native input attribute.',
            },
            { name: 'ref', type: 'Ref<HTMLInputElement>', description: 'Forwarded to the input.' },
            {
              name: '…props',
              type: 'InputHTMLAttributes<HTMLInputElement>',
              description: 'checked, defaultChecked, onChange, name, disabled and the rest.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Switch defaultChecked aria-label="Default switch" />
        </Preview>
      </Section>

      <Section title="Sizes" description="20px and 24px tracks. The knob scales with the track.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? 'h-5 w-9' : 'h-6 w-11'}>
              <Switch switchSize={value} defaultChecked aria-label={`Switch ${value}`} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Hover and focus are live. The knob moves with a transform, so the track never reflows."
      >
        <Preview>
          <Specimen label="off">
            <Switch aria-label="Off" />
          </Specimen>
          <Specimen label="on">
            <Switch defaultChecked aria-label="On" />
          </Specimen>
          <Specimen label="hover (off)" hint="line-strong → ink-faint">
            <Switch aria-label="Hover off" className="[&>input]:bg-ink-faint" />
          </Specimen>
          <Specimen label="focus-visible" hint="Tab to this switch">
            <Switch aria-label="Focus" />
          </Specimen>
          <Specimen label="disabled (off)">
            <Switch disabled aria-label="Disabled off" />
          </Specimen>
          <Specimen label="disabled (on)">
            <Switch disabled defaultChecked aria-label="Disabled on" />
          </Specimen>
        </Preview>
        <Note>
          The input carries <Code>role=&quot;switch&quot;</Code>, so it is announced as “on” or
          “off” rather than “checked”. It still needs a name — pair it with a{' '}
          <Code>Label</Code> or pass <Code>aria-label</Code>.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="A settings list — the shape most likely to appear on the Account route."
      >
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[380px] gap-0">
            <Text size="heading" className="mb-3">
              Notifications
            </Text>
            {SETTINGS.map((setting, index) => (
              <div key={setting.id}>
                {index > 0 && <Divider className="my-1" />}
                <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <Text as="span" size="body" className="block">
                      {setting.label}
                    </Text>
                    <Text as="span" size="caption" tone="faint" className="block">
                      {setting.hint}
                    </Text>
                  </span>
                  <Switch
                    checked={settings[setting.id]}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        [setting.id]: event.target.checked,
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <label className="flex cursor-pointer items-center gap-3">
              <Switch
                switchSize={switchSize}
                checked={checked}
                disabled={disabled}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <Label disabled={disabled}>Push notifications</Label>
            </label>
          }
          controls={
            <>
              <SelectControl
                label="switchSize"
                value={switchSize}
                options={SIZES}
                onChange={setSwitchSize}
              />
              <ToggleControl label="checked" checked={checked} onChange={setChecked} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
