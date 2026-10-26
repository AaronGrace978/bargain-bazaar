/** Seated stall layout. The player origin is the floor; eyes sit near 1.2 m. */

export const LAYOUT = {
  tableY: 0.74,
  tableZ: -0.7,
  beadY: 0.95,
  beadZ: -0.33,
  beadMinX: -0.26,
  beadMaxX: 0.26,
  merchant: { x: 0, y: 0, z: -1.18 },
  dialogue: { x: 0, y: 1.66, z: -0.98, w: 0.98, h: 0.36 },
  spirit: { x: -0.62, y: 1.16, z: -0.55, w: 0.46, h: 0.52, yaw: 0.28 },
  market: { x: 0.62, y: 1.16, z: -0.55, w: 0.46, h: 0.52, yaw: -0.28 },
  sigilY: 0.84,
  sigilZ: -0.34,
  referee: { x: 0.18, y: 1.28, z: -0.78 },
} as const;
