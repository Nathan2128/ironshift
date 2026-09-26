import * as THREE from 'three';
import type { Kit, V3 } from '../core/kit';
import type { MatKey } from '../core/materials';
import type { DetailCtx, PanelId } from './types';

export type Side = 'R' | 'L';
export const SIDES: [Side, number][] = [
  ['R', 1],
  ['L', -1],
];

const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

export const qFromZ = (n: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(Z, n.clone().normalize());

/** Orientation with local Z along n and local X kept horizontal (no roll). */
export function basisQ(n: THREE.Vector3, up = Y) {
  const z = n.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
export const qFromY = (n: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(Y, n.clone().normalize());

/** Approximate outward surface normal on the front of the body at (y, z). */
export function frontNormal(ctx: DetailCtx, y: number, z: number) {
  const b = ctx.body;
  const e = 0.03;
  const d0 = b.frontD(y, z);
  const dy = b.frontD(y + e, z) - b.frontD(y - e, z);
  const dz = b.frontD(y, z + e) - b.frontD(y, z - e);
  // surface: x = L/2 - d(y,z) -> normal ∝ (1, dd/dy, dd/dz)
  return { x: ctx.x(d0), n: new THREE.Vector3(1, dy / (2 * e), dz / (2 * e)).normalize() };
}

export function backNormal(ctx: DetailCtx, y: number, z: number) {
  const b = ctx.body;
  const e = 0.03;
  const d0 = b.backD(y, z);
  const dy = b.backD(y + e, z) - b.backD(y - e, z);
  const dz = b.backD(y, z + e) - b.backD(y, z - e);
  return { x: ctx.x(d0), n: new THREE.Vector3(-1, -dy / (2 * e), -dz / (2 * e)).normalize() };
}

/** Top surface point and normal at (d, z). */
export function topPoint(ctx: DetailCtx, d: number, z: number) {
  const b = ctx.body;
  const e = 0.03;
  const y = b.yAt(d, z);
  const dyd = (b.yAt(d + e, z) - b.yAt(d - e, z)) / (2 * e); // along d (i.e. -x)
  const dyz = (b.yAt(d, z + e) - b.yAt(d, z - e)) / (2 * e);
  const n = new THREE.Vector3(dyd, 1, -dyz).normalize();
  return { p: new THREE.Vector3(ctx.x(d), y, z), n };
}

/** Side surface point and outward normal at (d, y) on a given side. */
export function sidePoint(ctx: DetailCtx, d: number, y: number, sgn: number) {
  const b = ctx.body;
  const e = 0.03;
  const z = b.zAt(d, y);
  const dzd = (b.zAt(d + e, y) - b.zAt(d - e, y)) / (2 * e);
  const n = new THREE.Vector3(dzd, 0, 1).normalize();
  n.z *= sgn;
  return { p: new THREE.Vector3(ctx.x(d), y, z * sgn), n };
}

/** Flush lamp/lens on a front or rear surface: an oriented box pressed into the skin. */
export function lamp(
  k: Kit,
  at: { x: number; n: THREE.Vector3 },
  y: number,
  z: number,
  w: number,
  h: number,
  mat: MatKey,
  depth = 0.05,
  push = 0.012,
  roll = 0,
) {
  const q = basisQ(at.n);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll));
  const p = new THREE.Vector3(at.x, y, z).addScaledVector(at.n, push - depth / 2);
  k.box(w, h, depth, mat, { p: p.toArray() as V3, q }, Math.min(0.012, h / 3));
}

/** A run of short boxes following the side surface between d0 and d1 at height y. */
export function sideRun(
  ctx: DetailCtx,
  panel: (d: number) => PanelId | null,
  d0: number,
  d1: number,
  y: number,
  h: number,
  mat: MatKey,
  sgn: number,
  out = 0.006,
  thick = 0.012,
) {
  const n = Math.max(1, Math.ceil((d1 - d0) / 0.12));
  for (let i = 0; i < n; i++) {
    const da = d0 + ((d1 - d0) * i) / n;
    const db = d0 + ((d1 - d0) * (i + 1)) / n;
    const pid = panel((da + db) / 2);
    if (!pid) continue;
    const a = sidePoint(ctx, da, y, sgn);
    const b = sidePoint(ctx, db, y, sgn);
    a.p.addScaledVector(a.n, out);
    b.p.addScaledVector(b.n, out);
    const mid = a.p.clone().add(b.p).multiplyScalar(0.5);
    const len = a.p.distanceTo(b.p) + 0.004;
    const dir = b.p.clone().sub(a.p).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    ctx.kit(pid).box(len, h, thick, mat, { p: mid.toArray() as V3, q }, 0.003);
  }
}

/** A rail following the top surface along d at lateral offset z. */
export function topRail(ctx: DetailCtx, panel: PanelId, d0: number, d1: number, z: number, lift: number, w: number, h: number, mat: MatKey) {
  const n = Math.max(1, Math.ceil((d1 - d0) / 0.2));
  const k = ctx.kit(panel);
  for (let i = 0; i < n; i++) {
    const da = d0 + ((d1 - d0) * i) / n;
    const db = d0 + ((d1 - d0) * (i + 1)) / n;
    const a = topPoint(ctx, da, z).p;
    const b = topPoint(ctx, db, z).p;
    a.y += lift;
    b.y += lift;
    k.beam(a.toArray() as V3, b.toArray() as V3, w, h, mat, 0.008);
  }
  // feet
  for (const d of [d0 + 0.04, d1 - 0.04]) {
    const p = topPoint(ctx, d, z).p;
    k.box(0.08, lift + 0.01, w * 1.3, 'trim', { p: [p.x, p.y + lift / 2, p.z] }, 0.01);
  }
}

/** Side mirror: housing + stalk, attached to the front door. */
export function mirror(ctx: DetailCtx, d: number, y: number, style: 'round' | 'angular' = 'round') {
  for (const [side, sgn] of SIDES) {
    const k = ctx.kit(`door1${side}` as PanelId);
    const s = sidePoint(ctx, d, y, sgn);
    const base = s.p.clone();
    const head = base.clone().add(new THREE.Vector3(-0.05, 0.05, 0.16 * sgn));
    k.beam(base.toArray() as V3, head.toArray() as V3, 0.05, 0.03, 'trim', 0.01);
    if (style === 'angular') {
      k.box(0.12, 0.09, 0.2, 'trim', { p: head.toArray() as V3, r: [0, 0.15 * sgn, 0] }, 0.005);
    } else {
      k.box(0.13, 0.12, 0.22, 'paint', { p: head.toArray() as V3, r: [0, 0.2 * sgn, 0] }, 0.045);
      k.box(0.02, 0.1, 0.19, 'trim', { p: [head.x - 0.065, head.y, head.z], r: [0, 0.2 * sgn, 0] }, 0.01);
    }
  }
}

export function doorHandle(ctx: DetailCtx, panel: 'door1' | 'door2', d: number, y: number, mat: MatKey = 'chrome') {
  for (const [side, sgn] of SIDES) {
    const s = sidePoint(ctx, d, y, sgn);
    const q = qFromZ(s.n);
    const p = s.p.clone().addScaledVector(s.n, 0.004);
    ctx.kit(`${panel}${side}` as PanelId).box(0.2, 0.035, 0.03, mat, { p: p.toArray() as V3, q }, 0.012);
  }
}

/** Panel that owns side position d. */
export function sidePanelAt(ctx: DetailCtx, side: Side) {
  const st = ctx.spec.st;
  return (d: number): PanelId | null => {
    if (d < st.noseEnd) return null;
    if (d < st.door0) return `fender${side}` as PanelId;
    if (d < st.doorMid) return `door1${side}` as PanelId;
    if (d < st.door1) return `door2${side}` as PanelId;
    if (d < st.tailStart) return `quarter${side}` as PanelId;
    return null;
  };
}
