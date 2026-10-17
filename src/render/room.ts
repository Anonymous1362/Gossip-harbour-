import * as THREE from 'three';

export interface RoomView {
  group: THREE.Group;
  /** Point the key light at the window so the room reads as lit from there. */
  windowLight: THREE.PointLight;
  dispose(): void;
}

const COL = {
  wall: '#1b3648',
  wallDeep: '#13293a',
  floor: '#2b3941',
  plank: '#33434c',
  wood: '#6b4a34',
  woodDark: '#4a3223',
  blanket: '#8e3550',
  sheet: '#5d6f7d',
  night: '#7fb6e8',
  cat: '#111a20',
  hair: '#3d7a4a',
  coat: '#c2402f',
  skin: '#e8b58c',
  brass: '#c9963f',
};

/**
 * Milestone 1 set: a dark placeholder loft, built from boxes only. The real room and
 * its restoration states are Milestone 2 (docs/HANDOFF.md). Everything here is
 * silhouette and colour temperature; no geometry over a handful of quads.
 */
export function createRoom(): RoomView {
  const group = new THREE.Group();

  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, rough = 0.85, metal = 0): THREE.MeshStandardMaterial => {
    const key = `${color}|${rough}|${metal}`;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      mats.set(key, m);
    }
    return m;
  };

  const geos: THREE.BufferGeometry[] = [];
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    rz = 0,
    rough = 0.85,
  ): THREE.Mesh => {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    const m = new THREE.Mesh(g, mat(color, rough));
    m.position.set(x, y, z);
    m.rotation.z = rz;
    group.add(m);
    return m;
  };

  // --- shell of the diorama -------------------------------------------------
  box(13, 0.5, 7, COL.floor, 0, -8.85, -2.6); // lower floor
  box(12.4, 9, 0.4, COL.wall, 0, -4.3, -4.4); // back wall, lower half
  box(12.4, 9, 0.4, COL.wallDeep, 0, 4.6, -4.4); // back wall, upper half
  box(0.5, 18, 7, COL.wallDeep, -6.2, 0, -2.6); // left return
  box(0.5, 18, 7, COL.wallDeep, 6.2, 0, -2.6); // right return

  // Floorboards: a few thin strips rather than a texture.
  for (let i = 0; i < 7; i++) {
    const z = -1.2 - i * 0.55;
    box(9.6, 0.06, 0.04, COL.plank, -0.2, -8.6, z);
  }

  // --- loft platform and bed ------------------------------------------------
  box(6.6, 0.34, 3.2, COL.wood, -1.5, -4.75, -2.4);
  box(6.6, 0.5, 0.22, COL.woodDark, -1.5, -4.35, -1.0); // platform lip

  // Mattress, blanket, pillow, headboard.
  box(4.6, 0.42, 2.2, COL.sheet, -2.4, -4.37, -2.5);
  box(3.3, 0.3, 2.24, COL.blanket, -1.9, -4.18, -2.5);
  box(0.9, 0.34, 1.5, '#8d9aa4', -4.3, -4.28, -2.5);
  box(0.24, 1.5, 2.3, COL.wood, -4.75, -3.75, -2.5); // headboard

  // --- window ---------------------------------------------------------------
  const win = new THREE.Group();
  win.position.set(2.15, -1.5, -4.15);
  group.add(win);
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.3),
    new THREE.MeshStandardMaterial({
      color: COL.night,
      emissive: new THREE.Color(COL.night),
      emissiveIntensity: 0.85,
      roughness: 1,
    }),
  );
  geos.push(pane.geometry);
  win.add(pane);
  const frameMat = mat(COL.woodDark, 0.9);
  for (const [w, h, x, y] of [
    [2.5, 0.22, 0, 1.25],
    [2.5, 0.22, 0, -1.25],
    [0.22, 2.7, -1.15, 0],
    [0.22, 2.7, 1.15, 0],
    [0.12, 2.3, 0, 0],
    [2.1, 0.12, 0, 0.25],
  ] as const) {
    const g = new THREE.BoxGeometry(w, h, 0.18);
    geos.push(g);
    const m = new THREE.Mesh(g, frameMat);
    m.position.set(x, y, 0.12);
    win.add(m);
  }

  const windowLight = new THREE.PointLight('#9fd0ff', 12, 12, 2);
  windowLight.position.set(2.15, -1.5, -3.4);
  group.add(windowLight);

  // --- ladder ---------------------------------------------------------------
  const lx = 1.55;
  box(0.12, 4.2, 0.12, COL.wood, lx, -6.6, -1.5, 0.03);
  box(0.12, 4.2, 0.12, COL.wood, lx + 1.25, -6.6, -1.5, 0.03);
  for (let i = 0; i < 6; i++) {
    box(1.25, 0.09, 0.1, COL.woodDark, lx + 0.62, -8.4 + i * 0.68, -1.5);
  }

  // --- shelves, crates, column, pipe ---------------------------------------
  box(2.6, 0.14, 1.0, COL.woodDark, -4.4, -6.1, -3.5);
  box(2.6, 0.14, 1.0, COL.woodDark, -4.4, -7.2, -3.5);
  for (let i = 0; i < 4; i++) {
    box(0.34, 0.5, 0.34, i % 2 ? '#3f5a4d' : '#54402f', -5.3 + i * 0.55, -5.78, -3.5);
    box(0.3, 0.42, 0.3, i % 2 ? '#6a4a2e' : '#33505e', -5.3 + i * 0.55, -6.9, -3.5);
  }

  box(1.0, 1.0, 1.0, COL.woodDark, 4.9, -8.0, -2.2, 0.06);
  box(0.8, 0.8, 0.8, COL.wood, 4.9, -7.1, -2.2, -0.1);

  // Tall column on the right, the room's strong vertical.
  box(1.9, 16, 1.2, '#162c3b', 5.1, -0.5, -3.3);

  // Pipe crossing the upper right wall toward the ladder.
  const pipeGeo = new THREE.CylinderGeometry(0.22, 0.22, 5.4, 10);
  geos.push(pipeGeo);
  const pipe = new THREE.Mesh(pipeGeo, mat('#27343c', 0.6, 0.4));
  pipe.position.set(4.15, 0.4, -4.1);
  pipe.rotation.z = Math.PI / 2 - 0.42;
  group.add(pipe);

  // --- the girl on the mat, the cats ---------------------------------------
  const girl = new THREE.Group();
  girl.position.set(0.2, -8.45, -1.4);
  group.add(girl);
  const girlBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.34, 4, 10), mat(COL.coat, 0.8));
  geos.push(girlBody.geometry);
  girlBody.position.y = 0.42;
  girl.add(girlBody);
  const girlHead = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), mat(COL.skin, 0.85));
  geos.push(girlHead.geometry);
  girlHead.position.y = 0.85;
  girl.add(girlHead);
  const hairMat = mat('#b8452a', 0.9);
  const girlHair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 10, 0, Math.PI * 2, 0, 1.5), hairMat);
  geos.push(girlHair.geometry);
  girlHair.position.y = 0.88;
  girl.add(girlHair);

  const catMat = mat(COL.cat, 0.95);
  for (const [cx, cy, cz, rot] of [
    [2.5, -8.35, -1.9, 0.2],
    [3.5, -8.3, -1.6, -0.15],
  ] as const) {
    const cat = new THREE.Group();
    cat.position.set(cx, cy, cz);
    cat.rotation.z = rot;
    group.add(cat);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 8), catMat);
    geos.push(body.geometry);
    body.rotation.z = Math.PI / 2;
    cat.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), catMat);
    geos.push(head.geometry);
    head.position.set(0.34, 0.06, 0);
    cat.add(head);
  }

  // --- the sleeper, propped up holding the glass ---------------------------
  const sleeper = new THREE.Group();
  sleeper.position.set(-1.9, -4.05, -2.4);
  group.add(sleeper);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.5, 4, 10), mat(COL.coat, 0.85));
  geos.push(torso.geometry);
  torso.rotation.z = Math.PI / 2 - 0.32;
  torso.position.set(0, 0.28, 0);
  sleeper.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 12), mat(COL.skin, 0.85));
  geos.push(head.geometry);
  head.position.set(-1.0, 0.62, 0);
  sleeper.add(head);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 14, 12, 0, Math.PI * 2, 0, 1.5),
    mat(COL.hair, 0.9),
  );
  geos.push(cap.geometry);
  cap.position.set(-1.0, 0.66, 0);
  sleeper.add(cap);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.1, 4, 8), mat(COL.sheet, 0.85));
  geos.push(legs.geometry);
  legs.rotation.z = Math.PI / 2;
  legs.position.set(1.25, -0.05, 0);
  sleeper.add(legs);
  // Arm reaching toward the glass.
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.5, 4, 8), mat(COL.coat, 0.85));
  geos.push(arm.geometry);
  arm.position.set(1.55, 0.72, 0);
  arm.rotation.z = -0.55;
  sleeper.add(arm);

  return {
    group,
    windowLight,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats.values()) m.dispose();
    },
  };
}
