import * as THREE from 'three'
import { bendMaterial, canvasTexture, shadowTexture } from './materials'
import type { BendUniforms } from './materials'
import { JANITOR_CART, OUTHOUSE_SIZE } from './geography'
import { OUTHOUSE_DIRTY, OUTHOUSE_FILTHY } from './outhouseLayout'
import type { Outhouse } from './simulation'

const { width: WIDTH, depth: DEPTH } = OUTHOUSE_SIZE
const FRONT = DEPTH / 2
const WALL_HEIGHT = 3.5
// The cat flap: a round-topped doorway a cat walks through without ducking.
const DOOR_HALF = OUTHOUSE_SIZE.doorWidth / 2
const DOOR_SIDES = 2.2
// Each outhouse is a different pastel litter box.
const TRAYS = ['#7db3c4', '#c79fb8']
const HOODS = ['#dcefea', '#f3e3ea']
const RIM = '#f6f1e4'
const LITTER = ['#d8d0bb', '#c4bba4']
const VACANT = new THREE.Color('#5fd17a')
const OCCUPIED = new THREE.Color('#e86a5a')
const CLEANING = new THREE.Color('#f2b84b')
const WISPS = 3

function arch(halfWidth: number, sides: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-halfWidth, 0)
  shape.lineTo(-halfWidth, sides)
  shape.absarc(0, sides, halfWidth, Math.PI, 0, true)
  shape.lineTo(halfWidth, 0)
  shape.lineTo(-halfWidth, 0)
  return shape
}

// A band around the doorway, open at the bottom.
function archFrame(inner: number, outer: number, sides: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-outer, 0)
  shape.lineTo(-outer, sides)
  shape.absarc(0, sides, outer, Math.PI, 0, true)
  shape.lineTo(outer, 0)
  shape.lineTo(inner, 0)
  shape.lineTo(inner, sides)
  shape.absarc(0, sides, inner, 0, Math.PI, false)
  shape.lineTo(-inner, 0)
  shape.lineTo(-outer, 0)
  return shape
}

// The classic outhouse moon, opening to the right.
function crescent(radius: number) {
  const inner = radius * 0.86
  const offset = radius * 0.4
  // Where the two circles cross.
  const x = (offset ** 2 + radius ** 2 - inner ** 2) / (2 * offset)
  const y = Math.sqrt(radius ** 2 - x ** 2)
  const outerAngle = Math.atan2(y, x)
  const innerAngle = Math.atan2(y, x - offset)
  const shape = new THREE.Shape()
  shape.moveTo(x, y)
  shape.absarc(0, 0, radius, outerAngle, Math.PI * 2 - outerAngle, false)
  shape.absarc(offset, 0, inner, -innerAngle, innerAngle, true)
  return shape
}

function signTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#fff6e5'
    ctx.beginPath()
    ctx.arc(64, 64, 62, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#cda376'
    ctx.stroke()
    // A paw print over the letters.
    ctx.fillStyle = '#8a6a55'
    ctx.beginPath()
    ctx.ellipse(64, 50, 14, 11, 0, 0, Math.PI * 2)
    for (const [x, y] of [
      [44, 34],
      [56, 26],
      [72, 26],
      [84, 34],
    ])
      ctx.ellipse(x, y, 5.5, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = "bold 34px 'Geist Variable', 'Geist'"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('WC', 64, 92)
  })
}

interface OuthouseParts {
  flap: THREE.Group
  open: number
  moon: THREE.MeshStandardMaterial
  light: THREE.MeshStandardMaterial
  caution: THREE.Group
  wisps: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }[]
  stink: number
}

export class OuthouseRenderer {
  readonly group = new THREE.Group()
  private outhouses: OuthouseParts[] = []
  private lastTime: number | null = null
  private night = false

  constructor(bend: BendUniforms, outhouses: Outhouse[]) {
    this.group.name = 'outhouses'
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
    const shadow = bendMaterial(
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
      }),
      bend,
    )
    const sign = bendMaterial(
      new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.9 }),
      bend,
    )
    const pebble = new THREE.SphereGeometry(1, 6, 4)
    const wisp = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.14, 0.25, 0),
        new THREE.Vector3(-0.12, 0.5, 0),
        new THREE.Vector3(0.12, 0.75, 0),
        new THREE.Vector3(0, 1, 0),
      ]),
      16,
      0.05,
      5,
      false,
    )
    const add = (
      geometry: THREE.BufferGeometry,
      mat: THREE.Material | string,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D,
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

    for (const outhouse of outhouses) {
      const tray = TRAYS[outhouse.id % TRAYS.length]
      const hood = HOODS[outhouse.id % HOODS.length]
      const g = new THREE.Group()
      g.position.set(outhouse.x, 0, outhouse.z)
      this.group.add(g)
      add(
        new THREE.PlaneGeometry(5.6, 5).rotateX(-Math.PI / 2),
        shadow,
        0,
        0.035,
        0.2,
        g,
      )
      // The litter tray: sides and back, then a lip either side of the flap
      // with a low step between.
      add(
        new THREE.BoxGeometry(WIDTH + 0.2, 0.9, DEPTH),
        tray,
        0,
        0.45,
        -0.1,
        g,
      )
      add(
        new THREE.BoxGeometry(WIDTH + 0.35, 0.12, DEPTH + 0.15),
        RIM,
        0,
        0.96,
        -0.1,
        g,
      )
      for (const side of [-1, 1]) {
        add(
          new THREE.BoxGeometry(0.8, 0.9, 0.4),
          tray,
          side * 1.5,
          0.45,
          FRONT,
          g,
        )
        add(
          new THREE.BoxGeometry(0.9, 0.12, 0.5),
          RIM,
          side * 1.5,
          0.96,
          FRONT,
          g,
        )
      }
      add(new THREE.BoxGeometry(2.2, 0.1, 0.55), RIM, 0, 0.05, FRONT + 0.25, g)
      // The hood, with a rounded top and a carry handle.
      add(
        new THREE.BoxGeometry(WIDTH, WALL_HEIGHT, DEPTH),
        hood,
        0,
        WALL_HEIGHT / 2,
        0,
        g,
      )
      add(
        new THREE.CylinderGeometry(
          WIDTH / 2,
          WIDTH / 2,
          DEPTH,
          24,
          1,
          false,
          Math.PI / 2,
          Math.PI,
        ).rotateX(Math.PI / 2),
        hood,
        0,
        WALL_HEIGHT,
        0,
        g,
      )
      add(
        new THREE.TorusGeometry(0.6, 0.1, 8, 16, Math.PI),
        tray,
        0,
        WALL_HEIGHT + WIDTH / 2 - 0.1,
        0,
        g,
      )
      // The dark inside shows while the flap swings up.
      add(
        new THREE.ShapeGeometry(arch(DOOR_HALF, DOOR_SIDES), 12),
        '#3b302b',
        0,
        0,
        FRONT + 0.005,
        g,
      )
      add(
        new THREE.ExtrudeGeometry(
          archFrame(DOOR_HALF, DOOR_HALF + 0.15, DOOR_SIDES),
          {
            depth: 0.08,
            bevelEnabled: false,
            curveSegments: 12,
          },
        ),
        RIM,
        0,
        0,
        FRONT,
        g,
      )
      const top = DOOR_SIDES + DOOR_HALF - 0.03
      const flap = new THREE.Group()
      flap.position.set(0, top, FRONT + 0.04)
      g.add(flap)
      add(
        new THREE.ExtrudeGeometry(arch(DOOR_HALF - 0.03, DOOR_SIDES), {
          depth: 0.05,
          bevelEnabled: false,
          curveSegments: 12,
        }).translate(0, -top, 0),
        '#a9cbd3',
        0,
        0,
        0,
        flap,
      )
      // It lights up after dark while somebody is in.
      const moon = bendMaterial(
        new THREE.MeshStandardMaterial({
          color: '#f4d27a',
          roughness: 0.9,
          emissive: '#ffd27a',
          emissiveIntensity: 0,
        }),
        bend,
      )
      add(
        new THREE.ShapeGeometry(crescent(0.38), 12),
        moon,
        0,
        -0.8,
        0.055,
        flap,
      )
      // Green when free, red while in use, amber while being cleaned.
      const light = bendMaterial(
        new THREE.MeshStandardMaterial({
          color: VACANT,
          roughness: 0.6,
          emissive: VACANT,
          emissiveIntensity: 0.8,
        }),
        bend,
      )
      add(
        new THREE.SphereGeometry(0.13, 12, 8),
        light,
        0,
        WALL_HEIGHT + 0.22,
        FRONT + 0.02,
        g,
      )
      add(
        new THREE.CircleGeometry(0.45, 24),
        sign,
        0,
        WALL_HEIGHT + 0.92,
        FRONT + 0.01,
        g,
      )

      // A giant scoop leaning against the east wall.
      const scoop = new THREE.Group()
      scoop.position.set(WIDTH / 2 + 0.36, 0, 0.5)
      scoop.rotation.z = 0.15
      g.add(scoop)
      add(new THREE.BoxGeometry(0.07, 1, 0.75), tray, 0, 0.7, 0, scoop)
      for (const z of [-0.22, 0, 0.22])
        add(
          new THREE.BoxGeometry(0.09, 0.6, 0.08),
          '#5d6d73',
          0,
          0.75,
          z,
          scoop,
        )
      add(
        new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8),
        tray,
        0,
        1.95,
        0,
        scoop,
      )

      // Litter tracked out onto the grass.
      for (let i = 0; i < 12; i++) {
        const angle = i * 2.4 + outhouse.id
        const reach = 0.4 + ((i * 0.37) % 1) * 1.3
        const grain = add(
          pebble,
          LITTER[i % LITTER.length],
          Math.sin(angle) * reach * 1.2,
          0.03,
          FRONT + 0.8 + Math.abs(Math.cos(angle)) * reach,
          g,
        )
        grain.scale.setScalar(0.05 + (i % 3) * 0.02)
      }

      // A wet floor sign stands by the door while it's closed for cleaning.
      const caution = new THREE.Group()
      caution.position.set(-1.5, 0, FRONT + 0.3)
      caution.visible = false
      g.add(caution)
      for (const side of [-1, 1]) {
        const panel = add(
          new THREE.BoxGeometry(0.5, 0.8, 0.04),
          '#f2c94c',
          0,
          0.38,
          side * 0.1,
          caution,
        )
        panel.rotation.x = side * 0.25
        const stripe = add(
          new THREE.BoxGeometry(0.4, 0.08, 0.045),
          '#3b3b3b',
          0,
          0.5,
          side * 0.07,
          caution,
        )
        stripe.rotation.x = side * 0.25
      }

      const wisps = Array.from({ length: WISPS }, (_, index) => {
        const wispMaterial = bendMaterial(
          new THREE.MeshBasicMaterial({
            color: '#a3b86c',
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
          bend,
        )
        const mesh = add(wisp, wispMaterial, (index - 1) * 0.8, 0, 0.2, g)
        mesh.visible = false
        return { mesh, material: wispMaterial }
      })
      this.outhouses.push({
        flap,
        open: 0,
        moon,
        light,
        caution,
        wisps,
        stink: 0,
      })
    }
    this.buildCart(add)
  }

  // The janitors' cart: a mop bucket, cleaning supplies, and bags of fresh
  // litter on the shelf below.
  private buildCart(
    add: (
      geometry: THREE.BufferGeometry,
      mat: THREE.Material | string,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D,
    ) => THREE.Mesh,
  ) {
    const cart = new THREE.Group()
    cart.position.set(JANITOR_CART.x, 0, JANITOR_CART.z)
    this.group.add(cart)
    const blue = '#4b7399'
    add(new THREE.BoxGeometry(1.5, 0.1, 0.9), blue, 0, 0.32, 0, cart)
    add(new THREE.BoxGeometry(1.5, 0.1, 0.9), blue, 0, 0.92, 0, cart)
    for (const x of [-0.7, 0.7])
      for (const z of [-0.4, 0.4]) {
        add(
          new THREE.CylinderGeometry(0.04, 0.04, 0.62, 6),
          blue,
          x,
          0.62,
          z,
          cart,
        )
        add(
          new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12).rotateX(Math.PI / 2),
          '#3b3b3b',
          x,
          0.13,
          z,
          cart,
        )
      }
    // A push handle at one end.
    for (const z of [-0.35, 0.35])
      add(
        new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6),
        blue,
        0.85,
        1.1,
        z,
        cart,
      )
    add(
      new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8).rotateX(Math.PI / 2),
      '#3b3b3b',
      0.85,
      1.32,
      0,
      cart,
    )
    add(
      new THREE.CylinderGeometry(0.32, 0.27, 0.45, 16),
      '#f0c24f',
      -0.35,
      1.2,
      0,
      cart,
    )
    add(
      new THREE.CircleGeometry(0.29, 16).rotateX(-Math.PI / 2),
      '#a9d4d9',
      -0.35,
      1.38,
      0,
      cart,
    )
    const mop = add(
      new THREE.CylinderGeometry(0.035, 0.035, 2, 6),
      '#c9a777',
      -0.15,
      1.95,
      -0.05,
      cart,
    )
    mop.rotation.z = -0.22
    add(
      new THREE.CylinderGeometry(0.08, 0.09, 0.3, 10),
      '#8fd3c1',
      0.35,
      1.12,
      0.22,
      cart,
    )
    add(
      new THREE.BoxGeometry(0.06, 0.12, 0.1),
      '#f6f1e4',
      0.35,
      1.32,
      0.22,
      cart,
    )
    for (const [index, color] of ['#f6efe0', '#e8a9a0', '#f6efe0'].entries())
      add(
        new THREE.BoxGeometry(0.42, 0.06, 0.32),
        color,
        0.32,
        1.0 + index * 0.06,
        -0.15,
        cart,
      )
    for (const x of [-0.35, 0.3])
      add(new THREE.BoxGeometry(0.5, 0.42, 0.4), '#d9cfb4', x, 0.58, 0, cart)
  }

  setNight(night: boolean) {
    this.night = night
  }

  update(outhouses: Outhouse[], time: number) {
    const dt =
      this.lastTime === null
        ? 0
        : THREE.MathUtils.clamp(time - this.lastTime, 0, 0.1)
    this.lastTime = time
    for (const outhouse of outhouses) {
      const parts = this.outhouses[outhouse.id]
      const open = outhouse.doorwayId !== null ? 1 : 0
      parts.open += (open - parts.open) * (1 - Math.exp(-dt * 6))
      // Swings outward and up, hinged along the top.
      parts.flap.rotation.x =
        -1.3 * THREE.MathUtils.smoothstep(parts.open, 0, 1)
      const status = outhouse.closed
        ? CLEANING
        : outhouse.visitorId !== null || outhouse.dirt >= OUTHOUSE_FILTHY
          ? OCCUPIED
          : VACANT
      parts.light.color.copy(status)
      parts.light.emissive.copy(status)
      parts.moon.emissiveIntensity =
        this.night && outhouse.visitorId !== null ? 1.6 : 0
      parts.caution.visible = outhouse.closed
      // Wavy stink lines drift up off a dirty litter box.
      const stink = THREE.MathUtils.smoothstep(
        outhouse.dirt,
        OUTHOUSE_DIRTY - 0.15,
        OUTHOUSE_FILTHY,
      )
      parts.stink += (stink - parts.stink) * (1 - Math.exp(-dt * 2))
      for (const [index, { mesh, material }] of parts.wisps.entries()) {
        const rise = (time * 0.4 + index / WISPS) % 1
        mesh.visible = parts.stink > 0.01
        mesh.position.y = WALL_HEIGHT + WIDTH / 2 + 0.2 + rise * 1.3
        mesh.scale.setScalar(0.7 + rise * 0.6)
        material.opacity = parts.stink * Math.sin(Math.PI * rise) * 0.75
      }
    }
  }
}
