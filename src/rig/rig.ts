import * as THREE from 'three';
import type { Kit, V3 } from '../core/kit';
import { clamp, ease, smoothstep, type Ease } from '../core/math';
import type { MatLib } from '../core/materials';
import { CLASSES, type Loadout, type RobotClass, type RobotDims } from '../robot/classes';
import * as endo from '../robot/endo';
import { buildCar, type CarPart, type CarPartId } from '../vehicles/car';
import type { Insignia } from '../vehicles/insignia';
import { VEHICLES } from '../vehicles/specs';
import type { VehicleId, VehicleSpec } from '../vehicles/types';
import { skeleton, type BoneId } from './skeleton';

export interface RigConfig {
  vehicle: VehicleId;
  loadout: Loadout;
  insignia: Insignia;
}

/** Total sequence length at standard speed (seconds). */
export const SEQ_T = 3.7;
export const IGNITE_T = 2.9;
export const IMPACT_T = 3.08;

interface TRS {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: THREE.Vector3;
}

const trs = (p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: number | V3 = 1): TRS => ({
  p: new THREE.Vector3(...p),
  q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
  s: typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s),
});

const fromMatrix = (m: THREE.Matrix4): TRS => {
  const t = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
  m.decompose(t.p, t.q, t.s);
  return t;
};

const toMatrix = (t: TRS) => new THREE.Matrix4().compose(t.p, t.q, t.s);

export class RigNode {
  t = 0;
  u = 0;
  arc: THREE.Vector3 | null = null;
  hideAtCar = false;
  hideAtRobot = false;
  spinAxis: THREE.Vector3 | null = null;
  spinTurns = 0;

  constructor(
    readonly id: string,
    readonly obj: THREE.Object3D,
    public a: TRS,
    public b: TRS,
    public start: number,
    public end: number,
    public easeFn: Ease = ease.inOutCubic,
  ) {}

  apply(tau: number) {
    const u = clamp((tau - this.start) / (this.end - this.start));
    const t = this.easeFn(u);
    this.u = u;
    this.t = t;
    const o = this.obj;
    o.position.lerpVectors(this.a.p, this.b.p, t);
    if (this.arc) o.position.addScaledVector(this.arc, 4 * u * (1 - u));
    o.quaternion.slerpQuaternions(this.a.q, this.b.q, t);
    if (this.spinAxis && this.spinTurns) {
      _q.setFromAxisAngle(this.spinAxis, Math.PI * 2 * this.spinTurns * ease.inOutCubic(u));
      o.quaternion.multiply(_q);
    }
    o.scale.lerpVectors(this.a.s, this.b.s, t);
    o.visible = !(this.hideAtCar && u <= 0) && !(this.hideAtRobot && u >= 1);
  }
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

interface PanelTarget {
  bone: BoneId;
  p: V3;
  r: V3;
  s: number | V3;
  win: [number, number];
  arc?: V3;
  spin?: { axis: V3; turns: number };
  follow?: CarPartId;
  hideAtRobot?: boolean;
  easeFn?: Ease;
}

/** Where every car panel ends up on the robot. */
function panelTarget(part: CarPart, D: RobotDims, cls: RobotClass['id']): PanelTarget | null {
  const s = D.s;
  const L = D.limb;
  const sz = part.size;
  const id = part.id;
  const side = id.endsWith('R') ? 1 : id.endsWith('L') ? -1 : 0;
  const sgn = side || 1;
  const cl = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const pre = id.replace(/[RL]$/, '');

  // Juggernaut wears its huge wedge windshield as a glass breastplate, the nose becomes a collar
  if (cls === 'juggernaut') {
    if (pre === 'windshield') {
      const sc = cl((D.chestW * 0.86) / sz.z, 0.5, 1.2);
      return {
        bone: 'chest',
        p: [D.chestD * 0.56, D.chestH * 0.46, 0],
        r: [0, 0, -Math.PI / 2 + 0.22],
        s: sc,
        win: [1.0, 2.35],
        arc: [1.4 * s, 0.6 * s, 0],
        easeFn: ease.mech,
      };
    }
    if (pre === 'nose') {
      const sc = cl((D.chestW * 1.02) / sz.z, 0.6, 1.1);
      return {
        bone: 'chest',
        p: [D.chestD * 0.42, D.chestH * 0.98, 0],
        r: [0, 0, 0.12],
        s: sc,
        win: [1.05, 2.4],
        arc: [1.2 * s, 0.8 * s, 0],
        easeFn: ease.mech,
      };
    }
  }

  switch (pre) {
    case 'nose': {
      const sc = cl((D.chestW * 1.08) / sz.z, 0.6, 1.1);
      return {
        bone: 'chest',
        p: [D.chestD * 0.4 + sz.x * sc * 0.3, D.chestH * 0.56, 0],
        r: [0, 0, 0.1],
        s: sc,
        win: [1.05, 2.4],
        arc: [1.2 * s, 0.6 * s, 0],
        easeFn: ease.mech,
      };
    }
    case 'hood': {
      const sc = cl((D.chestH * 0.72) / sz.x, 0.45, 1.15);
      return {
        bone: 'chest',
        p: [D.chestD * 0.47, D.chestH * 0.18, sgn * sz.z * sc * 0.46],
        r: [0, -0.32 * sgn, -Math.PI / 2],
        s: sc,
        win: [1.25, 2.5],
        arc: [0.6 * s, 0.3 * s, sgn * 1.1 * s],
        easeFn: ease.mech,
      };
    }
    case 'fender': {
      const sc = cl((1.02 * s * L * 0.95) / sz.x, 0.7, 1.3);
      return {
        bone: `shoulder${side > 0 ? 'R' : 'L'}` as BoneId,
        p: [0, 0.1 * s, sgn * 0.3 * s * L],
        r: [-sgn * 0.2, 0, 0.42],
        s: sc,
        win: [1.15, 2.45],
        arc: [0, 0.4 * s, sgn * 0.7 * s],
        easeFn: ease.mech,
      };
    }
    case 'wheelF':
      return { bone: `shoulder${side > 0 ? 'R' : 'L'}` as BoneId, p: [0, 0, 0], r: [0, 0, 0], s: 1, win: [1.15, 2.45], follow: `fender${side > 0 ? 'R' : 'L'}` as CarPartId, easeFn: ease.mech };
    case 'door1': {
      const sc = cl((1.45 * s) / sz.x, 0.7, 1.35);
      return {
        bone: 'chest',
        p: [-D.chestD * 0.62, D.chestH * 0.92, sgn * D.chestW * 0.36],
        r: [0, -sgn * 1.2, 1.3],
        s: sc,
        win: [0.95, 2.3],
        arc: [-0.8 * s, 0.4 * s, sgn * 1.0 * s],
        easeFn: ease.mech,
      };
    }
    case 'door2':
      return {
        bone: `forearm${side > 0 ? 'R' : 'L'}` as BoneId,
        p: [0.02 * s, -D.forearmLen * 0.5, sgn * 0.22 * s * L],
        r: [0, 0, -Math.PI / 2],
        s: [(D.forearmLen * 0.82) / sz.x, (0.52 * s * L) / sz.y, 1],
        win: [1.25, 2.45],
        arc: [0.3 * s, 0, sgn * 0.6 * s],
        easeFn: ease.mech,
      };
    case 'quarter': {
      const sc = cl((D.shinLen * 0.9) / sz.x, 0.55, 1.15);
      return {
        bone: `shin${side > 0 ? 'R' : 'L'}` as BoneId,
        p: [0.02 * s, -D.shinLen * 0.48, sgn * 0.25 * s * L],
        r: [0, 0, -Math.PI / 2],
        s: sc,
        win: [0.5, 1.9],
        arc: [0, 0, sgn * 0.6 * s],
        easeFn: ease.mech,
      };
    }
    case 'wheelR':
      return { bone: `shin${side > 0 ? 'R' : 'L'}` as BoneId, p: [0, 0, 0], r: [0, 0, 0], s: 1, win: [0.5, 1.9], follow: `quarter${side > 0 ? 'R' : 'L'}` as CarPartId, easeFn: ease.mech };
    case 'tail':
      return {
        bone: `foot${side > 0 ? 'R' : 'L'}` as BoneId,
        p: [0.3 * s, -D.footH + 0.12 * s + 0.2 * s * L, 0],
        r: [0, sgn * Math.PI / 2, 0],
        s: [(0.46 * s * L) / sz.x, (0.36 * s * L) / sz.y, (0.92 * s) / sz.z],
        win: [0.45, 1.75],
        arc: [0.2 * s, 0.2 * s, sgn * 0.3 * s],
        easeFn: ease.mech,
      };
    case 'deck':
      return {
        bone: 'pelvis',
        p: [0.4 * s * L, -0.2 * s, 0],
        r: [0, 0, -Math.PI / 2],
        s: [(0.62 * s) / sz.x, 1, (0.78 * s) / sz.z],
        win: [0.6, 1.85],
        arc: [0.5 * s, 0, 0],
      };
    case 'windshield': {
      const sc = cl((D.chestW * 0.74) / sz.z, 0.45, 1.1);
      return {
        bone: 'chest',
        p: [-D.chestD * 0.54, D.chestH * 0.5, 0],
        r: [0, 0, Math.PI / 2 - 0.12],
        s: sc,
        win: [0.85, 2.1],
        arc: [-0.6 * s, 0.4 * s, 0],
      };
    }
    case 'roof':
      return {
        bone: 'spine',
        p: [-D.chestD * 0.45, D.abdomenLen * 0.45, 0],
        r: [0, 0, Math.PI / 2],
        s: [(0.7 * s) / sz.x, 1, (D.chestW * 0.62) / sz.z],
        win: [0.75, 2.0],
        arc: [-0.5 * s, 0, 0],
      };
    case 'rearGlass': {
      const sc = cl((D.chestW * 0.5) / sz.z, 0.3, 0.9);
      return {
        bone: 'chest',
        p: [-D.chestD * 0.62, D.chestH * 0.98, 0],
        r: [0, 0, Math.PI / 2 + 0.25],
        s: sc,
        win: [0.55, 1.75],
      };
    }
    case 'floor':
      return {
        bone: 'pelvis',
        p: [-0.05 * s, 0.1 * s, 0],
        r: [0, 0, 0],
        s: 0.2,
        win: [0.3, 1.3],
        hideAtRobot: true,
      };
  }
  return null;
}

/** Internal mechanical parts: grow out of the joints as the robot unfolds. */
function endoParts(D: RobotDims, loadout: Loadout, insignia: Insignia): { id: string; bone: BoneId; kit: Kit; win: [number, number]; easeFn?: Ease }[] {
  const list: { id: string; bone: BoneId; kit: Kit; win: [number, number]; easeFn?: Ease }[] = [
    { id: 'pelvisCore', bone: 'pelvis', kit: endo.pelvisCore(D), win: [0.3, 1.25] },
    { id: 'abdomen', bone: 'spine', kit: endo.abdomen(D), win: [0.45, 1.5] },
    { id: 'chestCore', bone: 'chest', kit: endo.chestCore(D), win: [0.6, 1.7] },
    { id: 'neckCore', bone: 'neck', kit: endo.neckCore(D), win: [1.5, 2.3] },
    { id: 'head', bone: 'head', kit: endo.head(D), win: [1.95, 2.8], easeFn: ease.outBack },
  ];
  for (const [side, sgn] of [
    ['R', 1],
    ['L', -1],
  ] as const) {
    list.push(
      { id: `shoulderJoint${side}`, bone: `shoulder${side}`, kit: endo.shoulderJoint(D, sgn), win: [0.95, 1.9] },
      { id: `upperArmCore${side}`, bone: `upperArm${side}`, kit: endo.upperArmCore(D, sgn), win: [1.15, 2.1] },
      { id: `forearmCore${side}`, bone: `forearm${side}`, kit: endo.forearmCore(D, sgn), win: [1.35, 2.3] },
      { id: `hand${side}`, bone: `hand${side}`, kit: endo.hand(D, sgn), win: [1.8, 2.6] },
      { id: `thighCore${side}`, bone: `thigh${side}`, kit: endo.thighCore(D, sgn), win: [0.4, 1.4] },
      { id: `shinCore${side}`, bone: `shin${side}`, kit: endo.shinCore(D, sgn), win: [0.5, 1.5] },
      { id: `footCore${side}`, bone: `foot${side}`, kit: endo.footCore(D, sgn), win: [0.95, 1.8] },
    );
  }
  list.push({
    id: 'weapon',
    bone: loadout === 'shield' ? 'forearmL' : 'forearmR',
    kit: endo.weapon(D, loadout, insignia),
    win: [2.7, 3.3],
    easeFn: ease.outBack,
  });
  return list;
}

export interface SeqEvent {
  t: number;
  kind: 'start' | 'end';
  node: RigNode;
}

export class Rig {
  readonly root = new THREE.Group();
  readonly spec: VehicleSpec;
  readonly cls: RobotClass;
  readonly D: RobotDims;
  readonly nodes: RigNode[] = [];
  readonly bones = new Map<BoneId, RigNode>();
  readonly parts = new Map<string, RigNode>();
  readonly wheels: { node: RigNode; spinner: THREE.Object3D; sign: number; r: number }[] = [];
  readonly beams: THREE.SpotLight[] = [];
  readonly events: SeqEvent[] = [];
  /** Ids of nodes that are real car panels / wheels (used for audio + sparks). */
  readonly carIds = new Set<string>();
  height = 5.6;
  private lookYaw = 0;
  private lookPitch = 0;
  private drive = 0;

  constructor(readonly config: RigConfig, readonly mats: MatLib) {
    this.spec = VEHICLES[config.vehicle];
    this.cls = CLASSES[this.spec.robotClass];
    this.D = this.cls.dims;
    const D = this.D;
    const car = buildCar(this.spec, mats, config.insignia);
    const carDims = { L: this.spec.L, H: car.body.top(this.spec.L * 0.5), halfW: car.body.hw(this.spec.L * 0.5) };

    // Bones
    for (const def of skeleton(D, carDims)) {
      const obj = new THREE.Group();
      obj.name = def.id;
      const parent = def.parent ? this.bones.get(def.parent)!.obj : this.root;
      parent.add(obj);
      const node = new RigNode(def.id, obj, trs(def.a.p, def.a.r), trs(def.b.p, def.b.r), def.win[0], def.win[1], ease.inOutCubic);
      this.bones.set(def.id, node);
      this.nodes.push(node);
    }

    // Plant the feet: measure the standing pose and lift the pelvis so the soles touch y=0
    this.apply(100);
    this.root.updateMatrixWorld(true);
    const ankle = this.bones.get('footR')!.obj.getWorldPosition(new THREE.Vector3());
    this.bones.get('pelvis')!.b.p.y = D.footH - ankle.y;
    this.apply(100);
    this.root.updateMatrixWorld(true);
    const headTop = this.bones.get('head')!.obj.getWorldPosition(new THREE.Vector3());
    this.height = headTop.y + D.headSize * 1.1;

    // Car parts: pose A = exactly where they sit on the car, expressed in bone space at t=0
    this.apply(0);
    this.root.updateMatrixWorld(true);
    const byId = new Map(car.parts.map((p) => [p.id, p]));
    const carM = (p: CarPart) => new THREE.Matrix4().makeTranslation(p.center.x, p.center.y, p.center.z);
    const pending: [CarPart, PanelTarget][] = [];
    for (const part of car.parts) {
      const pid = part.id.startsWith('wheel') ? `wheel${part.id[5]}${part.id[6]}` : part.id;
      const tgt = panelTarget({ ...part, id: pid as CarPartId }, D, this.cls.id);
      if (!tgt) continue;
      pending.push([part, tgt]);
    }
    // followers last so their leader's B is known
    pending.sort((x, y) => (x[1].follow ? 1 : 0) - (y[1].follow ? 1 : 0));
    for (const [part, tgt] of pending) {
      const bone = this.bones.get(tgt.bone)!;
      bone.obj.add(part.group);
      const inv = bone.obj.matrixWorld.clone().invert();
      const a = fromMatrix(inv.multiply(carM(part)));
      let b: TRS;
      if (tgt.follow) {
        const leader = this.parts.get(tgt.follow)!;
        const lp = byId.get(tgt.follow)!;
        const rel = carM(lp).invert().multiply(carM(part));
        b = fromMatrix(toMatrix(leader.b).multiply(rel));
      } else {
        b = trs(tgt.p, tgt.r, tgt.s);
      }
      const node = new RigNode(part.id, part.group, a, b, tgt.win[0], tgt.win[1], tgt.easeFn ?? ease.inOutCubic);
      if (tgt.arc) node.arc = new THREE.Vector3(...tgt.arc);
      if (tgt.hideAtRobot) node.hideAtRobot = true;
      if (tgt.follow) node.arc = this.parts.get(tgt.follow)!.arc;
      this.parts.set(part.id, node);
      this.nodes.push(node);
      this.carIds.add(part.id);
      if (part.spinner) this.wheels.push({ node, spinner: part.spinner, sign: part.spinSign!, r: part.wheelR! });
    }

    // Endoskeleton
    for (const e of endoParts(D, config.loadout, config.insignia)) {
      const group = e.kit.build(mats, e.id);
      const bone = this.bones.get(e.bone)!;
      bone.obj.add(group);
      const node = new RigNode(e.id, group, trs([0, 0, 0], [0, 0, 0], 0.3), trs(), e.win[0], e.win[1], e.easeFn ?? ease.outCubic);
      node.hideAtCar = true;
      this.parts.set(e.id, node);
      this.nodes.push(node);
    }

    // Working headlights on the nose
    const nose = this.parts.get('nose');
    const noseCar = byId.get('nose');
    if (nose && noseCar) {
      for (const o of car.beams) {
        const light = new THREE.SpotLight(0xdfe8ff, 60, 26, 0.42, 0.55, 1.4);
        light.position.copy(o).sub(noseCar.center);
        light.target.position.copy(light.position).add(new THREE.Vector3(8, -0.8, Math.sign(o.z) * 0.6));
        nose.obj.add(light, light.target);
        this.beams.push(light);
      }
    }

    for (const n of this.nodes) {
      this.events.push({ t: n.start, kind: 'start', node: n }, { t: n.end, kind: 'end', node: n });
    }
    this.events.sort((a, b) => a.t - b.t);
    this.apply(0);
  }

  private apply(tau: number) {
    for (const n of this.nodes) n.apply(tau);
  }

  /** Rolls the car: x offset along its heading and cumulative wheel travel. */
  setDrive(x: number, travel: number) {
    this.root.position.x = x;
    this.drive = travel;
  }

  update(tau: number, time: number, look: THREE.Vector3 | null, dt: number) {
    this.apply(tau);
    const D = this.D;
    const s = D.s;

    for (const w of this.wheels) {
      w.spinner.rotation.z = w.sign * (this.drive / w.r + w.node.t * Math.PI * 3);
    }

    // Impact settle: knees absorb the final lock (the ground constraint lowers the body)
    const impact = smoothstep(IMPACT_T - 0.05, IMPACT_T + 0.1, tau) * (1 - smoothstep(IMPACT_T + 0.1, SEQ_T + 0.1, tau));
    const w = smoothstep(SEQ_T - 0.25, SEQ_T, tau);
    const breath = Math.sin(time * 1.5);
    const crouch = impact * 0.22 + w * (0.02 + Math.sin(time * 0.75) * 0.012);
    for (const side of ['R', 'L'] as const) {
      this.bones.get(`thigh${side}`)!.obj.rotateZ(crouch);
      this.bones.get(`shin${side}`)!.obj.rotateZ(-crouch * 2);
      this.bones.get(`foot${side}`)!.obj.rotateZ(crouch);
    }

    // Idle life once fully transformed
    if (w > 0) {
      const chest = this.bones.get('chest')!.obj;
      chest.rotateZ(breath * 0.012 * w);
      chest.position.y += breath * 0.01 * s * w;
      this.bones.get('pelvis')!.obj.rotateY(Math.sin(time * 0.33) * 0.025 * w);
      for (const [side, sgn] of [
        ['R', 1],
        ['L', -1],
      ] as const) {
        this.bones.get(`upperArm${side}`)!.obj.rotateZ(Math.sin(time * 1.1 + sgn) * 0.02 * w);
        this.bones.get(`forearm${side}`)!.obj.rotateZ(Math.sin(time * 1.3 + sgn * 2) * 0.02 * w);
      }
      let yaw = 0;
      let pitch = 0;
      if (look) {
        const neck = this.bones.get('neck')!.obj;
        this.root.updateMatrixWorld(true);
        const local = neck.worldToLocal(_v.copy(look));
        yaw = clamp(Math.atan2(-local.z, local.x), -0.6, 0.6);
        pitch = clamp(Math.atan2(local.y - D.headSize * 0.6, Math.hypot(local.x, local.z)), -0.3, 0.25);
      }
      const k = 1 - Math.exp(-dt * 4);
      this.lookYaw += (yaw - this.lookYaw) * k;
      this.lookPitch += (pitch - this.lookPitch) * k;
      const head = this.bones.get('head')!.obj;
      head.rotateY(this.lookYaw * w);
      head.rotateZ(this.lookPitch * w);
    }

    // Ground contact: whatever is lowest (wheels early, feet later) rests on the floor
    this.root.position.y = 0;
    if (tau > 0) {
      this.root.updateMatrixWorld(true);
      let lowest = Infinity;
      for (const wh of this.wheels) {
        wh.node.obj.getWorldPosition(_v);
        const r = wh.r * wh.node.obj.getWorldScale(_s).x;
        lowest = Math.min(lowest, _v.y - r);
      }
      for (const side of ['R', 'L'] as const) {
        this.bones.get(`foot${side}`)!.obj.getWorldPosition(_v);
        lowest = Math.min(lowest, _v.y - D.footH);
      }
      this.root.position.y = -lowest;
    }
  }

  worldPos(id: string, out = new THREE.Vector3()) {
    const n = this.parts.get(id) ?? this.bones.get(id as BoneId);
    if (!n) return out.set(0, 0, 0);
    return n.obj.getWorldPosition(out);
  }

  dispose() {
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
    this.root.removeFromParent();
  }
}
