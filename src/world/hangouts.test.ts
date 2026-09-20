import { describe, expect, it } from 'vitest'
import {
  NAP_SECONDS,
  NAP_SPREAD,
  Simulation,
  houses,
  isWalkable,
  picnicBlankets,
  rocks,
  trees,
} from './simulation'
import { onPicnicBlanket } from './geography'
import type { HangoutKind } from './simulation'

describe('natural gathering places', { timeout: 90000 }, () => {
  it('visits shade, cottages, rocks, picnic blankets, and clearings, then lingers there', () => {
    const simulation = new Simulation()
    const visited = new Set<HangoutKind>()
    const settled = new Set<HangoutKind>()
    for (let frame = 0; frame < 1800; frame++) {
      const before = simulation.cats.map((cat) => ({
        hangout: cat.hangout,
        target: cat.objective?.destination ?? cat.target,
      }))
      simulation.step(0.1)
      for (const [index, cat] of simulation.cats.entries()) {
        const destination = cat.objective?.destination ?? cat.target
        if (cat.hangout && destination !== before[index].target) {
          visited.add(cat.hangout)
          expect(isWalkable(destination.x, destination.z, cat.scale)).toBe(true)
          if (cat.hangout === 'shade')
            expect(
              trees.some(
                (tree) =>
                  Math.hypot(destination.x - tree.x, destination.z - tree.z) <
                  tree.radius + cat.scale * 1.45 + 1.21,
              ),
            ).toBe(true)
          if (cat.hangout === 'cottage')
            expect(
              houses.some(
                (house) =>
                  Math.hypot(destination.x - house.x, destination.z - house.z) <
                  house.radius + cat.scale * 1.45 + 2.11,
              ),
            ).toBe(true)
          if (cat.hangout === 'rock')
            expect(
              rocks.some(
                (rock) =>
                  Math.hypot(destination.x - rock.x, destination.z - rock.z) <
                  rock.radius + cat.scale * 1.45 + 2.11,
              ),
            ).toBe(true)
          if (cat.hangout === 'picnic')
            expect(
              picnicBlankets.some((blanket) =>
                onPicnicBlanket(blanket, destination.x, destination.z),
              ),
            ).toBe(true)
        }
        const previous = before[index]
        if (
          previous.hangout &&
          cat.hangout === null &&
          ['sitting', 'lying', 'resting'].includes(cat.activity) &&
          Math.hypot(cat.x - previous.target.x, cat.z - previous.target.z) <
            0.75 &&
          cat.timer >= 12
        ) {
          settled.add(previous.hangout)
          expect(cat.target).toEqual({ x: cat.x, z: cat.z })
          // Long enough to sit a while, or to sleep through a whole nap.
          expect(cat.timer).toBeLessThanOrEqual(NAP_SECONDS + NAP_SPREAD)
        }
      }
    }
    expect(visited).toEqual(
      new Set(['shade', 'cottage', 'clearing', 'rock', 'picnic']),
    )
    expect(settled).toEqual(visited)
  })

  it('develops loose landmark groupings without concentrating everyone in a crowd', () => {
    const simulation = new Simulation()
    const nearLandmark = () =>
      simulation.cats.filter(
        (cat) =>
          // In line at a cottage door, or inside, counts as being there.
          cat.cottage !== null ||
          trees.some(
            (tree) => Math.hypot(cat.x - tree.x, cat.z - tree.z) < 4.5,
          ) ||
          houses.some(
            (house) =>
              Math.hypot(cat.x - house.x, cat.z - house.z) < house.radius + 3.8,
          ),
      ).length
    const initial = nearLandmark()
    let visits = 0
    let samples = 0
    let smallGroups = 0
    let crowded = 0
    // Include multiple gatherings now that readable discussions last up to 68s.
    for (let frame = 0; frame < 3600; frame++) {
      simulation.step(0.1)
      if (frame < 1200 || frame % 100 !== 0) continue
      samples++
      visits += nearLandmark()
      for (const cat of simulation.cats) {
        const neighbors = simulation.cats.filter(
          (other) =>
            other.id !== cat.id &&
            Math.hypot(cat.x - other.x, cat.z - other.z) < 5,
        ).length
        if (neighbors >= 1 && neighbors <= 4) smallGroups++
        if (neighbors > 6) crowded++
      }
    }
    // The full fenced field is larger; check a relative landmark preference
    // and a majority in loose groups rather than the old enclosure's density.
    expect(visits / samples).toBeGreaterThan(initial * 1.25)
    expect(smallGroups / samples).toBeGreaterThan(40)
    expect(crowded / samples).toBeLessThan(8)
  }, 180000)
})
