import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  TREAT_COLOR,
  bendMaterial,
  catHeadTexture,
  earTexture,
  shadowTexture,
  treatGeometry,
} from './materials'
import type { BendUniforms } from './materials'
import {
  CAT_COUNT,
  MAX_PUDDLES,
  SNACK_EAT_TIME,
  SNACK_PICKUP_TIME,
  SNACK_REACH,
  VOMIT_EMIT_TIME,
} from './simulation'
import { isHidden, isOnShift } from './simulation'
import type { Butterfly, Cat, Point, Puddle } from './simulation'
import { CAT_COLORS, CAT_FACE_EXPRESSIONS } from './catArtwork'
import { groundHeight } from './terrain'
import { tailGeometry, tailMaterial, tailMood } from './tails'

type PartKind =
  'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR' | 'tail' | 'shadow'
interface Part {
  mesh: THREE.InstancedMesh
  kind: PartKind
  // Cafe uniform pieces only appear on cats working a shift.
  uniform: boolean
}
const sphere = new THREE.SphereGeometry(1, 20, 14)
function ellipsoid(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
) {
  return sphere.clone().scale(sx, sy, sz).translate(x, y, z)
}
function combine(geometries: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(geometries)
  if (!merged) throw new Error('Could not build cat geometry')
  geometries.forEach((g) => g.dispose())
  return merged
}
function head() {
  // Separate UV islands keep the face on the front, with a painted cap on the back.
  // Both hemispheres share their boundary, so the silhouette is one smooth shell.
  const hemispheres = [0, Math.PI].map((start, side) => {
    const geometry = new THREE.SphereGeometry(1, 32, 28, start, Math.PI)
    const positions = geometry.attributes.position
    const uv = geometry.attributes.uv
    const rounded = (value: number, power: number) =>
      Math.sign(value) * Math.abs(value) ** power
    for (let i = 0; i < positions.count; i++) {
      const y = rounded(positions.getY(i), 0.86)
      const x = rounded(positions.getX(i), 0.86) * 0.79 * (1 - y * 0.1)
      const z = rounded(positions.getZ(i), 0.86) * 0.74
      positions.setXYZ(i, x, y * 0.68, z)
      uv.setXY(i, (x / 1.74 + 0.5 + side) / 2, y / 2 + 0.5)
    }
    geometry.computeVertexNormals()
    return geometry
  })
  return combine(hemispheres)
}

function ear(x: number) {
  const side = x > 0 ? -1 : 1
  const shape = new THREE.Shape()
  shape.moveTo(-0.25 * side, -0.04)
  shape.quadraticCurveTo(-0.25 * side, 0.35, -0.18 * side, 0.86)
  shape.quadraticCurveTo(-0.17 * side, 0.95, -0.12 * side, 0.86)
  shape.lineTo(0.27 * side, 0.01)
  shape.quadraticCurveTo(0.02 * side, -0.12, -0.25 * side, -0.04)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    curveSegments: 10,
  })
  const positions = g.attributes.position
  const normals = g.attributes.normal
  const uv = g.attributes.uv
  for (let i = 0; i < positions.count; i++) {
    // Inner ears are printed on the front of the same ear, never raised inserts.
    uv.setXY(
      i,
      normals.getZ(i) > 0.5 ? (positions.getX(i) * side + 0.32) / 0.64 : 0.02,
      normals.getZ(i) > 0.5 ? (positions.getY(i) + 0.15) / 1.15 : 0.02,
    )
    const height = THREE.MathUtils.clamp((positions.getY(i) + 0.1) / 1.06, 0, 1)
    positions.setZ(i, 0.08 + (positions.getZ(i) - 0.08) * (1 - height * 0.8))
  }
  g.computeVertexNormals()
  g.translate(x, 0.36, -0.06)
  return g
}

// How quickly the head follows a new point of interest (per second).
const HEAD_EASE = 7

// Critically damped spring: follows a moving target without overshoot and eases
// in and out even when the target jumps, so a change of attention never snaps.
function spring(
  state: Float32Array,
  index: number,
  target: number,
  dt: number,
  rate: number,
) {
  const offset = state[index] - target
  const velocity = state[index + 1]
  const decay = Math.exp(-rate * dt)
  const drift = (velocity + rate * offset) * dt
  state[index] = target + (offset + drift) * decay
  state[index + 1] = (velocity - rate * drift) * decay
}

export class CatRenderer {
  readonly group = new THREE.Group()
  readonly pickMesh: THREE.InstancedMesh
  private parts: Part[] = []
  private root = new THREE.Object3D()
  private local = new THREE.Object3D()
  private matrix = new THREE.Matrix4()
  private headMatrix = new THREE.Matrix4()
  private mouth = new THREE.Vector3()
  private droplets: THREE.InstancedMesh
  private puddles: THREE.InstancedMesh
  // The treat each cat is holding up to eat.
  private morsels: THREE.InstancedMesh
  private morsel = new THREE.Vector3()
  private muzzle = new THREE.Vector3()
  // Eased head yaw, pitch, roll, and paw reach per cat, each with its velocity.
  private gaze = new Float32Array(CAT_COUNT * 8)
  private lastTime: number | null = null
  private tailMotion = new THREE.InstancedBufferAttribute(
    new Float32Array(CAT_COUNT * 3),
    3,
  )
  private tailSpeeds = new Float32Array(CAT_COUNT)
  private faceFrames = new THREE.InstancedBufferAttribute(
    new Float32Array(CAT_COUNT),
    1,
  )

  constructor(bend: BendUniforms, cats: Cat[]) {
    const material = (
      color: string,
      extra: THREE.MeshStandardMaterialParameters = {},
    ) =>
      bendMaterial(
        new THREE.MeshStandardMaterial({ color, roughness: 0.94, ...extra }),
        bend,
      )
    const cream = material(CAT_COLORS.white)
    const headGeo = head()
    headGeo.setAttribute('faceFrame', this.faceFrames)
    this.faceFrames.setUsage(THREE.DynamicDrawUsage)
    const faceMaterial = material('#ffffff', { map: catHeadTexture() })
    const bendShader = faceMaterial.onBeforeCompile
    faceMaterial.onBeforeCompile = (shader, renderer) => {
      bendShader(shader, renderer)
      shader.vertexShader = 'attribute float faceFrame;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vMapUv.y = (clamp(vMapUv.y, 0.001, 0.999) + ${CAT_FACE_EXPRESSIONS.length - 1}.0 - faceFrame) / ${CAT_FACE_EXPRESSIONS.length}.0;`,
      )
      // Favor a little more detail than the default distance filter so the
      // eyes and eyeliner survive the 480p render without unfiltered shimmer.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace(
          'texture2D( map, vMapUv )',
          'texture2D( map, vMapUv, -0.75 )',
        ),
      )
    }
    faceMaterial.customProgramCacheKey = () => 'kabichans-painted-face-v3'
    this.pickMesh = this.add(headGeo, faceMaterial, 'head')
    this.add(
      combine([ear(-0.45), ear(0.45)]),
      material('#ffffff', { map: earTexture() }),
      'head',
    )
    this.add(ellipsoid(0, 0.88, 0, 0.28, 0.33, 0.22), cream, 'body')
    const shirt = new THREE.CylinderGeometry(0.27, 0.46, 0.66, 24, 3)
      .scale(1, 1, 0.77)
      .translate(0, 0.87, 0)
    const shirtMesh = this.add(shirt, material('#ffffff'), 'body')
    cats.forEach((c) => shirtMesh.setColorAt(c.id, new THREE.Color(c.shirt)))
    this.add(
      new THREE.TorusGeometry(0.265, 0.037, 8, 24)
        .rotateX(Math.PI / 2)
        .scale(1, 1, 0.78)
        .translate(0, 1.21, 0),
      cream,
      'body',
    )
    // Cafe uniform: a deep green bib apron with a cream tie, and a matching cap.
    const apronGreen = material('#2f5a4a', { side: THREE.DoubleSide })
    const apronTrim = material('#f3e2bf')
    this.add(
      new THREE.CylinderGeometry(0.29, 0.48, 0.6, 24, 3, true, -0.95, 1.9)
        .scale(1, 1, 0.8)
        .translate(0, 0.84, 0),
      apronGreen,
      'body',
      true,
    )
    this.add(
      new THREE.TorusGeometry(0.4, 0.028, 6, 28)
        .rotateX(Math.PI / 2)
        .scale(1, 1, 0.8)
        .translate(0, 0.79, 0),
      apronTrim,
      'body',
      true,
    )
    this.add(
      new THREE.BoxGeometry(0.2, 0.12, 0.02)
        .rotateX(-0.28)
        .translate(0, 0.72, 0.355),
      apronTrim,
      'body',
      true,
    )
    this.add(
      combine([
        new THREE.CylinderGeometry(0.21, 0.23, 0.15, 20).translate(0, 0.68, 0),
        new THREE.CylinderGeometry(0.235, 0.235, 0.04, 20).translate(
          0,
          0.62,
          0,
        ),
      ]).rotateX(-0.12),
      apronGreen,
      'head',
      true,
    )
    this.add(
      new THREE.SphereGeometry(0.045, 8, 6).translate(0, 0.77, 0.01),
      apronTrim,
      'head',
      true,
    )
    const leaf = new THREE.Shape()
    leaf.moveTo(0, 0.79)
    leaf.bezierCurveTo(-0.13, 0.83, -0.11, 0.94, -0.1, 0.97)
    leaf.bezierCurveTo(-0.02, 0.96, 0, 0.86, 0, 0.79)
    leaf.bezierCurveTo(0, 0.86, 0.04, 0.92, 0.09, 0.92)
    leaf.bezierCurveTo(0.11, 0.85, 0.08, 0.8, 0, 0.79)
    const leafDecal = new THREE.ShapeGeometry(leaf, 12)
    const leafPositions = leafDecal.attributes.position
    for (let i = 0; i < leafPositions.count; i++) {
      const radius = 0.27 + ((1.2 - leafPositions.getY(i)) / 0.66) * 0.19
      // Follow the shirt's polygonal surface so the little print never floats.
      const angle = Math.asin(leafPositions.getX(i) / radius)
      const segment = Math.PI / 12
      const a = Math.floor(angle / segment) * segment
      const b = a + segment
      const t =
        (leafPositions.getX(i) / radius - Math.sin(a)) /
        (Math.sin(b) - Math.sin(a))
      leafPositions.setZ(
        i,
        radius * THREE.MathUtils.lerp(Math.cos(a), Math.cos(b), t) * 0.77 +
          0.002,
      )
    }
    leafDecal.computeVertexNormals()
    this.add(leafDecal, cream, 'body')
    for (const side of ['L', 'R'] as const) {
      this.add(
        combine([
          ellipsoid(0, -0.23, 0, 0.115, 0.27, 0.115),
          ellipsoid(0, -0.43, 0, 0.118, 0.13, 0.12),
        ]),
        cream,
        `arm${side}`,
      )
      const sleeve = this.add(
        ellipsoid(0, -0.055, 0, 0.15, 0.17, 0.14),
        material('#ffffff'),
        `arm${side}`,
      )
      cats.forEach((c) => sleeve.setColorAt(c.id, new THREE.Color(c.shirt)))
      this.add(
        new THREE.CapsuleGeometry(0.12, 0.27, 6, 12).translate(0, -0.12, 0.025),
        cream,
        `leg${side}`,
      )
    }
    const tail = tailGeometry()
    tail.setAttribute('tailMotion', this.tailMotion)
    this.tailMotion.setUsage(THREE.DynamicDrawUsage)
    cats.forEach((cat) => {
      const mood = tailMood(cat)
      this.tailMotion.setXYZ(cat.id, cat.phase, mood.amplitude, mood.lift)
      this.tailSpeeds[cat.id] = mood.speed
    })
    this.add(tail, tailMaterial(bend), 'tail')
    this.add(
      new THREE.PlaneGeometry(2.3, 1.65).rotateX(-Math.PI / 2),
      bendMaterial(
        new THREE.MeshBasicMaterial({
          map: shadowTexture(),
          transparent: true,
          depthWrite: false,
        }),
        bend,
      ),
      'shadow',
    )
    const vomitMaterial = material('#aca267')
    this.droplets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.045, 6, 4),
      vomitMaterial,
      CAT_COUNT * 3,
    )
    const spot = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2)
    this.puddles = new THREE.InstancedMesh(
      combine([
        spot.clone().scale(0.22, 1, 0.17),
        spot.clone().scale(0.12, 1, 0.12).translate(0.17, 0.001, 0.035),
        spot.clone().scale(0.09, 1, 0.08).translate(-0.16, 0.002, -0.09),
      ]),
      vomitMaterial,
      MAX_PUDDLES,
    )
    spot.dispose()
    this.morsels = new THREE.InstancedMesh(
      treatGeometry(),
      material(TREAT_COLOR, { roughness: 1 }),
      CAT_COUNT,
    )
    for (const mesh of [this.droplets, this.puddles, this.morsels]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      this.group.add(mesh)
    }
    this.droplets.name = 'vomit-droplets'
    this.puddles.name = 'vomit-puddles'
    this.morsels.name = 'held-treats'
    this.update(cats, 0, false)
  }

  private add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    kind: PartKind,
    uniform = false,
  ) {
    const mesh = new THREE.InstancedMesh(geometry, material, CAT_COUNT)
    mesh.name = `cat-${kind}`
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false // The vertex shader moves vertices outside their unbent bounds.
    this.group.add(mesh)
    this.parts.push({ mesh, kind, uniform })
    return mesh
  }

  update(
    cats: Cat[],
    time: number,
    reducedMotion: boolean,
    puddles: Puddle[] = [],
    butterflies: Butterfly[] = [],
    laserTarget: Point | null = null,
  ) {
    const dt =
      this.lastTime === null
        ? 0
        : THREE.MathUtils.clamp(time - this.lastTime, 0, 0.1)
    this.lastTime = time
    for (const cat of cats) {
      const sitting = THREE.MathUtils.smoothstep(cat.pose.sitting, 0, 1)
      const lying = THREE.MathUtils.smoothstep(cat.pose.lying, 0, 1)
      const vomiting = THREE.MathUtils.smoothstep(cat.pose.vomiting, 0, 1)
      const standing = Math.max(0, 1 - sitting - lying - vomiting)
      const running = THREE.MathUtils.smoothstep(cat.travelSpeed, 1.4, 4.1)
      const discussion = cat.discussion * standing
      const talking = cat.speaking * standing
      // Kneel, reach down for the treat, then hold it up to nibble.
      const kneel = THREE.MathUtils.smoothstep(cat.kneel, 0, 1)
      const snackTime =
        cat.snack?.stage === 'eating' ? time - cat.snack.since : -1
      const eatTime = cat.snack?.eatTime ?? SNACK_EAT_TIME
      const lift =
        cat.snack?.stage === 'done'
          ? kneel
          : THREE.MathUtils.smoothstep(
              snackTime,
              SNACK_PICKUP_TIME,
              SNACK_PICKUP_TIME + 0.4,
            )
      const chewing =
        snackTime > SNACK_PICKUP_TIME + 0.3 && snackTime < eatTime ? 1 : 0
      const nibble =
        chewing && !reducedMotion ? Math.sin(snackTime * 11) * 0.06 : 0
      const heave =
        !reducedMotion &&
        cat.activity === 'vomiting' &&
        cat.activityTime > 0.7 &&
        cat.activityTime < 3.5
          ? Math.sin((cat.activityTime - 0.7) * 8) ** 2
          : 0
      const swing =
        Math.sin(cat.gait) *
        cat.walking *
        (reducedMotion ? 0.15 : 0.45 + running * 0.35) *
        standing
      const bob = reducedMotion
        ? 0
        : (1 - Math.cos(cat.gait * 2)) *
          (0.018 + running * 0.04) *
          cat.walking *
          standing
      const diner = cat.cafeCustomer
      // Cafe diners hop up onto their stool and sit on its cushion.
      const elevation = groundHeight(cat.x, cat.z) + (diner?.elevation ?? 0)
      this.root.position.set(cat.x, elevation + bob, cat.z)
      this.root.rotation.set(0, cat.heading, 0)
      // Out of sight inside a cottage.
      this.root.scale.setScalar(isHidden(cat) ? 0 : cat.scale)
      this.root.updateMatrix()

      // Where the head wants to point. These targets can jump (a new speaker, a
      // gaze that swings into range, a stop), so they are eased below.
      let lookYaw = 0
      let lookPitch = 0
      let lookRoll = 0
      // Rhythmic gestures that already vary smoothly, added after easing.
      let swayYaw = 0
      let swayPitch = 0
      let swayRoll = 0
      let reach = 0
      const myHeadY =
        elevation + (lying > 0.5 ? 0.76 : sitting > 0.5 ? 1.33 : 1.83)
      const lookAt = (
        x: number,
        y: number,
        z: number,
        range: number,
        maxUp: number,
        strength: number,
      ) => {
        const dx = x - cat.x
        const dz = z - cat.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.2 || dist > range) return false
        const diff = Math.atan2(
          Math.sin(Math.atan2(dx, dz) - cat.heading),
          Math.cos(Math.atan2(dx, dz) - cat.heading),
        )
        if (Math.abs(diff) >= 1.4) return false
        lookYaw = THREE.MathUtils.clamp(diff, -1.18, 1.18) * strength
        lookPitch =
          THREE.MathUtils.clamp(
            -Math.atan2(y - myHeadY, Math.max(0.6, dist)),
            -maxUp,
            0.42,
          ) * strength
        return true
      }

      // 0. Laser gaze: if laser is active, only active chasers or immediately nearby cats look at it
      let focused = false
      if (laserTarget && cat.activity !== 'resting') {
        const ldist = Math.hypot(laserTarget.x - cat.x, laserTarget.z - cat.z)
        const isChaser = cat.objective?.kind === 'laser'
        const maxGazeDist = isChaser ? 14 : 4.5
        if (ldist < maxGazeDist) {
          focused = lookAt(
            laserTarget.x,
            groundHeight(laserTarget.x, laserTarget.z) + 0.04,
            laserTarget.z,
            maxGazeDist,
            0.85,
            1,
          )
          if (isChaser && ldist < 1.8 && standing > 0.1) {
            reach = standing
          }
        }
      }

      // 1. Social gaze: look at conversation partner, active speaker, or group members
      if (!focused && (standing > 0.1 || sitting > 0.1)) {
        let targetCat: Cat | null = null
        if (cat.socialTarget !== null && cat.socialTarget !== cat.id) {
          targetCat = cats[cat.socialTarget] ?? null
        } else if (cat.conversationId !== null) {
          const speaker = cats.find(
            (c) =>
              c.conversationId === cat.conversationId &&
              c.speaking > 0.1 &&
              c.id !== cat.id,
          )
          if (speaker) {
            targetCat = speaker
          } else {
            const others = cats.filter(
              (c) => c.conversationId === cat.conversationId && c.id !== cat.id,
            )
            if (others.length > 0) {
              const idx = Math.floor(
                (((time * 0.35 + cat.phase) % others.length) + others.length) %
                  others.length,
              )
              targetCat = others[idx]
            }
          }
        }

        if (targetCat)
          focused = lookAt(
            targetCat.x,
            groundHeight(targetCat.x, targetCat.z) +
              (targetCat.pose.lying > 0.5
                ? 0.76
                : targetCat.pose.sitting > 0.5
                  ? 1.33
                  : 1.83),
            targetCat.z,
            12,
            0.32,
            Math.min(
              1,
              discussion * 1.2 + (cat.socialTarget !== null ? 0.85 : 0),
            ),
          )

        // 1b. Butterflies: the one this cat is after, or one fluttering close by.
        if (!focused && cat.activity !== 'resting') {
          const own =
            cat.butterflyId === null ? null : butterflies[cat.butterflyId]
          for (const butterfly of own ? [own] : butterflies) {
            focused = lookAt(
              butterfly.x,
              groundHeight(butterfly.x, butterfly.z) + butterfly.y,
              butterfly.z,
              own ? 14 : 3.5,
              0.75,
              1,
            )
            if (focused) break
          }
          if (
            own &&
            cat.objective?.kind === 'chase' &&
            cat.travelMode !== 'walking' &&
            Math.hypot(own.x - cat.x, own.z - cat.z) < 2.2
          )
            reach = standing
        }
      }

      // 2. Movement gaze: lead into turns and glance naturally around the meadow
      if (!focused && cat.walking > 0.05) {
        const speed = Math.hypot(cat.velocity.x, cat.velocity.z)
        if (speed > 0.12) {
          const moveAngle = Math.atan2(cat.velocity.x, cat.velocity.z)
          const turnLead = Math.atan2(
            Math.sin(moveAngle - cat.heading),
            Math.cos(moveAngle - cat.heading),
          )
          lookYaw += THREE.MathUtils.clamp(turnLead * 0.75, -0.58, 0.58)
        }
        const focus = 1 - running * 0.55
        const glanceYaw =
          Math.sin(time * 0.72 + cat.phase * 2.3) *
          Math.cos(time * 0.31 + cat.phase) *
          0.44 *
          focus
        lookYaw += glanceYaw * cat.walking * standing

        lookPitch +=
          (0.06 + Math.sin(time * 0.85 + cat.phase) * 0.07) *
          cat.walking *
          standing
      }
      swayPitch += Math.sin(cat.gait) * 0.035 * cat.walking * standing

      // 3. Idle gaze: look around when standing or sitting
      if (
        !focused &&
        cat.walking <= 0.05 &&
        (standing > 0.5 || sitting > 0.5)
      ) {
        lookYaw +=
          Math.sin(time * 0.42 + cat.phase * 1.7) *
          Math.sin(time * 0.19 + cat.phase * 3.1) *
          0.52
        lookPitch +=
          Math.sin(time * 0.38 + cat.phase * 2.1) * 0.1 + 0.04 * sitting
        lookRoll += Math.sin(time * 0.28 + cat.phase * 1.5) * 0.05
      }

      // 4. Conversational gestures: talking emphasis & listening nods
      if (talking > 0.05) {
        swayYaw += Math.sin(time * 2.8 + cat.phase) * 0.12 * talking
        swayPitch += Math.sin(time * 4.2) * 0.09 * talking
        swayRoll += Math.cos(time * 2.4 + cat.phase) * 0.05 * talking
      }
      const listening =
        discussion * (1 - THREE.MathUtils.smoothstep(talking, 0, 0.1))
      swayPitch +=
        THREE.MathUtils.smoothstep(Math.sin(time * 2.2 + cat.phase), 0.3, 0.8) *
        0.06 *
        listening
      swayRoll += Math.sin(time * 1.4 + cat.phase) * 0.04 * listening

      // 5. Activity-specific adjustments
      if (cat.activity === 'snacking') lookPitch += 0.2
      if (diner?.stage === 'eating') {
        lookPitch += 0.28
        swayPitch += Math.max(0, Math.sin(time * 5 + cat.phase)) * 0.1
      }

      const motion =
        Math.max(0, 1 - vomiting * 0.95 - lying * 0.8 - kneel * 0.7) *
        (reducedMotion ? 0.25 : 1)
      const gaze = this.gaze
      const at = cat.id * 8
      spring(gaze, at, lookYaw * motion, dt, HEAD_EASE)
      spring(gaze, at + 2, lookPitch * motion, dt, HEAD_EASE)
      spring(gaze, at + 4, lookRoll * motion, dt, HEAD_EASE)
      spring(gaze, at + 6, reach, dt, HEAD_EASE)
      lookYaw = gaze[at] + swayYaw * motion
      lookPitch = gaze[at + 2] + swayPitch * motion
      lookRoll = gaze[at + 4] + swayRoll * motion
      reach = Math.max(0, gaze[at + 6])
      const onShift = isOnShift(cat)
      const mood = tailMood(cat)
      const tailEase = 1 - Math.exp(-3 * dt)
      this.tailSpeeds[cat.id] = THREE.MathUtils.lerp(
        this.tailSpeeds[cat.id],
        mood.speed,
        tailEase,
      )
      // Integrate phase so changing moods never jumps to another part of the wave.
      this.tailMotion.setXYZ(
        cat.id,
        (this.tailMotion.getX(cat.id) +
          (reducedMotion ? 0 : dt * this.tailSpeeds[cat.id])) %
          (Math.PI * 2),
        reducedMotion
          ? 0
          : THREE.MathUtils.lerp(
              this.tailMotion.getY(cat.id),
              mood.amplitude,
              tailEase,
            ),
        THREE.MathUtils.lerp(this.tailMotion.getZ(cat.id), mood.lift, tailEase),
      )

      for (const part of this.parts) {
        this.local.position.set(0, 0, 0)
        this.local.rotation.set(0, 0, 0)
        this.local.scale.set(1, 1, 1)
        const kind = part.kind
        if (kind === 'head') {
          this.local.position.set(
            0,
            1.83 -
              0.5 * sitting -
              1.07 * lying -
              0.38 * vomiting -
              heave * 0.08 -
              0.62 * kneel,
            0.42 * lying + 0.32 * vomiting + 0.3 * kneel,
          )
          this.local.rotation.x =
            0.08 * lying +
            kneel * (0.42 - lift * 0.22) +
            nibble +
            (reducedMotion ? 0 : running * cat.walking * standing * 0.07) +
            (0.48 + heave * 0.13) * vomiting +
            lookPitch
          this.local.rotation.y = lookYaw
          this.local.rotation.z =
            0.1 * lying +
            (reducedMotion
              ? 0
              : Math.sin(time * 1.7 + cat.phase) * 0.025 * standing) +
            lookRoll
        } else if (kind === 'body') {
          this.local.position.set(
            0,
            -0.5 * sitting +
              0.39 * lying -
              0.1 * vomiting -
              heave * 0.025 -
              0.42 * kneel,
            -lying,
          )
          this.local.rotation.x =
            (Math.PI / 2) * lying +
            0.2 * vomiting +
            0.22 * kneel +
            (reducedMotion ? 0 : running * cat.walking * standing * 0.12)
        } else if (kind === 'armL' || kind === 'armR') {
          const s = kind === 'armL' ? -1 : 1
          this.local.position.set(
            s * 0.35,
            1.1 - 0.5 * sitting - 0.92 * lying - 0.25 * vomiting - 0.42 * kneel,
            0.43 * lying + 0.13 * vomiting + 0.12 * kneel,
          )
          this.local.rotation.set(
            swing * s -
              0.28 * sitting -
              (Math.PI / 2) * lying -
              0.4 * vomiting -
              kneel * (0.95 + lift * 0.6),
            0,
            s * (0.25 - 0.2 * lying - 0.4 * lift),
          )
          if (cat.activity === 'socializing' && cat.walking < 0.1 && s > 0)
            this.local.rotation.z =
              standing * (1.3 + (reducedMotion ? 0 : Math.sin(time * 4) * 0.18))
          if (reach > 0.01) {
            // Batting at the butterfly overhead, one paw after the other.
            const swipe = reducedMotion
              ? 0.5
              : Math.max(0, Math.sin(time * 9 + (s > 0 ? 0 : Math.PI)))
            this.local.rotation.x -= reach * (1.5 + swipe * 0.9)
          }
          if (s > 0) {
            this.local.rotation.z +=
              talking *
              (0.7 +
                (reducedMotion ? 0 : Math.sin(time * 2.7 + cat.phase) * 0.1))
            this.local.rotation.x -= talking * 0.2
          }
        } else if (kind === 'legL' || kind === 'legR') {
          const s = kind === 'legL' ? -1 : 1
          this.local.position.set(
            s * 0.2,
            0.41 -
              0.21 * sitting -
              0.25 * lying -
              0.02 * vomiting -
              0.14 * kneel,
            0.18 * sitting - 0.6 * lying - 0.08 * kneel,
          )
          this.local.rotation.x =
            -1.45 * sitting +
            (Math.PI / 2) * lying +
            0.25 * vomiting +
            1.3 * kneel -
            swing * s
          // Keep the capsule feet above the turf throughout folding / unfolding.
          const angle = this.local.rotation.x
          this.local.position.y = Math.max(
            this.local.position.y,
            0.15 +
              0.12 * Math.cos(angle) +
              0.025 * Math.sin(angle) +
              0.135 * Math.abs(Math.cos(angle)),
          )
        } else if (kind === 'tail') {
          this.local.position.set(
            0,
            0.65 -
              0.43 * sitting -
              0.5 * lying -
              0.08 * vomiting -
              0.35 * kneel,
            -0.18 - 0.36 * lying,
          )
          this.local.scale.y = 1 - 0.35 * sitting - 0.75 * lying
        } else if (kind === 'shadow') {
          this.local.position.y = 0.025 - bob
          this.local.scale.set(1 + 0.15 * lying, 1, 1 + 0.3 * lying)
        }
        if (part.uniform && !onShift) this.local.scale.setScalar(0)
        this.local.updateMatrix()
        if (kind === 'head' && !part.uniform)
          this.headMatrix.copy(this.local.matrix)
        this.matrix.multiplyMatrices(this.root.matrix, this.local.matrix)
        part.mesh.setMatrixAt(cat.id, this.matrix)
      }
      const blink = Math.sin(time * 0.7 + cat.phase) > 0.995
      this.faceFrames.setX(
        cat.id,
        vomiting > 0.15
          ? 2
          : cat.activity === 'resting' || lying > 0.5 || blink || chewing
            ? 1
            : 0,
      )
      this.mouth
        .set(0, -0.28, 0.7)
        .applyMatrix4(this.headMatrix)
        .applyMatrix4(this.root.matrix)
      const emitting =
        !reducedMotion &&
        cat.activity === 'vomiting' &&
        cat.activityTime >= VOMIT_EMIT_TIME &&
        cat.activityTime < VOMIT_EMIT_TIME + 0.9
      for (let drop = 0; drop < 3; drop++) {
        const progress =
          ((cat.activityTime - VOMIT_EMIT_TIME) * 2.5 + drop / 3 + 10) % 1
        this.local.position.set(
          this.mouth.x + Math.sin(cat.heading) * progress * 0.2 * cat.scale,
          this.mouth.y * (1 - progress ** 1.6) + 0.03,
          this.mouth.z + Math.cos(cat.heading) * progress * 0.2 * cat.scale,
        )
        this.local.rotation.set(0, 0, 0)
        this.local.scale.setScalar(
          emitting ? cat.scale * (1 - progress * 0.3) : 0,
        )
        this.local.updateMatrix()
        this.droplets.setMatrixAt(cat.id * 3 + drop, this.local.matrix)
      }
      // Scooped off the grass and raised to the mouth, a bite at a time.
      const holding =
        snackTime >= SNACK_PICKUP_TIME && snackTime < eatTime && !isHidden(cat)
      const bites = THREE.MathUtils.clamp(
        Math.floor((snackTime - SNACK_PICKUP_TIME - 0.4) / 0.6),
        0,
        3,
      )
      this.muzzle.set(0, -0.4, 0.74).applyMatrix4(this.headMatrix)
      this.morsel
        .set(0, 0.1, SNACK_REACH / cat.scale)
        .lerp(this.muzzle, lift)
        .applyMatrix4(this.root.matrix)
      this.local.position.copy(this.morsel)
      this.local.rotation.set(0, cat.heading, 0)
      this.local.scale.setScalar(holding ? cat.scale * (1 - bites * 0.22) : 0)
      this.local.updateMatrix()
      this.morsels.setMatrixAt(cat.id, this.local.matrix)
    }
    this.droplets.instanceMatrix.needsUpdate = true
    this.morsels.instanceMatrix.needsUpdate = true
    this.puddles.count = Math.min(MAX_PUDDLES, puddles.length)
    for (let i = 0; i < this.puddles.count; i++) {
      const puddle = puddles[i]
      const age = time - puddle.createdAt
      const size = puddle.scale * THREE.MathUtils.clamp(age * 5, 0, 1)
      this.local.position.set(
        puddle.x,
        groundHeight(puddle.x, puddle.z) + 0.035,
        puddle.z,
      )
      this.local.rotation.set(0, puddle.heading, 0)
      this.local.scale.setScalar(size)
      this.local.updateMatrix()
      this.puddles.setMatrixAt(i, this.local.matrix)
    }
    this.puddles.instanceMatrix.needsUpdate = true
    this.faceFrames.needsUpdate = true
    this.tailMotion.needsUpdate = true
    for (const part of this.parts) part.mesh.instanceMatrix.needsUpdate = true
  }
}
