import {
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  createScenePrimitiveObject,
} from '@iwsdk/core';

/** Dark plaza tiles. No DOM, so the floor can be built before the document paints. */
export function createMarketFloor(size = 16): Group {
  const tiles = createTileTexture();
  tiles.wrapS = tiles.wrapT = RepeatWrapping;
  tiles.repeat.set(size / 1.2, size / 1.2);
  const floor = createScenePrimitiveObject(
    { geometry: { type: 'plane', size: [size, size] } },
    new MeshStandardMaterial({ map: tiles, roughness: 0.92, metalness: 0.04 }),
  );
  floor.rotation.x = -Math.PI / 2;
  const root = new Group();
  root.add(floor);
  return root;
}

function createTileTexture(size = 128): DataTexture {
  const clay = [28, 16, 22];
  const line = [168, 124, 62];
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const edge = x < 3 || y < 3 || x > size - 4 || y > size - 4;
      const index = (y * size + x) * 4;
      const source = edge ? line : clay;
      pixels[index] = source[0];
      pixels[index + 1] = source[1];
      pixels[index + 2] = source[2];
      pixels[index + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
