// Where everything at the meadow cafe stands. Kept free of rendering code so
// navigation and the simulation can share it.

export type CafeFoodType = 'cat_can' | 'churu'

export interface CafeSeat {
  tableId: number
  seatId: number
  x: number
  z: number
  heading: number
  // Diners stand here, just outside the stool, then hop up toward the table.
  approach: { x: number; z: number }
}

export interface CafeTable {
  id: number
  x: number
  z: number
  radius: number
  // Where a server stands to clear the table, on its open side.
  approach: { x: number; z: number }
  seats: CafeSeat[]
}

export interface CafeDeliveredFood {
  id: number
  catId: number
  // Table seat index, or null for a treat enjoyed on the grass.
  seatIndex: number | null
  foodType: CafeFoodType
  x: number
  // Height above the ground: the tabletop, or zero for the grass.
  y: number
  z: number
  heading: number
}

export interface CafeWorkerCarriedItem {
  catId: number
  foodType: CafeFoodType
  x: number
  y: number
  z: number
  heading: number
}

export const CAFE_TERRACE_CENTER = { x: -11.0, z: 1.5 } as const
export const CAFE_TERRACE_RADIUS = 9.4
export const PATIO_HEIGHT = 0.08
export const CAFE_COUNTER_POSITION = { x: -14.2, z: 0.9 } as const
export const CAFE_BARISTA_STATION = { x: -14.2, z: 0.9, heading: 0 } as const
export const CAFE_SERVER_STATIONS = [
  { x: -12.0, z: 0.9, heading: 0 },
  { x: -16.4, z: 0.9, heading: 0 },
] as const
// Staff enter and leave through the kiosk's open west end, away from the
// customers' side. Everyone else treats that opening as closed.
export const CAFE_KIOSK_DOOR = { x: -19.8, z: 0.9 } as const
export const CAFE_KIOSK_LANE = { x: -17.6, z: 0.9 } as const
export const CAFE_KIOSK_ENTRANCE = { x: -18.4, z: 0.9, radius: 0.75 } as const
// Where a cat whose shift has ended steps out before rejoining the meadow.
export const CAFE_STAFF_EXIT = { x: -21.0, z: -1.5 } as const
export const CAFE_BREAK_BENCH = { x: -16.2, z: -2.3, heading: 0.35 } as const

// Customers order at the counter, facing the barista, while the line curves
// gently away from the tables toward the open meadow.
export const CAFE_ORDER_SPOT = { x: -14.2, z: 4.3, heading: Math.PI } as const
export const CAFE_QUEUE_SLOTS = [
  { x: -14.7, z: 6.6 },
  { x: -15.4, z: 8.85 },
  { x: -16.3, z: 11.0 },
  { x: -17.3, z: 13.1 },
  { x: -18.4, z: 15.1 },
] as const
export const CAFE_QUEUE_CAPACITY = CAFE_QUEUE_SLOTS.length + 1
// Served cats step this way first, clear of the line behind them.
export const CAFE_PICKUP_EXIT = { x: -11.2, z: 4.9 } as const

const STOOL_DISTANCE = 2.55
// Stools are solid for everyone except the diner hopping onto their own.
export const STOOL_RADIUS = 0.4
const HOP_DISTANCE = 1.6
// Stools sit on three sides of each table, facing it; the fourth side is for staff.
const SIDES = {
  north: { dx: 0, dz: 1 },
  south: { dx: 0, dz: -1 },
  east: { dx: 1, dz: 0 },
  west: { dx: -1, dz: 0 },
} as const
type Side = keyof typeof SIDES

function cafeTable(
  id: number,
  x: number,
  z: number,
  staffSide: Side,
  stoolSides: Side[],
): CafeTable {
  const at = (side: Side, distance = STOOL_DISTANCE) => ({
    x: x + SIDES[side].dx * distance,
    z: z + SIDES[side].dz * distance,
  })
  return {
    id,
    x,
    z,
    radius: 1.45,
    approach: at(staffSide),
    seats: stoolSides.map((side, seatId) => ({
      tableId: id,
      seatId,
      ...at(side),
      heading: Math.atan2(-SIDES[side].dx, -SIDES[side].dz),
      approach: at(side, STOOL_DISTANCE + HOP_DISTANCE),
    })),
  }
}

// Staff sides face the kiosk so the walkway past its doorway stays open.
export const CAFE_TABLES: CafeTable[] = [
  cafeTable(0, -7.5, 7.2, 'south', ['west', 'north', 'east']),
  cafeTable(1, -7.5, -4.2, 'north', ['west', 'south', 'east']),
  cafeTable(2, -2.6, 1.5, 'east', ['north', 'west', 'south']),
]

export const ALL_CAFE_SEATS: CafeSeat[] = CAFE_TABLES.flatMap((t) => t.seats)

export function isInsideCafeProp(
  x: number,
  z: number,
  clearance = 0.5,
): boolean {
  if (
    x >= -19.2 - clearance &&
    x <= -9.6 + clearance &&
    z >= -1.2 - clearance &&
    z <= 2.9 + clearance
  ) {
    return true
  }
  if (
    CAFE_TABLES.some(
      (table) => Math.hypot(x - table.x, z - table.z) < 1.7 + clearance,
    )
  ) {
    return true
  }
  return (
    x >= -18.2 - clearance &&
    x <= -14.2 + clearance &&
    z >= -4.7 - clearance &&
    z <= -3.6 + clearance
  )
}

const LANE = [CAFE_ORDER_SPOT, ...CAFE_QUEUE_SLOTS]

// How far along the line a point stands (0 at the counter), and how far off it.
export function cafeLanePosition(x: number, z: number) {
  let best = { progress: 0, offset: Infinity }
  let start = 0
  for (let i = 0; i < LANE.length - 1; i++) {
    const a = LANE[i],
      b = LANE[i + 1]
    const dx = b.x - a.x,
      dz = b.z - a.z
    const length = Math.hypot(dx, dz)
    // Extend the last leg so cats arriving from beyond the tail still line up.
    const limit = i === LANE.length - 2 ? length + 2.5 : length
    const t = Math.max(
      0,
      Math.min(limit, ((x - a.x) * dx + (z - a.z) * dz) / length),
    )
    const offset = Math.hypot(
      x - (a.x + (dx / length) * t),
      z - (a.z + (dz / length) * t),
    )
    if (offset < best.offset) best = { progress: start + t, offset }
    start += length
  }
  return best
}

// Loungers leave the patio to customers and staff.
export function isOnCafeTerrace(x: number, z: number, clearance = 0) {
  const rx = CAFE_TERRACE_RADIUS * 1.05 + clearance
  const rz = CAFE_TERRACE_RADIUS * 1.06 + clearance
  return (
    ((x - CAFE_TERRACE_CENTER.x) / rx) ** 2 +
      ((z - CAFE_TERRACE_CENTER.z) / rz) ** 2 <
    1
  )
}

// Wanderers keep the line to the counter open.
export function isInCafeQueueLane(x: number, z: number, clearance = 0) {
  return [CAFE_ORDER_SPOT, ...CAFE_QUEUE_SLOTS].some(
    (spot) => Math.hypot(x - spot.x, z - spot.z) < 1.6 + clearance,
  )
}

export const TABLE_SURFACE_HEIGHT = 1.3
export const STOOL_CUSHION_HEIGHT = 0.58
