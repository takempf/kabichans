import { WORLD } from './geography'
import type { Point } from './geography'
import { flowerPatches } from './terrain'

export const BUTTERFLY_COUNT = 10
// Above a cat's ears, even one standing tall underneath: startled butterflies
// climb past this, so a chase can never end in a catch.
export const BUTTERFLY_SAFE_HEIGHT = 2.9
// Resting on the flower heads.
export const BUTTERFLY_PERCH_HEIGHT = 0.42
export const BUTTERFLY_COLORS = [
  '#f7e07a',
  '#fbf5e6',
  '#f2a66a',
  '#a8cbea',
  '#f1b3c8',
]
const CRUISE_SPEED = 1.35
const STARTLED_SPEED = 3.3
const MARGIN = 1.5

export interface Butterfly extends Point {
  id: number
  // Height above the ground.
  y: number
  heading: number
  velocity: Point
  color: string
  // Wing beat phase, in radians.
  flap: number
  // Individual rhythm for the fluttering path.
  wobble: number
  cruise: number
  patch: number
  goal: Point
  landing: boolean
  // Seconds left resting on a flower; zero while flying.
  perched: number
  // Seconds left climbing out of reach after a cat came too close.
  startled: number
  nextTemptAt: number
  chaserId: number | null
}

function inBounds(point: Point) {
  return {
    x: Math.min(WORLD.maxX - MARGIN, Math.max(WORLD.minX + MARGIN, point.x)),
    z: Math.min(WORLD.maxZ - MARGIN, Math.max(WORLD.minZ + MARGIN, point.z)),
  }
}

function chooseGoal(butterfly: Butterfly, random: () => number) {
  // Mostly flit around one flower patch, sometimes drift off to another.
  if (random() < 0.28)
    butterfly.patch = Math.floor(random() * flowerPatches.length)
  const patch = flowerPatches[butterfly.patch]
  const angle = random() * Math.PI * 2
  const distance = Math.sqrt(random()) * 3.6
  butterfly.goal = inBounds({
    x: patch.x + Math.sin(angle) * distance,
    z: patch.z + Math.cos(angle) * distance,
  })
  butterfly.landing = random() < 0.4
  butterfly.cruise = 0.95 + random() * 0.85
}

export function createButterflies(random: () => number): Butterfly[] {
  return Array.from({ length: BUTTERFLY_COUNT }, (_, id) => {
    const patch = id % flowerPatches.length
    const angle = random() * Math.PI * 2
    const butterfly: Butterfly = {
      id,
      ...inBounds({
        x: flowerPatches[patch].x + Math.sin(angle) * 2,
        z: flowerPatches[patch].z + Math.cos(angle) * 2,
      }),
      y: 1 + random() * 0.8,
      heading: angle,
      velocity: { x: 0, z: 0 },
      color: BUTTERFLY_COLORS[id % BUTTERFLY_COLORS.length],
      flap: random() * Math.PI * 2,
      wobble: random() * 100,
      cruise: 1.3,
      patch,
      goal: { x: 0, z: 0 },
      landing: false,
      perched: 0,
      startled: 0,
      nextTemptAt: 10 + random() * 30,
      chaserId: null,
    }
    chooseGoal(butterfly, random)
    return butterfly
  })
}

// `threat` is the nearest cat that came too close, if any.
export function stepButterfly(
  butterfly: Butterfly,
  dt: number,
  threat: Point | null,
  random: () => number,
) {
  const ease = (rate: number) => 1 - Math.exp(-dt * rate)
  if (threat) {
    if (butterfly.startled <= 0) {
      // Dart away from the cat, with a little unpredictability.
      const away =
        Math.atan2(butterfly.x - threat.x, butterfly.z - threat.z) +
        (random() - 0.5) * 1.2
      butterfly.goal = inBounds({
        x: butterfly.x + Math.sin(away) * 7,
        z: butterfly.z + Math.cos(away) * 7,
      })
      butterfly.landing = false
    }
    butterfly.startled = 1.4 + random() * 0.8
    butterfly.perched = 0
  }
  butterfly.startled = Math.max(0, butterfly.startled - dt)
  butterfly.flap += dt * (butterfly.startled > 0 ? 27 : 17)

  if (butterfly.perched > 0) {
    butterfly.perched -= dt
    butterfly.velocity.x = 0
    butterfly.velocity.z = 0
    butterfly.y += (BUTTERFLY_PERCH_HEIGHT - butterfly.y) * ease(6)
    if (butterfly.perched <= 0) chooseGoal(butterfly, random)
    return
  }

  const dx = butterfly.goal.x - butterfly.x
  const dz = butterfly.goal.z - butterfly.z
  const distance = Math.hypot(dx, dz)
  if (distance < 0.35) {
    if (butterfly.landing && butterfly.startled <= 0)
      butterfly.perched = 2.5 + random() * 5
    else chooseGoal(butterfly, random)
    return
  }

  // A fluttering path: the heading wanders around the direction of the goal.
  butterfly.wobble += dt
  const t = butterfly.wobble
  const meander =
    (Math.sin(t * 1.9) * 0.8 + Math.sin(t * 0.67 + 1.3) * 0.5) *
    Math.min(1, distance / 2)
  const direction = Math.atan2(dx, dz) + meander
  const speed =
    (butterfly.startled > 0 ? STARTLED_SPEED : CRUISE_SPEED) *
    Math.min(1, 0.35 + distance / 1.5)
  butterfly.velocity.x +=
    (Math.sin(direction) * speed - butterfly.velocity.x) * ease(3.5)
  butterfly.velocity.z +=
    (Math.cos(direction) * speed - butterfly.velocity.z) * ease(3.5)
  Object.assign(
    butterfly,
    inBounds({
      x: butterfly.x + butterfly.velocity.x * dt,
      z: butterfly.z + butterfly.velocity.z * dt,
    }),
  )
  const heading = Math.atan2(butterfly.velocity.x, butterfly.velocity.z)
  butterfly.heading +=
    Math.atan2(
      Math.sin(heading - butterfly.heading),
      Math.cos(heading - butterfly.heading),
    ) * ease(6)

  const height =
    butterfly.startled > 0
      ? BUTTERFLY_SAFE_HEIGHT + 0.5 + Math.sin(t * 2.1) * 0.2
      : butterfly.landing && distance < 1.6
        ? BUTTERFLY_PERCH_HEIGHT + distance * 0.45
        : butterfly.cruise + Math.sin(t * 2.3) * 0.22
  // Climb quickly when startled; settle back down slowly afterwards.
  const rate = height > butterfly.y ? (butterfly.startled > 0 ? 4 : 1.6) : 0.9
  butterfly.y += (height - butterfly.y) * ease(rate)
}
