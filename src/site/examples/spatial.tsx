import { useState } from 'react'
import {
  Bell,
  CreditCard,
  Home,
  LineChart,
  PieChart,
  Send,
  Settings,
  Wallet,
} from 'lucide-react'
import {
  CoverFlow,
  Dock,
  DotGlobe,
  IconTile,
  LayerStack,
  OrbitRing,
  SegmentedControl,
  Surface,
  Tag,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

interface Plan {
  id: string
  name: string
  price: string
  cashback: string
  tone: string
}

const PLANS: Plan[] = [
  { id: 'basic', name: 'Basic', price: '$0', cashback: '0.5%', tone: 'bg-surface-muted' },
  { id: 'plus', name: 'Plus', price: '$9', cashback: '1.5%', tone: 'bg-accent-soft' },
  { id: 'pro', name: 'Pro', price: '$19', cashback: '2.5%', tone: 'bg-accent' },
  { id: 'business', name: 'Business', price: '$39', cashback: '3%', tone: 'bg-surface-muted' },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', cashback: '4%', tone: 'bg-surface-muted' },
]

const MARKERS = [
  { lat: 51.5, lng: -0.12, label: 'London — head office', pulse: true },
  { lat: 40.71, lng: -74, label: 'New York' },
  { lat: 52.37, lng: 4.9, label: 'Amsterdam' },
  { lat: 1.35, lng: 103.82, label: 'Singapore' },
  { lat: -33.87, lng: 151.21, label: 'Sydney' },
  { lat: 19.43, lng: -99.13, label: 'Mexico City' },
  { lat: 28.61, lng: 77.21, label: 'New Delhi' },
]

/* ----------------------------------------------------------- specimens */

function CoverFlowExample() {
  const [index, setIndex] = useState(2)

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <CoverFlow
        items={PLANS}
        itemId={(plan) => plan.id}
        index={index}
        onIndexChange={setIndex}
        label="Plans"
        cardWidth={190}
        className="h-[250px] w-full"
        renderItem={(plan, { selected }) => (
          <Surface
            variant="card"
            padding="lg"
            className={`h-[200px] items-start gap-2 ${selected ? 'shadow-[var(--shadow-window)]' : ''}`}
          >
            <span className={`h-9 w-9 rounded-[var(--radius-glyph)] ${plan.tone}`} aria-hidden="true" />
            <Text size="subtitle" className="mt-1">
              {plan.name}
            </Text>
            <Text size="title" tabular>
              {plan.price}
            </Text>
            <Text size="caption" tone="faint">
              {plan.cashback} cashback
            </Text>
          </Surface>
        )}
      />
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {PLANS[index].name} selected. Click a side card, drag the track, or use the arrow keys.
      </Text>
    </div>
  )
}

function OrbitExample() {
  const tile = (icon: typeof Wallet) => (
    <Surface variant="floating" className="h-11 w-11 items-center justify-center rounded-full border border-line">
      <IconTile icon={icon} size="sm" />
    </Surface>
  )

  return (
    <div className="flex w-full justify-center py-4">
      <OrbitRing
        label="Everything connected to your account"
        radius={130}
        duration={30}
        items={[
          { id: 'card', node: tile(CreditCard), label: 'Cards' },
          { id: 'send', node: tile(Send), label: 'Transfers' },
          { id: 'reports', node: tile(PieChart), label: 'Reports' },
          { id: 'alerts', node: tile(Bell), label: 'Alerts' },
          { id: 'settings', node: tile(Settings), label: 'Settings' },
        ]}
      >
        <OrbitRing
          label="Inner ring"
          radius={72}
          duration={19}
          reverse
          offset={36}
          showPath={false}
          items={[
            { id: 'wallet', node: tile(Wallet), label: 'Wallet' },
            { id: 'trends', node: tile(LineChart), label: 'Trends' },
            { id: 'home', node: tile(Home), label: 'Home' },
          ]}
        >
          <Surface
            variant="card"
            className="h-[92px] w-[92px] items-center justify-center gap-0.5 rounded-full"
          >
            <Text size="caption" tone="faint">
              Balance
            </Text>
            <Text size="stat" tabular>
              $27,829
            </Text>
          </Surface>
        </OrbitRing>
      </OrbitRing>
    </div>
  )
}

function LayerStackExample() {
  const [layer, setLayer] = useState('level-2')

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <LayerStack
        label="Library architecture"
        value={layer}
        onValueChange={setLayer}
        width={280}
        layers={[
          { id: 'tokens', label: 'Design Tokens', description: 'Colour, radius, elevation, motion.' },
          { id: 'foundations', label: 'Foundations', description: 'The type scale and the container recipes.' },
          { id: 'forms', label: 'Forms & Inputs', description: '37 ways to capture a value.' },
          { id: 'charts', label: 'Charts', description: '17 plots and diagrams, drawn by hand.' },
          { id: 'canvas', label: 'Canvas & Play', description: 'Generative, audio and physics on top of all of it.', accent: true },
        ]}
      />
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Click a plate to lift it, or focus one and use the arrow keys.
      </Text>
    </div>
  )
}

function DockExample() {
  const [opened, setOpened] = useState<string | null>(null)

  return (
    <div className="flex w-full flex-col items-center gap-3 py-2">
      <Dock
        label="Application dock"
        items={[
          { id: 'home', label: 'Overview', icon: Home, active: true, onSelect: () => setOpened('Overview') },
          { id: 'cards', label: 'Cards', icon: CreditCard, onSelect: () => setOpened('Cards') },
          { id: 'send', label: 'Send money', icon: Send, onSelect: () => setOpened('Send money') },
          { id: 'reports', label: 'Reports', icon: PieChart, onSelect: () => setOpened('Reports') },
          { id: 'alerts', label: 'Alerts', icon: Bell, badge: 3, onSelect: () => setOpened('Alerts') },
          { id: 'settings', label: 'Settings', icon: Settings, onSelect: () => setOpened('Settings') },
        ]}
      />
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {opened ? `Opened ${opened}.` : 'Move the pointer along the bar.'}
      </Text>
    </div>
  )
}

function GlobeExample() {
  const [markers, setMarkers] = useState(true)

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <SegmentedControl
        label="Markers"
        size="sm"
        value={markers ? 'on' : 'off'}
        onValueChange={(value) => setMarkers(value === 'on')}
        options={[
          { value: 'on', label: 'With offices' },
          { value: 'off', label: 'Bare sphere' },
        ]}
      />
      <DotGlobe
        label="Offices worldwide"
        markers={markers ? MARKERS : []}
        size={280}
        duration={30}
      />
      {markers && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {MARKERS.map((marker) => (
            <Tag key={marker.label} size="sm" tone={marker.pulse ? 'accent' : 'neutral'}>
              {marker.label}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'cover-flow': {
    description:
      'A carousel with depth: the selected card faces you and its neighbours turn away into the distance. Every card is one transform computed from its signed distance to the selection, while z-index comes from the absolute distance — which is what stops a far card painting over a near one.',
    sections: [
      {
        title: 'Example',
        description: 'Click a side card, drag the track, or use the arrow keys, Home and End.',
        bare: true,
        Content: CoverFlowExample,
        note: motionNote('cards jump to their positions rather than travelling; the layout is identical.'),
      },
      rationale(
        'A row of five plans in a grid gives no focus — every card competes equally, which is the opposite of what a pricing page is for.',
        'Depth makes the choice at hand unmistakable while keeping its neighbours legible, and it is one transform per card rather than a layout animation.',
        'A plan chooser, a card wallet, a gallery, an onboarding step with a handful of options.',
        ['Surface', 'Text', 'CSS 3D transforms'],
      ),
    ],
    props: [
      { name: 'items / itemId / renderItem', type: 'T[] / fn / fn', description: 'The set, a stable key, and the face of one card.' },
      { name: 'index / onIndexChange', type: 'number / fn', description: 'Selection. Omit for uncontrolled.' },
      { name: 'cardWidth / spread', type: 'number / number', defaultValue: '200 / 116', description: 'Card width, and the step between neighbours.' },
      { name: 'rotation / perspective', type: 'number / number', defaultValue: '42 / 1100', description: 'How far a side card turns, and the depth of the scene.' },
      { name: 'depth', type: 'number', defaultValue: '3', description: 'Cards drawn either side of the selected one.' },
    ],
  },

  'orbit-ring': {
    description:
      'Items travelling a circle around a centre. Each one counter-rotates at exactly the ring rate so it stays upright — without that, logos arrive upside down at the bottom of the orbit, which is the single thing that makes this pattern look broken.',
    sections: [
      {
        title: 'Nested rings',
        description: 'A second ring inside the first, turning the other way at a different rate.',
        bare: true,
        Content: OrbitExample,
        note: motionNote('both rings stop; every item stays where it is and reads normally.'),
      },
      rationale(
        'An integrations or ecosystem section is usually a static grid of logos, which says these exist but not that they revolve around anything.',
        'Two CSS animations put the relationship on screen without asking JavaScript for a single frame, and hovering stops the ring so anything on it can be read.',
        'An integrations page, a "works with" section, a hero for a platform product.',
        ['Surface', 'IconTile', 'VisuallyHidden', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'items', type: 'OrbitItem[]', description: 'id, node and a label — the label is what assistive technology gets.' },
      { name: 'radius / duration', type: 'number / number', defaultValue: '120 / 26', description: 'Ring size, and seconds per revolution.' },
      { name: 'reverse / offset', type: 'boolean / number', defaultValue: 'false / 0', description: 'Direction, and the starting angle — offset a nested ring so items never line up.' },
      { name: 'pauseOnHover', type: 'boolean', defaultValue: 'true', description: 'Stop on hover and focus-within.' },
      { name: 'children', type: 'ReactNode', description: 'The centre. Nest another ring here.' },
    ],
  },

  'dot-globe': {
    description:
      'A slowly turning sphere of dots with places marked on it. The dots are a golden-angle spiral rather than a lat/long grid, because a grid bunches its points at the poles and the crowding is obvious the moment the globe turns.',
    sections: [
      {
        title: 'Example',
        description: 'Markers are placed by latitude and longitude, and dim as they pass behind.',
        bare: true,
        Content: GlobeExample,
        note: motionNote('one frame is painted and the globe holds still, markers included.'),
      },
      rationale(
        'A worldwide claim is normally made with a flat map image, which cannot be themed, goes stale, and carries no text.',
        'A few hundred lines of canvas gives the same claim with real marker data, tokens for colour, and every place name still readable as text.',
        'A landing page, an about section, a coverage or availability map, a status page.',
        ['canvas', 'VisuallyHidden', 'usePrefersReducedMotion', 'line tokens'],
      ),
    ],
    props: [
      { name: 'markers', type: 'GlobeMarker[]', description: '{ lat, lng, label, pulse }. Also listed as text beside the picture.' },
      { name: 'size / dots', type: 'number / number', defaultValue: '260 / 900', description: 'Canvas size, and how many points make up the sphere.' },
      { name: 'duration / tilt', type: 'number / number', defaultValue: '26 / 18', description: 'Seconds per rotation, and axial tilt in degrees.' },
      { name: 'dotColor / markerColor', type: 'string / string', defaultValue: 'ink-faint / accent', description: 'Resolved from the tokens once — canvas cannot read a CSS variable.' },
    ],
  },

  'layer-stack': {
    description:
      'An exploded isometric stack, one plate per layer, the selected one lifted clear. The isometry is two rotations on a shared parent rather than a per-plate skew, so the plates stay coplanar and parallel edges stay parallel.',
    sections: [
      {
        title: 'The library, as a stack',
        description: 'Click a plate, or focus one and use the arrow keys.',
        bare: true,
        Content: LayerStackExample,
        note: motionNote('the selected plate is lifted without a transition; the diagram still reads.'),
      },
      rationale(
        'Architecture is explained with an exported diagram that goes stale, or with a bulleted list that loses the fact that layers sit on top of each other.',
        'Real plates carry real text, take their colours from the tokens, and the one being discussed can be lifted out — so the picture and the explanation are the same object.',
        'A documentation page, an architecture overview, an onboarding explainer, a systems diagram.',
        ['Text', 'CSS 3D transforms', 'radius and shadow tokens'],
      ),
    ],
    props: [
      { name: 'layers', type: 'StackLayer[]', description: 'Bottom of the stack first, so the array reads like the diagram.' },
      { name: 'separation / lift', type: 'number / number', defaultValue: '58 / 26', description: 'Gap between plates, and the extra rise of the selected one.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Selected layer id. Omit for uncontrolled.' },
      { name: 'width', type: 'number', defaultValue: '300', description: 'Plate width in pixels.' },
    ],
  },

  dock: {
    description:
      'A bar of tiles that swell towards the pointer. The magnification is a distance falloff rather than a hover state, so the bar deforms as one curve instead of one tile popping while its neighbours sit still.',
    sections: [
      {
        title: 'Example',
        description: 'Move along the bar. Labels appear over whichever tile is largest.',
        bare: true,
        Content: DockExample,
        note: motionNote('the tiles stop scaling; the bar stays a working toolbar.'),
      },
      rationale(
        'A compact bar of primary destinations has to stay small enough to ignore and large enough to hit — those pull in opposite directions.',
        'Magnifying towards the pointer resolves it: small at rest, large exactly where the hand already is. The scale is written to a CSS variable per frame, so React renders the dock once.',
        'A persistent app bar, a floating tool palette, a compact bottom navigation.',
        ['Text', 'IconComponent', 'requestAnimationFrame', 'shadow tokens'],
      ),
    ],
    props: [
      { name: 'items', type: 'DockItem[]', description: 'id, label, icon, onSelect, badge, active, disabled.' },
      { name: 'size', type: 'number', defaultValue: '44', description: 'Resting tile size in pixels.' },
      { name: 'magnification', type: 'number', defaultValue: '1.75', description: 'How much the tile under the pointer grows.' },
      { name: 'reach', type: 'number', defaultValue: '110', description: 'How far either side the magnification carries.' },
    ],
  },
}
