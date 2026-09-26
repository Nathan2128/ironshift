import * as THREE from 'three';
import type { V3 } from '../core/kit';
import type { DetailCtx, PanelId, VehicleId, VehicleSpec } from './types';
import {
  SIDES,
  backNormal,
  doorHandle,
  frontNormal,
  lamp,
  mirror,
  qFromY,
  basisQ,
  sidePanelAt,
  sideRun,
  topPoint,
  topRail,
} from './details';

/* ------------------------------------------------------------------ *
 * Proportions are taken from the real-world vehicles' published
 * dimensions (length, width, height, wheelbase, tyre size). Names and
 * badges are deliberately generic.
 * ------------------------------------------------------------------ */

const coupe: VehicleSpec = {
  id: 'coupe',
  label: 'Sport Coupe',
  descriptor: 'Rear-engine 2+2',
  robotClass: 'striker',
  defaultName: 'VANTAGE',
  defaultPaint: '#b3121c',
  defaultFinish: 'gloss',
  L: 4.52,
  interp: 'smooth',
  top: [
    [0, 0.5], [0.08, 0.6], [0.25, 0.67], [0.6, 0.725], [1.1, 0.79], [1.52, 0.855], [1.9, 1.07],
    [2.25, 1.24], [2.5, 1.28], [2.8, 1.255], [3.2, 1.15], [3.6, 1.03], [4.0, 0.975], [4.35, 0.94],
    [4.46, 0.87], [4.52, 0.72],
  ],
  bottom: [[0, 0.28], [0.1, 0.16], [0.35, 0.125], [1.0, 0.115], [3.9, 0.12], [4.3, 0.2], [4.52, 0.34]],
  halfW: [
    [0, 0.6], [0.12, 0.8], [0.35, 0.89], [0.95, 0.905], [1.7, 0.872], [2.5, 0.884], [3.2, 0.945],
    [3.7, 0.95], [4.25, 0.91], [4.45, 0.84], [4.52, 0.74],
  ],
  belt: [[0, 0.74], [1.0, 0.8], [1.55, 0.87], [2.5, 0.91], [3.3, 0.97], [4.52, 0.93]],
  crown: [[0, -0.015], [0.4, -0.03], [1.3, -0.02], [1.6, 0.01], [2.3, 0.035], [3.2, 0.03], [3.8, 0.02], [4.52, 0]],
  tumble: 0.6,
  rB: 0.13,
  rT: 0.17,
  sideBulge: 0.02,
  crease: 0.55,
  front: { d: 0.97, r: 0.34, width: 0.25 },
  rear: { d: 3.42, r: 0.355, width: 0.3 },
  wheelStyle: 'twin5',
  arch: 'round',
  archGap: 0.035,
  archTrim: 0,
  st: { noseEnd: 0.62, ws0: 1.52, ws1: 2.22, rg0: 2.95, rg1: 3.7, door0: 1.45, doorMid: 2.52, door1: 2.97, tailStart: 4.05 },
  windows: [[1.62, 2.48], [2.56, 3.2]],
  pillar: 'paint',
  details(ctx) {
    const nose = ctx.kit('nose');
    // Upright oval headlights on the fender fronts
    for (const [, sgn] of SIDES) {
      const y = 0.66;
      const z = 0.62 * sgn;
      const at = frontNormal(ctx, y, z);
      const q = basisQ(at.n);
      const base = new THREE.Vector3(at.x, y, z);
      const oval = new THREE.Quaternion().copy(q);
      const p = (o: number) => base.clone().addScaledVector(at.n, o).toArray() as V3;
      nose.cyl(0.125, 0.125, 0.07, 'lens', { p: p(-0.02), q: q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))), s: [1, 1, 0.82] }, 40);
      nose.torus(0.1, 0.012, 'chrome', { p: p(0.012), q: oval, s: [1, 0.82, 1] }, 8, 48);
      nose.torus(0.074, 0.009, 'headlight', { p: p(0.018), q: oval, s: [1, 0.82, 1] }, 8, 40);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const off = new THREE.Vector3(Math.cos(a) * 0.045, Math.sin(a) * 0.045 * 0.82, 0).applyQuaternion(q);
        const pp = base.clone().addScaledVector(at.n, 0.02).add(off);
        nose.box(0.028, 0.012, 0.01, 'headlight', { p: pp.toArray() as V3, q: q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a)) }, 0.004);
      }
      nose.sphere(0.028, 'headlight', { p: p(0.005) }, 12, 8);
    }
    // Three front intakes
    const c = frontNormal(ctx, 0.36, 0);
    lamp(nose, c, 0.36, 0, 0.55, 0.09, 'trim', 0.06, 0.008);
    for (const [, sgn] of SIDES) {
      const s = frontNormal(ctx, 0.37, 0.55 * sgn);
      lamp(nose, s, 0.37, 0.55 * sgn, 0.28, 0.12, 'trim', 0.06, 0.008);
      const s2 = frontNormal(ctx, 0.45, 0.55 * sgn);
      lamp(nose, s2, 0.45, 0.55 * sgn, 0.24, 0.012, 'headlight', 0.02, 0.01);
    }
    mirror(ctx, 1.66, 0.9);
    doorHandle(ctx, 'door1', 2.3, 0.78, 'trim');
    // Engine lid louvres
    const deck = ctx.kit('deck');
    for (let i = -3; i <= 3; i++) {
      const tp = topPoint(ctx, 3.86, i * 0.075);
      deck.box(0.26, 0.012, 0.028, 'trim', { p: [tp.p.x, tp.p.y + 0.004, tp.p.z], q: qFromY(tp.n) }, 0.004);
    }
    // Ducktail spoiler + full width light bar split across tail halves
    for (const [side, sgn] of SIDES) {
      const tail = ctx.kit(`tail${side}` as PanelId);
      const sp = topPoint(ctx, 4.28, 0.3 * sgn);
      tail.extrude(
        [[0.1, 0], [-0.13, 0.0], [-0.16, 0.055], [0.06, 0.03]],
        0.62,
        'paint',
        'XY',
        { p: [sp.p.x, sp.p.y - 0.005, 0.31 * sgn] },
        0.01,
      );
      tail.box(0.02, 0.06, 0.6, 'trim', { p: [sp.p.x + 0.02, sp.p.y + 0.02, 0.3 * sgn] }, 0.005);
      const y = 0.855;
      const b = backNormal(ctx, y, 0.42 * sgn);
      lamp(tail, b, y, 0.42 * sgn, 0.84, 0.1, 'trim', 0.03, 0.006);
      lamp(tail, b, y, 0.42 * sgn, 0.82, 0.03, 'taillight', 0.03, 0.012);
      const e = backNormal(ctx, 0.3, 0.14 * sgn);
      tail.cylX(0.052, 0.14, 'chrome', [e.x + 0.02, 0.3, 0.14 * sgn], 20);
      tail.cylX(0.04, 0.142, 'dark', [e.x + 0.021, 0.3, 0.14 * sgn], 20);
      const df = backNormal(ctx, 0.22, 0.45 * sgn);
      lamp(tail, df, 0.22, 0.45 * sgn, 0.85, 0.1, 'trim', 0.08, 0.005);
    }
  },
};

const van: VehicleSpec = {
  id: 'van',
  label: 'Minivan',
  descriptor: 'Eight-seat people mover',
  robotClass: 'warden',
  defaultName: 'BULWARK',
  defaultPaint: '#1f2a3a',
  defaultFinish: 'gloss',
  L: 5.175,
  interp: 'smooth',
  top: [
    [0, 0.8], [0.08, 0.9], [0.3, 0.98], [0.6, 1.03], [0.95, 1.1], [1.05, 1.12], [1.6, 1.46], [2.1, 1.7],
    [2.45, 1.76], [3.5, 1.765], [4.3, 1.745], [4.72, 1.7], [4.85, 1.62], [5.05, 1.2], [5.14, 0.95], [5.175, 0.82],
  ],
  bottom: [[0, 0.34], [0.12, 0.22], [0.4, 0.18], [1.0, 0.165], [4.6, 0.17], [5.0, 0.28], [5.175, 0.42]],
  halfW: [[0, 0.74], [0.15, 0.9], [0.5, 0.975], [1.1, 0.99], [4.1, 0.997], [4.8, 0.975], [5.1, 0.93], [5.175, 0.88]],
  belt: [[0, 0.98], [1.0, 1.08], [2.5, 1.1], [3.6, 1.12], [4.1, 1.16], [4.6, 1.16], [5.175, 1.12]],
  crown: [[0, 0.02], [1.0, 0.03], [2.2, 0.035], [4.7, 0.03], [5.175, 0]],
  tumble: 0.28,
  rB: 0.11,
  rT: 0.13,
  sideBulge: 0.018,
  crease: 0.55,
  front: { d: 1.0, r: 0.37, width: 0.24 },
  rear: { d: 4.06, r: 0.37, width: 0.24 },
  wheelStyle: 'multi',
  arch: 'round',
  archGap: 0.04,
  archTrim: 0,
  st: { noseEnd: 0.6, ws0: 1.05, ws1: 2.1, rg0: 4.72, rg1: 5.12, door0: 1.47, doorMid: 2.55, door1: 3.62, tailStart: 4.86 },
  windows: [[1.25, 2.5], [2.62, 3.58], [3.7, 4.62]],
  pillar: 'trim',
  details(ctx) {
    const nose = ctx.kit('nose');
    for (const [, sgn] of SIDES) {
      const y = 0.9;
      const z = 0.7 * sgn;
      const at = frontNormal(ctx, y, z);
      lamp(nose, at, y, z, 0.44, 0.11, 'lens', 0.12, 0.012);
      lamp(nose, at, y + 0.035, z, 0.42, 0.018, 'headlight', 0.03, 0.018);
      lamp(nose, at, y - 0.012, z - 0.06 * sgn, 0.08, 0.05, 'headlight', 0.03, 0.016);
      const f = frontNormal(ctx, 0.42, 0.76 * sgn);
      lamp(nose, f, 0.42, 0.76 * sgn, 0.018, 0.16, 'headlight', 0.03, 0.012);
    }
    const ug = frontNormal(ctx, 0.87, 0);
    lamp(nose, ug, 0.87, 0, 0.78, 0.06, 'trim', 0.06, 0.01);
    const lg = frontNormal(ctx, 0.46, 0);
    const q = basisQ(lg.n);
    const p = new THREE.Vector3(lg.x, 0.46, 0).addScaledVector(lg.n, -0.03);
    nose.extrude([[-0.62, 0.17], [0.62, 0.17], [0.47, -0.16], [-0.47, -0.16]], 0.08, 'trim', 'XY', { p: p.toArray() as V3, q }, 0.01);
    for (let i = 0; i < 4; i++) {
      const yy = 0.36 + i * 0.065;
      const g = frontNormal(ctx, yy, 0);
      lamp(nose, g, yy, 0, 0.95 - (3 - i) * 0.07, 0.014, 'inner', 0.02, 0.012);
    }
    mirror(ctx, 1.62, 1.14);
    doorHandle(ctx, 'door1', 2.35, 1.0);
    doorHandle(ctx, 'door2', 2.75, 1.0);
    for (const [side, sgn] of SIDES) {
      sideRun(ctx, sidePanelAt(ctx, side), 3.68, 4.6, 1.13, 0.03, 'trim', sgn, 0.008);
      topRail(ctx, 'roof', 2.35, 4.6, 0.7 * sgn, 0.05, 0.035, 0.03, 'trim');
      const tail = ctx.kit(`tail${side}` as PanelId);
      const y = 1.18;
      const z = 0.8 * sgn;
      const b = backNormal(ctx, y, z);
      lamp(tail, b, y, z, 0.26, 0.32, 'lens', 0.1, 0.01, 0);
      lamp(tail, b, y + 0.04, z, 0.22, 0.03, 'taillight', 0.03, 0.016);
      lamp(tail, b, y - 0.06, z, 0.03, 0.2, 'taillight', 0.03, 0.016);
      const band = backNormal(ctx, 1.2, 0.35 * sgn);
      lamp(tail, band, 1.2, 0.35 * sgn, 0.72, 0.07, 'trim', 0.04, 0.008);
      const lo = backNormal(ctx, 0.36, 0.45 * sgn);
      lamp(tail, lo, 0.36, 0.45 * sgn, 0.9, 0.12, 'trim', 0.06, 0.006);
    }
  },
};

const suv: VehicleSpec = {
  id: 'suv',
  label: 'Luxury SUV',
  descriptor: 'Mid-size performance SUV',
  robotClass: 'sovereign',
  defaultName: 'REGENT',
  defaultPaint: '#c9ccd1',
  defaultFinish: 'gloss',
  L: 4.924,
  interp: 'smooth',
  top: [
    [0, 0.9], [0.05, 0.99], [0.2, 1.06], [0.7, 1.12], [1.25, 1.16], [1.4, 1.18], [1.8, 1.47], [2.17, 1.69],
    [2.5, 1.77], [3.5, 1.755], [4.1, 1.7], [4.42, 1.6], [4.72, 1.22], [4.86, 1.06], [4.924, 0.92],
  ],
  bottom: [[0, 0.36], [0.14, 0.25], [0.45, 0.21], [1.0, 0.2], [4.3, 0.21], [4.75, 0.34], [4.924, 0.48]],
  halfW: [[0, 0.76], [0.18, 0.92], [0.55, 0.97], [1.0, 0.975], [3.6, 0.975], [3.95, 0.985], [4.5, 0.95], [4.8, 0.9], [4.924, 0.84]],
  belt: [[0, 1.1], [1.4, 1.18], [3.0, 1.21], [4.0, 1.24], [4.5, 1.24], [4.924, 1.16]],
  crown: [[0, 0.02], [0.5, 0.045], [1.2, 0.04], [2.2, 0.035], [4.4, 0.03], [4.924, 0]],
  tumble: 0.36,
  rB: 0.12,
  rT: 0.12,
  sideBulge: 0.032,
  crease: 0.55,
  front: { d: 0.95, r: 0.39, width: 0.28 },
  rear: { d: 3.945, r: 0.39, width: 0.28 },
  wheelStyle: 'amg',
  arch: 'round',
  archGap: 0.045,
  archTrim: 0,
  st: { noseEnd: 0.6, ws0: 1.4, ws1: 2.17, rg0: 4.3, rg1: 4.8, door0: 1.44, doorMid: 2.55, door1: 3.48, tailStart: 4.6 },
  windows: [[1.55, 2.5], [2.6, 3.42], [3.52, 4.12]],
  pillar: 'trim',
  details(ctx) {
    const nose = ctx.kit('nose');
    for (const [, sgn] of SIDES) {
      const y = 0.88;
      const z = 0.66 * sgn;
      const at = frontNormal(ctx, y, z);
      lamp(nose, at, y, z, 0.46, 0.14, 'lens', 0.12, 0.012);
      lamp(nose, at, y + 0.05, z + 0.02 * sgn, 0.42, 0.016, 'headlight', 0.03, 0.018);
      lamp(nose, at, y - 0.01, z - 0.1 * sgn, 0.05, 0.05, 'headlight', 0.03, 0.016);
      lamp(nose, at, y - 0.01, z + 0.02 * sgn, 0.05, 0.05, 'headlight', 0.03, 0.016);
      const li = frontNormal(ctx, 0.46, 0.66 * sgn);
      lamp(nose, li, 0.46, 0.66 * sgn, 0.22, 0.12, 'trim', 0.08, 0.008);
    }
    // Upright grille with chrome frame and twin louvre
    const g = frontNormal(ctx, 0.72, 0);
    lamp(nose, g, 0.72, 0, 0.9, 0.36, 'trim', 0.08, 0.014);
    for (const [dy, w, h] of [[0.18, 0.92, 0.02], [-0.18, 0.92, 0.02], [0.02, 0.88, 0.035]] as [number, number, number][]) {
      const gg = frontNormal(ctx, 0.72 + dy, 0);
      lamp(nose, gg, 0.72 + dy, 0, w, h, 'chrome', 0.03, 0.024);
    }
    for (const [, sgn] of SIDES) {
      const gs = frontNormal(ctx, 0.72, 0.46 * sgn);
      lamp(nose, gs, 0.72, 0.46 * sgn, 0.02, 0.38, 'chrome', 0.03, 0.022);
    }
    const lo = frontNormal(ctx, 0.42, 0);
    lamp(nose, lo, 0.42, 0, 1.0, 0.14, 'trim', 0.08, 0.008);
    const ls = frontNormal(ctx, 0.33, 0);
    lamp(nose, ls, 0.33, 0, 1.1, 0.02, 'chrome', 0.03, 0.015);

    mirror(ctx, 1.58, 1.2);
    doorHandle(ctx, 'door1', 2.3, 1.06);
    doorHandle(ctx, 'door2', 3.28, 1.08);
    for (const [side, sgn] of SIDES) {
      sideRun(ctx, sidePanelAt(ctx, side), 1.55, 4.12, ctx.body.belt(2.5) + 0.012, 0.018, 'chrome', sgn, 0.006);
      topRail(ctx, 'roof', 2.4, 4.2, 0.7 * sgn, 0.055, 0.035, 0.028, 'chrome');
      const tail = ctx.kit(`tail${side}` as PanelId);
      const y = 1.1;
      const z = 0.66 * sgn;
      const b = backNormal(ctx, y, z);
      lamp(tail, b, y, z, 0.48, 0.12, 'lens', 0.1, 0.01);
      lamp(tail, b, y + 0.02, z, 0.44, 0.022, 'taillight', 0.03, 0.016);
      lamp(tail, b, y - 0.03, z + 0.12 * sgn, 0.14, 0.04, 'taillight', 0.03, 0.016);
      const cs = backNormal(ctx, 1.02, 0.2 * sgn);
      lamp(tail, cs, 1.02, 0.2 * sgn, 0.42, 0.018, 'chrome', 0.03, 0.012);
      const ex = backNormal(ctx, 0.4, 0.55 * sgn);
      lamp(tail, ex, 0.4, 0.55 * sgn, 0.26, 0.07, 'chrome', 0.05, 0.01);
      lamp(tail, ex, 0.4, 0.55 * sgn, 0.22, 0.045, 'dark', 0.05, 0.014);
    }
  },
};

const truck: VehicleSpec = {
  id: 'truck',
  label: 'Wedge Pickup',
  descriptor: 'Stainless exoskeleton truck',
  robotClass: 'juggernaut',
  defaultName: 'MONOLITH',
  defaultPaint: '#b9bdc4',
  defaultFinish: 'brushed',
  L: 5.683,
  interp: 'linear',
  top: [[0, 1.0], [2.35, 1.79], [5.683, 1.2]],
  bottom: [[0, 0.93], [0.52, 0.45], [5.33, 0.45], [5.683, 0.72]],
  halfW: [[0, 0.955], [0.5, 1.0], [5.3, 1.0], [5.683, 0.985]],
  belt: [[0, 1.17], [5.683, 1.17]],
  crown: [[0, 0], [5.683, 0]],
  tumble: 0.72,
  rB: 0.02,
  rT: 0.025,
  sideBulge: 0,
  crease: 0.33,
  front: { d: 0.88, r: 0.44, width: 0.3 },
  rear: { d: 4.69, r: 0.44, width: 0.3 },
  wheelStyle: 'aero',
  arch: 'trapezoid',
  archGap: 0.07,
  archTrim: 0,
  st: { noseEnd: 0.54, ws0: 0.98, ws1: 2.1, rg0: 2.6, rg1: 3.3, door0: 1.42, doorMid: 2.55, door1: 3.7, tailStart: 5.36 },
  windows: [[1.5, 2.5], [2.62, 3.45]],
  pillar: 'paint',
  glassRoof: [2.1, 2.6],
  apron: [0.5, 0.3],
  details(ctx) {
    const nose = ctx.kit('nose');
    const L = ctx.spec.L;
    nose.box(0.03, 0.018, 1.84, 'headlight', { p: [L / 2 - 0.004, 0.968, 0] }, 0.006);
    nose.box(0.02, 0.05, 1.9, 'trim', { p: [L / 2 - 0.012, 0.965, 0] }, 0.005);
    mirror(ctx, 1.55, 1.1, 'angular');
    // Angular arch cladding
    for (const [w, panel] of [[ctx.spec.front, 'fender'], [ctx.spec.rear, 'quarter']] as const) {
      const Ra = w.r + ctx.spec.archGap;
      const span = Ra * 1.32 + 0.1;
      const sill = 0.47;
      const outer: [number, number][] = [];
      const inner: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const d = w.d - span + (2 * span * i) / 24;
        const ay = ctx.body.archY(d);
        const y = Math.max(sill, ay > -Infinity ? ay : sill);
        inner.push([ctx.x(d), y]);
        outer.push([ctx.x(d), Math.max(sill, y + 0.1)]);
      }
      const outline = [...outer, ...inner.reverse()];
      for (const [side, sgn] of SIDES) {
        const z = (ctx.body.hw(w.d) + 0.012) * sgn;
        ctx.kit(`${panel}${side}` as PanelId).extrude(outline, 0.03, 'trim', 'XY', { p: [0, 0, z] }, 0.008);
      }
    }
    const deck = ctx.kit('deck');
    for (let d = 3.55; d < 5.3; d += 0.29) {
      const tp = topPoint(ctx, d, 0);
      deck.box(0.012, 0.008, 1.9, 'trim', { p: [tp.p.x, tp.p.y + 0.002, 0], q: qFromY(tp.n) }, 0.003);
    }
    for (const [side, sgn] of SIDES) {
      const tail = ctx.kit(`tail${side}` as PanelId);
      tail.box(0.03, 0.02, 0.93, 'taillight', { p: [-L / 2 + 0.004, 1.165, 0.475 * sgn] }, 0.006);
      tail.box(0.02, 0.05, 0.96, 'trim', { p: [-L / 2 + 0.012, 1.162, 0.48 * sgn] }, 0.005);
    }
  },
};

export const VEHICLES: Record<VehicleId, VehicleSpec> = { coupe, van, suv, truck };
export const VEHICLE_ORDER: VehicleId[] = ['coupe', 'van', 'suv', 'truck'];

/** Where the insignia sits (always on the nose panel's front face so it reads in both modes). */
export function emblemPlacement(ctx: DetailCtx): { p: THREE.Vector3; n: THREE.Vector3; size: number } {
  const id = ctx.spec.id;
  const y = { coupe: 0.5, van: 0.66, suv: 0.74, truck: 0.7 }[id];
  const size = { coupe: 0.15, van: 0.2, suv: 0.2, truck: 0.22 }[id];
  const f = frontNormal(ctx, y, 0);
  const lift = id === 'suv' ? 0.05 : 0.01;
  return { p: new THREE.Vector3(f.x, y, 0).addScaledVector(f.n, lift), n: f.n, size };
}

/** Headlight beam origins (car coords) for the working spot lights. */
export function beamOrigins(spec: VehicleSpec): V3[] {
  const x = spec.L / 2 - 0.2;
  switch (spec.id) {
    case 'coupe':
      return [[x, 0.66, 0.62], [x, 0.66, -0.62]];
    case 'van':
      return [[x, 0.9, 0.7], [x, 0.9, -0.7]];
    case 'suv':
      return [[x, 0.88, 0.66], [x, 0.88, -0.66]];
    default:
      return [[spec.L / 2 - 0.05, 0.96, 0.7], [spec.L / 2 - 0.05, 0.96, -0.7]];
  }
}
