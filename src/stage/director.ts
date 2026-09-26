import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, ease } from '../core/math';

interface Key {
  t: number;
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
}

/**
 * Cinematic camera. During a sequence it flies a spline keyed to sequence
 * progress (so scrubbing moves the camera too); otherwise orbit controls drive.
 */
export class Director {
  private keys: Key[] | null = null;
  private posCurve: THREE.CatmullRomCurve3 | null = null;
  private tgtCurve: THREE.CatmullRomCurve3 | null = null;
  private shakeAmp = 0;
  private shakeT = 0;
  private readonly base = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  active = false;
  autoRotateResume = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    readonly controls: OrbitControls,
  ) {
    controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      this.autoRotateResume = 6;
    });
  }

  /** Pull the camera back on narrow (portrait) screens so subjects still fit. */
  static fit(aspect: number, subject: 'car' | 'robot') {
    if (subject === 'car') return Math.max(1, Math.pow(1.3 / aspect, 0.85));
    return Math.max(1, Math.pow(1.05 / aspect, 0.55));
  }

  /** Car framing: 3/4 front, slightly low. */
  static carView(aspect = 1.6): [THREE.Vector3, THREE.Vector3] {
    return [new THREE.Vector3(7.3, 1.85, 8.4).multiplyScalar(Director.fit(aspect, 'car')), new THREE.Vector3(0, 0.8, 0)];
  }

  static robotView(h: number, aspect = 1.6): [THREE.Vector3, THREE.Vector3] {
    const k = (h / 5.6) * Director.fit(aspect, 'robot');
    return [new THREE.Vector3(12.8 * k, 2.3 * k, 8.8 * k), new THREE.Vector3(0, 2.45 * (h / 5.6), 0)];
  }

  /** Builds a flight path from wherever the camera is now. */
  begin(direction: 1 | -1, robotHeight: number) {
    this.glide = null;
    const aspect = this.camera.aspect;
    const fc = Director.fit(aspect, 'car');
    const fr = Director.fit(aspect, 'robot');
    const k = (robotHeight / 5.6) * fr;
    const cur: Key = { t: 0, pos: this.camera.position.clone(), tgt: this.controls.target.clone() };
    const v = (x: number, y: number, z: number, f = 1) => new THREE.Vector3(x * f, y * f, z * f);
    if (direction > 0) {
      const [endPos, endTgt] = Director.robotView(robotHeight, aspect);
      this.keys = [
        cur,
        { t: 0.2, pos: v(5.4, 0.8, 7.2, fc), tgt: v(0, 0.95, 0) },
        { t: 0.45, pos: v(8.6 * k, 1.5 * k, 8.4 * k), tgt: v(0, (2.1 * k) / fr, 0) },
        { t: 0.72, pos: v(10.8 * k, 1.0 * k, 4.6 * k), tgt: v(0, (3.0 * k) / fr, 0) },
        { t: 1, pos: endPos, tgt: endTgt },
      ];
    } else {
      const [endPos, endTgt] = Director.carView(aspect);
      this.keys = [
        cur,
        { t: 0.35, pos: v(10.5 * k, 3.4 * k, 9 * k), tgt: v(0, (2.2 * k) / fr, 0) },
        { t: 0.75, pos: v(8.4, 2.2, 9, fc), tgt: v(0, 1.0, 0) },
        { t: 1, pos: endPos, tgt: endTgt },
      ];
    }
    this.posCurve = new THREE.CatmullRomCurve3(this.keys.map((k) => k.pos), false, 'centripetal');
    this.tgtCurve = new THREE.CatmullRomCurve3(this.keys.map((k) => k.tgt), false, 'centripetal');
    this.active = true;
    this.controls.enabled = false;
    this.controls.autoRotate = false;
  }

  /** p: 0..1 progress along the flight. */
  fly(p: number) {
    if (!this.keys || !this.posCurve || !this.tgtCurve) return;
    const u = clamp(p);
    const keys = this.keys;
    let i = 0;
    while (i < keys.length - 2 && u > keys[i + 1].t) i++;
    const local = (u - keys[i].t) / (keys[i + 1].t - keys[i].t);
    const param = (i + ease.inOutCubic(clamp(local)) * 0.35 + clamp(local) * 0.65) / (keys.length - 1);
    this.posCurve.getPoint(clamp(param), this.base);
    this.tgtCurve.getPoint(clamp(param), this.target);
    this.camera.position.copy(this.base);
    this.controls.target.copy(this.target);
    this.camera.lookAt(this.target);
  }

  end() {
    this.active = false;
    this.keys = null;
    this.controls.enabled = true;
    this.controls.update();
  }

  private glide: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number } | null = null;

  /** Smoothly move the orbit camera to a new framing. */
  glideTo(pos: THREE.Vector3, tgt: THREE.Vector3, dur = 1.6) {
    this.glide = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos.clone(), t1: tgt.clone(), t: 0, dur };
  }

  /** Instantly frame a view (used for intros and vehicle swaps). */
  frame(pos: THREE.Vector3, tgt: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.controls.target.copy(tgt);
    this.camera.lookAt(tgt);
    this.controls.update();
  }

  shake(amount: number) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 0;
  }

  update(dt: number) {
    if (this.glide && !this.active) {
      const g = this.glide;
      g.t += dt;
      const u = ease.inOutCubic(clamp(g.t / g.dur));
      this.camera.position.lerpVectors(g.p0, g.p1, u);
      this.controls.target.lerpVectors(g.t0, g.t1, u);
      if (g.t >= g.dur) this.glide = null;
    }
    if (!this.active) {
      if (this.autoRotateResume > 0) {
        this.autoRotateResume -= dt;
        if (this.autoRotateResume <= 0) this.controls.autoRotate = true;
      }
      this.controls.update(dt);
    }
    if (this.shakeAmp > 0.0005) {
      this.shakeT += dt;
      const a = this.shakeAmp;
      const t = this.shakeT * 38;
      this.camera.position.x += Math.sin(t * 1.1) * a;
      this.camera.position.y += Math.sin(t * 1.7 + 1) * a * 0.8;
      this.camera.position.z += Math.sin(t * 1.3 + 2) * a;
      this.shakeAmp *= Math.exp(-dt * 6);
    }
  }
}
