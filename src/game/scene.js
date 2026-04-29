import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // anti-alias off for perf; we cap pixel ratio instead
    powerPreference: 'high-performance'
  });
  // Cap pixel ratio aggressively to keep GPU load low (this was causing fan noise)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  // Light fog only — exp fog scales linearly with distance, cheap.
  scene.fog = new THREE.FogExp2(0x05060b, 0.010);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.7, 0);
  return camera;
}

export function addBaseLighting(scene) {
  // Ambient + hemi only — no expensive shadow-casting point lights.
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x2a2a3a, 0.95);
  scene.add(hemi);

  const overhead = new THREE.PointLight(0xffd9a8, 1.8, 30, 1.5);
  overhead.position.set(0, 5.4, 0);
  scene.add(overhead);

  return { ambient, hemi, overhead };
}
