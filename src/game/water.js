import * as THREE from 'three';
import { ROOM } from './room.js';

// Big rising water plane that floods the main room when the trapdoor opens.
export function createWater(scene) {
  const geom = new THREE.PlaneGeometry(ROOM.W * 0.99, ROOM.D * 0.99, 24, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1f78c8,
    transparent: true,
    opacity: 0.78,
    roughness: 0.25,
    metalness: 0.05,
    emissive: 0x062a44,
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.02;
  mesh.visible = false;
  scene.add(mesh);

  // Underwater fog (only when the player head is below water)
  const fogColor = new THREE.Color(0x0a3960);

  // Caustic-ish underglow light
  const light = new THREE.PointLight(0x66c8ff, 0.0, 20, 2);
  light.position.set(0, 0.5, 0);
  scene.add(light);

  // Animate vertices for a gentle ripple
  const positions = geom.attributes.position;
  const baseZs = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) {
    baseZs[i] = positions.getZ(i);
  }

  return {
    mesh,
    mat,
    light,
    fogColor,
    level: 0, // current water height (world Y)
    targetLevel: 0,
    update(dt, t, progress, animateRipple = true) {
      const minLevel = 0.0;
      const maxLevel = ROOM.H + 0.6;
      this.targetLevel = minLevel + (maxLevel - minLevel) * progress;
      this.level += (this.targetLevel - this.level) * Math.min(1, dt * 2);
      mesh.position.y = this.level;
      mesh.visible = this.level > 0.001;

      if (animateRipple && mesh.visible) {
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const yLocal = baseZs[i];
          const w = Math.sin(t * 1.2 + x * 0.6 + yLocal * 0.4) * 0.035;
          positions.setZ(i, yLocal + w);
        }
        positions.needsUpdate = true;
      }

      light.position.y = this.level + 0.4;
      light.intensity = mesh.visible ? 0.5 : 0;
    }
  };
}
