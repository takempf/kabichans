import * as THREE from 'three'
import { bendMaterial, canvasTexture, shadowTexture } from './materials'
import type { BendUniforms } from './materials'
import { groundHeight } from './terrain'
import {
  CAFE_COUNTER_POSITION,
  CAFE_BREAK_BENCH,
  CAFE_TABLES,
  CAFE_TERRACE_CENTER,
  CAFE_TERRACE_RADIUS,
  PATIO_HEIGHT,
  STOOL_CUSHION_HEIGHT,
  TABLE_SURFACE_HEIGHT,
} from './cafeLayout'
import type {
  CafeDeliveredFood,
  CafeFoodType,
  CafeTable,
  CafeWorkerCarriedItem,
} from './cafeLayout'

export * from './cafeLayout'

const CARRIED_ITEM_OFFSET_FORWARD = 0.55
const CARRIED_ITEM_OFFSET_Y = 1.05

function createCafeSignTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#22292f'
    ctx.fillRect(0, 0, 512, 256)
    ctx.strokeStyle = '#cda376'
    ctx.lineWidth = 14
    ctx.strokeRect(10, 10, 492, 236)
    ctx.fillStyle = '#fff6e5'
    ctx.font = "bold 56px 'Geist Variable', 'Geist'"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('KABI CAFE', 256, 88)
    ctx.font = "32px 'Geist Variable', 'Geist'"
    ctx.fillStyle = '#f8b195'
    ctx.fillText('Fresh Cans ~ Churu Lounge', 256, 160)
    ctx.fillStyle = '#ffd166'
    ctx.beginPath()
    ctx.arc(76, 88, 15, 0, Math.PI * 2)
    ctx.arc(436, 88, 15, 0, Math.PI * 2)
    ctx.fill()
  })
}

function buildCanopyCanvas(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    const stripes = 10
    const stripeWidth = 512 / stripes
    const colors = ['#e06349', '#fff7e8']
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = colors[i % 2]
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, 512)
    }
  })
}

type MaterialFactory = (
  color: string,
  roughness?: number,
) => THREE.MeshStandardMaterial

function createMaterialFactory(bend: BendUniforms): MaterialFactory {
  const cache = new Map<string, THREE.MeshStandardMaterial>()
  return (color: string, roughness = 0.92): THREE.MeshStandardMaterial => {
    const key = `${color}-${roughness}`
    if (!cache.has(key)) {
      cache.set(
        key,
        bendMaterial(
          new THREE.MeshStandardMaterial({ color, roughness }),
          bend,
        ),
      )
    }
    return cache.get(key)!
  }
}

type MeshAdder = (
  geo: THREE.BufferGeometry,
  color: string,
  x?: number,
  y?: number,
  z?: number,
  parent?: THREE.Group,
  roughness?: number,
) => THREE.Mesh

function createMeshAdder(
  getMat: MaterialFactory,
  defaultGroup: THREE.Group,
): MeshAdder {
  return (
    geo: THREE.BufferGeometry,
    color: string,
    x = 0,
    y = 0,
    z = 0,
    parent = defaultGroup,
    roughness = 0.92,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, getMat(color, roughness))
    mesh.position.set(x, y, z)
    mesh.frustumCulled = false
    parent.add(mesh)
    return mesh
  }
}

type ShadowAdder = (
  x: number,
  z: number,
  sx: number,
  sz: number,
  y?: number,
  renderOrder?: number,
) => void

function createShadowAdder(
  bend: BendUniforms,
  group: THREE.Group,
): ShadowAdder {
  const shadowMat = bendMaterial(
    new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
    bend,
  )
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  return (
    x: number,
    z: number,
    sx: number,
    sz: number,
    y = 0.032,
    renderOrder = 0,
  ): void => {
    const mesh = new THREE.Mesh(shadowGeo, shadowMat)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, 1, sz)
    mesh.renderOrder = renderOrder
    mesh.frustumCulled = false
    group.add(mesh)
  }
}

function createSubdividedDeckGeometry(
  radiusTop: number,
  radiusBottom: number,
  topY: number,
  bottomY: number,
  radialSegments = 48,
  ringSegments = 16,
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  // Top cap center vertex
  positions.push(0, topY, 0)
  normals.push(0, 1, 0)
  uvs.push(0.5, 0.5)

  // Top cap concentric rings to follow barrel curvature smoothly without chord sag
  for (let r = 1; r <= ringSegments; r++) {
    const frac = r / ringSegments
    const rad = radiusTop * frac
    for (let s = 0; s < radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2
      const x = Math.cos(theta) * rad
      const z = Math.sin(theta) * rad
      positions.push(x, topY, z)
      normals.push(0, 1, 0)
      uvs.push(
        0.5 + 0.5 * frac * Math.cos(theta),
        0.5 + 0.5 * frac * Math.sin(theta),
      )
    }
  }

  // Center fan (counter-clockwise viewed from above)
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments
    indices.push(0, 1 + next, 1 + s)
  }

  // Concentric ring quads (counter-clockwise viewed from above)
  for (let r = 1; r < ringSegments; r++) {
    const curStart = 1 + (r - 1) * radialSegments
    const nextStart = 1 + r * radialSegments
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments
      const c0 = curStart + s
      const c1 = curStart + next
      const n0 = nextStart + s
      const n1 = nextStart + next
      indices.push(c0, c1, n0)
      indices.push(c1, n1, n0)
    }
  }

  // Side rim skirt connecting top cap perimeter into the ground
  const sideTopStart = positions.length / 3
  for (let s = 0; s <= radialSegments; s++) {
    const theta = (s / radialSegments) * Math.PI * 2
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    positions.push(cosT * radiusTop, topY, sinT * radiusTop)
    normals.push(cosT, 0, sinT)
    uvs.push(s / radialSegments, 1)

    positions.push(cosT * radiusBottom, bottomY, sinT * radiusBottom)
    normals.push(cosT, 0, sinT)
    uvs.push(s / radialSegments, 0)
  }

  // Outward-facing side wall triangles
  for (let s = 0; s < radialSegments; s++) {
    const t0 = sideTopStart + s * 2
    const b0 = t0 + 1
    const t1 = t0 + 2
    const b1 = t0 + 3
    indices.push(t0, t1, b0)
    indices.push(t1, b1, b0)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function createDeckTopGeometry(
  radius: number,
  topY: number,
  radialSegments = 48,
  ringSegments = 16,
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  // Top cap center vertex
  positions.push(0, topY, 0)
  normals.push(0, 1, 0)
  uvs.push(0.5, 0.5)

  // Top cap concentric rings matching createSubdividedDeckGeometry
  for (let r = 1; r <= ringSegments; r++) {
    const frac = r / ringSegments
    const rad = radius * frac
    for (let s = 0; s < radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2
      const x = Math.cos(theta) * rad
      const z = Math.sin(theta) * rad
      positions.push(x, topY, z)
      normals.push(0, 1, 0)
      uvs.push(
        0.5 + 0.5 * frac * Math.cos(theta),
        0.5 - 0.5 * frac * Math.sin(theta),
      )
    }
  }

  // Center fan
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments
    indices.push(0, 1 + next, 1 + s)
  }

  // Concentric ring quads
  for (let r = 1; r < ringSegments; r++) {
    const curStart = 1 + (r - 1) * radialSegments
    const nextStart = 1 + r * radialSegments
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments
      const c0 = curStart + s
      const c1 = curStart + next
      const n0 = nextStart + s
      const n1 = nextStart + next
      indices.push(c0, c1, n0)
      indices.push(c1, n1, n0)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function createCafeTerraceShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  const size = 1024
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const { x: cx, z: cz } = CAFE_TERRACE_CENTER
  const rxWorld = CAFE_TERRACE_RADIUS * 1.05
  const rzWorld = CAFE_TERRACE_RADIUS * 1.06

  const toPxX = (x: number): number => size * (0.5 + (x - cx) / (2 * rxWorld))
  const toPxY = (z: number): number => size * (0.5 + (z - cz) / (2 * rzWorld))
  const toPxRadiusX = (r: number): number => (r / rxWorld) * (size / 2)
  const toPxRadiusZ = (r: number): number => (r / rzWorld) * (size / 2)

  const drawBlob = (
    x: number,
    z: number,
    rx: number,
    rz: number,
    rotation = 0,
    opacity = 0.22,
  ): void => {
    ctx.save()
    ctx.translate(toPxX(x), toPxY(z))
    if (rotation !== 0) ctx.rotate(rotation)
    ctx.scale(toPxRadiusX(rx), toPxRadiusZ(rz))
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    grad.addColorStop(0, `rgba(31, 46, 34, ${opacity})`)
    grad.addColorStop(0.5, `rgba(31, 46, 34, ${opacity * 0.4})`)
    grad.addColorStop(1, 'rgba(31, 46, 34, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Kiosk counter shadow directly under the structure
  drawBlob(
    CAFE_COUNTER_POSITION.x,
    CAFE_COUNTER_POSITION.z + 0.2,
    4.4,
    1.4,
    0,
    0.24,
  )

  // Table and stool shadows directly under furniture
  for (const table of CAFE_TABLES) {
    drawBlob(table.x, table.z, 2.0, 2.0, 0, 0.2)
    for (const seat of table.seats) {
      drawBlob(seat.x, seat.z, 0.55, 0.55, 0, 0.16)
    }
  }

  // Break bench shadow directly under bench
  drawBlob(CAFE_BREAK_BENCH.x, -3.8, 1.8, 0.75, CAFE_BREAK_BENCH.heading, 0.18)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildPatioDeck(
  addMesh: MeshAdder,
  addShadow: ShadowAdder,
  group: THREE.Group,
  getMat: MaterialFactory,
  bend: BendUniforms,
): void {
  const { x: cx, z: cz } = CAFE_TERRACE_CENTER
  const r = CAFE_TERRACE_RADIUS
  addShadow(cx, cz, r * 2.3, r * 2.15)
  const deckMat = getMat('#ded0b8', 0.96)
  const deck = new THREE.Mesh(
    createSubdividedDeckGeometry(r, r * 1.05, PATIO_HEIGHT, -0.05, 48, 16),
    deckMat,
  )
  deck.position.set(cx, 0, cz)
  deck.scale.set(1.05, 1, 1.06)
  deck.renderOrder = 1
  deck.frustumCulled = false
  group.add(deck)

  const shadowCatcherMat = bendMaterial(
    new THREE.MeshBasicMaterial({
      map: createCafeTerraceShadowTexture(),
      transparent: true,
      depthWrite: false,
    }),
    bend,
  )
  const shadowCatcher = new THREE.Mesh(
    createDeckTopGeometry(r, PATIO_HEIGHT + 0.001, 48, 16),
    shadowCatcherMat,
  )
  shadowCatcher.position.set(cx, 0, cz)
  shadowCatcher.scale.set(1.05, 1, 1.06)
  shadowCatcher.renderOrder = 2
  shadowCatcher.frustumCulled = false
  group.add(shadowCatcher)

  const border = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.02, 0.22, 8, 44).rotateX(Math.PI / 2),
    getMat('#be9970'),
  )
  border.position.set(cx, PATIO_HEIGHT + 0.015, cz)
  border.scale.set(1.05, 1, 1.06)
  border.renderOrder = 2
  border.frustumCulled = false
  group.add(border)
  buildSteppingStones(addMesh, addShadow)
}

function buildSteppingStones(addMesh: MeshAdder, addShadow: ShadowAdder): void {
  const stones = [
    { x: -2.4, z: 6.2, r: 0.75 },
    { x: -1.2, z: 6.9, r: 0.85 },
    { x: -0.3, z: 6.1, r: 0.7 },
    { x: 0.7, z: 6.8, r: 0.65 },
  ]
  for (const st of stones) {
    const stone = addMesh(
      new THREE.CylinderGeometry(st.r, st.r * 1.06, 0.08, 14),
      '#d3cca8',
      st.x,
      0.04,
      st.z,
    )
    stone.scale.set(1, 0.6, 0.9)
    addShadow(st.x, st.z, st.r * 2.4, st.r * 2.2)
  }
}

function buildKioskStructure(
  addMesh: MeshAdder,
  group: THREE.Group,
  bend: BendUniforms,
): THREE.Group {
  const kioskGroup = new THREE.Group()
  kioskGroup.position.set(CAFE_COUNTER_POSITION.x, 0, CAFE_COUNTER_POSITION.z)
  group.add(kioskGroup)
  addMesh(
    new THREE.BoxGeometry(8.2, 1.4, 0.8),
    '#b0845a',
    0,
    0.7,
    1.3,
    kioskGroup,
  )
  addMesh(
    new THREE.BoxGeometry(8.6, 0.16, 1.0),
    '#684529',
    0,
    1.45,
    1.3,
    kioskGroup,
  )
  addMesh(
    new THREE.BoxGeometry(7.6, 0.85, 0.08),
    '#dfc4a2',
    0,
    0.72,
    1.72,
    kioskGroup,
  )
  addMesh(
    new THREE.BoxGeometry(8.2, 4.4, 0.35),
    '#8d6346',
    0,
    2.2,
    -1.3,
    kioskGroup,
  )
  addMesh(
    new THREE.BoxGeometry(7.8, 0.14, 0.65),
    '#a7764d',
    0,
    2.2,
    -1.0,
    kioskGroup,
  )
  addMesh(
    new THREE.BoxGeometry(7.8, 0.14, 0.65),
    '#a7764d',
    0,
    3.2,
    -1.0,
    kioskGroup,
  )
  buildKioskRoof(addMesh, kioskGroup, bend)
  buildKioskProps(addMesh, kioskGroup)
  return kioskGroup
}

function buildKioskRoof(
  addMesh: MeshAdder,
  kioskGroup: THREE.Group,
  bend: BendUniforms,
): void {
  for (const px of [-3.8, 3.8]) {
    addMesh(
      new THREE.CylinderGeometry(0.14, 0.16, 4.8, 8),
      '#774f33',
      px,
      2.4,
      1.3,
      kioskGroup,
    )
    addMesh(
      new THREE.CylinderGeometry(0.14, 0.16, 4.8, 8),
      '#774f33',
      px,
      2.4,
      -1.3,
      kioskGroup,
    )
  }
  const canopyTex = buildCanopyCanvas()
  const canopyMat = bendMaterial(
    new THREE.MeshStandardMaterial({
      map: canopyTex,
      roughness: 0.88,
      side: THREE.DoubleSide,
    }),
    bend,
  )
  const canopyMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 3.8, 28, 8),
    canopyMat,
  )
  canopyMesh.position.set(0, 5.0, 0.0)
  canopyMesh.rotation.x = -Math.PI / 2 + 0.22
  canopyMesh.frustumCulled = false
  kioskGroup.add(canopyMesh)
  const valanceMat = bendMaterial(
    new THREE.MeshStandardMaterial({ color: '#e06349', roughness: 0.9 }),
    bend,
  )
  const valance = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 0.65, 28, 2),
    valanceMat,
  )
  valance.position.set(0, 4.38, 1.8)
  valance.frustumCulled = false
  kioskGroup.add(valance)
  buildKioskSign(kioskGroup, bend)
}

function buildKioskSign(kioskGroup: THREE.Group, bend: BendUniforms): void {
  const signTex = createCafeSignTexture()
  const signMat = bendMaterial(
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.85 }),
    bend,
  )
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), signMat)
  signMesh.position.set(0, 3.45, 1.82)
  signMesh.frustumCulled = false
  kioskGroup.add(signMesh)
}

function buildKioskProps(addMesh: MeshAdder, kioskGroup: THREE.Group): void {
  const canColors = ['#e76f51', '#2a9d8f', '#e9c46a', '#d94e34', '#3d7068']
  for (let c = 0; c < 9; c++) {
    const canX = -3.2 + c * 0.8
    addMesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.4, 14),
      canColors[c % canColors.length],
      canX,
      2.45,
      -1.0,
      kioskGroup,
      0.6,
    )
    addMesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.05, 14),
      '#e0e4e8',
      canX,
      2.65,
      -1.0,
      kioskGroup,
      0.4,
    )
  }
  for (const jx of [-2.0, 2.0]) {
    addMesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.65, 14),
      '#e2f0f2',
      jx,
      3.55,
      -1.0,
      kioskGroup,
      0.2,
    )
    for (let s = 0; s < 5; s++) {
      const angle = (s * Math.PI) / 3
      const stick = addMesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6),
        '#ff4d6d',
        jx + Math.cos(angle) * 0.1,
        3.7,
        -1.0 + Math.sin(angle) * 0.1,
        kioskGroup,
      )
      stick.rotation.z = 0.2 * Math.cos(angle)
      stick.rotation.x = 0.2 * Math.sin(angle)
    }
  }
  addMesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.18, 14),
    '#f4d06f',
    3.0,
    1.62,
    1.3,
    kioskGroup,
    0.3,
  )
  addMesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    '#ffd166',
    3.0,
    1.74,
    1.3,
    kioskGroup,
    0.3,
  )
  addMesh(
    new THREE.CylinderGeometry(0.28, 0.35, 0.55, 14),
    '#50756c',
    -3.0,
    1.82,
    1.3,
    kioskGroup,
    0.5,
  )
}

function buildOutdoorTable(
  table: CafeTable,
  addMesh: MeshAdder,
  group: THREE.Group,
): void {
  const tableGroup = new THREE.Group()
  tableGroup.position.set(table.x, 0, table.z)
  group.add(tableGroup)
  addMesh(
    new THREE.CylinderGeometry(table.radius, table.radius, 0.12, 30),
    '#dfc199',
    0,
    TABLE_SURFACE_HEIGHT,
    0,
    tableGroup,
  )
  addMesh(
    new THREE.CylinderGeometry(
      table.radius * 1.03,
      table.radius * 1.03,
      0.05,
      30,
    ),
    '#7c5436',
    0,
    TABLE_SURFACE_HEIGHT - 0.06,
    0,
    tableGroup,
  )
  addMesh(
    new THREE.CylinderGeometry(0.15, 0.18, TABLE_SURFACE_HEIGHT - 0.1, 14),
    '#453f3d',
    0,
    (TABLE_SURFACE_HEIGHT - 0.1) / 2,
    0,
    tableGroup,
    0.6,
  )
  const base = addMesh(
    new THREE.CylinderGeometry(0.85, 0.95, 0.12, 24),
    '#383332',
    0,
    PATIO_HEIGHT + 0.02,
    0,
    tableGroup,
    0.6,
  )
  base.renderOrder = 2
  buildTableVase(addMesh, tableGroup)
  buildTableStools(table, addMesh, group)
}

function buildTableVase(addMesh: MeshAdder, tableGroup: THREE.Group): void {
  addMesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.38, 14),
    '#eef1f6',
    0,
    TABLE_SURFACE_HEIGHT + 0.19,
    0,
    tableGroup,
    0.4,
  )
  addMesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    '#e76f51',
    0,
    TABLE_SURFACE_HEIGHT + 0.42,
    0,
    tableGroup,
  )
  addMesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.24, 6),
    '#69995d',
    0,
    TABLE_SURFACE_HEIGHT + 0.32,
    0,
    tableGroup,
  )
}

function buildTableStools(
  table: CafeTable,
  addMesh: MeshAdder,
  group: THREE.Group,
): void {
  const colors = ['#f4a261', '#8ab17d', '#e76f51', '#2a9d8f']
  for (const [seatIdx, seat] of table.seats.entries()) {
    const stoolGroup = new THREE.Group()
    stoolGroup.position.set(seat.x, 0, seat.z)
    group.add(stoolGroup)
    const color = colors[(table.id * 3 + seatIdx) % colors.length]
    addMesh(
      new THREE.CylinderGeometry(0.72, 0.72, 0.16, 24),
      color,
      0,
      STOOL_CUSHION_HEIGHT,
      0,
      stoolGroup,
    )
    addMesh(
      new THREE.CylinderGeometry(0.74, 0.74, 0.05, 24),
      '#6b462b',
      0,
      STOOL_CUSHION_HEIGHT - 0.08,
      0,
      stoolGroup,
    )
    for (const lx of [-0.42, 0.42]) {
      for (const lz of [-0.42, 0.42]) {
        const leg = addMesh(
          new THREE.CylinderGeometry(
            0.065,
            0.08,
            STOOL_CUSHION_HEIGHT - 0.08,
            8,
          ),
          '#6b462b',
          lx,
          (STOOL_CUSHION_HEIGHT - 0.08) / 2,
          lz,
          stoolGroup,
        )
        leg.rotation.x = lz * 0.32
        leg.rotation.z = -lx * 0.32
      }
    }
  }
}

function buildBreakBench(addMesh: MeshAdder, group: THREE.Group): void {
  const benchGroup = new THREE.Group()
  benchGroup.position.set(CAFE_BREAK_BENCH.x, 0, -3.8)
  benchGroup.rotation.y = CAFE_BREAK_BENCH.heading
  group.add(benchGroup)
  addMesh(
    new THREE.BoxGeometry(3.4, 0.16, 1.1),
    '#875b3c',
    0,
    0.58,
    0,
    benchGroup,
  )
  addMesh(
    new THREE.BoxGeometry(3.4, 0.95, 0.12),
    '#6b462b',
    0,
    1.12,
    -0.48,
    benchGroup,
  )
  for (const bx of [-1.45, 1.45]) {
    addMesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.58, 8),
      '#473528',
      bx,
      0.29,
      0.42,
      benchGroup,
    )
    addMesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.58, 8),
      '#473528',
      bx,
      0.29,
      -0.42,
      benchGroup,
    )
  }
}

export function createCafeScenery(bend: BendUniforms): THREE.Group {
  const group = new THREE.Group()
  group.name = 'cafe-scenery'
  const getMat = createMaterialFactory(bend)
  const addMesh = createMeshAdder(getMat, group)
  const addShadow = createShadowAdder(bend, group)

  buildPatioDeck(addMesh, addShadow, group, getMat, bend)
  buildKioskStructure(addMesh, group, bend)
  for (const table of CAFE_TABLES) buildOutdoorTable(table, addMesh, group)
  buildBreakBench(addMesh, group)
  return group
}

export class CafeRenderer {
  readonly group = new THREE.Group()
  private foodMeshes = new Map<number, THREE.Group>()
  private carriedMeshes = new Map<string, THREE.Group>()
  private bend: BendUniforms

  constructor(bend: BendUniforms) {
    this.bend = bend
    this.group.name = 'cafe-dynamic-renderer'
  }

  private createCatCanModel(): THREE.Group {
    const can = new THREE.Group()
    const silverMat = bendMaterial(
      new THREE.MeshStandardMaterial({
        color: '#dbe1e8',
        metalness: 0.65,
        roughness: 0.35,
      }),
      this.bend,
    )
    const labelMat = bendMaterial(
      new THREE.MeshStandardMaterial({ color: '#e76f51', roughness: 0.7 }),
      this.bend,
    )
    const pateMat = bendMaterial(
      new THREE.MeshStandardMaterial({ color: '#b04b40', roughness: 0.95 }),
      this.bend,
    )
    const tin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.32, 22),
      labelMat,
    )
    tin.position.y = 0.16
    can.add(tin)
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.39, 0.39, 0.06, 22),
      silverMat,
    )
    rim.position.y = 0.32
    can.add(rim)
    const pate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.24, 20),
      pateMat,
    )
    pate.position.y = 0.2
    can.add(pate)
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.37, 20), silverMat)
    lid.position.set(0, 0.4, -0.2)
    lid.rotation.x = -Math.PI / 4
    can.add(lid)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.02, 8, 14),
      silverMat,
    )
    ring.position.set(0, 0.47, -0.1)
    ring.rotation.x = -Math.PI / 4
    can.add(ring)
    return can
  }

  private createChuruModel(): THREE.Group {
    const churu = new THREE.Group()
    const pouchMat = bendMaterial(
      new THREE.MeshStandardMaterial({
        color: '#e63946',
        metalness: 0.4,
        roughness: 0.5,
      }),
      this.bend,
    )
    const whiteMat = bendMaterial(
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
      this.bend,
    )
    const creamMat = bendMaterial(
      new THREE.MeshStandardMaterial({ color: '#fef3dc', roughness: 0.95 }),
      this.bend,
    )
    const sachet = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.92),
      pouchMat,
    )
    sachet.position.set(0, 0.025, 0)
    churu.add(sachet)
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.055, 0.25),
      whiteMat,
    )
    band.position.set(0, 0.028, 0.33)
    churu.add(band)
    const dollop = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      creamMat,
    )
    dollop.position.set(0, 0.045, 0.48)
    dollop.scale.set(1.1, 0.7, 1.2)
    churu.add(dollop)
    return churu
  }

  private createCarriedTray(foodType: CafeFoodType): THREE.Group {
    const carrier = new THREE.Group()
    const trayMat = bendMaterial(
      new THREE.MeshStandardMaterial({ color: '#c99b6d', roughness: 0.85 }),
      this.bend,
    )
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.52, 0.06, 22),
      trayMat,
    )
    carrier.add(tray)
    const food =
      foodType === 'cat_can'
        ? this.createCatCanModel()
        : this.createChuruModel()
    food.position.y = 0.035
    carrier.add(food)
    return carrier
  }

  update(
    deliveredFoods: CafeDeliveredFood[],
    carriedItems: CafeWorkerCarriedItem[],
  ): void {
    const activeFoodIds = new Set<number>()
    for (const food of deliveredFoods) {
      activeFoodIds.add(food.id)
      let mesh = this.foodMeshes.get(food.id)
      if (!mesh) {
        mesh =
          food.foodType === 'cat_can'
            ? this.createCatCanModel()
            : this.createChuruModel()
        this.foodMeshes.set(food.id, mesh)
        this.group.add(mesh)
      }
      const y = groundHeight(food.x, food.z) + food.y + 0.02
      mesh.position.set(food.x, y, food.z)
      mesh.rotation.y = food.heading + 0.4
    }
    for (const [id, mesh] of this.foodMeshes.entries()) {
      if (!activeFoodIds.has(id)) {
        this.group.remove(mesh)
        this.foodMeshes.delete(id)
      }
    }
    const activeCarriedIds = new Set<string>()
    for (const item of carriedItems) {
      const key = `${item.catId}-${item.foodType}`
      activeCarriedIds.add(key)
      let mesh = this.carriedMeshes.get(key)
      if (!mesh) {
        mesh = this.createCarriedTray(item.foodType)
        this.carriedMeshes.set(key, mesh)
        this.group.add(mesh)
      }
      const x = item.x + Math.sin(item.heading) * CARRIED_ITEM_OFFSET_FORWARD
      const z = item.z + Math.cos(item.heading) * CARRIED_ITEM_OFFSET_FORWARD
      const y = groundHeight(item.x, item.z) + item.y + CARRIED_ITEM_OFFSET_Y
      mesh.position.set(x, y, z)
      mesh.rotation.y = item.heading
    }
    for (const [id, mesh] of this.carriedMeshes.entries()) {
      if (!activeCarriedIds.has(id)) {
        this.group.remove(mesh)
        this.carriedMeshes.delete(id)
      }
    }
  }

  dispose(): void {
    for (const mesh of this.foodMeshes.values()) {
      this.group.remove(mesh)
    }
    this.foodMeshes.clear()
    for (const mesh of this.carriedMeshes.values()) {
      this.group.remove(mesh)
    }
    this.carriedMeshes.clear()
  }
}
