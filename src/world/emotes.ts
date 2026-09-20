import { Vector3 } from 'three'
import type { Camera } from 'three'
import { isHidden } from './simulation'
import type { Cat, EmoteKind } from './simulation'
import type { BendUniforms } from './materials'
import { projectOverhead } from './speech'

// A "!" when a cat notices they are about to be sick, a treat on the ground,
// or a butterfly; a happy face once they've eaten a treat.
const GLYPHS: Record<EmoteKind, string> = {
  queasy: '!',
  treat: '!',
  butterfly: '!',
  yum: '😋',
}

interface Mark {
  element: HTMLElement
  // When it popped up; a fresh emote pops up again.
  at: number
}

// Little marks over cats' heads. Purely decorative, like a gasp or a grin.
export class EmoteMarks {
  private layer = document.createElement('div')
  private marks = new Map<number, Mark>()
  private projected = new Vector3()

  constructor(private host: HTMLElement) {
    this.layer.className = 'emote-layer'
    this.layer.setAttribute('aria-hidden', 'true')
    host.appendChild(this.layer)
  }

  update(cats: Cat[], camera: Camera, bend: BendUniforms) {
    const width = this.host.clientWidth,
      height = this.host.clientHeight
    const active = new Set<number>()
    for (const cat of cats) {
      if (!cat.emote || isHidden(cat)) continue
      if (!projectOverhead(cat, camera, bend, this.projected)) continue
      active.add(cat.id)
      let mark = this.marks.get(cat.id)
      if (mark && mark.at !== cat.emoteAt) {
        mark.element.remove()
        mark = undefined
      }
      if (!mark) {
        const element = document.createElement('div')
        element.className = 'emote-mark'
        element.dataset.kind = cat.emote
        const glyph = document.createElement('span')
        glyph.textContent = GLYPHS[cat.emote]
        element.appendChild(glyph)
        this.layer.appendChild(element)
        mark = { element, at: cat.emoteAt }
        this.marks.set(cat.id, mark)
      }
      const x = ((this.projected.x + 1) * width) / 2
      const top = ((1 - this.projected.y) * height) / 2
      mark.element.style.transform = `translate(${Math.round(x)}px, ${Math.round(top)}px) translate(-50%, -100%)`
    }
    for (const [id, mark] of this.marks) {
      if (!active.has(id)) {
        mark.element.remove()
        this.marks.delete(id)
      }
    }
  }

  dispose() {
    this.marks.clear()
    this.layer.remove()
  }
}
