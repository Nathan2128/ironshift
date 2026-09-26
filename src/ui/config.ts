import type { Finish } from '../core/materials';
import { hashString, rng } from '../core/math';
import type { Loadout } from '../robot/classes';
import type { Insignia } from '../vehicles/insignia';
import { VEHICLES } from '../vehicles/specs';
import type { VehicleId } from '../vehicles/types';

export type Speed = 'slowmo' | 'cinematic' | 'standard' | 'rapid';

export interface Config {
  vehicle: VehicleId;
  name: string;
  paint: string;
  finish: Finish;
  energy: string;
  loadout: Loadout;
  insignia: Insignia;
  speed: Speed;
}

export const SPEEDS: Record<Speed, { label: string; k: number }> = {
  slowmo: { label: 'Slow-mo', k: 0.28 },
  cinematic: { label: 'Cinematic', k: 0.62 },
  standard: { label: 'Standard', k: 1 },
  rapid: { label: 'Rapid', k: 1.7 },
};

export const PAINTS: { name: string; hex: string }[] = [
  { name: 'Signal Red', hex: '#b3121c' },
  { name: 'Obsidian', hex: '#0e1013' },
  { name: 'Arctic White', hex: '#e6e8eb' },
  { name: 'Liquid Silver', hex: '#c9ccd1' },
  { name: 'Stainless', hex: '#b9bdc4' },
  { name: 'Gunmetal', hex: '#4a4f57' },
  { name: 'Midnight Blue', hex: '#1f2a3a' },
  { name: 'Solar Yellow', hex: '#f0b00a' },
  { name: 'Ember Orange', hex: '#de5116' },
  { name: 'Acid Green', hex: '#78c93a' },
  { name: 'Royal Violet', hex: '#48298a' },
];

export const ENERGIES: { name: string; hex: string }[] = [
  { name: 'Arc Cyan', hex: '#19c3ff' },
  { name: 'Crimson', hex: '#ff2340' },
  { name: 'Amber', hex: '#ffab1a' },
  { name: 'Ultraviolet', hex: '#9b5cff' },
  { name: 'Emerald', hex: '#1ee39a' },
  { name: 'White Hot', hex: '#e8f0ff' },
];

export const FINISHES: { id: Finish; label: string }[] = [
  { id: 'gloss', label: 'Gloss' },
  { id: 'satin', label: 'Satin' },
  { id: 'matte', label: 'Matte' },
  { id: 'brushed', label: 'Brushed' },
  { id: 'chrome', label: 'Chrome' },
];

const NAMES = [
  'VANTAGE', 'BULWARK', 'REGENT', 'MONOLITH', 'KESTREL', 'HALBERD', 'OBSIDIAN', 'WRAITH', 'TEMPEST', 'RAMPART',
  'ONYX', 'SOVEREIGN', 'VORTEX', 'ARGENT', 'RAZORBACK', 'HELIX', 'TALON', 'CINDER', 'APEX', 'NOCTURNE',
  'IRONCLAD', 'SABRE', 'GRAVITON', 'BASTION', 'HAVOC', 'SPECTRE', 'TITANUS', 'CAIRN', 'VALKYR', 'DREADNOUGHT',
  'EMBERFALL', 'STORMCALL', 'BRIMSTONE', 'GLAIVE', 'PARAGON', 'CROWN', 'RIFT', 'OVERLOAD', 'AXIOM', 'NIGHTFALL',
];

export function randomName(exclude = '') {
  let n = exclude;
  while (n === exclude) n = NAMES[Math.floor(Math.random() * NAMES.length)];
  return n;
}

export function sanitizeName(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9\- ]/g, '').slice(0, 14);
}

export function serial(cfg: Config, code: string) {
  const r = rng(hashString(cfg.name + cfg.vehicle));
  const n = Math.floor(1000 + r() * 8999);
  const c = String.fromCharCode(65 + Math.floor(r() * 26));
  return `IS-${code}-${n}-${c}`;
}

export function defaultConfig(vehicle: VehicleId = 'coupe'): Config {
  const spec = VEHICLES[vehicle];
  return {
    vehicle,
    name: spec.defaultName,
    paint: spec.defaultPaint,
    finish: spec.defaultFinish,
    energy: '#19c3ff',
    loadout: 'cannon',
    insignia: 'vanguard',
    speed: 'cinematic',
  };
}

const KEYS: (keyof Config)[] = ['vehicle', 'name', 'paint', 'finish', 'energy', 'loadout', 'insignia', 'speed'];

export function encodeConfig(c: Config) {
  const json = JSON.stringify(KEYS.map((k) => c[k]));
  return btoa(unescape(encodeURIComponent(json))).replace(/=+$/, '');
}

export function decodeConfig(s: string): Config | null {
  try {
    const arr = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (!Array.isArray(arr) || arr.length !== KEYS.length) return null;
    const c = defaultConfig();
    KEYS.forEach((k, i) => ((c as unknown as Record<string, unknown>)[k] = arr[i]));
    if (!(c.vehicle in VEHICLES)) return null;
    c.name = sanitizeName(String(c.name)) || VEHICLES[c.vehicle].defaultName;
    return c;
  } catch {
    return null;
  }
}
