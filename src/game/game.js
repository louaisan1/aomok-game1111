import * as THREE from 'three';
import { createRenderer, createScene, createCamera, addBaseLighting } from './scene.js';
import { Player } from './player.js';
import { buildRoom, pointCollidesAABB, ROOM } from './room.js';
import { buildUnderwaterRoom } from './underwater.js';
import { generateTokens, evaluateTokens } from '../equation.js';
import {
  setupHUD,
  showResult,
  InventoryUI,
  EquationUI,
  TimerUI,
  showPrompt,
  hidePrompt
} from './ui.js';
import { recordResult } from '../firebase.js';
import { DOOR_COLORS, colorHexToCss } from './colors.js';

const INTERACT_RANGE = 2.6;
const KEY_PICKUP_RANGE = 1.0;
const TIMER_DURATION = 5 * 60 * 1000;

export function startGame({ name, room, sessionId }) {
  setupHUD({ name, room });

  const canvas = document.getElementById('game-canvas');
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const camera = createCamera();
  scene.add(camera);

  addBaseLighting(scene);

  const tokens = generateTokens();
  const roomData = buildRoom(scene, tokens);
  const underwater = buildUnderwaterRoom(scene);

  const player = new Player(camera, canvas);
  player.setPosition(0, 1.7, 4);

  const inventoryUI = new InventoryUI();
  inventoryUI.registerKeys(DOOR_COLORS);

  let endedReason = null;
  const equationUI = new EquationUI({
    onSubmit: (eqTokens, value) => {
      if (Math.abs(value - 7) < 1e-9) {
        end({ won: true, equation: prettyEq(eqTokens), value });
      } else {
        // Quick negative feedback; not a hard fail (player can re-edit)
        showPrompt('المعادلة لا تساوي 7. حاول مجددًا.', '#ff5d6c');
        setTimeout(() => hidePrompt(), 1500);
      }
    }
  });

  const timer = new TimerUI(TIMER_DURATION, {
    onExpire: () => end({ won: false, message: 'انتهى الوقت! غرقت في الماء.' })
  });

  const collectedKeys = new Set();
  let inUnderwater = false;
  let interactionTarget = null;

  function pickRoom() { return inUnderwater ? underwater : roomData; }

  function collide(pos, radius) {
    if (inUnderwater) {
      // Walls of underwater room (translated already)
      for (const c of underwater.colliders) {
        if (pointCollidesAABB(pos.x, pos.z, radius, c)) return true;
      }
      return false;
    }
    for (const c of roomData.colliders) {
      if (c.doorIndex !== undefined) {
        const door = roomData.doors[c.doorIndex];
        if (door.opened) continue;
      }
      if (pointCollidesAABB(pos.x, pos.z, radius, c)) return true;
    }
    return false;
  }

  function onClick() {
    if (!player.isLocked()) {
      player.requestLock();
      return;
    }
    if (interactionTarget) interact(interactionTarget);
  }

  document.addEventListener('click', (e) => {
    // Avoid clicks on UI buttons
    if (e.target instanceof HTMLElement && e.target.closest('button, input, label, .panel, #equation-bar, #inventory, #player-info, #timer-wrap')) return;
    onClick();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
      if (interactionTarget) interact(interactionTarget);
    }
  });

  function interact(target) {
    if (target.type === 'key') {
      collectKey(target.key);
    } else if (target.type === 'door') {
      tryOpenDoor(target.door);
    } else if (target.type === 'trapdoor') {
      descend();
    } else if (target.type === 'card') {
      // Just feedback
      showPrompt('بطاقة الحل: <b>= 7</b>', '#ffcf5c');
      setTimeout(hidePrompt, 1800);
    }
  }

  function collectKey(key) {
    if (key.collected) return;
    key.collected = true;
    key.mesh.visible = false;
    collectedKeys.add(key.index);
    inventoryUI.collect(key.index);
    showPrompt(`التقطت مفتاح <b style="color:${colorHexToCss(key.color.hex)}">${key.color.name}</b>`, colorHexToCss(key.color.hex));
    setTimeout(hidePrompt, 1200);
  }

  function tryOpenDoor(door) {
    if (door.opened) return;
    if (!collectedKeys.has(door.index)) {
      showPrompt(`تحتاج مفتاحًا <b style="color:${colorHexToCss(door.color.hex)}">${door.color.name}</b>`, colorHexToCss(door.color.hex));
      setTimeout(hidePrompt, 1500);
      return;
    }
    door.opened = true;
    equationUI.addOpenedDoor(door);
    showPrompt(`فتحت الباب رقم ${door.index + 1}: <b>${prettyToken(door.token)}</b>`, colorHexToCss(door.color.hex));
    setTimeout(hidePrompt, 1400);
  }

  function descend() {
    if (roomData.trapdoor.opened) return;
    roomData.trapdoor.opened = true;
    timer.startTimer();
    // Animate underwater scene visible, teleport player.
    underwater.group.visible = true;
    document.body.classList.add('underwater');
    inUnderwater = true;
    // Place player just inside underwater room
    player.setPosition(underwater.spawn.x, underwater.spawn.y, underwater.spawn.z);
  }

  function ascend() {
    underwater.group.visible = false;
    document.body.classList.remove('underwater');
    inUnderwater = false;
    player.setPosition(0, 1.7, 4);
  }

  let ended = false;
  async function end({ won, equation, value, message }) {
    if (ended) return;
    ended = true;
    timer.stopTimer();
    showResult({ won, equation, value, message });
    document.exitPointerLock?.();
    // Persist result
    try {
      await recordResult({
        name, room, sessionId,
        result: won ? 'won' : 'lost',
        equation: equation ?? null,
        value: typeof value === 'number' ? value : null,
        elapsedMs: timer.elapsed()
      });
    } catch (_) { /* ignore */ }
  }

  document.getElementById('result-restart').onclick = () => {
    window.location.reload();
  };

  // Window resize
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Animation loop
  const clock = new THREE.Clock();
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (!ended) {
      player.update(dt, collide);

      // Animate keys (bobbing)
      roomData.keys.forEach((k) => {
        if (k.collected) return;
        k.mesh.position.y = 0.4 + Math.sin(t * 2 + k.bobPhase) * 0.07;
        k.mesh.rotation.y += dt * 0.6;
      });
      // Doors: open animation
      roomData.doors.forEach((d) => {
        const target = d.opened ? 1 : 0;
        d.openProgress += (target - d.openProgress) * Math.min(1, dt * 4);
        const angle = d.openProgress * Math.PI * 0.55; // 100°
        d.panelPivot.rotation.y = -angle;
        d.tokenMat.opacity = d.openProgress;
      });
      // Trapdoor animation
      const td = roomData.trapdoor;
      const tgt = td.opened ? 1 : 0;
      td.openProgress += (tgt - td.openProgress) * Math.min(1, dt * 3);
      td.hatchPivot.rotation.z = td.openProgress * Math.PI * 0.55;

      underwater.update(dt, t);

      updateInteractionTarget();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateInteractionTarget() {
    const cam = camera;
    const camPos = new THREE.Vector3();
    cam.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    cam.getWorldDirection(camDir);

    let best = null;
    let bestScore = -Infinity;

    // Helper: determine if a position is "in front" of the camera within range and angle.
    function consider(target, point, range) {
      const to = point.clone().sub(camPos);
      const dist = to.length();
      if (dist > range) return;
      to.normalize();
      const dot = to.dot(camDir);
      if (dot < 0.5) return; // ~60° cone
      const score = dot - dist * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = target;
      }
    }

    if (!inUnderwater) {
      // Keys (use pickup range; auto-collect proximity also handled below)
      roomData.keys.forEach((k) => {
        if (k.collected) return;
        consider({ type: 'key', key: k }, k.mesh.position.clone(), INTERACT_RANGE);
      });
      // Doors
      roomData.doors.forEach((d) => {
        if (d.opened) return;
        consider({ type: 'door', door: d }, d.position.clone(), INTERACT_RANGE);
      });
      // Trapdoor
      consider({ type: 'trapdoor' }, roomData.trapdoor.position.clone().add(new THREE.Vector3(0, 0.5, 0)), INTERACT_RANGE);

      // Auto-pickup very close keys (no need to look at them)
      roomData.keys.forEach((k) => {
        if (k.collected) return;
        const d = camPos.distanceTo(k.mesh.position);
        if (d < KEY_PICKUP_RANGE) collectKey(k);
      });
    } else {
      consider({ type: 'card' }, underwater.card.position.clone().add(new THREE.Vector3(underwater.group.position.x, underwater.group.position.y, underwater.group.position.z)), INTERACT_RANGE);
      // Actually card is child of underwater.group which is positioned. The card.position is local. So world pos:
      const cardWorld = new THREE.Vector3();
      underwater.card.getWorldPosition(cardWorld);
      consider({ type: 'card' }, cardWorld, INTERACT_RANGE);
    }

    interactionTarget = best;
    if (best) {
      if (best.type === 'key') {
        showPrompt(`اضغط <b>E</b> لالتقاط مفتاح <b style="color:${colorHexToCss(best.key.color.hex)}">${best.key.color.name}</b>`);
      } else if (best.type === 'door') {
        const have = collectedKeys.has(best.door.index);
        showPrompt(have
          ? `اضغط <b>E</b> لفتح الباب رقم <b>${best.door.index + 1}</b>`
          : `الباب مغلق. تحتاج مفتاح <b style="color:${colorHexToCss(best.door.color.hex)}">${best.door.color.name}</b>`);
      } else if (best.type === 'trapdoor') {
        showPrompt('اضغط <b>E</b> لفتح الباب الأرضي والنزول إلى غرفة الماء');
      } else if (best.type === 'card') {
        showPrompt('اضغط <b>E</b> لقراءة بطاقة الحل');
      }
    } else {
      hidePrompt();
    }
  }

  loop();

  return { player };
}

function prettyToken(t) {
  if (t === '*') return '×';
  if (t === '/') return '÷';
  return t;
}
function prettyEq(tokens) {
  return tokens.map(prettyToken).join(' ');
}
