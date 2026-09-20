import { describe, expect, it } from 'vitest'
import { Simulation, catRadius, isWalkable } from './simulation'
import type { Conversation } from './simulation'

function waitForGroup(simulation: Simulation, phase: Conversation['phase']) {
  for (let frame = 0; frame < 1800; frame++) {
    simulation.step(0.1)
    const group = simulation.conversations.find(
      (meeting) => meeting.phase === phase,
    )
    if (group) return group
  }
  throw new Error(`No ${phase} conversation formed`)
}

describe('occasional conversations', { timeout: 60000 }, () => {
  it.each([42, 123])(
    'gathers, takes turns, and disperses without overlaps or abrupt turns (seed %s)',
    (seed) => {
      const simulation = new Simulation(seed)
      for (let frame = 0; frame < 590; frame++) simulation.step(0.1)
      expect(simulation.conversations).toHaveLength(0)
      const group = waitForGroup(simulation, 'gathering')
      expect(group.members.length).toBeGreaterThanOrEqual(2)
      expect(group.members.length).toBeLessThanOrEqual(5)
      expect(new Set(group.members).size).toBe(group.members.length)
      const members = simulation.cats.filter((cat) =>
        group.members.includes(cat.id),
      )
      const initial = members.map((cat) => ({ x: cat.x, z: cat.z }))
      const spots = members.map((cat) => ({ ...cat.target }))
      let previousSpeaking = members.map((cat) => cat.speaking)
      const speakers = new Set<number>()
      let discussionStarted = 0
      let positions: { x: number; z: number }[] = []
      for (
        let frame = 0;
        frame < 900 && simulation.conversations.length;
        frame++
      ) {
        const headings = members.map((cat) => cat.heading)
        simulation.step(0.1)
        if (!simulation.conversations.length) break
        expect(simulation.conversations).toHaveLength(1)
        for (const [index, cat] of members.entries()) {
          expect(cat.conversationId).toBe(group.id)
          expect(cat.activity).toBe('conversing')
          expect(Math.abs(cat.heading - headings[index])).toBeLessThanOrEqual(
            0.24 + 1e-9,
          )
          expect(isWalkable(cat.x, cat.z, catRadius(cat))).toBe(true)
          for (const other of simulation.cats)
            if (cat.id !== other.id)
              expect(
                Math.hypot(cat.x - other.x, cat.z - other.z),
              ).toBeGreaterThanOrEqual(catRadius(cat) + catRadius(other) - 1e-9)
        }
        if (group.phase === 'gathering') {
          expect(group.speaker).toBeNull()
          expect(
            members.every(
              (cat, index) => cat.speaking <= previousSpeaking[index],
            ),
          ).toBe(true)
          previousSpeaking = members.map((cat) => cat.speaking)
        } else {
          if (!discussionStarted) {
            discussionStarted = simulation.elapsed
            positions = members.map((cat) => ({ x: cat.x, z: cat.z }))
          }
          expect(group.members).toContain(group.speaker)
          speakers.add(group.speaker!)
          for (const [index, cat] of members.entries()) {
            expect({ x: cat.x, z: cat.z }).toEqual(positions[index])
            if (simulation.elapsed - discussionStarted > 4) {
              const facing = Math.atan2(
                group.center.x - cat.x,
                group.center.z - cat.z,
              )
              expect(Math.cos(cat.heading - facing)).toBeGreaterThan(0.99)
            }
          }
        }
      }
      expect(discussionStarted).toBeGreaterThan(0)
      expect(speakers).toEqual(new Set(group.members))
      // Someone walks into the circle, unless everyone was already in place
      // (within the reach that counts as arrived when a gathering settles).
      expect(
        members.some(
          (cat, index) =>
            Math.hypot(cat.x - initial[index].x, cat.z - initial[index].z) >
            0.3,
        ) ||
          spots.every(
            (spot, index) =>
              Math.hypot(spot.x - initial[index].x, spot.z - initial[index].z) <
              0.7,
          ),
      ).toBe(true)
      expect(simulation.conversations).toHaveLength(0)
      expect(
        members.every(
          (cat) =>
            cat.conversationId === null &&
            cat.conversationPhase === null &&
            cat.activity !== 'conversing',
        ),
      ).toBe(true)
      for (let frame = 0; frame < 600; frame++) {
        simulation.step(0.1)
        expect(simulation.conversations).toHaveLength(0)
      }
      expect(members.every((cat) => cat.conversationId === null)).toBe(true)
    },
  )

  it.each(['gathering', 'discussing'] as const)(
    'lets nearby treats interrupt a %s group cleanly',
    (phase) => {
      const simulation = new Simulation()
      const group = waitForGroup(simulation, phase)
      simulation.dropTreat(group.center)
      expect(simulation.conversations).toHaveLength(0)
      const members = simulation.cats.filter((resident) =>
        group.members.includes(resident.id),
      )
      for (const cat of members) {
        expect(cat.conversationId).toBeNull()
        expect(cat.conversationPhase).toBeNull()
      }
      // Each one catches on in their own moment.
      for (let frame = 0; frame < 20; frame++) simulation.step(0.1)
      expect(members.every((cat) => cat.activity === 'snacking')).toBe(true)
      expect(
        simulation.cats
          .filter((cat) => group.members.includes(cat.id))
          .every((cat) => cat.speaking < 0.001),
      ).toBe(true)
    },
  )

  it('abandons a gathering that cannot finish instead of leaving cats stuck', () => {
    const simulation = new Simulation()
    const group = waitForGroup(simulation, 'gathering')
    const member = simulation.cats.find((cat) => cat.id === group.members[0])!
    member.target = { x: 1000, z: 1000 }
    for (
      let frame = 0;
      frame < 190 && simulation.conversations.length;
      frame++
    ) {
      simulation.step(0.1)
      expect(group.phase).toBe('gathering')
    }
    expect(simulation.conversations).toHaveLength(0)
    expect(
      simulation.cats.every(
        (cat) => cat.conversationId === null && cat.conversationPhase === null,
      ),
    ).toBe(true)
  })

  it('does not recruit sleeping cats or create a one-cat discussion', () => {
    const simulation = new Simulation()
    // Cafe staff keep working their shift; everyone else dozes off.
    const residents = simulation.cats.filter((cat) => !cat.cafeWorker)
    for (const cat of residents) {
      cat.activity = cat.id === 0 ? 'sitting' : 'resting'
      cat.timer = 1000
    }
    for (let frame = 0; frame < 1200; frame++) simulation.step(0.1)
    expect(simulation.conversations).toHaveLength(0)
    expect(residents.slice(1).every((cat) => cat.activity === 'resting')).toBe(
      true,
    )
  })

  // Two whole worlds stepped side by side for nearly two minutes.
  it('reproduces group membership and speaker turns from the same seed', () => {
    const first = new Simulation(123)
    const second = new Simulation(123)
    for (let frame = 0; frame < 1100; frame++) {
      first.step(0.1)
      second.step(0.1)
    }
    expect(first.conversations[0]?.phase).toBe('discussing')
    expect(first.conversations).toEqual(second.conversations)
    expect(first.snapshot()).toEqual(second.snapshot())
  }, 60000)
})
