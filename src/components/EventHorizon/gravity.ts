/**
 * What a singularity does to a rectangle.
 *
 * The maths is not a simulation of general relativity — it is the part of it
 * a reader recognises, in the units a layout is measured in. A body is pulled
 * along the line to the hole by an inverse-square law softened near the
 * centre, sheared out along that line (tidal stretching, the "spaghetti" of
 * every black hole illustration), turned by the hole's spin as it falls, and
 * faded as it crosses the horizon. Beyond `reach` nothing is touched at all,
 * so a page full of elements costs nothing away from the hole.
 */

export interface GravityBody {
  /** Centre of the element, in the field's own pixel space. */
  x: number
  y: number
  /** Half the element's width and height — its own scale. */
  halfWidth: number
  halfHeight: number
}

export interface GravityField {
  /** Centre of the hole, in the same pixel space. */
  x: number
  y: number
  /** Radius of the event horizon in pixels: inside it, a body is gone. */
  horizon: number
  /** How far the pull is felt, in pixels. */
  reach: number
  /** Overall strength, 1 being the tuned default. */
  strength: number
  /** Turn per unit of pull, in degrees: the hole's rotation, dragged into the disc. */
  spin: number
}

export interface GravityEffect {
  /** Pixels to move, toward the hole. */
  dx: number
  dy: number
  /** Scale along the line to the hole, and across it. */
  stretch: number
  squeeze: number
  /** Degrees to turn, as the hole's spin drags the body round. */
  rotate: number
  /** How much of the body is left to see, 0–1. */
  opacity: number
  /** Direction of the hole, in degrees: the axis the stretch is on. */
  angle: number
  /** 0 outside the reach, 1 at the horizon: what everything above is scaled by. */
  pull: number
}

export const NO_EFFECT: GravityEffect = { dx: 0, dy: 0, stretch: 1, squeeze: 1, rotate: 0, opacity: 1, angle: 0, pull: 0 }

/** The pull is softened over this multiple of the horizon, so the centre is finite. */
const SOFTENING = 1.8
/** Gone by this multiple of the horizon; whole again by the one after it. */
const SWALLOW_AT = 0.6
const VISIBLE_AT = 1.4

/**
 * The pull on one body.
 *
 * Inverse-square, softened over a multiple of the horizon so a body at the
 * centre does not divide by zero and fly off, and taken to nothing at `reach`
 * so there is no seam where the field stops: a plain 1/d² would still be
 * moving things a screen away by a fraction of a pixel, which reads as drift
 * rather than as gravity.
 */
export function gravityEffect(body: GravityBody, field: GravityField): GravityEffect {
  const dx = field.x - body.x
  const dy = field.y - body.y
  const distance = Math.hypot(dx, dy)
  if (distance > field.reach) return NO_EFFECT

  const softening = Math.max(1, field.horizon * SOFTENING)
  const raw = (softening * softening) / (distance * distance + softening * softening)
  // Taper to zero at the edge of the reach, so nothing outside it moves.
  const edge = 1 - distance / field.reach
  const pull = Math.min(1, raw * edge * field.strength)

  const angle = Math.atan2(dy, dx)
  // A body cannot be pulled past the centre: at most, it arrives.
  const travel = Math.min(distance, distance * pull * 1.35)
  // It thins out as it approaches the horizon, and is gone inside it.
  const span = Math.max(1, field.horizon * (VISIBLE_AT - SWALLOW_AT))
  const swallowed = Math.min(1, Math.max(0, (field.horizon * VISIBLE_AT - distance) / span))

  return {
    dx: Math.cos(angle) * travel,
    dy: Math.sin(angle) * travel,
    stretch: 1 + pull * 1.15,
    squeeze: Math.max(0.05, 1 - pull * 0.75),
    rotate: pull * field.spin,
    opacity: 1 - swallowed,
    angle: (angle * 180) / Math.PI,
    pull,
  }
}

/**
 * The effect as one transform.
 *
 * The stretch is along the line to the hole, and `scale` has no axis of its
 * own, so the body is turned onto that line, stretched along its own x, and
 * turned back — a shear written as rotations. Written as one `transform`
 * rather than to the individual properties because those cannot express a
 * shear, and the pair of rotations cancels exactly when there is no pull, so
 * a body at the edge of the field is not left quietly tilted.
 */
export function gravityTransform(effect: GravityEffect): string {
  if (effect.pull === 0) return ''
  const axis = effect.angle.toFixed(2)
  return (
    `translate(${effect.dx.toFixed(2)}px, ${effect.dy.toFixed(2)}px) ` +
    `rotate(${axis}deg) scale(${effect.stretch.toFixed(3)}, ${effect.squeeze.toFixed(3)}) rotate(-${axis}deg) ` +
    `rotate(${effect.rotate.toFixed(2)}deg)`
  )
}
