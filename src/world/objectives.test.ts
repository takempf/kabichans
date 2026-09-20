import { describe, expect, it } from 'vitest'
import {
  STARTLE_SECONDS,
  EMOTE_SECONDS,
  Simulation,
  catRadius,
  houses,
  isWalkable,
  TRAVEL_SPEEDS,
} from './simulation'
import type { Cat, Intention, TravelMode } from './simulation'
import { clearSegment, findRoute } from './navigation'

function smallWorld(count = 1) {
  const simulation = new Simulation(123)
  simulation.cats.splice(count)
  for (const [index, cat] of simulation.cats.entries()) {
    Object.assign(cat, {
      x: index * 6,
      z: 0,
      scale: 1,
      pace: 1,
      activity: 'sitting',
      timer: 1000,
      nextVomitAt: Infinity,
      heading: Math.PI / 2,
      pose: { sitting: 0, lying: 0, vomiting: 0 },
      target: { x: index * 6, z: 0 },
    })
  }
  return simulation
}

function plan(cat: Cat, intention: Partial<Intention>) {
  const entry = {
    kind: 'rest' as const,
    destination: { x: 12, z: 0 },
    friendId: null,
    hangout: null,
    duration: 20,
    ...intention,
  }
  cat.schedule = [
    { ...entry, dueAt: 0 },
    { ...entry, dueAt: 1000 },
    { ...entry, dueAt: 2000 },
  ]
  cat.timer = 0
}

function advanceUntil(
  simulation: Simulation,
  condition: () => boolean,
  seconds = 90,
) {
  for (let i = 0; i < seconds * 10 && !condition(); i++) simulation.step(0.1)
  expect(condition()).toBe(true)
}

describe('personal objectives and schedules', () => {
  it('gives residents distinct, reproducible routines, friends, and remembered resting places', () => {
    const first = new Simulation(42)
    const second = new Simulation(42)
    expect(first.snapshot()).toEqual(second.snapshot())
    expect(new Set(first.cats.map((cat) => cat.schedule[0].kind)).size).toBe(3)
    expect(new Set(first.cats.map((cat) => cat.schedule[0].dueAt)).size).toBe(
      100,
    )
    for (const cat of first.cats) {
      expect(cat.favorites.length).toBeGreaterThan(0)
      expect(cat.friends).not.toContain(cat.id)
      expect(cat.schedule.map((entry) => entry.dueAt)).toEqual(
        cat.schedule.map((entry) => entry.dueAt).sort((a, b) => a - b),
      )
      const nap = cat.schedule.find((entry) => entry.kind === 'rest')!
      expect(
        cat.favorites.some(
          (spot) =>
            spot.point.x === nap.destination.x &&
            spot.point.z === nap.destination.z,
        ),
      ).toBe(true)
    }
  })

  it('routes around a cottage and completes a nap at the intended spot', () => {
    const simulation = smallWorld()
    const cat = simulation.cats[0]
    const cottage = houses[1]
    Object.assign(cat, { x: cottage.x - 11, z: cottage.z })
    const destination = { x: cottage.x + 10, z: cottage.z }
    plan(cat, { destination })
    simulation.step(0.1)
    const objective = cat.objective!
    expect(cat.route.length).toBeGreaterThan(1)
    for (
      let frame = 0;
      frame < 1000 && objective.phase === 'traveling';
      frame++
    ) {
      simulation.step(0.1)
      expect(cat.objective).toBe(objective)
      expect(cat.objective!.destination).toEqual(destination)
      expect(isWalkable(cat.x, cat.z, catRadius(cat))).toBe(true)
    }
    expect(objective.phase).toBe('doing')
    expect(cat.activity).toBe('lying')
    expect(
      Math.hypot(cat.x - destination.x, cat.z - destination.z),
    ).toBeLessThan(0.8)
    for (let i = 0; i < 50; i++) simulation.step(0.1)
    expect(cat.activity).toBe('lying')
  })

  it('seeks the named friend across the meadow, follows their move, and has a mutual chat', () => {
    const simulation = smallWorld(3)
    const [cat, neighbor, friend] = simulation.cats
    Object.assign(cat, { x: -30, z: 0 })
    Object.assign(neighbor, { x: -25, z: 0, target: { x: -25, z: 0 } })
    plan(cat, { kind: 'visit', friendId: friend.id })
    for (let i = 0; i < 80; i++) simulation.step(0.1)
    expect(cat.objective?.friendId).toBe(friend.id)
    Object.assign(friend, { x: 10, z: -8, target: { x: 10, z: -8 } })
    advanceUntil(simulation, () => cat.objective?.phase === 'doing')
    expect(cat.socialTarget).toBe(friend.id)
    expect(friend.socialTarget).toBe(cat.id)
    expect(friend.objective?.phase).toBe('doing')
    expect(neighbor.socialTarget).toBeNull()
    const speakers = new Set<number>()
    for (let i = 0; i < 85; i++) {
      simulation.step(0.1)
      for (const resident of [cat, friend])
        if (resident.speaking > 0.7) speakers.add(resident.id)
    }
    expect(speakers).toEqual(new Set([cat.id, friend.id]))
    expect(
      Math.hypot(cat.x - friend.x, cat.z - friend.z),
    ).toBeGreaterThanOrEqual(catRadius(cat) + catRadius(friend))
  })

  it('resumes the same errand after a treat instead of forgetting its destination', () => {
    const simulation = smallWorld()
    const cat = simulation.cats[0]
    plan(cat, { destination: { x: 0, z: -18 } })
    simulation.step(0.1)
    const objective = cat.objective!
    simulation.dropTreat({ x: 0, z: 5 })
    advanceUntil(simulation, () => cat.activity === 'snacking', 2)
    for (let i = 0; i < 195; i++) simulation.step(0.1)
    expect(cat.objective).toBe(objective)
    expect(cat.objective!.destination).toEqual({ x: 0, z: -18 })
    expect(cat.travelMode).toBe('walking')
    advanceUntil(simulation, () => cat.activity === 'lying')
  })

  it('runs away from company before vomiting, leaves a puddle, and recovers', () => {
    const simulation = smallWorld(3)
    const cat = simulation.cats[0]
    cat.nextVomitAt = 0
    cat.timer = 0
    simulation.step(0.1)
    expect(cat.objective?.kind).toBe('privacy')
    expect(cat.travelMode).toBe('sprinting')
    expect(cat.activity).not.toBe('vomiting')
    const objective = cat.objective
    simulation.dropTreat({ x: cat.x, z: cat.z })
    expect(cat.objective).toBe(objective)
    expect(cat.activity).not.toBe('snacking')
    // Keep the other residents at home for a deterministic isolation check.
    for (const other of simulation.cats.slice(1)) {
      other.activity = 'sitting'
      other.timer = 1000
      other.target = { x: other.x, z: other.z }
    }
    advanceUntil(simulation, () => cat.activity === 'vomiting', 65)
    expect(Math.hypot(cat.x, cat.z)).toBeGreaterThan(3)
    expect(
      simulation.cats
        .slice(1)
        .every((other) => Math.hypot(cat.x - other.x, cat.z - other.z) > 5),
    ).toBe(true)
    for (let i = 0; i < 52; i++) simulation.step(0.1)
    expect(cat.activity).toBe('resting')
    expect(cat.objective).toBeNull()
    expect(simulation.puddles).toHaveLength(1)
    expect(cat.nextVomitAt).toBeGreaterThan(simulation.elapsed + 100)
  })

  it('freezes with a "!" on realizing they will vomit, then runs off', () => {
    const simulation = smallWorld(2)
    const cat = simulation.cats[0]
    cat.nextVomitAt = 0
    cat.timer = 0
    simulation.step(0.1)
    expect(cat.objective?.kind).toBe('privacy')
    expect(cat.emote).toBe('queasy')
    const start = { x: cat.x, z: cat.z }
    for (let i = 0; i < 8; i++) simulation.step(STARTLE_SECONDS / 10)
    expect(Math.hypot(cat.x - start.x, cat.z - start.z)).toBe(0)
    for (let i = 0; i < 10; i++) simulation.step(0.1)
    expect(Math.hypot(cat.x - start.x, cat.z - start.z)).toBeGreaterThan(0.3)
    advanceUntil(simulation, () => cat.emote === null, EMOTE_SECONDS.queasy)
  })

  it('lets an unavailable friend rest and eventually moves on', () => {
    const simulation = smallWorld(2)
    const [cat, friend] = simulation.cats
    friend.activity = 'resting'
    plan(cat, { kind: 'visit', friendId: friend.id })
    simulation.step(0.1)
    const objective = cat.objective
    for (let i = 0; i < 1160 && cat.objective === objective; i++)
      simulation.step(0.1)
    expect(cat.objective).not.toBe(objective)
    expect(friend.activity).toBe('resting')
    expect(friend.socialTarget).toBeNull()
  })

  it('reconsiders a private spot if another resident arrives there first', () => {
    const simulation = smallWorld(2)
    const [cat, neighbor] = simulation.cats
    plan(cat, { kind: 'privacy', destination: { x: 12, z: 0 } })
    Object.assign(neighbor, { x: 12, z: 4, target: { x: 12, z: 4 } })
    simulation.step(0.1)
    const objective = cat.objective!
    advanceUntil(
      simulation,
      () => objective.destination.x !== 12 || objective.destination.z !== 0,
      30,
    )
    expect(cat.objective).toBe(objective)
    expect(cat.activity).not.toBe('vomiting')
    expect(simulation.puddles).toHaveLength(0)
    advanceUntil(simulation, () => cat.activity === 'vomiting', 60)
    expect(Math.hypot(cat.x - neighbor.x, cat.z - neighbor.z)).toBeGreaterThan(
      5,
    )
  })

  it.each(['rest', 'explore'] as const)(
    'lets a friend resume their %s plan after accepting a visit',
    (kind) => {
      const simulation = smallWorld(2)
      const [visitor, friend] = simulation.cats
      plan(friend, { kind, destination: { x: 17, z: 0 } })
      simulation.step(0.1)
      const destination = { ...friend.objective!.destination }
      plan(visitor, { kind: 'visit', friendId: friend.id, duration: 4 })
      advanceUntil(simulation, () => visitor.objective?.phase === 'doing')
      expect(friend.schedule[0]).toMatchObject({ kind, destination })
      advanceUntil(simulation, () => friend.objective?.kind === kind)
      expect(friend.objective?.destination).toEqual(destination)
    },
  )

  it('keeps UI snapshots independent of live objectives and schedules', () => {
    const simulation = smallWorld()
    plan(simulation.cats[0], {})
    simulation.step(0.1)
    const snapshot = simulation.snapshot()
    snapshot.cats[0].objective!.destination.x = 999
    snapshot.cats[0].schedule[0].destination.x = 888
    snapshot.cats[0].route[0].x = 777
    expect(simulation.cats[0].objective!.destination.x).toBe(12)
    expect(simulation.cats[0].schedule[0].destination.x).toBe(12)
    expect(simulation.cats[0].route[0].x).toBe(12)
  })
})

describe('travel and navigation', () => {
  it('uses clearly different speeds, accelerates into them, and slows to a stop', () => {
    const distances: number[] = []
    for (const mode of ['walking', 'trotting', 'sprinting'] as TravelMode[]) {
      const simulation = smallWorld()
      const cat = simulation.cats[0]
      Object.assign(cat, {
        activity: 'wandering',
        travelMode: mode,
        target: { x: 21, z: 0 },
      })
      simulation.step(0.1)
      expect(cat.x).toBeLessThan(TRAVEL_SPEEDS[mode] * 0.1)
      for (let i = 0; i < 29; i++) simulation.step(0.1)
      distances.push(cat.x)
      expect(cat.travelSpeed).toBeCloseTo(TRAVEL_SPEEDS[mode], 1)
    }
    expect(distances[1]).toBeGreaterThan(distances[0] * 1.7)
    expect(distances[2]).toBeGreaterThan(distances[1] * 1.6)
    const simulation = smallWorld()
    const cat = simulation.cats[0]
    plan(cat, { destination: { x: 10, z: 0 }, kind: 'privacy' })
    simulation.step(0.1)
    advanceUntil(simulation, () => cat.activity === 'vomiting')
    for (let i = 0; i < 20; i++) simulation.step(0.1)
    expect(cat.travelSpeed).toBeLessThan(0.001)
    expect(cat.walking).toBeLessThan(0.001)
  })

  it('returns safe routes around scenery and blockers, and rejects unreachable destinations', () => {
    const cottage = houses[1]
    const from = { x: cottage.x - 11, z: cottage.z },
      to = { x: cottage.x + 10, z: cottage.z }
    const blockers = [{ x: cottage.x - 8, z: cottage.z + 5, radius: 1.5 }]
    const route = findRoute(from, to, 1.08, blockers)
    expect(route.length).toBeGreaterThan(1)
    let previous = from
    for (const point of route) {
      expect(clearSegment(previous, point, 1.08, blockers)).toBe(true)
      previous = point
    }
    expect(route.at(-1)).toEqual(to)
    expect(findRoute(from, cottage, 1)).toEqual([])
    expect(findRoute(from, { x: 500, z: 500 }, 1)).toEqual([])
  })
})
