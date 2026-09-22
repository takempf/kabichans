import * as THREE from 'three'
import type { TimeOfDay } from './simulation'

const SKY_RADIUS = 180
const CLOUD_DEPTH = 60
// Screen-space displacement per meadow unit; keep vertical motion small so
// clouds remain in the narrow band above the curved horizon.
const CLOUD_PARALLAX_X = 0.0025
const CLOUD_PARALLAX_Y = 0.00065
const CLOUD_LAYOUT = [
  [-0.76, 0.77, 0.95],
  [-0.27, 0.72, 1.12],
  [0.23, 0.83, 0.85],
  [0.72, 0.74, 1.04],
] as const

const SKY_VERTEX_SHADER = /* glsl */ `
#include <fog_pars_vertex>
varying vec3 vWorldDirection;
varying vec3 vViewDirection;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * worldPos;
  vWorldDirection = worldPos.xyz - cameraPosition;
  vViewDirection = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const SKY_FRAGMENT_SHADER = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uSunDirection;
uniform vec3 uCloudLightDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyTopColor;
uniform vec3 uSkyBottomColor;
uniform vec3 uCloudTopColor;
uniform vec3 uCloudBottomColor;
uniform vec3 uHazeColor;
uniform vec4 uClouds[4];
uniform vec2 uViewHalfSize;
uniform float uTime;
uniform float uIsNight;

varying vec3 vWorldDirection;
varying vec3 vViewDirection;

float smoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float ellipsoid(vec3 p, vec3 radii) {
  return (length(p / radii) - 1.0) * min(radii.x, min(radii.y, radii.z));
}

float cloudSdf(vec3 p) {
  // A broad, slightly flat base with overlapping rounded cumulus lobes.
  float d = ellipsoid(p, vec3(2.5, 0.65, 1.0));
  d = smoothUnion(d, ellipsoid(p - vec3(-1.35, 0.35, 0.0), vec3(1.05, 0.95, 1.0)), 0.32);
  d = smoothUnion(d, ellipsoid(p - vec3(-0.35, 0.8, 0.0), vec3(1.1, 1.2, 1.1)), 0.32);
  d = smoothUnion(d, ellipsoid(p - vec3(0.8, 0.55, 0.05), vec3(1.0, 1.05, 1.0)), 0.28);
  d = smoothUnion(d, ellipsoid(p - vec3(1.65, 0.15, 0.0), vec3(0.9, 0.7, 0.85)), 0.25);
  return d;
}

float cloudDensity(vec3 p) {
  return 1.0 - smoothstep(-0.18, 0.08, cloudSdf(p));
}

void main() {
  vec3 worldRay = normalize(vWorldDirection);
  vec3 ray = normalize(vViewDirection);
  // The camera looks down at a curved meadow: visible sky rays also point
  // below world Y=0. Compose the distant sky in the camera's view instead.
  float screenY = ray.y / -ray.z * 60.0 / uViewHalfSize.y;
  float skyV = smoothstep(0.52, 1.0, screenY);
  vec3 skyColor = mix(uSkyBottomColor, uSkyTopColor, skyV * 0.65);
  skyColor = mix(uHazeColor, skyColor, smoothstep(0.35, 0.65, screenY));

  float sunDot = max(0.0, dot(worldRay, uSunDirection));
  if (uIsNight < 0.5) {
    float sunDisc = smoothstep(0.9992, 0.9998, sunDot);
    skyColor += uSunColor * (sunDisc * 3.5 + pow(sunDot, 18.0) * 0.35);
  } else {
    float moonDisc = smoothstep(0.9986, 0.9996, sunDot);
    skyColor += uSunColor * (moonDisc * 2.4 + pow(sunDot, 24.0) * 0.35);
    if (screenY > 0.55) {
      vec3 starCoord = floor(worldRay * 260.0);
      float starHash = fract(sin(dot(starCoord, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
      if (starHash > 0.988) {
        float twinkle = sin(uTime * 3.0 + starHash * 100.0) * 0.5 + 0.5;
        skyColor += vec3(0.88, 0.94, 1.0) * ((starHash - 0.988) / 0.012) * twinkle * 0.9;
      }
    }
  }

  vec3 color = skyColor;
  for (int cloud = 0; cloud < 4; cloud++) {
    vec3 center = uClouds[cloud].xyz;
    float scale = uClouds[cloud].w;
    // Intersect a bounding sphere first; blue-sky pixels skip the raymarch.
    vec3 sphereCenter = center + vec3(0.0, 0.4 * scale, 0.0);
    float along = dot(ray, sphereCenter);
    float discriminant = along * along - dot(sphereCenter, sphereCenter) + 9.0 * scale * scale;
    if (discriminant <= 0.0) continue;
    float halfSpan = sqrt(discriminant);
    float stepSize = 2.0 * halfSpan / 40.0;
    float t = along - halfSpan + stepSize * 0.5;
    float transmittance = 1.0;
    vec3 accumulated = vec3(0.0);

    for (int step = 0; step < 40; step++) {
      vec3 p = (ray * t - center) / scale;
      // Slightly different proportions keep the four silhouettes varied.
      p.x += sin(float(cloud) * 2.3) * p.y * 0.16;
      float density = cloudDensity(p);
      if (density > 0.001) {
        float lightDepth = cloudDensity(p + uCloudLightDirection * 0.65);
        float heightLight = smoothstep(-0.65, 1.8, p.y);
        float lighting = clamp(0.28 + heightLight * 0.55 + (1.0 - lightDepth) * 0.25, 0.0, 1.0);
        vec3 cloudColor = mix(uCloudBottomColor, uCloudTopColor, lighting);
        cloudColor += uSunColor * ((1.0 - lightDepth) * 0.08);
        float opacity = 1.0 - exp(-density * stepSize / scale * 3.8);
        accumulated += transmittance * cloudColor * opacity;
        transmittance *= 1.0 - opacity;
        if (transmittance < 0.01) break;
      }
      t += stepSize;
    }
    // Use the scene's fog at the cloud depth, not at the enclosing sky sphere.
    // Preserve cloud opacity and clear sky while softening distant contrast.
    #ifdef USE_FOG
      float cloudDepth = -center.z;
      #ifdef FOG_EXP2
        float cloudFog = 1.0 - exp(-fogDensity * fogDensity * cloudDepth * cloudDepth);
      #else
        float cloudFog = smoothstep(fogNear, fogFar, cloudDepth);
      #endif
      accumulated = mix(accumulated, fogColor * (1.0 - transmittance), cloudFog);
    #endif
    color = accumulated + color * transmittance;
  }

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`

export class SkyRenderer {
  readonly mesh: THREE.Mesh
  private readonly material: THREE.ShaderMaterial
  private driftTime = 0

  constructor() {
    this.material = new THREE.ShaderMaterial({
      name: 'VolumetricSdfSky',
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uCloudLightDirection: { value: new THREE.Vector3() },
        uClouds: { value: CLOUD_LAYOUT.map(() => new THREE.Vector4()) },
        uViewHalfSize: { value: new THREE.Vector2() },
        uSkyTopColor: { value: new THREE.Color() },
        uSkyBottomColor: { value: new THREE.Color() },
        uCloudTopColor: { value: new THREE.Color() },
        uCloudBottomColor: { value: new THREE.Color() },
        uHazeColor: { value: new THREE.Color() },
        uTime: { value: 0 },
        uIsNight: { value: 0.0 },
      },
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: true,
    })

    const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.renderOrder = -1000
    this.mesh.frustumCulled = false
  }

  setTime(time: TimeOfDay, sunPosition: THREE.Vector3) {
    const uniforms = this.material.uniforms
    const sunDir = uniforms.uSunDirection.value as THREE.Vector3
    const sunCol = uniforms.uSunColor.value as THREE.Color
    const skyTop = uniforms.uSkyTopColor.value as THREE.Color
    const skyBottom = uniforms.uSkyBottomColor.value as THREE.Color
    const cloudTop = uniforms.uCloudTopColor.value as THREE.Color
    const cloudBottom = uniforms.uCloudBottomColor.value as THREE.Color
    const haze = uniforms.uHazeColor.value as THREE.Color

    if (time === 'day') {
      sunDir.copy(sunPosition).normalize()
      sunCol.set('#fff6dc')
      skyTop.set('#2672be') // Rich, vibrant sky blue
      skyBottom.set('#9dd4ea') // Soft azure cyan at horizon
      cloudTop.set('#ffffff') // Brilliant white cumulus highlight
      cloudBottom.set('#9eb8cc') // Crisp blue-grey ambient shadow
      haze.set('#bce2ee') // Soft airy sky haze
      uniforms.uIsNight.value = 0.0
    } else if (time === 'golden') {
      sunDir.set(-28, 12, 18).normalize()
      sunCol.set('#ff9638')
      skyTop.set('#422b54') // Dusky twilight violet
      skyBottom.set('#f6a564') // Warm glowing amber horizon
      cloudTop.set('#ffe4ca') // Golden peach highlights
      cloudBottom.set('#633c5e') // Deep mauve shadows
      haze.set('#f8be8e')
      uniforms.uIsNight.value = 0.0
    } else {
      sunDir.set(18, 32, -15).normalize()
      sunCol.set('#b9cddd')
      skyTop.set('#0b1420') // Deep midnight indigo
      skyBottom.set('#1d3244')
      cloudTop.set('#475e72') // Moonlight silver
      cloudBottom.set('#141f2a')
      haze.set('#2a4456')
      uniforms.uIsNight.value = 1.0
    }
  }

  update(
    camera: THREE.PerspectiveCamera,
    focus: THREE.Vector2,
    elapsed: number,
    dt: number,
    reducedMotion: boolean,
  ) {
    this.mesh.position.copy(camera.position)
    this.material.uniforms.uTime.value = elapsed

    if (!reducedMotion) this.driftTime += dt

    const halfHeight =
      CLOUD_DEPTH *
      Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2))
    const halfWidth = halfHeight * camera.aspect
    const scale = Math.min(halfHeight * 0.075, halfWidth * 0.072)
    const uniforms = this.material.uniforms
    ;(uniforms.uViewHalfSize.value as THREE.Vector2).set(halfWidth, halfHeight)
    const clouds = uniforms.uClouds.value as THREE.Vector4[]
    CLOUD_LAYOUT.forEach(([x, y, size], index) => {
      // Use the smoothed meadow focus so panning and following cats share the
      // same parallax, without mistaking the camera's zoom offset for a pan.
      // Larger clouds shift a little more, suggesting different distances.
      const parallaxX = -focus.x * CLOUD_PARALLAX_X * size
      const parallaxY = -focus.y * CLOUD_PARALLAX_Y * size
      const drift = Math.sin(this.driftTime * 0.035 + index * 1.7) * 0.025
      clouds[index].set(
        (x + drift + parallaxX) * halfWidth,
        (y + parallaxY) * halfHeight,
        -CLOUD_DEPTH,
        scale * size,
      )
    })
    ;(uniforms.uCloudLightDirection.value as THREE.Vector3)
      .copy(uniforms.uSunDirection.value as THREE.Vector3)
      .transformDirection(camera.matrixWorldInverse)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
