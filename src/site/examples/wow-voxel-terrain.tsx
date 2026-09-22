import { useRef, useState } from 'react'
import {
  Badge,
  Button,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  VoxelTerrain,
  type VoxelTerrainHandle,
  type VoxelTerrainTone,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

function VoxelHeroExample() {
  return (
    <VoxelTerrain quality="high" aspectRatio="16 / 8" label="A voxel terrain flyover over lakes and mountains. Drag or use the arrow keys to steer.">
      <div className="flex max-w-[420px] flex-col items-start gap-2 p-6 sm:p-8">
        <Badge tone="neutral">Voxel space</Badge>
        <Text as="h3" size="heading" weight="extrabold" leading="tight" className="tracking-[-0.02em]">
          A million heights, no polygons
        </Text>
      </div>
    </VoxelTerrain>
  )
}

function VoxelPlaygroundExample() {
  const terrain = useRef<VoxelTerrainHandle>(null)
  const [tone, setTone] = useState<VoxelTerrainTone>('terrain')
  const [roughness, setRoughness] = useState(50)
  const [water, setWater] = useState(26)
  const [fog, setFog] = useState(35)
  const [speed, setSpeed] = useState(10)
  const [autoFly, setAutoFly] = useState(true)
  const [paused, setPaused] = useState(false)
  const [map, setMap] = useState(true)
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Colours"
        size="sm"
        value={tone}
        onValueChange={setTone}
        options={[
          { value: 'terrain', label: 'Terrain bands' },
          { value: 'accent', label: 'Accent' },
          { value: 'ink', label: 'Ink' },
        ]}
      />
      <VoxelTerrain
        ref={terrain}
        seed={2024}
        tone={tone}
        roughness={roughness / 100}
        waterLevel={water / 100}
        fog={fog / 100}
        speed={speed / 10}
        autoFly={autoFly}
        paused={paused}
        map={map}
        label="Voxel terrain playground"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Roughness · {(roughness / 100).toFixed(2)}
          </Text>
          <Slider min={0} max={100} value={roughness} onChange={(event) => setRoughness(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Water level · {water}%
          </Text>
          <Slider min={0} max={60} value={water} onChange={(event) => setWater(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Fog · {fog}%
          </Text>
          <Slider min={0} max={100} value={fog} onChange={(event) => setFog(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Speed · {(speed / 10).toFixed(1)}×
          </Text>
          <Slider min={0} max={30} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={autoFly} onChange={(event) => setAutoFly(event.target.checked)} />
          Autopilot
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Paused
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={map} onChange={(event) => setMap(event.target.checked)} />
          Overview map
        </label>
        <Button size="sm" variant="outline" onClick={() => terrain.current?.regenerate(2024)}>
          Back to seed 2024
        </Button>
      </div>
      <Text size="caption" tone="faint">
        Roughness and water level rebuild the map from the same seed, so you can watch one coastline flood or one range sharpen.
      </Text>
    </div>
  )
}

function VoxelBannerExample() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <VoxelTerrain seed={77} tone="ink" quality="low" fog={0.6} speed={0.6} interactive={false} map={false} controls={false} aspectRatio="21 / 9" label="" />
        <Text size="caption" tone="soft">
          Low quality, ink tone, not interactive and unlabelled: a decorative strip, hidden from assistive technology.
        </Text>
      </div>
      <div className="flex flex-col gap-2">
        <VoxelTerrain seed={512} tone="accent" roughness={0.8} waterLevel={0.12} quality="medium" controls={false} aspectRatio="21 / 9" label="Jagged accent-toned ridges" />
        <Text size="caption" tone="soft">
          Accent tone with high roughness and little water: crags in one hue, still steerable when focused.
        </Text>
      </div>
    </div>
  )
}

export const demos: ExampleModule = {
  'voxel-terrain': {
    description:
      'Terrain you fly over, rendered as NovaLogic’s Comanche did in 1992 — voxel space. The heightmap is diamond–square midpoint displacement on a 1024² torus: the indices wrap, so every edge is generated from the one opposite and the flight never meets a boundary. Height and slope choose each cell’s colour from bands made of the accent and the ink ramp, and a lambert term from the height gradient shades it. Each screen column is one ray walked front to back with a y-buffer, so a pixel is drawn once by whatever is nearest and a covered column is skipped; the sample step lengthens with distance and fog hides where it stops. It flies itself on a weaving, terrain-following path and hands over to a drag or the keyboard.',
    sections: [
      {
        title: 'Flying over it',
        description: 'Drag to turn and look up or down, or focus it and use the arrow keys. Let go and the autopilot takes back over after a few seconds.',
        Content: VoxelHeroExample,
        bare: true,
        note: motionNote('there is no flight. One still is rendered from a vantage chosen for it — low ground facing the highest peak — and drags and key presses turn the view by fixed steps.'),
      },
      {
        title: 'The generator and the view',
        description: 'Everything that shapes the map or the picture. Switch the theme or accent: the bands, the water and the sky are rebuilt from the tokens.',
        Content: VoxelPlaygroundExample,
      },
      { title: 'Smaller surfaces', description: 'Two settings for banners and section breaks.', Content: VoxelBannerExample },
      rationale(
        'A landscape on a page is usually a photograph or a looping video: heavy, fixed in colour, and nothing to do with the theme around it.',
        'Voxel space draws a convincing 3D landscape on a 2D canvas with no GPU and no geometry, costs a few milliseconds a frame, and takes every colour from the tokens.',
        'Landing heroes for maps, travel, outdoor and games brands; 404 and empty states worth lingering on; anywhere a scene should feel explorable.',
        ['Canvas ImageData', 'Theme tokens', 'SegmentedControl', 'IconButton', 'Button'],
      ),
    ],
    props: [
      { name: 'seed', type: 'number', defaultValue: '1337', description: 'The same seed always makes the same map; changing it generates a new one.' },
      { name: 'onSeedChange', type: '(seed: number) => void', description: 'Called when the map is regenerated from the button or the handle.' },
      { name: 'roughness', type: 'number', defaultValue: '0.5', description: '0–1: rolling downland to crags. Sets the Hurst exponent of the noise.' },
      { name: 'waterLevel', type: 'number', defaultValue: '0.26', description: '0–1: the fraction of the height range under water.' },
      { name: 'tone', type: "'terrain' | 'accent' | 'ink'", defaultValue: "'terrain'", description: 'Banded water, sand, grass, rock and snow; one accent hue; or greyscale.' },
      { name: 'fog', type: 'number', defaultValue: '0.35', description: 'Distance fog, 0–1. The far edge always fades.' },
      { name: 'speed', type: 'number', defaultValue: '1', description: 'Flight speed multiplier.' },
      { name: 'quality', type: "'low' | 'medium' | 'high'", description: 'Controlled: internal resolution, draw distance and step growth.' },
      { name: 'defaultQuality', type: "'low' | 'medium' | 'high'", defaultValue: "'medium'", description: 'Uncontrolled starting quality.' },
      { name: 'onQualityChange', type: '(quality) => void', description: 'Called when the quality buttons change it.' },
      { name: 'interactive', type: 'boolean', defaultValue: 'true', description: 'Steer by dragging and, when focused, with the keyboard.' },
      { name: 'autoFly', type: 'boolean', defaultValue: 'true', description: 'Fly on its own. Off, the camera hovers until steered. Ignored under reduced motion.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Hold the flight still; the view can still be turned by hand.' },
      { name: 'map', type: 'boolean', defaultValue: 'true', description: 'Overview map with your position and heading.' },
      { name: 'label', type: 'string', defaultValue: "'Voxel terrain flyover'", description: 'Accessible name. Empty on a non-interactive terrain makes it decorative.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Pause, vantage, regenerate and quality controls, and the heading readout.' },
      { name: 'aspectRatio', type: 'string', defaultValue: "'16 / 9'", description: 'CSS aspect ratio of the view.' },
      { name: 'ref', type: 'VoxelTerrainHandle', description: '{ regenerate(seed?) } — a new map from code, random when no seed is given.' },
      { name: 'children', type: 'ReactNode', description: 'Content drawn on top, without taking the pointer.' },
    ],
  },
}
