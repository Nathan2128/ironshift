import { Kit } from '../core/kit';
import type { RobotDims } from './classes';
import type { Loadout } from './classes';
import { insigniaKit, type Insignia } from '../vehicles/insignia';

type P2 = [number, number];

/** Chamfered rectangle outline (hard-surface plate). */
export function plate(w: number, h: number, c: number, taper = 1): P2[] {
  const t = (w * taper) / 2;
  const b = w / 2;
  return [
    [-t + c, h / 2],
    [t - c, h / 2],
    [t, h / 2 - c],
    [b, -h / 2 + c],
    [b - c, -h / 2],
    [-b + c, -h / 2],
    [-b, -h / 2 + c],
    [-t, h / 2 - c],
  ];
}

const mirrorX = (p: P2[]): P2[] => p.map(([x, y]) => [-x, y] as P2).reverse();

/* ------------------------------------------------------------------ */

export function pelvisCore(D: RobotDims) {
  const k = new Kit();
  const s = D.s;
  const L = D.limb;
  const hw = D.hipHalf;
  k.box(0.62 * s * L * 0.9, 0.46 * s, hw * 2 * 0.95, 'inner', { p: [0, 0.02 * s, 0] }, 0.06);
  k.box(0.72 * s, 0.1 * s, hw * 2 + 0.12 * s, 'trim', { p: [0, 0.25 * s, 0] }, 0.03);
  k.box(0.03, 0.05 * s, hw * 1.2, 'energy', { p: [0.33 * s * L * 0.9, 0.13 * s, 0] }, 0.01);
  // rear armour
  k.extrude(plate(0.5 * s, 0.4 * s, 0.07 * s, 1.2), 0.09 * s, 'paint', 'ZY', { p: [-0.36 * s * L, 0.02 * s, 0] }, 0.015);
  for (const sgn of [1, -1]) {
    k.cylZ(0.21 * s * L, 0.22 * s, 'inner', [0, -0.1 * s, sgn * hw], 24);
    k.cylZ(0.12 * s * L, 0.24 * s, 'chrome', [0, -0.1 * s, sgn * hw], 18);
    // tassets
    k.extrude(plate(0.42 * s, 0.46 * s, 0.08 * s, 1.25), 0.06 * s, 'paint', 'XY', {
      p: [0.02 * s, -0.08 * s, sgn * (hw + 0.2 * s * L)],
      r: [sgn * 0.18, 0, 0],
    }, 0.012);
  }
  return k;
}

export function abdomen(D: RobotDims) {
  const k = new Kit();
  const s = D.s;
  const len = D.abdomenLen;
  const wScale = D.chestW / (1.55 * s);
  k.cyl(0.13 * s, 0.13 * s, len + 0.2 * s, 'chrome', { p: [0, len / 2 - 0.05 * s, 0] }, 20);
  const ws = [0.7, 0.8, 0.9];
  ws.forEach((w, i) => {
    const y = ((i + 0.5) / 3) * len;
    k.box(0.55 * D.chestD, 0.13 * s, w * wScale * s, 'inner', { p: [0, y, 0] }, 0.03);
    if (i < 2) k.box(0.45 * D.chestD, 0.025 * s, w * wScale * s * 0.85, 'energy', { p: [0.02, y + len / 6, 0] }, 0.005);
  });
  for (const sgn of [1, -1]) {
    k.rod([0, -0.2 * s, sgn * 0.32 * s * wScale], [0, len + 0.1 * s, sgn * 0.42 * s * wScale], 0.035 * s, 'chrome');
    k.rod([-0.1 * s, -0.2 * s, sgn * 0.2 * s], [-0.12 * s, len + 0.1 * s, sgn * 0.26 * s], 0.05 * s, 'dark');
  }
  return k;
}

export function chestCore(D: RobotDims) {
  const k = new Kit();
  const s = D.s;
  const { chestW: W, chestH: H, chestD: Dp } = D;
  k.box(Dp * 0.85, H * 0.8, W * 0.76, 'inner', { p: [0, H * 0.5, 0] }, 0.08);
  k.box(Dp * 0.7, 0.14 * s, W * 0.55, 'trim', { p: [0, H * 0.94, 0] }, 0.04);
  // core
  k.cylX(0.17 * s, 0.1 * s, 'energy', [Dp * 0.4, H * 0.42, 0], 8);
  k.torus(0.2 * s, 0.035 * s, 'chrome', { p: [Dp * 0.44, H * 0.42, 0], r: [0, Math.PI / 2, 0] }, 8, 8);
  for (const sgn of [1, -1]) {
    // lats flaring to the shoulders
    k.box(Dp * 0.62, H * 0.72, 0.2 * s, 'inner', { p: [-0.02, H * 0.45, sgn * W * 0.4], r: [-sgn * 0.28, 0, 0] }, 0.04);
    // collar guards
    k.extrude(plate(0.42 * s, 0.34 * s, 0.07 * s, 0.6), 0.08 * s, 'paint', 'ZY', {
      p: [Dp * 0.08, H * 1.02, sgn * W * 0.26],
      r: [sgn * 0.5, 0, 0.35],
    }, 0.015);
    // shoulder sockets
    k.cylZ(0.2 * s * D.limb, 0.24 * s, 'inner', [0, H * 0.78, sgn * W * 0.43], 22);
    // exhaust stacks
    k.cyl(0.07 * s, 0.08 * s, 0.62 * s, 'chrome', { p: [-Dp * 0.45, H * 0.82, sgn * W * 0.2] }, 14);
    k.cyl(0.05 * s, 0.05 * s, 0.63 * s, 'dark', { p: [-Dp * 0.45, H * 0.83, sgn * W * 0.2] }, 14);
    // vents
    for (let i = 0; i < 3; i++) {
      k.box(0.24 * s, 0.03 * s, 0.05 * s, 'trim', { p: [Dp * 0.2, H * (0.2 + i * 0.07), sgn * W * 0.39] }, 0.008);
    }
  }
  return k;
}

export function neckCore(D: RobotDims) {
  const k = new Kit();
  const s = D.s;
  const h = D.neckLen + 0.16 * s;
  k.cyl(0.12 * s, 0.14 * s, h, 'inner', { p: [0, h / 2 - 0.06 * s, 0] }, 16);
  k.torus(0.13 * s, 0.018 * s, 'chrome', { p: [0, 0.02 * s, 0], r: [Math.PI / 2, 0, 0] }, 6, 20);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    k.rod([Math.cos(a) * 0.1 * s, -0.08 * s, Math.sin(a) * 0.1 * s], [Math.cos(a) * 0.08 * s, h - 0.06 * s, Math.sin(a) * 0.08 * s], 0.02 * s, 'dark', 8);
  }
  return k;
}

/* ------------------------------------------------------------------ */

export function head(D: RobotDims) {
  const k = new Kit();
  const u = D.headSize;
  const style = D.head;
  const S = (pts: P2[]) => pts.map(([a, b]) => [a * u, b * u] as P2);

  k.box(0.78 * u, 0.9 * u, 0.78 * u, 'inner', { p: [0, 0.5 * u, 0] }, 0.08 * u);

  // Faceplate (V jaw)
  const jaw: P2[] = style === 'monolith'
    ? [[-0.36, 0.6], [0.36, 0.6], [0.36, 0.08], [0.2, -0.04], [-0.2, -0.04], [-0.36, 0.08]]
    : [[-0.33, 0.6], [0.33, 0.6], [0.31, 0.22], [0.12, -0.03], [-0.12, -0.03], [-0.31, 0.22]];
  k.extrude(S(jaw), 0.14 * u, style === 'monolith' ? 'paint' : 'chrome', 'ZY', { p: [0.36 * u, 0, 0] }, 0.02 * u);
  // mouth slats
  for (let i = 0; i < 3; i++) {
    k.box(0.05 * u, 0.028 * u, (0.3 - i * 0.07) * u, 'trim', { p: [0.44 * u, (0.34 - i * 0.08) * u, 0] }, 0.006);
  }

  // Eyes
  if (style === 'bastion' || style === 'monolith') {
    const w = style === 'monolith' ? 0.34 : 0.3;
    k.extrude(S([[-w, 0.7], [w, 0.7], [w - 0.03, 0.645], [-w + 0.03, 0.645]]), 0.05 * u, 'energy', 'ZY', { p: [0.43 * u, 0, 0] }, 0);
  } else {
    const eye: P2[] = [[0.05, 0.645], [0.3, 0.735], [0.3, 0.68], [0.08, 0.605]];
    k.extrude(S(eye), 0.05 * u, 'energy', 'ZY', { p: [0.43 * u, 0, 0] }, 0);
    k.extrude(S(mirrorX(eye)), 0.05 * u, 'energy', 'ZY', { p: [0.43 * u, 0, 0] }, 0);
  }

  // Brow (V, overhanging the eyes)
  const brow: P2[] =
    style === 'monolith'
      ? [[-0.44, 0.92], [0.44, 0.92], [0.44, 0.74], [-0.44, 0.74]]
      : [[-0.42, 0.92], [0.42, 0.92], [0.38, 0.77], [0.05, 0.67], [-0.05, 0.67], [-0.38, 0.77]];
  k.extrude(S(brow), 0.2 * u, 'paint', 'ZY', { p: [0.36 * u, 0, 0] }, 0.02 * u);

  // Helmet dome (side profile extruded across)
  const dome: P2[] =
    style === 'monolith'
      ? [[0.46, 0.92], [0.3, 1.06], [-0.34, 1.06], [-0.48, 0.9], [-0.5, 0.22], [-0.3, 0.16], [-0.26, 0.86]]
      : [[0.46, 0.9], [0.26, 1.07], [-0.2, 1.12], [-0.48, 0.96], [-0.52, 0.3], [-0.3, 0.2], [-0.26, 0.85]];
  k.extrude(S(dome), (style === 'bastion' ? 0.94 : 0.86) * u, 'paint', 'XY', undefined, 0.03 * u);

  // Cheek guards
  const cheek: P2[] = [[0.42, 0.62], [0.22, 0.84], [-0.3, 0.84], [-0.42, 0.3], [0.08, 0.02], [0.36, 0.22]];
  for (const sgn of [1, -1]) {
    k.extrude(S(cheek), 0.07 * u, style === 'monolith' ? 'inner' : 'paint', 'XY', { p: [0, 0, sgn * 0.43 * u] }, 0.012 * u);
    k.cylZ(0.07 * u, 0.1 * u, 'chrome', [-0.05 * u, 0.55 * u, sgn * 0.47 * u], 14);
  }

  // Style specifics
  if (style === 'swept') {
    const fin: P2[] = [[0.12, 0.78], [-0.08, 0.96], [-0.78, 1.28], [-0.42, 0.84]];
    for (const sgn of [1, -1]) {
      k.extrude(S(fin), 0.045 * u, 'paint', 'XY', { p: [0, 0, sgn * 0.47 * u], r: [0, -sgn * 0.18, 0] }, 0.008);
      k.extrude(S([[0.0, 0.84], [-0.5, 1.06], [-0.3, 0.86]]), 0.02 * u, 'energy', 'XY', { p: [0, 0, sgn * 0.5 * u], r: [0, -sgn * 0.18, 0] }, 0);
    }
  } else if (style === 'bastion') {
    k.box(0.9 * u, 0.1 * u, 0.12 * u, 'paint', { p: [-0.02 * u, 1.12 * u, 0] }, 0.02 * u);
    for (const sgn of [1, -1]) {
      k.box(0.16 * u, 0.3 * u, 0.12 * u, 'trim', { p: [0.1 * u, 0.62 * u, sgn * 0.53 * u] }, 0.02 * u);
      k.cyl(0.02 * u, 0.02 * u, 0.4 * u, 'chrome', { p: [-0.2 * u, 1.05 * u, sgn * 0.4 * u], r: [sgn * 0.3, 0, -0.3] }, 8);
    }
  } else if (style === 'crest') {
    k.extrude(S([[0.38, 0.95], [0.16, 1.52], [-0.4, 1.4], [-0.3, 1.0]]), 0.08 * u, 'paint', 'XY', undefined, 0.012);
    k.extrude(S([[0.3, 1.02], [0.14, 1.4], [0.02, 1.38], [0.12, 1.02]]), 0.09 * u, 'energy', 'XY', undefined, 0);
    for (const sgn of [1, -1]) {
      k.extrude(S([[0.2, 0.8], [0.34, 1.26], [0.0, 0.92]]), 0.04 * u, 'paint', 'XY', { p: [0, 0, sgn * 0.46 * u], r: [sgn * 0.35, 0, 0] }, 0.008);
    }
  } else {
    // monolith: chamfered crown and heavy jaw guard
    k.box(0.5 * u, 0.12 * u, 0.9 * u, 'trim', { p: [0.2 * u, 0.08 * u, 0] }, 0.02 * u);
    for (let i = -2; i <= 2; i++) k.box(0.06 * u, 0.2 * u, 0.04 * u, 'inner', { p: [0.46 * u, 0.12 * u, i * 0.11 * u] }, 0.005);
  }
  return k;
}

/* ------------------------------------------------------------------ */

export function shoulderJoint(D: RobotDims, sgn: number) {
  const k = new Kit();
  const s = D.s * D.limb;
  k.sphere(0.25 * s, 'inner', undefined, 20, 14);
  k.torus(0.24 * s, 0.035 * s, 'trim', { r: [0, 0, 0] }, 8, 24);
  k.extrude(plate(0.5 * s, 0.36 * s, 0.08 * s, 0.8), 0.36 * s, 'paint', 'XY', { p: [0, 0.14 * s, sgn * 0.06 * s] }, 0.03 * s);
  return k;
}

export function upperArmCore(D: RobotDims, sgn: number) {
  const k = new Kit();
  const s = D.s;
  const L = D.limb;
  const len = D.upperArmLen;
  k.cyl(0.15 * s * L, 0.13 * s * L, len * 0.85, 'inner', { p: [0, -len * 0.48, 0] }, 18);
  k.extrude(plate(0.36 * s * L, len * 0.52, 0.07 * s, 0.85), 0.3 * s * L, 'paint', 'XY', { p: [0.04 * s, -len * 0.42, sgn * 0.02 * s] }, 0.03 * s);
  k.rod([-0.15 * s * L, -0.12 * s, 0], [-0.12 * s * L, -len * 0.86, 0], 0.035 * s, 'chrome');
  k.cylZ(0.17 * s * L, 0.32 * s * L, 'inner', [0, -len, 0], 20);
  k.cylZ(0.09 * s * L, 0.34 * s * L, 'chrome', [0, -len, 0], 14);
  return k;
}

export function forearmCore(D: RobotDims, sgn: number) {
  const k = new Kit();
  const s = D.s;
  const L = D.limb;
  const len = D.forearmLen;
  k.cyl(0.25 * s * L, 0.2 * s * L, len * 0.86, 'inner', { p: [0, -len * 0.5, 0], r: [0, Math.PI / 4, 0] }, 4);
  k.extrude(plate(0.36 * s * L, len * 0.72, 0.06 * s, 1), 0.08 * s * L, 'paint', 'ZY', { p: [0.19 * s * L, -len * 0.46, 0], r: [0, 0, 0] }, 0.015);
  k.box(0.03 * s, len * 0.5, 0.04 * s, 'energy', { p: [0.05 * s, -len * 0.5, -sgn * 0.19 * s * L] }, 0.01);
  k.torus(0.2 * s * L, 0.03 * s, 'trim', { p: [0, -len * 0.93, 0], r: [Math.PI / 2, 0, 0] }, 6, 4);
  return k;
}

export function hand(D: RobotDims, sgn: number) {
  const k = new Kit();
  const s = D.s * D.limb;
  k.box(0.24 * s, 0.24 * s, 0.24 * s, 'inner', { p: [0, -0.13 * s, 0] }, 0.03 * s);
  for (let i = 0; i < 4; i++) {
    const z = (-0.09 + i * 0.06) * s;
    k.box(0.1 * s, 0.1 * s, 0.05 * s, 'dark', { p: [0.1 * s, -0.27 * s, z], r: [0, 0, 0.5] }, 0.012 * s);
    k.box(0.08 * s, 0.07 * s, 0.05 * s, 'dark', { p: [0.14 * s, -0.19 * s, z], r: [0, 0, -0.3] }, 0.012 * s);
  }
  k.box(0.07 * s, 0.1 * s, 0.26 * s, 'paint', { p: [0.15 * s, -0.12 * s, 0] }, 0.015 * s);
  k.box(0.08 * s, 0.16 * s, 0.07 * s, 'dark', { p: [0.08 * s, -0.16 * s, -sgn * 0.14 * s], r: [sgn * 0.3, 0, 0.2] }, 0.015 * s);
  return k;
}

export function thighCore(D: RobotDims, sgn: number) {
  const k = new Kit();
  const s = D.s;
  const L = D.limb;
  const len = D.thighLen;
  k.cyl(0.32 * s * L, 0.26 * s * L, len * 0.82, 'inner', { p: [0, -len * 0.5, 0], r: [0, Math.PI / 4, 0] }, 4);
  k.extrude(plate(0.36 * s * L, len * 0.62, 0.07 * s, 1), 0.1 * s * L, 'paint', 'ZY', { p: [0.23 * s * L, -len * 0.42, 0], r: [0, 0, -0.06] }, 0.02);
  for (const zz of [1, -1]) {
    k.rod([0, -0.15 * s, zz * 0.24 * s * L], [0.02, -len * 0.88, zz * 0.21 * s * L], 0.035 * s, 'chrome');
  }
  k.cylZ(0.21 * s * L, 0.44 * s * L, 'inner', [0, -len, 0], 20);
  k.cylZ(0.1 * s * L, 0.46 * s * L, 'chrome', [0, -len, 0], 14);
  return k;
}

export function shinCore(D: RobotDims, sgn: number) {
  const k = new Kit();
  const s = D.s;
  const L = D.limb;
  const len = D.shinLen;
  const knee: P2[] = [[0.02, 0.16], [0.3, 0.06], [0.38, -0.12], [0.2, -0.34], [0.0, -0.26]];
  k.extrude(knee.map(([a, b]) => [a * s * L, b * s * L] as P2), 0.32 * s * L, 'paint', 'XY', { p: [0.08 * s, 0, 0] }, 0.02);
  k.cyl(0.27 * s * L, 0.21 * s * L, len * 0.86, 'inner', { p: [0, -len * 0.52, 0], r: [0, Math.PI / 4, 0] }, 4);
  for (const zz of [1, -1]) {
    k.rod([-0.2 * s * L, -0.2 * s, zz * 0.09 * s], [-0.16 * s * L, -len * 0.82, zz * 0.08 * s], 0.045 * s, 'chrome');
  }
  k.box(0.03 * s, len * 0.34, 0.035 * s, 'energy', { p: [0.2 * s * L, -len * 0.62, 0] }, 0.01);
  k.cylZ(0.17 * s * L, 0.36 * s * L, 'inner', [0, -len, 0], 18);
  return k;
}

export function footCore(D: RobotDims, sgn: number) {
  const k = new Kit();
  const s = D.s;
  const L = D.limb;
  const fh = D.footH;
  k.box(0.98 * s, 0.12 * s, 0.46 * s * L, 'trim', { p: [0.16 * s, -fh + 0.06 * s, 0] }, 0.03);
  k.box(0.32 * s, 0.26 * s, 0.38 * s * L, 'inner', { p: [-0.18 * s, -fh + 0.2 * s, 0] }, 0.04);
  for (const z of [-0.15, 0, 0.15]) {
    k.extrude([[0, 0], [0.26 * s, 0], [0, 0.11 * s]], 0.1 * s * L, 'inner', 'XY', { p: [0.62 * s, -fh + 0.01, z * s * L] }, 0.008);
  }
  k.box(0.3 * s, 0.22 * s, 0.34 * s * L, 'paint', { p: [0.05 * s, -fh + 0.28 * s, 0], r: [0, 0, 0.3] }, 0.03);
  return k;
}

/* ------------------------------------------------------------------ */

/** Weapon built in forearm space (arm runs along -Y). */
export function weapon(D: RobotDims, kind: Loadout, insignia: Insignia) {
  const k = new Kit();
  const s = D.s;
  const L = D.limb;
  const len = D.forearmLen;
  if (kind === 'cannon') {
    const z = 0.3 * s * L;
    k.box(0.34 * s, len * 0.8, 0.32 * s, 'inner', { p: [0.02, -len * 0.55, z] }, 0.04);
    k.extrude(plate(0.3 * s, len * 0.7, 0.05 * s, 1), 0.06 * s, 'paint', 'ZY', { p: [0.2 * s, -len * 0.55, z] }, 0.012);
    k.cyl(0.1 * s, 0.11 * s, 1.05 * s, 'chrome', { p: [0.02, -len - 0.35 * s, z] }, 20);
    k.cyl(0.075 * s, 0.075 * s, 1.07 * s, 'dark', { p: [0.02, -len - 0.35 * s, z] }, 20);
    for (let i = 0; i < 4; i++) k.torus(0.12 * s, 0.022 * s, 'trim', { p: [0.02, -len - (0.05 + i * 0.16) * s, z], r: [Math.PI / 2, 0, 0] }, 6, 20);
    k.torus(0.1 * s, 0.025 * s, 'energy', { p: [0.02, -len - 0.88 * s, z], r: [Math.PI / 2, 0, 0] }, 8, 24);
    k.cyl(0.06 * s, 0.06 * s, 0.05 * s, 'energy', { p: [0.02, -len - 0.8 * s, z] }, 16);
    for (const zz of [1, -1]) k.box(0.3 * s, 0.5 * s, 0.03 * s, 'dark', { p: [-0.1 * s, -len * 0.6, z + zz * 0.18 * s] }, 0.006);
  } else if (kind === 'blade') {
    const z = 0.26 * s * L;
    const blade: P2[] = [[0.02, 0.1], [0.16, 0.0], [0.13, -1.5], [0.0, -2.0], [-0.06, -1.5], [-0.06, 0.0]];
    const edge: P2[] = [[0.16, 0.0], [0.19, 0.0], [0.16, -1.52], [0.02, -2.06], [0.0, -2.0], [0.13, -1.5]];
    const S = (p: P2[]) => p.map(([a, b]) => [a * s, b * s] as P2);
    k.extrude(S(blade), 0.05 * s, 'chrome', 'XY', { p: [0.08 * s, -len * 0.45, z] }, 0.012);
    k.extrude(S(edge), 0.018 * s, 'energy', 'XY', { p: [0.08 * s, -len * 0.45, z] }, 0);
    k.box(0.3 * s, 0.5 * s, 0.12 * s, 'inner', { p: [0.04 * s, -len * 0.4, z - 0.02 * s] }, 0.03);
    k.box(0.08 * s, 0.4 * s, 0.14 * s, 'paint', { p: [0.2 * s, -len * 0.38, z] }, 0.02);
  } else {
    const z = -0.34 * s * L;
    const shield: P2[] = [[0, 0.62], [0.46, 0.4], [0.5, -0.55], [0, -1.12], [-0.5, -0.55], [-0.46, 0.4]];
    const S = (p: P2[], f = 1) => p.map(([a, b]) => [a * s * f * 1.15, b * s * f * 1.15] as P2);
    k.extrude(S(shield), 0.1 * s, 'paint', 'XY', { p: [0.05 * s, -len * 0.35, z] }, 0.025);
    k.extrude(S(shield, 1.06), 0.06 * s, 'trim', 'XY', { p: [0.05 * s, -len * 0.35 + 0.02, z + 0.04 * s] }, 0.01);
    k.box(0.04 * s, 1.2 * s, 0.02 * s, 'energy', { p: [0.05 * s, -len * 0.5, z - 0.06 * s] }, 0.005);
    const em = insigniaKit(insignia === 'none' ? 'vanguard' : insignia, 0.42 * s, 'chrome');
    k.merge(em, { p: [0.05 * s, -len * 0.18, z - 0.07 * s], r: [0, Math.PI, 0] });
    k.box(0.3 * s, 0.4 * s, 0.14 * s, 'inner', { p: [0.02, -len * 0.45, z + 0.12 * s] }, 0.03);
  }
  return k;
}
