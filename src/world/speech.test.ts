import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  overheadDistance,
  overheadY,
  projectOverhead,
  SPEECH_EXPAND_MAX_DISTANCE,
  SpeechBubbles,
} from './speech'
import type { Cat } from './simulation'
import type { BendUniforms } from './materials'

class MockElement {
  className = ''
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  offsetWidth = 80
  offsetHeight = 28
  type = ''
  children: MockElement[] = []
  private _textContent = ''
  private attributes = new Map<string, string>()
  private listeners = new Map<string, Array<() => void>>()
  private classSet = new Set<string>()

  get textContent(): string {
    if (this.children.length > 0) {
      return this.children.map((c) => c.textContent).join('')
    }
    return this._textContent
  }

  set textContent(val: string) {
    this._textContent = val
  }

  classList = {
    toggle: (name: string, force?: boolean): boolean => {
      if (force !== undefined) {
        if (force) this.classSet.add(name)
        else this.classSet.delete(name)
        return force
      }
      if (this.classSet.has(name)) {
        this.classSet.delete(name)
        return false
      }
      this.classSet.add(name)
      return true
    },
    add: (name: string): void => {
      this.classSet.add(name)
    },
    remove: (name: string): void => {
      this.classSet.delete(name)
    },
    contains: (name: string): boolean => this.classSet.has(name),
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  addEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener()
    }
  }

  appendChild(child: unknown): unknown {
    if (child instanceof MockElement) {
      this.children.push(child)
    }
    return child
  }

  remove(): void {}
}

function createMockCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 1,
    name: 'Kabi',
    coat: 'tabby',
    personality: 'adventurous',
    trait: 'curious',
    speed: 1,
    scale: 1,
    x: 0,
    z: 0,
    heading: 0,
    activity: 'sitting',
    timer: 10,
    nextVomitAt: Infinity,
    pose: { sitting: 1, lying: 0, vomiting: 0 },
    target: { x: 0, z: 0 },
    schedule: [],
    carriedItem: null,
    thought: null,
    cottage: null,
    line: null,
    stool: null,
    seatIndex: null,
    spot: null,
    snack: null,
    friendId: null,
    conversationPhase: 'discussing',
    group: null,
    dialogue: {
      id: 10,
      topic: 'nap',
      lines: ['Purr purr...', 'A good sunbeam.'],
      turn: 0,
      startedAt: 0,
      speakerId: 1,
      expanded: false,
    },
    discussion: 1,
    speaking: 1,
    emote: null,
    emoteAt: 0,
    route: [],
    ...overrides,
  } as unknown as Cat
}

function createBendUniforms(): BendUniforms {
  return {
    amount: { value: 0.004 },
    center: { value: 0 },
  }
}

describe('speech', () => {
  it('calculates overhead Y position including ground height, scale, and bend', () => {
    const cat = createMockCat({ x: 0, z: 10, scale: 1.2 })
    const bend = createBendUniforms()
    const y = overheadY(cat, bend)
    // groundHeight(0, 10) is 0; 3.25 * 1.2 = 3.9; bend = 0.004 * (10 - 0)^2 = 0.4
    expect(y).toBeCloseTo(3.5, 2)
  })

  it('calculates 3D distance between camera and cat overhead position', () => {
    const cat = createMockCat({ x: 0, z: 0, scale: 1 })
    const bend = createBendUniforms()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
    camera.position.set(0, 23.4, 31.2)
    camera.updateMatrixWorld()

    expect(SPEECH_EXPAND_MAX_DISTANCE).toBe(38)
    const distance = overheadDistance(cat, camera, bend)
    // Overhead Y ≈ 3.25; dy = 23.4 - 3.25 = 20.15; dz = 31.2; hypot(20.15, 31.2) ≈ 37.13
    expect(distance).toBeCloseTo(37.13, 1)
  })

  it('projects overhead point into normalized device coordinates and checks visibility', () => {
    const cat = createMockCat({ x: 0, z: 0, scale: 1 })
    const bend = createBendUniforms()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
    camera.position.set(0, 23.4, 31.2)
    camera.lookAt(0, -1.5, -2.6)
    camera.updateMatrixWorld()

    const out = new THREE.Vector3()
    const visible = projectOverhead(cat, camera, bend, out)
    expect(visible).toBe(true)
    expect(out.z).toBeGreaterThanOrEqual(-1)
    expect(out.z).toBeLessThanOrEqual(1)
  })

  describe('SpeechBubbles', () => {
    const originalDocument = globalThis.document

    beforeEach(() => {
      // Setup minimal DOM mock for SpeechBubbles
      globalThis.document = {
        createElement: () => new MockElement(),
      } as unknown as Document
    })

    afterEach(() => {
      globalThis.document = originalDocument
    })

    it('shows full dialogue box when cat is within SPEECH_EXPAND_MAX_DISTANCE', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      // Position close enough to be within SPEECH_EXPAND_MAX_DISTANCE (38)
      camera.position.set(0, 18, 24)
      camera.lookAt(0, -1.5, -2)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)

      const activeBubbles = (
        bubbles as unknown as { bubbles: Map<number, { button: MockElement }> }
      ).bubbles
      const bubble = activeBubbles.get(cat.dialogue!.id)

      expect(bubble).toBeDefined()
      expect(bubble?.button.textContent).toBe('Purr purr...')
      expect(bubble?.button.classList.contains('is-expanded')).toBe(true)
      expect(bubble?.button.getAttribute('aria-expanded')).toBe('true')

      bubbles.dispose()
    })

    it('shows "..." box at further zooms or distances beyond SPEECH_EXPAND_MAX_DISTANCE', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      // Position further away: zoom 1.7 -> y = 30.6, z = 40.8, distance ≈ 49.1 > 38
      camera.position.set(0, 30.6, 40.8)
      camera.lookAt(0, -1.5, -3.4)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)

      const activeBubbles = (
        bubbles as unknown as { bubbles: Map<number, { button: MockElement }> }
      ).bubbles
      const bubble = activeBubbles.get(cat.dialogue!.id)

      expect(bubble).toBeDefined()
      expect(bubble?.button.textContent).toBe('...')
      expect(bubble?.button.classList.contains('is-expanded')).toBe(false)
      expect(bubble?.button.getAttribute('aria-expanded')).toBe('false')

      bubbles.dispose()
    })

    it('dynamically collapses to "..." when zooming out and expands to full text when zooming in', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      // Start close (zoom = 0.8, dist ≈ 22.2)
      camera.position.set(0, 14.4, 19.2)
      camera.lookAt(0, -1.5, -1.6)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)

      const activeBubbles = (
        bubbles as unknown as { bubbles: Map<number, { button: MockElement }> }
      ).bubbles
      const bubble = activeBubbles.get(cat.dialogue!.id)
      expect(bubble?.button.textContent).toBe('Purr purr...')
      expect(bubble?.button.classList.contains('is-expanded')).toBe(true)

      // Zoom out to further zoom (zoom = 1.6, dist ≈ 46)
      camera.position.set(0, 28.8, 38.4)
      camera.lookAt(0, -1.5, -3.2)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)
      expect(bubble?.button.textContent).toBe('...')
      expect(bubble?.button.classList.contains('is-expanded')).toBe(false)

      // Zoom back in (zoom = 0.8)
      camera.position.set(0, 14.4, 19.2)
      camera.lookAt(0, -1.5, -1.6)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)
      expect(bubble?.button.textContent).toBe('Purr purr...')
      expect(bubble?.button.classList.contains('is-expanded')).toBe(true)

      bubbles.dispose()
    })

    it('applies entrance transition with initial scale and opacity', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      camera.position.set(0, 14.4, 19.2)
      camera.lookAt(0, -1.5, -1.6)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)

      const activeBubbles = (
        bubbles as unknown as {
          bubbles: Map<number, { button: MockElement; state: string }>
        }
      ).bubbles
      const bubble = activeBubbles.get(cat.dialogue!.id)
      expect(bubble).toBeDefined()
      expect(bubble?.state).toBe('entering')
      expect(bubble?.button.style.opacity).toBeDefined()
      expect(bubble?.button.style.transform).toContain('scale(')

      bubbles.dispose()
    })

    it('applies scale bounce and translate up during entrance from nothing to full size', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      camera.position.set(0, 14.4, 19.2)
      camera.lookAt(0, -1.5, -1.6)
      camera.updateMatrixWorld()

      let fakeTime = 1000
      const originalNow = performance.now
      performance.now = () => fakeTime

      try {
        bubbles.update([cat], camera, bend)
        const activeBubbles = (
          bubbles as unknown as {
            bubbles: Map<number, { button: MockElement; state: string }>
          }
        ).bubbles
        const bubble = activeBubbles.get(cat.dialogue!.id)!
        expect(bubble).toBeDefined()
        expect(bubble.state).toBe('entering')

        // Start of entrance: scale is 0 (nothing) and translated down (+8px offset)
        const matchStart =
          bubble.button.style.transform.match(/scale\(([\d.]+)\)/)
        expect(matchStart).not.toBeNull()
        expect(parseFloat(matchStart![1])).toBe(0)

        // Mid-entrance: scale overshoots 1.0 (extra bounce), translating up
        fakeTime = 1140 // t = 140 / 280 = 0.5
        bubbles.update([cat], camera, bend)
        const matchMid =
          bubble.button.style.transform.match(/scale\(([\d.]+)\)/)
        expect(matchMid).not.toBeNull()
        const midScale = parseFloat(matchMid![1])
        expect(midScale).toBeGreaterThan(1.04)
        expect(parseFloat(bubble.button.style.opacity)).toBeLessThanOrEqual(1.0)

        // Late entrance: opacity reaches 1.0 and is clamped
        fakeTime = 1240
        bubbles.update([cat], camera, bend)
        expect(parseFloat(bubble.button.style.opacity)).toBe(1.0)

        // Entrance complete: scale settles to 1.0, state active
        fakeTime = 1300
        bubbles.update([cat], camera, bend)
        expect(bubble.state).toBe('active')
        const matchFinal =
          bubble.button.style.transform.match(/scale\(([\d.]+)\)/)
        expect(parseFloat(matchFinal![1])).toBe(1.0)
      } finally {
        performance.now = originalNow
        bubbles.dispose()
      }
    })

    it('sets width and height to accommodate text and transition between sizes', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      camera.position.set(0, 14.4, 19.2)
      camera.lookAt(0, -1.5, -1.6)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)
      const activeBubbles = (
        bubbles as unknown as {
          bubbles: Map<number, { button: MockElement }>
        }
      ).bubbles
      const bubble = activeBubbles.get(cat.dialogue!.id)!
      expect(bubble.button.style.width).toBe('80px')
      expect(bubble.button.style.height).toBe('28px')

      // Change text dimensions
      cat.dialogue!.turn = 1
      bubble.button.offsetWidth = 120
      bubble.button.offsetHeight = 36
      bubbles.update([cat], camera, bend)

      expect(bubble.button.style.width).toBe('120px')
      expect(bubble.button.style.height).toBe('36px')

      bubbles.dispose()
    })

    it('triggers text swapping animation when dialogue text changes', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      camera.position.set(0, 14.4, 19.2)
      camera.lookAt(0, -1.5, -1.6)
      camera.updateMatrixWorld()

      bubbles.update([cat], camera, bend)

      const activeBubbles = (
        bubbles as unknown as {
          bubbles: Map<number, { textSpan: MockElement }>
        }
      ).bubbles
      const bubble = activeBubbles.get(cat.dialogue!.id)
      expect(bubble).toBeDefined()

      // Advance dialogue line to trigger text change
      cat.dialogue!.turn = 1
      bubbles.update([cat], camera, bend)

      expect(bubble?.textSpan.textContent).toBe('A good sunbeam.')
      expect(bubble?.textSpan.classList.contains('is-swapping')).toBe(true)

      bubbles.dispose()
    })

    it('animates exit transition scaling down to nothing with translate down', () => {
      const host = new MockElement() as unknown as HTMLElement
      const bubbles = new SpeechBubbles(host, () => {})
      const cat = createMockCat({ x: 0, z: 0 })
      const bend = createBendUniforms()

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
      camera.position.set(0, 14.4, 19.2)
      camera.lookAt(0, -1.5, -1.6)
      camera.updateMatrixWorld()

      let fakeTime = 1000
      const originalNow = performance.now
      performance.now = () => fakeTime

      try {
        bubbles.update([cat], camera, bend)

        const activeBubbles = (
          bubbles as unknown as {
            bubbles: Map<number, { button: MockElement; state: string }>
          }
        ).bubbles
        const dialogueId = cat.dialogue!.id
        expect(activeBubbles.has(dialogueId)).toBe(true)

        // Cat stops speaking (no longer active)
        cat.dialogue = null
        fakeTime = 1050
        bubbles.update([cat], camera, bend)

        const leavingBubble = activeBubbles.get(dialogueId)!
        expect(leavingBubble).toBeDefined()
        expect(leavingBubble.state).toBe('leaving')

        // Halfway through exit: scale decreases, translating down
        fakeTime = 1145 // 95ms elapsed of 190ms
        bubbles.update([cat], camera, bend)
        const matchMid =
          leavingBubble.button.style.transform.match(/scale\(([\d.]+)\)/)
        expect(matchMid).not.toBeNull()
        const midScale = parseFloat(matchMid![1])
        expect(midScale).toBeLessThan(1.0)
        expect(midScale).toBeGreaterThan(0.0)

        // Exit completes: bubble removed
        fakeTime = 1250
        bubbles.update([cat], camera, bend)
        expect(activeBubbles.has(dialogueId)).toBe(false)
      } finally {
        performance.now = originalNow
        bubbles.dispose()
      }
    })
  })
})
