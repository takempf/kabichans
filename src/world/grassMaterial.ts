import * as THREE from 'three'
import type { BendUniforms } from './materials'

const GRASS_VERTEX_PREFIX = /* glsl */ `
uniform float uBend;
uniform float uCenter;
varying vec3 vWorldBentPos;
varying vec3 vViewPositionCustom;
varying vec3 vGrassNormal;
`

const GRASS_VERTEX_HOOK = /* glsl */ `
vec4 worldBent = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  worldBent = instanceMatrix * worldBent;
#endif
worldBent = modelMatrix * worldBent;
float bendDistance = worldBent.z - uCenter;
worldBent.y -= uBend * bendDistance * bendDistance;
vWorldBentPos = worldBent.xyz;
vGrassNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
vec4 mvPosition = viewMatrix * worldBent;
vViewPosition = -mvPosition.xyz;
vViewPositionCustom = -mvPosition.xyz;
gl_Position = projectionMatrix * mvPosition;
`

const GRASS_FRAGMENT_PREFIX = /* glsl */ `
uniform float uTime;
varying vec3 vWorldBentPos;
varying vec3 vViewPositionCustom;
varying vec3 vGrassNormal;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
`

const GRASS_FRAGMENT_HOOK = /* glsl */ `
#include <color_fragment>

// 1. Macro-scale color variation (BotW painterly meadow)
vec3 pos = vWorldBentPos;
float macroWave1 = sin(pos.x * 0.045 + sin(pos.z * 0.035) * 2.2) *
                   cos(pos.z * 0.042 + sin(pos.x * 0.028) * 1.8);
float macroWave2 = sin(pos.x * 0.09 - pos.z * 0.08) * 0.3;
float macroT = clamp((macroWave1 + macroWave2) * 0.5 + 0.5, 0.0, 1.0);

// Rich, darker green palette (holds depth under 4.6x scene lights)
vec3 deepTurf = vec3(0.18, 0.33, 0.11);
vec3 midTurf  = vec3(0.24, 0.42, 0.15);
vec3 warmTurf = vec3(0.30, 0.50, 0.19);
vec3 baseMeadow = mix(deepTurf, warmTurf, macroT);

// 2. Animal Crossing staggered geometric turf pattern
const float TILE_SIZE = 0.95;
float row = floor(pos.z / TILE_SIZE);
vec2 cellPos = pos.xz;
if (mod(row, 2.0) > 0.5) {
  cellPos.x += TILE_SIZE * 0.5;
}
vec2 cellId = floor(cellPos / TILE_SIZE);
vec2 cellUv = fract(cellPos / TILE_SIZE);

// Quantize to crisp retro 12x12 texel grid
const float PIXEL_RES = 12.0;
vec2 p = floor(cellUv * PIXEL_RES);
float cellHash = hash21(cellId);

// Animal Crossing inverted triangle turf mark
float triHalfWidth = (8.5 - p.y) * 0.65;
bool inTriangle = (p.y >= 2.0 && p.y <= 8.0 && abs(p.x - 5.5) <= triHalfWidth);
bool isHighlight = inTriangle && (p.y == 2.0) && (abs(p.x - 5.5) <= 4.0);

// 3. Micro-grain / tactile turf texture (velvety grass carpet)
const float GRAIN_RES = 16.0;
vec2 grainCoord = floor(pos.xz * GRAIN_RES);
float grain = hash21(grainCoord);
float grainMod = (grain - 0.5) * 0.14;

// 4. Subtle grass sprig marks (occasional 2-3 pixel tuft accents)
bool inSprig = (cellHash < 0.35) && (
  (p.x == 4.0 && p.y >= 3.0 && p.y <= 7.0) ||
  (p.x == 7.0 && p.y >= 2.0 && p.y <= 6.0) ||
  (p.x == 8.0 && p.y >= 4.0 && p.y <= 7.0)
);

// Combine turf pattern and micro-grain
vec3 grassTextureColor = baseMeadow;

if (inTriangle) {
  if (isHighlight) {
    grassTextureColor = baseMeadow * 1.16;
  } else {
    grassTextureColor = baseMeadow * 0.84;
  }
}

if (inSprig) {
  grassTextureColor = baseMeadow * 0.80;
}

grassTextureColor += vec3(grainMod * 0.6, grainMod * 0.8, grainMod * 0.4);

// 5. Distance LOD (Fade micro-grain far away near horizon, keep foreground crisp)
float dist = length(vViewPositionCustom);
float lod = smoothstep(45.0, 95.0, dist);
vec3 finalGrass = mix(grassTextureColor, baseMeadow, lod);

// 6. View-Angle Glancing Sheen (Fresnel / BotW)
vec3 worldViewDir = normalize(cameraPosition - vWorldBentPos);
float NdotV = max(0.0, dot(vGrassNormal, worldViewDir));
float glancing = pow(1.0 - NdotV, 2.5);
vec3 sheenTint = vec3(0.85, 0.95, 0.70);
finalGrass = mix(finalGrass, finalGrass * 1.15 + sheenTint * 0.08, glancing * 0.40);

// 7. Subtle Wind Shimmer (BotW gentle breeze)
float windPhase = pos.x * 0.10 + pos.z * 0.14 + uTime * 1.2;
float windWave = sin(windPhase) * 0.5 + sin(windPhase * 0.7 + 1.0) * 0.5;
float windEffect = smoothstep(0.3, 0.85, windWave) * 0.06;
finalGrass += vec3(0.04, 0.06, 0.02) * windEffect;

diffuseColor = vec4(finalGrass, 1.0);
`

export interface GrassMaterialUserData {
  uTime: { value: number }
}

export function createGrassMaterial(
  bend: BendUniforms,
): THREE.MeshStandardMaterial {
  const timeUniform = { value: 0 }
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0.0,
  })

  material.userData = { uTime: timeUniform } satisfies GrassMaterialUserData

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bend.amount
    shader.uniforms.uCenter = bend.center
    shader.uniforms.uTime = timeUniform

    shader.vertexShader = GRASS_VERTEX_PREFIX + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      GRASS_VERTEX_HOOK,
    )

    shader.fragmentShader = GRASS_FRAGMENT_PREFIX + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      GRASS_FRAGMENT_HOOK,
    )
  }

  material.customProgramCacheKey = () => 'kabichans-grass-v10'
  return material
}

export function updateGrassMaterial(
  material: THREE.Material,
  elapsed: number,
): void {
  const data = material.userData as unknown
  if (
    typeof data === 'object' &&
    data !== null &&
    'uTime' in data &&
    typeof (data as GrassMaterialUserData).uTime === 'object' &&
    (data as GrassMaterialUserData).uTime !== null
  ) {
    ;(data as GrassMaterialUserData).uTime.value = elapsed
  }
}
