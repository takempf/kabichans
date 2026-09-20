import { describe, expect, it } from 'vitest'
import {
  LAMP_POST_RADIUS,
  lampPosts,
  obstacles,
  onPicnicBlanket,
  picnicBlankets,
  rocks,
  trees,
} from './geography'
import { isInCafeQueueLane } from './cafeLayout'
import { isInCottageDoorway } from './cottageLayout'
import { BRIDGE, creekX, isDryGround } from './terrain'

describe('meadow furnishings', () => {
  it('stands lamp posts on dry ground, clear of scenery, lines, and doors', () => {
    for (const lamp of lampPosts) {
      expect(isDryGround(lamp.x, lamp.z, 1)).toBe(true)
      expect(isInCafeQueueLane(lamp.x, lamp.z, 1)).toBe(false)
      expect(isInCottageDoorway(lamp.x, lamp.z, 1)).toBe(false)
      // Off the bridge deck and its approaches.
      expect(Math.abs(lamp.z - BRIDGE.z)).toBeGreaterThan(BRIDGE.width / 2)
      for (const obstacle of obstacles) {
        const gap = Math.hypot(obstacle.x - lamp.x, obstacle.z - lamp.z)
        if (gap < 0.01) continue
        // Room for a cat to pass between them.
        expect(gap - obstacle.radius - LAMP_POST_RADIUS).toBeGreaterThan(2)
      }
    }
  })

  it('lays the picnic blankets on open grass beside the creek', () => {
    for (const blanket of picnicBlankets) {
      // East bank, within a few steps of the water.
      const bank = blanket.x - creekX(blanket.z)
      expect(bank).toBeGreaterThan(6)
      expect(bank).toBeLessThan(10)
      for (const obstacle of obstacles)
        expect(
          onPicnicBlanket(blanket, obstacle.x, obstacle.z, -obstacle.radius),
        ).toBe(false)
    }
    // Rocks and trees across the creek fill out the far bank.
    expect(rocks.every((rock) => rock.x > creekX(rock.z) + 8)).toBe(true)
    expect(trees.filter((tree) => tree.x > creekX(tree.z) + 8)).toHaveLength(2)
  })
})
