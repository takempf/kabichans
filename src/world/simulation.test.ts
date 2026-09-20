import { describe, expect, it } from 'vitest'
import {
  EMOTE_SECONDS,
  CAT_COUNT,
  MAX_PUDDLES,
  TRAVEL_SPEEDS,
  VOMIT_DURATION,
  VOMIT_EMIT_TIME,
  WORLD,
  Simulation,
  bodyRadius,
  isIndoors,
  isPerched,
  isWalkable,
  sharesSpace,
} from './simulation'
import type { Cat } from './simulation'

function residentsHaveSpace(residents: Cat[]) {
  // Residents in a cottage doorway, or inside, are within its walls.
  const cats = residents.filter((cat) => !isIndoors(cat))
  return cats.every((cat, index) => {
    if (!isPerched(cat) && !isWalkable(cat.x, cat.z, bodyRadius(cat)))
      return false
    return cats.slice(index + 1).every((other) => {
      if (sharesSpace(cat, other)) return true
      const clearance = bodyRadius(cat) + bodyRadius(other)
      return (
        (cat.x - other.x) ** 2 + (cat.z - other.z) ** 2 >= clearance ** 2 - 1e-9
      )
    })
  })
}

describe('the cat world', { timeout: 60000 }, () => {
  it('starts with 100 unique residents on walkable land', () => {
    const simulation = new Simulation()
    expect(simulation.cats).toHaveLength(CAT_COUNT)
    expect(new Set(simulation.cats.map((c) => c.name)).size).toBe(CAT_COUNT)
    expect(new Set(simulation.cats.map((c) => c.id)).size).toBe(CAT_COUNT)
    expect(simulation.cats.every((c) => isWalkable(c.x, c.z))).toBe(true)
    expect(residentsHaveSpace(simulation.cats)).toBe(true)
  })

  it('keeps all residents finite, in bounds, and out of scenery through three simulated minutes', () => {
    const simulation = new Simulation()
    const seen = new Set(simulation.cats.map((cat) => cat.activity))
    for (let i = 0; i < 1800; i++) {
      simulation.step(0.1)
      expect(residentsHaveSpace(simulation.cats)).toBe(true)
      for (const cat of simulation.cats) seen.add(cat.activity)
    }
    expect(
      simulation.cats.every(
        (c) =>
          (isPerched(c) || isIndoors(c) || isWalkable(c.x, c.z)) &&
          Number.isFinite(c.heading),
      ),
    ).toBe(true)
    const snapshot = simulation.snapshot()
    expect(Object.values(snapshot.counts).reduce((a, b) => a + b, 0)).toBe(
      CAT_COUNT,
    )
    expect(snapshot.counts.wandering).toBeGreaterThan(0)
    expect(snapshot.counts.resting).toBeGreaterThan(0)
    expect(snapshot.counts.socializing).toBeGreaterThan(0)
    expect(seen).toEqual(
      new Set([
        'wandering',
        'resting',
        'sitting',
        'lying',
        'vomiting',
        'socializing',
        'conversing',
        'working',
        'indoors',
      ]),
    )
  })

  it('reproduces the same world from a seed', () => {
    const first = new Simulation(123),
      second = new Simulation(123)
    for (let i = 0; i < 80; i++) {
      first.step(0.1)
      second.step(0.1)
    }
    expect(first.snapshot()).toEqual(second.snapshot())
  })

  it('attracts nearby residents to treats and clears the food after 18 seconds', () => {
    const simulation = new Simulation()
    simulation.dropTreat({ x: 0, z: 3 })
    expect(simulation.treat).toEqual({ x: 0, z: 3 })
    for (let i = 0; i < 20; i++) simulation.step(0.1)
    expect(simulation.snapshot().counts.snacking).toBeGreaterThan(0)
    for (let i = 0; i < 180; i++) {
      simulation.step(0.1)
      expect(residentsHaveSpace(simulation.cats)).toBe(true)
    }
    expect(simulation.treat).toBeNull()
    expect(simulation.cats.every((c) => isWalkable(c.x, c.z))).toBe(true)
  })

  it('places treat pieces at custom positions when customPieces are provided', () => {
    const simulation = new Simulation()
    const custom = [
      { x: 1, z: 3 },
      { x: 2, z: 4 },
      { x: -1, z: 2 },
    ]
    simulation.dropTreat({ x: 0, z: 3 }, custom)
    expect(simulation.treatPieces).toHaveLength(3)
    expect(simulation.treatPieces[0].x).toBe(1)
    expect(simulation.treatPieces[0].z).toBe(3)
    expect(simulation.treatPieces[1].x).toBe(2)
    expect(simulation.treatPieces[1].z).toBe(4)
  })

  it('attracts nearby cats when laser pointer is active and clears on deactivate', () => {
    const simulation = new Simulation()
    simulation.step(0.1)
    const cat = simulation.cats[0]
    simulation.setLaserTarget({ x: cat.x + 3, z: cat.z + 3 })
    simulation.step(0.1)
    const chasers = simulation.cats.filter((c) => c.objective?.kind === 'laser')
    expect(chasers.length).toBeGreaterThan(0)
    simulation.setLaserTarget(null)
    simulation.step(0.1)
    const afterClear = simulation.cats.filter((c) => c.objective?.kind === 'laser')
    expect(afterClear).toHaveLength(0)
  })

  it('shows a brief "!" over each cat as they notice a treat, not all at once', () => {
    const simulation = new Simulation()
    simulation.step(0.1)
    simulation.dropTreat({ x: 0, z: 3 })
    const noticedAt = new Map<number, number>()
    for (let i = 0; i < 20; i++) {
      simulation.step(0.1)
      for (const cat of simulation.cats) {
        if (cat.activity !== 'snacking' || noticedAt.has(cat.id)) continue
        // The "!" goes up the moment they catch on.
        expect(cat.emote).toBe('treat')
        expect(cat.emoteAt).toBe(simulation.elapsed)
        noticedAt.set(cat.id, cat.emoteAt)
      }
    }
    expect(noticedAt.size).toBeGreaterThan(3)
    expect(new Set(noticedAt.values()).size).toBeGreaterThan(3)
    for (let i = 0; i < EMOTE_SECONDS.treat * 10 + 1; i++) simulation.step(0.1)
    expect(
      [...noticedAt.keys()].every(
        (id) => simulation.cats[id].emote !== 'treat',
      ),
    ).toBe(true)
  })

  it('scatters a piece for each cat, who kneels to eat it, grins, and wanders off', () => {
    const simulation = new Simulation()
    simulation.step(0.1)
    const treat = { x: 0, z: 3 }
    simulation.dropTreat(treat)
    const pieces = simulation.treatPieces.length
    for (let i = 0; i < 20; i++) simulation.step(0.1)
    const snackers = simulation.cats.filter((c) => c.activity === 'snacking')
    expect(snackers.length).toBeGreaterThan(3)
    expect(snackers.length).toBeLessThanOrEqual(pieces)
    const knelt = new Set<number>()
    const grinned = new Set<number>()
    const eaters = new Map<number, number>()
    for (let i = 0; i < 300; i++) {
      simulation.step(0.1)
      for (const cat of snackers) {
        if (cat.snack?.stage === 'eating') {
          knelt.add(cat.id)
          // First come, first served: nobody shares a piece.
          expect(eaters.get(cat.snack.pieceId) ?? cat.id).toBe(cat.id)
          eaters.set(cat.snack.pieceId, cat.id)
          // Close enough to reach the piece, and holding still.
          expect(Math.hypot(cat.velocity.x, cat.velocity.z)).toBe(0)
        }
        if (cat.emote === 'yum') grinned.add(cat.id)
      }
      expect(residentsHaveSpace(simulation.cats)).toBe(true)
    }
    // Nearly everyone gets theirs; the crowd has thinned out afterwards.
    expect(knelt.size).toBeGreaterThanOrEqual(snackers.length * 0.75)
    expect(grinned).toEqual(knelt)
    expect(simulation.treatPieces).toHaveLength(0)
    expect(snackers.every((c) => c.activity !== 'snacking')).toBe(true)
    const nearby = snackers.filter(
      (c) => Math.hypot(c.x - treat.x, c.z - treat.z) < 4,
    )
    expect(nearby.length).toBeLessThan(snackers.length / 3)
  })

  it('uses a safe treat location when the camera points outside the meadow', () => {
    const simulation = new Simulation()
    simulation.dropTreat({ x: 1000, z: -1000 })
    expect(isWalkable(simulation.treat!.x, simulation.treat!.z)).toBe(true)
  })

  // Open meadow east of the cafe terrace, clear of its tables.
  it('keeps approaching cats clear of a sleeping cat, even with large timesteps', () => {
    const simulation = new Simulation()
    simulation.cats.splice(3)
    for (const [index, cat] of simulation.cats.entries()) {
      Object.assign(cat, {
        x: 10 + (index - 1) * 4,
        z: 0,
        scale: 1.08,
        activity: index === 1 ? 'resting' : 'snacking',
        target: { x: 10, z: 0 },
        timer: 100,
      })
    }
    for (let i = 0; i < 100; i++) {
      simulation.step(1)
      expect(residentsHaveSpace(simulation.cats)).toBe(true)
    }
    expect(simulation.cats[1]).toMatchObject({
      x: 10,
      z: 0,
      activity: 'resting',
    })
    expect(simulation.cats[0].x).toBeGreaterThan(6)
    expect(simulation.cats[2].x).toBeLessThan(14)
  })

  it('stands up before walking when a lying cat is called to a treat', () => {
    const simulation = new Simulation()
    const cat = simulation.cats.find((c) => c.activity === 'lying')!
    const position = { x: cat.x, z: cat.z }
    simulation.dropTreat({ x: cat.x, z: cat.z + 3 })
    for (let i = 0; i < 20 && cat.activity !== 'snacking'; i++)
      simulation.step(0.1)
    expect(cat.activity).toBe('snacking')
    simulation.step(0.1)
    expect(cat.pose.lying).toBeGreaterThan(0)
    expect(cat).toMatchObject(position)
    for (let i = 0; i < 5; i++) simulation.step(0.1)
    expect(cat.pose.lying).toBe(0)
    expect(residentsHaveSpace(simulation.cats)).toBe(true)
  })

  it.each([1 / 60, 1 / 30, 0.1])(
    'settles approaching cats without shuffling or vibrating at timestep %s',
    (dt) => {
      const simulation = new Simulation()
      simulation.cats.splice(2)
      for (const [index, cat] of simulation.cats.entries())
        Object.assign(cat, {
          x: index ? 14 : 6,
          z: 0,
          heading: index ? -Math.PI / 2 : Math.PI / 2,
          activity: 'snacking',
          target: { x: 10, z: 0 },
          timer: 100,
          scale: 1,
          pose: { sitting: 0, lying: 0, vomiting: 0 },
        })
      let travel = 0
      let rotation = 0
      for (let frame = 0; frame < Math.round(10 / dt); frame++) {
        const before = simulation.cats.map(({ x, z, heading }) => ({
          x,
          z,
          heading,
        }))
        simulation.step(dt)
        expect(residentsHaveSpace(simulation.cats)).toBe(true)
        if (frame * dt < 5) continue
        for (const [index, cat] of simulation.cats.entries()) {
          travel += Math.hypot(cat.x - before[index].x, cat.z - before[index].z)
          rotation += Math.abs(cat.heading - before[index].heading)
        }
      }
      expect(travel).toBeLessThan(0.03)
      expect(rotation).toBeLessThan(0.03)
      expect(simulation.cats.every((cat) => cat.walking < 0.01)).toBe(true)
      expect(simulation.cats[0].x).toBeGreaterThan(8)
      expect(simulation.cats[1].x).toBeLessThan(12)
    },
  )

  it('bounds turning speed and acceleration through activity changes and treat crowds', () => {
    const simulation = new Simulation()
    const dt = 1 / 30
    for (let frame = 0; frame < 900; frame++) {
      if (frame === 150) simulation.dropTreat({ x: 0, z: 3 })
      const before = simulation.cats.map(
        ({ heading, angularVelocity, x, z }) => ({
          heading,
          angularVelocity,
          x,
          z,
        }),
      )
      simulation.step(dt)
      for (const [index, cat] of simulation.cats.entries()) {
        expect(
          Math.abs(cat.heading - before[index].heading),
        ).toBeLessThanOrEqual(2.4 * dt + 1e-9)
        expect(
          Math.abs(cat.angularVelocity - before[index].angularVelocity),
        ).toBeLessThanOrEqual(8 * dt + 1e-9)
        expect(
          Math.hypot(cat.x - before[index].x, cat.z - before[index].z),
        ).toBeLessThanOrEqual(TRAVEL_SPEEDS.sprinting * cat.pace * dt + 1e-9)
      }
    }
  })

  it('commits to a smooth turnaround when the target straddles the angle wrap', () => {
    const simulation = new Simulation()
    simulation.cats.splice(1)
    const cat = simulation.cats[0]
    Object.assign(cat, {
      x: 0,
      z: 0,
      heading: 0,
      activity: 'wandering',
      timer: 100,
      pose: { sitting: 0, lying: 0, vomiting: 0 },
    })
    let direction = 0
    for (let frame = 0; frame < 180; frame++) {
      cat.target = { x: frame % 2 ? 0.02 : -0.02, z: -10 }
      simulation.step(1 / 60)
      if (!direction && Math.abs(cat.angularVelocity) > 0.01)
        direction = Math.sign(cat.angularVelocity)
      if (frame < 90)
        expect(cat.angularVelocity * direction).toBeGreaterThanOrEqual(-1e-9)
    }
    expect(Math.cos(cat.heading)).toBeLessThan(-0.99)
  })

  it('waits when blocked instead of changing its mind or walking in place every frame', () => {
    const simulation = new Simulation()
    simulation.cats.splice(1)
    const cat = simulation.cats[0]
    const target = { x: WORLD.maxX + 5, z: 0 }
    Object.assign(cat, {
      x: WORLD.maxX - 1,
      z: 0,
      scale: 1,
      heading: Math.PI / 2,
      activity: 'wandering',
      timer: 100,
      target,
      pose: { sitting: 0, lying: 0, vomiting: 0 },
    })
    for (let frame = 0; frame < 60; frame++) {
      simulation.step(1 / 60)
      expect(cat.target).toEqual(target)
      expect(cat.activity).toBe('wandering')
      expect(cat.x).toBe(WORLD.maxX - 1)
      expect(cat.gait).toBe(0)
      expect(cat.walking).toBe(0)
      expect(cat.heading).toBe(Math.PI / 2)
    }
  })

  it('emits one puddle, finishes vomiting despite treats, and rests before a cooldown', () => {
    const simulation = new Simulation()
    const cat = simulation.cats[0]
    Object.assign(cat, {
      activity: 'vomiting',
      activityTime: 0,
      timer: VOMIT_DURATION,
    })
    for (let i = 0; i < 25; i++) simulation.step(0.1)
    expect(simulation.puddles).toHaveLength(0)
    simulation.step(0.1)
    expect(simulation.puddles).toHaveLength(1)
    const puddle = { ...simulation.puddles[0] }
    simulation.dropTreat({ x: cat.x, z: cat.z })
    expect(cat.activity).toBe('vomiting')
    for (let i = 0; i < 26; i++) simulation.step(0.1)
    expect(cat.activity).toBe('resting')
    expect(cat.nextVomitAt).toBeGreaterThan(simulation.elapsed + 80)
    expect(simulation.puddles).toEqual([puddle])
  })

  it('keeps puddles indefinitely and replaces the oldest after 50', () => {
    const simulation = new Simulation()
    for (const cat of simulation.cats) {
      cat.timer = 1000
      cat.nextVomitAt = Infinity
    }
    const cat = simulation.cats[0]
    for (let i = 0; i < MAX_PUDDLES + 1; i++) {
      Object.assign(cat, {
        activity: 'vomiting',
        activityTime: VOMIT_EMIT_TIME - 0.05,
        timer: 3,
      })
      simulation.step(0.1)
    }
    expect(simulation.puddles).toHaveLength(50)
    expect(simulation.puddles[0].createdAt).toBeCloseTo(0.2)
    expect(simulation.puddles.at(-1)!.createdAt).toBeCloseTo(5.1)
    cat.activity = 'resting'
    cat.timer = 1000
    const retained = simulation.puddles.map((puddle) => ({ ...puddle }))
    for (let i = 0; i < 1200; i++) simulation.step(0.1)
    expect(simulation.puddles).toEqual(retained)
  })
})
