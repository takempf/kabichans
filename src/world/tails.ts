import * as THREE from 'three'
import { CAT_COLORS } from './catArtwork'
import { bendMaterial, type BendUniforms } from './materials'
import type { Cat } from './simulation'

const STRIPE_COLOR = new THREE.Color(CAT_COLORS.stripe)
const CROWN_COLOR = new THREE.Color(CAT_COLORS.crown)
const COAT_SHADOW_COLOR = new THREE.Color(CAT_COLORS.coatShadow)
const TABBY_COLOR = new THREE.Color(CAT_COLORS.tabby)
const WHITE_COLOR = new THREE.Color(CAT_COLORS.white)
const GRAY_WHITE_MIX = new THREE.Color()
  .copy(TABBY_COLOR)
  .lerp(WHITE_COLOR, 0.68)
const TOP_BASE_COLOR = new THREE.Color()
  .copy(COAT_SHADOW_COLOR)
  .lerp(CROWN_COLOR, 0.4)
const tempStripe = new THREE.Color()
const tempTip = new THREE.Color()

function computeTailColor(
  t: number,
  angle: number,
  out: THREE.Color,
): THREE.Color {
  const under = (1 - Math.cos(angle)) * 0.5
  // The entire top of the tail is dark, transitioning down the lower flanks
  // to the light gray/white mix on the underside.
  const underFactor = THREE.MathUtils.smoothstep(under, 0.4, 0.85)
  out.copy(TOP_BASE_COLOR).lerp(GRAY_WHITE_MIX, underFactor)

  // 7 tiger stripes with a subtle circumference wave
  const wave = 0.02 * Math.cos(angle * 2) + 0.01 * Math.sin(angle * 3 + t * 5)
  const stripeCoord = (t + wave - 0.07) / 0.86

  let stripeIntensity = 0
  if (stripeCoord >= 0 && stripeCoord <= 1) {
    const phase = stripeCoord * 7 * Math.PI * 2
    stripeIntensity = THREE.MathUtils.smoothstep(Math.sin(phase), 0.0, 0.7)
  }

  // Stripes are darkest on top, softening into the gray/white mix on the bottom side
  tempStripe.copy(STRIPE_COLOR).lerp(TABBY_COLOR, underFactor * 0.4)
  const effectiveStripe = stripeIntensity * (1 - underFactor * 0.55)
  out.lerp(tempStripe, effectiveStripe * 0.9)

  // Top half deepens toward dark crown fur
  if (under < 0.45) {
    out.lerp(CROWN_COLOR, (1 - under / 0.45) * 0.35)
  }

  // No white tip: tip stays dark like a tiger/tabby cat tail
  if (t > 0.9) {
    tempTip.copy(STRIPE_COLOR).lerp(TABBY_COLOR, underFactor * 0.25)
    out.lerp(tempTip, ((t - 0.9) / 0.1) * 0.85)
  }

  return out
}

export function tailGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.08, 0.07, -0.3),
    new THREE.Vector3(0.22, 0.27, -0.56),
    new THREE.Vector3(0.25, 0.59, -0.64),
    new THREE.Vector3(0.15, 0.81, -0.59),
  ])
  const segments = 96
  const sides = 24
  const geometry = new THREE.TubeGeometry(curve, segments, 1, sides, false)
  const positions = geometry.attributes.position
  const along = new Float32Array(positions.count * 4)
  const colors = new Float32Array(positions.count * 3)
  const color = new THREE.Color()
  const point = new THREE.Vector3()
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments
    const center = curve.getPointAt(t)
    const gradient = curve.getTangentAt(t).divideScalar(curve.getLength())
    // A narrow attachment opens into a plush plume, then rounds into its tip.
    const radius =
      0.9 *
      (0.06 + 0.17 * Math.sin(Math.PI * t) ** 0.85) *
      Math.sqrt(Math.min(1, (1 - t) / 0.12))
    for (let side = 0; side <= sides; side++) {
      const i = ring * (sides + 1) + side
      const angle = (side / sides) * Math.PI * 2
      const fluff =
        1 + 0.035 * Math.sin(angle * 5 + t * 15) * Math.sin(Math.PI * t)
      point.fromBufferAttribute(positions, i).sub(center)
      point.multiplyScalar(radius * fluff).add(center)
      positions.setXYZ(i, point.x, point.y, point.z)
      along.set([t, gradient.x, gradient.y, gradient.z], i * 4)
      computeTailColor(t, angle, color)
      colors.set([color.r, color.g, color.b], i * 3)
    }
  }
  geometry.setAttribute('tailAlong', new THREE.BufferAttribute(along, 4))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function tailMaterial(bend: BendUniforms) {
  const material = bendMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }),
    bend,
  )
  const bendShader = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    bendShader(shader, renderer)
    shader.vertexShader =
      `attribute vec4 tailAlong;
       attribute vec3 tailMotion;
      ` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
       float tailT = tailAlong.x;
       float tailWeight = tailT * tailT;
       float tailPhase = tailMotion.x - tailT * 1.35;
       float tailSine = sin(tailPhase);
       float tailCosine = cos(tailPhase);
       vec3 tailOffset = vec3(
         tailMotion.y * tailWeight * tailSine,
         tailWeight * (tailMotion.z + tailMotion.y * 0.16 * tailCosine),
         0.0
       );
       vec3 tailDerivative = vec3(
         tailMotion.y * (2.0 * tailT * tailSine - 1.35 * tailWeight * tailCosine),
         2.0 * tailT * (tailMotion.z + tailMotion.y * 0.16 * tailCosine)
           + tailWeight * tailMotion.y * 0.216 * tailSine,
         0.0
       );
       // Carry the surface normal through the bend as well as the position.
       objectNormal -= tailAlong.yzw * dot(tailDerivative, objectNormal)
         / (1.0 + dot(tailAlong.yzw, tailDerivative));`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed += tailOffset;',
    )
  }
  material.customProgramCacheKey = () => 'kabichans-flexible-tail-v1'
  return material
}

// The simulation expresses mood through attention, activity, and posture.
export function tailMood(cat: Cat) {
  if (cat.activity === 'vomiting')
    return { speed: 0.8, amplitude: 0.025, lift: -0.16 }
  if (cat.activity === 'resting' || cat.activity === 'lying')
    return { speed: 0.65, amplitude: 0.035, lift: -0.06 }
  if (cat.butterflyId !== null || cat.snack?.stage === 'approaching')
    return { speed: 3.8, amplitude: 0.26, lift: 0.07 }
  if (cat.activity === 'socializing' || cat.activity === 'conversing')
    return { speed: 2.7, amplitude: 0.22, lift: 0.045 }
  if (cat.activity === 'snacking' || cat.cafeCustomer?.stage === 'eating')
    return { speed: 1.6, amplitude: 0.14, lift: 0.025 }
  return {
    speed: 1.45 + cat.walking * 0.65,
    amplitude: 0.12 + cat.walking * 0.05,
    lift: 0,
  }
}
