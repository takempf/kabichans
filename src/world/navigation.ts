import { WORLD, obstacles, isWalkable } from './geography'
import type { Point, Obstacle } from './geography'
import { BRIDGE, isDryGround } from './terrain'

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const spacing = 1.5
const columns = Math.floor((WORLD.maxX - WORLD.minX) / spacing) + 1
// Include the middle of the narrow bridge as a navigable row.
const startZ =
  BRIDGE.z - Math.floor((BRIDGE.z - WORLD.minZ) / spacing) * spacing
const rows = Math.floor((WORLD.maxZ - startZ) / spacing) + 1
const points: Point[] = Array.from({ length: columns * rows }, (_, index) => ({
  x: WORLD.minX + (index % columns) * spacing,
  z: startZ + Math.floor(index / columns) * spacing,
}))
const land = new Map<number, boolean[]>()

export function clearSegment(
  from: Point,
  to: Point,
  radius: number,
  blockers: Obstacle[] = [],
) {
  if (
    to.x < WORLD.minX + radius ||
    to.x > WORLD.maxX - radius ||
    to.z < WORLD.minZ + radius ||
    to.z > WORLD.maxZ - radius
  )
    return false
  const dx = to.x - from.x
  const dz = to.z - from.z
  const lengthSquared = dx * dx + dz * dz
  // Most movement is west of the creek. Only check water along nearby segments.
  if (Math.max(from.x, to.x) > 13.5 - radius) {
    const steps = Math.max(1, Math.ceil(Math.sqrt(lengthSquared) / 0.25))
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      if (!isDryGround(from.x + dx * t, from.z + dz * t, radius)) return false
    }
  }
  for (let index = 0; index < obstacles.length + blockers.length; index++) {
    const obstacle =
      index < obstacles.length
        ? obstacles[index]
        : blockers[index - obstacles.length]
    const t = lengthSquared
      ? Math.max(
          0,
          Math.min(
            1,
            ((obstacle.x - from.x) * dx + (obstacle.z - from.z) * dz) /
              lengthSquared,
          ),
        )
      : 0
    if (
      (from.x + dx * t - obstacle.x) ** 2 +
        (from.z + dz * t - obstacle.z) ** 2 <=
      (obstacle.radius + radius) ** 2
    )
      return false
  }
  return true
}

// A small, on-demand A* grid; routes are retained, then smoothed into long segments.
// Scenery is static. Temporary cat blockers are supplied only after sustained yielding.
export function findRoute(
  from: Point,
  to: Point,
  radius: number,
  blockers: Obstacle[] = [],
): Point[] {
  if (!isWalkable(to.x, to.z, radius)) return []
  if (clearSegment(from, to, radius, blockers)) return [{ ...to }]
  let ground = land.get(radius)
  if (!ground) {
    ground = points.map((point) => isWalkable(point.x, point.z, radius))
    if (land.size >= 128) land.delete(land.keys().next().value!)
    land.set(radius, ground)
  }
  const allowed = blockers.length
    ? ground.map(
        (valid, index) =>
          valid &&
          blockers.every(
            (o) =>
              (points[index].x - o.x) ** 2 + (points[index].z - o.z) ** 2 >
              (radius + o.radius) ** 2,
          ),
      )
    : ground
  const cost = new Float64Array(points.length).fill(Infinity)
  const parent = new Int32Array(points.length).fill(-1)
  const open = new Set<number>()
  const closed = new Set<number>()
  for (let index = 0; index < points.length; index++) {
    const d = distance(from, points[index])
    if (
      allowed[index] &&
      d < spacing * 2 &&
      clearSegment(from, points[index], radius, blockers)
    ) {
      cost[index] = d
      open.add(index)
    }
  }
  while (open.size) {
    let current = -1
    let best = Infinity
    for (const index of open) {
      const score = cost[index] + distance(points[index], to)
      if (score < best) {
        best = score
        current = index
      }
    }
    const point = points[current]
    if (
      distance(point, to) < spacing * 2 &&
      clearSegment(point, to, radius, blockers)
    ) {
      const path = [{ ...to }, point]
      while (parent[current] !== -1) {
        current = parent[current]
        path.push(points[current])
      }
      path.reverse()
      const result: Point[] = []
      let anchor = from
      for (let index = 0; index < path.length;) {
        let next = path.length - 1
        while (
          next > index &&
          !clearSegment(anchor, path[next], radius, blockers)
        )
          next--
        result.push(path[next])
        anchor = path[next]
        index = next + 1
      }
      return result
    }
    open.delete(current)
    closed.add(current)
    const column = current % columns
    const row = Math.floor(current / columns)
    for (let rz = -1; rz <= 1; rz++)
      for (let rx = -1; rx <= 1; rx++) {
        if (
          (!rx && !rz) ||
          column + rx < 0 ||
          column + rx >= columns ||
          row + rz < 0 ||
          row + rz >= rows
        )
          continue
        const next = current + rz * columns + rx
        if (
          !allowed[next] ||
          closed.has(next) ||
          !clearSegment(point, points[next], radius, blockers)
        )
          continue
        const candidate = cost[current] + distance(point, points[next])
        if (candidate < cost[next]) {
          cost[next] = candidate
          parent[next] = current
          open.add(next)
        }
      }
  }
  return []
}
