import { useRef, useState, type ComponentProps } from 'react'
import {
  BookOpen,
  Bold,
  ChartLine,
  Code,
  FileText,
  Gamepad2,
  Italic,
  LifeBuoy,
  Megaphone,
  Music,
  ShieldCheck,
  Star,
  Underline,
  Users,
  Volume2,
  VolumeX,
  Workflow,
  Zap,
} from 'lucide-react'
import {
  AspectRatio,
  BackToTop,
  Badge,
  Button,
  Card,
  IconTile,
  List,
  ListItem,
  Masonry,
  MegaMenu,
  Menubar,
  ScrollArea,
  SegmentedControl,
  Surface,
  Text,
  ToggleButton,
  type MenubarMenu,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

const FilledStar = (props: ComponentProps<typeof Star>) => <Star {...props} fill="currentColor" />

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`relative w-full rounded-[var(--radius-card)] border border-line bg-app ${className ?? ''}`}>{children}</div>
}

/* ------------------------------------------------------------ aspect-ratio */

function Poster({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={`${label} placeholder image`}
      className="flex items-end bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-accent)_55%,var(--color-surface)),var(--color-surface-muted))] p-3"
    >
      <span className="rounded-full bg-surface px-2 py-1 text-[11px] font-bold text-ink">{label}</span>
    </div>
  )
}

function AspectRatioExample() {
  const [ratio, setRatio] = useState('16/9')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Ratio"
        size="sm"
        value={ratio}
        onValueChange={setRatio}
        className="self-start"
        options={[
          { value: '16/9', label: '16/9' },
          { value: '4/3', label: '4/3' },
          { value: '1', label: '1' },
          { value: '9/16', label: '9/16' },
        ]}
      />
      <div className="mx-auto w-full max-w-[420px]">
        <AspectRatio ratio={ratio} className="rounded-[var(--radius-card)] border border-line">
          <Poster label={ratio} />
        </AspectRatio>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- scroll-area */

const RELEASES = [
  ['2.8.0', 'Saved views can be shared with a link.'],
  ['2.7.2', 'Fixed CSV exports dropping the last row.'],
  ['2.7.1', 'Faster dashboard loads on large workspaces.'],
  ['2.7.0', 'Alerts can post to more than one channel.'],
  ['2.6.4', 'SSO sessions now respect the idle timeout.'],
  ['2.6.3', 'Chart tooltips no longer clip at the edge.'],
  ['2.6.0', 'Workflows: run a check every hour.'],
  ['2.5.1', 'Audit log filters remember your last choice.'],
  ['2.5.0', 'Team spaces with their own permissions.'],
]

const BILLS = [
  { id: 'apple', name: 'Apple Music', icon: Music, price: '$8,99' },
  { id: 'home', name: 'Smart Home Security', icon: Zap, price: '$79,99' },
  { id: 'gum', name: 'GumZone', icon: Gamepad2, price: '$35,00' },
  { id: 'water', name: 'Water Bill', icon: Zap, price: '$24,50' },
  { id: 'power', name: 'Electricity', icon: Zap, price: '$63,69' },
]

function ScrollAreaHiddenExample() {
  const [fade, setFade] = useState(true)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Card title="Recent transactions" className="h-[240px] w-full max-w-[380px]">
        <ScrollArea label="Recent transactions" scrollbar="hidden" fade={fade} className="-mx-2.5 mt-2 flex-1">
          <List>
            {[...BILLS, ...BILLS].map((row, index) => (
              <ListItem
                key={`${row.id}-${index}`}
                leading={<IconTile icon={row.icon} />}
                title={row.name}
                subtitle="Monthly Plan"
                value={row.price}
              />
            ))}
          </List>
        </ScrollArea>
      </Card>
      <Button size="sm" variant="outline" onClick={() => setFade((previous) => !previous)}>
        {fade ? 'Turn the fade off' : 'Turn the fade on'}
      </Button>
    </div>
  )
}

function ScrollAreaExample() {
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal' | 'both'>('vertical')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Orientation"
        size="sm"
        value={orientation}
        onValueChange={setOrientation}
        className="self-start"
        options={[
          { value: 'vertical', label: 'Vertical' },
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'both', label: 'Both' },
        ]}
      />
      <Surface variant="card" className="w-full max-w-[520px] p-2">
        {orientation === 'vertical' && (
          <ScrollArea label="Release notes" maxHeight={220} className="px-2">
            <ul className="m-0 flex list-none flex-col p-0">
              {RELEASES.map(([version, note]) => (
                <li key={version} className="flex gap-3 border-b border-line py-2.5 last:border-0">
                  <Badge tone="neutral">{version}</Badge>
                  <Text size="body" tone="soft">
                    {note}
                  </Text>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        {orientation === 'horizontal' && (
          <ScrollArea label="Recent files" orientation="horizontal" className="pb-2">
            <ul className="m-0 flex w-max list-none gap-3 p-1">
              {['Q3 board deck', 'Pricing research', 'Onboarding flow', 'Churn analysis', 'Hiring plan', 'Roadmap 2027', 'Brand refresh'].map((name) => (
                <li key={name}>
                  <Surface variant="tile" padding="md" className="w-40 gap-1">
                    <FileText size={16} aria-hidden="true" />
                    <Text size="label" weight="semibold">
                      {name}
                    </Text>
                  </Surface>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        {orientation === 'both' && (
          <ScrollArea label="Usage by region and month" orientation="both" maxHeight={200}>
            <table className="w-max border-collapse text-left text-[12px]">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-surface px-3 py-2">Region</th>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                    <th key={month} className="sticky top-0 bg-surface px-3 py-2">
                      {month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['North America', 'South America', 'Western Europe', 'Nordics', 'Middle East', 'Africa', 'South Asia', 'East Asia', 'Oceania'].map((region, row) => (
                  <tr key={region} className="border-t border-line">
                    <th scope="row" className="px-3 py-2 font-semibold">
                      {region}
                    </th>
                    {Array.from({ length: 12 }, (_, month) => (
                      <td key={month} className="tabular px-3 py-2 text-ink-soft">
                        {((row + 3) * (month + 7) * 37) % 900 + 100}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Surface>
    </div>
  )
}

/* ----------------------------------------------------------------- masonry */

const NOTES = [
  'Ship the export fix before the board meeting.',
  'Interview notes: customers want alerts in Slack and email, and they want to mute them per dashboard without muting the whole workspace.',
  'Rename “Spaces” to “Teams”?',
  'Onboarding drop-off is at the data source step. Try a sample dataset so people see a chart before they connect anything.',
  'Pricing page: annual toggle defaults to monthly.',
  'Q4 theme: fewer, better dashboards.',
  'Docs search returns changelog entries first — they should rank below guides.',
  'Idea: a weekly digest that only mentions what changed.',
  'Audit the colour contrast on charts in dark mode, especially the fourth and fifth series.',
]

function MasonryExample() {
  const [mode, setMode] = useState<'auto' | '2' | '4'>('auto')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Columns"
        size="sm"
        value={mode}
        onValueChange={setMode}
        className="self-start"
        options={[
          { value: 'auto', label: 'By width' },
          { value: '2', label: '2' },
          { value: '4', label: '4' },
        ]}
      />
      <Masonry as="ul" label="Planning notes" columns={mode === 'auto' ? { base: 1, sm: 2, lg: 3 } : Number(mode)} gap={12} className="w-full">
        {NOTES.map((note, index) => (
          <Surface key={note} variant="card" padding="md" className="gap-1.5">
            <Text size="caption" weight="bold" tone="faint">
              Note {index + 1}
            </Text>
            <Text size="body" tone="soft" leading="normal">
              {note}
            </Text>
          </Surface>
        ))}
      </Masonry>
    </div>
  )
}

/* ----------------------------------------------------------------- menubar */

function MenubarExample() {
  const [log, setLog] = useState('Nothing chosen yet')
  const [ruler, setRuler] = useState(true)
  const [wrap, setWrap] = useState(false)
  const act = (what: string) => () => setLog(what)

  const menus: MenubarMenu[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New document', shortcut: '⌘N', onSelect: act('New document') },
        { id: 'open', label: 'Open…', shortcut: '⌘O', onSelect: act('Open') },
        {
          id: 'recent',
          label: 'Open recent',
          type: 'submenu',
          items: [
            { id: 'r1', label: 'Q3 board deck', onSelect: act('Opened Q3 board deck') },
            { id: 'r2', label: 'Pricing research', onSelect: act('Opened Pricing research') },
            'separator',
            { id: 'clear', label: 'Clear recent', onSelect: act('Cleared recent') },
          ],
        },
        'separator',
        { id: 'save', label: 'Save', shortcut: '⌘S', onSelect: act('Saved') },
        { id: 'export', label: 'Export as PDF', disabled: true },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', shortcut: '⌘Z', onSelect: act('Undo') },
        { id: 'redo', label: 'Redo', shortcut: '⇧⌘Z', onSelect: act('Redo') },
        'separator',
        { id: 'cut', label: 'Cut', shortcut: '⌘X', onSelect: act('Cut') },
        { id: 'copy', label: 'Copy', shortcut: '⌘C', onSelect: act('Copy') },
        { id: 'paste', label: 'Paste', shortcut: '⌘V', onSelect: act('Paste') },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { id: 'ruler', label: 'Show ruler', type: 'checkbox', checked: ruler, onCheckedChange: setRuler },
        { id: 'wrap', label: 'Word wrap', type: 'checkbox', checked: wrap, onCheckedChange: setWrap },
        'separator',
        {
          id: 'zoom',
          label: 'Zoom',
          type: 'submenu',
          items: [
            { id: 'in', label: 'Zoom in', shortcut: '⌘+', onSelect: act('Zoom in') },
            { id: 'out', label: 'Zoom out', shortcut: '⌘−', onSelect: act('Zoom out') },
            { id: 'actual', label: 'Actual size', shortcut: '⌘0', onSelect: act('Actual size') },
          ],
        },
      ],
    },
  ]

  return (
    <Frame className="min-h-[320px] p-4">
      <div className="flex flex-col gap-4">
        <Menubar label="Document" menus={menus} className="self-start" />
        <Text size="caption" tone="faint" aria-live="polite">
          Last action: {log} · Ruler {ruler ? 'on' : 'off'} · Wrap {wrap ? 'on' : 'off'}
        </Text>
      </div>
    </Frame>
  )
}

/* --------------------------------------------------------------- mega-menu */

function MegaMenuExample() {
  return (
    <Frame className="min-h-[440px] p-3">
      <MegaMenu
        label="Main"
        sections={[
          {
            id: 'product',
            label: 'Product',
            groups: [
              {
                heading: 'Analyse',
                links: [
                  { label: 'Dashboards', href: '#dashboards', description: 'Charts your whole team can read.', icon: ChartLine },
                  { label: 'Workflows', href: '#workflows', description: 'Run checks on a schedule.', icon: Workflow, badge: <Badge>New</Badge> },
                ],
              },
              {
                heading: 'Govern',
                links: [
                  { label: 'Permissions', href: '#permissions', description: 'Who can see and change what.', icon: ShieldCheck },
                  { label: 'Teams', href: '#teams', description: 'Spaces with their own members.', icon: Users },
                ],
              },
            ],
            footer: (
              <a href="#changelog" className="text-[12px] font-semibold text-ink">
                See what shipped this month →
              </a>
            ),
          },
          {
            id: 'resources',
            label: 'Resources',
            groups: [
              {
                heading: 'Learn',
                links: [
                  { label: 'Guides', href: '#guides', description: 'From first chart to first alert.', icon: BookOpen },
                  { label: 'API reference', href: '#api', description: 'Every endpoint, with examples.', icon: Code },
                ],
              },
              {
                heading: 'Company',
                links: [
                  { label: 'Blog', href: '#blog', description: 'Product notes and essays.', icon: Megaphone },
                  { label: 'Support', href: '#support', description: 'Talk to a person.', icon: LifeBuoy },
                ],
              },
            ],
          },
          { id: 'pricing', label: 'Pricing', href: '#pricing' },
        ]}
      />
    </Frame>
  )
}

/* ------------------------------------------------------------- back-to-top */

function BackToTopExample() {
  const scroller = useRef<HTMLDivElement>(null)
  return (
    <Frame className="h-[320px] overflow-hidden">
      <div ref={scroller} role="region" aria-label="Long article" tabIndex={0} className="h-full overflow-y-auto p-5">
        <h3 id="back-to-top-demo-start" className="m-0 text-[18px] font-extrabold text-ink">
          Designing alerts people do not mute
        </h3>
        {Array.from({ length: 10 }, (_, index) => (
          <p key={index} className="text-[13px] leading-relaxed text-ink-soft">
            {index + 1}. An alert is a promise that something needs a person now. Every alert that fires without
            meaning it spends a little of that promise, and once it is spent the channel gets muted — including the
            one alert that mattered. Start from the decision someone will make, then work back to the signal.
          </p>
        ))}
      </div>
      <BackToTop target={scroller} fixed={false} threshold={120} showProgress focusTarget="#back-to-top-demo-start" />
    </Frame>
  )
}

/* ----------------------------------------------------------- toggle-button */

function ToggleButtonExample() {
  const [muted, setMuted] = useState(false)
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div role="toolbar" aria-label="Text formatting" className="flex gap-1.5">
        <ToggleButton icon={Bold} iconOnly size="sm" variant="ghost" defaultPressed>
          Bold
        </ToggleButton>
        <ToggleButton icon={Italic} iconOnly size="sm" variant="ghost">
          Italic
        </ToggleButton>
        <ToggleButton icon={Underline} iconOnly size="sm" variant="ghost">
          Underline
        </ToggleButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <ToggleButton icon={Star} pressedIcon={FilledStar} defaultPressed>
          Star
        </ToggleButton>
        <ToggleButton icon={Volume2} pressedIcon={VolumeX} pressed={muted} onPressedChange={setMuted} variant="muted" pressedVariant="outline">
          Mute
        </ToggleButton>
      </div>
      <Text size="caption" tone="faint">
        Sound is {muted ? 'muted' : 'on'}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ module */

export const demos: ExampleModule = {
  'aspect-ratio': {
    description:
      'A box that reserves the shape of its media before the media arrives, using CSS aspect-ratio, and stretches the child to fill it with object-cover — so a grid of thumbnails never jumps as images load.',
    sections: [
      { title: 'Example', Content: AspectRatioExample },
      rationale(
        'Images and embeds without known dimensions load at zero height and push the page down — the layout shift readers notice most.',
        'aspect-ratio reserves the space from CSS alone, with no padding hack and no script, so it stays a pure server-safe component.',
        'Card thumbnails, video embeds, product galleries, avatars cropped to a shape.',
        ['CSS aspect-ratio'],
      ),
    ],
    props: [
      { name: 'ratio', type: 'number | string', defaultValue: '1', description: 'Width over height: 1.5, "16/9" or "4:3".' },
      { name: 'fit', type: "'cover' | 'contain'", defaultValue: 'cover', description: 'How an img or video child fills the box.' },
      { name: 'children', type: 'ReactNode', description: 'Usually one img, video, iframe or picture.' },
    ],
  },

  'scroll-area': {
    description:
      'A scroll container with thin or hidden scrollbars and edges that fade only while there is more content past them. It is a named, focusable region, so overflow made of plain text can still be scrolled from the keyboard.',
    sections: [
      { title: 'Example', Content: ScrollAreaExample, note: 'Tab into the box and use the arrow keys; the fade on each edge disappears when you reach it.' },
      {
        title: 'Hidden scrollbar',
        description:
          'scrollbar="hidden" for a short list inside a card, where the fade already says there is more. Toggle the fade to see what the mask is doing. This is what ScrollList, now deprecated, renders.',
        bare: true,
        Content: ScrollAreaHiddenExample,
      },
      rationale(
        'Overlay scrollbars hide until you scroll, so a box cut off at a line break looks finished, and text-only overflow has nothing to tab to.',
        'An edge fades only while there is more beyond it, which makes the fade itself the signal; the region takes focus and carries a label so keyboard and screen-reader users can reach it.',
        'Release notes in a popover, sidebars, wide tables inside cards, horizontal shelves of files.',
        ['CSS scrollbar styling', 'ResizeObserver'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name for the focusable region. Required.' },
      { name: 'orientation', type: "'vertical' | 'horizontal' | 'both'", defaultValue: 'vertical', description: 'Which axes scroll.' },
      { name: 'maxHeight / maxWidth', type: 'number | string', description: 'Bounds, when the parent does not provide them.' },
      { name: 'fade', type: 'boolean', defaultValue: 'true', description: 'Fade edges that have more content beyond them.' },
      { name: 'fadeSize', type: 'number', defaultValue: '28', description: 'Length of the fade in pixels.' },
      { name: 'scrollbar', type: "'thin' | 'hidden'", defaultValue: "'thin'", description: 'Hide the scrollbar for short lists in a card; the fade carries the signal.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  masonry: {
    description:
      'Tiles of different heights packed into columns without gaps. The tiles stay in source order in one grid and are placed row by row, so what you see left to right is also the tab order and the reading order.',
    sections: [
      {
        title: 'Example',
        Content: MasonryExample,
        note: 'The numbers are source order. They run across each row, which is also the order a screen reader and the Tab key follow.',
      },
      rationale(
        'CSS columns fill the first column top to bottom, so the screen reads 1, 4, 7 across while keyboard and screen-reader order walks 1, 2, 3 down the side.',
        'A grid with measured row spans keeps DOM order and visual order the same, and falls back to an even grid before it has measured anything. Breakpoints are read from its own width, so it behaves the same in a sidebar.',
        'Notes boards, image galleries, testimonial walls, pinboards.',
        ['CSS grid', 'ResizeObserver'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'One child per tile, in reading order.' },
      { name: 'columns', type: 'number | { base, sm, md, lg, xl }', defaultValue: '{ base: 1, sm: 2, lg: 3 }', description: 'Fixed count, or counts by container width.' },
      { name: 'gap', type: 'number', defaultValue: '16', description: 'Space between tiles in pixels.' },
      { name: 'as', type: "'div' | 'ul'", defaultValue: 'div', description: 'ul gives list semantics and a count.' },
      { name: 'label', type: 'string', description: 'Accessible name for the list.' },
    ],
  },

  menubar: {
    description:
      'The File / Edit / View bar of a desktop application, following the WAI-ARIA menubar pattern: one tab stop, Left and Right along the bar, Down to open, submenus, checkable items with shortcuts, and Escape that closes one level and returns focus.',
    sections: [
      {
        title: 'Example',
        Content: MenubarExample,
        note: 'Tab to File, then use the arrow keys. With a menu open, Left and Right move to the next menu; Right on Open recent opens its submenu.',
      },
      rationale(
        'Editors and consoles need many commands in little space, and their users bring muscle memory from the operating system menubar.',
        'Matching the platform pattern exactly means that memory works. Checkable items are menuitemcheckbox, so their state is announced rather than shown only as a tick.',
        'Document editors, design tools, IDE-like consoles, admin tools that behave like apps.',
        ['internal glyphs'],
      ),
    ],
    props: [
      { name: 'menus', type: 'MenubarMenu[]', description: '{ id, label, items } for each menu on the bar.' },
      { name: 'items', type: 'MenubarEntry[]', description: "Action { id, label, shortcut?, onSelect }, checkbox { type: 'checkbox', checked, onCheckedChange }, submenu { type: 'submenu', items }, or 'separator'." },
      { name: 'label', type: 'string', description: 'Accessible name for the bar.' },
    ],
  },

  'mega-menu': {
    description:
      'Site navigation whose sections open into wide panels of grouped, described links. It is a disclosure — buttons with aria-expanded and plain links inside — with hover intent so sweeping across the bar does not flash panels.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: MegaMenuExample,
        note: 'Hover a section and rest briefly, or click it. Down arrow opens a panel and moves to its first link; Escape closes it and returns focus.',
      },
      rationale(
        'A marketing site with many products cannot fit them in a row of links, and a plain dropdown loses the one-line description that helps someone choose.',
        'Menu roles would stop Tab from reaching the links and announce navigation as an application menu, so it is a disclosure; open and close delays separate intent from a pointer passing through.',
        'Marketing site headers, documentation portals, large storefront navigation.',
        ['Badge', 'internal glyphs'],
      ),
    ],
    props: [
      { name: 'sections', type: 'MegaMenuSection[]', description: '{ id, label, href?, groups?, footer? }. No groups makes a plain link.' },
      { name: 'groups', type: 'MegaMenuGroup[]', description: '{ heading, links: { label, href, description?, icon?, badge? }[] }.' },
      { name: 'label', type: 'string', description: 'Accessible name for the nav landmark.' },
      { name: 'openDelay', type: 'number', defaultValue: '150', description: 'Hover rest time before opening, in ms.' },
      { name: 'closeDelay', type: 'number', defaultValue: '200', description: 'Grace after the pointer leaves, in ms.' },
    ],
  },

  'back-to-top': {
    description:
      'A floating button that appears once the reader is past a threshold, returns them to the top and moves focus there too, with an optional ring showing how far down the page they are.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: BackToTopExample,
        note: motionNote('the scroll to the top is instant instead of smooth.'),
      },
      rationale(
        'On a long page, scrolling back is tedious — and a button that only scrolls leaves keyboard focus at the bottom, so the next Tab jumps straight back down.',
        'Focus moves to the skip-link target along with the scroll, the button leaves the tab order while hidden, and scroll is read once a frame.',
        'Documentation, long articles, changelogs, search results.',
        ['internal glyphs'],
      ),
    ],
    props: [
      { name: 'threshold', type: 'number', defaultValue: '400', description: 'Pixels scrolled before it appears.' },
      { name: 'target', type: 'RefObject<HTMLElement>', description: 'Scrolling element. Omit for the window.' },
      { name: 'focusTarget', type: 'string', defaultValue: "'#main, main'", description: 'Selector for the element focused at the top.' },
      { name: 'showProgress', type: 'boolean', defaultValue: 'false', description: 'Draw a scroll-progress ring round the button.' },
      { name: 'label', type: 'string', defaultValue: "'Back to top'", description: 'Accessible name and tooltip.' },
      { name: 'side', type: "'left' | 'right'", defaultValue: 'right', description: 'Corner it floats in.' },
      { name: 'fixed', type: 'boolean', defaultValue: 'true', description: 'Pin to the viewport, or position inside a container.' },
    ],
  },

  'toggle-button': {
    description:
      'A single button that stays pressed, announced with aria-pressed. It takes Button’s variants and sizes, fills with the accent when on, and can swap its glyph — while its label stays the same in both states.',
    sections: [
      { title: 'Example', Content: ToggleButtonExample },
      {
        title: 'Sizes and variants',
        specimens: [
          { label: 'outline → accent', node: <ToggleButton>Follow</ToggleButton> },
          { label: 'pressed', node: <ToggleButton defaultPressed>Follow</ToggleButton> },
          { label: 'sm', node: <ToggleButton size="sm">Pin</ToggleButton> },
          { label: 'disabled', node: <ToggleButton disabled>Pin</ToggleButton> },
        ],
      },
      rationale(
        'Bold, Mute, Star and Follow are actions that stick. A Switch announces them as settings and a Checkbox as form data; neither is right.',
        'aria-pressed on a real button is announced as a toggle. The label never flips to its opposite, which would be read as “Unmute, pressed”.',
        'Editor toolbars, media controls, follow and star buttons, filter chips that are not a group.',
        ['Button', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The label. Keep it the same in both states.' },
      { name: 'pressed / defaultPressed', type: 'boolean', defaultValue: 'false', description: 'Controlled or starting state.' },
      { name: 'onPressedChange', type: '(pressed: boolean) => void', description: 'Called with the new state.' },
      { name: 'variant / pressedVariant', type: 'ButtonVariant', defaultValue: "'outline' / 'accent'", description: 'Look when off and when on.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: 'md', description: 'Same heights as Button.' },
      { name: 'icon / pressedIcon', type: 'IconComponent', description: 'Glyph, and the one shown while pressed.' },
      { name: 'iconOnly', type: 'boolean', defaultValue: 'false', description: 'Hide the label visually; it is still announced.' },
    ],
  },
}
