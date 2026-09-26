import * as THREE from 'three';
import { Sound } from './audio/sound';
import { MatLib } from './core/materials';
import { clamp, ease, smoothstep, type Ease } from './core/math';
import { IGNITE_T, IMPACT_T, Rig, SEQ_T } from './rig/rig';
import { Director } from './stage/director';
import { Particles } from './stage/particles';
import { Stage } from './stage/stage';
import { decodeConfig, defaultConfig, encodeConfig, randomName, SPEEDS, type Config } from './ui/config';
import { UI } from './ui/ui';
import { VEHICLES } from './vehicles/specs';

type State = 'loading' | 'intro' | 'drive' | 'car' | 'seq' | 'robot' | 'hold';

const LAND_T = 1.78;
const STORE_KEY = 'ironshift:cfg';

interface Drive {
  from: number;
  to: number;
  t: number;
  dur: number;
  ease: Ease;
  label: string;
  onDone: () => void;
}

export class App {
  readonly stage: Stage;
  readonly director: Director;
  readonly sound = new Sound();
  readonly mats = new MatLib();
  readonly ui: UI;
  rig!: Rig;
  cfg: Config;

  private state: State = 'loading';
  private tau = 0;
  private dir: -1 | 0 | 1 = 0;
  private speedMul = 1;
  private seqStart = 0;
  private camFly = true;
  private pending: (() => void) | null = null;
  private drive: Drive | null = null;
  private travel = 0;
  private lastX = 0;
  private lastV = 0;
  private pitch = 0;
  private time = 0;
  private flash = 0;
  private kick = 0;
  private nameTouched = false;
  private paintTouched = false;

  private sparks = new Particles(900, { additive: true, gravity: 9.8, drag: 0.8, floor: true });
  private dust = new Particles(500, { soft: 0.0, gravity: -0.15, drag: 2.2 });
  private shock: THREE.Mesh;
  private shockMat: THREE.MeshBasicMaterial;
  private shockT = 10;
  private scan: THREE.Mesh;
  private scanMat: THREE.MeshBasicMaterial;
  private pointer = new THREE.Vector2(0, 0);
  private hasPointer = false;
  private raycaster = new THREE.Raycaster();
  private look = new THREE.Vector3();
  private clock = new THREE.Timer();

  constructor(container: HTMLElement) {
    this.stage = new Stage(container);
    this.director = new Director(this.stage.camera, this.stage.controls);
    this.cfg = this.loadConfig();
    this.nameTouched = this.cfg.name !== VEHICLES[this.cfg.vehicle].defaultName;
    this.paintTouched = this.cfg.paint !== VEHICLES[this.cfg.vehicle].defaultPaint;

    this.ui = new UI({
      onChange: (p) => this.change(p),
      onTransform: () => this.toggleTransform(),
      onScrubStart: () => this.scrubStart(),
      onScrub: (p) => this.scrub(p),
      onScrubEnd: () => this.scrubEnd(),
      onRandomName: () => {
        this.nameTouched = true;
        this.change({ name: randomName(this.cfg.name) });
      },
      onToggleSound: () => this.toggleSound(),
      onCapture: () => this.capture(),
      onShare: () => this.share(),
    });

    this.stage.scene.add(this.sparks.points, this.dust.points);
    this.shockMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 128), this.shockMat);
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.position.y = 0.02;
    this.stage.scene.add(this.shock);

    this.scanMat = new THREE.MeshBasicMaterial({
      map: scanTexture(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.scanMat);
    this.scan.rotation.y = Math.PI / 2;
    this.scan.visible = false;
    this.stage.scene.add(this.scan);

    this.applyLook(this.cfg);
    this.ui.setConfig(this.cfg);

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  /* ---------------- boot ---------------- */

  async boot() {
    this.ui.introProgress(0.15);
    await frame();
    this.rig = this.makeRig();
    this.rig.setDrive(-40, 0);
    this.ui.renderDossier(this.rig.height);
    this.ui.introProgress(0.55);
    await frame();
    // Warm shaders with the robot visible in every state
    const [cp, ct] = Director.carView(this.stage.camera.aspect);
    this.director.frame(cp, ct);
    this.rig.setDrive(0, 0);
    this.rig.update(SEQ_T, 0, null, 0);
    try {
      await this.stage.renderer.compileAsync(this.stage.scene, this.stage.camera);
    } catch {
      /* compileAsync is best-effort */
    }
    this.stage.render(0);
    this.rig.update(0, 0, null, 0);
    this.rig.setDrive(-40, 0);
    this.ui.introProgress(1);
    this.state = 'intro';
    this.ui.introReady(() => this.enter());
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('skip')) this.enter();
  }

  private enter() {
    (document.activeElement as HTMLElement | null)?.blur();
    this.sound.unlock();
    this.sound.setMuted(this.sound.muted);
    this.ui.hideIntro();
    setTimeout(() => this.ui.show(), 500);
    this.driveIn();
  }

  private makeRig() {
    const r = new Rig({ vehicle: this.cfg.vehicle, loadout: this.cfg.loadout, insignia: this.cfg.insignia }, this.mats);
    this.stage.scene.add(r.root);
    return r;
  }

  /* ---------------- config ---------------- */

  private loadConfig(): Config {
    const m = location.hash.match(/u=([A-Za-z0-9+/]+)/);
    if (m) {
      const c = decodeConfig(m[1]);
      if (c) return c;
    }
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const c = decodeConfig(raw);
        if (c) return c;
      }
    } catch {
      /* storage unavailable */
    }
    return defaultConfig('coupe');
  }

  private saveConfig() {
    const enc = encodeConfig(this.cfg);
    history.replaceState(null, '', `#u=${enc}`);
    try {
      localStorage.setItem(STORE_KEY, enc);
    } catch {
      /* storage unavailable */
    }
  }

  private applyLook(c: Config) {
    this.mats.setPaint(c.paint, c.finish);
    this.mats.setEnergy(c.energy);
    this.stage.setAccent(c.energy);
    this.shockMat.color.set(c.energy).multiplyScalar(3);
    this.scanMat?.color.set(c.energy).multiplyScalar(2.2);
  }

  private change(p: Partial<Config>) {
    const prev = this.cfg;
    const next = { ...prev, ...p };
    if (p.name !== undefined) this.nameTouched = true;
    if (p.paint !== undefined) this.paintTouched = true;

    if (p.vehicle && p.vehicle !== prev.vehicle) {
      if (this.state !== 'car' && this.state !== 'robot' && this.state !== 'hold') return;
      const spec = VEHICLES[p.vehicle];
      if (!this.nameTouched) next.name = spec.defaultName;
      if (!this.paintTouched) {
        next.paint = spec.defaultPaint;
        next.finish = spec.defaultFinish;
      }
      this.cfg = next;
      this.applyLook(next);
      this.ui.setConfig(next);
      this.saveConfig();
      this.switchVehicle();
      return;
    }

    this.cfg = next;
    if (p.paint || p.finish || p.energy) this.applyLook(next);
    if ((p.loadout && p.loadout !== prev.loadout) || (p.insignia && p.insignia !== prev.insignia)) this.rearm();
    this.ui.setConfig(next);
    this.saveConfig();
  }

  /* ---------------- sequence control ---------------- */

  private get speed() {
    return SPEEDS[this.cfg.speed].k * this.speedMul;
  }

  private toggleTransform() {
    this.sound.unlock();
    if (this.state === 'drive' || this.state === 'loading' || this.state === 'intro') return;
    if (this.state === 'seq') {
      this.startSeq(this.dir > 0 ? -1 : 1);
      return;
    }
    if (this.tau >= SEQ_T - 1e-3) this.startSeq(-1);
    else this.startSeq(1);
  }

  private startSeq(dir: 1 | -1, camera = true) {
    const fresh = this.state !== 'seq';
    this.dir = dir;
    this.state = 'seq';
    this.seqStart = this.tau;
    this.camFly = camera;
    if (camera) this.director.begin(dir, this.rig.height);
    if (dir > 0 && this.tau < 0.1 && fresh) this.sound.charge(0.5 / this.speed);
    this.sound.whoosh(1.1 / Math.min(1.5, this.speed));
    this.stage.controls.autoRotate = false;
  }

  private finishSeq() {
    const dir = this.dir;
    this.dir = 0;
    this.speedMul = 1;
    if (this.camFly) this.director.end();
    this.camFly = true;
    if (dir > 0) {
      this.state = 'robot';
      this.director.autoRotateResume = 5;
    } else {
      this.state = 'car';
      this.director.autoRotateResume = 3;
      const p = this.pending;
      this.pending = null;
      p?.();
    }
  }

  private scrubStart() {
    if (this.state === 'drive' || this.state === 'intro' || this.state === 'loading') return;
    if (this.state === 'seq' && this.camFly) this.director.end();
    this.dir = 0;
    this.state = 'hold';
    this.stage.controls.autoRotate = false;
  }

  private scrub(p: number) {
    if (this.state !== 'hold') return;
    const prev = this.tau;
    this.tau = clamp(p) * SEQ_T;
    this.fireEvents(prev, this.tau, true);
  }

  private scrubEnd() {
    if (this.state !== 'hold') return;
    if (this.tau >= SEQ_T - 1e-3) this.state = 'robot';
    else if (this.tau <= 1e-3) this.state = 'car';
  }

  /** Loadout / insignia changed: rebuild and redeploy the weapon if standing. */
  private rearm() {
    if (!this.rig) return;
    if (this.state === 'drive' || this.state === 'seq' || this.state === 'loading') {
      this.pendingRebuild = true;
      return;
    }
    this.rebuild();
    if (this.state === 'robot') {
      this.tau = 2.62;
      this.startSeq(1, false);
    }
  }
  private pendingRebuild = false;

  private rebuild() {
    const old = this.rig;
    const x = old.root.position.x;
    this.rig = this.makeRig();
    this.rig.setDrive(x, this.travel);
    this.rig.update(this.tau, this.time, null, 0);
    old.dispose();
    this.ui.renderDossier(this.rig.height);
  }

  private switchVehicle() {
    this.ui.lock(true);
    const go = () => {
      this.state = 'drive';
      this.startDrive(0, 36, 1.55, ease.inCubic, 'Departing', () => {
        this.rig.dispose();
        this.rig = this.makeRig();
        this.ui.renderDossier(this.rig.height);
        this.driveIn();
      });
    };
    if (this.tau > 0) {
      this.pending = go;
      this.speedMul = 2.4;
      this.startSeq(-1, true);
    } else go();
  }

  private driveIn() {
    this.state = 'drive';
    this.ui.lock(true);
    const [cp, ct] = Director.carView(this.stage.camera.aspect);
    this.director.glideTo(cp, ct, 2.2);
    this.stage.controls.autoRotate = false;
    this.travel = 0;
    this.lastX = -34;
    this.lastV = 0;
    this.rig.setDrive(-34, 0);
    this.startDrive(-34, 0, 2.9, ease.outCubic, 'Arriving', () => {
      this.state = 'car';
      this.ui.lock(false);
      this.sound.engineThrottle(0);
      this.director.autoRotateResume = 2.5;
      if (this.pendingRebuild) {
        this.pendingRebuild = false;
        this.rebuild();
      }
    });
  }

  private startDrive(from: number, to: number, dur: number, e: Ease, label: string, onDone: () => void) {
    this.drive = { from, to, t: 0, dur, ease: e, label, onDone };
    this.sound.engineThrottle(0.4);
  }

  /* ---------------- events ---------------- */

  private fireEvents(prev: number, cur: number, quiet = false) {
    if (cur === prev) return;
    const fwd = cur > prev;
    const lo = Math.min(prev, cur);
    const hi = Math.max(prev, cur);
    const crossed = (t: number) => (fwd ? prev < t && t <= cur : cur <= t && t < prev);
    const v = new THREE.Vector3();
    const right = new THREE.Vector3().setFromMatrixColumn(this.stage.camera.matrixWorld, 0);
    const pan = (p: THREE.Vector3) => clamp(p.clone().sub(this.stage.controls.target).dot(right) / 5, -1, 1) * 0.7;

    for (const e of this.rig.events) {
      if (e.t < lo || e.t > hi || !crossed(e.t)) continue;
      const isCar = this.rig.carIds.has(e.node.id);
      const arrive = fwd ? e.kind === 'end' : e.kind === 'start';
      if (isCar && arrive) {
        e.node.obj.getWorldPosition(v);
        if (!quiet) this.sound.clank(0.7 + Math.random() * 0.4, pan(v));
        this.emitSparks(v, quiet ? 4 : 12);
      } else if (!arrive && (isCar || ['pelvis', 'shoulderR', 'thighR', 'head', 'forearmL'].includes(e.node.id))) {
        if (!quiet) this.sound.servo(0.35 + Math.random() * 0.35 / this.speed, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8);
      }
    }
    if (quiet) return;
    if (fwd && crossed(LAND_T)) {
      this.sound.clank(1.3, 0);
      this.director.shake(0.025);
      this.dustAtFeet(18, 1.4);
    }
    if (fwd && crossed(IGNITE_T)) {
      this.sound.ignite();
      this.flash = 1;
    }
    if (fwd && crossed(IMPACT_T)) {
      this.sound.impact();
      this.director.shake(0.075);
      this.kick = 1;
      this.shockT = 0;
      this.dustAtFeet(46, 3.2);
    }
    if (!fwd && crossed(0.35)) {
      this.sound.clank(1.1, 0);
      this.director.shake(0.02);
    }
  }

  private emitSparks(at: THREE.Vector3, n: number) {
    const hot = new THREE.Color(5, 2.3, 0.7);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      this.sparks.emit({
        pos: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)),
        vel: new THREE.Vector3(Math.cos(a) * sp * 0.6, 1.5 + Math.random() * 4, Math.sin(a) * sp * 0.6),
        life: 0.35 + Math.random() * 0.5,
        size0: 0.05 + Math.random() * 0.04,
        size1: 0.01,
        color: hot,
      });
    }
  }

  private dustAtFeet(n: number, power: number) {
    const v = new THREE.Vector3();
    for (const side of ['R', 'L']) {
      this.rig.worldPos(`foot${side}`, v);
      v.y = 0.1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.5 + Math.random()) * power;
        const g = 0.22 + Math.random() * 0.12;
        this.dust.emit({
          pos: v.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, Math.random() * 0.15, Math.sin(a) * 0.3)),
          vel: new THREE.Vector3(Math.cos(a) * sp, 0.2 + Math.random() * 0.6, Math.sin(a) * sp),
          life: 1.2 + Math.random() * 1.2,
          size0: 0.35 + Math.random() * 0.3,
          size1: 1.4 + Math.random() * 1.2,
          color: new THREE.Color(g, g * 0.97, g * 0.93),
          alpha: 0.28,
        });
      }
    }
  }

  /* ---------------- misc actions ---------------- */

  private toggleSound() {
    this.sound.unlock();
    this.sound.setMuted(!this.sound.muted);
    this.ui.setMuted(this.sound.muted);
    this.ui.toast(this.sound.muted ? 'Audio muted' : 'Audio on');
  }

  private capture() {
    this.stage.render(0);
    const url = this.stage.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironshift-${(this.cfg.name || 'unit').toLowerCase()}.png`;
    a.click();
    this.ui.toast('Frame captured');
  }

  private async share() {
    this.saveConfig();
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      this.ui.toast('Link copied — it rebuilds this unit');
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  private bindInput() {
    window.addEventListener('keydown', (e) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        if (tag === 'BUTTON') el!.blur();
        if (!e.repeat) this.toggleTransform();
      } else if (e.key === 'h' || e.key === 'H') this.ui.toggleHidden();
      else if (e.key === 'm' || e.key === 'M') this.toggleSound();
      else if (e.key === 'c' || e.key === 'C') this.capture();
      else if (e.key === 'r' || e.key === 'R') {
        this.nameTouched = true;
        this.change({ name: randomName(this.cfg.name) });
      }
    });
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.hasPointer = true;
    });
  }

  private resize() {
    this.stage.resize();
    const h = this.stage.renderer.domElement.height;
    this.sparks.setViewportHeight(h, this.stage.camera.fov);
    this.dust.setViewportHeight(h, this.stage.camera.fov);
  }

  /* ---------------- frame ---------------- */

  private loop = () => {
    requestAnimationFrame(this.loop);
    this.clock.update();
    this.tick(Math.min(this.clock.getDelta(), 1 / 20));
  };

  /** One frame of simulation + render (also driven manually by dev tooling). */
  tick(dt: number) {
    this.time += dt;
    if (!this.rig) {
      this.director.update(dt);
      this.stage.update(dt);
      this.stage.render(dt);
      return;
    }

    // Driving
    if (this.drive) {
      const d = this.drive;
      d.t += dt;
      const u = clamp(d.t / d.dur);
      const x = d.from + (d.to - d.from) * d.ease(u);
      const vel = (x - this.lastX) / Math.max(dt, 1e-4);
      const acc = (vel - this.lastV) / Math.max(dt, 1e-4);
      this.travel += x - this.lastX;
      this.lastX = x;
      this.lastV = vel;
      this.rig.setDrive(x, this.travel);
      const targetPitch = clamp(acc * 0.0022, -0.03, 0.03);
      this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-dt * 6));
      this.sound.engineThrottle(clamp(Math.abs(vel) / 22, 0.05, 1));
      if (u >= 1) {
        this.drive = null;
        this.lastV = 0;
        d.onDone();
      }
    } else {
      this.pitch *= Math.exp(-dt * 3);
    }

    // Sequence
    if (this.state === 'seq') {
      const prev = this.tau;
      this.tau = clamp(this.tau + dt * this.speed * this.dir, 0, SEQ_T);
      this.fireEvents(prev, this.tau);
      if (this.camFly) {
        const p = this.dir > 0 ? (SEQ_T - this.seqStart < 1e-3 ? 1 : (this.tau - this.seqStart) / (SEQ_T - this.seqStart)) : this.seqStart < 1e-3 ? 1 : (this.seqStart - this.tau) / this.seqStart;
        this.director.fly(p);
      }
      if ((this.dir > 0 && this.tau >= SEQ_T) || (this.dir < 0 && this.tau <= 0)) this.finishSeq();
    }

    // Head tracks the pointer at the robot's depth
    let look: THREE.Vector3 | null = null;
    if (this.hasPointer && this.tau >= SEQ_T - 0.3) {
      this.raycaster.setFromCamera(this.pointer, this.stage.camera);
      const dist = this.stage.camera.position.distanceTo(this.stage.controls.target);
      look = this.look.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, dist);
    }

    this.rig.update(this.tau, this.time, look, dt);
    this.rig.root.rotation.z = this.pitch;
    if (this.tau === 0 && !this.drive) this.rig.root.position.y = 0;

    // Energy + optics
    this.flash *= Math.exp(-dt * 2.6);
    const ign = smoothstep(IGNITE_T - 0.05, IGNITE_T + 0.2, this.tau);
    this.mats.setEnergyLevel(0.3 + 0.7 * ign + this.flash * 0.9);
    const flicker = this.tau > 0.02 && this.tau < 0.5 ? (Math.sin(this.time * 90) > 0.2 ? 0.25 : 1) : 1;
    this.mats.headlight.emissiveIntensity = 5 * flicker;
    for (const b of this.rig.beams) b.intensity = 60 * flicker;

    // Post punch
    this.kick *= Math.exp(-dt * 2.8);
    this.stage.bloom.intensity = 1.05 + this.kick * 1.4 + this.flash * 0.5;
    this.stage.chroma.offset.set(0.0005 + this.kick * 0.004, 0.0005 + this.kick * 0.004);

    // Shockwave
    this.shockT += dt;
    const su = clamp(this.shockT / 1.1);
    const sh = this.rig.height / 5.6;
    this.shock.scale.setScalar(0.6 + ease.outCubic(su) * 11 * sh);
    this.shockMat.opacity = su < 1 ? (1 - su) * 0.9 : 0;

    // Systems scan sweeping nose-to-tail as the shift begins
    const su2 = smoothstep(0.02, 0.55, this.tau);
    this.scan.visible = su2 > 0 && su2 < 1;
    if (this.scan.visible) {
      const spec = this.rig.spec;
      this.scan.position.set(this.rig.root.position.x + spec.L / 2 + 0.2 - su2 * (spec.L + 0.4), 1.0, 0);
      this.scan.scale.set(2.5, 2.2, 1);
      this.scanMat.opacity = Math.sin(Math.PI * su2) * 0.9;
    }

    this.sparks.update(dt);
    this.dust.update(dt);
    this.director.update(dt);
    this.stage.update(dt);
    this.stage.render(dt);
    this.updateUI();
  }

  /** Dev helper: advance the simulation by `seconds` in fixed steps. */
  advance(seconds: number, step = 1 / 60) {
    for (let t = 0; t < seconds; t += step) this.tick(step);
  }

  private updateUI() {
    const pct = `${Math.round((this.tau / SEQ_T) * 100)}%`;
    switch (this.state) {
      case 'drive':
        this.ui.setMode(this.drive?.label ?? 'Standby', '', true);
        this.ui.setTransformLabel('Standby', true);
        break;
      case 'seq':
        this.ui.setMode(this.dir > 0 ? 'Transforming' : 'Reverting', pct, true);
        this.ui.setTransformLabel(this.dir > 0 ? 'Revert' : 'Transform', !!this.pending);
        break;
      case 'robot':
        this.ui.setMode('Combat mode', '', false);
        this.ui.setTransformLabel('Revert');
        break;
      case 'hold':
        this.ui.setMode('Sequence hold', pct, false);
        this.ui.setTransformLabel('Transform');
        break;
      case 'car':
        this.ui.setMode('Vehicle mode', '', false);
        this.ui.setTransformLabel('Transform');
        break;
      default:
        this.ui.setMode('Standby', '', true);
    }
    this.ui.setProgress(this.tau / SEQ_T);
    this.ui.lock(this.state === 'drive' || !!this.pending);
  }
}

function scanTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fillRect(0, 0, 3, 256);
  g.fillRect(253, 0, 3, 256);
  for (let y = 0; y < 256; y += 8) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, y, 256, 1);
  }
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.15, 'rgba(0,0,0,0)');
  v.addColorStop(0.85, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Yield a frame (falls back to a timer when the tab is in the background). */
function frame() {
  return new Promise<void>((r) => {
    requestAnimationFrame(() => r());
    setTimeout(r, 60);
  });
}
