import { describe, expect, it } from 'vitest'
import { Simulation, catRadius, isHidden, isWalkable } from './simulation'
import { COTTAGE_SIZE, houses } from './geography'
import {
  COTTAGE_CAPACITY,
  COTTAGE_LINE_LENGTH,
  cottageDoorway,
  cottageExitSpots,
  cottageLineSpot,
} from './cottageLayout'
import { isInCafeQueueLane, isOnCafeTerrace } from './cafe'

describe('cottages', { timeout: 120000 }, () => {
  it('are cat-sized, solid, and leave room to line up and step out', () => {
    for (const house of houses) {
      // Every corner of the walls is inside the obstacle.
      for (const dx of [-1, 1])
        for (const dz of [-1, 1])
          expect(
            isWalkable(
              house.x + (dx * COTTAGE_SIZE.width) / 2,
              house.z + (dz * COTTAGE_SIZE.depth) / 2,
              0,
            ),
          ).toBe(false)
      const spots = [
        cottageDoorway(house).threshold,
        ...[...Array(COTTAGE_LINE_LENGTH).keys()].map((place) =>
          cottageLineSpot(house, place),
        ),
        ...cottageExitSpots(house),
      ]
      for (const [index, spot] of spots.entries()) {
        expect(isWalkable(spot.x, spot.z, 1.2)).toBe(true)
        expect(isOnCafeTerrace(spot.x, spot.z, 1.2)).toBe(false)
        expect(isInCafeQueueLane(spot.x, spot.z, 1.2)).toBe(false)
        for (const other of spots.slice(index + 1))
          expect(
            Math.hypot(spot.x - other.x, spot.z - other.z),
          ).toBeGreaterThan(2.2)
      }
    }
  })

  it('takes small groups in and out, one at a time through the door', () => {
    const simulation = new Simulation()
    const stages = new Map<number, string | undefined>()
    const arrivals: number[] = []
    let entered = 0
    let exited = 0
    // Company only comes along when a friend is awake and close by, so it
    // takes a good while to see a group arrive together.
    for (let frame = 0; frame < 4500; frame++) {
      simulation.step(0.1)
      const newcomers = simulation.cats.filter(
        (cat) =>
          cat.cottage?.stage === 'arriving' &&
          cat.cottage.since === simulation.elapsed,
      )
      if (newcomers.length) arrivals.push(newcomers.length)
      for (const cottage of simulation.cottages) {
        const visitors = simulation.cats.filter(
          (cat) => cat.cottage?.cottageId === cottage.id,
        )
        expect(
          visitors.filter((cat) => cat.cottage!.stage !== 'leaving').length,
        ).toBeLessThanOrEqual(COTTAGE_CAPACITY)
        const inDoorway = visitors.filter(
          (cat) =>
            cat.cottage!.stage === 'entering' ||
            cat.cottage!.stage === 'leaving',
        )
        expect(inDoorway.length).toBeLessThanOrEqual(1)
        expect(cottage.doorwayId).toBe(inDoorway[0]?.id ?? null)
        for (const id of cottage.occupants)
          expect(isHidden(simulation.cats[id])).toBe(true)
      }
      for (const cat of simulation.cats) {
        const stage = cat.cottage?.stage
        const previous = stages.get(cat.id)
        if (stage === 'inside' && previous === 'entering') entered++
        if (stage === undefined && previous === 'leaving') {
          exited++
          // Back out on open ground, free to get on with the day.
          expect(isWalkable(cat.x, cat.z, catRadius(cat))).toBe(true)
        }
        stages.set(cat.id, stage)
      }
    }
    expect(entered).toBeGreaterThan(6)
    expect(exited).toBeGreaterThan(4)
    expect(Math.max(...arrivals)).toBeGreaterThan(1)
  })
})
