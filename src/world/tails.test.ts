import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { tailGeometry, tailMood } from './tails'
import { CAT_COLORS } from './catArtwork'
import type { Cat } from './simulation'

describe('tails', () => {
  it('constructs tail geometry with tiger stripes and lighter underside', () => {
    const geometry = tailGeometry()
    const positions = geometry.attributes.position
    const along = geometry.attributes.tailAlong
    const colors = geometry.attributes.color

    expect(positions.count).toBeGreaterThan(0)
    expect(along.count).toBe(positions.count)
    expect(colors.count).toBe(positions.count)

    const cream = new THREE.Color(CAT_COLORS.white)
    let topLuminanceSum = 0
    let topCount = 0
    let underLuminanceSum = 0
    let underCount = 0

    const color = new THREE.Color()
    let hasWhiteTip = false

    for (let i = 0; i < positions.count; i++) {
      const t = along.getX(i)
      color.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i))

      // Vertices near the tip: must not have a white tip
      if (t > 0.95) {
        const dist = Math.hypot(
          color.r - cream.r,
          color.g - cream.g,
          color.b - cream.b,
        )
        if (dist < 0.1) {
          hasWhiteTip = true
        }
      }

      // Check top vs underside luminance
      // With sides = 24, side index is i % 25
      const side = i % 25
      if (side === 0 || side === 24) {
        // Top
        topLuminanceSum +=
          0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
        topCount++
      } else if (side === 12) {
        // Underside (opposite top)
        underLuminanceSum +=
          0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
        underCount++
      }
    }

    expect(hasWhiteTip).toBe(false)
    expect(topCount).toBeGreaterThan(0)
    expect(underCount).toBeGreaterThan(0)

    const avgTopLuminance = topLuminanceSum / topCount
    const avgUnderLuminance = underLuminanceSum / underCount

    // Underside must be significantly lighter than the top
    expect(avgUnderLuminance).toBeGreaterThan(avgTopLuminance)
  })

  it('adjusts tail mood based on cat activity', () => {
    const baseCat = {
      id: 0,
      phase: 0,
      walking: 0,
      activity: 'wandering',
      butterflyId: null,
      snack: null,
      cafeCustomer: null,
    } as unknown as Cat

    const wanderingMood = tailMood(baseCat)
    expect(wanderingMood.speed).toBeGreaterThan(1)

    const vomitingMood = tailMood({ ...baseCat, activity: 'vomiting' })
    expect(vomitingMood.lift).toBeLessThan(0)

    const chasingMood = tailMood({ ...baseCat, butterflyId: 1 })
    expect(chasingMood.speed).toBeGreaterThan(wanderingMood.speed)
  })
})
