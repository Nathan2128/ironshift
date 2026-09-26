import type { RobotClassId } from '../vehicles/types';

export type HeadStyle = 'swept' | 'bastion' | 'crest' | 'monolith';

export interface RobotDims {
  s: number;
  thighLen: number;
  shinLen: number;
  footH: number;
  upperArmLen: number;
  forearmLen: number;
  hipHalf: number;
  shoulderHalf: number;
  chestW: number;
  chestH: number;
  chestD: number;
  pelvisToSpine: number;
  abdomenLen: number;
  neckLen: number;
  headSize: number;
  limb: number;
  lean: number;
  head: HeadStyle;
}

export interface RobotClass {
  id: RobotClassId;
  name: string;
  role: string;
  code: string;
  mass: number;
  stats: { speed: number; armor: number; firepower: number; agility: number };
  bio: string;
  dims: RobotDims;
}

function dims(s: number, o: Partial<RobotDims> & Pick<RobotDims, 'head'>): RobotDims {
  const base: RobotDims = {
    s,
    thighLen: 1.3 * s,
    shinLen: 1.36 * s,
    footH: 0.3 * s,
    upperArmLen: 1.0 * s,
    forearmLen: 1.05 * s,
    hipHalf: 0.42 * s,
    shoulderHalf: 1.18 * s,
    chestW: 1.55 * s,
    chestH: 1.05 * s,
    chestD: 0.9 * s,
    pelvisToSpine: 0.34 * s,
    abdomenLen: 0.55 * s,
    neckLen: 0.26 * s,
    headSize: 0.68 * s,
    limb: 1,
    lean: 0.1,
    head: o.head,
  };
  return { ...base, ...o };
}

export const CLASSES: Record<RobotClassId, RobotClass> = {
  striker: {
    id: 'striker',
    name: 'Striker',
    role: 'Pursuit / First Contact',
    code: 'STR',
    mass: 3.4,
    stats: { speed: 94, armor: 56, firepower: 68, agility: 96 },
    bio: 'is a Striker-class interceptor built for pursuit and first contact. Its frame trades plating for acceleration: by the time a target registers the shift, it is already inside their guard.',
    dims: dims(1, { head: 'swept', lean: 0.16, chestD: 1.0, shoulderHalf: 1.24 }),
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    role: 'Guardian / Escort',
    code: 'WRD',
    mass: 5.9,
    stats: { speed: 58, armor: 95, firepower: 66, agility: 52 },
    bio: 'is a Warden-class guardian. Engineered around a reinforced people-carrier frame, it converts cabin volume into layered plating and never yields ground it has been assigned to protect.',
    dims: dims(1.06, {
      head: 'bastion',
      hipHalf: 0.5 * 1.06,
      shoulderHalf: 1.4 * 1.06,
      chestW: 1.9 * 1.06,
      chestH: 1.12 * 1.06,
      chestD: 1.02 * 1.06,
      limb: 1.2,
      lean: 0.05,
    }),
  },
  sovereign: {
    id: 'sovereign',
    name: 'Sovereign',
    role: 'Field Command',
    code: 'SOV',
    mass: 5.2,
    stats: { speed: 74, armor: 82, firepower: 88, agility: 64 },
    bio: 'is a Sovereign-class field commander. A luxury-grade frame conceals command uplinks and a heavy weapons spine; it leads from the front and expects the line to keep pace.',
    dims: dims(1.08, {
      head: 'crest',
      hipHalf: 0.47 * 1.08,
      shoulderHalf: 1.32 * 1.08,
      chestW: 1.8 * 1.08,
      chestH: 1.12 * 1.08,
      chestD: 0.98 * 1.08,
      limb: 1.12,
      lean: 0.06,
    }),
  },
  juggernaut: {
    id: 'juggernaut',
    name: 'Juggernaut',
    role: 'Breach / Heavy Assault',
    code: 'JGR',
    mass: 6.8,
    stats: { speed: 52, armor: 98, firepower: 94, agility: 42 },
    bio: 'is a Juggernaut-class breacher. Cold-rolled exoskeleton panels shrug off small-arms fire, and its transformation sequence doubles as a battering charge.',
    dims: dims(1.12, {
      head: 'monolith',
      hipHalf: 0.52 * 1.12,
      shoulderHalf: 1.5 * 1.12,
      chestW: 2.05 * 1.12,
      chestH: 1.18 * 1.12,
      chestD: 1.08 * 1.12,
      limb: 1.3,
      lean: 0.17,
    }),
  },
};

export type Loadout = 'cannon' | 'blade' | 'shield';

export const LOADOUTS: Record<Loadout, { label: string; line: string; mod: Partial<RobotClass['stats']> }> = {
  cannon: { label: 'Arm Cannon', line: 'Primary armament: forearm-mounted plasma cannon.', mod: { firepower: 8 } },
  blade: { label: 'Arm Blade', line: 'Primary armament: retractable monomolecular arm blade.', mod: { agility: 5, firepower: 3 } },
  shield: { label: 'Tower Shield', line: 'Primary armament: deployable kinetic barrier.', mod: { armor: 6 } },
};
