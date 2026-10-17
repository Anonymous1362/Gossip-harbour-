import * as THREE from 'three';

/**
 * One gold for every coin in the game.
 *
 * Coins used to be `metalness: 0.92` with a dark-brown emissive, so anywhere the warm
 * hopper light did not reach (i.e. the whole fall to the jar) metal reflected nothing
 * and the emissive tinted them brown. A softer metalness plus a bright gold emissive
 * keeps them gold in shadow, and the separate additive rim ring makes the edge read
 * even when the face is turned away from the key light.
 */
export const COIN_LOOK = {
  color: '#ffcc45',
  emissive: '#ffa51f',
  emissiveIntensity: 1.15,
  metalness: 0.45,
  roughness: 0.34,
  rim: '#ffedb0',
  thickness: 0.055,
} as const;

export interface CoinMaterials {
  /** Instanced faces. */
  face: THREE.MeshStandardMaterial;
  /** Instanced rim rings; bright, unlit, always visible. */
  rim: THREE.MeshBasicMaterial;
}

export function createCoinMaterials(): CoinMaterials {
  return {
    face: new THREE.MeshStandardMaterial({
      color: COIN_LOOK.color,
      emissive: new THREE.Color(COIN_LOOK.emissive),
      emissiveIntensity: COIN_LOOK.emissiveIntensity,
      metalness: COIN_LOOK.metalness,
      roughness: COIN_LOOK.roughness,
    }),
    rim: new THREE.MeshBasicMaterial({
      color: COIN_LOOK.rim,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  };
}

/** Disc + a bright bezel ring, both facing the camera (hole along Z). The ring sits
 *  just proud of the face so it reads as the coin's raised rim instead of being buried
 *  inside the cylinder. */
export function coinGeometries(radius: number): {
  face: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
} {
  const face = new THREE.CylinderGeometry(radius, radius, COIN_LOOK.thickness, 14);
  face.rotateX(Math.PI / 2);
  const rim = new THREE.TorusGeometry(radius * 0.8, radius * 0.075, 6, 16);
  rim.translate(0, 0, COIN_LOOK.thickness / 2 + 0.003);
  return { face, rim };
}
