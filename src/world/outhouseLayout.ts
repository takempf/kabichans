import { JANITOR_CART, OUTHOUSE_SIZE } from './geography'
import type { Point } from './geography'

const FRONT = OUTHOUSE_SIZE.depth / 2

// Each visit leaves the litter a little worse. Past DIRTY a janitor comes to
// scoop it out; past FILTHY nobody will set paw inside until they have.
export const OUTHOUSE_VISIT_DIRT = 0.2
export const OUTHOUSE_DIRTY = 0.5
export const OUTHOUSE_FILTHY = 1

// The walk through the cat flap, from the step outside to out of sight.
export function outhouseDoorway(outhouse: Point) {
  return {
    threshold: { x: outhouse.x, z: outhouse.z + FRONT + 2.2 },
    door: { x: outhouse.x, z: outhouse.z + FRONT },
    inside: { x: outhouse.x, z: outhouse.z + FRONT - 1.4 },
    // A janitor leans in this far to scoop, tail out the door.
    scrub: { x: outhouse.x, z: outhouse.z + FRONT + 0.5 },
    // Where a janitor waits, off the step, for whoever is inside.
    side: { x: outhouse.x + 2.4, z: outhouse.z + FRONT + 2.8 },
  }
}

// Where visitors step out to, away from the line.
export function outhouseExitSpots(outhouse: Point): Point[] {
  return [
    { x: outhouse.x - 1.2, z: outhouse.z + FRONT + 4.9 },
    { x: outhouse.x - 0.2, z: outhouse.z + FRONT + 7.1 },
  ]
}

// One line for both doors, running east along the back fence, front first.
// Whoever is at the front takes the next door to come free.
export const OUTHOUSE_LINE: Point[] = [
  { x: -29.6, z: -42.8 },
  { x: -27.3, z: -42.8 },
  { x: -25.0, z: -42.8 },
  { x: -22.7, z: -42.8 },
]

// Janitors stand along the back fence between jobs, leaving a way past
// behind the line, and new ones sign in beside the cart.
export const JANITOR_POSTS: Point[] = [
  { x: -30.0, z: -48.6 },
  { x: -27.6, z: -48.6 },
  { x: -25.2, z: -48.6 },
  { x: -22.8, z: -48.4 },
]
export const JANITOR_SIGN_IN: Point = { x: -19.8, z: -45.2 }
export { JANITOR_CART }

// Loungers, gatherings, and queasy moments stay out of the outhouse yard.
export function isInOuthouseYard(x: number, z: number, clearance = 0) {
  return x < -18.6 + clearance && z < -37 + clearance
}
