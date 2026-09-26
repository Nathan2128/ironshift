import { Kit } from '../core/kit';

export type Insignia = 'vanguard' | 'reaver' | 'none';

type Poly = [number, number][];

const mirrorPoly = (p: Poly): Poly => p.map(([x, y]) => [-x, y] as [number, number]).reverse();

const vanguardEye: Poly = [[0.07, 0.13], [0.31, 0.22], [0.29, 0.08], [0.09, 0.03]];
const reaverEye: Poly = [[0.06, 0.05], [0.27, 0.17], [0.22, 0.0]];

export const INSIGNIA: Record<Exclude<Insignia, 'none'>, { label: string; outline: Poly; holes: Poly[] }> = {
  vanguard: {
    label: 'Vanguard',
    outline: [
      [0, 0.55], [0.3, 0.44], [0.47, 0.52], [0.43, 0.04], [0.28, -0.3], [0, -0.56],
      [-0.28, -0.3], [-0.43, 0.04], [-0.47, 0.52], [-0.3, 0.44],
    ],
    holes: [
      vanguardEye,
      mirrorPoly(vanguardEye),
      [[0, -0.06], [0.15, -0.22], [0.09, -0.31], [0, -0.21], [-0.09, -0.31], [-0.15, -0.22]],
    ],
  },
  reaver: {
    label: 'Reaver',
    outline: [
      [0, -0.56], [0.19, -0.3], [0.31, -0.04], [0.52, 0.56], [0.27, 0.31], [0.12, 0.33], [0, 0.22],
      [-0.12, 0.33], [-0.27, 0.31], [-0.52, 0.56], [-0.31, -0.04], [-0.19, -0.3],
    ],
    holes: [reaverEye, mirrorPoly(reaverEye), [[0, -0.12], [0.07, -0.34], [-0.07, -0.34]]],
  },
};

/** Insignia facing +Z, centred at origin, `size` tall. Chrome body with an energy inlay behind the cut-outs. */
export function insigniaKit(kind: Insignia, size: number, body: 'chrome' | 'paint' | 'trim' = 'chrome'): Kit {
  const k = new Kit();
  if (kind === 'none') return k;
  const def = INSIGNIA[kind];
  const sc = (p: Poly) => p.map(([x, y]) => [x * size, y * size] as [number, number]);
  const depth = size * 0.09;
  k.extrude(sc(def.outline), depth, body, 'XY', undefined, depth * 0.3, def.holes.map(sc));
  const inlay = def.outline.map(([x, y]) => [x * size * 0.92, y * size * 0.92] as [number, number]);
  k.extrude(inlay, depth * 0.3, 'energy', 'XY', { p: [0, 0, -depth * 0.3] }, 0);
  return k;
}

/** SVG path for UI thumbnails (unit box -0.6..0.6). */
export function insigniaSvgPath(kind: Exclude<Insignia, 'none'>) {
  const def = INSIGNIA[kind];
  const path = (p: Poly) => 'M' + p.map(([x, y]) => `${x.toFixed(3)} ${(-y).toFixed(3)}`).join(' L') + ' Z';
  return [path(def.outline), ...def.holes.map(path)].join(' ');
}
