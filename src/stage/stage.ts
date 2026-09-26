import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { Particles } from './particles';

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, srgb = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Polished concrete: soft mottling and fine speckle. */
function concreteTexture() {
  const t = canvasTexture(1024, (g, s) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 20 + Math.random() * 90;
      const v = Math.floor(110 + Math.random() * 40);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${v},${v},${v},0.06)`);
      grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const img = g.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

/** Radial alpha: floor is slightly see-through (reflective) near centre, solid further out. */
function floorAlpha() {
  return canvasTexture(512, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgb(190,190,190)');
    grd.addColorStop(0.18, 'rgb(205,205,205)');
    grd.addColorStop(0.45, 'rgb(245,245,245)');
    grd.addColorStop(1, 'rgb(255,255,255)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

/** Scanner pad markings: rings, ticks and a faint grid. */
function padTexture() {
  return canvasTexture(2048, (g, s) => {
    const c = s / 2;
    g.clearRect(0, 0, s, s);
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    const ring = (r: number, w: number, a: number, dash: number[] = []) => {
      g.globalAlpha = a;
      g.lineWidth = w;
      g.setLineDash(dash);
      g.beginPath();
      g.arc(c, c, r * c, 0, Math.PI * 2);
      g.stroke();
    };
    ring(0.985, 3, 0.9);
    ring(0.955, 1.5, 0.35);
    ring(0.72, 2, 0.45, [60, 18]);
    ring(0.44, 1.5, 0.28);
    ring(0.2, 1.5, 0.18, [8, 10]);
    g.setLineDash([]);
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const long = i % 15 === 0;
      const r0 = long ? 0.9 : 0.93;
      g.globalAlpha = long ? 0.85 : 0.35;
      g.lineWidth = long ? 3 : 1.5;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r0 * c, c + Math.sin(a) * r0 * c);
      g.lineTo(c + Math.cos(a) * 0.955 * c, c + Math.sin(a) * 0.955 * c);
      g.stroke();
    }
    // corner brackets
    g.globalAlpha = 0.5;
    g.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      g.beginPath();
      g.arc(c, c, 0.83 * c, a - 0.12, a + 0.12);
      g.stroke();
    }
    g.globalAlpha = 0.08;
    g.lineWidth = 1;
    for (let x = -1; x <= 1; x += 0.08) {
      g.beginPath();
      g.moveTo(c + x * c, 0);
      g.lineTo(c + x * c, s);
      g.stroke();
      g.beginPath();
      g.moveTo(0, c + x * c);
      g.lineTo(s, c + x * c);
      g.stroke();
    }
    // radial fade for the grid
    g.globalCompositeOperation = 'destination-in';
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.97, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 1;
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

function beamTexture() {
  return canvasTexture(256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, 'rgba(255,255,255,0.0)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0.0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    const h = g.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)');
    h.addColorStop(0.5, 'rgba(0,0,0,0)');
    h.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = h;
    g.fillRect(0, 0, s, s);
  });
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  readonly chroma: ChromaticAberrationEffect;
  readonly motes: Particles;
  readonly accent = new THREE.Color('#19c3ff');

  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private mirror: Reflector;
  private padMat: THREE.MeshBasicMaterial;
  private rimAccent: THREE.SpotLight;
  private ringMat: THREE.MeshBasicMaterial;
  private accentStrip!: THREE.MeshBasicMaterial;
  private envScene: THREE.Scene;
  readonly key: THREE.SpotLight;

  constructor(readonly container: HTMLElement) {
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = this.scene;
    scene.background = new THREE.Color('#050608');
    scene.fog = new THREE.FogExp2('#050608', 0.03);

    this.camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 250);
    this.camera.position.set(7.2, 1.9, 8.2);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = 1.5;
    this.controls.minPolarAngle = 0.2;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.6;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.target.set(0, 0.8, 0);

    // Environment (studio softboxes) for reflections
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = this.makeEnvScene();
    this.bakeEnv();

    // Lights
    const hemi = new THREE.HemisphereLight(0x2b3444, 0x060607, 0.35);
    scene.add(hemi);

    const key = new THREE.SpotLight(0xfff4ea, 650, 60, 0.5, 0.75, 1.6);
    key.position.set(7, 13, 6);
    key.target.position.set(0, 1.5, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 3;
    scene.add(key, key.target);
    this.key = key;

    const rimCool = new THREE.SpotLight(0xa9c1ff, 380, 60, 0.55, 0.8, 1.6);
    rimCool.position.set(-9, 9, -6);
    rimCool.target.position.set(0, 2, 0);
    scene.add(rimCool, rimCool.target);

    this.rimAccent = new THREE.SpotLight(this.accent, 240, 60, 0.6, 0.8, 1.6);
    this.rimAccent.position.set(-5, 4, 9);
    this.rimAccent.target.position.set(0, 1.5, 0);
    scene.add(this.rimAccent, this.rimAccent.target);

    const fill = new THREE.DirectionalLight(0xbcc8ff, 0.15);
    fill.position.set(10, 3, 12);
    scene.add(fill);

    // Floor: mirror under a semi-transparent polished-concrete skin
    const floorGeo = new THREE.CircleGeometry(70, 96);
    this.mirror = new Reflector(floorGeo, {
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x4a4f58,
      clipBias: 0.003,
    });
    this.mirror.rotation.x = -Math.PI / 2;
    scene.add(this.mirror);

    const skin = new THREE.Mesh(
      floorGeo,
      new THREE.MeshStandardMaterial({
        color: 0x0b0c0f,
        roughness: 0.92,
        metalness: 0,
        map: concreteTexture(),
        alphaMap: floorAlpha(),
        transparent: true,
        envMapIntensity: 0.12,
      }),
    );
    skin.rotation.x = -Math.PI / 2;
    skin.position.y = 0.002;
    skin.receiveShadow = true;
    scene.add(skin);

    // Scanner pad
    this.padMat = new THREE.MeshBasicMaterial({
      map: padTexture(),
      color: this.accent.clone().multiplyScalar(0.55),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(6.2, 128), this.padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.006;
    pad.renderOrder = 2;
    scene.add(pad);

    this.ringMat = new THREE.MeshBasicMaterial({ color: this.accent.clone().multiplyScalar(3), toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.2, 6.24, 160), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.007;
    scene.add(ring);

    // Distant light columns (fog turns them into haze)
    const colMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 1.9), fog: true });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 18), colMat);
      col.position.set(Math.cos(a) * 34, 9, Math.sin(a) * 34);
      col.lookAt(0, 9, 0);
      scene.add(col);
    }
    // Overhead strip lights
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.3) });
    for (let i = -2; i <= 2; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(22, 0.08, 0.35), stripMat);
      st.position.set(0, 16, i * 5);
      scene.add(st);
    }

    // Soft light shaft from the key light
    const beamMat = new THREE.MeshBasicMaterial({
      map: beamTexture(),
      color: new THREE.Color(0.025, 0.025, 0.028),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 17, 48, 1, true), beamMat);
    beam.position.copy(key.position).lerp(new THREE.Vector3(0, 0, 0), 0.5);
    beam.lookAt(key.position);
    beam.rotateX(Math.PI / 2);
    beam.visible = false;
    scene.add(beam);

    // Dust motes in the light
    this.motes = new Particles(420, { additive: true, soft: 0.1, drag: 0, wrap: { r: 9.5, h: 9 } });
    for (let i = 0; i < 420; i++) {
      const r = Math.sqrt(Math.random()) * 9;
      const a = Math.random() * Math.PI * 2;
      this.motes.emit({
        pos: new THREE.Vector3(Math.cos(a) * r, Math.random() * 9, Math.sin(a) * r),
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.05, (Math.random() - 0.3) * 0.03, (Math.random() - 0.5) * 0.05),
        life: 1e9,
        size0: 0.02 + Math.random() * 0.03,
        color: new THREE.Color(0.9, 0.85, 0.8),
        alpha: 0.18 + Math.random() * 0.25,
      });
    }
    scene.add(this.motes.points);

    // Post
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: Math.min(4, renderer.capabilities.maxSamples),
    });
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 1.05,
      luminanceSmoothing: 0.25,
      intensity: 1.05,
      radius: 0.7,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.composer.addPass(new EffectPass(this.camera, this.bloom, tone));
    this.chroma = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0005, 0.0005),
      radialModulation: true,
      modulationOffset: 0.3,
    });
    const vignette = new VignetteEffect({ offset: 0.25, darkness: 0.7 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.11;
    this.composer.addPass(new EffectPass(this.camera, this.chroma, vignette, noise));

    this.resize();
  }

  private makeEnvScene() {
    const env = new THREE.Scene();
    const room = new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.013, 0.016), side: THREE.BackSide }),
    );
    env.add(room);
    const panel = (w: number, h: number, intensity: number | THREE.Color, pos: THREE.Vector3Tuple) => {
      const color = intensity instanceof THREE.Color ? intensity : new THREE.Color(intensity, intensity, intensity * 1.04);
      const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      mesh.position.set(...pos);
      mesh.lookAt(0, 1, 0);
      env.add(mesh);
      return m;
    };
    panel(16, 5, 5, [0, 14, 0]);
    panel(1.2, 9, 3.2, [-11, 4, -6]);
    panel(1.2, 9, 3.2, [-11, 4, 6]);
    panel(1.0, 8, 2.4, [11, 4, -7]);
    panel(10, 0.8, 1.2, [6, 2.5, 11]);
    panel(26, 1.2, 0.35, [0, 0.8, -16]);
    panel(26, 1.2, 0.35, [0, 0.8, 16]);
    this.accentStrip = panel(1.4, 7, this.accent.clone().multiplyScalar(2.2), [-4, 3, -12]);
    return env;
  }

  private bakeEnv() {
    const rt = this.pmrem.fromScene(this.envScene, 0.035);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 1;
  }

  setAccent(hex: string) {
    this.accent.set(hex);
    this.padMat.color.copy(this.accent).multiplyScalar(0.55);
    this.ringMat.color.copy(this.accent).multiplyScalar(3);
    this.rimAccent.color.copy(this.accent);
    this.accentStrip.color.copy(this.accent).multiplyScalar(2.2);
    this.bakeEnv();
  }

  /** Horizontal shift (px) of the image centre, so the subject sits in the space left of the config panel. */
  centerShift = 0;

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const shift = w > 900 ? Math.min(192, w * 0.13) : 0;
    this.centerShift = shift;
    if (shift > 0) {
      this.camera.aspect = (w + 2 * shift) / h;
      this.camera.setViewOffset(w + 2 * shift, h, 2 * shift, 0, w, h);
    } else {
      this.camera.aspect = w / h;
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.mirror.getRenderTarget().setSize(Math.round(w * pr * 0.6), Math.round(h * pr * 0.6));
    this.motes.setViewportHeight(h * pr, this.camera.fov);
  }

  update(dt: number) {
    this.motes.update(dt);
  }

  render(dt: number) {
    this.composer.render(dt);
  }
}
