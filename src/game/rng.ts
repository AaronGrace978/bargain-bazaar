/** Deterministic RNG so a night market can be replayed and tested. */

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(parts: readonly number[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    hash ^= part | 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
