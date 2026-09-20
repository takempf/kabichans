import { describe, expect, it } from 'vitest'
import { Simulation, WORLD } from './simulation'
import { BUTTERFLY_COUNT } from './butterflies'

describe('butterflies', { timeout: 120000 }, () => {
  it('flutter inside the meadow, are chased now and then, and are never caught', () => {
    const simulation = new Simulation()
    expect(simulation.butterflies).toHaveLength(BUTTERFLY_COUNT)
    const followers = new Set<number>()
    // Cats chasing as of the previous step.
    const following = new Set<number>()
    const chasers = new Set<number>()
    const interrupted = new Map<number, string>()
    const resumed = new Set<number>()
    let closestCall = Infinity
    // Only cats who are up and about get tempted, and plenty are napping.
    for (let i = 0; i < 3000; i++) {
      simulation.step(0.1)
      for (const butterfly of simulation.butterflies) {
        expect(Number.isFinite(butterfly.x + butterfly.z + butterfly.y)).toBe(
          true,
        )
        expect(butterfly.x).toBeGreaterThan(WORLD.minX)
        expect(butterfly.x).toBeLessThan(WORLD.maxX)
        expect(butterfly.z).toBeGreaterThan(WORLD.minZ)
        expect(butterfly.z).toBeLessThan(WORLD.maxZ)
      }
      for (const cat of simulation.cats) {
        if (cat.objective?.kind !== 'chase') {
          following.delete(cat.id)
          if (cat.objective?.kind === interrupted.get(cat.id))
            resumed.add(cat.id)
          continue
        }
        // Every chase starts with a "!" of discovery.
        if (!following.has(cat.id)) expect(cat.emote).toBe('butterfly')
        following.add(cat.id)
        followers.add(cat.id)
        if (cat.schedule[0]?.resume)
          interrupted.set(cat.id, cat.schedule[0].kind)
        if (cat.travelMode === 'walking') continue
        chasers.add(cat.id)
        const butterfly = simulation.butterflies[cat.butterflyId!]
        // A running cat never gets underneath while it is still within reach.
        if (
          cat.travelSpeed > 2 &&
          Math.hypot(cat.x - butterfly.x, cat.z - butterfly.z) < 0.9
        )
          closestCall = Math.min(closestCall, butterfly.y)
      }
    }
    expect(followers.size).toBeGreaterThan(5)
    expect(chasers.size).toBeGreaterThanOrEqual(3)
    expect(closestCall).toBeGreaterThan(2.3)
    // Whatever the butterfly interrupted picks up again afterwards.
    expect(resumed.size).toBeGreaterThan(0)
  })
})
