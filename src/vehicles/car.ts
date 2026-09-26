import * as THREE from 'three';
import { Kit } from '../core/kit';
import type { MatLib } from '../core/materials';
import { BodyShape, RANGES, buildPanel, type PanelOpts } from './body';
import { insigniaKit, type Insignia } from './insignia';
import { beamOrigins, emblemPlacement } from './specs';
import type { DetailCtx, PanelId, VehicleSpec } from './types';
import { buildWheel } from './wheel';

export type WheelId = 'wheelFR' | 'wheelFL' | 'wheelRR' | 'wheelRL';
export type CarPartId = PanelId | WheelId;

export interface CarPart {
  id: CarPartId;
  group: THREE.Group;
  /** Centre of the part in car coordinates. */
  center: THREE.Vector3;
  size: THREE.Vector3;
  spinner?: THREE.Object3D;
  spinSign?: number;
  wheelR?: number;
}

export interface CarBuild {
  spec: VehicleSpec;
  body: BodyShape;
  parts: CarPart[];
  beams: THREE.Vector3[];
}

export function panelDefs(spec: VehicleSpec): [PanelId, PanelOpts][] {
  const s = spec.st;
  const L = spec.L;
  const defs: [PanelId, PanelOpts][] = [
    ['nose', { d0: 0, d1: s.noseEnd, kind: 'solid' }],
    ['hoodR', { d0: s.noseEnd, d1: s.ws0, kind: 'shell', range: RANGES.topR }],
    ['hoodL', { d0: s.noseEnd, d1: s.ws0, kind: 'shell', range: RANGES.topL }],
    ['fenderR', { d0: s.noseEnd, d1: s.door0, kind: 'shell', range: RANGES.sideR }],
    ['fenderL', { d0: s.noseEnd, d1: s.door0, kind: 'shell', range: RANGES.sideL }],
    ['door1R', { d0: s.door0, d1: s.doorMid, kind: 'shell', range: RANGES.sideR }],
    ['door1L', { d0: s.door0, d1: s.doorMid, kind: 'shell', range: RANGES.sideL }],
    ['door2R', { d0: s.doorMid, d1: s.door1, kind: 'shell', range: RANGES.sideR }],
    ['door2L', { d0: s.doorMid, d1: s.door1, kind: 'shell', range: RANGES.sideL }],
    ['quarterR', { d0: s.door1, d1: s.tailStart, kind: 'shell', range: RANGES.sideR }],
    ['quarterL', { d0: s.door1, d1: s.tailStart, kind: 'shell', range: RANGES.sideL }],
    ['windshield', { d0: s.ws0, d1: s.ws1, kind: 'shell', range: RANGES.top }],
    ['roof', { d0: s.ws1, d1: s.rg0, kind: 'shell', range: RANGES.top }],
    ['rearGlass', { d0: s.rg0, d1: Math.min(s.rg1, s.tailStart), kind: 'shell', range: RANGES.top }],
    ['tailR', { d0: s.tailStart, d1: L, kind: 'halfR' }],
    ['tailL', { d0: s.tailStart, d1: L, kind: 'halfL' }],
    ['floor', { d0: s.noseEnd, d1: s.tailStart, kind: 'shell', range: RANGES.bottom, thick: 0.04 }],
  ];
  if (s.tailStart - s.rg1 > 0.06) defs.push(['deck', { d0: s.rg1, d1: s.tailStart, kind: 'shell', range: RANGES.top }]);
  return defs.filter(([, o]) => o.d1 - o.d0 > 0.04);
}

export function buildCar(spec: VehicleSpec, mats: MatLib, insignia: Insignia): CarBuild {
  const body = new BodyShape(spec);
  const kits = new Map<PanelId, Kit>();
  const ctx: DetailCtx = {
    body,
    spec,
    x: (d) => body.x(d),
    kit: (id) => {
      if (!kits.has(id)) kits.set(id, new Kit());
      return kits.get(id)!;
    },
  };
  spec.details(ctx);

  // Insignia on the nose
  const em = emblemPlacement(ctx);
  if (insignia !== 'none') {
    const up = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(up, em.n).normalize();
    const yAxis = new THREE.Vector3().crossVectors(em.n, xAxis);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, em.n));
    ctx.kit('nose').merge(insigniaKit(insignia, em.size), { p: em.p.toArray() as [number, number, number], q });
  }

  // Wheel-well blackout lives on the floor pan
  const floorKit = ctx.kit('floor');
  for (const w of [spec.front, spec.rear]) {
    const hw = body.hw(w.d);
    const ra = w.r + spec.archGap;
    floorKit.box(ra * 1.9, ra * 1.2, (hw - w.width - 0.05) * 2, 'dark', { p: [body.x(w.d), w.r + ra * 0.35, 0] }, 0.02);
  }

  const parts: CarPart[] = [];
  for (const [id, opts] of panelDefs(spec)) {
    const { geo, center, size } = buildPanel(body, opts);
    const group = new THREE.Group();
    group.name = id;
    const mesh = new THREE.Mesh(geo, mats.bodyArray);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const kit = kits.get(id);
    if (kit && !kit.isEmpty()) {
      kit.translate(-center.x, -center.y, -center.z);
      group.add(kit.build(mats, `${id}-details`));
    }
    parts.push({ id, group, center, size });
  }

  const wheels: [WheelId, typeof spec.front, number][] = [
    ['wheelFR', spec.front, 1],
    ['wheelFL', spec.front, -1],
    ['wheelRR', spec.rear, 1],
    ['wheelRL', spec.rear, -1],
  ];
  for (const [id, w, sgn] of wheels) {
    const { group: wheel, spinner } = buildWheel(w, spec.wheelStyle, mats);
    const group = new THREE.Group();
    group.name = id;
    if (sgn < 0) wheel.rotation.y = Math.PI;
    group.add(wheel);
    const z = (body.hw(w.d) - w.width / 2 - 0.015) * sgn;
    const center = new THREE.Vector3(body.x(w.d), w.r, z);
    parts.push({
      id,
      group,
      center,
      size: new THREE.Vector3(w.r * 2, w.r * 2, w.width),
      spinner,
      spinSign: sgn > 0 ? -1 : 1,
      wheelR: w.r,
    });
  }

  const beams = beamOrigins(spec).map((p) => new THREE.Vector3(...p));
  return { spec, body, parts, beams };
}
