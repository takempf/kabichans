import * as THREE from 'three'
import { bendMaterial, shadowTexture } from './materials'
import type { BendUniforms } from './materials'
import { lampPosts } from './geography'
import {
  CAFE_COUNTER_POSITION,
  CAFE_TABLES,
  TABLE_SURFACE_HEIGHT,
} from './cafeLayout'

const LAMP_HEIGHT = 4.2
const IRON = '#4d5550'
const GLASS = '#f3e8c8'
const WARM = '#ffc56e'

interface Glow {
  light: THREE.PointLight
  // Unbent world position; the bend is applied every frame.
  base: THREE.Vector3
  intensity: number
  // Candles flicker; lamps hold steady.
  flicker: number
}

// Lamp posts, kiosk lanterns, and table candles. Everything stays in the scene
// by day and only lights up at night, so switching never recompiles shaders.
export class NightLights {
  readonly group = new THREE.Group()
  private glows: Glow[] = []
  private glowing: THREE.MeshStandardMaterial[] = []
  private flames: THREE.Mesh[] = []
  private night = false

  constructor(bend: BendUniforms) {
    this.group.name = 'night-lights'
    const materials = new Map<string, THREE.MeshStandardMaterial>()
    const material = (color: string) => {
      if (!materials.has(color))
        materials.set(
          color,
          bendMaterial(
            new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
            bend,
          ),
        )
      return materials.get(color)!
    }
    // Unlit by day; glows warmly once night falls.
    const lit = (color: string, emissive: string) => {
      const glowing = bendMaterial(
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.6,
          emissive,
          emissiveIntensity: 0,
        }),
        bend,
      )
      this.glowing.push(glowing)
      return glowing
    }
    const add = (
      geometry: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new THREE.Mesh(geometry, mat)
      mesh.position.set(x, y, z)
      mesh.frustumCulled = false
      this.group.add(mesh)
      return mesh
    }
    const light = (
      x: number,
      y: number,
      z: number,
      intensity: number,
      distance: number,
      flicker = 0,
    ) => {
      const point = new THREE.PointLight(WARM, 0, distance, 2)
      point.position.set(x, y, z)
      this.group.add(point)
      this.glows.push({
        light: point,
        base: new THREE.Vector3(x, y, z),
        intensity,
        flicker,
      })
    }

    const shadowMaterial = bendMaterial(
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      }),
      bend,
    )
    const shadowGeometry = new THREE.PlaneGeometry(1.3, 1.3).rotateX(
      -Math.PI / 2,
    )
    const base = new THREE.CylinderGeometry(0.26, 0.32, 0.34, 10)
    const pole = new THREE.CylinderGeometry(0.075, 0.09, LAMP_HEIGHT, 8)
    const collar = new THREE.CylinderGeometry(0.2, 0.14, 0.12, 8)
    const pane = new THREE.BoxGeometry(0.42, 0.52, 0.42)
    const cap = new THREE.ConeGeometry(0.42, 0.34, 4).rotateY(Math.PI / 4)
    const finial = new THREE.SphereGeometry(0.07, 8, 6)
    const glass = lit(GLASS, WARM)
    for (const lamp of lampPosts) {
      add(shadowGeometry, shadowMaterial, lamp.x, 0.03, lamp.z)
      add(base, material(IRON), lamp.x, 0.17, lamp.z)
      add(pole, material(IRON), lamp.x, LAMP_HEIGHT / 2, lamp.z)
      add(collar, material(IRON), lamp.x, LAMP_HEIGHT + 0.03, lamp.z)
      add(pane, glass, lamp.x, LAMP_HEIGHT + 0.35, lamp.z)
      add(cap, material(IRON), lamp.x, LAMP_HEIGHT + 0.78, lamp.z)
      add(finial, material(IRON), lamp.x, LAMP_HEIGHT + 0.98, lamp.z)
      light(lamp.x, LAMP_HEIGHT + 0.3, lamp.z, 22, 12)
    }

    // Two paper lanterns hang from the front of the kiosk canopy.
    const lantern = lit('#f6c79a', '#ff9c5a')
    const cord = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4)
    const paper = new THREE.SphereGeometry(1, 12, 8)
    const rim = new THREE.CylinderGeometry(0.13, 0.13, 0.05, 10)
    for (const side of [-2.6, 2.6]) {
      const x = CAFE_COUNTER_POSITION.x + side
      const z = CAFE_COUNTER_POSITION.z + 1.95
      add(cord, material('#5a4636'), x, 4.12, z)
      add(paper, lantern, x, 3.6, z).scale.set(0.3, 0.36, 0.3)
      add(rim, material('#5a4636'), x, 3.96, z)
      add(rim, material('#5a4636'), x, 3.24, z)
    }
    light(CAFE_COUNTER_POSITION.x, 3.4, CAFE_COUNTER_POSITION.z + 2.6, 18, 11)

    // A candle on every table, beside the vase on the staff side.
    const cup = new THREE.CylinderGeometry(0.1, 0.085, 0.16, 10)
    const wax = new THREE.CylinderGeometry(0.075, 0.075, 0.1, 10)
    const flame = new THREE.SphereGeometry(1, 8, 6)
    const flameMaterial = bendMaterial(
      new THREE.MeshBasicMaterial({ color: '#ffe2a0' }),
      bend,
    )
    for (const table of CAFE_TABLES) {
      const angle = Math.atan2(
        table.approach.x - table.x,
        table.approach.z - table.z,
      )
      const x = table.x + Math.sin(angle) * 0.5
      const z = table.z + Math.cos(angle) * 0.5
      const top = TABLE_SURFACE_HEIGHT + 0.06
      add(cup, material('#b9d1cf'), x, top + 0.08, z)
      add(wax, material('#fbf3de'), x, top + 0.11, z)
      const tip = add(flame, flameMaterial, x, top + 0.25, z)
      tip.scale.set(0.035, 0.07, 0.035)
      tip.visible = false
      this.flames.push(tip)
      light(x, top + 0.4, z, 1.8, 4.5, 1)
    }
  }

  setNight(night: boolean) {
    this.night = night
    for (const glowing of this.glowing)
      glowing.emissiveIntensity = night ? 2.4 : 0
    for (const flame of this.flames) flame.visible = night
  }

  update(time: number, bend: BendUniforms, reducedMotion: boolean) {
    for (const [index, glow] of this.glows.entries()) {
      // Lights follow the bent ground so their pools stay under the lamps.
      const offset = glow.base.z - bend.center.value
      glow.light.position.set(
        glow.base.x,
        glow.base.y - bend.amount.value * offset * offset,
        glow.base.z,
      )
      const flicker =
        glow.flicker && !reducedMotion
          ? 0.85 +
            0.1 * Math.sin(time * 11 + index * 3.1) +
            0.05 * Math.sin(time * 23 + index)
          : 1
      glow.light.intensity = this.night ? glow.intensity * flicker : 0
    }
    if (!reducedMotion)
      for (const [index, flame] of this.flames.entries())
        flame.scale.y = 0.07 * (0.85 + 0.2 * Math.sin(time * 13 + index * 2))
  }
}
