export const meadowPathX = (z: number) => Math.sin(z * 0.09) * 5 - 1
export const creekX = (z: number) =>
  21.2 - Math.min(0, z + 5) * 0.36 + Math.sin(z * 0.068) * 1.8
export const CREEK_WIDTH = 7.1
export const BRIDGE = {
  minX: 16.5,
  maxX: 25.5,
  z: -1,
  width: 6.8,
  archHeight: 0.75,
}

export function isDryGround(x: number, z: number, clearance: number) {
  // Account for the bank's slope when clearing a circular footprint.
  return (
    Math.abs(x - creekX(z)) > CREEK_WIDTH / 2 + clearance * 1.025 ||
    Math.abs(z - BRIDGE.z) + clearance <= BRIDGE.width / 2
  )
}

export function groundHeight(x: number, z: number) {
  if (Math.abs(z - BRIDGE.z) > BRIDGE.width / 2) return 0
  const endHeight = 0.295
  if (x < BRIDGE.minX) return endHeight * Math.max(0, 1 - (BRIDGE.minX - x))
  if (x > BRIDGE.maxX) return endHeight * Math.max(0, 1 - (x - BRIDGE.maxX))
  const t = Math.max(
    0,
    Math.min(1, (x - BRIDGE.minX) / (BRIDGE.maxX - BRIDGE.minX)),
  )
  return endHeight + Math.sin(t * Math.PI) * BRIDGE.archHeight
}

export const flowerPatches = [
  { x: -13, z: 8 },
  { x: 12, z: 6 },
  { x: -20, z: -4 },
  { x: 16, z: -5 },
  { x: -8, z: -14 },
  { x: 8, z: -9 },
  { x: -29, z: 14 },
  { x: 19, z: -24 },
]
export const MEADOW_COLOR = '#9fc875'
