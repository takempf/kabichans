import { Vector3 } from 'three'
import type { Camera } from 'three'
import type { Cat } from './simulation'
import type { BendUniforms } from './materials'
import { dialogueLine } from './dialogue'
import { groundHeight } from './terrain'

export const SPEECH_EXPAND_MAX_DISTANCE = 38

export function overheadY(cat: Cat, bend: BendUniforms): number {
  return (
    groundHeight(cat.x, cat.z) +
    3.25 * cat.scale -
    bend.amount.value * (cat.z - bend.center.value) ** 2
  )
}

export function overheadDistance(
  cat: Cat,
  camera: Camera,
  bend: BendUniforms,
): number {
  const y = overheadY(cat, bend)
  return Math.hypot(
    camera.position.x - cat.x,
    camera.position.y - y,
    camera.position.z - cat.z,
  )
}

// Projects a point just above a cat's head into `out`, using the same bend as
// the rendered cats. Returns false when it is off screen.
export function projectOverhead(
  cat: Cat,
  camera: Camera,
  bend: BendUniforms,
  out: Vector3,
): boolean {
  const y = overheadY(cat, bend)
  out.set(cat.x, y, cat.z).project(camera)
  return (
    out.z >= -1 &&
    out.z <= 1 &&
    Math.abs(out.x) <= 1.05 &&
    Math.abs(out.y) <= 1.05
  )
}

const ENTRANCE_DURATION_MS = 280
const EXIT_DURATION_MS = 190
const ENTRANCE_OFFSET_Y = 8
const EXIT_OFFSET_Y = 8

function easeOutBack(t: number): number {
  const c1 = 1.6
  const c3 = c1 + 1
  const p = t - 1
  return 1 + c3 * p * p * p + c1 * p * p
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function easeInQuad(t: number): number {
  return t * t
}

interface Bubble {
  button: HTMLButtonElement
  textSpan: HTMLSpanElement
  text: string
  width: number
  height: number
  lastX: number
  lastTop: number
  state: 'entering' | 'active' | 'leaving'
  enteredAt: number
  leavingAt: number
}

// A few reusable buttons keep speech legible at 480p and make it tappable and
// keyboard accessible. Their anchors use the same bend as the rendered cats.
export class SpeechBubbles {
  private layer = document.createElement('div')
  private bubbles = new Map<number, Bubble>()
  private projected = new Vector3()
  private viewportWidth = 0

  constructor(
    private host: HTMLElement,
    private toggle: (catId: number) => void,
  ) {
    this.layer.className = 'speech-layer'
    this.layer.setAttribute('aria-label', 'Kabichan conversations')
    host.appendChild(this.layer)
  }

  update(
    cats: Cat[],
    camera: Camera,
    bend: BendUniforms,
    reducedMotion = false,
  ): void {
    const width = this.host.clientWidth,
      height = this.host.clientHeight
    const resized = width !== this.viewportWidth
    this.viewportWidth = width
    const active = new Set<number>()
    const now = performance.now()

    for (const cat of cats) {
      const dialogue = cat.dialogue
      if (!dialogue || dialogue.speakerId !== cat.id || cat.discussion < 0.02)
        continue
      if (!projectOverhead(cat, camera, bend, this.projected)) continue
      active.add(dialogue.id)
      let bubble = this.bubbles.get(dialogue.id)
      if (!bubble) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'speech-bubble'
        button.dataset.dialogueId = String(dialogue.id)
        button.addEventListener('click', () =>
          this.toggle(Number(button.dataset.catId)),
        )
        const textSpan = document.createElement('span')
        textSpan.className = 'speech-bubble-text'
        button.appendChild(textSpan)
        this.layer.appendChild(button)
        bubble = {
          button,
          textSpan,
          text: '',
          width: 0,
          height: 0,
          lastX: 0,
          lastTop: 0,
          state: 'entering',
          enteredAt: now,
          leavingAt: 0,
        }
        this.bubbles.set(dialogue.id, bubble)
      } else if (bubble.state === 'leaving') {
        bubble.state = 'entering'
        bubble.enteredAt = now
      }

      const { button } = bubble
      const distance = overheadDistance(cat, camera, bend)
      const isExpanded = distance <= SPEECH_EXPAND_MAX_DISTANCE
      const text = isExpanded ? dialogueLine(dialogue) : '...'
      button.dataset.catId = String(cat.id)
      button.dataset.topic = dialogue.topic
      button.setAttribute('aria-expanded', String(isExpanded))
      button.setAttribute(
        'aria-label',
        isExpanded
          ? `${cat.name} says: ${text} Click to toggle conversation.`
          : `Listen to ${cat.name}'s conversation`,
      )
      if (bubble.text !== text || resized) {
        const isTextChange = bubble.text !== '' && bubble.text !== text
        bubble.text = text
        bubble.textSpan.textContent = text
        button.classList.toggle('is-expanded', isExpanded)
        if (isTextChange && !reducedMotion) {
          bubble.textSpan.classList.remove('is-swapping')
          void bubble.textSpan.offsetWidth
          bubble.textSpan.classList.add('is-swapping')
        }

        button.style.width = ''
        button.style.height = ''
        const targetWidth = button.offsetWidth
        const targetHeight = button.offsetHeight

        if (
          !reducedMotion &&
          bubble.width > 0 &&
          (bubble.width !== targetWidth || bubble.height !== targetHeight)
        ) {
          button.style.width = `${bubble.width}px`
          button.style.height = `${bubble.height}px`
          void button.offsetWidth
          button.style.width = `${targetWidth}px`
          button.style.height = `${targetHeight}px`
        } else {
          button.style.width = `${targetWidth}px`
          button.style.height = `${targetHeight}px`
        }

        bubble.width = targetWidth
        bubble.height = targetHeight
      }
      const x = Math.max(
        bubble.width / 2 + 8,
        Math.min(
          width - bubble.width / 2 - 8,
          ((this.projected.x + 1) * width) / 2,
        ),
      )
      const top = Math.max(
        bubble.height + 8,
        Math.min(height - 8, ((1 - this.projected.y) * height) / 2),
      )
      bubble.lastX = x
      bubble.lastTop = top

      let scale = 1
      let opacity = 1
      let offsetY = 0
      if (!reducedMotion && bubble.state === 'entering') {
        const elapsed = now - bubble.enteredAt
        if (elapsed >= ENTRANCE_DURATION_MS) {
          bubble.state = 'active'
        } else {
          const t = elapsed / ENTRANCE_DURATION_MS
          scale = Math.max(0, easeOutBack(t))
          offsetY = (1 - easeOutQuad(t)) * ENTRANCE_OFFSET_Y
          opacity = Math.min(1, t * 1.5)
        }
      }

      button.style.opacity = opacity < 0.999 ? opacity.toFixed(3) : '1'
      button.style.transform = `translate(${Math.round(x)}px, ${Math.round(top + offsetY)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`
    }

    for (const [id, bubble] of this.bubbles) {
      if (!active.has(id)) {
        if (reducedMotion) {
          bubble.button.remove()
          this.bubbles.delete(id)
          continue
        }
        if (bubble.state !== 'leaving') {
          bubble.state = 'leaving'
          bubble.leavingAt = now
        }
        const elapsed = now - bubble.leavingAt
        if (elapsed >= EXIT_DURATION_MS) {
          bubble.button.remove()
          this.bubbles.delete(id)
          continue
        }
        const progress = elapsed / EXIT_DURATION_MS
        const scale = Math.max(0, 1 - easeInQuad(progress))
        const offsetY = easeInQuad(progress) * EXIT_OFFSET_Y
        const opacity = Math.max(0, 1 - progress)
        bubble.button.style.opacity = opacity.toFixed(3)
        bubble.button.style.transform = `translate(${Math.round(bubble.lastX)}px, ${Math.round(bubble.lastTop + offsetY)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`
      }
    }
  }

  dispose(): void {
    for (const [, bubble] of this.bubbles) {
      bubble.button.remove()
    }
    this.bubbles.clear()
    this.layer.remove()
  }
}
