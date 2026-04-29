import * as THREE from 'three';
import { createRenderer, createScene, createCamera, addBaseLighting } from './scene.js';
import { Player } from './player.js';
import { buildRoom, pointCollidesAABB, ROOM } from './room.js';
import { createWater } from './water.js';
import { generatePuzzle, evaluateTokens, prettyEquation } from '../equation.js';
import {
  setupHUD,
  showResult,
  TimerUI,
  setupTouchUI,
  showPrompt,
  hidePrompt,
  showBigNotice,
  hideBigNotice,
  updateLiveEquation,
  setDiveButtonVisible
} from './ui.js';
import { recordResult } from '../firebase.js';

const INTERACT_RANGE = 3.4;
const TIMER_DURATION = 5 * 60 * 1000;
const PLAYER_HEIGHT = 1.72;

export function startGame({ name, room, sessionId }) {
  setupHUD({ name, room });

  const canvas = document.getElementById('game-canvas');
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const camera = createCamera();
  scene.add(camera);

  addBaseLighting(scene);

  const puzzle = generatePuzzle();
  const roomData = buildRoom(scene, puzzle.doorTokens);
  const water = createWater(scene);

  const player = new Player(camera, canvas);
  player.setPosition(0, PLAYER_HEIGHT, 4);

  const timer = new TimerUI({
    durationMs: TIMER_DURATION,
    onTimeout: () => {
      end({ won: false, message: 'انتهى الوقت! غرقت في الماء.' });
    }
  });

  // Open order tracker: array of door indices in temporal order.
  // Closing a door removes it from this list (preserves position-of-others).
  const openOrder = [];
  let interactionTarget = null;
  let trapdoorOpened = false;
  let goalRevealed = false;
  let ended = false;

  setupTouchUI({
    player,
    onInteract: () => { if (interactionTarget) interact(interactionTarget); }
  });

  // Debug helpers via URL params
  const params = new URLSearchParams(location.search);
  const debug = params.get('debug') || '';
  if (debug.includes('near')) {
    player.setPosition(0, PLAYER_HEIGHT, 1.0);
  }
  if (debug.includes('open')) {
    // Open in solution order
    puzzle.solutionDoorOrder.forEach((idx) => {
      const d = roomData.doors[idx];
      d.opened = true;
      openOrder.push(idx);
    });
  }
  if (debug) {
    window.__game = { player, roomData, water, timer, puzzle, openOrder, end };
  }

  function collide(pos, radius) {
    for (const c of roomData.colliders) {
      if (pointCollidesAABB(pos.x, pos.z, radius, c)) return true;
    }
    return false;
  }

  function isTouchDevice() {
    return matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
  }

  function onClick() {
    if (!player.isLocked() && !isTouchDevice()) {
      player.requestLock();
      return;
    }
    if (interactionTarget) interact(interactionTarget);
  }

  document.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('button, input, label, .panel, #player-info, #timer-wrap, #touch-ui')) return;
    onClick();
  });

  document.addEventListener('keydown', (e) => {
    // event.code is layout-independent: physical key in the position of "E"
    // on a US keyboard always reads as 'KeyE', whether the user is on
    // QWERTY, AZERTY, Arabic, etc.
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (interactionTarget) interact(interactionTarget);
    }
  });

  function interact(target) {
    if (target.type === 'door') {
      toggleDoor(target.door);
    } else if (target.type === 'trapdoor') {
      openTrapdoor();
    }
  }

  function toggleDoor(door) {
    if (ended) return;
    if (door.opened) {
      door.opened = false;
      const idx = openOrder.indexOf(door.index);
      if (idx !== -1) openOrder.splice(idx, 1);
      showPrompt(`أُغلق الباب رقم <b>${door.index + 1}</b>`);
    } else {
      door.opened = true;
      openOrder.push(door.index);
      showPrompt(`فُتح الباب رقم <b>${door.index + 1}</b> (${displayToken(door.token)})`);
    }
    setTimeout(hidePrompt, 900);
    updateLiveEquation(openOrder, roomData.doors);
    checkWin();
  }

  function displayToken(t) {
    if (t === '*') return '×';
    if (t === '/') return '÷';
    return t;
  }

  function openTrapdoor() {
    if (trapdoorOpened) return;
    trapdoorOpened = true;
    roomData.trapdoor.opened = true;
    timer.startTimer();
    if (!goalRevealed) {
      goalRevealed = true;
      showBigNotice(
        '⚠️ بدأ الغرق! افتح الأبواب العشرة بترتيب يجعل القراءة من اليسار لليمين معادلةً تساوي <b>7</b>.<br>'
        + 'ترتيب الفتح هو الترتيب الذي ستظهر به في المعادلة. أغلق أيّ باب لإزالته.',
        9000
      );
    }
  }

  function tokensInOrder() {
    return openOrder.map((idx) => roomData.doors[idx].token);
  }

  function checkWin() {
    if (ended) return;
    if (openOrder.length !== 10) return;
    const tokens = tokensInOrder();
    const v = evaluateTokens(tokens);
    if (v !== null && Math.abs(v - 7) < 1e-9) {
      end({ won: true, equation: prettyEquation(tokens), value: 7 });
    }
  }

  async function end({ won, equation, value, message }) {
    if (ended) return;
    ended = true;
    timer.stopTimer();
    document.exitPointerLock?.();
    if (won) {
      hideBigNotice();
      revealTreasure();
      setTimeout(() => showResult({ won, name, equation, value }), 1500);
    } else {
      showResult({ won, name, message });
    }
    try {
      await recordResult({
        name, room, sessionId,
        result: won ? 'won' : 'lost',
        equation: equation ?? null,
        value: typeof value === 'number' ? value : null,
        elapsedMs: Math.round(timer.elapsed())
      });
    } catch (_) { /* ignore */ }
  }

  function revealTreasure() {
    const chest = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x6a4715, roughness: 0.55, metalness: 0.4,
      emissive: 0x4a2e07, emissiveIntensity: 0.3
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd57a, roughness: 0.2, metalness: 0.9,
      emissive: 0xffb44a, emissiveIntensity: 0.45
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), baseMat);
    body.position.y = 0.45;
    chest.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.0), baseMat);
    lid.position.set(0, 1.05, -0.4);
    lid.rotation.x = -0.6;
    chest.add(lid);
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 0.06), goldMat);
      band.position.set(0, 0.2 + i * 0.18, 0.51);
      chest.add(band);
    }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.06), goldMat);
    lock.position.set(0, 0.55, 0.51);
    chest.add(lock);
    const coinGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12);
    for (let i = 0; i < 14; i++) {
      const coin = new THREE.Mesh(coinGeom, goldMat);
      coin.position.set(
        (Math.random() - 0.5) * 1.0,
        0.95 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.5
      );
      coin.rotation.set(Math.random(), Math.random(), Math.random());
      chest.add(coin);
    }
    const treasureLight = new THREE.PointLight(0xffd58a, 4, 10, 1.4);
    treasureLight.position.set(0, 1.6, 0);
    chest.add(treasureLight);
    chest.position.set(0, 0, 0);
    scene.add(chest);
  }

  document.getElementById('result-restart').onclick = () => window.location.reload();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Frame budget: throttle water vertex updates (most expensive). Render at the
  // monitor refresh rate but only animate water every other frame.
  const clock = new THREE.Clock();
  let frameCount = 0;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    frameCount++;

    if (!ended) {
      // Swim mode kicks in when water rises above the player's waist.
      const SWIM_THRESHOLD = 1.0;
      const willSwim = water.level > SWIM_THRESHOLD;
      const justEnteredSwim = willSwim && !player.swim;
      const justLeftSwim = !willSwim && player.swim;
      player.swim = willSwim;
      if (justEnteredSwim) setDiveButtonVisible(true);
      if (justLeftSwim) setDiveButtonVisible(false);
      const submerged = water.level > 0.05 && (player.position.y - 0.2) < water.level;
      document.body.classList.toggle('submerged', submerged);

      if (player.swim) {
        if (justEnteredSwim) {
          player.position.y = Math.min(player.position.y, water.level + 0.1);
        }
        // Allow descending all the way to the ground (head ~0.5m above floor).
        if (player.position.y < 0.5) player.position.y = 0.5;
        const headMax = water.level + 0.1;
        if (player.position.y > headMax) player.position.y = headMax;
      } else {
        player.position.y = PLAYER_HEIGHT;
      }

      player.update(dt, collide);

      if (water.level >= ROOM.H - 0.5 && !ended) {
        end({ won: false, message: 'غمرك الماء بالكامل.' });
      }

      // Door visuals: rotate colored panel aside, fade the white sign in
      roomData.doors.forEach((d) => {
        const target = d.opened ? 1 : 0;
        d.openProgress += (target - d.openProgress) * Math.min(1, dt * 5);
        d.panelPivot.rotation.y = -d.openProgress * Math.PI * 0.55;
        d.signMat.opacity = d.openProgress;
      });

      const td = roomData.trapdoor;
      const tgt = td.opened ? 1 : 0;
      td.openProgress += (tgt - td.openProgress) * Math.min(1, dt * 3);
      td.hatchPivot.rotation.z = td.openProgress * Math.PI * 0.55;

      // Water update: skip vertex ripple every other frame
      const animateWater = (frameCount & 1) === 0;
      water.update(dt, t, timer.progress(), animateWater);
      timer.tick();

      // Continuous win check (cheap; idempotent due to ended flag)
      checkWin();

      updateInteractionTarget();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateInteractionTarget() {
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    let best = null;
    let bestScore = -Infinity;

    function consider(target, point, range) {
      const to = point.clone().sub(camPos);
      const dist = to.length();
      if (dist > range) return;
      to.normalize();
      const dot = to.dot(camDir);
      if (dot < 0.4) return;
      const score = dot - dist * 0.05;
      if (score > bestScore) { bestScore = score; best = target; }
    }

    roomData.doors.forEach((d) => {
      consider({ type: 'door', door: d }, d.position.clone(), INTERACT_RANGE);
    });
    if (!roomData.trapdoor.opened) {
      consider({ type: 'trapdoor' }, roomData.trapdoor.position.clone().add(new THREE.Vector3(0, 0.5, 0)), INTERACT_RANGE);
    }

    interactionTarget = best;
    if (best) {
      if (best.type === 'door') {
        const d = best.door;
        const orderIdx = openOrder.indexOf(d.index);
        if (d.opened) {
          showPrompt(`اضغط <b>E</b> لإغلاق الباب <b>${d.index + 1}</b> · حالياً موضعه ${orderIdx + 1} في المعادلة`);
        } else {
          showPrompt(`اضغط <b>E</b> لفتح الباب <b>${d.index + 1}</b>`);
        }
      } else if (best.type === 'trapdoor') {
        showPrompt('اضغط <b>E</b> لفتح الباب الأرضي');
      }
    } else {
      hidePrompt();
    }
  }

  loop();

  return { player };
}
