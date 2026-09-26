import * as THREE from 'three';

export type Finish = 'gloss' | 'satin' | 'matte' | 'brushed' | 'chrome';

export type MatKey =
  | 'paint'
  | 'glass'
  | 'trim'
  | 'inner'
  | 'chrome'
  | 'rubber'
  | 'alloy'
  | 'energy'
  | 'headlight'
  | 'taillight'
  | 'caliper'
  | 'dark'
  | 'lens'
  | 'wheelDark';

/** Material index order used by body panel geometry groups. */
export const BODY = { PAINT: 0, GLASS: 1, TRIM: 2, INNER: 3, CHROME: 4 } as const;

const FINISHES: Record<Finish, { metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number }> = {
  gloss: { metalness: 0.62, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 },
  satin: { metalness: 0.45, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.3 },
  matte: { metalness: 0.2, roughness: 0.74, clearcoat: 0, clearcoatRoughness: 0.5 },
  brushed: { metalness: 1, roughness: 0.34, clearcoat: 0, clearcoatRoughness: 0.4 },
  chrome: { metalness: 1, roughness: 0.07, clearcoat: 0.6, clearcoatRoughness: 0.05 },
};

export class MatLib {
  readonly paint = new THREE.MeshPhysicalMaterial({ color: 0xb01e23 });
  readonly glass = new THREE.MeshPhysicalMaterial({
    color: 0x05070a,
    metalness: 0.35,
    roughness: 0.03,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
  });
  readonly trim = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: 0.35, roughness: 0.42 });
  readonly inner = new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.85, roughness: 0.42 });
  readonly dark = new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.7, roughness: 0.55 });
  readonly chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.1 });
  readonly rubber = new THREE.MeshStandardMaterial({ color: 0x121315, metalness: 0, roughness: 0.88 });
  readonly alloy = new THREE.MeshStandardMaterial({ color: 0xbfc3ca, metalness: 1, roughness: 0.24 });
  readonly wheelDark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.8, roughness: 0.35 });
  readonly lens = new THREE.MeshPhysicalMaterial({ color: 0x1a1f26, metalness: 1, roughness: 0.12, clearcoat: 1 });
  readonly caliper = new THREE.MeshStandardMaterial({ color: 0x19c3ff, metalness: 0.3, roughness: 0.38 });
  readonly energy = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x19c3ff, emissiveIntensity: 6 });
  readonly headlight = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xe4eeff, emissiveIntensity: 5 });
  readonly taillight = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1230, emissiveIntensity: 3.2 });

  private energyBase = 3.6;
  private energyLevel = 0;
  readonly energyColor = new THREE.Color(0x19c3ff);

  /** Body panels use a fixed material index order: see BODY. */
  readonly bodyArray: THREE.Material[] = [this.paint, this.glass, this.trim, this.inner, this.chrome];

  get(key: MatKey): THREE.Material {
    return this[key];
  }

  setPaint(hex: string, finish: Finish) {
    const f = FINISHES[finish];
    this.paint.color.set(hex);
    this.paint.metalness = f.metalness;
    this.paint.roughness = f.roughness;
    this.paint.clearcoat = f.clearcoat;
    this.paint.clearcoatRoughness = f.clearcoatRoughness;
    this.paint.envMapIntensity = finish === 'chrome' ? 1.25 : 1;
    this.paint.needsUpdate = true;
  }

  setEnergy(hex: string) {
    this.energyColor.set(hex);
    this.energy.emissive.set(hex);
    this.caliper.color.set(hex).multiplyScalar(0.75);
  }

  /** 0 = dormant, 1 = fully ignited. Values above 1 flash. */
  setEnergyLevel(v: number) {
    this.energyLevel = v;
    this.energy.emissiveIntensity = 0.15 + this.energyBase * v;
  }

  getEnergyLevel() {
    return this.energyLevel;
  }
}
