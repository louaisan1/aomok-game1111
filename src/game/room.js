import * as THREE from 'three';
import { DOOR_COLORS } from './colors.js';
import {
  createWoodTexture,
  createStoneTexture,
  createCeilingTexture,
  createTokenTexture
} from './textures.js';

export const ROOM = {
  W: 16, // x
  D: 16, // z
  H: 6   // y
};

const WALL_THICKNESS = 0.4;
const DOOR_WIDTH = 1.4;
const DOOR_HEIGHT = 2.6;

// Returns object with: scene contents, doors[], keys[], trapdoor, colliders
export function buildRoom(scene, tokens) {
  const group = new THREE.Group();
  scene.add(group);

  const stone = createStoneTexture();
  stone.repeat.set(4, 2);
  const ceil = createCeilingTexture();
  ceil.repeat.set(4, 4);
  const wood = createWoodTexture();
  wood.repeat.set(2, 2);

  // Floor
  const floorGeom = new THREE.PlaneGeometry(ROOM.W, ROOM.D);
  const floorMat = new THREE.MeshStandardMaterial({
    map: wood,
    roughness: 0.85,
    metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Ceiling
  const ceilingMat = new THREE.MeshStandardMaterial({
    map: ceil,
    roughness: 0.95
  });
  const ceiling = new THREE.Mesh(floorGeom, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.H;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Walls (4): build with stone material, with door cutouts (visual only — collisions handled via wall segments)
  const wallMat = new THREE.MeshStandardMaterial({
    map: stone,
    roughness: 0.95,
    metalness: 0.04
  });

  // Distribute 10 doors:
  // 3 north (z = -D/2), 3 south (z = +D/2), 2 east (x = +W/2), 2 west (x = -W/2)
  const doorPositions = computeDoorPositions();

  // Build walls with door alcoves visually using extruded shapes via CSG-like substitution:
  // For simplicity, build wall in segments around door openings.
  buildSegmentedWalls(group, wallMat, doorPositions);

  // Doors
  const doors = doorPositions.map((dp, i) => {
    const colorEntry = DOOR_COLORS[i];
    const token = tokens[i];
    return createDoor(group, dp, colorEntry, token, i);
  });

  // Keys (placed on the floor)
  const keys = doorPositions.map((dp, i) => {
    return createKey(group, DOOR_COLORS[i], i, dp);
  });

  // Trapdoor
  const trapdoor = createTrapdoor(group);

  // Colliders are walls + outer perimeter as AABBs.
  const colliders = computeColliders(doorPositions);

  return { group, doors, keys, trapdoor, colliders };
}

function computeDoorPositions() {
  const halfW = ROOM.W / 2;
  const halfD = ROOM.D / 2;
  const positions = [];
  // North wall (z = -halfD), 3 doors
  const northXs = [-ROOM.W / 3, 0, ROOM.W / 3];
  northXs.forEach((x) => {
    positions.push({ x, z: -halfD + WALL_THICKNESS / 2, side: 'N', rot: 0 });
  });
  // South wall (z = +halfD), 3 doors
  northXs.forEach((x) => {
    positions.push({ x, z: halfD - WALL_THICKNESS / 2, side: 'S', rot: Math.PI });
  });
  // East wall (x = +halfW), 2 doors
  const eastZs = [-ROOM.D / 4, ROOM.D / 4];
  eastZs.forEach((z) => {
    positions.push({ x: halfW - WALL_THICKNESS / 2, z, side: 'E', rot: -Math.PI / 2 });
  });
  // West wall (x = -halfW), 2 doors
  eastZs.forEach((z) => {
    positions.push({ x: -ROOM.W / 2 + WALL_THICKNESS / 2, z, side: 'W', rot: Math.PI / 2 });
  });
  return positions;
}

function buildSegmentedWalls(group, wallMat, doorPositions) {
  const halfW = ROOM.W / 2;
  const halfD = ROOM.D / 2;
  const T = WALL_THICKNESS;

  // For each wall, sort door positions along its axis and create segments around them.
  const walls = [
    {
      axis: 'x', // door positions vary in x
      fixed: 'z',
      fixedVal: -halfD,
      length: ROOM.W,
      side: 'N'
    },
    {
      axis: 'x',
      fixed: 'z',
      fixedVal: halfD,
      length: ROOM.W,
      side: 'S'
    },
    {
      axis: 'z',
      fixed: 'x',
      fixedVal: halfW,
      length: ROOM.D,
      side: 'E'
    },
    {
      axis: 'z',
      fixed: 'x',
      fixedVal: -halfW,
      length: ROOM.D,
      side: 'W'
    }
  ];

  walls.forEach((w) => {
    const doorsHere = doorPositions
      .filter((dp) => dp.side === w.side)
      .map((dp) => (w.axis === 'x' ? dp.x : dp.z))
      .sort((a, b) => a - b);

    // Wall extends from -length/2 to +length/2 along its axis.
    let cursor = -w.length / 2;
    const opening = DOOR_WIDTH;
    const segments = [];
    doorsHere.forEach((c) => {
      const segStart = cursor;
      const segEnd = c - opening / 2;
      if (segEnd > segStart) segments.push([segStart, segEnd]);
      cursor = c + opening / 2;
    });
    if (cursor < w.length / 2) segments.push([cursor, w.length / 2]);

    segments.forEach(([s, e]) => {
      const len = e - s;
      const cx = (s + e) / 2;
      const geomDimX = w.axis === 'x' ? len : T;
      const geomDimZ = w.axis === 'z' ? len : T;
      const geom = new THREE.BoxGeometry(geomDimX, ROOM.H, geomDimZ);
      const mesh = new THREE.Mesh(geom, wallMat);
      const px = w.fixed === 'x' ? w.fixedVal : cx;
      const pz = w.fixed === 'z' ? w.fixedVal : cx;
      mesh.position.set(px, ROOM.H / 2, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    // Top lintel above each door
    doorsHere.forEach((c) => {
      const lintelLen = opening + 0.4;
      const geomDimX = w.axis === 'x' ? lintelLen : T;
      const geomDimZ = w.axis === 'z' ? lintelLen : T;
      const lintelHeight = ROOM.H - DOOR_HEIGHT - 0.2;
      const geom = new THREE.BoxGeometry(geomDimX, lintelHeight, geomDimZ);
      const mesh = new THREE.Mesh(geom, wallMat);
      const px = w.fixed === 'x' ? w.fixedVal : c;
      const pz = w.fixed === 'z' ? w.fixedVal : c;
      mesh.position.set(
        px,
        DOOR_HEIGHT + 0.1 + lintelHeight / 2,
        pz
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
  });
}

function createDoor(group, dp, colorEntry, token, index) {
  const doorGroup = new THREE.Group();
  // Frame
  const frameGeom = new THREE.BoxGeometry(DOOR_WIDTH + 0.2, DOOR_HEIGHT + 0.2, 0.18);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1010,
    roughness: 0.9,
    metalness: 0.05
  });
  const frame = new THREE.Mesh(frameGeom, frameMat);
  frame.castShadow = true;
  frame.receiveShadow = true;
  doorGroup.add(frame);

  // The door panel — pivoted at its hinge edge so opening rotates the panel.
  const panelPivot = new THREE.Group();
  // Hinge on the +x edge (relative to door local frame)
  panelPivot.position.set(-DOOR_WIDTH / 2, 0, 0);
  doorGroup.add(panelPivot);

  const panelGeom = new THREE.BoxGeometry(DOOR_WIDTH - 0.05, DOOR_HEIGHT - 0.05, 0.1);
  const panelMat = new THREE.MeshStandardMaterial({
    color: colorEntry.hex,
    roughness: 0.55,
    metalness: 0.18,
    emissive: new THREE.Color(colorEntry.hex).multiplyScalar(0.05)
  });
  const panel = new THREE.Mesh(panelGeom, panelMat);
  panel.position.set(DOOR_WIDTH / 2, 0, 0); // shift so left edge at 0
  panel.castShadow = true;
  panel.receiveShadow = true;
  panelPivot.add(panel);

  // Knob
  const knobGeom = new THREE.SphereGeometry(0.06, 16, 12);
  const knobMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c2,
    roughness: 0.3,
    metalness: 0.9
  });
  const knob = new THREE.Mesh(knobGeom, knobMat);
  knob.position.set(DOOR_WIDTH - 0.18, 0, 0.08);
  panelPivot.add(knob);

  // Number plaque above the door (1..10)
  const plaqueTex = createTokenTexture(String(index + 1), '#ffffff', '#222');
  const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTex, transparent: false });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), plaqueMat);
  plaque.position.set(0, DOOR_HEIGHT / 2 + 0.35, 0.11);
  doorGroup.add(plaque);

  // Token reveal plaque (initially hidden behind door; visible after opening)
  const tokenTex = createTokenTexture(token, '#fff', `#${colorEntry.hex.toString(16).padStart(6, '0')}`);
  const tokenMat = new THREE.MeshBasicMaterial({ map: tokenTex, transparent: true, opacity: 0.0 });
  const tokenPlaque = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), tokenMat);
  // Place inside the alcove behind the door
  tokenPlaque.position.set(0, 0, -0.25);
  doorGroup.add(tokenPlaque);

  // A subtle glow point light at door (color hint)
  const dl = new THREE.PointLight(colorEntry.hex, 0.18, 3.0, 2);
  dl.position.set(0, DOOR_HEIGHT / 2 - 0.4, 0.4);
  doorGroup.add(dl);

  // Position in scene
  doorGroup.position.set(dp.x, DOOR_HEIGHT / 2, dp.z);
  doorGroup.rotation.y = dp.rot;
  group.add(doorGroup);

  return {
    index,
    color: colorEntry,
    token,
    position: doorGroup.position.clone(),
    rotation: dp.rot,
    panelPivot,
    tokenPlaque,
    tokenMat,
    light: dl,
    opened: false,
    openProgress: 0
  };
}

function createKey(group, colorEntry, index, doorPos) {
  const keyGroup = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorEntry.hex,
    roughness: 0.3,
    metalness: 0.85,
    emissive: new THREE.Color(colorEntry.hex).multiplyScalar(0.4)
  });
  // Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12), mat);
  stem.rotation.z = Math.PI / 2;
  keyGroup.add(stem);
  // Bow (head ring)
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 10, 22), mat);
  bow.position.x = 0.25;
  bow.rotation.y = Math.PI / 2;
  keyGroup.add(bow);
  // Bit (teeth)
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.04), mat);
  bit.position.x = -0.18;
  keyGroup.add(bit);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), mat);
  tooth.position.set(-0.12, -0.08, 0);
  keyGroup.add(tooth);

  // Glow point light
  const pl = new THREE.PointLight(colorEntry.hex, 0.6, 2.2, 2);
  pl.position.set(0, 0.05, 0);
  keyGroup.add(pl);

  // Random scatter position avoiding center & doors
  const pos = scatterKeyPosition(index, doorPos);
  keyGroup.position.set(pos.x, 0.4, pos.z);
  keyGroup.rotation.y = Math.random() * Math.PI * 2;

  keyGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  group.add(keyGroup);

  return {
    index,
    color: colorEntry,
    mesh: keyGroup,
    basePos: keyGroup.position.clone(),
    bobPhase: Math.random() * Math.PI * 2,
    collected: false
  };
}

const occupiedSpots = [];
function scatterKeyPosition(index, doorPos) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = (Math.random() - 0.5) * (ROOM.W - 3);
    const z = (Math.random() - 0.5) * (ROOM.D - 3);
    // Avoid trapdoor area
    if (Math.abs(x) < 1.4 && Math.abs(z) < 1.4) continue;
    // Avoid doors (don't drop in front of them)
    if (Math.abs(z + ROOM.D / 2) < 1.3) continue;
    if (Math.abs(z - ROOM.D / 2) < 1.3) continue;
    if (Math.abs(x + ROOM.W / 2) < 1.3) continue;
    if (Math.abs(x - ROOM.W / 2) < 1.3) continue;
    let ok = true;
    for (const p of occupiedSpots) {
      if (Math.hypot(p.x - x, p.z - z) < 1.5) { ok = false; break; }
    }
    if (!ok) continue;
    occupiedSpots.push({ x, z });
    return { x, z };
  }
  // Fallback grid
  const gx = (index % 5) * 2.6 - 5.2;
  const gz = Math.floor(index / 5) * 2.6 - 1.3;
  occupiedSpots.push({ x: gx, z: gz });
  return { x: gx, z: gz };
}

function createTrapdoor(group) {
  const tdGroup = new THREE.Group();
  // Frame on floor
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.06, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.7, metalness: 0.5 })
  );
  frame.position.y = 0.03;
  frame.castShadow = false;
  frame.receiveShadow = true;
  tdGroup.add(frame);

  // Hatch (slightly raised)
  const hatchPivot = new THREE.Group();
  hatchPivot.position.set(-1.0, 0.06, 0); // hinge along -x edge
  tdGroup.add(hatchPivot);
  const hatchMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f28,
    roughness: 0.7,
    metalness: 0.5,
    emissive: 0x002233,
    emissiveIntensity: 0.6
  });
  const hatch = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.08, 2.0),
    hatchMat
  );
  hatch.position.set(1.0, 0.04, 0); // shift so hinge edge is at 0
  hatch.castShadow = true;
  hatch.receiveShadow = true;
  hatchPivot.add(hatch);

  // Handle ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.025, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xffd58a, roughness: 0.3, metalness: 0.9 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(1.7, 0.1, 0);
  hatchPivot.add(ring);

  // Glowing rune in floor showing "→ تحت"
  const runeTex = createTokenTexture('▼', '#5cd1ff', '#0c0f18');
  const rune = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.8),
    new THREE.MeshBasicMaterial({ map: runeTex, transparent: true })
  );
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.07;
  tdGroup.add(rune);

  // Soft cyan light from below
  const light = new THREE.PointLight(0x5cd1ff, 0.6, 4, 2);
  light.position.set(0, 0.4, 0);
  tdGroup.add(light);

  // Place near room center, slightly forward
  tdGroup.position.set(0, 0, -2);
  group.add(tdGroup);

  return {
    group: tdGroup,
    hatchPivot,
    light,
    position: tdGroup.position.clone(),
    opened: false,
    openProgress: 0
  };
}

function computeColliders(doorPositions) {
  const halfW = ROOM.W / 2;
  const halfD = ROOM.D / 2;
  const T = WALL_THICKNESS;
  const colliders = [];

  // Outer perimeter: build per wall, segmented by door openings
  const walls = [
    { axis: 'x', fixed: 'z', fixedVal: -halfD, length: ROOM.W, side: 'N' },
    { axis: 'x', fixed: 'z', fixedVal: halfD, length: ROOM.W, side: 'S' },
    { axis: 'z', fixed: 'x', fixedVal: halfW, length: ROOM.D, side: 'E' },
    { axis: 'z', fixed: 'x', fixedVal: -halfW, length: ROOM.D, side: 'W' }
  ];
  walls.forEach((w) => {
    const doorsHere = doorPositions
      .filter((dp) => dp.side === w.side)
      .map((dp) => (w.axis === 'x' ? dp.x : dp.z))
      .sort((a, b) => a - b);
    let cursor = -w.length / 2;
    const opening = DOOR_WIDTH;
    const segments = [];
    doorsHere.forEach((c) => {
      const s = cursor;
      const e = c - opening / 2;
      if (e > s) segments.push([s, e]);
      cursor = c + opening / 2;
    });
    if (cursor < w.length / 2) segments.push([cursor, w.length / 2]);
    segments.forEach(([s, e]) => {
      const cx = (s + e) / 2;
      const len = e - s;
      const dimX = w.axis === 'x' ? len : T;
      const dimZ = w.axis === 'z' ? len : T;
      const px = w.fixed === 'x' ? w.fixedVal : cx;
      const pz = w.fixed === 'z' ? w.fixedVal : cx;
      colliders.push({ x: px, z: pz, w: dimX, d: dimZ });
    });
  });

  // Door panel colliders (when closed). They will be removed when door opens.
  doorPositions.forEach((dp, i) => {
    const isLong = dp.side === 'N' || dp.side === 'S';
    colliders.push({
      x: dp.x,
      z: dp.z,
      w: isLong ? DOOR_WIDTH : T,
      d: isLong ? T : DOOR_WIDTH,
      doorIndex: i
    });
  });

  return colliders;
}

export function pointCollidesAABB(px, pz, radius, aabb) {
  const minX = aabb.x - aabb.w / 2 - radius;
  const maxX = aabb.x + aabb.w / 2 + radius;
  const minZ = aabb.z - aabb.d / 2 - radius;
  const maxZ = aabb.z + aabb.d / 2 + radius;
  return px >= minX && px <= maxX && pz >= minZ && pz <= maxZ;
}
