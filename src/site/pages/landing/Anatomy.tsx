import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Layers, Move3d } from 'lucide-react'
import {
  AvatarGroup,
  Badge,
  Button,
  Field,
  Input,
  Reveal,
  SegmentedControl,
  Slider,
  Surface,
  Switch,
  Text,
  cn,
} from 'klyv'
import { LandingSection } from './primitives'

/**
 * An exploded view of a real card: the teardown diagram hardware is sold
 * with, done to a working interface.
 *
 * The card is ordinary components. Pulling the slider tilts it back and lifts
 * each component off the one it sits in, so the composition — surface, field,
 * input, control, button — stands apart as floating layers, each named on its
 * edge. Only the named components lift; everything else rides on its layer,
 * so the teardown reads as eight parts rather than a hundred boxes. Nothing is
 * redrawn: it is the live DOM in 3D, so the input still takes typing and the
 * switch still switches while it is apart. Dragging the stage orbits it.
 *
 * The lift is on thin wrappers this file owns, through the individual
 * `translate` property, so no component's own transform is touched — a
 * switch's thumb keeps its position. Clipping flattens 3D, so overflow is let
 * out only while it is apart (landing.css).
 */
export function Anatomy() {
  const [explode, setExplode] = useState(0)
  const [orbit, setOrbit] = useState({ x: 0, y: 0 })
  const frame = useRef(0)
  const explodeRef = useRef(explode)
  explodeRef.current = explode

  // The button's sweep: eased, and instant when motion is unwelcome.
  const animateTo = useCallback(
    (target: number) => {
      cancelAnimationFrame(frame.current)
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setExplode(target)
        return
      }
      const from = explodeRef.current
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 900)
        const eased = 1 - Math.pow(1 - t, 3)
        setExplode(from + (target - from) * eased)
        if (t < 1) frame.current = requestAnimationFrame(step)
      }
      frame.current = requestAnimationFrame(step)
    },
    [],
  )
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // Drag to orbit; the card itself keeps its own pointer events, so this
  // listens on the stage's empty ground only.
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    drag.current = { x: event.clientX, y: event.clientY, ox: orbit.x, oy: orbit.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    setOrbit({
      x: Math.max(-40, Math.min(40, start.ox + (event.clientX - start.x) * 0.25)),
      y: Math.max(-25, Math.min(25, start.oy - (event.clientY - start.y) * 0.2)),
    })
  }
  const endDrag = () => {
    drag.current = null
  }

  const apart = explode > 0.001
  const sceneStyle = {
    '--anatomy-e': explode,
    transform: `rotateX(${explode * 52 + orbit.y}deg) rotateZ(${explode * -32 + orbit.x}deg) scale(${1 - explode * 0.14})`,
  } as CSSProperties

  return (
    <LandingSection
      id="anatomy"
      index={7}
      eyebrow="Anatomy"
      title="Take a card apart."
      tail="Every layer is a component."
      lede="Pull the slider and a working card comes apart into the components it is made of, each named on its edge. It is the live interface in 3D, not a drawing: type in the field or flip the switch while it floats."
    >
      <Reveal>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div
            role="group"
            aria-label="Exploded view of an invite card"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={cn(
              'anatomy-stage relative flex min-h-[520px] touch-pan-y items-center justify-center overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface-sunken',
              apart && 'cursor-grab active:cursor-grabbing',
            )}
          >
            <div aria-hidden className="landing-dots pointer-events-none absolute inset-0 opacity-70" />
            <div className={cn('anatomy-scene relative w-full max-w-[400px]', apart && 'is-apart')} style={sceneStyle}>
              <InviteCard />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <Text as="label" htmlFor="anatomy-explode" size="label" weight="semibold">
                  Explode
                </Text>
                <Text as="span" size="label" weight="bold" tabular>
                  {Math.round(explode * 100)}%
                </Text>
              </div>
              <Slider
                id="anatomy-explode"
                min={0}
                max={100}
                value={Math.round(explode * 100)}
                onChange={(event) => {
                  cancelAnimationFrame(frame.current)
                  setExplode(Number(event.target.value) / 100)
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => animateTo(explode > 0.5 ? 0 : 1)} className="h-10 px-5">
                <Layers size={15} aria-hidden />
                {explode > 0.5 ? 'Put it back' : 'Take it apart'}
              </Button>
              {(orbit.x !== 0 || orbit.y !== 0) && (
                <Button variant="ghost" onClick={() => setOrbit({ x: 0, y: 0 })} className="h-10">
                  Reset view
                </Button>
              )}
            </div>
            <Text size="caption" tone="soft" leading="normal" className="flex items-start gap-2">
              <Move3d size={15} aria-hidden className="mt-0.5 shrink-0 text-ink-faint" />
              Drag the empty space around the card to orbit it.
            </Text>
            <ul className="flex flex-col gap-1.5 border-t border-line pt-4">
              {LAYERS.map((name) => (
                <li key={name} className="flex items-center gap-2">
                  <span aria-hidden className="size-1.5 rounded-full bg-accent-strong" />
                  <Text as="span" size="caption" weight="bold" className="font-mono text-[12px]">
                    {`<${name} />`}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </LandingSection>
  )
}

/** The components in the card, outermost first — the order they lift. */
const LAYERS = ['Surface', 'AvatarGroup', 'Badge', 'Field', 'Input', 'SegmentedControl', 'Switch', 'Button']

/** A named layer: a box around exactly one component, labelled when apart. */
function Layer({ name, inline = false, className, children }: { name: string; inline?: boolean; className?: string; children: ReactNode }) {
  const Tag = inline ? 'span' : 'div'
  return (
    <Tag data-layer={name} className={cn('anatomy-layer', inline ? 'inline-flex' : 'block', className)}>
      {children}
    </Tag>
  )
}

type Role = 'member' | 'admin'

/** An ordinary invite card, working, made of the components it names. */
function InviteCard() {
  const [role, setRole] = useState<Role>('member')
  const [notify, setNotify] = useState(true)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <Layer name="Surface">
      <Surface variant="card" padding="lg" className="gap-5 shadow-[var(--shadow-float)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <Text as="h3" size="heading" className="text-[16px]">
                Invite a teammate
              </Text>
              <Layer name="Badge" inline>
                <Badge>Pro</Badge>
              </Layer>
            </span>
            <Text size="caption" tone="soft">
              They join the Northwind workspace
            </Text>
          </div>
          <Layer name="AvatarGroup" inline>
            <AvatarGroup size="sm" max={3} people={[{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }, { name: 'Alan Turing' }, { name: 'Katherine Johnson' }]} />
          </Layer>
        </div>

        <Layer name="Field">
          <Field label="Email">
            <Layer name="Input">
              <Input
                type="email"
                placeholder="ada@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setSent(false)
                }}
              />
            </Layer>
          </Field>
        </Layer>

        <Layer name="SegmentedControl">
          <SegmentedControl<Role>
            label="Role"
            fullWidth
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'member', label: 'Member' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        </Layer>

        <label className="flex items-center justify-between gap-3">
          <Text as="span" size="label" weight="semibold">
            Email them a welcome
          </Text>
          <Layer name="Switch" inline>
            <Switch checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          </Layer>
        </label>

        <Layer name="Button">
          <Button className="w-full" onClick={() => setSent(true)}>
            {sent ? 'Invite sent' : 'Send invite'}
          </Button>
        </Layer>
      </Surface>
    </Layer>
  )
}
