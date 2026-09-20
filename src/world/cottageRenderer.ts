import * as THREE from 'three'
import { bendMaterial, shadowTexture } from './materials'
import type { BendUniforms } from './materials'
import { COTTAGE_SIZE } from './geography'
import type { Cottage } from './simulation'

// Modeled at a smaller size, then scaled up so a cat walks through the door
// with room to spare: 7 × 5.2 walls, a 2 × 3 door.
const SCALE = COTTAGE_SIZE.width / 4.7
const DOOR_WIDTH = COTTAGE_SIZE.doorWidth / SCALE
const DOOR_HEIGHT = 2
const ROOFS = ['#ba8876', '#8fa9a6', '#aca1b2']

interface CottageParts {
  door: THREE.Group
  panes: THREE.MeshStandardMaterial
  // Spills out of the windows onto the lawn at night.
  light: THREE.PointLight
  base: THREE.Vector3
  open: number
  glow: number
}

export class CottageRenderer {
  readonly group = new THREE.Group()
  private cottages: CottageParts[] = []
  private lastTime: number | null = null
  private night = false

  constructor(bend: BendUniforms, cottages: Cottage[]) {
    const materials = new Map<string, THREE.MeshStandardMaterial>()
    const material = (color: string) => {
      if (!materials.has(color))
        materials.set(
          color,
          bendMaterial(
            new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
            bend,
          ),
        )
      return materials.get(color)!
    }
    const sphere = new THREE.SphereGeometry(1, 16, 12)
    const shadow = bendMaterial(
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
      }),
      bend,
    )
    for (const cottage of cottages) {
      const g = new THREE.Group()
      g.position.set(cottage.x, 0, cottage.z)
      g.scale.setScalar(SCALE)
      this.group.add(g)
      const add = (
        geometry: THREE.BufferGeometry,
        mat: THREE.Material | string,
        x: number,
        y: number,
        z: number,
        parent: THREE.Object3D = g,
      ) => {
        const mesh = new THREE.Mesh(
          geometry,
          typeof mat === 'string' ? material(mat) : mat,
        )
        mesh.position.set(x, y, z)
        mesh.frustumCulled = false
        parent.add(mesh)
        return mesh
      }
      const ball = (
        x: number,
        y: number,
        z: number,
        size: number,
        color: string,
      ) => add(sphere, color, x, y, z).scale.setScalar(size)

      add(
        new THREE.PlaneGeometry(8, 7).rotateX(-Math.PI / 2),
        shadow,
        0,
        0.035 / SCALE,
        0,
      )
      add(new THREE.BoxGeometry(4.7, 3.2, 3.5), '#f4e7c8', 0, 1.6, 0)
      // Turn the pyramid square to the walls before squashing it front to back;
      // squashing first would skew its base into a rhombus.
      const roof = add(
        new THREE.ConeGeometry(3.9, 2.6, 4).rotateY(Math.PI / 4),
        ROOFS[cottage.id % ROOFS.length],
        0,
        4.3,
        0,
      )
      roof.scale.z = 0.88
      add(new THREE.BoxGeometry(0.5, 1.45, 0.6), '#e0c8b1', 1.4, 4.65, -0.5)

      // The dark interior shows while the door swings open.
      add(
        new THREE.PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT),
        '#3b302b',
        0,
        DOOR_HEIGHT / 2,
        1.755,
      )
      const door = new THREE.Group()
      door.position.set(-DOOR_WIDTH / 2, 0, 1.81)
      g.add(door)
      add(
        new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.12),
        '#b59774',
        DOOR_WIDTH / 2,
        DOOR_HEIGHT / 2,
        0,
        door,
      )
      add(
        sphere,
        '#ebdba5',
        DOOR_WIDTH - 0.24,
        0.94,
        0.09,
        door,
      ).scale.setScalar(0.055)

      // Windows glow warmly while anyone is home.
      const panes = bendMaterial(
        new THREE.MeshStandardMaterial({
          color: '#9dbbb2',
          roughness: 0.95,
          emissive: '#ffcf7a',
          emissiveIntensity: 0,
        }),
        bend,
      )
      for (const x of [-1.5, 1.5]) {
        add(new THREE.BoxGeometry(0.96, 1.02, 0.16), '#ffffff', x, 1.92, 1.79)
        add(new THREE.BoxGeometry(0.76, 0.82, 0.18), panes, x, 1.92, 1.83)
        add(new THREE.BoxGeometry(0.07, 0.83, 0.2), '#fff2d6', x, 1.92, 1.84)
        add(new THREE.BoxGeometry(0.78, 0.07, 0.2), '#fff2d6', x, 1.92, 1.84)
        add(new THREE.BoxGeometry(1.15, 0.24, 0.48), '#bca182', x, 1.28, 1.98)
        for (let j = 0; j < 4; j++)
          ball(
            x - 0.38 + j * 0.26,
            1.52,
            2,
            0.14,
            j % 2 ? '#e3b0ad' : '#f1d793',
          )
      }
      add(
        new THREE.BoxGeometry(DOOR_WIDTH + 0.3, 0.15, 0.85),
        '#d7c8a3',
        0,
        0.08,
        2.02,
      )
      // Always present, dark by day, so nightfall never recompiles shaders.
      const light = new THREE.PointLight('#ffc877', 0, 9, 2)
      const base = new THREE.Vector3(cottage.x, 2.6, cottage.z + 3.6)
      light.position.copy(base)
      this.group.add(light)
      this.cottages.push({ door, panes, light, base, open: 0, glow: 0 })
    }
  }

  setNight(night: boolean) {
    this.night = night
  }

  update(cottages: Cottage[], time: number, bend: BendUniforms) {
    const dt =
      this.lastTime === null
        ? 0
        : THREE.MathUtils.clamp(time - this.lastTime, 0, 0.1)
    this.lastTime = time
    for (const cottage of cottages) {
      const parts = this.cottages[cottage.id]
      const open = cottage.doorwayId !== null ? 1 : 0
      parts.open += (open - parts.open) * (1 - Math.exp(-dt * 6))
      // Swings outward, hinged on the left.
      parts.door.rotation.y =
        -1.7 * THREE.MathUtils.smoothstep(parts.open, 0, 1)
      const home = cottage.occupants.length > 0 ? 1 : 0
      parts.glow += (home - parts.glow) * (1 - Math.exp(-dt * 1.5))
      // Brighter after dark, when the glow also lights up the lawn.
      parts.panes.emissiveIntensity = parts.glow * (this.night ? 2.2 : 0.85)
      parts.light.intensity = this.night ? parts.glow * 14 : 0
      const offset = parts.base.z - bend.center.value
      parts.light.position.y =
        parts.base.y - bend.amount.value * offset * offset
    }
  }
}
