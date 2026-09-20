import * as THREE from 'three'
import { bendMaterial } from './materials'
import type { BendUniforms } from './materials'
import { groundHeight } from './terrain'
import type { Point } from './geography'

const BEAM_CORE_COLOR = '#ff1744'
const BEAM_GLOW_COLOR = '#ff5252'
const DOT_CORE_COLOR = '#ff0033'
const DOT_GLOW_COLOR = '#ff3366'
const BEAM_CORE_RADIUS = 0.02
const BEAM_GLOW_RADIUS = 0.065
const BEAM_SEGMENTS = 8
const DOT_RADIUS = 0.22
const RING_INNER_RADIUS = 0.2
const RING_OUTER_RADIUS = 0.48
const RING_SEGMENTS = 24
const PULSE_SPEED = 22
const PULSE_SCALE = 0.18
const ORIGIN_NDC_X = 0
const ORIGIN_NDC_Y = -0.92
const ORIGIN_DISTANCE = 1.2
const DOT_ELEVATION = 0.04

export class LaserRenderer {
  readonly group = new THREE.Group()
  private coreBeam: THREE.Mesh
  private glowBeam: THREE.Mesh
  private dotCore: THREE.Mesh
  private dotRing: THREE.Mesh
  private unitY = new THREE.Vector3(0, 1, 0)
  private originPoint = new THREE.Vector3()
  private targetPoint = new THREE.Vector3()
  private diffVector = new THREE.Vector3()
  private bend: BendUniforms

  constructor(bend: BendUniforms) {
    this.bend = bend
    this.group.name = 'laser-pointer'

    const coreGeo = new THREE.CylinderGeometry(
      BEAM_CORE_RADIUS,
      BEAM_CORE_RADIUS,
      1,
      BEAM_SEGMENTS,
    )
    const glowGeo = new THREE.CylinderGeometry(
      BEAM_GLOW_RADIUS,
      BEAM_GLOW_RADIUS,
      1,
      BEAM_SEGMENTS,
    )
    const coreMat = bendMaterial(
      new THREE.MeshBasicMaterial({
        color: BEAM_CORE_COLOR,
        transparent: true,
        opacity: 0.95,
      }),
      bend,
    )
    const glowMat = bendMaterial(
      new THREE.MeshBasicMaterial({
        color: BEAM_GLOW_COLOR,
        transparent: true,
        opacity: 0.4,
      }),
      bend,
    )

    this.coreBeam = new THREE.Mesh(coreGeo, coreMat)
    this.glowBeam = new THREE.Mesh(glowGeo, glowMat)
    this.coreBeam.frustumCulled = false
    this.glowBeam.frustumCulled = false

    const dotGeo = new THREE.CircleGeometry(DOT_RADIUS, RING_SEGMENTS).rotateX(
      -Math.PI / 2,
    )
    const dotMat = bendMaterial(
      new THREE.MeshBasicMaterial({
        color: DOT_CORE_COLOR,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      }),
      bend,
    )
    this.dotCore = new THREE.Mesh(dotGeo, dotMat)
    this.dotCore.frustumCulled = false

    const ringGeo = new THREE.RingGeometry(
      RING_INNER_RADIUS,
      RING_OUTER_RADIUS,
      RING_SEGMENTS,
    ).rotateX(-Math.PI / 2)
    const ringMat = bendMaterial(
      new THREE.MeshBasicMaterial({
        color: DOT_GLOW_COLOR,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      }),
      bend,
    )
    this.dotRing = new THREE.Mesh(ringGeo, ringMat)
    this.dotRing.frustumCulled = false

    this.group.add(this.coreBeam)
    this.group.add(this.glowBeam)
    this.group.add(this.dotCore)
    this.group.add(this.dotRing)
    this.group.visible = false
  }

  update(
    target: Point | null,
    camera: THREE.Camera,
    elapsed: number,
    visible: boolean,
  ): void {
    if (!visible || !target) {
      this.group.visible = false
      return
    }

    this.group.visible = true
    this.computeScreenBottomOrigin(camera)

    const gy = groundHeight(target.x, target.z) + DOT_ELEVATION
    this.targetPoint.set(target.x, gy, target.z)

    this.updateBeamTransform()
    this.updateDotTransform(target, gy, elapsed)
  }

  private computeScreenBottomOrigin(camera: THREE.Camera): void {
    this.originPoint.set(ORIGIN_NDC_X, ORIGIN_NDC_Y, 0.5).unproject(camera)
    this.originPoint
      .sub(camera.position)
      .normalize()
      .multiplyScalar(ORIGIN_DISTANCE)
      .add(camera.position)

    const bendOffset =
      this.bend.amount.value *
      (this.originPoint.z - this.bend.center.value) ** 2
    this.originPoint.y += bendOffset
  }

  private updateBeamTransform(): void {
    this.diffVector.subVectors(this.targetPoint, this.originPoint)
    const length = this.diffVector.length()
    const midpoint = this.originPoint
      .clone()
      .addScaledVector(this.diffVector, 0.5)

    this.coreBeam.position.copy(midpoint)
    this.glowBeam.position.copy(midpoint)

    const orientation = new THREE.Quaternion().setFromUnitVectors(
      this.unitY,
      this.diffVector.clone().normalize(),
    )
    this.coreBeam.quaternion.copy(orientation)
    this.glowBeam.quaternion.copy(orientation)

    this.coreBeam.scale.set(1, length, 1)
    this.glowBeam.scale.set(1, length, 1)
  }

  private updateDotTransform(
    target: Point,
    groundY: number,
    elapsed: number,
  ): void {
    const pulse = 1 + Math.sin(elapsed * PULSE_SPEED) * PULSE_SCALE
    this.dotCore.position.set(target.x, groundY, target.z)
    this.dotRing.position.set(target.x, groundY + 0.005, target.z)
    this.dotCore.scale.set(pulse, 1, pulse)
    this.dotRing.scale.set(pulse, 1, pulse)
  }

  dispose(): void {
    this.coreBeam.geometry.dispose()
    this.glowBeam.geometry.dispose()
    this.dotCore.geometry.dispose()
    this.dotRing.geometry.dispose()
  }
}
