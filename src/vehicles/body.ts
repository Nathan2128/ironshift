import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { curve } from '../core/math';
import { BODY } from '../core/materials';
import type { VehicleSpec } from './types';

/*
 * A car body is a loft of cross-sections along its length. Every section has
 * the same vertex layout, so any panel can be cut out by (length range) x
 * (ring index range) and the pieces fit back together exactly.
 *
 * Ring layout (right half, bottom centre -> top centre), mirrored for left:
 *   bf bottom flat | bc bottom corner | sl side lower | su greenhouse side
 *   tc roof corner | tf roof flat
 */
export type Seg = 'bf' | 'bc' | 'sl' | 'su' | 'tc' | 'tf' | 'cap' | 'center';
const COUNTS: [Seg, number][] = [
  ['bf', 3],
  ['bc', 4],
  ['sl', 6],
  ['su', 4],
  ['tc', 5],
  ['tf', 4],
];
export const H = COUNTS.reduce((a, [, n]) => a + n, 0); // 26
export const RING = 2 * H;

const INTERVAL_SEG: Seg[] = [];
const INTERVAL_SIDE: ('R' | 'L')[] = [];
for (const [s, n] of COUNTS) for (let i = 0; i < n; i++) (INTERVAL_SEG.push(s), INTERVAL_SIDE.push('R'));
for (const [s, n] of [...COUNTS].reverse()) for (let i = 0; i < n; i++) (INTERVAL_SEG.push(s), INTERVAL_SIDE.push('L'));

export const IDX = {
  bcStart: 3,
  slStart: 7,
  suStart: 13,
  tcStart: 17,
  tfStart: 22,
  top: H,
};

export const RANGES = {
  sideR: [IDX.bcStart, IDX.tcStart] as [number, number],
  sideL: [RING - IDX.tcStart, RING - IDX.bcStart] as [number, number],
  topR: [IDX.tcStart, H] as [number, number],
  topL: [H, RING - IDX.tcStart] as [number, number],
  top: [IDX.tcStart, RING - IDX.tcStart] as [number, number],
  bottom: [RING - IDX.bcStart, RING + IDX.bcStart] as [number, number],
};

interface Ring {
  z: Float64Array;
  y: Float64Array;
  nz: Float64Array;
  ny: Float64Array;
}

export class BodyShape {
  readonly L: number;
  readonly top: (d: number) => number;
  readonly bot: (d: number) => number;
  readonly hw: (d: number) => number;
  readonly belt: (d: number) => number;
  readonly crown: (d: number) => number;

  constructor(readonly spec: VehicleSpec) {
    this.L = spec.L;
    const mode = spec.interp;
    this.top = curve(spec.top, mode);
    this.bot = curve(spec.bottom, mode);
    this.hw = curve(spec.halfW, mode);
    this.belt = curve(spec.belt, mode);
    this.crown = curve(spec.crown, 'smooth');
  }

  x(d: number) {
    return this.L / 2 - d;
  }

  /** Arch height at distance d (the body is pushed up above this line near wheels). */
  archY(d: number) {
    const s = this.spec;
    let y = -Infinity;
    for (const w of [s.front, s.rear]) {
      const dx = Math.abs(d - w.d);
      const Ra = w.r + s.archGap;
      if (s.arch === 'round') {
        if (dx < Ra) y = Math.max(y, w.r + Math.sqrt(Ra * Ra - dx * dx) * 1.0);
      } else {
        const top = w.r + Ra * 0.98;
        const a = Ra * 0.62;
        const b = Ra * 1.32;
        if (dx < a) y = Math.max(y, top);
        else if (dx < b) y = Math.max(y, top * ((b - dx) / (b - a)) + w.r * 0.35 * ((dx - a) / (b - a)));
      }
    }
    return y;
  }

  /** Undeformed right half contour: H+1 points from bottom centre to top centre. */
  rightHalf(d: number) {
    const s = this.spec;
    const yb = this.bot(d);
    const yt = Math.max(this.top(d), yb + 0.02);
    const w = Math.max(this.hw(d), 0.05);
    const h = yt - yb;
    let rB = s.rB;
    let rT = s.rT;
    if (rB + rT > h * 0.92) {
      const k = (h * 0.92) / (rB + rT);
      rB *= k;
      rT *= k;
    }
    rB = Math.min(rB, w * 0.45);
    rT = Math.min(rT, w * 0.45);
    const beltE = Math.min(Math.max(this.belt(d), yb + rB), yt - rT);
    const g = Math.max(0, yt - rT - beltE);
    const wT = w - g * s.tumble;
    const cx = wT - rT;
    const cy = yt - rT;
    const a0 = Math.atan2(s.tumble, 1);
    const cr = this.crown(d);

    const zs: number[] = [];
    const ys: number[] = [];
    const push = (z: number, y: number) => (zs.push(z), ys.push(y));
    const [nbf, nbc, nsl, nsu, ntc, ntf] = COUNTS.map((c) => c[1]);

    for (let i = 0; i <= nbf; i++) push(((w - rB) * i) / nbf, yb);
    for (let i = 1; i <= nbc; i++) {
      const a = -Math.PI / 2 + ((Math.PI / 2) * i) / nbc;
      push(w - rB + rB * Math.cos(a), yb + rB + rB * Math.sin(a));
    }
    const slY0 = yb + rB;
    for (let i = 1; i <= nsl; i++) {
      const t = i / nsl;
      const bulge = s.sideBulge * Math.sin(Math.PI * t);
      push(w + bulge, slY0 + (beltE - slY0) * t);
    }
    const sx = cx + rT * Math.cos(a0);
    const sy = cy + rT * Math.sin(a0);
    for (let i = 1; i <= nsu; i++) {
      const t = i / nsu;
      push(w + (sx - w) * t, beltE + (sy - beltE) * t);
    }
    for (let i = 1; i <= ntc; i++) {
      const a = a0 + ((Math.PI / 2 - a0) * i) / ntc;
      push(cx + rT * Math.cos(a), cy + rT * Math.sin(a));
    }
    for (let i = 1; i <= ntf; i++) {
      const z = cx * (1 - i / ntf);
      const u = cx > 1e-4 ? z / cx : 0;
      push(z, yt + cr * (1 - u * u));
    }
    return { z: zs, y: ys };
  }

  /** Full ring with arch deformation applied; normals come from the undeformed ring. */
  ring(d: number): Ring {
    const half = this.rightHalf(d);
    const z = new Float64Array(RING);
    const y = new Float64Array(RING);
    for (let i = 0; i <= H; i++) {
      z[i] = half.z[i];
      y[i] = half.y[i];
    }
    for (let j = H + 1; j < RING; j++) {
      z[j] = -half.z[RING - j];
      y[j] = half.y[RING - j];
    }
    const nz = new Float64Array(RING);
    const ny = new Float64Array(RING);
    for (let i = 0; i < RING; i++) {
      const a = (i - 1 + RING) % RING;
      const b = (i + 1) % RING;
      let tz = z[b] - z[a];
      let ty = y[b] - y[a];
      const l = Math.hypot(tz, ty) || 1;
      tz /= l;
      ty /= l;
      nz[i] = ty;
      ny[i] = -tz;
    }
    const ay = this.archY(d);
    if (ay > -Infinity) {
      const lim = IDX.suStart;
      for (let i = 0; i <= lim; i++) {
        if (y[i] < ay) y[i] = ay;
        const j = (RING - i) % RING;
        if (y[j] < ay) y[j] = ay;
      }
    }
    return { z, y, nz, ny };
  }

  /* ---------- surface queries used to place details flush ---------- */

  /** Max |z| of the body at height y (undeformed). */
  zAt(d: number, y: number) {
    const { z, y: ys } = this.rightHalf(d);
    let best = -1;
    for (let i = 0; i < ys.length - 1; i++) {
      const y0 = ys[i], y1 = ys[i + 1];
      if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) {
        const t = Math.abs(y1 - y0) < 1e-6 ? 0 : (y - y0) / (y1 - y0);
        best = Math.max(best, z[i] + (z[i + 1] - z[i]) * t);
      }
    }
    return best;
  }

  /** Top surface height at lateral offset z. */
  yAt(d: number, z: number) {
    const { z: zs, y } = this.rightHalf(d);
    const az = Math.abs(z);
    for (let i = zs.length - 1; i > 0; i--) {
      const z0 = zs[i], z1 = zs[i - 1];
      if (az >= Math.min(z0, z1) && az <= Math.max(z0, z1)) {
        const t = Math.abs(z1 - z0) < 1e-6 ? 0 : (az - z0) / (z1 - z0);
        return y[i] + (y[i - 1] - y[i]) * t;
      }
    }
    return y[y.length - 1];
  }

  inside(d: number, y: number, z: number) {
    if (d < 0 || d > this.L) return false;
    if (y < this.bot(d) || y > this.yAt(d, z)) return false;
    return Math.abs(z) <= this.zAt(d, y);
  }

  /** First d (from the front) where (y, z) is inside the body. */
  frontD(y: number, z: number) {
    for (let d = 0; d < this.L * 0.4; d += 0.004) if (this.inside(d, y, z)) return d;
    return 0;
  }

  /** Last d (from the rear) where (y, z) is inside the body. */
  backD(y: number, z: number) {
    for (let d = this.L; d > this.L * 0.6; d -= 0.004) if (this.inside(d, y, z)) return d;
    return this.L;
  }
}

/* ------------------------------------------------------------------ */

export type PanelKind = 'shell' | 'solid' | 'halfR' | 'halfL';

export interface PanelOpts {
  d0: number;
  d1: number;
  range?: [number, number];
  kind: PanelKind;
  thick?: number;
  gap?: number;
}

/** Decides the material of a face from where it sits on the body. */
export function bodyMaterial(body: BodyShape, d: number, seg: Seg, y: number): number {
  const s = body.spec;
  const { PAINT, GLASS, TRIM } = BODY;
  if (seg === 'cap') return PAINT;
  if (seg === 'bf') {
    const ap = s.apron;
    if (ap && (d < ap[0] || d > body.L - ap[1])) return PAINT;
    return TRIM;
  }
  const inR = (r?: [number, number]) => !!r && d >= r[0] && d <= r[1];
  if ((seg === 'bc' || seg === 'sl') && s.archTrim > 0) {
    const ay = body.archY(d);
    const nearArch = [s.front, s.rear].some((w) => Math.abs(d - w.d) < w.r + s.archGap + s.archTrim * 1.4);
    if (nearArch && y < Math.max(ay, 0) + s.archTrim) return TRIM;
    if (y < body.bot(d) + 0.07) return TRIM;
  }
  if (seg === 'bc') return y < body.bot(d) + 0.06 ? TRIM : PAINT;
  if (seg === 'sl') return PAINT;
  if (seg === 'su') {
    if (s.windows.some((w) => d >= w[0] && d <= w[1])) return GLASS;
    return s.pillar === 'trim' ? TRIM : PAINT;
  }
  if (seg === 'tf') {
    if (inR([s.st.ws0, s.st.ws1]) || inR([s.st.rg0, s.st.rg1]) || inR(s.glassRoof)) return GLASS;
    return PAINT;
  }
  if (seg === 'tc') {
    if (inR(s.glassRoof)) return GLASS;
    return PAINT;
  }
  return PAINT;
}

const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();

export function buildPanel(body: BodyShape, o: PanelOpts): { geo: THREE.BufferGeometry; center: THREE.Vector3; size: THREE.Vector3 } {
  const L = body.L;
  const gap = o.gap ?? 0.005;
  const d0 = o.d0 <= 1e-4 ? 0 : o.d0 + gap;
  const d1 = o.d1 >= L - 1e-4 ? L : o.d1 - gap;
  const nSt = Math.max(2, Math.ceil((d1 - d0) / 0.028));
  const ds: number[] = [];
  for (let i = 0; i <= nSt; i++) ds.push(d0 + ((d1 - d0) * i) / nSt);
  const rings = ds.map((d) => body.ring(d));
  const xs = ds.map((d) => body.x(d));

  let us: number[] = [];
  if (o.kind === 'solid') for (let i = 0; i <= RING; i++) us.push(i);
  else if (o.kind === 'halfR') for (let i = 0; i <= H; i++) us.push(i);
  else if (o.kind === 'halfL') for (let i = H; i <= RING; i++) us.push(i);
  else {
    const [a, b] = o.range!;
    const rg = 0.14;
    const ua = a + rg;
    const ub = b - rg;
    us.push(ua);
    for (let i = Math.ceil(ua + 0.02); i <= Math.floor(ub - 0.02); i++) us.push(i);
    us.push(ub);
  }

  const P = (s: number, u: number, inset = 0) => {
    const r = rings[s];
    const i0 = Math.floor(u);
    const f = u - i0;
    const a = ((i0 % RING) + RING) % RING;
    const b = (a + 1) % RING;
    const z = r.z[a] + (r.z[b] - r.z[a]) * f;
    const y = r.y[a] + (r.y[b] - r.y[a]) * f;
    if (!inset) return new THREE.Vector3(xs[s], y, z);
    let nz = r.nz[a] + (r.nz[b] - r.nz[a]) * f;
    let ny = r.ny[a] + (r.ny[b] - r.ny[a]) * f;
    const l = Math.hypot(nz, ny) || 1;
    nz /= l;
    ny /= l;
    return new THREE.Vector3(xs[s], y - ny * inset, z - nz * inset);
  };

  const buckets: number[][] = [[], [], [], [], []];
  const tri = (m: number, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    buckets[m].push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const quad = (m: number, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    tri(m, a, b, c);
    tri(m, a, c, d);
  };
  const orientedTri = (m: number, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, dir: THREE.Vector3) => {
    va.subVectors(b, a);
    vb.subVectors(c, a);
    vc.crossVectors(va, vb);
    if (vc.dot(dir) < 0) tri(m, a, c, b);
    else tri(m, a, b, c);
  };
  const orientedQuad = (m: number, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, dir: THREE.Vector3) => {
    orientedTri(m, a, b, c, dir);
    orientedTri(m, a, c, d, dir);
  };

  const segOf = (u0: number, u1: number) => {
    const mid = Math.floor((u0 + u1) / 2);
    const k = ((mid % RING) + RING) % RING;
    return INTERVAL_SEG[k];
  };

  // Outer skin
  for (let s = 0; s < nSt; s++) {
    for (let k = 0; k < us.length - 1; k++) {
      const A = P(s, us[k]);
      const B = P(s, us[k + 1]);
      const C = P(s + 1, us[k + 1]);
      const D = P(s + 1, us[k]);
      const dm = (ds[s] + ds[s + 1]) / 2;
      const ym = (A.y + B.y + C.y + D.y) / 4;
      const m = bodyMaterial(body, dm, segOf(us[k], us[k + 1]), ym);
      quad(m, A, B, C, D);
    }
  }

  const INNER = BODY.INNER;
  const fwd = new THREE.Vector3(1, 0, 0);
  const back = new THREE.Vector3(-1, 0, 0);

  if (o.kind === 'shell') {
    const th = o.thick ?? 0.045;
    for (let s = 0; s < nSt; s++) {
      for (let k = 0; k < us.length - 1; k++) {
        const A = P(s, us[k], th);
        const B = P(s, us[k + 1], th);
        const C = P(s + 1, us[k + 1], th);
        const D = P(s + 1, us[k], th);
        quad(INNER, A, D, C, B);
      }
    }
    // front & back rims
    for (const [s, dir] of [
      [0, fwd],
      [nSt, back],
    ] as [number, THREE.Vector3][]) {
      for (let k = 0; k < us.length - 1; k++) {
        orientedQuad(INNER, P(s, us[k]), P(s, us[k + 1]), P(s, us[k + 1], th), P(s, us[k], th), dir);
      }
    }
    // side rims (start / end of the ring range)
    for (const [u, sign] of [
      [us[0], -1],
      [us[us.length - 1], 1],
    ] as [number, number][]) {
      for (let s = 0; s < nSt; s++) {
        const t0 = P(s, u + 0.01).sub(P(s, u - 0.01)).multiplyScalar(sign);
        t0.x = 0;
        orientedQuad(INNER, P(s, u), P(s + 1, u), P(s + 1, u, th), P(s, u, th), t0.normalize());
      }
    }
  } else {
    // caps
    const closed = o.kind === 'solid';
    const capUs = closed ? us.slice(0, -1) : us;
    for (const [s, dir, dEnd] of [
      [0, fwd, d0],
      [nSt, back, d1],
    ] as [number, THREE.Vector3, number][]) {
      const pts = capUs.map((u) => P(s, u));
      const c = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      const outerEnd = dEnd <= 1e-4 || dEnd >= L - 1e-4;
      const m = outerEnd ? BODY.PAINT : INNER;
      const n = closed ? pts.length : pts.length - 1;
      for (let k = 0; k < n; k++) orientedTri(m, c, pts[k], pts[(k + 1) % pts.length], dir);
      if (!closed) orientedTri(m, c, pts[pts.length - 1], pts[0], dir);
    }
    if (!closed) {
      const dir = new THREE.Vector3(0, 0, o.kind === 'halfR' ? -1 : 1);
      const u0 = us[0];
      const u1 = us[us.length - 1];
      for (let s = 0; s < nSt; s++) orientedQuad(INNER, P(s, u0), P(s + 1, u0), P(s + 1, u1), P(s, u1), dir);
    }
  }

  // Assemble with material groups
  const total = buckets.reduce((a, b) => a + b.length, 0);
  const pos = new Float32Array(total);
  const geo = new THREE.BufferGeometry();
  let off = 0;
  buckets.forEach((b, m) => {
    pos.set(b, off);
    if (b.length) geo.addGroup(off / 3, b.length / 3, m);
    off += b.length;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const center = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3());
  geo.translate(-center.x, -center.y, -center.z);
  const creased = toCreasedNormals(geo, body.spec.crease);
  creased.computeBoundingSphere();
  return { geo: creased, center, size };
}
