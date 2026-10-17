import * as THREE from 'three';
import type { PinDef } from '../game/types.ts';

const ROD_R = 0.05;
const HEAD_R = 0.11;
const FLY_TIME = 0.5;

interface Flying {
  group: THREE.Group;
  dir: THREE.Vector2;
  t: number;
  rodMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
}

export interface PinsView {
  group: THREE.Group;
  /** Removes the pin from the board and starts the flick-away animation. */
  pull(id: string): void;
  update(dt: number): void;
  dispose(): void;
}

export function createPins(pins: PinDef[]): PinsView {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const flying: Flying[] = [];

  const rodGeo = new THREE.CylinderGeometry(ROD_R, ROD_R * 0.92, 1, 8);
  rodGeo.rotateZ(Math.PI / 2); // lie along X so length maps to the body
  const headGeo = new THREE.SphereGeometry(HEAD_R, 10, 8);
  geos.push(rodGeo, headGeo);

  const baseMat = new THREE.MeshStandardMaterial({
    color: '#8ee7d8',
    metalness: 0.25,
    roughness: 0.25,
    emissive: new THREE.Color('#2fd8c0'),
    emissiveIntensity: 0.75,
  });
  const headMatBase = new THREE.MeshStandardMaterial({
    color: '#ffd9a0',
    metalness: 0.2,
    roughness: 0.3,
    emissive: new THREE.Color('#ff9a3c'),
    emissiveIntensity: 0.55,
  });

  const live = new Map<string, THREE.Group>();

  for (const pin of pins) {
    const g = new THREE.Group();
    g.position.set(pin.x, pin.y, 0.14);
    g.rotation.z = pin.angle;

    const rodMat = baseMat.clone();
    const headMat = headMatBase.clone();
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.scale.x = pin.length;
    g.add(rod);

    // Heads sit at the left end, as in the reference comb.
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.x = -pin.length / 2;
    g.add(head);

    // Generous invisible collider so the tap target clears 44px on a phone.
    // colorWrite:false keeps it invisible without making the mesh un-raycastable.
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(pin.length + 0.5, 0.56, 0.56),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    hit.userData.pinId = pin.id;
    g.add(hit);
    hit.name = `pin:${pin.id}`;

    group.add(g);
    live.set(pin.id, g);
  }

  return {
    group,
    pull(id) {
      const g = live.get(id);
      if (!g) return;
      live.delete(id);
      // The reference flicks pins up and to the left, whatever their slot.
      const dir = new THREE.Vector2(-0.62, 0.78).normalize();
      flying.push({
        group: g,
        dir,
        t: 0,
        rodMat: (g.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial,
        headMat: (g.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial,
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
        f.rodMat.opacity = 1 - k;
        f.headMat.opacity = 1 - k;
        f.rodMat.transparent = true;
        f.headMat.transparent = true;
        (f.group.children[0] as THREE.Mesh).scale.x *= 1 + dt * 2.4;
        if (k >= 1) {
          group.remove(f.group);
          f.rodMat.dispose();
          f.headMat.dispose();
          flying.splice(i, 1);
        }
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      baseMat.dispose();
      headMatBase.dispose();
      for (const f of flying) {
        f.rodMat.dispose();
        f.headMat.dispose();
      }
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
