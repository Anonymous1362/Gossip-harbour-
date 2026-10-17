import * as THREE from 'three';
import type { CoinXf } from '../physics/world.ts';
import { COIN_R } from '../physics/world.ts';
import type { LevelDef } from '../game/types.ts';
import { makeGlowTexture } from './scene.ts';

const MAX_COINS = 250;

export interface CoinField {
  mesh: THREE.InstancedMesh;
  update(coins: CoinXf[]): void;
  dispose(): void;
}

export function createCoinField(): CoinField {
  // 12 radial segments: ~48 tris per coin, cheap enough for 250 instances.
  const geo = new THREE.CylinderGeometry(COIN_R, COIN_R, 0.055, 12);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffc531',
    metalness: 0.92,
    roughness: 0.26,
    emissive: new THREE.Color('#5a3a00'),
    emissiveIntensity: 0.55,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_COINS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();

  return {
    mesh,
    update(coins) {
      const n = Math.min(coins.length, MAX_COINS);
      for (let i = 0; i < n; i++) {
        const c = coins[i];
        // A little z stagger so the stream reads as depth, not a decal.
        const z = ((i % 9) - 4) * 0.035;
        pos.set(c.x, c.y, z);
        euler.set(0, 0, c.a);
        q.setFromEuler(euler);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export interface JarView {
  group: THREE.Group;
  setFill(collected: number, total: number): void;
  dispose(): void;
}

/** The glass plus the pile of coins that has landed in it. */
export function createJar(level: LevelDef): JarView {
  const { x, y, width, height } = level.jar;
  const group = new THREE.Group();
  group.position.set(x, y, 0.35);

  const glassGeo = new THREE.CylinderGeometry(width / 2, width / 2 * 0.82, height, 22, 1, true);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#cfe9ff',
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.y = -height / 2;
  group.add(glass);

  const baseGeo = new THREE.CylinderGeometry(width / 2 * 0.82, width / 2 * 0.82, 0.06, 22);
  const base = new THREE.Mesh(baseGeo, glassMat);
  base.position.y = -height;
  group.add(base);

  const rimGeo = new THREE.TorusGeometry(width / 2, 0.035, 6, 26);
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#e8f6ff',
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  // --- the pile -------------------------------------------------------------
  const slots: THREE.Vector3[] = [];
  const spanX = width - 0.36;
  const spanZ = 0.9;
  for (let row = 0; row < 7; row++) {
    for (let iz = 0; iz < 3; iz++) {
      for (let ix = 0; ix < 4; ix++) {
        slots.push(
          new THREE.Vector3(
            -spanX / 2 + ix * (spanX / 3),
            -height + 0.16 + row * 0.24,
            -spanZ / 2 + iz * (spanZ / 2),
          ),
        );
      }
    }
  }
  const filled = slots.length;
  const pileGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, 0.05, 10);
  pileGeo.rotateX(Math.PI / 2);
  const pileMat = new THREE.MeshStandardMaterial({
    color: '#ffc531',
    metalness: 0.9,
    roughness: 0.3,
    emissive: new THREE.Color('#7a4c00'),
    emissiveIntensity: 0.5,
  });
  const pile = new THREE.InstancedMesh(pileGeo, pileMat, filled);
  pile.count = 0;
  group.add(pile);

  const glowTex = makeGlowTexture('rgba(255,226,150,1)', 'rgba(255,170,40,0)');
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(3.4, 3.4, 1);
  glow.position.y = -height * 0.55;
  group.add(glow);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const e = new THREE.Euler();

  return {
    group,
    setFill(collected, total) {
      const ratio = total > 0 ? collected / total : 0;
      const n = Math.min(filled, Math.round(ratio * filled * 1.15));
      for (let i = 0; i < n; i++) {
        const p = slots[i];
        e.set(0, 0, (i % 5) * 0.4);
        q.setFromEuler(e);
        m.compose(p, q, s);
        pile.setMatrixAt(i, m);
      }
      pile.count = n;
      pile.instanceMatrix.needsUpdate = true;
      glowMat.opacity = Math.min(0.85, ratio * 1.1);
    },
    dispose() {
      glassGeo.dispose();
      baseGeo.dispose();
      rimGeo.dispose();
      pileGeo.dispose();
      glassMat.dispose();
      rimMat.dispose();
      pileMat.dispose();
      glowMat.dispose();
      glowTex.dispose();
    },
  };
}

export interface Sparkles {
  points: THREE.Points;
  burst(x: number, y: number, count: number): void;
  update(dt: number): void;
  dispose(): void;
}

/** Pooled additive points; one burst per coin that lands in the glass. */
export function createSparkles(max = 220): Sparkles {
  const positions = new Float32Array(max * 3);
  const alphas = new Float32Array(max);
  const vx = new Float32Array(max);
  const vy = new Float32Array(max);
  const life = new Float32Array(max);
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const tex = makeGlowTexture('rgba(255,240,190,1)', 'rgba(255,190,60,0)');
  const mat = new THREE.PointsMaterial({
    size: 0.26,
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.95,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  for (let i = 0; i < max; i++) positions[i * 3 + 1] = -999;

  return {
    points,
    burst(x, y, count) {
      for (let i = 0; i < count; i++) {
        const idx = cursor;
        cursor = (cursor + 1) % max;
        positions[idx * 3] = x + (Math.random() - 0.5) * 0.7;
        positions[idx * 3 + 1] = y + Math.random() * 0.25;
        positions[idx * 3 + 2] = 0.45;
        vx[idx] = (Math.random() - 0.5) * 2.4;
        vy[idx] = 0.8 + Math.random() * 2.2;
        life[idx] = 0.36 + Math.random() * 0.34;
        alphas[idx] = 1;
      }
      geo.attributes.position.needsUpdate = true;
    },
    update(dt) {
      let dirty = false;
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        dirty = true;
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -999;
          alphas[i] = 0;
          continue;
        }
        vy[i] -= 7.5 * dt;
        positions[i * 3] += vx[i] * dt;
        positions[i * 3 + 1] += vy[i] * dt;
      }
      if (dirty) {
        geo.attributes.position.needsUpdate = true;
        // Fade handled per-point via the shared material; individual alpha is not
        // supported by PointsMaterial, so the short life keeps it from lingering.
        mat.opacity = 0.95;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
