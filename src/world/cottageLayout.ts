import { COTTAGE_SIZE, houses } from './geography'
import type { Point } from './geography'

// Residents inside, plus any on their way in.
export const COTTAGE_CAPACITY = 4
export const COTTAGE_LINE_LENGTH = 3
const FRONT = COTTAGE_SIZE.depth / 2

// The walk through the front door, from the step outside to out of sight.
export function cottageDoorway(house: Point) {
  return {
    // Clear of the walls, where a resident steps off the meadow.
    threshold: { x: house.x, z: house.z + FRONT + 2.3 },
    door: { x: house.x, z: house.z + FRONT },
    inside: { x: house.x, z: house.z + FRONT - 1.6 },
  }
}

// A single-file line beside the door, so whoever goes in next never has to
// squeeze past anyone still waiting.
export function cottageLineSpot(house: Point, place: number): Point {
  return { x: house.x + 2.4, z: house.z + FRONT + 2.6 + place * 2.3 }
}

// Where residents step out to, on the side of the door away from the line.
export function cottageExitSpots(house: Point): Point[] {
  return [
    { x: house.x - 0.4, z: house.z + FRONT + 4.8 },
    { x: house.x - 2.6, z: house.z + FRONT + 4 },
    { x: house.x - 1.2, z: house.z + FRONT + 7 },
  ]
}

// Keep lounging, gatherings, and queasy moments out of the way of the door.
export function isInCottageDoorway(x: number, z: number, clearance = 0) {
  return houses.some(
    (house) =>
      Math.abs(x - house.x) < 4.2 + clearance &&
      z > house.z + FRONT - clearance &&
      z < house.z + FRONT + 10.2 + clearance,
  )
}
