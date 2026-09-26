import { curve } from '../core/math';
import { CLASSES, LOADOUTS, type Loadout } from '../robot/classes';
import { INSIGNIA, insigniaSvgPath, type Insignia } from '../vehicles/insignia';
import { VEHICLES, VEHICLE_ORDER } from '../vehicles/specs';
import type { VehicleId, VehicleSpec } from '../vehicles/types';
import { ENERGIES, FINISHES, PAINTS, SPEEDS, sanitizeName, serial, type Config, type Speed } from './config';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface UIHandlers {
  onChange(patch: Partial<Config>): void;
  onTransform(): void;
  onScrubStart(): void;
  onScrub(p: number): void;
  onScrubEnd(): void;
  onRandomName(): void;
  onToggleSound(): void;
  onCapture(): void;
  onShare(): void;
}

function silhouette(spec: VehicleSpec) {
  const top = curve(spec.top, spec.interp);
  const bot = curve(spec.bottom, spec.interp);
  const W = 150;
  const H = 42;
  const sc = W / 5.8;
  const ox = (W - spec.L * sc) / 2;
  const x = (d: number) => ox + (spec.L - d) * sc;
  const y = (v: number) => H - 3 - v * sc;
  const n = 60;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const d = (spec.L * i) / n;
    pts.push(`${x(d).toFixed(1)},${y(top(d)).toFixed(1)}`);
  }
  for (let i = n; i >= 0; i--) {
    const d = (spec.L * i) / n;
    let b = bot(d);
    for (const w of [spec.front, spec.rear]) {
      const dx = Math.abs(d - w.d);
      const ra = w.r + spec.archGap;
      if (dx < ra) b = Math.max(b, w.r + Math.sqrt(ra * ra - dx * dx));
    }
    pts.push(`${x(d).toFixed(1)},${y(b).toFixed(1)}`);
  }
  const wheels = [spec.front, spec.rear]
    .map((w) => `<circle class="wheel" cx="${x(w.d).toFixed(1)}" cy="${y(w.r).toFixed(1)}" r="${(w.r * sc).toFixed(1)}"/>`)
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><polygon class="body" points="${pts.join(' ')}"/>${wheels}</svg>`;
}

const LOADOUT_ICONS: Record<Loadout, string> = {
  cannon: '<svg viewBox="0 0 32 32"><path d="M3 13h12v7H3z"/><path d="M15 14.5h13v4H15z"/><path d="M6 20l-1 5h5l1-5"/><path d="M20 14.5v4M24 14.5v4"/></svg>',
  blade: '<svg viewBox="0 0 32 32"><path d="M4 22l3-3 16-13 5-2-2 5-13 16-3 3z"/><path d="M8 18l6 6"/></svg>',
  shield: '<svg viewBox="0 0 32 32"><path d="M16 3l11 4-1 12-10 10L6 19 5 7z"/><path d="M16 8v16"/></svg>',
};

export class UI {
  private cfg!: Config;
  private scrubbing = false;
  private toastTimer = 0;

  constructor(private h: UIHandlers) {
    const brandPath = insigniaSvgPath('vanguard');
    $('brandPath').setAttribute('d', brandPath);
    $('introPath').setAttribute('d', brandPath);
    this.build();
    this.bind();
  }

  private build() {
    $('chassis').innerHTML = VEHICLE_ORDER.map((id) => {
      const v = VEHICLES[id];
      const cls = CLASSES[v.robotClass];
      return `<button class="chassis-card" data-v="${id}" aria-label="${v.label}">
        ${silhouette(v)}
        <div class="chassis-name">${v.label}</div>
        <div class="chassis-class">${cls.name}-class</div>
      </button>`;
    }).join('');

    $('paints').innerHTML =
      PAINTS
        .map((p) => `<button class="swatch" data-paint="${p.hex}" style="background:${p.hex}" aria-label="${p.name}" title="${p.name}"></button>`)
        .join('') + `<label class="swatch custom" title="Custom colour"><input type="color" id="customPaint" aria-label="Custom paint colour" /></label>`;

    $('finishes').innerHTML = FINISHES.map((f) => `<button data-finish="${f.id}">${f.label}</button>`).join('');

    $('energies').innerHTML = ENERGIES.map(
      (e) => `<button class="swatch" data-energy="${e.hex}" style="background:${e.hex};--glow:${e.hex}88" aria-label="${e.name}" title="${e.name}"></button>`,
    ).join('');

    $('loadouts').innerHTML = (Object.keys(LOADOUTS) as Loadout[])
      .map((l) => `<button data-loadout="${l}">${LOADOUT_ICONS[l]}<span>${LOADOUTS[l].label}</span></button>`)
      .join('');

    $('insignias').innerHTML = (['vanguard', 'reaver', 'none'] as Insignia[])
      .map((i) => {
        const icon =
          i === 'none'
            ? '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><path d="M9 23L23 9"/></svg>'
            : `<svg class="solid" viewBox="-0.62 -0.62 1.24 1.24"><path d="${insigniaSvgPath(i)}"/></svg>`;
        return `<button data-insignia="${i}">${icon}<span>${i === 'none' ? 'None' : INSIGNIA[i].label}</span></button>`;
      })
      .join('');

    $('speeds').innerHTML = (Object.keys(SPEEDS) as Speed[]).map((s) => `<button data-speed="${s}">${SPEEDS[s].label}</button>`).join('');
  }

  private bind() {
    const h = this.h;
    const delegate = (id: string, attr: string, fn: (v: string) => void) => {
      $(id).addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest(`[data-${attr}]`) as HTMLElement | null;
        if (b) fn(b.dataset[attr]!);
      });
    };
    delegate('chassis', 'v', (v) => h.onChange({ vehicle: v as VehicleId }));
    delegate('paints', 'paint', (v) => h.onChange({ paint: v }));
    delegate('finishes', 'finish', (v) => h.onChange({ finish: v as Config['finish'] }));
    delegate('energies', 'energy', (v) => h.onChange({ energy: v }));
    delegate('loadouts', 'loadout', (v) => h.onChange({ loadout: v as Loadout }));
    delegate('insignias', 'insignia', (v) => h.onChange({ insignia: v as Insignia }));
    delegate('speeds', 'speed', (v) => h.onChange({ speed: v as Speed }));

    $<HTMLInputElement>('customPaint').addEventListener('input', (e) => h.onChange({ paint: (e.target as HTMLInputElement).value }));

    const name = $<HTMLInputElement>('nameInput');
    name.addEventListener('input', () => {
      const clean = sanitizeName(name.value);
      if (clean !== name.value) name.value = clean;
      h.onChange({ name: clean });
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
      e.stopPropagation();
    });
    name.addEventListener('blur', () => {
      if (!name.value.trim()) h.onRandomName();
    });

    $('btnDice').addEventListener('click', () => h.onRandomName());
    $('btnTransform').addEventListener('click', () => h.onTransform());
    $('btnSound').addEventListener('click', () => h.onToggleSound());
    $('btnCapture').addEventListener('click', () => h.onCapture());
    $('btnShare').addEventListener('click', () => h.onShare());
    $('btnHide').addEventListener('click', () => this.toggleHidden());
    $('btnPanel').addEventListener('click', () => $('panel').classList.toggle('open'));

    const scrub = $<HTMLInputElement>('scrub');
    scrub.addEventListener('pointerdown', () => {
      this.scrubbing = true;
      h.onScrubStart();
    });
    scrub.addEventListener('input', () => h.onScrub(+scrub.value / 1000));
    const end = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      h.onScrubEnd();
    };
    scrub.addEventListener('pointerup', end);
    scrub.addEventListener('change', end);
    scrub.addEventListener('keydown', (e) => e.stopPropagation());
  }

  toggleHidden() {
    $('hud').classList.toggle('hidden-ui');
    if ($('hud').classList.contains('hidden-ui')) this.toast('Interface hidden · press H');
  }

  show() {
    $('hud').classList.add('on');
  }

  setConfig(cfg: Config) {
    this.cfg = cfg;
    const mark = (id: string, attr: string, val: string) => {
      $(id)
        .querySelectorAll<HTMLElement>(`[data-${attr}]`)
        .forEach((el) => el.classList.toggle('active', el.dataset[attr] === val));
    };
    mark('chassis', 'v', cfg.vehicle);
    mark('paints', 'paint', cfg.paint);
    mark('finishes', 'finish', cfg.finish);
    mark('energies', 'energy', cfg.energy);
    mark('loadouts', 'loadout', cfg.loadout);
    mark('insignias', 'insignia', cfg.insignia);
    mark('speeds', 'speed', cfg.speed);
    const name = $<HTMLInputElement>('nameInput');
    if (document.activeElement !== name) name.value = cfg.name;
    $<HTMLInputElement>('customPaint').value = cfg.paint;
    $('paintName').textContent = PAINTS.find((p) => p.hex === cfg.paint)?.name ?? cfg.paint.toUpperCase();
    $('energyName').textContent = ENERGIES.find((p) => p.hex === cfg.energy)?.name ?? '';

    const rgb = hexToRgb(cfg.energy);
    document.documentElement.style.setProperty('--accent', cfg.energy);
    document.documentElement.style.setProperty('--accent-rgb', rgb.join(', '));

    this.renderDossier();
  }

  renderDossier(height?: number) {
    const cfg = this.cfg;
    const spec = VEHICLES[cfg.vehicle];
    const cls = CLASSES[spec.robotClass];
    const lo = LOADOUTS[cfg.loadout];
    const sn = serial(cfg, cls.code);
    $('serialTop').textContent = sn;
    $('dName').textContent = cfg.name || '—';
    $('dClass').textContent = `${cls.name}-class · ${cls.role}`;
    const h = height ?? this.lastHeight;
    this.lastHeight = h;
    $('dMeta').innerHTML = `<span>SN <b>${sn}</b></span><span>HEIGHT <b>${h.toFixed(1)} M</b></span><span>MASS <b>${cls.mass.toFixed(1)} T</b></span><span>ALT <b>${spec.label.toUpperCase()}</b></span>`;
    const stats = { ...cls.stats };
    for (const [k, v] of Object.entries(lo.mod)) stats[k as keyof typeof stats] = Math.min(99, stats[k as keyof typeof stats] + (v ?? 0));
    $('dStats').innerHTML = (Object.keys(stats) as (keyof typeof stats)[])
      .map((k) => `<div class="stat"><span>${k}</span><div class="stat-bar"><i style="width:${stats[k]}%"></i></div><b>${stats[k]}</b></div>`)
      .join('');
    const allegiance = cfg.insignia === 'none' ? 'Unaligned.' : cfg.insignia === 'vanguard' ? 'Sworn to the Vanguard.' : 'Flies the Reaver mark.';
    $('dBio').textContent = `${cfg.name || 'This unit'} ${cls.bio} ${lo.line} ${allegiance}`;
  }
  private lastHeight = 5.6;

  setMode(text: string, pct: string, busy: boolean) {
    $('modeText').textContent = text;
    $('modePct').textContent = pct;
    $('modeDot').classList.toggle('busy', busy);
  }

  setProgress(p: number) {
    const s = $<HTMLInputElement>('scrub');
    if (!this.scrubbing) s.value = String(Math.round(p * 1000));
    s.style.setProperty('--p', `${(p * 100).toFixed(1)}%`);
  }

  setTransformLabel(label: string, disabled = false) {
    $('transformLabel').textContent = label;
    $<HTMLButtonElement>('btnTransform').disabled = disabled;
  }

  lock(locked: boolean) {
    $('panel').classList.toggle('locked', locked);
  }

  setMuted(m: boolean) {
    $('btnSound').classList.toggle('muted', m);
  }

  toast(msg: string) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 1800);
  }

  introProgress(p: number) {
    ($('introProgress') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
  }

  introReady(onEnter: () => void) {
    const b = $<HTMLButtonElement>('btnEnter');
    b.disabled = false;
    b.querySelector('.primary-label')!.textContent = 'Enter the bay';
    b.addEventListener('click', onEnter, { once: true });
    b.focus();
  }

  hideIntro() {
    $('intro').classList.add('gone');
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
