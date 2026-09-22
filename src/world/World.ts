import * as THREE from 'three'
import { ButterflyRenderer } from './butterflyRenderer'
import { CatRenderer } from './cats'
import { CottageRenderer } from './cottageRenderer'
import { CafeRenderer } from './cafe'
import { PsxDithering } from './dithering'
import { TREAT_COLOR, bendMaterial, treatGeometry } from './materials'
import type { BendUniforms } from './materials'
import { createScenery } from './scenery'
import { updateGrassMaterial } from './grassMaterial'
import { CAT_COUNT, Simulation, WORLD, isHidden } from './simulation'
import type { Cat, MapCat, Point, TimeOfDay, UISnapshot } from './simulation'
export type { MapCat, UISnapshot }
import { groundHeight } from './terrain'
import { SpeechBubbles } from './speech'
import { EmoteMarks } from './emotes'
import { NightLights } from './nightLights'

import {
  calculateTossSpread,
  computeTrajectoryArc,
  unprojectGround,
} from './toss'
import type { TossSpread } from './toss'
import { LaserRenderer } from './laser'
import { SkyRenderer } from './sky'

const MAX_RENDER_HEIGHT = 480
const DEFAULT_CAMERA_ZOOM = 1.3
export const DEFAULT_CURVATURE = 0.004
const AIM_DOT_COUNT = 20
const FLYING_TREAT_HEIGHT_BASE = 2.2
const FLYING_TREAT_HEIGHT_VARIATION = 0.8
const FLYING_TREAT_DURATION_BASE = 0.48
const FLYING_TREAT_DURATION_VARIATION = 0.1
const TOSS_ORIGIN_FORWARD_OFFSET = 3.5

export interface WorldOptions {
  paused: boolean
  speed: number
  curvature: number
  timeOfDay: TimeOfDay
  follow: boolean
  selected: number | null
  reducedMotion: boolean
  showDirectory?: boolean
}
export class CatWorld {
  readonly simulation = new Simulation()
  private renderer: THREE.WebGLRenderer
  private dithering = new PsxDithering()
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
  private bend: BendUniforms = {
    amount: { value: DEFAULT_CURVATURE },
    center: { value: 0 },
  }
  private grassMaterial: THREE.MeshStandardMaterial
  private cats: CatRenderer
  private cafe: CafeRenderer
  private butterflies: ButterflyRenderer
  private cottages: CottageRenderer
  private nightLights: NightLights
  private sky = new SkyRenderer()
  private selection: THREE.Mesh
  private treats: THREE.InstancedMesh
  private aimReticle: THREE.Mesh
  private aimTrajectory: THREE.InstancedMesh
  private aimDotHelper = new THREE.Object3D()
  private laser: LaserRenderer
  private laserActive = false
  private laserPoint: Point | null = null
  public onLaserActiveChange?: (active: boolean) => void
  private holdingTreats = false
  private tossDrag: {
    startX: number
    startY: number
    currentX: number
    currentY: number
    startTime: number
    lastX: number
    lastY: number
    lastTime: number
    vx: number
    vy: number
  } | null = null
  private currentSpread: TossSpread | null = null
  private flyingTreats: {
    start: THREE.Vector3
    target: Point
    peakHeight: number
    duration: number
    elapsed: number
    current: THREE.Vector3
    rotation: THREE.Euler
    rotationSpeed: THREE.Euler
  }[] = []
  private pendingTossLanding: {
    center: Point
    pieces: Point[]
  } | null = null
  public onHoldingTreatsChange?: (holding: boolean) => void
  public onAimingChange?: (aiming: boolean) => void
  public onTossComplete?: () => void
  private sun = new THREE.DirectionalLight('#fff1d4', 2.3)
  private ambient = new THREE.HemisphereLight('#eff8e2', '#95a575', 2.3)
  private options: WorldOptions = {
    paused: false,
    speed: 1,
    curvature: DEFAULT_CURVATURE,
    timeOfDay: 'day',
    follow: false,
    selected: null,
    reducedMotion: false,
    showDirectory: false,
  }
  private focus = new THREE.Vector2(0, 0)
  private target = new THREE.Vector2(0, 0)
  private zoom = DEFAULT_CAMERA_ZOOM
  private targetZoom = DEFAULT_CAMERA_ZOOM
  private keys = new Set<string>()
  private controller = new AbortController()
  private resizeObserver: ResizeObserver
  private frame = 0
  private previous = 0
  private lastSnapshot = 0
  private drag: { x: number; y: number; distance: number } | null = null
  private projected = new THREE.Vector3()
  private treatPiece = new THREE.Object3D()
  private onSnapshot: (snapshot: UISnapshot) => void
  private onSelect: (id: number | null) => void
  private onManualMove: () => void
  private onError: (message: string) => void
  private host: HTMLElement
  private speech: SpeechBubbles
  private emotes: EmoteMarks

  constructor(
    host: HTMLElement,
    onSnapshot: (s: UISnapshot) => void,
    onSelect: (id: number | null) => void,
    onManualMove: () => void,
    onError: (message: string) => void,
  ) {
    this.host = host
    this.onSnapshot = onSnapshot
    this.onSelect = onSelect
    this.onManualMove = onManualMove
    this.onError = onError
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    })
    // Keep the drawing buffer at the retro resolution, including on Retina screens.
    this.renderer.setPixelRatio(1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.13
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D meadow with 100 cats. Drag or use arrow keys to explore, scroll to zoom, and click a cat to meet them.',
    )
    this.renderer.domElement.setAttribute('role', 'img')
    this.renderer.domElement.tabIndex = 0
    host.appendChild(this.renderer.domElement)
    this.emotes = new EmoteMarks(host)
    this.speech = new SpeechBubbles(host, (id) => {
      this.simulation.toggleDialogue(id)
      this.speech.update(
        this.simulation.cats,
        this.camera,
        this.bend,
        this.options.reducedMotion,
      )
    })
    this.sun.position.set(-15, 30, 20)
    this.scene.add(this.sun, this.ambient, this.sky.mesh)
    const { group: sceneryGroup, grassMaterial } = createScenery(this.bend)
    this.grassMaterial = grassMaterial
    this.scene.add(sceneryGroup)
    this.cats = new CatRenderer(this.bend, this.simulation.cats)
    this.scene.add(this.cats.group)
    this.cafe = new CafeRenderer(this.bend)
    this.scene.add(this.cafe.group)
    this.butterflies = new ButterflyRenderer(
      this.bend,
      this.simulation.butterflies,
    )
    this.scene.add(this.butterflies.group)
    this.cottages = new CottageRenderer(this.bend, this.simulation.cottages)
    this.scene.add(this.cottages.group)
    this.nightLights = new NightLights(this.bend)
    this.scene.add(this.nightLights.group)
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1.02, 48).rotateX(-Math.PI / 2),
      bendMaterial(
        new THREE.MeshBasicMaterial({
          color: '#fff6d6',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        }),
        this.bend,
      ),
    )
    this.selection.frustumCulled = false
    this.selection.visible = false
    this.scene.add(this.selection)
    // Every piece of a scattered handful, until a cat picks it up.
    this.treats = new THREE.InstancedMesh(
      treatGeometry(),
      bendMaterial(
        new THREE.MeshStandardMaterial({ color: TREAT_COLOR, roughness: 1 }),
        this.bend,
      ),
      CAT_COUNT * 2,
    )
    this.treats.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.treats.frustumCulled = false
    this.treats.count = 0
    this.scene.add(this.treats)
    this.aimReticle = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.88, 32).rotateX(-Math.PI / 2),
      bendMaterial(
        new THREE.MeshBasicMaterial({
          color: '#ffd073',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        }),
        this.bend,
      ),
    )
    this.aimReticle.frustumCulled = false
    this.aimReticle.visible = false
    this.scene.add(this.aimReticle)
    const trajectoryGeometry = new THREE.SphereGeometry(0.06, 6, 6)
    const trajectoryMaterial = bendMaterial(
      new THREE.MeshBasicMaterial({
        color: '#ffe599',
        transparent: true,
        opacity: 0.85,
      }),
      this.bend,
    )
    this.aimTrajectory = new THREE.InstancedMesh(
      trajectoryGeometry,
      trajectoryMaterial,
      24,
    )
    this.aimTrajectory.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.aimTrajectory.frustumCulled = false
    this.aimTrajectory.visible = false
    this.scene.add(this.aimTrajectory)
    this.laser = new LaserRenderer(this.bend)
    this.scene.add(this.laser.group)
    this.setTime('day')
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    this.bindControls()
    this.emitSnapshot()
    this.frame = requestAnimationFrame(this.tick)
  }

  setOptions(options: WorldOptions): void {
    const selectedChanged = options.selected !== this.options.selected
    const directoryChanged =
      Boolean(options.showDirectory) !== Boolean(this.options.showDirectory)
    if (options.selected !== null && selectedChanged) {
      this.simulation.revealDialogue(options.selected)
    }
    if (options.timeOfDay !== this.options.timeOfDay) {
      this.setTime(options.timeOfDay)
    }
    this.options = options
    this.bend.amount.value = options.curvature
    if (selectedChanged || directoryChanged) {
      this.emitSnapshot()
    }
  }

  private setTime(time: TimeOfDay) {
    const palettes = {
      day: ['#3584cf', '#bce2ee', '#ffffff', '#fff1d4', '#eff8e2'],
      golden: ['#4a365f', '#f8be8e', '#ffe4ca', '#ffd2a0', '#f8dabc'],
      night: ['#0b1420', '#2a4456', '#475e72', '#b9cddd', '#91aabc'],
    }
    const [top, bottom, , sunlight, ambient] = palettes[time]
    const previousBackground = this.scene.background
    if (previousBackground instanceof THREE.Texture)
      previousBackground.dispose()
    this.scene.background = null
    this.sky.setTime(time, this.sun.position)
    // A long, gentle fade brings a little sky color into the distant meadow.
    const haze = new THREE.Color(bottom).lerp(new THREE.Color(top), 0.15)
    this.scene.fog = new THREE.Fog(haze, 36, 140)
    this.sun.color.set(sunlight)
    this.sun.intensity = time === 'night' ? 0.55 : 2.3
    this.ambient.color.set(ambient)
    this.ambient.intensity = time === 'night' ? 1.2 : 2.3
    const night = time === 'night'
    this.nightLights.setNight(night)
    this.cottages.setNight(night)
    this.butterflies.setNight(night)
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    const renderHeight = Math.min(MAX_RENDER_HEIGHT, height)
    const renderWidth = Math.max(1, Math.round((width / height) * renderHeight))
    // CSS fills the viewport; only the 3D drawing buffer is capped at 480p.
    this.renderer.setSize(renderWidth, renderHeight, false)
    this.dithering.setSize(renderWidth, renderHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private bindControls() {
    const canvas = this.renderer.domElement,
      signal = this.controller.signal
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return
        canvas.focus()
        canvas.setPointerCapture(event.pointerId)
        if (this.holdingTreats) {
          this.startTossAim(event.clientX, event.clientY)
        } else if (this.laserActive) {
          this.updateLaserPoint(event.clientX, event.clientY)
        } else {
          this.drag = { x: event.clientX, y: event.clientY, distance: 0 }
        }
      },
      { signal },
    )
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (this.laserActive) {
          this.updateLaserPoint(event.clientX, event.clientY)
          return
        }
        if (this.holdingTreats && this.tossDrag) {
          this.updateTossAim(event.clientX, event.clientY)
          return
        }
        if (!this.drag) return
        const dx = event.clientX - this.drag.x,
          dy = event.clientY - this.drag.y
        this.drag.distance += Math.abs(dx) + Math.abs(dy)
        if (this.drag.distance > 5) {
          this.onManualMove()
          this.options.follow = false
          this.target.x -= dx * 0.04 * this.zoom
          this.target.y -= dy * 0.065 * this.zoom
          this.clampTarget()
        }
        this.drag.x = event.clientX
        this.drag.y = event.clientY
      },
      { signal },
    )
    canvas.addEventListener(
      'pointerup',
      (event) => {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
        if (this.holdingTreats && this.tossDrag) {
          this.executeToss()
          return
        }
        if (this.laserActive) {
          return
        }
        if (this.drag && this.drag.distance < 6)
          this.pick(event.clientX, event.clientY)
        this.drag = null
      },
      { signal },
    )
    canvas.addEventListener(
      'pointercancel',
      (event) => {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
        if (this.tossDrag) this.cancelToss()
        this.drag = null
      },
      { signal },
    )
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        this.targetZoom = THREE.MathUtils.clamp(
          this.targetZoom + event.deltaY * 0.001,
          0.52,
          1.7,
        )
      },
      { signal, passive: false },
    )
    window.addEventListener(
      'keydown',
      (event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(
            'input, button, select, textarea, [role="dialog"]',
          )
        )
          return
        if (event.key === 'Escape') {
          if (this.laserActive) {
            this.setLaserActive(false)
            return
          }
          if (this.holdingTreats) {
            this.cancelToss()
            this.setHoldingTreats(false)
            return
          }
        }
        const key = event.key.toLowerCase()
        if (
          [
            'w',
            'a',
            's',
            'd',
            'arrowup',
            'arrowdown',
            'arrowleft',
            'arrowright',
          ].includes(key)
        ) {
          event.preventDefault()
          this.keys.add(key)
        }
      },
      { signal },
    )
    window.addEventListener(
      'keyup',
      (event) => this.keys.delete(event.key.toLowerCase()),
      { signal },
    )
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear()
        this.drag = null
      },
      { signal },
    )
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault()
        cancelAnimationFrame(this.frame)
        this.onError(
          'The 3D connection was interrupted. Reload the page to return to the meadow.',
        )
      },
      { signal },
    )
  }

  private clampTarget() {
    this.target.x = THREE.MathUtils.clamp(
      this.target.x,
      WORLD.minX + 5,
      WORLD.maxX - 2,
    )
    this.target.y = THREE.MathUtils.clamp(
      this.target.y,
      WORLD.minZ + 4,
      WORLD.maxZ - 5,
    )
  }

  private pick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    let closest: number | null = null,
      distance = 42
    for (const cat of this.simulation.cats) {
      if (isHidden(cat)) continue
      const sitting = THREE.MathUtils.smoothstep(cat.pose.sitting, 0, 1)
      const lying = THREE.MathUtils.smoothstep(cat.pose.lying, 0, 1)
      const vomiting = THREE.MathUtils.smoothstep(cat.pose.vomiting, 0, 1)
      const forward = (0.42 * lying + 0.32 * vomiting) * cat.scale
      const x = cat.x + Math.sin(cat.heading) * forward
      const z = cat.z + Math.cos(cat.heading) * forward
      const y =
        groundHeight(cat.x, cat.z) +
        (1.83 - 0.5 * sitting - 1.07 * lying - 0.38 * vomiting) * cat.scale -
        this.bend.amount.value * (z - this.focus.y) ** 2
      this.projected.set(x, y, z).project(this.camera)
      if (this.projected.z > 1 || this.projected.z < -1) continue
      const screenX = ((this.projected.x + 1) * rect.width) / 2 + rect.left
      const screenY = ((-this.projected.y + 1) * rect.height) / 2 + rect.top
      const d = Math.hypot(screenX - clientX, screenY - clientY)
      if (d < distance) {
        distance = d
        closest = cat.id
      }
    }
    if (closest !== null) this.simulation.revealDialogue(closest)
    this.onSelect(closest)
  }

  zoomBy(direction: number) {
    this.targetZoom = THREE.MathUtils.clamp(
      this.targetZoom + direction * 0.16,
      0.52,
      1.7,
    )
  }
  home() {
    this.options.follow = false
    this.onManualMove()
    this.target.set(0, 0)
    this.targetZoom = DEFAULT_CAMERA_ZOOM
  }
  goTo(point: Point) {
    this.options.follow = false
    this.onManualMove()
    this.target.set(point.x, point.z)
    this.clampTarget()
  }
  dropTreat(): void {
    this.simulation.dropTreat({ x: this.focus.x, z: this.focus.y + 3 })
    this.emitSnapshot()
  }

  startTossAim(clientX: number, clientY: number): void {
    this.tossDrag = {
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      startTime: performance.now(),
      lastX: clientX,
      lastY: clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
    }
    this.updateTossSpread()
    this.onAimingChange?.(true)
  }

  updateTossAim(clientX: number, clientY: number): void {
    if (!this.tossDrag) return
    const now = performance.now()
    const dt = Math.max(1, now - this.tossDrag.lastTime)
    this.tossDrag.vx = (clientX - this.tossDrag.lastX) / dt
    this.tossDrag.vy = (clientY - this.tossDrag.lastY) / dt
    this.tossDrag.lastX = clientX
    this.tossDrag.lastY = clientY
    this.tossDrag.lastTime = now
    this.tossDrag.currentX = clientX
    this.tossDrag.currentY = clientY
    this.updateTossSpread()
  }

  private updateTossSpread(): void {
    if (!this.tossDrag) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    const startGround = unprojectGround(
      this.tossDrag.startX - rect.left,
      this.tossDrag.startY - rect.top,
      this.camera,
      rect.width,
      rect.height,
      this.bend.amount.value,
      this.focus.y,
    )
    const currentGround = unprojectGround(
      this.tossDrag.currentX - rect.left,
      this.tossDrag.currentY - rect.top,
      this.camera,
      rect.width,
      rect.height,
      this.bend.amount.value,
      this.focus.y,
    )
    this.currentSpread = calculateTossSpread(
      startGround,
      currentGround,
      {
        x: this.tossDrag.currentX - this.tossDrag.startX,
        y: this.tossDrag.currentY - this.tossDrag.startY,
      },
      {
        x: this.tossDrag.vx * 1000,
        y: this.tossDrag.vy * 1000,
      },
    )
  }

  executeToss(): void {
    if (!this.tossDrag) return
    const spread = this.currentSpread ?? this.fallbackSpread()
    const origin = this.calculateTossOrigin(
      this.tossDrag.startX,
      this.tossDrag.startY,
    )
    this.launchFlyingTreats(origin, spread)
    this.pendingTossLanding = { center: spread.center, pieces: spread.pieces }
    this.cancelToss()
    this.setHoldingTreats(false)
    this.onTossComplete?.()
  }

  private launchFlyingTreats(origin: THREE.Vector3, spread: TossSpread): void {
    this.flyingTreats = spread.pieces.map((piece) => ({
      start: origin.clone(),
      target: piece,
      peakHeight:
        FLYING_TREAT_HEIGHT_BASE +
        Math.random() * FLYING_TREAT_HEIGHT_VARIATION,
      duration:
        FLYING_TREAT_DURATION_BASE +
        Math.random() * FLYING_TREAT_DURATION_VARIATION,
      elapsed: 0,
      current: origin.clone(),
      rotation: new THREE.Euler(
        Math.random() * 6,
        Math.random() * 6,
        Math.random() * 6,
      ),
      rotationSpeed: new THREE.Euler(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
      ),
    }))
  }

  private fallbackSpread(): TossSpread {
    const center = { x: this.focus.x, z: this.focus.y + 3 }
    return calculateTossSpread(center, center, { x: 0, y: 0 }, { x: 0, y: 0 })
  }

  private calculateTossOrigin(clientX: number, clientY: number): THREE.Vector3 {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    const safeW = Math.max(1, rect.width)
    const safeH = Math.max(1, rect.height)
    const ndcX = ((clientX - rect.left) / safeW) * 2 - 1
    const ndcY = -((clientY - rect.top) / safeH) * 2 + 1
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    return ray.ray.origin
      .clone()
      .addScaledVector(ray.ray.direction, TOSS_ORIGIN_FORWARD_OFFSET)
  }

  cancelToss(): void {
    this.tossDrag = null
    this.currentSpread = null
    this.aimReticle.visible = false
    this.aimTrajectory.visible = false
    this.onAimingChange?.(false)
  }

  setHoldingTreats(holding: boolean): void {
    this.holdingTreats = holding
    if (holding) {
      this.drag = null
    } else {
      this.cancelToss()
    }
    this.onHoldingTreatsChange?.(holding)
  }

  isHoldingTreats(): boolean {
    return this.holdingTreats
  }

  updateLaserPoint(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ground = unprojectGround(
      clientX - rect.left,
      clientY - rect.top,
      this.camera,
      rect.width,
      rect.height,
      this.bend.amount.value,
      this.focus.y,
    )
    this.laserPoint = ground
    this.simulation.setLaserTarget(ground)
  }

  setLaserActive(active: boolean): void {
    this.laserActive = active
    if (active) {
      this.drag = null
    } else {
      this.laserPoint = null
      this.simulation.setLaserTarget(null)
    }
    this.onLaserActiveChange?.(active)
  }

  isLaserActive(): boolean {
    return this.laserActive
  }

  private updateAimVisuals(): void {
    if (!this.tossDrag || !this.currentSpread) {
      this.aimReticle.visible = false
      this.aimTrajectory.visible = false
      return
    }
    const center = this.currentSpread.center
    this.aimReticle.position.set(
      center.x,
      groundHeight(center.x, center.z) + 0.05,
      center.z,
    )
    this.aimReticle.rotation.set(-Math.PI / 2, 0, this.currentSpread.angle)
    this.aimReticle.scale.set(
      this.currentSpread.stretch,
      this.currentSpread.lateral,
      1,
    )
    this.aimReticle.visible = true

    const origin = this.calculateTossOrigin(
      this.tossDrag.startX,
      this.tossDrag.startY,
    )
    const arc = computeTrajectoryArc(
      origin,
      center,
      FLYING_TREAT_HEIGHT_BASE,
      AIM_DOT_COUNT,
    )
    this.aimTrajectory.count = arc.length
    for (let i = 0; i < arc.length; i++) {
      const pt = arc[i]
      this.aimDotHelper.position.set(pt.x, pt.y, pt.z)
      this.aimDotHelper.updateMatrix()
      this.aimTrajectory.setMatrixAt(i, this.aimDotHelper.matrix)
    }
    this.aimTrajectory.instanceMatrix.needsUpdate = true
    this.aimTrajectory.visible = true
  }

  private updateFlyingTreats(dt: number): void {
    if (this.flyingTreats.length === 0) return
    let allLanded = true
    for (const flying of this.flyingTreats) {
      flying.elapsed += dt
      const t = Math.min(1, flying.elapsed / flying.duration)
      if (t < 1) allLanded = false
      const arc = 4 * t * (1 - t)
      flying.current.x = THREE.MathUtils.lerp(
        flying.start.x,
        flying.target.x,
        t,
      )
      flying.current.z = THREE.MathUtils.lerp(
        flying.start.z,
        flying.target.z,
        t,
      )
      flying.current.y =
        groundHeight(flying.current.x, flying.current.z) +
        THREE.MathUtils.lerp(flying.start.y, 0.09, t) +
        flying.peakHeight * arc
      flying.rotation.x += flying.rotationSpeed.x * dt
      flying.rotation.y += flying.rotationSpeed.y * dt
      flying.rotation.z += flying.rotationSpeed.z * dt
    }
    if (allLanded && this.pendingTossLanding) {
      const { center, pieces } = this.pendingTossLanding
      this.simulation.dropTreat(center, pieces)
      this.emitSnapshot()
      this.flyingTreats = []
      this.pendingTossLanding = null
    }
  }

  private updateTreatMesh(): void {
    const pieces = this.simulation.treatPieces
    let instanceIndex = 0
    for (let i = 0; i < pieces.length && instanceIndex < CAT_COUNT * 2; i++) {
      const piece = pieces[i]
      this.treatPiece.position.set(
        piece.x,
        groundHeight(piece.x, piece.z) + 0.09,
        piece.z,
      )
      this.treatPiece.rotation.set(0, piece.id * 2.4, 0)
      this.treatPiece.updateMatrix()
      this.treats.setMatrixAt(instanceIndex++, this.treatPiece.matrix)
    }
    for (
      let i = 0;
      i < this.flyingTreats.length && instanceIndex < CAT_COUNT * 2;
      i++
    ) {
      const flying = this.flyingTreats[i]
      this.treatPiece.position.copy(flying.current)
      this.treatPiece.rotation.copy(flying.rotation)
      this.treatPiece.updateMatrix()
      this.treats.setMatrixAt(instanceIndex++, this.treatPiece.matrix)
    }
    this.treats.count = instanceIndex
    this.treats.instanceMatrix.needsUpdate = true
  }

  private tick = (timestamp: number) => {
    const dt = Math.min((timestamp - (this.previous || timestamp)) / 1000, 0.05)
    this.previous = timestamp
    if (!this.options.paused) this.simulation.step(dt * this.options.speed)
    if (this.keys.size) {
      this.options.follow = false
      this.onManualMove()
      if (this.keys.has('w') || this.keys.has('arrowup'))
        this.target.y -= dt * 12
      if (this.keys.has('s') || this.keys.has('arrowdown'))
        this.target.y += dt * 12
      if (this.keys.has('a') || this.keys.has('arrowleft'))
        this.target.x -= dt * 12
      if (this.keys.has('d') || this.keys.has('arrowright'))
        this.target.x += dt * 12
      this.clampTarget()
    }
    const selected =
      this.options.selected === null
        ? null
        : this.simulation.cats[this.options.selected]
    if (this.options.follow && selected) this.target.set(selected.x, selected.z)
    this.focus.lerp(
      this.target,
      this.options.reducedMotion ? 1 : 1 - Math.exp(-dt * 5),
    )
    this.zoom = THREE.MathUtils.lerp(
      this.zoom,
      this.targetZoom,
      1 - Math.exp(-dt * 7),
    )
    this.bend.center.value = this.focus.y
    this.camera.position.set(
      this.focus.x,
      18 * this.zoom,
      this.focus.y + 24 * this.zoom,
    )
    this.camera.lookAt(this.focus.x, -1.5, this.focus.y - 2 * this.zoom)
    this.camera.updateMatrixWorld()
    this.laser.update(
      this.laserPoint,
      this.camera,
      this.simulation.elapsed,
      this.laserActive,
    )
    this.cats.update(
      this.simulation.cats,
      this.simulation.elapsed,
      this.options.reducedMotion,
      this.simulation.puddles,
      this.simulation.butterflies,
      this.laserActive ? this.laserPoint : null,
    )
    this.butterflies.update(
      this.simulation.butterflies,
      this.simulation.elapsed,
      this.options.reducedMotion,
    )
    this.cottages.update(
      this.simulation.cottages,
      this.simulation.elapsed,
      this.bend,
    )
    this.nightLights.update(
      this.simulation.elapsed,
      this.bend,
      this.options.reducedMotion,
    )
    this.sky.update(
      this.camera,
      this.focus,
      this.simulation.elapsed,
      dt,
      this.options.reducedMotion,
    )
    updateGrassMaterial(
      this.grassMaterial,
      this.options.reducedMotion ? 0 : this.simulation.elapsed,
    )
    this.cafe.update(
      this.simulation.deliveredFoods,
      this.simulation.getCarriedItems(),
    )
    this.emotes.update(this.simulation.cats, this.camera, this.bend)
    this.speech.update(
      this.simulation.cats,
      this.camera,
      this.bend,
      this.options.reducedMotion,
    )
    this.selection.visible = selected !== null && !isHidden(selected)
    if (selected)
      this.selection.position.set(
        selected.x,
        groundHeight(selected.x, selected.z) + 0.075,
        selected.z,
      )
    this.updateFlyingTreats(dt)
    this.updateAimVisuals()
    this.updateTreatMesh()
    this.renderer.render(this.scene, this.camera)
    this.dithering.render(this.renderer)
    if (timestamp - this.lastSnapshot > 300) {
      this.lastSnapshot = timestamp
      this.emitSnapshot()
    }
    this.frame = requestAnimationFrame(this.tick)
  }

  private emitSnapshot(): void {
    this.onSnapshot(
      this.simulation.uiSnapshot(
        this.options.selected,
        this.options.showDirectory,
      ),
    )
  }

  getCat(id: number): Cat | null {
    const cat = this.simulation.cats[id]
    if (!cat) return null
    return {
      ...cat,
      cafeWorker: cat.cafeWorker ? { ...cat.cafeWorker } : null,
      cafeCustomer: cat.cafeCustomer ? { ...cat.cafeCustomer } : null,
      cottage: cat.cottage ? { ...cat.cottage } : null,
      snack: cat.snack ? { ...cat.snack } : null,
      objective: cat.objective ? { ...cat.objective } : null,
    }
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.controller.abort()
    this.resizeObserver.disconnect()
    this.speech.dispose()
    this.emotes.dispose()
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry)
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(material)
        if (object instanceof THREE.InstancedMesh) object.dispose()
      }
    })
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value)
      material.dispose()
    }
    geometries.forEach((g) => g.dispose())
    textures.forEach((t) => t.dispose())
    if (this.scene.background instanceof THREE.Texture)
      this.scene.background.dispose()
    this.sky.dispose()
    this.laser.dispose()
    this.cafe.dispose()
    this.dithering.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
