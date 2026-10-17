import './ui/styles.css';
import * as THREE from 'three';

import { LEVELS } from './game/levels.ts';
import { Session } from './game/session.ts';
import { createStage } from './render/scene.ts';
import { createRoom } from './render/room.ts';
import { createHopper } from './render/hopper.ts';
import { createPins, pickPin } from './render/pins.ts';
import { createCoinField, createJar, createSparkles } from './render/coins.ts';
import type { CoinField, JarView, Sparkles } from './render/coins.ts';
import type { PinsView } from './render/pins.ts';
import type { HopperView } from './render/hopper.ts';
import { createSfx } from './audio/audio.ts';
import { createUI } from './ui/ui.ts';
import { loadSave, recordStars, writeSave } from './save/save.ts';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const stage = createStage(canvas);
const ui = createUI();
const sfx = createSfx();
let save = loadSave();

ui.setMuted(save.muted);
sfx.setMuted(save.muted);
ui.onMute((muted) => {
  sfx.setMuted(muted);
  ui.setMuted(muted);
  save = { ...save, muted };
  writeSave(save);
});

const room = createRoom();
stage.scene.add(room.group);

let levelIndex = 0;
let session: Session | null = null;
let hopper: HopperView | null = null;
let pins: PinsView | null = null;
let coins: CoinField | null = null;
let jar: JarView | null = null;
let sparkles: Sparkles | null = null;
let lastCollected = 0;
let combo = 0;
let ended = false;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function clearLevel(): void {
  if (hopper) {
    stage.scene.remove(hopper.group);
    hopper.dispose();
    hopper = null;
  }
  if (pins) {
    stage.scene.remove(pins.group);
    pins.dispose();
    pins = null;
  }
  if (coins) {
    stage.scene.remove(coins.mesh);
    coins.dispose();
    coins = null;
  }
  if (jar) {
    stage.scene.remove(jar.group);
    jar.dispose();
    jar = null;
  }
  if (sparkles) {
    stage.scene.remove(sparkles.points);
    sparkles.dispose();
    sparkles = null;
  }
}

function startLevel(index: number): void {
  clearLevel();
  levelIndex = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length;
  const level = LEVELS[levelIndex];

  session = new Session(level);
  hopper = createHopper(level);
  pins = createPins(level.pins);
  coins = createCoinField();
  jar = createJar(level);
  sparkles = createSparkles();

  stage.scene.add(hopper.group, pins.group, coins.mesh, jar.group, sparkles.points);

  lastCollected = 0;
  combo = 0;
  ended = false;

  ui.hideOverlay();
  ui.setLevel(levelIndex + 1, LEVELS.length);
  ui.setCounter(0);
  ui.showBanner(level.hint, 3600);
}

function onPointerDown(ev: PointerEvent): void {
  sfx.unlock();
  if (!session || !pins || session.finished) return;

  const rect = canvas.getBoundingClientRect();
  ndc.set(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const id = pickPin(raycaster, stage.camera, pins.group, ndc);
  if (!id) return;
  if (!session.pull(id)) return;

  pins.pull(id);
  sfx.pin();
  navigator.vibrate?.(12);
  ui.hideBanner();
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: true });

function handleEnd(): void {
  if (!session || ended) return;
  ended = true;
  const won = session.phase === 'won';
  const stars = session.stars;
  const ratio = Math.round(session.ratio * 100);

  if (won) {
    sfx.win();
    save = recordStars(save, session.level.id, stars);
    const last = levelIndex === LEVELS.length - 1;
    ui.showOverlay({
      title: last ? 'The loft is lit' : 'Restored',
      detail: `${session.collected} of ${session.total} coins in the glass (${ratio}%).`,
      stars,
      primary: last ? 'Play again' : 'Next level',
      onPrimary: () => startLevel(last ? 0 : levelIndex + 1),
      secondary: 'Retry',
      onSecondary: () => startLevel(levelIndex),
    });
  } else {
    sfx.lose();
    ui.showOverlay({
      title: 'Short of the mark',
      detail: `Only ${ratio}% of the gold reached the glass. It needs ${Math.round(
        session.level.target * 100,
      )}%.`,
      stars: 0,
      primary: 'Retry',
      onPrimary: () => startLevel(levelIndex),
    });
  }
}

let prev = performance.now();

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  if (session && coins && jar && sparkles && pins) {
    session.update(dt);

    coins.update(session.world.coinTransforms());
    jar.setFill(session.collected, session.total);

    if (session.collected > lastCollected) {
      const delta = session.collected - lastCollected;
      combo = Math.min(combo + delta, 14);
      for (let i = 0; i < delta; i++) sfx.coin(combo);
      sparkles.burst(
        LEVELS[levelIndex].jar.x,
        LEVELS[levelIndex].jar.y + 0.1,
        Math.min(4, delta + 1),
      );
      ui.setCounter(session.collected);
      lastCollected = session.collected;
      navigator.vibrate?.(6);
    }

    sparkles.update(dt);
    pins.update(dt);

    if (session.finished) handleEnd();
  }

  stage.render();
}

window.addEventListener('resize', () => stage.resize());
window.addEventListener('orientationchange', () => stage.resize());

startLevel(0);
requestAnimationFrame(frame);

// Offline support. Skipped in dev so a stale worker never fights HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      // Registration is a bonus; the game runs fine without it.
    });
  });
}
