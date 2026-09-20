import * as THREE from 'three'
import { bendMaterial, canvasTexture, shadowTexture } from './materials'
import type { BendUniforms } from './materials'
import { BUTTERFLY_COUNT } from './butterflies'
import type { Butterfly } from './butterflies'
import { groundHeight } from './terrain'
import { WORLD } from './geography'
import { randomSeed } from './simulation'

// After dark the butterflies become fireflies, joined by a few dozen more that
// just drift about the meadow. Every one blinks on its own rhythm.
const AMBIENT_FIREFLIES = 40
const FIREFLY_COUNT = BUTTERFLY_COUNT + AMBIENT_FIREFLIES
const FIREFLY_WINGS = '#3d3830'
const FIREFLY_DARK = new THREE.Color('#5a5a34')
const FIREFLY_LIT = new THREE.Color('#efff8f')

// How brightly firefly `id` glows at `time`: mostly dark, with a short soft
// flash every few seconds. Gentler motion trades the flashes for a slow pulse.
function fireflyGlow(id: number, time: number, reducedMotion: boolean) {
  const phase = id * 1.73
  if (reducedMotion) return 0.45 + 0.25 * Math.sin(time * 0.5 + phase)
  const period = 2.6 + ((id * 0.37) % 1) * 2.4
  const t = (((time + phase) % period) + period) % period
  const flash = 0.7
  return t < flash ? Math.sin((t / flash) * Math.PI) : 0
}

// One wing, hinged on the left edge: a broad forewing at the front (bottom of
// the canvas) and a rounder hindwing behind it. Instance colors tint the white.
function wingTexture() {
  const texture = canvasTexture(64, 64, (ctx) => {
    const wing = new Path2D()
    wing.ellipse(28, 44, 29, 13, 0.32, 0, Math.PI * 2)
    wing.ellipse(20, 20, 19, 15, -0.45, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill(wing)
    ctx.save()
    ctx.clip(wing)
    ctx.strokeStyle = '#4b3f3a'
    ctx.lineWidth = 7
    ctx.stroke(wing)
    ctx.fillStyle = '#fffaf0'
    for (const [x, y] of [
      [50, 52],
      [44, 57],
      [34, 8],
    ]) {
      ctx.beginPath()
      ctx.arc(x, y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(75,63,58,.55)'
    ctx.beginPath()
    ctx.arc(30, 40, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.magFilter = THREE.NearestFilter
  return texture
}

export class ButterflyRenderer {
  readonly group = new THREE.Group()
  private wings: THREE.InstancedMesh
  private bodies: THREE.InstancedMesh
  private shadows: THREE.InstancedMesh
  // Fireflies' lit abdomens and the soft halo around each flash.
  private glows: THREE.InstancedMesh
  private halos: THREE.InstancedMesh
  private ambient: { x: number; z: number; speed: number; phase: number }[] = []
  private colors: string[]
  private night = false
  private root = new THREE.Object3D()
  private local = new THREE.Object3D()
  private matrix = new THREE.Matrix4()
  private color = new THREE.Color()

  constructor(bend: BendUniforms, butterflies: Butterfly[]) {
    this.wings = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.4, 0.44)
        .rotateX(-Math.PI / 2)
        .translate(0.2, 0, 0),
      bendMaterial(
        new THREE.MeshStandardMaterial({
          map: wingTexture(),
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          roughness: 1,
        }),
        bend,
      ),
      BUTTERFLY_COUNT * 2,
    )
    this.bodies = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.035, 0.2, 3, 6).rotateX(Math.PI / 2),
      bendMaterial(
        new THREE.MeshStandardMaterial({ color: '#4b3f3a', roughness: 1 }),
        bend,
      ),
      BUTTERFLY_COUNT,
    )
    this.shadows = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.5, 0.4).rotateX(-Math.PI / 2),
      bendMaterial(
        new THREE.MeshBasicMaterial({
          map: shadowTexture(),
          transparent: true,
          depthWrite: false,
        }),
        bend,
      ),
      BUTTERFLY_COUNT,
    )
    const glowGeometry = new THREE.SphereGeometry(1, 8, 6)
    this.glows = new THREE.InstancedMesh(
      glowGeometry,
      bendMaterial(new THREE.MeshBasicMaterial({ color: '#ffffff' }), bend),
      FIREFLY_COUNT,
    )
    this.halos = new THREE.InstancedMesh(
      glowGeometry,
      bendMaterial(
        new THREE.MeshBasicMaterial({
          color: '#d9ff70',
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        bend,
      ),
      FIREFLY_COUNT,
    )
    const random = randomSeed(4127)
    for (let i = 0; i < AMBIENT_FIREFLIES; i++)
      this.ambient.push({
        x: WORLD.minX + 3 + random() * (WORLD.maxX - WORLD.minX - 6),
        z: WORLD.minZ + 3 + random() * (WORLD.maxZ - WORLD.minZ - 6),
        speed: 0.6 + random() * 0.8,
        phase: random() * Math.PI * 2,
      })
    this.colors = butterflies.map((butterfly) => butterfly.color)
    this.paintWings()
    for (const [mesh, name] of [
      [this.wings, 'butterfly-wings'],
      [this.bodies, 'butterfly-bodies'],
      [this.shadows, 'butterfly-shadows'],
      [this.glows, 'firefly-glows'],
      [this.halos, 'firefly-halos'],
    ] as const) {
      mesh.name = name
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      // The vertex shader moves vertices outside their unbent bounds.
      mesh.frustumCulled = false
      this.group.add(mesh)
    }
    // Colored from the start, so nightfall never recompiles the shader.
    for (let i = 0; i < FIREFLY_COUNT; i++)
      this.glows.setColorAt(i, FIREFLY_DARK)
    this.glows.visible = this.halos.visible = false
    this.update(butterflies, 0, false)
  }

  setNight(night: boolean) {
    this.night = night
    this.glows.visible = this.halos.visible = night
    this.paintWings()
  }

  private paintWings() {
    for (const [id, color] of this.colors.entries()) {
      this.color.set(this.night ? FIREFLY_WINGS : color)
      this.wings.setColorAt(id * 2, this.color)
      this.wings.setColorAt(id * 2 + 1, this.color)
    }
    if (this.wings.instanceColor) this.wings.instanceColor.needsUpdate = true
  }

  // A glowing dot, plus a halo sized by how brightly it shines.
  private setGlow(index: number, matrix: THREE.Matrix4, glow: number) {
    this.color.copy(FIREFLY_DARK).lerp(FIREFLY_LIT, glow)
    this.glows.setColorAt(index, this.color)
    this.local.matrix.copy(matrix)
    this.local.matrix.decompose(
      this.local.position,
      this.local.quaternion,
      this.local.scale,
    )
    this.local.scale.setScalar(0.06)
    this.local.updateMatrix()
    this.glows.setMatrixAt(index, this.local.matrix)
    this.local.scale.setScalar(0.4 * glow + 0.0001)
    this.local.updateMatrix()
    this.halos.setMatrixAt(index, this.local.matrix)
  }

  update(butterflies: Butterfly[], time: number, reducedMotion: boolean) {
    for (const butterfly of butterflies) {
      const ground = groundHeight(butterfly.x, butterfly.z)
      const perched = butterfly.perched > 0
      const beat = Math.sin(butterfly.flap)
      // Wings clap together above the back in flight. Perched, they stay mostly
      // folded, opening now and then to bask.
      const wingAngle = perched
        ? 1.4 -
          1.15 *
            Math.max(0, Math.sin(time * 0.8 + butterfly.wobble)) **
              (reducedMotion ? 1 : 4)
        : 0.55 + beat * (reducedMotion ? 0.45 : 0.85)
      // Each downstroke lifts the body a little.
      const lift = perched || reducedMotion ? 0 : -beat * 0.05
      this.root.position.set(
        butterfly.x,
        ground + butterfly.y + lift,
        butterfly.z,
      )
      this.root.rotation.set(perched ? 0 : -0.25, butterfly.heading, 0, 'YXZ')
      // Fireflies are smaller than butterflies.
      this.root.scale.setScalar(this.night ? 0.55 : 1)
      this.root.updateMatrix()
      for (const side of [1, -1]) {
        this.local.position.set(0, 0, 0)
        this.local.rotation.set(0, 0, side * wingAngle)
        this.local.scale.set(side, 1, 1)
        this.local.updateMatrix()
        this.matrix.multiplyMatrices(this.root.matrix, this.local.matrix)
        this.wings.setMatrixAt(
          butterfly.id * 2 + (side > 0 ? 0 : 1),
          this.matrix,
        )
      }
      this.bodies.setMatrixAt(butterfly.id, this.root.matrix)
      if (this.night) {
        // The glow sits at the tail end of the body.
        this.local.position.set(0, -0.02, -0.12)
        this.local.rotation.set(0, 0, 0)
        this.local.scale.set(1, 1, 1)
        this.local.updateMatrix()
        this.matrix.multiplyMatrices(this.root.matrix, this.local.matrix)
        this.setGlow(
          butterfly.id,
          this.matrix,
          fireflyGlow(butterfly.id, time, reducedMotion),
        )
      }
      // A small, soft shadow that fades out as the butterfly climbs.
      const size = Math.max(0, 1 - butterfly.y / 4) * (this.night ? 0.5 : 1)
      this.local.position.set(butterfly.x, ground + 0.03, butterfly.z)
      this.local.rotation.set(0, butterfly.heading, 0)
      this.local.scale.set(size, 1, size)
      this.local.updateMatrix()
      this.shadows.setMatrixAt(butterfly.id, this.local.matrix)
    }
    if (this.night) {
      // The rest just drift lazily about, rising and settling.
      for (const [index, firefly] of this.ambient.entries()) {
        const t = time * firefly.speed + firefly.phase
        const x =
          firefly.x + Math.sin(t * 0.23) * 1.8 + Math.sin(t * 0.61) * 0.5
        const z =
          firefly.z + Math.cos(t * 0.19) * 1.8 + Math.cos(t * 0.53) * 0.5
        this.matrix.makeTranslation(
          x,
          groundHeight(x, z) + 1 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.4)),
          z,
        )
        const id = BUTTERFLY_COUNT + index
        this.setGlow(id, this.matrix, fireflyGlow(id, time, reducedMotion))
      }
      if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true
    }
    for (const mesh of [
      this.wings,
      this.bodies,
      this.shadows,
      this.glows,
      this.halos,
    ])
      mesh.instanceMatrix.needsUpdate = true
  }
}
