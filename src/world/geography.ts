export interface Point {
  x: number
  z: number
}
export interface Obstacle extends Point {
  radius: number
}

// Fence centerlines stay fixed; navigation clears the widest post footings.
export const FENCE_BOUNDS = { minX: -43, maxX: 49, minZ: -51, maxZ: 30 }
export const FENCE_INSET = 0.35
export const WORLD = {
  minX: FENCE_BOUNDS.minX + FENCE_INSET,
  maxX: FENCE_BOUNDS.maxX - FENCE_INSET,
  minZ: FENCE_BOUNDS.minZ + FENCE_INSET,
  maxZ: FENCE_BOUNDS.maxZ - FENCE_INSET,
}

export const trees: Obstacle[] = [
  { x: -18, z: -10, radius: 1.7 },
  { x: 9, z: -9, radius: 1.7 },
  { x: -23, z: 6, radius: 1.7 },
  { x: 12, z: 9, radius: 1.7 },
  { x: -10, z: -23, radius: 1.7 },
  { x: 6, z: -28, radius: 1.7 },
  { x: -29, z: -25, radius: 1.7 },
  { x: 11, z: -32, radius: 1.7 },
  { x: -31, z: 19, radius: 1.7 },
  { x: 15, z: 23, radius: 1.7 },
  { x: -21, z: -39, radius: 1.7 },
  { x: -2, z: -42, radius: 1.7 },
  { x: 13, z: -43, radius: 1.7 },
  { x: -36, z: -6, radius: 1.7 },
  // Across the creek
  { x: 40, z: 20, radius: 1.7 },
  { x: 43, z: -15, radius: 1.7 },
]
// Two big boulders on the east bank.
export const rocks: Obstacle[] = [
  { x: 42, z: 3, radius: 2.3 },
  { x: 41, z: -35, radius: 1.8 },
]
// Picnic blankets lie flat along the east bank of the creek, so cats can sit
// on them. `angle` turns the blanket about its center.
export interface PicnicBlanket extends Point {
  width: number
  depth: number
  angle: number
  color: string
}
export const picnicBlankets: PicnicBlanket[] = [
  { x: 30.5, z: 13, width: 3.8, depth: 3, angle: 0.25, color: '#d9796b' },
  { x: 30, z: -9, width: 3.6, depth: 2.9, angle: -0.2, color: '#7fa5c9' },
  { x: 35.5, z: -25, width: 3.8, depth: 3, angle: 0.45, color: '#e0b94f' },
]
export function onPicnicBlanket(
  blanket: PicnicBlanket,
  x: number,
  z: number,
  margin = 0,
) {
  const dx = x - blanket.x,
    dz = z - blanket.z
  const cos = Math.cos(blanket.angle),
    sin = Math.sin(blanket.angle)
  return (
    Math.abs(dx * cos - dz * sin) <= blanket.width / 2 - margin &&
    Math.abs(dx * sin + dz * cos) <= blanket.depth / 2 - margin
  )
}
// Cottages are sized for cats, with doors facing south (+z). `radius` is how
// far out their surroundings begin, for lounging nearby.
export const COTTAGE_SIZE = { width: 7, depth: 5.2, doorWidth: 2 }
export const houses: Obstacle[] = [
  { x: -17, z: -22.5, radius: 5 },
  { x: 10, z: -22, radius: 5 },
  { x: -28, z: -37.5, radius: 5 },
]
// Three overlapping circles hug each cottage's rectangular walls.
export const houseObstacles: Obstacle[] = houses.flatMap((house) =>
  [-1.8, 0, 1.8].map((offset) => ({
    x: house.x + offset,
    z: house.z,
    radius: 3.2,
  })),
)
export const cafeObstacles: Obstacle[] = [
  // Dining tables and their stools
  ...CAFE_TABLES.flatMap((table) => [
    { x: table.x, z: table.z, radius: 0.9 },
    ...table.seats.map((seat) => ({
      x: seat.x,
      z: seat.z,
      radius: STOOL_RADIUS,
    })),
  ]),
  // Kiosk Front Service Counter
  { x: -17.0, z: 2.35, radius: 0.48 },
  { x: -15.2, z: 2.35, radius: 0.48 },
  { x: -13.4, z: 2.35, radius: 0.48 },
  { x: -11.6, z: 2.35, radius: 0.48 },
  // Kiosk Back Wall & Shelves
  { x: -17.0, z: -0.55, radius: 0.48 },
  { x: -15.2, z: -0.55, radius: 0.48 },
  { x: -13.4, z: -0.55, radius: 0.48 },
  { x: -11.6, z: -0.55, radius: 0.48 },
  // Kiosk east end (staff use the open west end)
  { x: -10.5, z: 0.9, radius: 0.6 },
  // Staff Break Bench
  { x: -16.2, z: -4.1, radius: 0.6 },
]
// Lamp posts light the meadow path, the cafe patio, and both ends of the
// bridge after dark. Cats walk around their slim posts.
export const LAMP_POST_RADIUS = 0.3
export const lampPosts: Point[] = [
  ...(
    [
      [-44, 1],
      [-32, -1],
      [-20, 1],
      [-8, 1],
      [4, 1],
      [16, -1],
      [27, 1],
    ] as const
  ).map(([z, side]) => ({ x: meadowPathX(z) + side * 3.2, z })),
  // Either side of the cafe patio
  { x: -10.5, z: 10.8 },
  { x: -20, z: 9.5 },
  // At each end of the bridge, just past the railings
  { x: BRIDGE.minX - 0.7, z: BRIDGE.z - BRIDGE.width / 2 - 0.7 },
  { x: BRIDGE.maxX + 0.7, z: BRIDGE.z + BRIDGE.width / 2 + 0.7 },
]
export const obstacles = [
  ...trees,
  ...rocks,
  ...houseObstacles,
  ...cafeObstacles,
  ...lampPosts.map((lamp) => ({ ...lamp, radius: LAMP_POST_RADIUS })),
]

export function isWalkable(x: number, z: number, clearance = 0.45) {
  return (
    x >= WORLD.minX + clearance &&
    x <= WORLD.maxX - clearance &&
    z >= WORLD.minZ + clearance &&
    z <= WORLD.maxZ - clearance &&
    isDryGround(x, z, clearance) &&
    obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + clearance)
  )
}
import { BRIDGE, isDryGround, meadowPathX } from './terrain'
import { CAFE_TABLES, STOOL_RADIUS } from './cafeLayout'
