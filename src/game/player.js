import * as THREE from 'three';

const KEYS = { w: false, a: false, s: false, d: false, shift: false, space: false, ctrl: false };
const MOVE_SPEED = 3.6;
const RUN_MULT = 1.6;
const SWIM_SPEED = 2.6;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.34;
const EYE_OFFSET = 0; // camera at this.position.y already

// Touch movement vector (set by external joystick).
const TOUCH = { mx: 0, my: 0, lookActive: false, lookId: -1 };

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
    this.swim = false; // swim mode allows vertical movement
    this.swimUp = 0;   // touch up button (0..1)
    this.swimDown = 0; // touch down button (0..1)
    this.bodyGroup = new THREE.Group();
    this._buildBody();
    this._bind();
  }

  _buildBody() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xe2b48a, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x29304a, roughness: 0.85 });
    const shoes = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.6, metalness: 0.1 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.35), cloth);
    torso.position.set(0, -0.7, -0.05);
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    const armGeom = new THREE.CapsuleGeometry(0.05, 0.45, 4, 8);
    this.leftArm = new THREE.Mesh(armGeom, skin);
    this.leftArm.position.set(-0.32, -0.95, -0.05);
    this.leftArm.rotation.x = 0.05;
    this.leftArm.castShadow = true;
    this.rightArm = this.leftArm.clone();
    this.rightArm.position.x = 0.32;
    this.bodyGroup.add(this.leftArm, this.rightArm);

    const handGeom = new THREE.SphereGeometry(0.07, 12, 12);
    this.leftHand = new THREE.Mesh(handGeom, skin);
    this.leftHand.position.set(-0.32, -1.22, -0.04);
    this.rightHand = this.leftHand.clone();
    this.rightHand.position.x = 0.32;
    this.bodyGroup.add(this.leftHand, this.rightHand);

    const legGeom = new THREE.CapsuleGeometry(0.11, 0.7, 4, 8);
    this.leftLeg = new THREE.Mesh(legGeom, cloth);
    this.leftLeg.position.set(-0.13, -1.25, -0.15);
    this.rightLeg = this.leftLeg.clone();
    this.rightLeg.position.x = 0.13;
    this.bodyGroup.add(this.leftLeg, this.rightLeg);

    const shoeGeom = new THREE.BoxGeometry(0.22, 0.1, 0.34);
    this.leftShoe = new THREE.Mesh(shoeGeom, shoes);
    this.leftShoe.position.set(-0.13, -1.62, -0.22);
    this.rightShoe = this.leftShoe.clone();
    this.rightShoe.position.x = 0.13;
    this.bodyGroup.add(this.leftShoe, this.rightShoe);

    this.camera.add(this.bodyGroup);
  }

  _bind() {
    // Use event.code (physical key position) so layout (QWERTY/AZERTY/Arabic/etc.)
    // never matters: the same physical keys always drive movement.
    const onKey = (down) => (e) => {
      const code = e.code;
      // Forward: physical-W (top-left letter) + Z (so AZERTY's "Z" key, which sits
      // where W is on QWERTY, also reads as KeyW on event.code; we add KeyZ in case
      // a remapped layout maps it differently)
      if (code === 'KeyW' || code === 'KeyZ' || code === 'ArrowUp') KEYS.w = down;
      else if (code === 'KeyA' || code === 'KeyQ' || code === 'ArrowLeft') KEYS.a = down;
      else if (code === 'KeyS' || code === 'ArrowDown') KEYS.s = down;
      else if (code === 'KeyD' || code === 'ArrowRight') KEYS.d = down;
      else if (code === 'ShiftLeft' || code === 'ShiftRight') KEYS.shift = down;
      else if (code === 'ControlLeft' || code === 'ControlRight') KEYS.ctrl = down;
      else if (code === 'Space') KEYS.space = down;
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

    // ---- Touch look on the canvas (any non-joystick area) ----
    this._touchStart = (e) => {
      for (const t of e.changedTouches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && (el.closest('#joystick-zone') || el.closest('.touch-btn') || el.closest('.overlay'))) continue;
        if (TOUCH.lookId !== -1) continue;
        TOUCH.lookId = t.identifier;
        TOUCH.lookActive = true;
        TOUCH.lastX = t.clientX;
        TOUCH.lastY = t.clientY;
        e.preventDefault();
        return;
      }
    };
    this._touchMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== TOUCH.lookId) continue;
        const dx = t.clientX - TOUCH.lastX;
        const dy = t.clientY - TOUCH.lastY;
        TOUCH.lastX = t.clientX;
        TOUCH.lastY = t.clientY;
        const sens = 0.005;
        this.yaw -= dx * sens;
        this.pitch -= dy * sens;
        const lim = Math.PI / 2 - 0.05;
        if (this.pitch > lim) this.pitch = lim;
        if (this.pitch < -lim) this.pitch = -lim;
        e.preventDefault();
        return;
      }
    };
    this._touchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === TOUCH.lookId) {
          TOUCH.lookId = -1;
          TOUCH.lookActive = false;
        }
      }
    };
    this.dom.addEventListener('touchstart', this._touchStart, { passive: false });
    this.dom.addEventListener('touchmove', this._touchMove, { passive: false });
    this.dom.addEventListener('touchend', this._touchEnd);
    this.dom.addEventListener('touchcancel', this._touchEnd);
  }

  setTouchMove(mx, my) {
    TOUCH.mx = mx;
    TOUCH.my = my;
  }

  setSwimUpInput(v) { this.swimUp = v; }
  setSwimDownInput(v) { this.swimDown = v; }

  requestLock() {
    if (this.dom.requestPointerLock) this.dom.requestPointerLock();
  }

  isLocked() { return this.locked; }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  forwardXZ(out = new THREE.Vector3()) {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out;
  }
  rightXZ(out = new THREE.Vector3()) {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out;
  }

  update(dt, collide) {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;

    const moveDir = new THREE.Vector3();
    const fwd = this.forwardXZ();
    const right = this.rightXZ();
    if (KEYS.w) moveDir.add(fwd);
    if (KEYS.s) moveDir.sub(fwd);
    if (KEYS.d) moveDir.add(right);
    if (KEYS.a) moveDir.sub(right);
    // Touch joystick: my>0 forward, mx>0 right
    if (TOUCH.mx !== 0 || TOUCH.my !== 0) {
      moveDir.addScaledVector(fwd, -TOUCH.my);
      moveDir.addScaledVector(right, TOUCH.mx);
    }
    const moving = moveDir.lengthSq() > 0;
    if (moving) moveDir.normalize();

    // Run only when not swimming (Shift doubles as descend underwater)
    const running = KEYS.shift && !this.swim;
    let speed = (this.swim ? SWIM_SPEED : MOVE_SPEED) * (running ? RUN_MULT : 1);
    const nextPos = this.position.clone().addScaledVector(moveDir, speed * dt);

    // Vertical movement (swim)
    if (this.swim) {
      let v = 0;
      if (KEYS.space) v += 1;          // Space = up
      if (KEYS.ctrl)  v -= 1;           // Ctrl = down
      if (KEYS.shift) v -= 1;           // Shift = down (run is meaningless underwater)
      v += this.swimUp;                 // touch up button
      v -= this.swimDown;               // touch down button
      // Clamp so combined inputs don't exceed ±1
      if (v > 1) v = 1; else if (v < -1) v = -1;
      this.position.y += v * SWIM_SPEED * dt;
    }

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

    this.camera.position.copy(this.position);

    if (moving) this.bobTime += dt * (KEYS.shift ? 11 : 8);
    else this.bobTime *= 0.92;

    const bob = this.swim ? Math.sin(this.bobTime * 0.3) * 0.04 : Math.sin(this.bobTime) * 0.025;
    this.camera.position.y = this.position.y + bob;

    const legSwing = moving ? Math.sin(this.bobTime) * 0.45 : 0;
    if (this.leftLeg && this.rightLeg) {
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftShoe.position.z = -0.22 + Math.sin(this.bobTime) * 0.22;
      this.rightShoe.position.z = -0.22 - Math.sin(this.bobTime) * 0.22;
    }
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
    this.dom.removeEventListener('touchstart', this._touchStart);
    this.dom.removeEventListener('touchmove', this._touchMove);
    this.dom.removeEventListener('touchend', this._touchEnd);
    this.dom.removeEventListener('touchcancel', this._touchEnd);
  }
}
