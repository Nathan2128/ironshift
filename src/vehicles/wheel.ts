import * as THREE from 'three';
import { Kit } from '../core/kit';
import type { MatLib } from '../core/materials';
import type { WheelSpec, WheelStyle } from './types';

/** Tyre cross-section revolved around the axle. */
function tyreGeometry(R: number, rimR: number, width: number) {
  const hw = width / 2;
  const sh = Math.min(0.045, (R - rimR) * 0.45);
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(rimR * 0.98, -hw * 0.9));
  pts.push(new THREE.Vector2(rimR + (R - rimR) * 0.35, -hw * 1.02));
  pts.push(new THREE.Vector2(R - sh, -hw));
  for (let i = 1; i <= 5; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / 5);
    pts.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh));
  }
  for (let i = 0; i <= 5; i++) {
    const a = (Math.PI / 2) * (i / 5);
    pts.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh));
  }
  pts.push(new THREE.Vector2(rimR + (R - rimR) * 0.35, hw * 1.02));
  pts.push(new THREE.Vector2(rimR * 0.98, hw * 0.9));
  const g = new THREE.LatheGeometry(pts, 64);
  g.rotateX(Math.PI / 2); // axle along Z, sidewall facing +Z
  return g;
}

export interface WheelParts {
  group: THREE.Group;
  spinner: THREE.Group;
}

/**
 * Builds a wheel facing +Z (outer face). Left-side wheels are rotated 180° by the caller.
 * The spinner rotates about Z for rolling; the caliper stays fixed.
 */
export function buildWheel(spec: WheelSpec, style: WheelStyle, mats: MatLib): WheelParts {
  const R = spec.r;
  const W = spec.width;
  const rimR = R * (style === 'aero' ? 0.62 : style === 'twin5' ? 0.76 : style === 'amg' ? 0.74 : 0.7);
  const face = W / 2 - 0.03;

  const spin = new Kit();
  spin.add(tyreGeometry(R, rimR, W), 'rubber');
  // Barrel and inner darkness
  spin.cyl(rimR, rimR, W * 0.92, 'wheelDark', { r: [Math.PI / 2, 0, 0] }, 40, true);
  spin.cyl(rimR * 0.98, rimR * 0.98, 0.01, 'dark', { p: [0, 0, -W * 0.3], r: [Math.PI / 2, 0, 0] }, 40);
  // Brake disc
  spin.cyl(rimR * 0.82, rimR * 0.82, 0.03, 'inner', { p: [0, 0, face - 0.12], r: [Math.PI / 2, 0, 0] }, 40);
  // Lip
  spin.torus(rimR * 0.985, 0.012, style === 'aero' ? 'wheelDark' : 'alloy', { p: [0, 0, face] }, 8, 64);

  const hub = rimR * 0.2;
  if (style === 'aero') {
    // Flat aero cover with angular slots
    spin.cyl(rimR * 0.97, rimR * 0.97, 0.03, 'wheelDark', { p: [0, 0, face - 0.01], r: [Math.PI / 2, 0, 0] }, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const rr = rimR * 0.62;
      spin.box(rimR * 0.34, 0.06, 0.02, 'dark', { p: [Math.cos(a) * rr, Math.sin(a) * rr, face + 0.008], r: [0, 0, a + 0.5] }, 0.005);
    }
    spin.cyl(hub, hub, 0.04, 'alloy', { p: [0, 0, face + 0.01], r: [Math.PI / 2, 0, 0] }, 6);
  } else {
    const spokes = style === 'multi' ? 10 : 5;
    const pair = style === 'twin5' || style === 'amg';
    const spokeMat = 'alloy';
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const subs = pair ? [-0.09, 0.09] : [0];
      for (const sa of subs) {
        const aa = a + sa;
        const len = rimR - hub * 0.9;
        const mid = hub * 0.9 + len / 2;
        const w = style === 'multi' ? 0.034 : pair ? 0.04 : 0.07;
        spin.box(len, w, 0.05, spokeMat, {
          p: [Math.cos(aa) * mid, Math.sin(aa) * mid, face - 0.015 - (sa !== 0 ? 0.004 : 0)],
          r: [0, 0, aa],
        }, 0.012);
      }
      if (style === 'amg') {
        // dark pockets between spoke pairs
        const pa = a + Math.PI / spokes;
        spin.box(rimR * 0.5, 0.05, 0.01, 'wheelDark', {
          p: [Math.cos(pa) * rimR * 0.62, Math.sin(pa) * rimR * 0.62, face - 0.05],
          r: [0, 0, pa],
        }, 0.004);
      }
    }
    spin.cyl(hub, hub * 1.1, 0.06, 'alloy', { p: [0, 0, face - 0.01], r: [Math.PI / 2, 0, 0] }, 24);
    spin.cyl(hub * 0.55, hub * 0.55, 0.02, 'dark', { p: [0, 0, face + 0.02], r: [Math.PI / 2, 0, 0] }, 24);
    // lug nuts
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      spin.cyl(0.011, 0.011, 0.02, 'chrome', { p: [Math.cos(a) * hub * 0.7, Math.sin(a) * hub * 0.7, face + 0.02], r: [Math.PI / 2, 0, 0] }, 6);
    }
  }

  const spinner = spin.build(mats, 'spinner');
  const fixed = new Kit();
  // Caliper, sits behind the spokes toward the rear-top of the disc
  const cr = rimR * 0.72;
  fixed.box(0.09, rimR * 0.62, 0.07, 'caliper', { p: [-cr * 0.55, cr * 0.72, face - 0.1], r: [0, 0, 0.62] }, 0.02);

  const group = new THREE.Group();
  group.add(spinner);
  group.add(fixed.build(mats, 'caliper'));
  return { group, spinner };
}
