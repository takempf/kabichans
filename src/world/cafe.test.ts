import { describe, expect, it } from 'vitest'
import {
  CAFE_WORKER_IDS,
  Simulation,
  bodyRadius,
  isBehindCounter,
  isOnShift,
  isIndoors,
  isPerched,
  isWalkable,
  sharesSpace,
} from './simulation'
import type { Cat } from './simulation'
import {
  ALL_CAFE_SEATS,
  CAFE_ORDER_SPOT,
  CAFE_QUEUE_SLOTS,
  CAFE_TABLES,
  TABLE_SURFACE_HEIGHT,
  isInsideCafeProp,
} from './cafe'
import { cafeObstacles } from './geography'

function residentsHaveSpace(residents: Cat[]) {
  // Residents in a cottage doorway, or inside, are within its walls.
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

// One seeded afternoon at the cafe, observed step by step.
function cafeDay(seconds: number) {
  const simulation = new Simulation()
  const log = {
    maxLine: 0,
    frontOnly: true,
    sittingInLine: 0,
    offSlot: 0,
    spaced: true,
    fewestWorking: Infinity,
    mostStaff: 0,
    served: [] as number[],
    orders: [] as { treat: string; decision: string }[],
    stoolsUsed: new Set<number>(),
    offStool: 0,
    hopsUp: 0,
    hopsDown: 0,
    tableFood: 0,
    lawnFood: 0,
    departed: 0,
    stoolsCleared: 0,
    reliefs: 0,
    formerStaff: new Set<number>(),
  }
  const stages = new Map<number, string>()
  const seats = new Map<number, string>()
  for (let frame = 0; frame < seconds * 10; frame++) {
    simulation.step(0.1)
    const [front] = simulation.cafeQueue
    log.maxLine = Math.max(log.maxLine, simulation.cafeQueue.length)
    const staff = simulation.cats.filter((cat) => cat.cafeWorker)
    log.mostStaff = Math.max(log.mostStaff, staff.length)
    log.fewestWorking = Math.min(
      log.fewestWorking,
      staff.filter((cat) => isOnShift(cat) && cat.cafeWorker!.state !== 'break')
        .length,
    )
    if (frame % 10 === 0 && !residentsHaveSpace(simulation.cats))
      log.spaced = false
    for (const cat of simulation.cats) {
      const customer = cat.cafeCustomer
      const stage = customer?.stage ?? (cat.cafeWorker?.state || 'none')
      const previous = stages.get(cat.id)
      if (
        (customer?.stage === 'ordering' || customer?.stage === 'waiting') &&
        cat.id !== front
      )
        log.frontOnly = false
      if (
        customer?.stage === 'eating' &&
        customer.seatIndex !== null &&
        customer.timer > 2
      ) {
        const seat = ALL_CAFE_SEATS[customer.seatIndex]
        log.offStool = Math.max(
          log.offStool,
          Math.hypot(cat.x - seat.x, cat.z - seat.z),
        )
      }
      if (customer?.stage === 'queuing' && cat.activity === 'sitting') {
        log.sittingInLine++
        const slot = CAFE_QUEUE_SLOTS[customer.place - 1]
        if (!slot || Math.hypot(cat.x - slot.x, cat.z - slot.z) > 1.3)
          log.offSlot++
      }
      if (previous !== stage) {
        if (stage === 'waiting') {
          const lines = cat.dialogue!.lines
          const staffer = staff.find(
            (worker) => worker.cafeWorker!.customerId === cat.id,
          )
          const decision =
            lines[staffer!.cafeWorker!.orderSpeakers.length - 1] ?? ''
          log.orders.push({ treat: customer!.foodItem!, decision })
        }
        if (stage === 'carrying') log.served.push(cat.id)
        if (previous === 'hopping_on' && stage === 'eating') log.hopsUp++
        if (previous === 'hopping_off' && stage === 'leaving') log.hopsDown++
        if (stage === 'eating') {
          const food = simulation.deliveredFoods.find(
            (item) => item.catId === cat.id,
          )
          if (customer!.seatIndex !== null) {
            log.stoolsUsed.add(customer!.seatIndex)
            if (food?.y === TABLE_SURFACE_HEIGHT) log.tableFood++
          } else if (food?.y === 0) log.lawnFood++
        }
        if (previous === 'leaving' && stage === 'none') log.departed++
        if (stage === 'reporting') log.reliefs++
        if (previous === 'leaving' && !cat.cafeWorker) {
          log.formerStaff.add(cat.id)
          expect(cat.activity).not.toBe('working')
        }
        stages.set(cat.id, stage)
      }
    }
    for (const seat of simulation.cafeSeats) {
      if (seats.get(seat.index) === 'clearing' && seat.stage === 'free')
        log.stoolsCleared++
      seats.set(seat.index, seat.stage)
    }
  }
  return { simulation, log }
}

describe('meadow cafe', { timeout: 120000 }, () => {
  it('opens with a barista and two servers behind the counter', () => {
    const simulation = new Simulation()
    const staff = CAFE_WORKER_IDS.map((id) => simulation.cats[id])
    expect(staff.map((cat) => cat.cafeWorker?.role)).toEqual([
      'barista',
      'server',
      'server',
    ])
    for (const cat of staff) {
      expect(cat.activity).toBe('working')
      expect(isOnShift(cat)).toBe(true)
      expect(isBehindCounter(cat)).toBe(true)
      expect(isWalkable(cat.x, cat.z, bodyRadius(cat))).toBe(true)
      expect(cat.nextVomitAt).toBe(Infinity)
    }
    expect(simulation.snapshot().counts.working).toBe(3)
  })

  it('lays out a clear line and three tables with three stools each', () => {
    const line = [CAFE_ORDER_SPOT, ...CAFE_QUEUE_SLOTS]
    for (const [index, spot] of line.entries()) {
      expect(isWalkable(spot.x, spot.z, 1.1)).toBe(true)
      expect(isInsideCafeProp(spot.x, spot.z, 0.4)).toBe(false)
      if (index)
        expect(
          Math.hypot(spot.x - line[index - 1].x, spot.z - line[index - 1].z),
        ).toBeGreaterThanOrEqual(2.2)
    }
    expect(CAFE_TABLES).toHaveLength(3)
    expect(ALL_CAFE_SEATS).toHaveLength(9)
    for (const table of CAFE_TABLES) {
      expect(
        cafeObstacles.some(
          (obstacle) => obstacle.x === table.x && obstacle.z === table.z,
        ),
      ).toBe(true)
      expect(isWalkable(table.approach.x, table.approach.z, 1.1)).toBe(true)
    }
    for (const seat of ALL_CAFE_SEATS) {
      // Stools are solid; diners hop up from a clear spot facing the table.
      expect(isWalkable(seat.x, seat.z, 0.3)).toBe(false)
      expect(isWalkable(seat.approach.x, seat.approach.z, 1.1)).toBe(true)
      const hop = Math.atan2(seat.x - seat.approach.x, seat.z - seat.approach.z)
      expect(Math.cos(hop - seat.heading)).toBeCloseTo(1)
      for (const other of ALL_CAFE_SEATS)
        if (other !== seat)
          expect(
            Math.hypot(seat.x - other.x, seat.z - other.z),
          ).toBeGreaterThanOrEqual(2.2)
      for (const spot of line)
        expect(Math.hypot(seat.x - spot.x, seat.z - spot.z)).toBeGreaterThan(3)
    }
  })

  it('runs a whole afternoon: lining up, ordering in turn, and enjoying treats', () => {
    // Nappers don't get cravings, so the afternoon runs a little longer.
    const { simulation, log } = cafeDay(700)
    // A line forms, and only the cat at the front talks to the barista.
    expect(log.maxLine).toBeGreaterThanOrEqual(4)
    expect(log.frontOnly).toBe(true)
    expect(log.sittingInLine).toBeGreaterThan(0)
    expect(log.offSlot / log.sittingInLine).toBeLessThan(0.05)
    expect(log.served.length).toBeGreaterThanOrEqual(20)
    // Deliberation always ends on the treat that gets served.
    expect(log.orders.length).toBeGreaterThanOrEqual(20)
    for (const { treat, decision } of log.orders)
      expect(decision).toMatch(treat === 'churu' ? /churu/i : /can/i)
    expect(new Set(log.orders.map((order) => order.treat)).size).toBe(2)
    // Treats are enjoyed on the stools, and servers clear up afterwards.
    expect(log.stoolsUsed.size).toBeGreaterThanOrEqual(5)
    expect(log.tableFood).toBeGreaterThan(0)
    // Diners hop onto the middle of the stool, not its edge, and back down.
    expect(log.offStool).toBeLessThan(0.01)
    expect(log.hopsUp).toBeGreaterThanOrEqual(10)
    expect(log.hopsDown).toBeGreaterThanOrEqual(8)
    expect(log.departed).toBeGreaterThanOrEqual(15)
    expect(log.stoolsCleared).toBeGreaterThan(0)
    // Shifts change hands without leaving the counter short.
    expect(log.fewestWorking).toBeGreaterThanOrEqual(2)
    expect(log.mostStaff).toBeLessThanOrEqual(4)
    expect(log.reliefs).toBeGreaterThanOrEqual(2)
    expect(log.formerStaff.size).toBeGreaterThanOrEqual(1)
    expect(log.spaced).toBe(true)
    expect(
      simulation.cats.filter((cat) => cat.cafeWorker?.role === 'barista'),
    ).toHaveLength(1)
  })

  it('provides line, stool, and food snapshot data', () => {
    const simulation = new Simulation()
    for (let frame = 0; frame < 300; frame++) simulation.step(0.1)
    const snapshot = simulation.snapshot()
    expect(snapshot.cafeSeats).toHaveLength(ALL_CAFE_SEATS.length)
    expect(snapshot.cafeQueue).toEqual(simulation.cafeQueue)
    expect(snapshot.cafeQueue).not.toBe(simulation.cafeQueue)
    expect(Array.isArray(snapshot.deliveredFoods)).toBe(true)
    expect(Array.isArray(snapshot.carriedItems)).toBe(true)
  })
})
