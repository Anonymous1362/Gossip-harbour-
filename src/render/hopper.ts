import * as THREE from 'three';
import type { LevelDef } from '../game/types.ts';
import { makeGlowTexture } from './scene.ts';

export interface HopperView {
  group: THREE.Group;
  dispose(): void;
}

/**
 * The hopper is a half-revolved lathe: the back half only. A full revolve would put
 * the near wall between the camera and the gold. This keeps the flat-cutaway read of
 * the reference while still giving the shell real specular curvature.
 */
export function createHopper(level: LevelDef): HopperView {
  const group = new THREE.Group();
  group.position.x = level.hopper.x;

  const profile = level.hopper.profile;
  const outer = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const rim = profile[profile.length - 1][0];

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: '#e0573f',
    roughness: 0.3,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    side: THREE.DoubleSide,
  });

  const shellGeo = new THREE.LatheGeometry(outer, 30, Math.PI / 2, Math.PI);
  const shell = new THREE.Mesh(shellGeo, shellMat);
  group.add(shell);

  // Inner skin, very slightly smaller and darker: reads as shell thickness at the rim.
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: '#a83424',
    roughness: 0.45,
    metalness: 0.05,
    clearcoat: 0.6,
    side: THREE.BackSide,
  });
  const innerGeo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r * 0.965, y)),
    30,
    Math.PI / 2,
    Math.PI,
  );
  group.add(new THREE.Mesh(innerGeo, innerMat));

  // Thick coral lip at the brim. The arc is rotated in geometry space so it covers
  // the back half, matching the shell instead of floating in front of the gold.
  const lipGeo = new THREE.TorusGeometry(rim, 0.09, 8, 40, Math.PI);
  lipGeo.rotateZ(Math.PI);
  lipGeo.rotateX(Math.PI / 2);
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: '#f2745a',
    roughness: 0.25,
    clearcoat: 1,
  });
  const lip = new THREE.Mesh(lipGeo, lipMat);
  lip.position.y = profile[profile.length - 1][1];
  group.add(lip);

  // Warm light from inside the bowl so the gold and the shell both glow.
  const inner = new THREE.PointLight('#ffb14e', 18, 11, 2);
  inner.position.set(0.1, 5.6, 0.6);
  group.add(inner);

  // The cheap stand-in for bloom.
  const glowTex = makeGlowTexture();
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(9, 9, 1);
  glow.position.set(0, 5.2, -1.4);
  group.add(glow);

  return {
    group,
    dispose() {
      shellGeo.dispose();
      innerGeo.dispose();
      lipGeo.dispose();
      shellMat.dispose();
      innerMat.dispose();
      lipMat.dispose();
      glowMat.dispose();
      glowTex.dispose();
    },
  };
}
