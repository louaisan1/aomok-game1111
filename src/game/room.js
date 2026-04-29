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
const DOOR_WIDTH = 1.6;
const DOOR_HEIGHT = 2.8;

// Build the main room. Doors carry tokens but never grant passage —
// when "opened" they reveal a full-size white sign with the token.
export function buildRoom(scene, doorTokens) {
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

  // Walls (solid stone, no passage; doors are decorative + sign holders).
  const wallMat = new THREE.MeshStandardMaterial({
    map: stone,
    roughness: 0.95,
    metalness: 0.04
  });

  buildSolidWalls(group, wallMat);

  // 10 door positions on the inner faces of the walls
  const doorPositions = computeDoorPositions();
  const doors = doorPositions.map((dp, i) => {
    const colorEntry = DOOR_COLORS[i];
    const token = doorTokens[i];
    return createDoor(group, dp, colorEntry, token, i);
  });

  const trapdoor = createTrapdoor(group);

  // Outer wall colliders (player can't walk through walls). No door cutouts —
  // doors are flush with the wall surface and never grant passage.
  const colliders = computeWallColliders();

  return { group, doors, trapdoor, colliders };
}

function computeDoorPositions() {
  const halfW = ROOM.W / 2;
  const halfD = ROOM.D / 2;
  const positions = [];
  // North wall (z = -halfD), 3 doors → faces +z (into room)
  const northXs = [-ROOM.W / 3, 0, ROOM.W / 3];
  northXs.forEach((x) => {
    positions.push({ x, z: -halfD + WALL_THICKNESS / 2 + 0.01, side: 'N', rot: 0 });
  });
  // South wall (z = +halfD), 3 doors → faces -z
  northXs.forEach((x) => {
    positions.push({ x, z: halfD - WALL_THICKNESS / 2 - 0.01, side: 'S', rot: Math.PI });
  });
  // East wall (x = +halfW), 2 doors → faces -x
  const eastZs = [-ROOM.D / 4, ROOM.D / 4];
  eastZs.forEach((z) => {
    positions.push({ x: halfW - WALL_THICKNESS / 2 - 0.01, z, side: 'E', rot: -Math.PI / 2 });
  });
  // West wall (x = -halfW), 2 doors → faces +x
  eastZs.forEach((z) => {
    positions.push({ x: -halfW + WALL_THICKNESS / 2 + 0.01, z, side: 'W', rot: Math.PI / 2 });
  });
  return positions;
}

function buildSolidWalls(group, wallMat) {
  const halfW = ROOM.W / 2;
  const halfD = ROOM.D / 2;
  const T = WALL_THICKNESS;

  const walls = [
    { dim: [ROOM.W, ROOM.H, T], pos: [0, ROOM.H / 2, -halfD] },
    { dim: [ROOM.W, ROOM.H, T], pos: [0, ROOM.H / 2,  halfD] },
    { dim: [T, ROOM.H, ROOM.D], pos: [ halfW, ROOM.H / 2, 0] },
    { dim: [T, ROOM.H, ROOM.D], pos: [-halfW, ROOM.H / 2, 0] }
  ];
  walls.forEach((w) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...w.dim), wallMat);
    m.position.set(...w.pos);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
}

function computeWallColliders() {
  const halfW = ROOM.W / 2;
  const halfD = ROOM.D / 2;
  const T = WALL_THICKNESS;
  return [
    { x: 0, z: -halfD, w: ROOM.W, d: T },
    { x: 0, z:  halfD, w: ROOM.W, d: T },
    { x:  halfW, z: 0, w: T, d: ROOM.D },
    { x: -halfW, z: 0, w: T, d: ROOM.D }
  ];
}

function createDoor(group, dp, colorEntry, token, index) {
  const doorGroup = new THREE.Group();

  // Frame (decorative, around door)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1010,
    roughness: 0.9,
    metalness: 0.05
  });
  const frameThickness = 0.12;
  const frameOuterW = DOOR_WIDTH + 0.3;
  const frameOuterH = DOOR_HEIGHT + 0.3;
  // Top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(frameOuterW, frameThickness, 0.2),
    frameMat
  );
  top.position.set(0, DOOR_HEIGHT / 2 + 0.15, 0);
  doorGroup.add(top);
  // Sides
  const side1 = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, frameOuterH, 0.2),
    frameMat
  );
  side1.position.set(-DOOR_WIDTH / 2 - 0.06, 0, 0);
  doorGroup.add(side1);
  const side2 = side1.clone();
  side2.position.x = DOOR_WIDTH / 2 + 0.06;
  doorGroup.add(side2);

  // Closed-state colored door panel (rotates aside on open)
  const panelPivot = new THREE.Group();
  panelPivot.position.set(-DOOR_WIDTH / 2, 0, 0); // hinge on left edge
  doorGroup.add(panelPivot);
  const panelGeom = new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.06);
  const panelMat = new THREE.MeshStandardMaterial({
    color: colorEntry.hex,
    roughness: 0.55,
    metalness: 0.18,
    emissive: new THREE.Color(colorEntry.hex).multiplyScalar(0.05)
  });
  const panel = new THREE.Mesh(panelGeom, panelMat);
  panel.position.set(DOOR_WIDTH / 2, 0, 0); // shift so left edge is at 0
  panel.castShadow = true;
  panel.receiveShadow = true;
  panelPivot.add(panel);

  // Brass knob
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff0c2, roughness: 0.3, metalness: 0.9 })
  );
  knob.position.set(DOOR_WIDTH - 0.18, 0, 0.08);
  panelPivot.add(knob);

  // Numbered plaque above the door
  const plaqueTex = createTokenTexture(String(index + 1), '#ffffff', '#222');
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.4),
    new THREE.MeshBasicMaterial({ map: plaqueTex, transparent: false })
  );
  plaque.position.set(0, DOOR_HEIGHT / 2 + 0.45, 0.13);
  doorGroup.add(plaque);

  // White sign that fills the door opening once "opened" — features the token
  const tokenTex = createTokenTexture(displayToken(token), '#0a0a14', '#ffffff');
  const signMat = new THREE.MeshStandardMaterial({
    map: tokenTex,
    transparent: true,
    opacity: 0.0,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.55,
    emissiveMap: tokenTex
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR_WIDTH * 0.98, DOOR_HEIGHT * 0.98),
    signMat
  );
  // Position the sign just inside the frame, so the colored door (when closed) fully covers it
  sign.position.set(0, 0, -0.01);
  doorGroup.add(sign);

  // Position the whole door at its wall slot, facing into the room
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
    sign,
    signMat,
    panelMat,
    opened: false,
    openProgress: 0
  };
}

function displayToken(t) {
  if (t === '*') return '×';
  if (t === '/') return '÷';
  return t;
}

function createKey(group, colorEntry, index, doorPos) {
  const keyGroup = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorEntry.hex,
    roughness: 0.3,
    metalness: 0.85,
    emissive: new THREE.Color(colorEntry.hex).multiplyScalar(0.4)
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12), mat);
  stem.rotation.z = Math.PI / 2;
  keyGroup.add(stem);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 10, 22), mat);
  bow.position.x = 0.25;
  bow.rotation.y = Math.PI / 2;
  keyGroup.add(bow);
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.04), mat);
  bit.position.x = -0.18;
  keyGroup.add(bit);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), mat);
  tooth.position.set(-0.12, -0.08, 0);
  keyGroup.add(tooth);

  const pl = new THREE.PointLight(colorEntry.hex, 0.6, 2.2, 2);
  pl.position.set(0, 0.05, 0);
  keyGroup.add(pl);

  const pos = scatterKeyPosition(index);
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
function scatterKeyPosition(index) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = (Math.random() - 0.5) * (ROOM.W - 3);
    const z = (Math.random() - 0.5) * (ROOM.D - 3);
    if (Math.abs(x) < 1.6 && Math.abs(z) < 1.6) continue; // trapdoor
    if (Math.abs(z + ROOM.D / 2) < 1.3) continue;
    if (Math.abs(z - ROOM.D / 2) < 1.3) continue;
    if (Math.abs(x + ROOM.W / 2) < 1.3) continue;
    if (Math.abs(x - ROOM.W / 2) < 1.3) continue;
    let ok = true;
    for (const p of occupiedSpots) {
      if (Math.hypot(p.x - x, p.z - z) < 1.6) { ok = false; break; }
    }
    if (!ok) continue;
    occupiedSpots.push({ x, z });
    return { x, z };
  }
  const gx = (index % 5) * 2.6 - 5.2;
  const gz = Math.floor(index / 5) * 2.6 - 1.3;
  occupiedSpots.push({ x: gx, z: gz });
  return { x: gx, z: gz };
}

function createTrapdoor(group) {
  const tdGroup = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.06, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.7, metalness: 0.5 })
  );
  frame.position.y = 0.03;
  frame.castShadow = false;
  frame.receiveShadow = true;
  tdGroup.add(frame);

  const hatchPivot = new THREE.Group();
  hatchPivot.position.set(-1.0, 0.06, 0);
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
  hatch.position.set(1.0, 0.04, 0);
  hatch.castShadow = true;
  hatch.receiveShadow = true;
  hatchPivot.add(hatch);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.025, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xffd58a, roughness: 0.3, metalness: 0.9 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(1.7, 0.1, 0);
  hatchPivot.add(ring);

  const runeTex = createTokenTexture('▼', '#5cd1ff', '#0c0f18');
  const rune = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.8),
    new THREE.MeshBasicMaterial({ map: runeTex, transparent: true })
  );
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.07;
  tdGroup.add(rune);

  const light = new THREE.PointLight(0x5cd1ff, 0.6, 4, 2);
  light.position.set(0, 0.4, 0);
  tdGroup.add(light);

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

export function pointCollidesAABB(px, pz, radius, aabb) {
  const minX = aabb.x - aabb.w / 2 - radius;
  const maxX = aabb.x + aabb.w / 2 + radius;
  const minZ = aabb.z - aabb.d / 2 - radius;
  const maxZ = aabb.z + aabb.d / 2 + radius;
  return px >= minX && px <= maxX && pz >= minZ && pz <= maxZ;
}
