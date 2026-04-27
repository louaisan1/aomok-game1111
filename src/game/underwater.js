import * as THREE from 'three';
import { createTilesTexture, createCardTexture, createStoneTexture } from './textures.js';

const ROOM = { W: 8, D: 8, H: 4 };
const WALL_T = 0.3;

export function buildUnderwaterRoom(scene) {
  const group = new THREE.Group();
  group.visible = false;
  // Position far below, so we can teleport the camera here.
  group.position.set(60, -20, 0);
  scene.add(group);

  // Floor (tiled)
  const tiles = createTilesTexture();
  tiles.repeat.set(4, 4);
  const floorMat = new THREE.MeshStandardMaterial({
    map: tiles,
    roughness: 0.7,
    metalness: 0.15
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Ceiling (water surface) — translucent blueish plane
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x4ab1d6,
    transparent: true,
    opacity: 0.55,
    roughness: 0.2,
    metalness: 0.0,
    emissive: 0x1a4f6a,
    emissiveIntensity: 0.4
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.D), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.H;
  group.add(ceil);
  // Water volume: a slightly translucent box covering the whole room (volumetric tint)
  const waterVol = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.W - 0.05, ROOM.H - 0.05, ROOM.D - 0.05),
    new THREE.MeshBasicMaterial({
      color: 0x1873a0,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.BackSide
    })
  );
  waterVol.position.y = ROOM.H / 2;
  group.add(waterVol);

  // Walls
  const stone = createStoneTexture();
  stone.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({
    map: stone,
    color: 0x3a5566,
    roughness: 0.9,
    metalness: 0.05
  });
  const halfW = ROOM.W / 2;
  const halfD = ROOM.D / 2;
  const walls = [
    { x: 0, z: -halfD, w: ROOM.W, d: WALL_T },
    { x: 0, z: halfD, w: ROOM.W, d: WALL_T },
    { x: halfW, z: 0, w: WALL_T, d: ROOM.D },
    { x: -halfW, z: 0, w: WALL_T, d: ROOM.D }
  ];
  walls.forEach((w) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w.w, ROOM.H, w.d),
      wallMat
    );
    m.position.set(w.x, ROOM.H / 2, w.z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });

  // Lighting under water — bluish caustic-like
  const ambient = new THREE.AmbientLight(0x88c8ff, 0.45);
  group.add(ambient);
  const top = new THREE.PointLight(0x9be0ff, 1.6, 12, 2);
  top.position.set(0, ROOM.H - 0.3, 0);
  top.castShadow = true;
  group.add(top);
  const sideTint = new THREE.PointLight(0x2c70a8, 0.5, 10, 2);
  sideTint.position.set(2, 1.5, -2);
  group.add(sideTint);

  // The "= 7" card floating
  const cardTex = createCardTexture();
  const cardMat = new THREE.MeshStandardMaterial({
    map: cardTex,
    transparent: true,
    metalness: 0.15,
    roughness: 0.4,
    emissive: 0xfff4cc,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), cardMat);
  card.position.set(0, 1.1, 0);
  card.rotation.set(-0.2, 0.6, 0);
  card.castShadow = true;
  group.add(card);

  // A few floating bubbles
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xddf3ff,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
    metalness: 0.0
  });
  const bubbles = [];
  for (let i = 0; i < 24; i++) {
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random() * 0.07, 8, 8),
      bubbleMat
    );
    b.position.set(
      (Math.random() - 0.5) * (ROOM.W - 0.6),
      Math.random() * ROOM.H,
      (Math.random() - 0.5) * (ROOM.D - 0.6)
    );
    b.userData.speed = 0.2 + Math.random() * 0.5;
    b.userData.phase = Math.random() * Math.PI * 2;
    group.add(b);
    bubbles.push(b);
  }

  // Colliders inside underwater room (relative to room.position)
  const colliders = walls.map((w) => ({
    x: group.position.x + w.x,
    z: group.position.z + w.z,
    w: w.w,
    d: w.d
  }));

  return {
    group,
    colliders,
    card,
    bubbles,
    spawn: new THREE.Vector3(group.position.x, 1.7, group.position.z + 2),
    update(dt, t) {
      bubbles.forEach((b) => {
        b.position.y += dt * b.userData.speed;
        b.position.x += Math.sin(t * 1.5 + b.userData.phase) * 0.002;
        if (b.position.y > ROOM.H - 0.1) {
          b.position.y = 0.05;
          b.position.x = (Math.random() - 0.5) * (ROOM.W - 0.6);
          b.position.z = (Math.random() - 0.5) * (ROOM.D - 0.6);
        }
      });
      // Card sway
      card.rotation.y += dt * 0.3;
      card.position.y = 1.1 + Math.sin(t * 1.2) * 0.07;
    }
  };
}
