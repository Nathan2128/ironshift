/**
 * All audio is synthesised with Web Audio — no sample files. Metallic hits use
 * inharmonic partials (struck-plate ratios), servos are detuned saws through a
 * sweeping band-pass with a ratchet LFO, the impact is a pitched-down sine with
 * saturation and a long convolution tail.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private verb!: ConvolverNode;
  private verbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private drone: { gain: GainNode; stop: () => void } | null = null;
  private engine: { osc: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private lastClank = 0;
  private lastServo = 0;
  muted = false;

  get ready() {
    return !!this.ctx;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.6, 2.4);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.32;
    this.verbSend.connect(this.verb).connect(this.master);

    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startDrone();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private out(pan = 0, send = 0.3) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.bus);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      p.connect(s).connect(this.verbSend);
    }
    return g;
  }

  private noise(dest: AudioNode, t: number, dur: number) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur);
    return src;
  }

  private startDrone() {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    gain.connect(this.bus);
    lp.connect(gain);
    const oscs = [43.6, 65.4, 87.3].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      const g = ctx.createGain();
      g.gain.value = [0.6, 0.25, 0.12][i];
      o.connect(g).connect(lp);
      o.start();
      return o;
    });
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 420;
    nf.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    nf.connect(ng).connect(gain);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.connect(nf);
    src.start();
    this.drone = { gain, stop: () => (oscs.forEach((o) => o.stop()), src.stop()) };
  }

  /** Metallic lock / clank. */
  clank(intensity = 1, pan = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastClank < 0.06) return;
    this.lastClank = now;
    const out = this.out(pan, 0.45);
    out.gain.value = 0.55 * intensity;
    const base = 180 + Math.random() * 160;
    const ratios = [1, 2.76, 5.4, 8.93, 13.34];
    const decays = [0.45, 0.28, 0.16, 0.1, 0.06];
    ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * r * (1 + (Math.random() - 0.5) * 0.02);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime([0.35, 0.22, 0.14, 0.08, 0.05][i], now + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i] * (0.8 + intensity * 0.5));
      o.connect(g).connect(out);
      o.start(now);
      o.stop(now + 0.8);
    });
    // transient
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + Math.random() * 1600;
    bp.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.9, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    bp.connect(ng).connect(out);
    this.noise(bp, now, 0.06);
    // body thump
    const th = ctx.createOscillator();
    th.frequency.setValueAtTime(110, now);
    th.frequency.exponentialRampToValueAtTime(45, now + 0.14);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.7 * intensity, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    th.connect(tg).connect(out);
    th.start(now);
    th.stop(now + 0.2);
  }

  /** Servo / actuator run. */
  servo(duration = 0.5, pitch = 1, pan = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastServo < 0.1) return;
    this.lastServo = now;
    const out = this.out(pan, 0.2);
    out.gain.value = 0.0;
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(0.16, now + 0.04);
    out.gain.setValueAtTime(0.16, now + duration * 0.75);
    out.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 5;
    bp.frequency.setValueAtTime(700 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(2200 * pitch, now + duration * 0.5);
    bp.frequency.exponentialRampToValueAtTime(1300 * pitch, now + duration);
    const ratchet = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 26 + Math.random() * 14;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 0.35;
    lfo.connect(lfoAmt).connect(ratchet.gain);
    ratchet.gain.value = 0.65;
    bp.connect(ratchet).connect(out);
    for (const det of [0, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(230 * pitch, now + duration);
      o.detune.value = det;
      o.connect(bp);
      o.start(now);
      o.stop(now + duration + 0.05);
    }
    lfo.start(now);
    lfo.stop(now + duration + 0.05);
  }

  /** Rising energy before the shift. */
  charge(duration = 0.6) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.out(0, 0.4);
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(0.28, now + duration * 0.9);
    out.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.25);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, now);
    o.frequency.exponentialRampToValueAtTime(260, now + duration);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(200, now);
    lp.frequency.exponentialRampToValueAtTime(3200, now + duration);
    lp.Q.value = 6;
    o.connect(lp).connect(out);
    o.start(now);
    o.stop(now + duration + 0.3);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(800, now);
    hp.frequency.exponentialRampToValueAtTime(6000, now + duration);
    const ng = ctx.createGain();
    ng.gain.value = 0.25;
    hp.connect(ng).connect(out);
    this.noise(hp, now, duration + 0.3);
  }

  /** Big landing hit. */
  impact() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.out(0, 0.55);
    out.gain.value = 0.9;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 3);
    }
    shaper.curve = curve;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, now);
    o.frequency.exponentialRampToValueAtTime(26, now + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    o.connect(shaper).connect(g).connect(out);
    o.start(now);
    o.stop(now + 1.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.6);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.8, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    lp.connect(ng).connect(out);
    this.noise(lp, now, 0.9);
    this.lastClank = 0;
    this.clank(1.4, 0);
  }

  /** Optics ignite: glassy shimmer over a sub hum. */
  ignite() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.out(0, 0.6);
    out.gain.value = 0.22;
    [1318.5, 1975.5, 2637, 3951].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const vib = ctx.createOscillator();
      vib.frequency.value = 5 + i;
      const va = ctx.createGain();
      va.gain.value = f * 0.004;
      vib.connect(va).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.3 / (i + 1), now + 0.05 + i * 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      o.connect(g).connect(out);
      o.start(now);
      vib.start(now);
      o.stop(now + 1.5);
      vib.stop(now + 1.5);
    });
    const sub = ctx.createOscillator();
    sub.frequency.value = 55;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, now);
    sg.gain.linearRampToValueAtTime(0.7, now + 0.1);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    sub.connect(sg).connect(out);
    sub.start(now);
    sub.stop(now + 1.7);
  }

  whoosh(duration = 0.7, pan = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.out(pan, 0.3);
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(0.2, now + duration * 0.5);
    out.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(1800, now + duration * 0.5);
    bp.frequency.exponentialRampToValueAtTime(500, now + duration);
    bp.connect(out);
    this.noise(bp, now, duration);
  }

  /** Engine rumble while driving; throttle 0..1, 0 turns it off. */
  engineThrottle(v: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.engine && v > 0) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 2;
      filter.connect(gain).connect(this.bus);
      const osc = [38, 76.3, 114.5].map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sawtooth' : 'square';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = [0.5, 0.18, 0.08][i];
        o.connect(g).connect(filter);
        o.start();
        return o;
      });
      this.engine = { osc, filter, gain };
    }
    if (!this.engine) return;
    const t = ctx.currentTime;
    this.engine.gain.gain.setTargetAtTime(v > 0 ? 0.08 + v * 0.22 : 0, t, 0.12);
    this.engine.osc.forEach((o, i) => o.frequency.setTargetAtTime((38 + v * 55) * (i + 1), t, 0.15));
    this.engine.filter.frequency.setTargetAtTime(260 + v * 900, t, 0.15);
    if (v <= 0) {
      const e = this.engine;
      this.engine = null;
      setTimeout(() => e.osc.forEach((o) => o.stop()), 800);
    }
  }
}
