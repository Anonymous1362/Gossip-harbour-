/**
 * All sound is synthesized: no audio files ship with the game. The context is created
 * lazily on the first pointer event, because mobile browsers refuse to start it before
 * a gesture.
 */
export interface Sfx {
  unlock(): void;
  pin(): void;
  coin(combo: number): void;
  win(): void;
  lose(): void;
  tap(): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  let lastCoin = 0;

  function ensure(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.34;
    master.connect(ctx.destination);
    startAmbience(ctx, master);
    return ctx;
  }

  function env(
    c: AudioContext,
    node: AudioNode,
    attack: number,
    decay: number,
    peak: number,
  ): GainNode {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    return g;
  }

  function startAmbience(c: AudioContext, out: GainNode): void {
    // Two detuned sines through a lowpass: a quiet room hum.
    const g = c.createGain();
    g.gain.value = 0.05;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    for (const f of [55, 82.5, 110.3]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(filter);
      o.start();
    }
    filter.connect(g);
    g.connect(out);
  }

  function tone(
    freq: number,
    type: OscillatorType,
    dur: number,
    peak: number,
    slideTo?: number,
  ): void {
    const c = ensure();
    if (!c || !master || muted) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    const g = env(c, o, 0.006, dur, peak);
    g.connect(master);
    o.start();
    o.stop(c.currentTime + dur + 0.05);
  }

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') void c.resume();
    },
    pin() {
      // A short noise sweep: the rod sliding out of its slot.
      const c = ensure();
      if (!c || !master || muted) return;
      const len = 0.18;
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(900, c.currentTime);
      bp.frequency.exponentialRampToValueAtTime(3200, c.currentTime + len);
      src.connect(bp);
      const g = env(c, bp, 0.004, len, 0.5);
      g.connect(master);
      src.start();
    },
    coin(combo: number) {
      // Clink pitch rises with the combo, then resets so it never gets shrill.
      const now = performance.now();
      if (now - lastCoin < 22) return;
      lastCoin = now;
      const step = Math.min(combo, 12);
      tone(1180 * 2 ** (step / 24), 'triangle', 0.09, 0.12);
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        window.setTimeout(() => tone(f, 'triangle', 0.26, 0.22), i * 110);
      });
    },
    lose() {
      tone(320, 'sawtooth', 0.28, 0.14, 150);
      window.setTimeout(() => tone(210, 'sawtooth', 0.34, 0.12, 110), 140);
    },
    tap() {
      tone(760, 'sine', 0.05, 0.1);
    },
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = next ? 0 : 0.34;
    },
    dispose() {
      void ctx?.close();
      ctx = null;
      master = null;
    },
  };
}
