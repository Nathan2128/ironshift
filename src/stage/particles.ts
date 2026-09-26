import * as THREE from 'three';

const vert = /* glsl */ `
  attribute float size;
  attribute vec4 tint;
  varying vec4 vTint;
  uniform float uScale;
  void main() {
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  varying vec4 vTint;
  uniform float uSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(uSoft, 1.0, d);
    if (a <= 0.001) discard;
    gl_FragColor = vec4(vTint.rgb, vTint.a * a);
  }
`;

interface P {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size0: number;
  size1: number;
  color: THREE.Color;
  alpha: number;
}

export interface EmitOpts {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  size0: number;
  size1?: number;
  color: THREE.Color;
  alpha?: number;
}

/** CPU particle pool rendered as soft point sprites. */
export class Particles {
  readonly points: THREE.Points;
  private pool: P[] = [];
  private geo: THREE.BufferGeometry;
  private cursor = 0;

  constructor(
    private capacity: number,
    opts: { additive?: boolean; soft?: number; gravity?: number; drag?: number; floor?: boolean; wrap?: { r: number; h: number } } = {},
  ) {
    this.wrap = opts.wrap ?? null;
    this.gravity = opts.gravity ?? 0;
    this.drag = opts.drag ?? 0;
    this.floor = opts.floor ?? false;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uScale: { value: 600 }, uSoft: { value: opts.soft ?? 0.0 } },
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        max: 1,
        size0: 1,
        size1: 1,
        color: new THREE.Color(),
        alpha: 1,
      });
    }
  }

  gravity: number;
  drag: number;
  floor: boolean;
  wrap: { r: number; h: number } | null;

  setViewportHeight(h: number, fov: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h / (2 * Math.tan((fov * Math.PI) / 360));
  }

  emit(o: EmitOpts) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    p.alive = true;
    p.pos.copy(o.pos);
    p.vel.copy(o.vel);
    p.life = 0;
    p.max = o.life;
    p.size0 = o.size0;
    p.size1 = o.size1 ?? o.size0;
    p.color.copy(o.color);
    p.alpha = o.alpha ?? 1;
  }

  update(dt: number) {
    const pos = this.geo.attributes.position.array as Float32Array;
    const size = this.geo.attributes.size.array as Float32Array;
    const tint = this.geo.attributes.tint.array as Float32Array;
    const damp = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (p.alive) {
        p.life += dt;
        if (p.life >= p.max) p.alive = false;
      }
      if (!p.alive) {
        size[i] = 0;
        tint[i * 4 + 3] = 0;
        continue;
      }
      p.vel.y -= this.gravity * dt;
      p.vel.multiplyScalar(damp);
      p.pos.addScaledVector(p.vel, dt);
      if (this.floor && p.pos.y < 0.01) {
        p.pos.y = 0.01;
        p.vel.y *= -0.35;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      if (this.wrap) {
        const w = this.wrap;
        const rr = Math.hypot(p.pos.x, p.pos.z);
        if (rr > w.r) p.pos.multiplyScalar(-0.98);
        if (p.pos.y > w.h) p.pos.y = 0.05;
        if (p.pos.y < 0.02) p.pos.y = w.h - 0.05;
      }
      const t = this.wrap ? 0.5 : p.life / p.max;
      pos[i * 3] = p.pos.x;
      pos[i * 3 + 1] = p.pos.y;
      pos[i * 3 + 2] = p.pos.z;
      size[i] = p.size0 + (p.size1 - p.size0) * t;
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      tint[i * 4] = p.color.r;
      tint[i * 4 + 1] = p.color.g;
      tint[i * 4 + 2] = p.color.b;
      tint[i * 4 + 3] = p.alpha * Math.max(0, fade);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.tint.needsUpdate = true;
  }
}
