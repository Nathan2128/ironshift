import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MatKey, MatLib } from './materials';

export type V3 = [number, number, number];

export interface Xf {
  p?: V3;
  r?: V3;
  s?: number | V3;
  q?: THREE.Quaternion;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function xfMatrix(t?: Xf, out = new THREE.Matrix4()) {
  if (!t) return out.identity();
  _p.set(...(t.p ?? [0, 0, 0]));
  if (t.q) _q.copy(t.q);
  else _q.setFromEuler(_e.set(...(t.r ?? [0, 0, 0])));
  if (typeof t.s === 'number') _s.setScalar(t.s);
  else if (t.s) _s.set(...t.s);
  else _s.setScalar(1);
  return out.compose(_p, _q, _s);
}

/** Quaternion rotating +Y onto dir. */
export function alignY(dir: V3 | THREE.Vector3) {
  const d = Array.isArray(dir) ? new THREE.Vector3(...dir) : dir.clone();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

function normalize(geo: THREE.BufferGeometry) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  g.clearGroups();
  return g;
}

export type Plane = 'XY' | 'ZY' | 'XZ';

/**
 * Accumulates primitive geometry per material, then merges into one mesh per
 * material — keeps draw calls low for the hundreds of mechanical details.
 */
export class Kit {
  items: { geo: THREE.BufferGeometry; mat: MatKey }[] = [];

  add(geo: THREE.BufferGeometry, mat: MatKey, t?: Xf) {
    geo.applyMatrix4(xfMatrix(t, _m));
    this.items.push({ geo: normalize(geo), mat });
    return this;
  }

  box(w: number, h: number, d: number, mat: MatKey, t?: Xf, r = 0.02) {
    const rr = Math.min(r, Math.min(w, h, d) / 2 - 1e-4);
    const geo = rr > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
    return this.add(geo, mat, t);
  }

  /** Cylinder along local Y. */
  cyl(rt: number, rb: number, h: number, mat: MatKey, t?: Xf, seg = 24, open = false) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat, t);
  }

  /** Cylinder along X. */
  cylX(r: number, h: number, mat: MatKey, p: V3, seg = 24, r2 = r) {
    return this.cyl(r, r2, h, mat, { p, r: [0, 0, Math.PI / 2] }, seg);
  }

  /** Cylinder along Z. */
  cylZ(r: number, h: number, mat: MatKey, p: V3, seg = 24, r2 = r) {
    return this.cyl(r, r2, h, mat, { p, r: [Math.PI / 2, 0, 0] }, seg);
  }

  sphere(r: number, mat: MatKey, t?: Xf, ws = 20, hs = 14) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), mat, t);
  }

  torus(R: number, r: number, mat: MatKey, t?: Xf, rs = 10, ts = 36) {
    return this.add(new THREE.TorusGeometry(R, r, rs, ts), mat, t);
  }

  /**
   * Extrudes a 2D outline. plane: 'XY' outline in x/y extruded along z;
   * 'ZY' outline u->z, v->y extruded along x; 'XZ' outline u->x, v->z extruded along y.
   */
  extrude(
    outline: ReadonlyArray<readonly [number, number]>,
    depth: number,
    mat: MatKey,
    plane: Plane = 'XY',
    t?: Xf,
    bevel = 0.012,
    holes: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [],
  ) {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const b = Math.min(bevel, depth * 0.45);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, depth - 2 * b),
      bevelEnabled: b > 0.0005,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 2,
      curveSegments: 10,
    });
    geo.translate(0, 0, -(depth - 2 * b) / 2);
    if (plane === 'ZY') geo.rotateY(-Math.PI / 2);
    else if (plane === 'XZ') geo.rotateX(Math.PI / 2);
    return this.add(geo, mat, t);
  }

  /** Box stretched between two points (struts, rails, pistons). */
  beam(a: V3, b: V3, w: number, h: number, mat: MatKey, r = 0.01) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const q = alignY(vb.clone().sub(va));
    return this.box(w, len, h, mat, { p: [mid.x, mid.y, mid.z], q }, r);
  }

  rod(a: V3, b: V3, radius: number, mat: MatKey, seg = 14) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const q = alignY(vb.clone().sub(va));
    return this.cyl(radius, radius, len, mat, { p: [mid.x, mid.y, mid.z], q }, seg);
  }

  /** Append another kit's items with a transform applied. */
  merge(other: Kit, t?: Xf) {
    const m = xfMatrix(t, new THREE.Matrix4());
    for (const it of other.items) {
      const g = it.geo.clone();
      g.applyMatrix4(m);
      this.items.push({ geo: g, mat: it.mat });
    }
    return this;
  }

  /** Mirror all items across z=0 into a new kit (flips winding correctly). */
  mirroredZ() {
    const k = new Kit();
    const m = new THREE.Matrix4().makeScale(1, 1, -1);
    for (const it of this.items) {
      const g = it.geo.clone();
      g.applyMatrix4(m);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const nor = g.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 3) {
        for (const attr of [pos, nor]) {
          const x = attr.getX(i + 1), y = attr.getY(i + 1), z = attr.getZ(i + 1);
          attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
          attr.setXYZ(i + 2, x, y, z);
        }
      }
      k.items.push({ geo: g, mat: it.mat });
    }
    return k;
  }

  translate(x: number, y: number, z: number) {
    for (const it of this.items) it.geo.translate(x, y, z);
    return this;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  build(mats: MatLib, name = 'kit'): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    const byMat = new Map<MatKey, THREE.BufferGeometry[]>();
    for (const it of this.items) {
      if (!byMat.has(it.mat)) byMat.set(it.mat, []);
      byMat.get(it.mat)!.push(it.geo);
    }
    for (const [key, geos] of byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mats.get(key));
      const emissive = key === 'energy' || key === 'headlight' || key === 'taillight';
      mesh.castShadow = !emissive;
      mesh.receiveShadow = !emissive;
      mesh.name = key;
      group.add(mesh);
    }
    return group;
  }
}
