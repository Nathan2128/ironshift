import * as THREE from 'three';
import { MatLib } from './core/materials';
import { Stage } from './stage/stage';
import { buildCar } from './vehicles/car';
import { VEHICLES, VEHICLE_ORDER } from './vehicles/specs';
import { Rig, SEQ_T } from './rig/rig';

const stage = new Stage(document.getElementById('stage')!);
const params = new URLSearchParams(location.search);
const only = params.get('v');
const rigId = params.get('rig');
const explode = parseFloat(params.get('explode') ?? '0');
const mats = new MatLib();
const paint = params.get('paint');
let rig: Rig | null = null;
const rigs: Rig[] = [];
let tau = parseFloat(params.get('t') ?? '0');
const play = params.get('play');

if (rigId === 'all') {
  VEHICLE_ORDER.forEach((id, i) => {
    const spec = VEHICLES[id];
    const m = new MatLib();
    m.setPaint(spec.defaultPaint, spec.defaultFinish);
    m.setEnergyLevel(1);
    const r = new Rig({ vehicle: id, loadout: (['cannon', 'shield', 'blade', 'cannon'] as const)[i], insignia: 'vanguard' }, m);
    r.root.position.z = (i - 1.5) * 4.2;
    stage.scene.add(r.root);
    rigs.push(r);
  });
  stage.controls.target.set(0, 2.6, 0);
  stage.camera.position.set(22, 5, 0);
} else if (rigId) {
  const spec = VEHICLES[rigId as keyof typeof VEHICLES];
  mats.setPaint(paint ? '#' + paint : spec.defaultPaint, spec.defaultFinish);
  mats.setEnergyLevel(1);
  rig = new Rig({ vehicle: spec.id, loadout: (params.get('w') as any) ?? 'cannon', insignia: 'vanguard' }, mats);
  stage.scene.add(rig.root);
  stage.controls.target.set(0, 2.6, 0);
  stage.camera.position.set(9, 3, 7);
} else {
  const list = only ? [only] : VEHICLE_ORDER;
  list.forEach((id, i) => {
    const spec = VEHICLES[id as keyof typeof VEHICLES];
    const m = only ? mats : new MatLib();
    m.setPaint(paint ? '#' + paint : spec.defaultPaint, spec.defaultFinish);
    const car = buildCar(spec, m, 'vanguard');
    const root = new THREE.Group();
    for (const p of car.parts) {
      p.group.position.copy(p.center);
      if (explode) p.group.position.addScaledVector(p.center.clone().setY(p.center.y - 0.6), explode);
      root.add(p.group);
    }
    root.position.z = only ? 0 : (i - 1.5) * 3.2;
    stage.scene.add(root);
  });
  if (!only) stage.camera.position.set(14, 4, 14);
}
const cam = params.get('cam');
if (cam) {
  const [x, y, z, tx, ty, tz] = cam.split(',').map(Number);
  stage.camera.position.set(x, y, z);
  stage.controls.target.set(tx, ty, tz);
}
(window as any).stage = stage;
(window as any).setTau = (t: number) => (tau = t);
(window as any).rig = rig;
const clock = new THREE.Clock();
let time = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  if (rig) {
    if (play) tau = (time * parseFloat(play)) % (SEQ_T + 1.5);
    rig.update(Math.min(tau, SEQ_T), time, null, dt);
  }
  for (const r of rigs) {
    const z = r.root.position.z;
    r.update(play ? (time * parseFloat(play)) % (SEQ_T + 1.5) : tau, time, null, dt);
    r.root.position.z = z;
  }
  stage.controls.update();
  stage.update(dt);
  stage.render(dt);
  requestAnimationFrame(loop);
}
window.addEventListener('resize', () => stage.resize());
loop();
