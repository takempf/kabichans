import * as THREE from 'three'
import { createCafeScenery } from './cafe'
import { createBoundaryFence } from './fence'
import {
  bendMaterial,
  canvasTexture,
  shadowTexture,
} from './materials'
import type { BendUniforms } from './materials'
import { createGrassMaterial } from './grassMaterial'
import { houses, randomSeed, trees } from './simulation'
import {
  isWalkable as isOpenGround,
  onPicnicBlanket,
  picnicBlankets,
  rocks,
  WORLD,
} from './geography'
import type { PicnicBlanket } from './geography'
import {
  BRIDGE,
  CREEK_WIDTH,
  creekX,
  flowerPatches,
  meadowPathX,
  groundHeight,
} from './terrain'

// Flowers grow on open ground, not through the picnic blankets.
const isWalkable = (x: number, z: number, clearance: number) =>
  isOpenGround(x, z, clearance) &&
  picnicBlankets.every((blanket) => !onPicnicBlanket(blanket, x, z, -0.3))

// A lumpy boulder: displacement depends only on position, so the shared
// corners of neighboring faces stay together and the facets read as stone.
function boulderGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 2)
  const positions = geometry.attributes.position
  const point = new THREE.Vector3()
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i)
    const bump =
      1 +
      0.1 * Math.sin(point.x * 3.1 + seed) * Math.cos(point.z * 2.7 - seed) +
      0.07 * Math.sin(point.y * 4.3 + point.x * 1.9 + seed * 2)
    point.multiplyScalar(bump)
    // A flat, settled bottom.
    if (point.y < -0.35) point.y = -0.35
    positions.setXYZ(i, point.x, point.y, point.z)
  }
  geometry.computeVertexNormals()
  return geometry
}

// Checked picnic cloth: stripes both ways, darker where they cross.
function ginghamTexture(color: string) {
  const texture = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#f8f0dc'
    ctx.fillRect(0, 0, 64, 64)
    ctx.globalAlpha = 0.6
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 32, 64)
    ctx.fillRect(0, 0, 64, 32)
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  return texture
}

export function createScenery(bend: BendUniforms) {
  const group = new THREE.Group()
  const random = randomSeed(43)
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const sphere = new THREE.SphereGeometry(1, 16, 12)
  const material = (color: string) => {
    if (!materials.has(color))
      materials.set(
        color,
        bendMaterial(
          new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
          bend,
        ),
      )
    return materials.get(color)!
  }
  const add = (
    geometry: THREE.BufferGeometry,
    color: string,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Group = group,
  ) => {
    const mesh = new THREE.Mesh(geometry, material(color))
    mesh.position.set(x, y, z)
    mesh.frustumCulled = false
    parent.add(mesh)
    return mesh
  }
  const ball = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: string,
    parent = group,
  ) => {
    const mesh = add(sphere, color, x, y, z, parent)
    mesh.scale.set(sx, sy, sz)
    return mesh
  }
  const grassMaterial = createGrassMaterial(bend)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260, 180, 180).rotateX(-Math.PI / 2),
    grassMaterial,
  )
  ground.frustumCulled = false
  group.add(ground)
  const shadowMaterial = bendMaterial(
    new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    }),
    bend,
  )
  const shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const shadow = (x: number, z: number, sx: number, sz: number) => {
    const mesh = new THREE.Mesh(shadowGeometry, shadowMaterial)
    mesh.position.set(x, 0.035, z)
    mesh.scale.set(sx, 1, sz)
    mesh.frustumCulled = false
    group.add(mesh)
  }

  // The path is a ribbon with enough subdivisions to follow the barrel deformation.
  const ribbon = (
    getX: (z: number) => number,
    width: number,
    color: string,
    height: number,
    start = -115,
    end = 95,
  ) => {
    const vertices: number[] = [],
      indices: number[] = []
    for (let i = 0; i <= 180; i++) {
      const z = start + ((end - start) * i) / 180,
        x = getX(z)
      vertices.push(x - width / 2, height, z, x + width / 2, height, z)
      if (i < 180) {
        const k = i * 2
        indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return add(geo, color)
  }
  ribbon(meadowPathX, 4.9, '#ded5a4', 0.045)
  ribbon(meadowPathX, 4.25, '#e6dcb1', 0.051)
  ribbon(creekX, 9, '#e3d9b0', 0.048)
  ribbon(creekX, CREEK_WIDTH, '#70c6bf', 0.059)
  ribbon(creekX, 5.7, '#76cfc8', 0.067)
  for (let i = 0; i < 55; i++) {
    const z = -65 + random() * 110,
      x = creekX(z) + (random() - 0.5) * 5
    const ripple = add(
      new THREE.PlaneGeometry(0.4 + random() * 1.3, 0.055).rotateX(
        -Math.PI / 2,
      ),
      '#b1e2d5',
      x,
      0.08,
      z,
    )
    ripple.rotation.y = -0.1
  }

  for (const [index, tree] of trees.entries()) {
    const { x, z } = tree,
      size = 0.9 + (index % 3) * 0.1
    const treeGroup = new THREE.Group()
    treeGroup.position.set(x, 0, z)
    treeGroup.scale.setScalar(size)
    group.add(treeGroup)
    shadow(x + 0.7, z + 0.3, 7.5, 5.3)
    add(
      new THREE.CylinderGeometry(0.27, 0.48, 3.1, 10),
      '#968064',
      0,
      1.5,
      0,
      treeGroup,
    )
    const branch = add(
      new THREE.CylinderGeometry(0.15, 0.22, 1.5, 8),
      '#968064',
      0.45,
      2.6,
      0,
      treeGroup,
    )
    branch.rotation.z = -0.65
    ball(-1.15, 3.3, 0, 1.7, 1.45, 1.6, '#83b76e', treeGroup)
    ball(1.1, 3.65, 0.15, 1.7, 1.55, 1.65, '#95c479', treeGroup)
    ball(-0.25, 4.5, -0.25, 1.85, 1.65, 1.7, '#a2ca7b', treeGroup)
    ball(-0.55, 4.55, 0.85, 1.1, 1.05, 0.9, '#b0d58b', treeGroup)
    if (index % 3 === 0) {
      for (const [fx, fy, fz] of [
        [-1.5, 3.1, 1.3],
        [0.7, 4.0, 1.55],
        [1.9, 3.2, 0.8],
      ]) {
        ball(fx, fy, fz, 0.24, 0.26, 0.24, '#e7ac75', treeGroup)
        add(
          new THREE.CylinderGeometry(0.02, 0.03, 0.16, 5),
          '#776e4e',
          fx,
          fy + 0.26,
          fz,
          treeGroup,
        )
      }
    }
  }

  // Instanced flowers keep the meadow detailed without hundreds of draw calls.
  interface FlowerInstance {
    x: number
    z: number
    color: string
    scale: number
    angle: number
  }

  const flowerRandom = randomSeed(77)
  const flowers: FlowerInstance[] = []

  const patchConfigs = flowerPatches.map((patch) => {
    const driftAngle = flowerRandom() * Math.PI * 2
    const satDist = 2.2 + flowerRandom() * 1.4
    return {
      ...patch,
      driftAngle,
      satX: patch.x + Math.cos(driftAngle) * satDist,
      satZ: patch.z + Math.sin(driftAngle) * satDist,
    }
  })

  // 1. Clumped flowers with organic radial falloff and trailing satellite sub-clusters
  for (let p = 0; p < patchConfigs.length; p++) {
    const cfg = patchConfigs[p]
    const baseColor = p % 3 === 0 ? '#f0bbc0' : '#fff5df'
    const patchFlowerCount = 26
    for (let i = 0; i < patchFlowerCount; i++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const useSatellite = flowerRandom() < 0.28
        const cx = useSatellite ? cfg.satX : cfg.x
        const cz = useSatellite ? cfg.satZ : cfg.z
        const u = flowerRandom()
        const r = Math.pow(u, 1.6) * (useSatellite ? 2.2 : 3.6)
        const angle = flowerRandom() * Math.PI * 2
        const stretch = 1 + 0.3 * Math.cos(angle - cfg.driftAngle)
        const x = cx + Math.cos(angle) * r * stretch
        const z = cz + Math.sin(angle) * r

        if (
          isWalkable(x, z, 0.35) &&
          Math.abs(x - meadowPathX(z)) > 2.6 &&
          Math.hypot(x - -11.0, z - 1.5) > 9.8
        ) {
          const colorRoll = flowerRandom()
          const color =
            colorRoll < 0.82
              ? baseColor
              : colorRoll < 0.94
                ? baseColor === '#f0bbc0'
                  ? '#fff5df'
                  : '#f0bbc0'
                : '#fff1c7'
          flowers.push({
            x,
            z,
            color,
            scale: 0.84 + flowerRandom() * 0.28,
            angle: flowerRandom() * Math.PI * 2,
          })
          break
        }
      }
    }
  }

  // 2. Scattered flowers outside clump areas across the meadow
  const targetScattered = 140
  let attempts = 0
  const clumpCount = flowers.length
  while (flowers.length - clumpCount < targetScattered && attempts < 1000) {
    attempts++
    const x = WORLD.minX + 3 + flowerRandom() * (WORLD.maxX - WORLD.minX - 6)
    const z = WORLD.minZ + 3 + flowerRandom() * (WORLD.maxZ - WORLD.minZ - 6)

    const distToPatch = Math.min(
      ...patchConfigs.map((p) => Math.hypot(x - p.x, z - p.z)),
    )
    if (distToPatch < 3.8) continue

    if (
      isWalkable(x, z, 0.35) &&
      Math.abs(x - meadowPathX(z)) > 2.6 &&
      Math.hypot(x - -11.0, z - 1.5) > 9.8
    ) {
      const groupCount =
        flowerRandom() < 0.45 ? (flowerRandom() < 0.3 ? 3 : 2) : 1
      const colorRoll = flowerRandom()
      const color =
        colorRoll < 0.72 ? '#fff5df' : colorRoll < 0.9 ? '#f0bbc0' : '#fff1c7'

      for (let g = 0; g < groupCount; g++) {
        const gx = g === 0 ? x : x + (flowerRandom() - 0.5) * 1.1
        const gz = g === 0 ? z : z + (flowerRandom() - 0.5) * 1.1
        if (
          isWalkable(gx, gz, 0.3) &&
          Math.abs(gx - meadowPathX(gz)) > 2.5 &&
          Math.hypot(gx - -11.0, gz - 1.5) > 9.8
        ) {
          flowers.push({
            x: gx,
            z: gz,
            color,
            scale: 0.82 + flowerRandom() * 0.3,
            angle: flowerRandom() * Math.PI * 2,
          })
        }
      }
    }
  }

  const flowerCount = flowers.length
  const flowerGeo = new THREE.SphereGeometry(1, 6, 4)
  const petals = new THREE.InstancedMesh(
    flowerGeo,
    material('#fff8df'),
    flowerCount * 5,
  )
  const centers = new THREE.InstancedMesh(
    flowerGeo,
    material('#e7bd66'),
    flowerCount,
  )
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.018, 0.02, 0.25, 4),
    material('#6f9f61'),
    flowerCount,
  )
  const dummy = new THREE.Object3D()
  for (let i = 0; i < flowerCount; i++) {
    const f = flowers[i]
    const s = f.scale
    dummy.position.set(f.x, 0.17 * s, f.z)
    dummy.rotation.set(0, f.angle, 0)
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    stems.setMatrixAt(i, dummy.matrix)

    const flowerColor = new THREE.Color(f.color)
    for (let petal = 0; petal < 5; petal++) {
      const a = f.angle + (petal * Math.PI * 2) / 5
      dummy.position.set(
        f.x + Math.sin(a) * (0.085 * s),
        0.3 * s,
        f.z + Math.cos(a) * (0.085 * s),
      )
      dummy.rotation.set(0, a, 0)
      dummy.scale.set(0.09 * s, 0.045 * s, 0.08 * s)
      dummy.updateMatrix()
      petals.setMatrixAt(i * 5 + petal, dummy.matrix)
      petals.setColorAt(i * 5 + petal, flowerColor)
    }

    dummy.position.set(f.x, 0.33 * s, f.z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(0.055 * s, 0.04 * s, 0.055 * s)
    dummy.updateMatrix()
    centers.setMatrixAt(i, dummy.matrix)
  }
  for (const mesh of [petals, centers, stems]) {
    mesh.frustumCulled = false
    group.add(mesh)
  }

  for (let i = 0; i < 15; i++) {
    const x = -32 + random() * 52,
      z = -35 + random() * 54
    if (Math.abs(x - meadowPathX(z)) < 5) continue
    if (Math.hypot(x - -10.5, z - 1.5) < 7.8) continue
    if (houses.some((house) => Math.hypot(x - house.x, z - house.z) < 6.5))
      continue
    ball(x, 0.2, z, 0.55, 0.4, 0.42, '#bbc2a5')
  }
  // A little picket fence behind the first cottage.
  for (let i = 0; i < 7; i++) {
    const x = houses[0].x - 5.9 + i * 1.3,
      z = houses[0].z - 4.2
    add(new THREE.CylinderGeometry(0.11, 0.12, 1.05, 8), '#e6d8b6', x, 0.52, z)
    ball(x, 1.05, z, 0.12, 0.12, 0.12, '#e6d8b6')
    if (i < 6)
      for (const y of [0.4, 0.8])
        add(new THREE.BoxGeometry(1.3, 0.12, 0.12), '#e6d8b6', x + 0.65, y, z)
  }
  // A wide wooden arch bridge over the creek with safety railings.
  const PLANK_COUNT = 19
  const bridgeSpan = BRIDGE.maxX - BRIDGE.minX
  const plankWidth = bridgeSpan / PLANK_COUNT

  for (let i = 0; i < PLANK_COUNT; i++) {
    const t = (i + 0.5) / PLANK_COUNT
    const x = BRIDGE.minX + (i + 0.5) * plankWidth
    const y = 0.22 + Math.sin(t * Math.PI) * BRIDGE.archHeight
    const slope =
      (Math.PI / bridgeSpan) * BRIDGE.archHeight * Math.cos(t * Math.PI)
    const angle = Math.atan(slope)
    const plankLength = plankWidth / Math.cos(angle) + 0.01

    const plank = add(
      new THREE.BoxGeometry(plankLength, 0.15, BRIDGE.width),
      '#bcab84',
      x,
      y,
      BRIDGE.z,
    )
    plank.rotation.z = angle

    for (const side of [-1, 1]) {
      const zRail = BRIDGE.z + (side * BRIDGE.width) / 2
      if (i % 3 === 0) {
        add(
          new THREE.CylinderGeometry(0.07, 0.08, 0.8, 6),
          '#9e8b67',
          x,
          y + 0.4,
          zRail,
        )
        ball(x, y + 0.82, zRail, 0.08, 0.08, 0.08, '#cbb27a')
      }
      const rail = add(
        new THREE.BoxGeometry(plankLength, 0.06, 0.06),
        '#aa9670',
        x,
        y + 0.68,
        zRail,
      )
      rail.rotation.z = angle
    }
  }
  for (const side of [-1, 1]) {
    const edge = side < 0 ? BRIDGE.minX : BRIDGE.maxX
    const geometry = new THREE.PlaneGeometry(1, BRIDGE.width).rotateX(
      -Math.PI / 2,
    )
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = edge + side * 0.5 + positions.getX(i)
      positions.setXYZ(
        i,
        x,
        groundHeight(x, BRIDGE.z),
        BRIDGE.z + positions.getZ(i),
      )
    }
    geometry.computeVertexNormals()
    add(geometry, '#bcab84')
  }

  // Big boulders across the creek, each with a smaller stone at its foot.
  for (const [index, rock] of rocks.entries()) {
    const color = index % 2 ? '#a7a597' : '#b3afa0'
    shadow(rock.x + 0.5, rock.z + 0.3, rock.radius * 3.4, rock.radius * 2.8)
    const boulder = new THREE.Mesh(
      boulderGeometry(index * 5.3 + 1),
      material(color),
    )
    boulder.position.set(rock.x, rock.radius * 0.42, rock.z)
    boulder.scale.set(rock.radius, rock.radius * 1.25, rock.radius * 0.9)
    boulder.rotation.y = index * 1.3 + 0.4
    boulder.frustumCulled = false
    group.add(boulder)
    const pebble = new THREE.Mesh(
      boulderGeometry(index * 2.1 + 7),
      material('#9d9b8e'),
    )
    const angle = index * 2.4 + 0.9
    pebble.position.set(
      rock.x + Math.sin(angle) * rock.radius * 0.95,
      rock.radius * 0.14,
      rock.z + Math.cos(angle) * rock.radius * 0.95,
    )
    pebble.scale.setScalar(rock.radius * 0.42)
    pebble.frustumCulled = false
    group.add(pebble)
  }

  // Picnic blankets lie flat on the grass along the east bank.
  const blanket = (spread: PicnicBlanket) => {
    const texture = ginghamTexture(spread.color)
    texture.repeat.set(spread.width / 0.5, spread.depth / 0.5)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(spread.width, spread.depth, 8, 6).rotateX(
        -Math.PI / 2,
      ),
      bendMaterial(
        new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
        bend,
      ),
    )
    mesh.position.set(spread.x, 0.07, spread.z)
    mesh.rotation.y = spread.angle
    mesh.frustumCulled = false
    group.add(mesh)
  }
  for (const spread of picnicBlankets) blanket(spread)

  group.add(createCafeScenery(bend))
  group.add(createBoundaryFence(bend))
  return { group, grassMaterial }
}
