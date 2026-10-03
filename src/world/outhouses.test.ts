import { describe, expect, it } from 'vitest'
import {
  JANITOR_IDS,
  Simulation,
  bodyRadius,
  catRadius,
  isHidden,
  isIndoors,
  isOnJanitorDuty,
  isPerched,
  isWalkable,
  sharesSpace,
} from './simulation'
import type { Cat } from './simulation'
import { OUTHOUSE_SIZE, outhouses } from './geography'
import {
  JANITOR_POSTS,
  JANITOR_SIGN_IN,
  OUTHOUSE_FILTHY,
  OUTHOUSE_LINE,
  isInOuthouseYard,
  outhouseDoorway,
  outhouseExitSpots,
} from './outhouseLayout'
import { isInCafeQueueLane, isOnCafeTerrace } from './cafeLayout'
import { isInCottageDoorway } from './cottageLayout'

function residentsHaveSpace(residents: Cat[]) {
  const cats = residents.filter((cat) => !isIndoors(cat))
  return cats.every((cat, index) => {
    if (!isPerched(cat) && !isWalkable(cat.x, cat.z, bodyRadius(cat)))
      return false
    return cats
      .slice(index + 1)
      .every(
        (other) =>
          sharesSpace(cat, other) ||
          Math.hypot(cat.x - other.x, cat.z - other.z) >=
            bodyRadius(cat) + bodyRadius(other) - 1e-9,
      )
  })
}

// Ten seeded minutes by the outhouses, observed step by step.
function loDay(seconds: number) {
  const simulation = new Simulation()
  const log = {
    entered: 0,
    exited: 0,
    enteredDirty: 0,
    calledWhileCleaning: 0,
    longestLine: 0,
    scooped: 0,
    puddlesCleaned: 0,
    handovers: 0,
    formerJanitors: new Set<number>(),
    fewestOnDuty: Infinity,
    mostOnDuty: 0,
    farFromPuddle: 0,
    spaced: true,
  }
  const stages = new Map<number, string>()
  const janitorStates = new Map<number, string>()
  for (let frame = 0; frame < seconds * 10; frame++) {
    // The puke spot each janitor is on, before this step.
    const scrubbing = new Map<number, number>()
    for (const cat of simulation.cats) {
      const job = cat.janitor?.job
      if (job?.kind === 'puddle') scrubbing.set(cat.id, job.puddleId)
    }
    simulation.step(0.1)
    log.longestLine = Math.max(log.longestLine, simulation.outhouseLine.length)
    const onDuty = simulation.cats.filter(isOnJanitorDuty).length
    log.fewestOnDuty = Math.min(log.fewestOnDuty, onDuty)
    log.mostOnDuty = Math.max(log.mostOnDuty, onDuty)
    for (const outhouse of simulation.outhouses) {
      // One visitor at a time, and whoever is inside is out of sight.
      const visitors = simulation.cats.filter(
        (cat) => cat.outhouse?.outhouseId === outhouse.id,
      )
      expect(visitors.length).toBeLessThanOrEqual(1)
      expect(outhouse.visitorId).toBe(visitors[0]?.id ?? null)
      for (const cat of visitors)
        if (cat.outhouse!.stage === 'inside') expect(isHidden(cat)).toBe(true)
      const scooping = simulation.cats.filter(
        (cat) =>
          cat.janitor?.job?.kind === 'outhouse' &&
          cat.janitor.job.outhouseId === outhouse.id,
      )
      expect(scooping.length).toBeLessThanOrEqual(1)
      expect(outhouse.janitorId).toBe(scooping[0]?.id ?? null)
    }
    for (const cat of simulation.cats) {
      const stage = cat.outhouse?.stage ?? 'none'
      const previous = stages.get(cat.id)
      if (previous !== 'called' && stage === 'called') {
        // Once a janitor is on the way, only someone already called goes in.
        const outhouse = simulation.outhouses[cat.outhouse!.outhouseId!]
        if (outhouse.closed) log.calledWhileCleaning++
      }
      if (previous !== 'entering' && stage === 'entering') {
        log.entered++
        const outhouse = simulation.outhouses[cat.outhouse!.outhouseId!]
        if (outhouse.dirt >= OUTHOUSE_FILTHY) log.enteredDirty++
      }
      if (previous === 'leaving' && stage === 'none') {
        log.exited++
        // Back out on open ground, free to get on with the day.
        expect(isWalkable(cat.x, cat.z, catRadius(cat))).toBe(true)
        expect(cat.emote).toBe('relieved')
      }
      stages.set(cat.id, stage)
      const janitor = cat.janitor
      const state = janitor
        ? `${janitor.state}:${janitor.job?.kind ?? ''}`
        : 'none'
      const before = janitorStates.get(cat.id)
      if (before === 'exiting:outhouse' && state !== before) log.scooped++
      // Scrubbed clean and gone, with a sparkle to show for it.
      if (
        before === 'cleaning:puddle' &&
        cat.emote === 'sparkle' &&
        cat.emoteAt === simulation.elapsed
      ) {
        log.puddlesCleaned++
        // Gone from the grass.
        const scrubbed = scrubbing.get(cat.id)
        expect(simulation.puddles.some((spot) => spot.id === scrubbed)).toBe(
          false,
        )
      }
      if (before === 'reporting:' && state === 'idle:') log.handovers++
      if (before && before !== 'none' && state === 'none') {
        log.formerJanitors.add(cat.id)
        expect(cat.activity).not.toBe('working')
      }
      janitorStates.set(cat.id, state)
      const job = janitor?.job
      if (janitor?.state === 'cleaning' && job?.kind === 'puddle') {
        const puddle = simulation.puddles.find(
          (spot) => spot.id === job.puddleId,
        )
        if (
          puddle &&
          Math.hypot(cat.x - puddle.x, cat.z - puddle.z) > 1.2 * cat.scale
        )
          log.farFromPuddle++
      }
    }
    if (frame % 10 === 0 && !residentsHaveSpace(simulation.cats))
      log.spaced = false
  }
  return { simulation, log }
}

let day: ReturnType<typeof loDay> | null = null
const tenMinutes = () => (day ??= loDay(600))

describe('outhouses and janitors', { timeout: 180000 }, () => {
  it('stand in the back corner, cat-sized and solid, with room to line up and step out', () => {
    for (const outhouse of outhouses) {
      // Back left, as seen from the meadow.
      expect(outhouse.x).toBeLessThan(-30)
      expect(outhouse.z).toBeLessThan(-44)
      for (const dx of [-1, 1])
        for (const dz of [-1, 1])
          expect(
            isWalkable(
              outhouse.x + (dx * OUTHOUSE_SIZE.width) / 2,
              outhouse.z + (dz * OUTHOUSE_SIZE.depth) / 2,
              0,
            ),
          ).toBe(false)
    }
    const doorways = outhouses.map(outhouseDoorway)
    const spots = [
      ...doorways.flatMap((doorway) => [doorway.threshold, doorway.side]),
      ...outhouses.flatMap(outhouseExitSpots),
      ...OUTHOUSE_LINE,
      ...JANITOR_POSTS,
      JANITOR_SIGN_IN,
    ]
    for (const [index, spot] of spots.entries()) {
      expect(isWalkable(spot.x, spot.z, 1.2)).toBe(true)
      expect(isOnCafeTerrace(spot.x, spot.z, 1.2)).toBe(false)
      expect(isInCafeQueueLane(spot.x, spot.z, 1.2)).toBe(false)
      expect(isInCottageDoorway(spot.x, spot.z, 1.2)).toBe(false)
      // Loungers and gatherings leave the whole yard to its visitors.
      expect(isInOuthouseYard(spot.x, spot.z, -1)).toBe(true)
      for (const other of spots.slice(index + 1))
        expect(Math.hypot(spot.x - other.x, spot.z - other.z)).toBeGreaterThan(
          2.2,
        )
    }
    // The doors are a cat-sized walk through, like the cottages'.
    expect(OUTHOUSE_SIZE.doorWidth).toBeGreaterThanOrEqual(2)
  })

  it('opens the day with four janitors on duty', () => {
    const simulation = new Simulation()
    const janitors = JANITOR_IDS.map((id) => simulation.cats[id])
    for (const cat of janitors) {
      expect(isOnJanitorDuty(cat)).toBe(true)
      expect(cat.activity).toBe('working')
      expect(cat.nextVomitAt).toBe(Infinity)
    }
    expect(new Set(janitors.map((cat) => cat.janitor!.post)).size).toBe(4)
  })

  it('takes visitors one at a time, and nobody goes into a dirty litter box', () => {
    const { log } = tenMinutes()
    expect(log.entered).toBeGreaterThan(12)
    expect(log.exited).toBeGreaterThan(10)
    expect(log.longestLine).toBeGreaterThanOrEqual(2)
    expect(log.longestLine).toBeLessThanOrEqual(OUTHOUSE_LINE.length)
    expect(log.enteredDirty).toBe(0)
    expect(log.calledWhileCleaning).toBe(0)
    expect(log.spaced).toBe(true)
  })

  it('keeps four janitors scooping litter boxes and mopping up, in shifts', () => {
    const { simulation, log } = tenMinutes()
    expect(log.scooped).toBeGreaterThanOrEqual(3)
    expect(log.puddlesCleaned).toBeGreaterThanOrEqual(30)
    // They kneel right beside whatever they're scrubbing.
    expect(log.farFromPuddle).toBe(0)
    // Shifts change hands at the cart without leaving anyone short.
    expect(log.fewestOnDuty).toBe(4)
    expect(log.mostOnDuty).toBe(4)
    expect(log.handovers).toBeGreaterThanOrEqual(2)
    expect(log.formerJanitors.size).toBeGreaterThanOrEqual(2)
    // Janitors never get queasy on the job.
    for (const cat of simulation.cats.filter((cat) => cat.janitor))
      expect(cat.activity).not.toBe('vomiting')
  })
})
