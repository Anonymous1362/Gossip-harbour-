import * as THREE from 'three';

/** The authored play field, in quay units. */
export const FIELD = { w: 10, h: 18 } as const;
const FOV = 28;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  resize(): void;
  render(): void;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  // Capped at 1.5 per the performance budget: a Redmi 9 is the floor target.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#08141d');
  // Fog range is re-anchored in fit(): the camera sits ~45 units out, so a fixed
  // near/far pair would either hide the room or wash the play plane to nothing.
  scene.fog = new THREE.Fog('#08141d', 40, 56);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

  const hemi = new THREE.HemisphereLight('#4f7f9c', '#0a1620', 0.85);
  scene.add(hemi);

  // The window's cold moonlight: the room's only strong source before restore.
  const moon = new THREE.DirectionalLight('#9fd4ff', 1.5);
  moon.position.set(-4, 7, 6);
  scene.add(moon);

  // Warm key on the hopper so the gold reads against the blue room.
  const key = new THREE.DirectionalLight('#ffdca8', 2.1);
  key.position.set(3.5, 8, 9);
  scene.add(key);

  const rim = new THREE.DirectionalLight('#7fe3ff', 0.9);
  rim.position.set(7, 2, 4);
  scene.add(rim);

  // A soft glow just behind the hopper: the cheap stand-in for bloom.
  const hopperGlow = new THREE.PointLight('#ffb454', 26, 14, 2);
  hopperGlow.position.set(1.2, 4.4, 3.2);
  scene.add(hopperGlow);

  function fit(): void {
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    camera.aspect = aspect;
    // Fit the whole field on both axes: portrait crops width, not height.
    const halfV = THREE.MathUtils.degToRad(FOV) / 2;
    const distV = FIELD.h / 2 / Math.tan(halfV);
    const distH = FIELD.w / 2 / (Math.tan(halfV) * aspect);
    const dist = Math.max(distV, distH) * 1.03;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (scene.fog instanceof THREE.Fog) {
      // Play plane stays crisp; only the room behind it falls away.
      scene.fog.near = dist - 0.5;
      scene.fog.far = dist + 11;
    }
  }

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    fit();
  }

  resize();

  return {
    renderer,
    scene,
    camera,
    canvas,
    resize,
    render: () => renderer.render(scene, camera),
  };
}

/** Small canvas-drawn radial gradient, reused by every glow sprite (no textures shipped). */
export function makeGlowTexture(inner = 'rgba(255,214,120,1)', outer = 'rgba(255,170,40,0)'): THREE.Texture {
  const size = 128;
  const ctx = document.createElement('canvas');
  ctx.width = size;
  ctx.height = size;
  const g = ctx.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.45, 'rgba(255,196,90,0.55)');
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(ctx);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
