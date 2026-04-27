import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  scene.fog = new THREE.FogExp2(0x05060b, 0.012);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.05,
    200
  );
  camera.position.set(0, 1.7, 0);
  return camera;
}

export function addBaseLighting(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.32);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x2a2a3a, 0.55);
  scene.add(hemi);

  // Warm overhead chandelier
  const overhead = new THREE.PointLight(0xffd9a8, 2.6, 30, 1.4);
  overhead.position.set(0, 5.4, 0);
  overhead.castShadow = true;
  overhead.shadow.mapSize.set(1024, 1024);
  overhead.shadow.bias = -0.0008;
  overhead.shadow.radius = 4;
  scene.add(overhead);

  // Wall sconces — 4 corner-ish fills to make the room feel lived in.
  const sconcePositions = [
    { x: 6, z: 6, color: 0xffb56b, intensity: 0.9 },
    { x: -6, z: 6, color: 0xffb56b, intensity: 0.9 },
    { x: 6, z: -6, color: 0x9ec5ff, intensity: 0.7 },
    { x: -6, z: -6, color: 0x9ec5ff, intensity: 0.7 }
  ];
  const sconces = sconcePositions.map((p) => {
    const l = new THREE.PointLight(p.color, p.intensity, 12, 2);
    l.position.set(p.x, 3.4, p.z);
    scene.add(l);
    return l;
  });

  return { ambient, hemi, overhead, sconces };
}
