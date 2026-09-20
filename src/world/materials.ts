import * as THREE from 'three'
import {
  CAT_COAT_GRADIENT,
  CAT_COLORS,
  CAT_FACE_EXPRESSIONS,
  catFacePaint,
} from './catArtwork'

export interface BendUniforms {
  amount: { value: number }
  center: { value: number }
}

// Bend world-space vertices so terrain, villagers, and scenery share one horizon.
export function bendMaterial<T extends THREE.Material>(
  material: T,
  bend: BendUniforms,
): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bend.amount
    shader.uniforms.uCenter = bend.center
    shader.vertexShader =
      'uniform float uBend;\nuniform float uCenter;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      vec4 worldBent = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        worldBent = instanceMatrix * worldBent;
      #endif
      worldBent = modelMatrix * worldBent;
      float bendDistance = worldBent.z - uCenter;
      worldBent.y -= uBend * bendDistance * bendDistance;
      vec4 mvPosition = viewMatrix * worldBent;
      gl_Position = projectionMatrix * mvPosition;
    `,
    )
  }
  material.customProgramCacheKey = () => 'kabichans-barrel-v1'
  return material
}

// A little kibble-like treat, on the ground or in a cat's paws.
export const TREAT_COLOR = '#bc895d'
export function treatGeometry() {
  return new THREE.DodecahedronGeometry(0.1)
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function coatGradient(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, CAT_COAT_GRADIENT.endY)
  for (const stop of CAT_COAT_GRADIENT.stops)
    gradient.addColorStop(stop.offset, stop.color)
  return gradient
}

export function catHeadTexture() {
  // Each row holds front and back UV islands for one expression.
  const islandSize = 256
  const texture = canvasTexture(
    islandSize * 2,
    islandSize * CAT_FACE_EXPRESSIONS.length,
    (ctx) => {
      ctx.scale(islandSize / 1024, islandSize / 1024)
      for (let frame = 0; frame < CAT_FACE_EXPRESSIONS.length; frame++) {
        ctx.save()
        ctx.translate(0, frame * 1024)
        for (const mark of catFacePaint(CAT_FACE_EXPRESSIONS[frame])) {
          ctx.save()
          if (mark.transform) ctx.transform(...mark.transform)
          const path = new Path2D(mark.path)
          if (mark.fill !== 'none') {
            ctx.fillStyle =
              mark.gradient === 'coat' ? coatGradient(ctx) : mark.fill
            ctx.fill(path)
          }
          if (mark.stroke) {
            ctx.strokeStyle = mark.stroke
            ctx.lineWidth = mark.lineWidth ?? 1
            ctx.lineCap = ctx.lineJoin = 'round'
            ctx.stroke(path)
          }
          ctx.restore()
        }
        // A tabby crown wraps around the back; only the front carries a face.
        ctx.translate(1024, 0)
        ctx.fillStyle = CAT_COLORS.white
        ctx.fillRect(0, 0, 1024, 1024)
        const backCap = new Path2D(
          'M0 0H1024V606Q830 691 512 688Q194 691 0 606Z',
        )
        ctx.fillStyle = coatGradient(ctx)
        ctx.fill(backCap)
        // Denser dark fur down the back, fading to the lighter side markings.
        ctx.save()
        ctx.clip(backCap)
        const backShade = ctx.createRadialGradient(512, 340, 70, 512, 340, 510)
        backShade.addColorStop(0, 'rgba(21,21,25,.94)')
        backShade.addColorStop(0.45, 'rgba(21,21,25,.8)')
        backShade.addColorStop(1, 'rgba(21,21,25,0)')
        ctx.fillStyle = backShade
        ctx.fillRect(0, 0, 1024, 1024)
        ctx.restore()
        ctx.fillStyle = CAT_COLORS.stripe
        for (let stripe = 0; stripe < 7; stripe++) {
          const x = 118 + stripe * 132
          ctx.fill(
            new Path2D(
              `M${x - 17} 0Q${x - 29} 185 ${x + 5} 362L${x + 22} 420Q${x + 8} 185 ${x + 19} 0Z`,
            ),
          )
        }
        for (const side of [-1, 1]) {
          ctx.save()
          ctx.translate(side < 0 ? 0 : 1024, 0)
          ctx.scale(-side, 1)
          ctx.fill(
            new Path2D(
              'M0 287Q108 299 216 358L152 349Q72 325 0 330ZM0 397Q129 398 229 456L167 452Q86 428 0 439ZM0 499Q103 489 186 539L134 539Q57 522 0 539Z',
            ),
          )
          ctx.restore()
        }
        ctx.restore()
      }
    },
  )
  // Build each island's mip levels independently. Stop at one texel per island:
  // smaller levels would merge expressions and reintroduce the pale blink seam.
  // Nearest sampling within each level keeps ink crisp and never samples across
  // an island boundary; blending between levels avoids harsh distance changes.
  const mipmaps: HTMLCanvasElement[] = [texture.image]
  for (let size = islandSize / 2; size >= 1; size /= 2) {
    const canvas = document.createElement('canvas')
    canvas.width = size * 2
    canvas.height = size * CAT_FACE_EXPRESSIONS.length
    const ctx = canvas.getContext('2d')!
    const previous = mipmaps[mipmaps.length - 1]
    for (let row = 0; row < CAT_FACE_EXPRESSIONS.length; row++)
      for (let column = 0; column < 2; column++)
        ctx.drawImage(
          previous,
          column * size * 2,
          row * size * 2,
          size * 2,
          size * 2,
          column * size,
          row * size,
          size,
          size,
        )
    mipmaps.push(canvas)
  }
  texture.mipmaps = mipmaps
  texture.generateMipmaps = false
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.magFilter = THREE.NearestFilter
  return texture
}

export function earTexture() {
  const texture = canvasTexture(256, 512, (ctx) => {
    const outerEar = ctx.createLinearGradient(0, 0, 0, 512)
    outerEar.addColorStop(0, '#82736c')
    outerEar.addColorStop(0.45, '#544b49')
    outerEar.addColorStop(1, CAT_COLORS.crown)
    ctx.fillStyle = outerEar
    ctx.fillRect(0, 0, 256, 512)
    ctx.fillStyle = '#9b8b80'
    ctx.fill(new Path2D('M43 430Q44 287 62 104Q65 87 72 108L204 430Z'))
    ctx.fillStyle = CAT_COLORS.ear
    ctx.fill(new Path2D('M55 413Q54 296 68 131L184 413Z'))
    ctx.fillStyle = '#c4a79b'
    ctx.fill(new Path2D('M63 400 73 218 111 369Z'))
  })
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.magFilter = THREE.NearestFilter
  return texture
}

export function shadowTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(31,57,37,.33)')
    gradient.addColorStop(0.45, 'rgba(31,57,37,.19)')
    gradient.addColorStop(1, 'rgba(31,57,37,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  })
}
