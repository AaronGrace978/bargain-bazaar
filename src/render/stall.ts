import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import type { Artifact } from '../game/types.js';
import { LAYOUT } from './layout.js';
import { LivePanel, plaqueTexture } from './canvas-panel.js';

export interface Sigil {
  name: string;
  mesh: Mesh;
}

export interface StallView {
  root: Group;
  lanterns: { group: Group; base: number; phase: number }[];
  merchant: Group;
  robe: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  flame: Mesh;
  artifactRoot: Group;
  referee: Group;
  refereeCore: MeshBasicMaterial;
  refereeLight: PointLight;
  ring: MeshStandardMaterial;
  spirit: Group;
  spiritMat: MeshStandardMaterial;
  bead: Mesh;
  lightning: LineSegments;
  lightningMat: LineBasicMaterial;
  dialogue: LivePanel;
  spiritPanel: LivePanel;
  marketPanel: LivePanel;
  sigils: Sigil[];
  merchantLamps: { id: string; mesh: Mesh; material: MeshStandardMaterial }[];
  motes: Points;
}

const wood = new MeshStandardMaterial({ color: '#5a301c', roughness: 0.72, metalness: 0.05 });
const woodDark = new MeshStandardMaterial({ color: '#2c1610', roughness: 0.84, metalness: 0.04 });
const brass = new MeshStandardMaterial({ color: '#d7b56a', roughness: 0.35, metalness: 0.72 });
const lacquer = new MeshStandardMaterial({ color: '#7a1e2c', roughness: 0.42, metalness: 0.18 });
const cloth = new MeshStandardMaterial({ color: '#3b1020', roughness: 0.9, metalness: 0.02 });

export function buildStall(parent: Object3D): StallView {
  const root = new Group();
  root.name = 'bargain-stall';
  parent.add(root);

  root.add(platform(), table(), awning(), cushion());
  const lanterns = hangLanterns(root);
  const merchantBits = buildMerchant();
  root.add(merchantBits.group);
  const artifactRoot = new Group();
  artifactRoot.position.set(0, LAYOUT.tableY + 0.08, LAYOUT.tableZ);
  root.add(artifactRoot);

  const refereeBits = buildReferee();
  root.add(refereeBits.group);
  const spiritBits = buildSpirit();
  root.add(spiritBits.group);

  const bead = new Mesh(new SphereGeometry(0.035, 24, 16), brass.clone());
  bead.castShadow = true;
  bead.name = 'offer-bead';
  root.add(bead);
  root.add(rail());

  const dialogue = new LivePanel(1400, 520, LAYOUT.dialogue.w, LAYOUT.dialogue.h);
  dialogue.mesh.position.set(LAYOUT.dialogue.x, LAYOUT.dialogue.y, LAYOUT.dialogue.z);
  dialogue.mesh.name = 'dialogue-panel';
  root.add(dialogue.mesh);

  const spiritPanel = new LivePanel(1024, 1152, LAYOUT.spirit.w, LAYOUT.spirit.h);
  spiritPanel.mesh.position.set(LAYOUT.spirit.x, LAYOUT.spirit.y, LAYOUT.spirit.z);
  spiritPanel.mesh.rotation.y = LAYOUT.spirit.yaw;
  root.add(spiritPanel.mesh);

  const marketPanel = new LivePanel(1024, 1152, LAYOUT.market.w, LAYOUT.market.h);
  marketPanel.mesh.position.set(LAYOUT.market.x, LAYOUT.market.y, LAYOUT.market.z);
  marketPanel.mesh.rotation.y = LAYOUT.market.yaw;
  root.add(marketPanel.mesh);

  const lightningGeo = new BufferGeometry();
  lightningGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(48), 3));
  const lightningMat = new LineBasicMaterial({ color: '#f4f7ff', transparent: true, opacity: 0 });
  const lightning = new LineSegments(lightningGeo, lightningMat);
  lightning.visible = false;
  lightning.frustumCulled = false;
  root.add(lightning);

  const sigils = buildSigils();
  for (const sigil of sigils) root.add(sigil.mesh);
  const merchantLamps = buildMerchantLamps();
  for (const lamp of merchantLamps) root.add(lamp.mesh);

  const motes = buildMotes();
  root.add(motes);

  return {
    root,
    lanterns,
    merchant: merchantBits.group,
    robe: merchantBits.robe,
    accent: merchantBits.accent,
    flame: merchantBits.flame,
    artifactRoot,
    referee: refereeBits.group,
    refereeCore: refereeBits.core,
    refereeLight: refereeBits.light,
    ring: refereeBits.ring,
    spirit: spiritBits.group,
    spiritMat: spiritBits.material,
    bead,
    lightning,
    lightningMat,
    dialogue,
    spiritPanel,
    marketPanel,
    sigils,
    merchantLamps,
    motes,
  };
}

export function showArtifact(root: Group, artifact: Artifact): void {
  for (const child of [...root.children]) {
    root.remove(child);
  }
  const gold = new MeshStandardMaterial({
    color: '#f0d48a',
    emissive: '#6a4a16',
    emissiveIntensity: 0.35,
    roughness: 0.28,
    metalness: 0.64,
  });
  const glass = new MeshStandardMaterial({
    color: '#d7fff6',
    emissive: '#1a6a62',
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.08,
    transparent: true,
    opacity: 0.85,
  });
  if (artifact.form === 'teapot') {
    const body = new Mesh(new SphereGeometry(0.09, 24, 16), glass);
    body.scale.y = 0.8;
    const lid = new Mesh(new SphereGeometry(0.035, 16, 12), gold);
    lid.position.y = 0.08;
    const handle = new Mesh(new TorusGeometry(0.05, 0.008, 8, 18, Math.PI), gold);
    handle.position.x = 0.09;
    handle.rotation.z = Math.PI / 2;
    root.add(body, lid, handle);
  } else if (artifact.form === 'silk') {
    for (let index = 0; index < 4; index += 1) {
      const fold = new Mesh(new CylinderGeometry(0.07, 0.07, 0.16, 16), new MeshStandardMaterial({
        color: index % 2 === 0 ? '#c4373a' : '#f0a35a',
        roughness: 0.78,
      }));
      fold.rotation.z = Math.PI / 2;
      fold.rotation.y = index * 0.35;
      fold.position.y = index * 0.02;
      root.add(fold);
    }
  } else if (artifact.form === 'astrolabe') {
    const ring = new Mesh(new TorusGeometry(0.09, 0.008, 8, 32), gold);
    const inner = new Mesh(new TorusGeometry(0.055, 0.006, 8, 24), brass);
    inner.rotation.x = 0.6;
    const hub = new Mesh(new SphereGeometry(0.02, 12, 12), gold);
    root.add(ring, inner, hub);
  } else if (artifact.form === 'cage') {
    const bars = new Mesh(new CylinderGeometry(0.055, 0.055, 0.16, 8, 1, true), new MeshStandardMaterial({
      color: '#e7c27a',
      roughness: 0.4,
      metalness: 0.6,
      wireframe: true,
    }));
    const cap = new Mesh(new SphereGeometry(0.03, 12, 8), brass);
    cap.position.y = 0.1;
    root.add(bars, cap);
  } else {
    const pearl = new Mesh(new SphereGeometry(0.07, 28, 20), glass);
    pearl.scale.set(1, 1.15, 1);
    root.add(pearl);
  }
  root.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });
}

export function placeBead(bead: Object3D, offer: number, min: number, max: number): void {
  const span = Math.max(1, max - min);
  const t = Math.min(1, Math.max(0, (offer - min) / span));
  bead.position.set(
    LAYOUT.beadMinX + t * (LAYOUT.beadMaxX - LAYOUT.beadMinX),
    LAYOUT.beadY,
    LAYOUT.beadZ,
  );
}

export function offerFromWorldX(x: number, min: number, max: number): number {
  const t = Math.min(1, Math.max(0, (x - LAYOUT.beadMinX) / (LAYOUT.beadMaxX - LAYOUT.beadMinX)));
  return Math.round(min + t * (max - min));
}

function platform(): Mesh {
  const mesh = new Mesh(new CylinderGeometry(3.4, 3.6, 0.08, 64), new MeshStandardMaterial({
    color: '#1a0d14',
    roughness: 0.92,
    metalness: 0.08,
  }));
  mesh.position.y = 0.02;
  mesh.receiveShadow = true;
  const ring = new Mesh(new TorusGeometry(1.7, 0.015, 8, 80), brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.07;
  mesh.add(ring);
  return mesh;
}

function table(): Group {
  const group = new Group();
  const slab = new Mesh(
    new BoxGeometry(1.24, 0.07, 0.58),
    wood,
  );
  slab.position.set(0, LAYOUT.tableY, LAYOUT.tableZ);
  slab.castShadow = true;
  slab.receiveShadow = true;
  const trim = new Mesh(new BoxGeometry(1.28, 0.015, 0.62), brass);
  trim.position.set(0, LAYOUT.tableY + 0.04, LAYOUT.tableZ);
  group.add(slab, trim);
  for (const x of [-0.5, 0.5]) {
    for (const z of [-0.22, 0.22]) {
      const leg = new Mesh(new CylinderGeometry(0.035, 0.045, 0.74, 10), woodDark);
      leg.position.set(x, 0.37, LAYOUT.tableZ + z);
      leg.castShadow = true;
      group.add(leg);
    }
  }
  return group;
}

function awning(): Group {
  const group = new Group();
  const roof = new Mesh(new BoxGeometry(1.35, 0.025, 0.42), lacquer);
  roof.position.set(0, 2.02, -1.22);
  roof.rotation.x = 0.22;
  const valance = new Mesh(new BoxGeometry(1.35, 0.06, 0.02), lacquer);
  valance.position.set(0, 1.96, -1.02);
  for (const x of [-0.62, 0.62]) {
    const post = new Mesh(new CylinderGeometry(0.022, 0.028, 1.28, 8), woodDark);
    post.position.set(x, 1.32, -1.12);
    group.add(post);
  }
  group.add(roof, valance);
  return group;
}

function cushion(): Mesh {
  const mesh = new Mesh(new CylinderGeometry(0.28, 0.32, 0.08, 20), cloth);
  mesh.position.set(0, 0.08, 0.48);
  mesh.receiveShadow = true;
  return mesh;
}

function rail(): Group {
  const group = new Group();
  const bar = new Mesh(new BoxGeometry(0.62, 0.012, 0.012), brass);
  bar.position.set(0, LAYOUT.beadY - 0.01, LAYOUT.beadZ);
  group.add(bar);
  return group;
}

function hangLanterns(root: Group): StallView['lanterns'] {
  const colors = [0xff9a3c, 0xe23b4a, 0x3ecfb8, 0xffd27a, 0xff6b4a, 0x7ae0ff];
  const lanterns: StallView['lanterns'] = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = Math.PI * 0.15 + (index / 7) * Math.PI * 0.7;
    const radius = 2.15 + (index % 2) * 0.25;
    const group = lantern(colors[index % colors.length]);
    const base = 1.55 + (index % 3) * 0.18;
    group.position.set(Math.sin(angle) * radius, base, -0.4 - Math.cos(angle) * radius);
    root.add(group);
    lanterns.push({ group, base, phase: index * 0.7 });
    if (index % 2 === 0) {
      const light = new PointLight(colors[index % colors.length], 1.4, 3.2, 2);
      light.position.y = -0.02;
      group.add(light);
    }
  }
  return lanterns;
}

function lantern(color: number): Group {
  const group = new Group();
  const paper = new Mesh(new SphereGeometry(0.1, 20, 14), new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    roughness: 0.45,
  }));
  paper.scale.y = 1.25;
  const cap = new Mesh(new CylinderGeometry(0.035, 0.045, 0.03, 10), brass);
  cap.position.y = 0.13;
  const tassel = new Mesh(new SphereGeometry(0.018, 8, 8), brass);
  tassel.position.y = -0.15;
  group.add(paper, cap, tassel);
  return group;
}

function buildMerchant(): {
  group: Group;
  robe: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  flame: Mesh;
} {
  const group = new Group();
  group.position.set(LAYOUT.merchant.x, LAYOUT.merchant.y, LAYOUT.merchant.z);
  const robeMat = new MeshStandardMaterial({ color: '#8d2e32', roughness: 0.78 });
  const accentMat = new MeshStandardMaterial({
    color: '#ffb15a',
    emissive: '#ffb15a',
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.2,
  });
  const robe = new Mesh(new ConeGeometry(0.22, 0.64, 18), robeMat);
  robe.position.y = 0.95;
  robe.castShadow = true;
  const head = new Mesh(new SphereGeometry(0.15, 20, 16), new MeshStandardMaterial({
    color: '#e6c7a8',
    roughness: 0.62,
  }));
  head.position.y = 1.27;
  head.castShadow = true;
  const mask = new Mesh(new TorusGeometry(0.1, 0.018, 8, 24), accentMat);
  mask.position.set(0, 1.27, 0.1);
  const eyeL = new Mesh(new SphereGeometry(0.02, 8, 8), accentMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.05, 1.3, 0.13);
  eyeR.position.set(0.05, 1.3, 0.13);
  const flameMat = new MeshStandardMaterial({
    color: '#ff5a3c',
    emissive: '#ff5a3c',
    emissiveIntensity: 1.4,
  });
  const flame = new Mesh(new ConeGeometry(0.05, 0.16, 8), flameMat);
  flame.position.y = 1.46;
  flame.visible = false;
  group.add(robe, head, mask, eyeL, eyeR, flame);
  return { group, robe: robeMat, accent: accentMat, flame };
}

function buildReferee(): {
  group: Group;
  core: MeshBasicMaterial;
  light: PointLight;
  ring: MeshStandardMaterial;
} {
  const group = new Group();
  group.position.set(LAYOUT.referee.x, LAYOUT.referee.y, LAYOUT.referee.z);
  const coreMat = new MeshBasicMaterial({ color: '#fff4d2' });
  const core = new Mesh(new SphereGeometry(0.035, 16, 12), coreMat);
  const wire = new Mesh(new IcosahedronGeometry(0.07, 0), new MeshBasicMaterial({
    color: '#e7c27a',
    wireframe: true,
  }));
  const ringMat = new MeshStandardMaterial({
    color: '#e7c27a',
    emissive: '#e7c27a',
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.4,
  });
  const ring = new Mesh(new TorusGeometry(0.11, 0.006, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2.4;
  const light = new PointLight('#ffe1a8', 0.8, 1.6, 2);
  group.add(core, wire, ring, light);
  group.name = 'referee-spirit';
  return { group, core: coreMat, light, ring: ringMat };
}

function buildSpirit(): { group: Group; material: MeshStandardMaterial } {
  const group = new Group();
  group.position.set(-0.28, 1.18, -0.7);
  const material = new MeshStandardMaterial({
    color: '#7d5cff',
    emissive: '#3ee0c5',
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.28,
    roughness: 0.25,
  });
  const body = new Mesh(new IcosahedronGeometry(0.09, 0), material);
  const wisp = new Mesh(new SphereGeometry(0.04, 12, 10), material);
  wisp.position.set(0.08, 0.06, 0);
  group.add(body, wisp);
  group.name = 'merchant-spirit';
  return { group, material };
}

const PLAQUES: Record<string, readonly [string, string]> = {
  'sigil-minus': ['-', '1 c'],
  'sigil-offer': ['PINCH', 'Offer'],
  'sigil-palm': ['PALM', 'Counter'],
  'sigil-seal': ['CLASP', 'Seal'],
  'sigil-walk': ['PALM BACK', 'Leave'],
  'sigil-plus': ['+', '1 c'],
  'sigil-away': ['STEP AWAY', 'Spirit trades'],
  'merchant-mei': ['MEI', 'Stock'],
  'merchant-calder': ['CALDER', 'Floor'],
  'merchant-quill': ['QUILL', 'Temper'],
};

function buildSigils(): Sigil[] {
  const specs = [
    ['sigil-minus', -0.5],
    ['sigil-offer', -0.32],
    ['sigil-palm', -0.14],
    ['sigil-seal', 0.04],
    ['sigil-walk', 0.22],
    ['sigil-plus', 0.4],
    ['sigil-away', 0.68],
  ] as const;
  return specs.map(([name, x]) => {
    const copy = PLAQUES[name];
    const wide = name === 'sigil-away';
    const mesh = new Mesh(
      new BoxGeometry(wide ? 0.26 : 0.15, 0.07, 0.012),
      new MeshBasicMaterial({ map: plaqueTexture(copy[0], copy[1]) }),
    );
    mesh.position.set(x, LAYOUT.sigilY, LAYOUT.sigilZ);
    mesh.name = name;
    return { name, mesh };
  });
}

export function refreshPlaques(stall: StallView): void {
  for (const sigil of stall.sigils) {
    repaint(sigil.mesh, PLAQUES[sigil.name]);
  }
  for (const lamp of stall.merchantLamps) {
    const label = lamp.mesh.children[0];
    if (label instanceof Mesh) repaint(label, PLAQUES[lamp.id]);
  }
}

function repaint(mesh: Mesh, copy: readonly [string, string] | undefined): void {
  if (copy == null || !(mesh.material instanceof MeshBasicMaterial)) return;
  mesh.material.map?.dispose();
  mesh.material.map = plaqueTexture(copy[0], copy[1]);
  mesh.material.needsUpdate = true;
}

function buildMerchantLamps(): StallView['merchantLamps'] {
  const specs = [
    ['merchant-mei', 'MEI', 'Stock', -0.34],
    ['merchant-calder', 'CALDER', 'Floor', 0],
    ['merchant-quill', 'QUILL', 'Temper', 0.34],
  ] as const;
  return specs.map(([id, , , x]) => {
    const material = new MeshStandardMaterial({
      color: '#2a2030',
      emissive: '#e7c27a',
      emissiveIntensity: 0.2,
      roughness: 0.45,
    });
    const mesh = new Mesh(new CylinderGeometry(0.055, 0.055, 0.09, 16), material);
    mesh.position.set(x, LAYOUT.tableY + 0.1, LAYOUT.tableZ - 0.16);
    mesh.name = id;
    const copy = PLAQUES[id];
    const label = new Mesh(
      new PlaneGeometry(0.12, 0.05),
      new MeshBasicMaterial({ map: plaqueTexture(copy[0], copy[1]), transparent: true }),
    );
    label.position.set(0, 0.08, 0);
    mesh.add(label);
    return { id, mesh, material };
  });
}

function buildMotes(): Points {
  const count = 80;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 4.5;
    positions[index * 3 + 1] = 0.4 + Math.random() * 2.2;
    positions[index * 3 + 2] = -0.2 - Math.random() * 3.2;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new Points(geometry, new PointsMaterial({
    color: new Color('#ffd7a1'),
    size: 0.018,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
}
