import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  calculateTossSpread,
  computeTrajectoryArc,
  unprojectGround,
} from './toss'
import { WORLD } from './geography'

describe('toss utilities', () => {
  it('calculates trajectory arc points with parabolic height', () => {
    const start = new THREE.Vector3(0, 10, 20)
    const target = { x: 0, z: 5 }
    const peakHeight = 4
    const arc = computeTrajectoryArc(start, target, peakHeight, 10)

    expect(arc).toHaveLength(11)
    expect(arc[0].x).toBeCloseTo(0)
    expect(arc[0].y).toBeCloseTo(10)
    expect(arc[0].z).toBeCloseTo(20)

    const mid = arc[5]
    expect(mid.y).toBeGreaterThan(5)

    const end = arc[10]
    expect(end.x).toBeCloseTo(target.x)
    expect(end.y).toBeCloseTo(0)
    expect(end.z).toBeCloseTo(target.z)
  })

  it('calculates static spread when drag distance is small', () => {
    const center = { x: 5, z: -2 }
    const spread = calculateTossSpread(
      center,
      center,
      { x: 2, y: 1 },
      { x: 0, y: 0 },
      6,
    )

    expect(spread.pieces).toHaveLength(6)
    expect(spread.center).toEqual(center)
    for (const piece of spread.pieces) {
      expect(piece.x).toBeGreaterThanOrEqual(WORLD.minX)
      expect(piece.x).toBeLessThanOrEqual(WORLD.maxX)
      expect(piece.z).toBeGreaterThanOrEqual(WORLD.minZ)
      expect(piece.z).toBeLessThanOrEqual(WORLD.maxZ)
    }
  })

  it('spreads pieces along and across the throw vector on drag', () => {
    const start = { x: 0, z: 10 }
    const target = { x: 5, z: -5 }
    const dragVector = { x: 50, y: -150 }
    const velocity = { x: 200, y: -600 }
    const spread = calculateTossSpread(start, target, dragVector, velocity, 6)

    expect(spread.pieces).toHaveLength(6)
    expect(spread.stretch).toBeGreaterThan(1.2)
    expect(spread.lateral).toBeGreaterThan(1.0)
    expect(spread.angle).not.toBe(0)
  })

  it('unprojects screen coordinates onto ground plane', () => {
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
    camera.position.set(0, 18, 24)
    camera.lookAt(0, -1.5, -2)
    camera.updateMatrixWorld()

    const ground = unprojectGround(100, 100, camera, 200, 200, 0.004, 0)
    expect(ground.x).toBeGreaterThanOrEqual(WORLD.minX)
    expect(ground.x).toBeLessThanOrEqual(WORLD.maxX)
    expect(ground.z).toBeGreaterThanOrEqual(WORLD.minZ)
    expect(ground.z).toBeLessThanOrEqual(WORLD.maxZ)
  })
})
