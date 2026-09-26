import type { V3 } from '../core/kit';
import type { RobotDims } from '../robot/classes';

export type BoneId =
  | 'pelvis'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulderR'
  | 'shoulderL'
  | 'upperArmR'
  | 'upperArmL'
  | 'forearmR'
  | 'forearmL'
  | 'handR'
  | 'handL'
  | 'thighR'
  | 'thighL'
  | 'shinR'
  | 'shinL'
  | 'footR'
  | 'footL';

export interface Pose {
  p: V3;
  r: V3;
}

export interface BoneDef {
  id: BoneId;
  parent: BoneId | null;
  a: Pose;
  b: Pose;
  win: [number, number];
}

export interface CarDims {
  L: number;
  H: number;
  halfW: number;
}

/**
 * Robot faces +X, +Y up, +Z to its right. Limbs hang along -Y from their joint.
 * Pose A is folded flat inside the car (lying face-down, head toward the nose);
 * pose B is the standing combat stance.
 */
export function skeleton(D: RobotDims, car: CarDims): BoneDef[] {
  const s = D.s;
  const lean = D.lean;
  const W = car.halfW;
  const bones: BoneDef[] = [];
  const add = (id: BoneId, parent: BoneId | null, a: Pose, b: Pose, win: [number, number]) =>
    bones.push({ id, parent, a, b, win });

  add('pelvis', null, { p: [-car.L * 0.1, car.H * 0.42, 0], r: [0, 0, -Math.PI / 2] }, { p: [0, 0, 0], r: [0, 0, -lean * 0.3] }, [0.3, 1.6]);
  add('spine', 'pelvis', { p: [0, 0.2 * s, 0], r: [0, 0, 0] }, { p: [0, D.pelvisToSpine, 0], r: [0, 0, -lean * 0.5] }, [0.4, 1.7]);
  add('chest', 'spine', { p: [0, 0.35 * s, 0], r: [0, 0, 0] }, { p: [0, D.abdomenLen, 0], r: [0, 0, -lean * 0.3] }, [0.5, 1.8]);
  add('neck', 'chest', { p: [0, 0.3 * s, 0], r: [0, 0, 0] }, { p: [D.chestD * 0.04, D.chestH * 1.02, 0], r: [0, 0, lean * 1.05] }, [1.5, 2.4]);
  add('head', 'neck', { p: [0, 0.05 * s, 0], r: [0, 0, 0] }, { p: [0, D.neckLen, 0], r: [0, 0, -0.07] }, [1.9, 2.75]);

  for (const [side, sgn] of [
    ['R', 1],
    ['L', -1],
  ] as const) {
    add(`shoulder${side}`, 'chest', { p: [0, 0.3 * s, sgn * W * 0.45], r: [0, 0, 0] }, { p: [0, D.chestH * 0.78, sgn * D.shoulderHalf], r: [0, 0, 0] }, [0.9, 2.0]);
    add(`upperArm${side}`, `shoulder${side}`, { p: [0, 0, 0], r: [0, 0, 0] }, { p: [0, -0.04 * s, 0], r: [-sgn * 0.26, 0, 0.2] }, [1.1, 2.3]);
    add(`forearm${side}`, `upperArm${side}`, { p: [0, -0.55 * s, 0], r: [0, 0, 0] }, { p: [0, -D.upperArmLen, 0], r: [sgn * 0.14, 0, 0.7] }, [1.35, 2.5]);
    add(`hand${side}`, `forearm${side}`, { p: [0, -0.45 * s, 0], r: [0, 0, 0] }, { p: [0, -D.forearmLen, 0], r: [0, 0, 0.12] }, [1.8, 2.65]);
    add(`thigh${side}`, 'pelvis', { p: [0, -0.05 * s, sgn * W * 0.4], r: [0, 0, 0] }, { p: [0, -0.1 * s, sgn * D.hipHalf], r: [-sgn * 0.17, 0, 0.27 + lean * 0.3] }, [0.35, 1.6]);
    add(`shin${side}`, `thigh${side}`, { p: [0, -0.75 * s, 0], r: [0, 0, 0] }, { p: [0, -D.thighLen, 0], r: [sgn * 0.13, 0, -0.54] }, [0.5, 1.75]);
    add(`foot${side}`, `shin${side}`, { p: [0, -0.7 * s, 0], r: [0, 0, 0] }, { p: [0, -D.shinLen, 0], r: [sgn * 0.04, 0, 0.27] }, [0.95, 1.9]);
  }
  return bones;
}
