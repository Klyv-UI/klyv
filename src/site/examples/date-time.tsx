import { useState } from 'react'
import {
  Calendar,
  Card,
  DatePicker,
  DateRangePicker,
  Field,
  Surface,
  Text,
  TimePicker,
  toISODate,
  type DateRange,
} from 'klyv'
import type { ExampleModule } from './types'

const today = toISODate(new Date())

function shift(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

function CalendarExample() {
  const [value, setValue] = useState(today)
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Surface variant="card" padding="md">
        <Calendar value={value} onValueChange={setValue} label="Payment date" />
      </Surface>
      <div className="flex max-w-[42ch] flex-col gap-2">
        <Text size="caption" weight="semibold" tone="soft">
          Selected: {value}
        </Text>
        <Text size="caption" tone="faint" leading="normal">
          Focus a day and use the arrow keys to move by day and week, Home and End for the ends of
          the week, and PageUp or PageDown to change month. Each day announces its whole date, so a
          screen reader reads &ldquo;Tuesday 14 October 2026&rdquo; rather than &ldquo;14&rdquo;.
        </Text>
      </div>
    </div>
  )
}

function BoundedExample() {
  const [value, setValue] = useState(shift(2))
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Surface variant="card" padding="md">
        <Calendar
          value={value}
          onValueChange={setValue}
          min={today}
          max={shift(30)}
          label="Schedule within thirty days"
        />
      </Surface>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[38ch]">
        Bounded to the next thirty days. Days outside the range are disabled rather than hidden, so
        the shape of the month stays intact.
      </Text>
    </div>
  )
}

function PickersExample() {
  const [date, setDate] = useState(shift(1))
  const [time, setTime] = useState('09:30')
  const [range, setRange] = useState<DateRange>({ start: shift(-7), end: today })

  return (
    <Card title="Schedule a transfer" className="w-full max-w-[420px]">
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Field label="Date" className="min-w-[170px] flex-1">
            <DatePicker value={date} onValueChange={setDate} label="Transfer date" min={today} />
          </Field>
          <Field label="Time" className="min-w-[120px]">
            <TimePicker value={time} onValueChange={setTime} label="Transfer time" step={30} />
          </Field>
        </div>
        <Field label="Statement period">
          <DateRangePicker
            value={range}
            onValueChange={setRange}
            label="Statement period"
            presets={[
              { label: 'Last 7 days', range: { start: shift(-7), end: today } },
              { label: 'Last 30 days', range: { start: shift(-30), end: today } },
              { label: 'Last 90 days', range: { start: shift(-90), end: today } },
            ]}
          />
        </Field>
        <Surface variant="sunken" padding="sm">
          <Text size="caption" tone="faint" tabular>
            {date} at {time} · statement {range.start ?? '?'} to {range.end ?? '?'}
          </Text>
        </Surface>
      </div>
    </Card>
  )
}

export const demos: ExampleModule = {
  calendar: {
    description:
      'A month grid with the full date keyboard model. The grid is a real table with column headers, and each day carries its whole date as an accessible name. Dates are plain ISO yyyy-mm-dd strings throughout, formatted in local time — never through toISOString, which silently shifts the day across a timezone boundary.',
    sections: [
      { title: 'Example', bare: true, Content: CalendarExample },
      { title: 'Bounds', bare: true, Content: BoundedExample },
    ],
    props: [
      { name: 'value / onValueChange', type: 'string / fn', description: 'Selected date as ISO yyyy-mm-dd.' },
      { name: 'min / max', type: 'string', description: 'Earliest and latest selectable dates.' },
      { name: 'rangeStart / rangeEnd', type: 'string', description: 'Shades the span between them; used by DateRangePicker.' },
    ],
  },

  'date-picker': {
    description:
      'Calendar in a Popover, behind a read-only field. The field is read-only on purpose: parsing typed dates across formats is a source of silent errors, and the grid is faster anyway. The chosen date is shown in a long, unambiguous format.',
    sections: [{ title: 'Example', bare: true, Content: PickersExample }],
    props: [
      { name: 'value / onValueChange', type: 'string / fn', description: 'ISO yyyy-mm-dd.' },
      { name: 'label', type: 'string', description: 'Accessible name. Pair with a Field for a visible one.' },
      { name: 'min / max', type: 'string', description: 'Selectable range.' },
    ],
  },

  'date-range-picker': {
    description:
      'Two linked endpoints on one Calendar. Clicking sets the start, clicking again sets the end, and a click before the current start restarts the range — which is what people expect, and avoids a modal "choose start, then choose end" step. Presets exist because most range choices are a named period.',
    sections: [{ title: 'Example', description: 'Open the statement period field to see the presets beside the grid.', bare: true, Content: PickersExample }],
    props: [
      { name: 'value / onValueChange', type: 'DateRange / fn', description: '{ start, end }, both ISO strings.' },
      { name: 'presets', type: '{ label, range }[]', description: 'Named periods beside the grid.' },
      { name: 'min / max', type: 'string', description: 'Selectable range.' },
    ],
  },

  'time-picker': {
    description:
      'Time selection from a fixed list rather than free text or a spinner. A list is faster for the common case of scheduling on the quarter-hour and removes the whole class of parsing errors that comes with accepting typed times. Values stay 24-hour internally regardless of display.',
    sections: [{ title: 'Example', bare: true, Content: PickersExample }],
    props: [
      { name: 'value / onValueChange', type: 'string / fn', description: '24-hour HH:mm.' },
      { name: 'step', type: '15 | 30 | 60', defaultValue: '30', description: 'Minutes between options.' },
      { name: 'min / max', type: 'string', description: 'Earliest and latest times, as HH:mm.' },
    ],
  },
}
