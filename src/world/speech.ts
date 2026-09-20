import { Vector3 } from 'three'
import type { Camera } from 'three'
import type { Cat } from './simulation'
import type { BendUniforms } from './materials'
import { dialogueLine } from './dialogue'
import { groundHeight } from './terrain'

// Projects a point just above a cat's head into `out`, using the same bend as
// the rendered cats. Returns false when it is off screen.
export function projectOverhead(
  cat: Cat,
  camera: Camera,
  bend: BendUniforms,
  out: Vector3,
) {
  const y =
    groundHeight(cat.x, cat.z) +
    3.25 * cat.scale -
    bend.amount.value * (cat.z - bend.center.value) ** 2
  out.set(cat.x, y, cat.z).project(camera)
  return (
    out.z >= -1 &&
    out.z <= 1 &&
    Math.abs(out.x) <= 1.05 &&
    Math.abs(out.y) <= 1.05
  )
}

interface Bubble {
  button: HTMLButtonElement
  text: string
  width: number
  height: number
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

  update(cats: Cat[], camera: Camera, bend: BendUniforms) {
    const width = this.host.clientWidth,
      height = this.host.clientHeight
    const resized = width !== this.viewportWidth
    this.viewportWidth = width
    const active = new Set<number>()
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
        this.layer.appendChild(button)
        bubble = { button, text: '', width: 0, height: 0 }
        this.bubbles.set(dialogue.id, bubble)
      }
      const { button } = bubble
      const text = dialogue.expanded ? dialogueLine(dialogue) : '...'
      button.dataset.catId = String(cat.id)
      button.dataset.topic = dialogue.topic
      button.setAttribute('aria-expanded', String(dialogue.expanded))
      button.setAttribute(
        'aria-label',
        dialogue.expanded
          ? `${cat.name} says: ${text} Click to hide conversation.`
          : `Listen to ${cat.name}'s conversation`,
      )
      if (bubble.text !== text || resized) {
        bubble.text = text
        button.textContent = text
        button.classList.toggle('is-expanded', dialogue.expanded)
        bubble.width = button.offsetWidth
        bubble.height = button.offsetHeight
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
      button.style.transform = `translate(${Math.round(x)}px, ${Math.round(top)}px) translate(-50%, -100%)`
    }
    for (const [id, bubble] of this.bubbles) {
      if (!active.has(id)) {
        bubble.button.remove()
        this.bubbles.delete(id)
      }
    }
  }

  dispose() {
    this.bubbles.clear()
    this.layer.remove()
  }
}
