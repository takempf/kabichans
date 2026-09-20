import { describe, expect, it } from 'vitest'
import { FENCE_BOUNDS, FENCE_INSET, isWalkable } from './geography'
import { Simulation, catRadius, isOnBridgeOrApproach } from './simulation'
import { clearSegment, findRoute } from './navigation'
import { BRIDGE, creekX, groundHeight } from './terrain'

describe('the fence perimeter', () => {
  it.each([
    {
      side: 'west',
      x: -39,
      z: 0,
      target: { x: -60, z: 0 },
      heading: -Math.PI / 2,
    },
    {
      side: 'east',
      x: 35.5,
      z: 0,
      target: { x: 60, z: 0 },
      heading: Math.PI / 2,
    },
    { side: 'north', x: 0, z: -47, target: { x: 0, z: -65 }, heading: Math.PI },
    { side: 'south', x: 0, z: 26, target: { x: 0, z: 45 }, heading: 0 },
  ])(
    'contains a sprinting cat at the $side fence, including its full footprint',
    (edge) => {
      const simulation = new Simulation()
      simulation.cats.splice(1)
      const cat = simulation.cats[0]
      Object.assign(cat, {
        ...edge,
        scale: 1.08,
        pace: 1.12,
        activity: 'snacking',
        timer: 1000,
        travelMode: 'sprinting',
        pose: { sitting: 0, lying: 0, vomiting: 0 },
      })
      for (let frame = 0; frame < 200; frame++) {
        simulation.step(0.1)
        const radius = catRadius(cat) + FENCE_INSET
        expect(cat.x - radius).toBeGreaterThanOrEqual(FENCE_BOUNDS.minX)
        expect(cat.x + radius).toBeLessThanOrEqual(FENCE_BOUNDS.maxX)
        expect(cat.z - radius).toBeGreaterThanOrEqual(FENCE_BOUNDS.minZ)
        expect(cat.z + radius).toBeLessThanOrEqual(FENCE_BOUNDS.maxZ)
      }
      expect(Math.hypot(cat.x - edge.x, cat.z - edge.z)).toBeGreaterThan(1.5)
      expect(cat.walking).toBeLessThan(0.001)
    },
  )

  it('makes the former buffer available and keeps destinations clear of posts and closed gates', () => {
    for (const point of [
      { x: -40, z: 0 },
      { x: 47, z: 0 },
      { x: 0, z: -48 },
      { x: 0, z: 27 },
    ])
      expect(isWalkable(point.x, point.z, 1.08)).toBe(true)
    for (const point of [
      { x: -42.5, z: 0 },
      { x: 48.5, z: 0 },
      { x: 0, z: -50.5 },
      { x: 0, z: 29.5 },
    ])
      expect(isWalkable(point.x, point.z, 1.08)).toBe(false)
    const simulation = new Simulation()
    expect(
      simulation.cats.some(
        (cat) => cat.x < -35 || cat.x > 23 || cat.z < -43 || cat.z > 22,
      ),
    ).toBe(true)
  })

  it('routes to the far bank over the bridge and never walks through the creek', () => {
    const from = { x: 12, z: -8 },
      destination = { x: 37, z: -8 }
    expect(clearSegment(from, destination, 1.08)).toBe(false)
    const route = findRoute(from, destination, 1.08)
    expect(route.length).toBeGreaterThan(1)
    expect(route.at(-1)).toEqual(destination)
    expect(
      route.some((point) => Math.abs(point.z - BRIDGE.z) <= BRIDGE.width / 2),
    ).toBe(true)
    const simulation = new Simulation()
    simulation.cats.splice(1)
    const cat = simulation.cats[0]
    Object.assign(cat, {
      ...from,
      scale: 1,
      activity: 'wandering',
      timer: 0,
      nextVomitAt: Infinity,
      pose: { sitting: 0, lying: 0, vomiting: 0 },
      schedule: [
        {
          kind: 'rest',
          destination,
          friendId: null,
          hangout: null,
          duration: 20,
          dueAt: 0,
        },
      ],
    })
    let crossed = false
    for (let frame = 0; frame < 1100 && cat.activity !== 'lying'; frame++) {
      simulation.step(0.1)
      expect(isWalkable(cat.x, cat.z, catRadius(cat))).toBe(true)
      if (Math.abs(cat.x - creekX(cat.z)) < 3) {
        crossed = true
        expect(Math.abs(cat.z - BRIDGE.z) + catRadius(cat)).toBeLessThanOrEqual(
          BRIDGE.width / 2,
        )
        expect(groundHeight(cat.x, cat.z)).toBeGreaterThan(0.29)
      }
    }
    expect(crossed).toBe(true)
    expect(cat.activity).toBe('lying')
    expect(
      Math.hypot(cat.x - destination.x, cat.z - destination.z),
    ).toBeLessThan(0.8)
  })

  it('keeps the bridge a way across: nobody settles there and nobody gets stuck', () => {
    const simulation = new Simulation()
    const arrived = new Map<number, number>()
    for (let frame = 0; frame < 3000; frame++) {
      simulation.step(0.1)
      for (const cat of simulation.cats) {
        if (!isOnBridgeOrApproach(cat.x, cat.z)) {
          arrived.delete(cat.id)
          continue
        }
        expect(['sitting', 'resting', 'lying', 'vomiting']).not.toContain(
          cat.activity,
        )
        if (!arrived.has(cat.id)) arrived.set(cat.id, simulation.elapsed)
        // A walking crossing takes well under half a minute.
        expect(simulation.elapsed - arrived.get(cat.id)!).toBeLessThan(60)
      }
    }
  }, 60000)
})
