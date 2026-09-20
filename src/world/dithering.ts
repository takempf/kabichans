import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

export class PsxDithering {
  private source = new THREE.FramebufferTexture(1, 1)
  private material = new THREE.ShaderMaterial({
    name: 'PSX ordered dithering',
    uniforms: { tScene: { value: this.source } },
    // The framebuffer already contains tone-mapped sRGB colors. Process those
    // display values directly, without applying lighting or gamma a second time.
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene;
      varying vec2 vUv;

      const float bayer[16] = float[16](
         0.0,  8.0,  2.0, 10.0,
        12.0,  4.0, 14.0,  6.0,
         3.0, 11.0,  1.0,  9.0,
        15.0,  7.0, 13.0,  5.0
      );

      void main() {
        vec3 color = texture2D(tScene, vUv).rgb;
        // Anchor the pattern to the 480p buffer, not CSS pixels or animation time.
        ivec2 pixel = ivec2(mod(gl_FragCoord.xy, 4.0));
        float threshold = (bayer[pixel.y * 4 + pixel.x] + 0.5) / 16.0;
        vec3 quantized = floor(clamp(color, 0.0, 1.0) * 31.0 + threshold) / 31.0;
        gl_FragColor = vec4(quantized, 1.0);
      }
    `,
  })
  private quad = new FullScreenQuad(this.material)

  setSize(width: number, height: number) {
    if (
      this.source.image.width === width &&
      this.source.image.height === height
    )
      return
    this.source.dispose()
    this.source = new THREE.FramebufferTexture(width, height)
    this.material.uniforms.tScene.value = this.source
  }

  render(renderer: THREE.WebGLRenderer) {
    // Copy after all scenery, transparency and sky have been composited. The
    // texture has no color-space conversion and uses nearest-neighbor sampling.
    renderer.copyFramebufferToTexture(this.source)
    this.quad.render(renderer)
  }

  dispose() {
    this.source.dispose()
    this.material.dispose()
    this.quad.dispose()
  }
}
