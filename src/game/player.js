import * as THREE from 'three';

const KEYS = { w: false, a: false, s: false, d: false, shift: false, space: false };
const MOVE_SPEED = 3.6;
const RUN_MULT = 1.7;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.32;

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = 0;
    this.pitch = 0;
    this.position = new THREE.Vector3(0, PLAYER_HEIGHT, 4);
    this.velocity = new THREE.Vector3();
    this.height = PLAYER_HEIGHT;
    this.radius = PLAYER_RADIUS;
    this.locked = false;
    this.bobTime = 0;
    this.bodyGroup = new THREE.Group();
    this._buildBody();
    this._bind();
  }

  _buildBody() {
    // First-person visible body parts: torso shadow, arms, legs.
    // These are children attached to the camera so they rotate with the view.
    const skin = new THREE.MeshStandardMaterial({
      color: 0xe2b48a,
      roughness: 0.7,
      metalness: 0.0
    });
    const cloth = new THREE.MeshStandardMaterial({
      color: 0x29304a,
      roughness: 0.85,
      metalness: 0.05
    });
    const shoes = new THREE.MeshStandardMaterial({
      color: 0x111418,
      roughness: 0.6,
      metalness: 0.1
    });

    // Torso (just below camera, partially visible)
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.35),
      cloth
    );
    torso.position.set(0, -0.7, -0.05);
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    // Arms (pointing down at sides, only visible at the periphery / when looking down)
    const armGeom = new THREE.CapsuleGeometry(0.05, 0.45, 4, 8);
    this.leftArm = new THREE.Mesh(armGeom, skin);
    this.leftArm.position.set(-0.32, -0.95, -0.05);
    this.leftArm.rotation.x = 0.05; // mostly straight down
    this.leftArm.castShadow = true;

    this.rightArm = this.leftArm.clone();
    this.rightArm.position.x = 0.32;
    this.bodyGroup.add(this.leftArm, this.rightArm);

    // Hands
    const handGeom = new THREE.SphereGeometry(0.07, 12, 12);
    this.leftHand = new THREE.Mesh(handGeom, skin);
    this.leftHand.position.set(-0.32, -1.22, -0.04);
    this.rightHand = this.leftHand.clone();
    this.rightHand.position.x = 0.32;
    this.leftHand.castShadow = this.rightHand.castShadow = true;
    this.bodyGroup.add(this.leftHand, this.rightHand);

    // Legs (visible when looking down)
    const legGeom = new THREE.CapsuleGeometry(0.11, 0.7, 4, 8);
    this.leftLeg = new THREE.Mesh(legGeom, cloth);
    this.leftLeg.position.set(-0.13, -1.25, -0.15);
    this.rightLeg = this.leftLeg.clone();
    this.rightLeg.position.x = 0.13;
    this.leftLeg.castShadow = this.rightLeg.castShadow = true;
    this.bodyGroup.add(this.leftLeg, this.rightLeg);

    // Shoes
    const shoeGeom = new THREE.BoxGeometry(0.22, 0.1, 0.34);
    this.leftShoe = new THREE.Mesh(shoeGeom, shoes);
    this.leftShoe.position.set(-0.13, -1.62, -0.22);
    this.rightShoe = this.leftShoe.clone();
    this.rightShoe.position.x = 0.13;
    this.leftShoe.castShadow = this.rightShoe.castShadow = true;
    this.bodyGroup.add(this.leftShoe, this.rightShoe);

    this.camera.add(this.bodyGroup);
  }

  _bind() {
    const onKey = (down) => (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'ى') KEYS.w = down;
      else if (k === 'a' || k === 'ش') KEYS.a = down;
      else if (k === 's' || k === 'س') KEYS.s = down;
      else if (k === 'd' || k === 'ي') KEYS.d = down;
      else if (k === 'shift') KEYS.shift = down;
      else if (k === ' ') KEYS.space = down;
      // Arrow keys
      else if (e.key === 'ArrowUp') KEYS.w = down;
      else if (e.key === 'ArrowDown') KEYS.s = down;
      else if (e.key === 'ArrowLeft') KEYS.a = down;
      else if (e.key === 'ArrowRight') KEYS.d = down;
    };
    this._keyDown = onKey(true);
    this._keyUp = onKey(false);
    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup', this._keyUp);

    this._mouseMove = (e) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.05;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    };
    document.addEventListener('mousemove', this._mouseMove);

    this._lockChange = () => {
      this.locked = document.pointerLockElement === this.dom;
    };
    document.addEventListener('pointerlockchange', this._lockChange);
  }

  requestLock() {
    if (this.dom.requestPointerLock) this.dom.requestPointerLock();
  }

  isLocked() { return this.locked; }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  // Returns forward XZ unit vector based on yaw.
  forwardXZ(out = new THREE.Vector3()) {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out;
  }
  rightXZ(out = new THREE.Vector3()) {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out;
  }

  update(dt, collide) {
    // Apply rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;

    // Movement vector in world space
    const moveDir = new THREE.Vector3();
    const fwd = this.forwardXZ();
    const right = this.rightXZ();
    if (KEYS.w) moveDir.add(fwd);
    if (KEYS.s) moveDir.sub(fwd);
    if (KEYS.d) moveDir.add(right);
    if (KEYS.a) moveDir.sub(right);
    const moving = moveDir.lengthSq() > 0;
    if (moving) moveDir.normalize();

    let speed = MOVE_SPEED * (KEYS.shift ? RUN_MULT : 1);
    const nextPos = this.position.clone().addScaledVector(moveDir, speed * dt);

    // Collide with X then Z
    if (collide) {
      const tryX = this.position.clone();
      tryX.x = nextPos.x;
      if (!collide(tryX, this.radius)) this.position.x = tryX.x;
      const tryZ = this.position.clone();
      tryZ.z = nextPos.z;
      if (!collide(tryZ, this.radius)) this.position.z = tryZ.z;
    } else {
      this.position.copy(nextPos);
    }

    // Camera follows position
    this.camera.position.copy(this.position);

    // Subtle head bob while moving
    if (moving) {
      this.bobTime += dt * (KEYS.shift ? 11 : 8);
    } else {
      this.bobTime *= 0.92;
    }
    const bob = Math.sin(this.bobTime) * 0.025;
    this.camera.position.y = this.position.y + bob;

    // Animate legs to swing while moving
    const legSwing = moving ? Math.sin(this.bobTime) * 0.45 : 0;
    if (this.leftLeg && this.rightLeg) {
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftShoe.position.z = -0.22 + Math.sin(this.bobTime) * 0.22;
      this.rightShoe.position.z = -0.22 - Math.sin(this.bobTime) * 0.22;
    }
    // Arms gentle sway (in opposition to legs)
    if (this.leftArm && this.rightArm) {
      const armSwing = moving ? Math.sin(this.bobTime + Math.PI) * 0.25 : 0;
      this.leftArm.rotation.x = 0.05 + armSwing;
      this.rightArm.rotation.x = 0.05 - armSwing;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
    document.removeEventListener('mousemove', this._mouseMove);
    document.removeEventListener('pointerlockchange', this._lockChange);
  }
}
