function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export interface OverlayOptions {
  title: string;
  detail: string;
  stars: number;
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
}

export interface UI {
  setLevel(num: number, total: number): void;
  setCounter(value: number): void;
  showBanner(text: string, ms: number): void;
  hideBanner(): void;
  showOverlay(o: OverlayOptions): void;
  hideOverlay(): void;
  setMuted(muted: boolean): void;
  onMute(cb: (muted: boolean) => void): void;
  onPrimary(cb: () => void): void;
}

export function createUI(): UI {
  const hud = el('hud');
  const counter = el('counter');
  const counterValue = el('counter-value');
  const levelNum = el('level-num');
  const levelTotal = el('level-total');
  const banner = el('banner');
  const bannerText = el('banner-text');
  const overlay = el('overlay');
  const overlayTitle = el('overlay-title');
  const overlayDetail = el('overlay-detail');
  const starsBox = el('stars');
  const primary = el<HTMLButtonElement>('primary');
  const secondary = el<HTMLButtonElement>('secondary');
  const mute = el<HTMLButtonElement>('mute');
  const muteGlyph = el('mute-glyph');

  let bannerTimer = 0;
  let primaryHandler: (() => void) | null = null;
  let secondaryHandler: (() => void) | null = null;
  let muted = false;

  hud.hidden = false;

  /** One-shot: a button fires once, closes the panel, then the level mounts behind it. */
  const runAction = (handler: (() => void) | null): void => {
    if (overlay.hidden) return;
    primaryHandler = null;
    secondaryHandler = null;
    overlay.hidden = true;
    handler?.();
  };

  primary.addEventListener('click', () => runAction(primaryHandler));
  secondary.addEventListener('click', () => runAction(secondaryHandler));

  return {
    setLevel(num, total) {
      levelNum.textContent = String(num);
      levelTotal.textContent = String(total);
    },
    setCounter(value) {
      const next = String(value);
      if (counterValue.textContent === next) return;
      counterValue.textContent = next;
      counter.classList.remove('pop');
      // Force a reflow so the pop animation restarts on consecutive ticks.
      void counter.offsetWidth;
      counter.classList.add('pop');
    },
    showBanner(text, ms) {
      bannerText.textContent = text;
      banner.hidden = false;
      window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => {
        banner.hidden = true;
      }, ms);
    },
    hideBanner() {
      window.clearTimeout(bannerTimer);
      banner.hidden = true;
    },
    showOverlay(o) {
      overlayTitle.textContent = o.title;
      overlayDetail.textContent = o.detail;
      starsBox.textContent = '';
      for (let i = 0; i < 3; i++) {
        const s = document.createElement('span');
        s.className = i < o.stars ? 'star on' : 'star';
        s.textContent = '★';
        starsBox.appendChild(s);
      }
      primary.textContent = o.primary;
      primaryHandler = o.onPrimary;
      secondaryHandler = o.onSecondary ?? null;
      if (o.secondary && secondaryHandler) {
        secondary.hidden = false;
        secondary.textContent = o.secondary;
      } else {
        secondary.hidden = true;
      }
      overlay.hidden = false;
    },
    hideOverlay() {
      overlay.hidden = true;
      primaryHandler = null;
      secondaryHandler = null;
    },
    setMuted(next) {
      muted = next;
      muteGlyph.textContent = next ? '✕' : '♪';
      mute.setAttribute('aria-pressed', String(next));
      mute.classList.toggle('off', next);
    },
    onMute(cb) {
      mute.addEventListener('click', () => {
        muted = !muted;
        cb(muted);
      });
    },
    onPrimary(cb) {
      primaryHandler = cb;
    },
  };
}
