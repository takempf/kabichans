import { describe, expect, it } from 'vitest'
import {
  BARISTA_PREPARING,
  BARISTA_SERVING,
  createCafeOrder,
  createDialogue,
  dialogueLine,
  DialogueMemory,
  DIALOGUE_TOPICS,
} from './dialogue'
import { randomSeed, Simulation } from './simulation'

function visitingPair() {
  const simulation = new Simulation(123)
  simulation.cats.splice(2)
  for (const [index, cat] of simulation.cats.entries()) {
    Object.assign(cat, {
      x: index * 3,
      z: 0,
      scale: 1,
      activity: index ? 'sitting' : 'wandering',
      timer: index ? 1000 : 0,
      nextVomitAt: Infinity,
      pose: { sitting: 0, lying: 0, vomiting: 0 },
      target: { x: index * 3, z: 0 },
      schedule: [
        {
          kind: 'visit',
          friendId: 1,
          destination: { x: 3, z: 0 },
          hangout: null,
          duration: 24,
          dueAt: 0,
        },
      ],
    })
  }
  simulation.step(0.1)
  simulation.step(0.1)
  expect(simulation.cats[0].dialogue).not.toBeNull()
  return simulation
}

describe('little conversations', () => {
  it('orders dither between the two treats, then land on the one served', () => {
    const random = randomSeed(91)
    const memory = new DialogueMemory()
    const openings = new Set<string>()
    const recentOpenings: string[] = []
    const treats = new Set<string>()
    for (let id = 0; id < 400; id++) {
      const { dialogue, treat, speakers } = createCafeOrder(
        id,
        7,
        0,
        random,
        memory,
      )
      openings.add(dialogue.lines[0])
      // The next few customers never repeat a routine the line just heard.
      expect(recentOpenings.slice(-8)).not.toContain(dialogue.lines[0])
      recentOpenings.push(dialogue.lines[0])
      treats.add(treat)
      expect(dialogue.topic).toBe('cafe')
      expect(dialogue.speakerId).toBe(7)
      expect(speakers[0]).toBe('customer')
      expect(speakers.at(-1)).toBe('customer')
      expect(speakers.length).toBeGreaterThanOrEqual(3)
      expect(dialogue.lines).toHaveLength(speakers.length + 2)
      expect(dialogue.lines.every((line) => line.length <= 42)).toBe(true)
      expect(dialogue.lines.some((line) => line.includes('{'))).toBe(false)
      expect(dialogue.lines[speakers.length - 1]).toMatch(
        treat === 'churu' ? /churu/i : /can/i,
      )
      expect(BARISTA_PREPARING).toContain(dialogue.lines.at(-2))
      expect(BARISTA_SERVING).toContain(dialogue.lines.at(-1))
    }
    expect(treats).toEqual(new Set(['cat_can', 'churu']))
    expect(openings.size).toBe(22)
  })

  it('covers every topic with varied short lines and keeps most conversations hidden', () => {
    const random = randomSeed(57)
    const memory = new DialogueMemory()
    const topics = new Set<string>()
    const recentTopics: string[] = []
    let expanded = 0
    for (let id = 0; id < 1000; id++) {
      const dialogue = createDialogue(id, 0, id, random, memory)
      expect(recentTopics.slice(-3)).not.toContain(dialogue.topic)
      recentTopics.push(dialogue.topic)
      topics.add(dialogue.topic)
      if (dialogue.expanded) expanded++
      const topic = DIALOGUE_TOPICS.find(
        (entry) => entry.id === dialogue.topic,
      )!
      expect(dialogue.lines).toHaveLength(topic.lines.flat().length)
      expect(new Set(dialogue.lines).size).toBe(dialogue.lines.length)
      expect(dialogue.lines.every((line) => line.length <= 42)).toBe(true)
    }
    expect(topics).toEqual(new Set(DIALOGUE_TOPICS.map((topic) => topic.id)))
    expect(expanded).toBeGreaterThan(150)
    expect(expanded).toBeLessThan(250)
  })

  it('doubles every topic, keeps calls and answers together, and saves repeats for later', () => {
    for (const topic of DIALOGUE_TOPICS)
      expect(topic.lines.flat()).toHaveLength(24)
    const random = randomSeed(12)
    const memory = new DialogueMemory()
    const heard = new Map<string, string[]>()
    for (let id = 0; id < 400; id++) {
      const dialogue = createDialogue(id, 0, id, random, memory, 4)
      const topic = DIALOGUE_TOPICS.find(
        (entry) => entry.id === dialogue.topic,
      )!
      for (const unit of topic.lines)
        if (typeof unit !== 'string')
          expect(dialogue.lines.indexOf(unit[1])).toBe(
            dialogue.lines.indexOf(unit[0]) + 1,
          )
      // Nothing repeats within the topic's last two exchanges, even when its
      // deck is reshuffled, and the first four exchanges share no lines at all.
      const previous = heard.get(topic.id) ?? []
      const spoken = dialogue.lines.slice(0, 4)
      const window = previous.length < 16 ? previous : previous.slice(-8)
      for (const line of spoken) expect(window).not.toContain(line)
      heard.set(topic.id, [...previous, ...spoken])
    }
  })

  it('reveals the existing line and keeps the exchange open as friends take turns', () => {
    const simulation = visitingPair()
    const [first, second] = simulation.cats
    const dialogue = first.dialogue!
    dialogue.expanded = false
    const line = dialogueLine(dialogue)
    expect(second.dialogue).toBe(dialogue)
    simulation.toggleDialogue(first.id)
    expect(second.dialogue!.expanded).toBe(true)
    expect(dialogueLine(dialogue)).toBe(line)
    const speakers = new Set<number>(),
      lines = new Set<string>()
    for (let frame = 0; frame < 200; frame++) {
      simulation.step(0.1)
      expect(first.dialogue).toBe(dialogue)
      expect(second.dialogue).toBe(dialogue)
      expect(dialogue.expanded).toBe(true)
      expect([first.id, second.id]).toContain(dialogue.speakerId)
      speakers.add(dialogue.speakerId)
      lines.add(dialogueLine(dialogue))
    }
    expect(speakers.size).toBe(2)
    expect(lines.size).toBe(3)
    simulation.toggleDialogue(second.id)
    expect(dialogue.expanded).toBe(false)
    simulation.revealDialogue(first.id)
    simulation.revealDialogue(first.id)
    expect(dialogue.expanded).toBe(true)
  })

  it('uses a shared topic and successive lines for a group discussion', () => {
    const simulation = new Simulation()
    for (
      let frame = 0;
      frame < 1800 &&
      !simulation.conversations.some((group) => group.phase === 'discussing');
      frame++
    )
      simulation.step(0.1)
    const group = simulation.conversations.find(
      (group) => group.phase === 'discussing',
    )!
    expect(group).toBeDefined()
    const dialogue = group.dialogue!
    const members = simulation.cats.filter((cat) =>
      group.members.includes(cat.id),
    )
    expect(members.every((cat) => cat.dialogue === dialogue)).toBe(true)
    const firstLine = dialogueLine(dialogue)
    const firstSpeaker = dialogue.speakerId
    simulation.revealDialogue(members.at(-1)!.id)
    const firstTurnDuration = group.nextTurnAt - simulation.elapsed
    expect(firstTurnDuration).toBeGreaterThanOrEqual(6)
    expect(firstTurnDuration).toBeLessThanOrEqual(10)
    for (let frame = 0; frame < 110 && dialogue.turn === 0; frame++)
      simulation.step(0.1)
    expect(dialogue.turn).toBe(1)
    expect(dialogueLine(dialogue)).not.toBe(firstLine)
    expect(dialogue.speakerId).not.toBe(firstSpeaker)
    expect(dialogue.speakerId).toBe(group.speaker)
    expect(dialogue.expanded).toBe(true)
    simulation.dropTreat(group.center)
    expect(members.every((cat) => cat.dialogue === null)).toBe(true)
  }, 60000)

  it('stops speech when a visit is interrupted and ignores stale clicks', () => {
    const simulation = visitingPair()
    const first = simulation.cats[0]
    simulation.revealDialogue(first.id)
    simulation.dropTreat(first)
    expect(simulation.cats.every((cat) => cat.dialogue === null)).toBe(true)
    simulation.toggleDialogue(first.id)
    expect(first.dialogue).toBeNull()
  })

  it('keeps paused lines still and isolates snapshots from the live dialogue', () => {
    const simulation = visitingPair()
    const dialogue = simulation.cats[0].dialogue!
    const before = { ...dialogue }
    simulation.step(0)
    expect(dialogue).toEqual(before)
    const snapshot = simulation.snapshot()
    snapshot.cats[0].dialogue!.expanded = !dialogue.expanded
    expect(dialogue.expanded).toBe(before.expanded)
    expect(snapshot.cats[0].dialogue!.lines).not.toBe(dialogue.lines)
  })

  it('reproduces the same words without clicks changing anyone’s plans', () => {
    const first = visitingPair(),
      second = visitingPair()
    expect(first.cats[0].dialogue).toEqual(second.cats[0].dialogue)
    first.toggleDialogue(0)
    for (let frame = 0; frame < 300; frame++) {
      first.step(0.1)
      second.step(0.1)
    }
    expect(first.snapshot()).toEqual(second.snapshot())
  })
})
