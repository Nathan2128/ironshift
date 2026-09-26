import type { Pts } from '../core/math';
import type { Finish } from '../core/materials';
import type { Kit } from '../core/kit';
import type { BodyShape } from './body';

export type VehicleId = 'coupe' | 'van' | 'suv' | 'truck';
export type RobotClassId = 'striker' | 'warden' | 'sovereign' | 'juggernaut';
export type WheelStyle = 'twin5' | 'multi' | 'amg' | 'aero';

export type PanelId =
  | 'nose'
  | 'hoodR'
  | 'hoodL'
  | 'fenderR'
  | 'fenderL'
  | 'door1R'
  | 'door1L'
  | 'door2R'
  | 'door2L'
  | 'quarterR'
  | 'quarterL'
  | 'windshield'
  | 'roof'
  | 'rearGlass'
  | 'deck'
  | 'tailR'
  | 'tailL'
  | 'floor';

export interface WheelSpec {
  /** Distance of the axle from the front bumper tip. */
  d: number;
  r: number;
  width: number;
}

export interface DetailCtx {
  body: BodyShape;
  spec: VehicleSpec;
  /** Kit for a panel, in car coordinates (x forward, y up, z right). */
  kit(panel: PanelId): Kit;
  /** Car x from distance-behind-front d. */
  x(d: number): number;
}

export interface VehicleSpec {
  id: VehicleId;
  label: string;
  descriptor: string;
  robotClass: RobotClassId;
  defaultName: string;
  defaultPaint: string;
  defaultFinish: Finish;

  L: number;
  interp: 'smooth' | 'linear';
  /** Profile curves, keyed by distance behind the front tip (d). */
  top: Pts;
  bottom: Pts;
  halfW: Pts;
  belt: Pts;
  crown: Pts;
  tumble: number;
  rB: number;
  rT: number;
  sideBulge: number;
  crease: number;

  front: WheelSpec;
  rear: WheelSpec;
  wheelStyle: WheelStyle;
  arch: 'round' | 'trapezoid';
  archGap: number;
  /** Dark cladding band around the wheel arches (m). 0 = none. */
  archTrim: number;

  st: {
    noseEnd: number;
    ws0: number;
    ws1: number;
    rg0: number;
    rg1: number;
    door0: number;
    doorMid: number;
    door1: number;
    tailStart: number;
  };
  windows: [number, number][];
  pillar: 'paint' | 'trim';
  glassRoof?: [number, number];
  /** Underside faces within these distances of the front / rear are painted (sloped aprons). */
  apron?: [number, number];

  details(ctx: DetailCtx): void;
}
