import * as THREE from 'three'
import { bendMaterial } from './materials'
import type { BendUniforms } from './materials'
import { FENCE_BOUNDS } from './geography'
import { creekX, meadowPathX } from './terrain'

export { FENCE_BOUNDS } from './geography'

export function createBoundaryFence(bend: BendUniforms) {
  const group = new THREE.Group()
  group.name = 'boundary-fence'
  const timber = '#ad8968'
  const railColor = '#bc9b77'
  const sage = '#708c79'
  const stone = '#9dA38c'
  const iron = '#626958'
  const boxes: { matrix: THREE.Matrix4; color: string }[] = []
  const caps: { matrix: THREE.Matrix4; color: string }[] = []
  const dummy = new THREE.Object3D()
  const beamAxis = new THREE.Vector3(1, 0, 0)

  const box = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: string,
  ) => {
    dummy.position.set(x, y, z)
    dummy.quaternion.identity()
    dummy.scale.set(width, height, depth)
    dummy.updateMatrix()
    boxes.push({ matrix: dummy.matrix.clone(), color })
  }
  const beam = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    color = railColor,
    thickness = 0.19,
  ) => {
    const direction = end.clone().sub(start)
    dummy.position.copy(start).add(end).multiplyScalar(0.5)
    dummy.quaternion.setFromUnitVectors(beamAxis, direction.clone().normalize())
    dummy.scale.set(direction.length(), thickness, 0.22)
    dummy.updateMatrix()
    boxes.push({ matrix: dummy.matrix.clone(), color })
  }
  const posts = new Set<string>()
  const post = (x: number, z: number, grand = false) => {
    const key = `${x.toFixed(3)},${z.toFixed(3)}`
    if (posts.has(key)) return
    posts.add(key)
    const height = grand ? 2.25 : 1.85 + Math.sin(x * 0.8 + z) * 0.055
    const width = grand ? 0.48 : 0.34
    box(x, height / 2, z, width, height, width, timber)
    box(x, 0.13, z, width + 0.2, 0.26, width + 0.2, stone)
    box(x, height - 0.12, z, width + 0.07, 0.13, width + 0.07, sage)
    dummy.position.set(x, height + 0.1, z)
    dummy.rotation.set(0, Math.PI / 4, 0)
    // A four-sided, overhanging cap gives the posts a readable silhouette at 480p.
    dummy.scale.set(width * 0.95, 0.24, width * 0.95)
    dummy.updateMatrix()
    caps.push({ matrix: dummy.matrix.clone(), color: sage })
  }
  const run = (x1: number, z1: number, x2: number, z2: number) => {
    const panels = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 3.4)
    const start = new THREE.Vector3(x1, 0, z1)
    const end = new THREE.Vector3(x2, 0, z2)
    for (let i = 0; i <= panels; i++) {
      const a = start.clone().lerp(end, i / panels)
      post(a.x, a.z)
      if (i === panels) break
      const b = start.clone().lerp(end, (i + 1) / panels)
      for (const y of [0.62, 1.36]) beam(a.clone().setY(y), b.clone().setY(y))
      if (i % 4 === 1) {
        beam(a.clone().setY(0.62), b.clone().setY(1.36), timber, 0.13)
        beam(a.clone().setY(1.36), b.clone().setY(0.62), timber, 0.13)
      }
    }
  }
  const gate = (center: number, z: number) => {
    const half = 2.9
    post(center - half, z, true)
    post(center + half, z, true)
    for (const side of [-1, 1]) {
      const outer = center + side * (half - 0.3)
      const inner = center + side * 0.09
      for (const y of [0.5, 1.45])
        beam(
          new THREE.Vector3(outer, y, z),
          new THREE.Vector3(inner, y, z),
          sage,
        )
      for (const x of [outer, inner]) box(x, 0.98, z, 0.16, 1.1, 0.24, sage)
      beam(
        new THREE.Vector3(outer, 0.5, z),
        new THREE.Vector3(inner, 1.45, z),
        sage,
        0.15,
      )
      for (const y of [0.6, 1.36])
        box(outer + side * 0.13, y, z, 0.32, 0.1, 0.3, iron)
    }
    box(center, 1.13, z + 0.15, 0.5, 0.12, 0.1, '#aa925e')
  }

  const { minX, maxX, minZ, maxZ } = FENCE_BOUNDS
  for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) post(x, z, true)
  for (const z of [minZ, maxZ]) {
    const path = meadowPathX(z)
    const creek = creekX(z)
    gate(path, z)
    post(creek - 5, z, true)
    post(creek + 5, z, true)
    run(minX, z, path - 2.9, z)
    run(path + 2.9, z, creek - 5, z)
    run(creek + 5, z, maxX, z)
    // Span the water from bank to bank, leaving the channel and its flow open.
    for (const y of [1.05, 1.65])
      beam(
        new THREE.Vector3(creek - 5, y, z),
        new THREE.Vector3(creek + 5, y, z),
      )
  }
  run(minX, minZ, minX, maxZ)
  run(maxX, minZ, maxX, maxZ)

  const material = bendMaterial(
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }),
    bend,
  )
  const color = new THREE.Color()
  for (const [name, geometry, parts] of [
    // Subdivided rails follow the curved ground, including the long creek spans.
    ['timber', new THREE.BoxGeometry(1, 1, 1, 4, 1, 1), boxes],
    ['caps', new THREE.ConeGeometry(1, 1, 4), caps],
  ] as const) {
    const mesh = new THREE.InstancedMesh(geometry, material, parts.length)
    mesh.name = `boundary-fence-${name}`
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    for (const [index, part] of parts.entries()) {
      mesh.setMatrixAt(index, part.matrix)
      mesh.setColorAt(index, color.set(part.color))
    }
    group.add(mesh)
  }
  return group
}
