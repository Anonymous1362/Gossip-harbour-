import * as THREE from 'three';
import type { LevelDef } from '../game/types.ts';
import { pinRods } from '../game/pinGeometry.ts';

const ROD_R = 0.042;
const HEAD_R = 0.085;
const SOCKET_R = 0.088;
const SOCKET_L = 0.16;
const FLY_TIME = 0.5;

type FadeMaterial = THREE.MeshStandardMaterial;

interface Flying {
  group: THREE.Group;
  dir: THREE.Vector2;
  t: number;
  mats: FadeMaterial[];
}

export interface PinsView {
  group: THREE.Group;
  /** Removes the pin from the board and starts the flick-away animation. */
  pull(id: string): void;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Pins are rods mounted *through* the hopper shell: each one crosses the wall, gets a
 * socket cap at the crossing, and a ball head on the end that sticks out. The geometry
 * comes from `pinRods`, the same source the physics collider uses, so a rod can never
 * be drawn floating in mid-air while its collider sits somewhere else.
 */
export function createPins(level: LevelDef): PinsView {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const flying: Flying[] = [];
  const owned: Array<THREE.Material> = [];

  const rodGeo = new THREE.CylinderGeometry(ROD_R, ROD_R * 0.92, 1, 8);
  rodGeo.rotateZ(Math.PI / 2); // lie along X so length maps to the rod
  const headGeo = new THREE.SphereGeometry(HEAD_R, 10, 8);
  const socketGeo = new THREE.CylinderGeometry(SOCKET_R, SOCKET_R * 1.08, SOCKET_L, 10);
  socketGeo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(SOCKET_R * 1.04, 0.017, 6, 14);
  ringGeo.rotateY(Math.PI / 2); // washer plane faces along the rod
  geos.push(rodGeo, headGeo, socketGeo, ringGeo);

  const baseMat = new THREE.MeshStandardMaterial({
    color: '#9feadc',
    metalness: 0.35,
    roughness: 0.28,
    emissive: new THREE.Color('#2fd8c0'),
    emissiveIntensity: 0.55,
  });
  const headMatBase = new THREE.MeshStandardMaterial({
    color: '#ffe2b0',
    metalness: 0.2,
    roughness: 0.3,
    emissive: new THREE.Color('#ff9a3c'),
    emissiveIntensity: 0.4,
  });
  const socketMatBase = new THREE.MeshStandardMaterial({
    color: '#6fc4b8',
    metalness: 0.5,
    roughness: 0.35,
    emissive: new THREE.Color('#1c8e7e'),
    emissiveIntensity: 0.35,
  });
  const ringMatBase = new THREE.MeshStandardMaterial({
    color: '#ffd8a4',
    metalness: 0.6,
    roughness: 0.25,
    emissive: new THREE.Color('#8a5a20'),
    emissiveIntensity: 0.3,
  });
  owned.push(baseMat, headMatBase, socketMatBase, ringMatBase);

  const live = new Map<string, THREE.Group>();

  pinRods(level).forEach((rod, index) => {
    // A small depth stagger keeps overlapping rods readable as a lattice instead of
    // one thick bar when two pins end up at the same height.
    const g = new THREE.Group();
    g.position.set(rod.center.x, rod.center.y, 0.1 + index * 0.045);
    g.rotation.z = rod.angle;

    const rodMat = baseMat.clone();
    const headMat = headMatBase.clone();
    const socketMat = socketMatBase.clone();
    const ringMat = ringMatBase.clone();
    owned.push(rodMat, headMat, socketMat, ringMat);

    const rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.scale.x = rod.length;
    g.add(rodMesh);

    const ux = Math.cos(rod.angle);
    const uy = Math.sin(rod.angle);
    const localX = (p: { x: number; y: number }): number =>
      (p.x - rod.center.x) * ux + (p.y - rod.center.y) * uy;

    // Ball heads on the outside end(s).
    for (const head of rod.heads) {
      const h = new THREE.Mesh(headGeo, headMat);
      h.position.x = localX(head);
      g.add(h);
    }

    // Socket cap + washer at every point the rod passes through the shell. The washer
    // faces the nearest outside end, which for a through-rod is not always the first
    // head in the list.
    const headXs = rod.heads.map(localX);
    for (const socket of rod.sockets) {
      const x = localX(socket);
      const cap = new THREE.Mesh(socketGeo, socketMat);
      cap.position.x = x;
      g.add(cap);

      const nearestHead = headXs.reduce(
        (best, hx) => (Math.abs(hx - x) < Math.abs(best - x) ? hx : best),
        headXs[0] ?? x + 1,
      );
      const outward = Math.sign(nearestHead - x) || 1;
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.x = x + outward * (SOCKET_L / 2);
      g.add(ring);
    }

    // Generous invisible collider so the tap target clears 44px on a phone.
    // colorWrite:false keeps it invisible without making the mesh un-raycastable.
    const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    owned.push(hitMat);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(rod.length + 0.5, 0.56, 0.56), hitMat);
    hit.userData.pinId = rod.id;
    g.add(hit);
    hit.name = `pin:${rod.id}`;

    group.add(g);
    live.set(rod.id, g);
  });

  return {
    group,
    pull(id) {
      const g = live.get(id);
      if (!g) return;
      live.delete(id);
      const mats: FadeMaterial[] = [];
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material;
          if (m instanceof THREE.MeshStandardMaterial) mats.push(m);
        }
      });
      // The reference flicks pins up and to the left, whatever their slot.
      flying.push({
        group: g,
        dir: new THREE.Vector2(-0.62, 0.78).normalize(),
        t: 0,
        mats,
      });
    },
    update(dt) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.t += dt;
        const k = Math.min(1, f.t / FLY_TIME);
        // Fast out, long tail: speed decays with (1 - k) so the rod leaps and drifts.
        const speed = 34 * (1 - k) ** 2;
        f.group.position.x += f.dir.x * speed * dt;
        f.group.position.y += f.dir.y * speed * dt;
        f.group.rotation.z += dt * 2.2;
        for (const m of f.mats) {
          m.transparent = true;
          m.opacity = 1 - k;
        }
        if (k >= 1) {
          group.remove(f.group);
          for (const m of f.mats) m.dispose();
          flying.splice(i, 1);
        }
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of owned) m.dispose();
    },
  };
}

/** Raycasts a screen point against pin hit boxes; returns the pin id or null. */
export function pickPin(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  group: THREE.Group,
  ndc: THREE.Vector2,
): string | null {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(group.children, true);
  for (const hit of hits) {
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      const id = o.userData.pinId;
      if (typeof id === 'string') return id;
      o = o.parent;
    }
  }
  return null;
}
