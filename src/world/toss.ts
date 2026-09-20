import * as THREE from 'three'
import { WORLD, isWalkable } from './geography'
import type { Point } from './geography'

export interface TossSpread {
  readonly center: Point
  readonly pieces: Point[]
  readonly angle: number
  readonly stretch: number
  readonly lateral: number
}

export interface TossTrajectoryPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

const DEFAULT_PIECE_COUNT = 6
const MIN_DRAG_DISTANCE = 6
const MIN_STRETCH = 1.2
const MAX_STRETCH = 5.2
const MIN_LATERAL = 1.0
const MAX_LATERAL = 3.6
const TRAJECTORY_SEGMENTS = 20
const MIN_HORIZON_MARGIN = 2.0
const STRETCH_FACTOR = 0.015
const LATERAL_FACTOR = 0.01

export function unprojectGround(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  viewportWidth: number,
  viewportHeight: number,
  curvature: number,
  focusY: number,
): Point {
  const safeWidth = Math.max(1, viewportWidth)
  const safeHeight = Math.max(1, viewportHeight)
  const ndcX = (clientX / safeWidth) * 2 - 1
  const ndcY = -(clientY / safeHeight) * 2 + 1

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
  const { origin, direction } = raycaster.ray

  const target = solveGroundIntersection(
    origin,
    direction,
    curvature,
    focusY,
  )

  return {
    x: THREE.MathUtils.clamp(
      target.x,
      WORLD.minX + MIN_HORIZON_MARGIN,
      WORLD.maxX - MIN_HORIZON_MARGIN,
    ),
    z: THREE.MathUtils.clamp(
      target.z,
      WORLD.minZ + MIN_HORIZON_MARGIN,
      WORLD.maxZ - MIN_HORIZON_MARGIN,
    ),
  }
}

function solveGroundIntersection(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  curvature: number,
  focusY: number,
): Point {
  const dz = direction.z
  const dy = direction.y
  const ozRel = origin.z - focusY
  const oy = origin.y

  const a = curvature * dz * dz
  const b = dy + 2 * curvature * ozRel * dz
  const c = oy + curvature * ozRel * ozRel

  if (Math.abs(a) < 1e-7) {
    const t = Math.abs(b) > 1e-7 ? -c / b : -oy / (dy || -1)
    return {
      x: origin.x + t * direction.x,
      z: origin.z + t * direction.z,
    }
  }

  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) {
    const tFallback = Math.max(1, -oy / (dy || -1))
    return {
      x: origin.x + tFallback * direction.x,
      z: origin.z + tFallback * direction.z,
    }
  }

  const sqrtDisc = Math.sqrt(discriminant)
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)
  const t = t1 > 0 ? t1 : t2 > 0 ? t2 : Math.max(1, -oy / (dy || -1))

  return {
    x: origin.x + t * direction.x,
    z: origin.z + t * direction.z,
  }
}

export function calculateTossSpread(
  startPoint: Point,
  endPoint: Point,
  dragVector: { x: number; y: number },
  velocity: { x: number; y: number },
  count: number = DEFAULT_PIECE_COUNT,
): TossSpread {
  const dragDist = Math.hypot(dragVector.x, dragVector.y)
  const speed = Math.hypot(velocity.x, velocity.y)

  if (dragDist < MIN_DRAG_DISTANCE) {
    return createStaticSpread(endPoint, count)
  }

  const dx = endPoint.x - startPoint.x
  const dz = endPoint.z - startPoint.z
  const worldDist = Math.hypot(dx, dz)
  const angle = worldDist > 0.1 ? Math.atan2(dx, dz) : 0
  const dirX = worldDist > 0.1 ? dx / worldDist : 0
  const dirZ = worldDist > 0.1 ? dz / worldDist : 1
  const perpX = -dirZ
  const perpZ = dirX

  const stretch = THREE.MathUtils.clamp(
    worldDist * 0.4 + speed * STRETCH_FACTOR,
    MIN_STRETCH,
    MAX_STRETCH,
  )
  const lateral = THREE.MathUtils.clamp(
    worldDist * 0.25 + speed * LATERAL_FACTOR,
    MIN_LATERAL,
    MAX_LATERAL,
  )

  const pieces = generateSpreadPieces(
    endPoint,
    dirX,
    dirZ,
    perpX,
    perpZ,
    stretch,
    lateral,
    count,
  )

  return {
    center: endPoint,
    pieces,
    angle,
    stretch,
    lateral,
  }
}

function createStaticSpread(center: Point, count: number): TossSpread {
  const pieces: Point[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const radius = 0.8 + (i % 3) * 0.4
    const candidateX = center.x + Math.sin(angle) * radius
    const candidateZ = center.z + Math.cos(angle) * radius
    pieces.push(findWalkableNearby(candidateX, candidateZ))
  }
  return {
    center,
    pieces,
    angle: 0,
    stretch: MIN_STRETCH,
    lateral: MIN_LATERAL,
  }
}

function generateSpreadPieces(
  center: Point,
  dirX: number,
  dirZ: number,
  perpX: number,
  perpZ: number,
  stretch: number,
  lateral: number,
  count: number,
): Point[] {
  const pieces: Point[] = []
  for (let i = 0; i < count; i++) {
    const forwardRatio = (i / (count - 1) - 0.5) * stretch
    const sideRatio = (((i * 1.618) % 1) - 0.5) * lateral
    const candidateX = center.x + dirX * forwardRatio + perpX * sideRatio
    const candidateZ = center.z + dirZ * forwardRatio + perpZ * sideRatio
    pieces.push(findWalkableNearby(candidateX, candidateZ))
  }
  return pieces
}

function findWalkableNearby(x: number, z: number): Point {
  if (isWalkable(x, z)) {
    return { x, z }
  }
  const searchRadii = [0.4, 0.8, 1.2, 1.6]
  const angleSteps = 8
  for (const r of searchRadii) {
    for (let step = 0; step < angleSteps; step++) {
      const a = (step / angleSteps) * Math.PI * 2
      const candidateX = x + Math.sin(a) * r
      const candidateZ = z + Math.cos(a) * r
      if (isWalkable(candidateX, candidateZ)) {
        return { x: candidateX, z: candidateZ }
      }
    }
  }
  return {
    x: THREE.MathUtils.clamp(x, WORLD.minX + 1, WORLD.maxX - 1),
    z: THREE.MathUtils.clamp(z, WORLD.minZ + 1, WORLD.maxZ - 1),
  }
}

export function computeTrajectoryArc(
  start: THREE.Vector3,
  target: Point,
  peakHeight: number,
  segments: number = TRAJECTORY_SEGMENTS,
): TossTrajectoryPoint[] {
  const points: TossTrajectoryPoint[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = THREE.MathUtils.lerp(start.x, target.x, t)
    const z = THREE.MathUtils.lerp(start.z, target.z, t)
    const parabolicArc = 4 * t * (1 - t)
    const y = THREE.MathUtils.lerp(start.y, 0, t) + peakHeight * parabolicArc
    points.push({ x, y, z })
  }
  return points
}
