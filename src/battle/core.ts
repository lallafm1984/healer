/**
 * 전투 화면 공용: 상수·설정·화면 상태·소리·진동·알림.
 * 프로토타입 v11 전투 화면을 TypeScript로 옮긴 것. 판 그리기는 board.ts(PixiJS).
 */
import type { CoachKey } from '../game/tutorial';
import type { GearStats } from '../data/gear';
import type { ItemKey } from '../data/items';
import { SKILLS, type SkillKey } from '../data/skills';
import { knows, type Fight, type RosterEntry, type Role } from '../engine';
import type { MeterRow } from '../game/meter';
import type { BattleResult } from '../game/settle';

export const $ = (id: string) => document.getElementById(id)!;

export const ROLE: Record<Role, { name: string; color: string }> = {
  tank: { name: '탱커', color: '#8A97AD' },
  melee: { name: '근접', color: '#AE8A76' },
  ranged: { name: '원거리', color: '#7FA3A0' },
  healer: { name: '나', color: '#E9E1C6' },
};
export const DEB: Record<string, string> = { '질병': '#D9A13B', '독': '#3CC24A', '마법': '#3D8BFF', '저주': '#A050E0' };
export const ICON_COLOR: Record<string, string> = { '숨결': '#D9A13B', '독침': '#3CC24A', '전염': '#D9A13B', '찍기': '#FF6B57', '증기': '#FF9F43', '파동': '#FF9F43', '장판': '#E0664F', '쥐떼': '#B9A38A', '폭풍': '#E0664F', '광폭': '#FF4A3D', '휘두': '#FF6B57', '쇳조': '#FF9F43' };
/** 시전 대상·장전 표시 (황토색 질병과 구분) */
export const SEL = '#FFFFFF';

// ---------- 8방향 스킬 배치 (2026-10-07 Lim): 칸에서 이 방향으로 쓸면 그 스킬. 캐릭터 탭에서 바꿈 ----------
export type Dir = 'NW' | 'N' | 'NE' | 'W' | 'E' | 'SW' | 'S' | 'SE';
export type Layout = Record<Dir, SkillKey | null>;
export const GRID: (Dir | null)[] = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
export const ARROW: Record<Dir, string> = { NW: '↖', N: '↑', NE: '↗', W: '←', E: '→', SW: '↙', S: '↓', SE: '↘' };
export const READ_ORDER: Dir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const LAYOUT_SKILLS: SkillKey[] = ['heal', 'flash', 'renew', 'poh', 'purify', 'guardian', 'hymn'];
export const DEFAULT_LAYOUT: Layout = { NW: null, N: 'purify', NE: 'heal', W: 'renew', E: 'flash', SW: 'hymn', S: 'poh', SE: 'guardian' };
/** 칸 가운데에서 쓸 방향 (화면 좌표, 아래가 +y) */
export const DIR_VEC: Record<Dir, [number, number]> = { N: [0, -1], NE: [0.71, -0.71], E: [1, 0], SE: [0.71, 0.71], S: [0, 1], SW: [-0.71, 0.71], W: [-1, 0], NW: [-0.71, -0.71] };
export const DIR_DEG: Record<Dir, number> = { E: 0, NE: 45, N: 90, NW: 135, W: 180, SW: 225, S: 270, SE: 315 };

export function validLayout(v: unknown): v is Layout {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const keys = READ_ORDER.map(d => (o[d] as string) || null);
  return LAYOUT_SKILLS.every(k => keys.filter(x => x === k).length === 1) && keys.every(k => k === null || (LAYOUT_SKILLS as string[]).includes(k));
}
export const layoutLabel = (k: string) => (k === 'heal' ? '치유/평온' : k === 'poh' ? '기원/신성화' : SKILLS[k as SkillKey].name);
export const layoutText = (l: Record<string, string | null>) => READ_ORDER.filter(d => l[d]).map(d => `${ARROW[d]} ${layoutLabel(l[d]!)}`).join(' · ');
export const layoutCode = (l: Layout) => READ_ORDER.map(d => `${d}:${l[d] || '-'}`).join(',');

export interface DirSlot { d: Dir; arrow: string; key: SkillKey | null }
export let DIRS: (DirSlot | null)[] = [];
export function applyLayout(): void { DIRS = GRID.map(d => (d ? { d, arrow: ARROW[d], key: S.layout[d] || null } : null)); }
export const dirSlot = (d: Dir) => DIRS.find(x => x && x.d === d) || null;
/** 지금 휠 배치에서 그 스킬이 있는 방향 (칸에서 쓸 방향) */
export const arrowOf = (k: SkillKey) => { const d = DIRS.find(x => x && x.key === k); return d ? d.arrow : ''; };
const SECTOR: Dir[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
const SWIPE_MIN = 26;
export function swipeDir(dx: number, dy: number): Dir | null {
  if (Math.hypot(dx, dy) < SWIPE_MIN) return null;
  const a = (Math.atan2(-dy, dx) * 180) / Math.PI;
  return SECTOR[((Math.round(a / 45) % 8) + 8) % 8];
}

export const TAP_KEYS: Record<string, string> = { heal: '치유 (1.8초 시전)', flash: '순간 치유 (1초 시전)', renew: '소생 (즉시, 지속 힐)' };

// ---------- 설정·한 판 (새 화면이 start()/settings()로 넣어 줌) ----------
export interface StartOptions {
  content: string; name: string; segs: string[]; diff: string;
  /** 힐러 레벨 (스킬 해금) */ level: number;
  /** 실제 레벨 (힐량·체력) */ heroLv?: number;
  /** 단계 레벨 */ stageLv?: number;
  gearStats?: GearStats; party: RosterEntry[]; items?: ItemKey[]; slots?: number; seed?: number | null;
  onEnd?(r: BattleResult): void;
  /** 튜토리얼 안내 묶음 (02 11장) */
  coach?: CoachKey | null;
}

export interface Run {
  content: string; name: string; segs: string[]; seed0: number | null; coachDone: Set<number>;
  idx: number; carry: { mana: number; g: { p: number; s: number } } | null; time: number; deaths: number; restSec: number;
  healed: number; overheal: number; dispels: number; dispellable: number; itemLog: { key: ItemKey; t: number }[]; auto: boolean;
  meter: MeterRow[];
}

export const S = {
  diff: '보통', gearStats: null as GearStats | null, level: 100, heroLv: undefined as number | undefined, stageLv: undefined as number | undefined,
  party: null as RosterEntry[] | null, items: [] as ItemKey[], slots: 4,
  sound: true, vibe: true, auto: false, tapKey: 'heal' as SkillKey, hand: 'right', zoom: true,
  layout: { ...DEFAULT_LAYOUT } as Layout,
  run: null as Run | null, onEnd: null as ((r: BattleResult) => void) | null, coach: null as CoachKey | null,
  onSetting: null as ((key: string, val: unknown) => void) | null,
};
applyLayout();

/** 지금 전투와 입력 상태 */
export const B = {
  F: null as Fight | null,
  /** 휠에서 장전한 칸 (짧게 누르기) */
  armed: null as SkillKey | null,
  paused: false,
  overShown: false,
};

export interface Pointer { x0: number; y0: number; x: number; y: number; idx: number; lp: boolean; moved: boolean; dir?: Dir | null; timer?: ReturnType<typeof setTimeout> }
export interface Coach { uid: number | null; freeze: boolean; until: number; need?: string; slot?: SkillKey; swipe?: SkillKey }

/** 화면 상태 (한 판마다 초기화) */
export const ui = {
  pointer: null as Pointer | null, lastHealSnd: 0, tickSec: null as number | null, lowFlags: {} as Record<number, boolean>, lastLowVibe: 0, qAt: 0,
  vibeAt: 0, vibedTel: new Set<number>(), lastHeart: 0, debSnd: {} as Record<string, number>, tapOff: [] as number[], lastTap: null as { idx: number; t: number } | null, retarget: 0,
  touchSeen: false, pullLeft: 0, pullShown: null as number | null, guideSec: 0, skillTips: 0, itemTips: 0, busterHint: false,
  swipes: {} as Record<string, number>, swipeCancel: 0, swipeEmpty: 0,
  itemArmed: null as ItemKey | null, coach: null as Coach | null,
  tip: null as { ic?: string; imp?: number; skill?: SkillKey; item?: ItemKey } | null, tipTimer: 0 as unknown as ReturnType<typeof setTimeout>,
  restAt: 0, restMana: null as number | null, lastResult: null as BattleResult | null,
};

/** 칸 탭 기본 힐: 아직 안 배운 스킬로 정해 뒀으면 치유 (06 7장) */
export function tapKey(): SkillKey {
  return B.F && !knows(B.F, S.tapKey) ? 'heal' : S.tapKey;
}

// ---------- 글자 ----------
export const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
export const secT = (x: number) => `${+x.toFixed(1)}초`;
/** 받침 있으면 a(이), 없으면 b(가) */
export const josa = (w: string, a: string, b: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };
export const iga = (w: string) => w + josa(w, '이', '가');

// ---------- 소리 (아트·사운드 가이드 16, 7장) ----------
type AC = AudioContext;
export const Snd = {
  ctx: null as AC | null,
  init() {
    try {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      if (!this.ctx) this.ctx = new (W.AudioContext || W.webkitAudioContext)!();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { this.ctx = null; }
  },
  tone(freq: number, dur: number, type?: OscillatorType, vol?: number, slide?: number, delay?: number) {
    if (!S.sound || !this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.03);
  },
  play(n: string) {
    switch (n) {
      case 'heal': this.tone([784, 880, 988, 1047][(Math.random() * 4) | 0], 0.14, 'sine', 0.05); break;
      case 'crit': this.tone(1047, 0.22, 'sine', 0.05); this.tone(1319, 0.22, 'sine', 0.04, 0, 0.03); break;
      case 'renew': this.tone(660, 0.18, 'triangle', 0.04, 990); break;
      case 'dispel': this.tone(1568, 0.12, 'triangle', 0.05); this.tone(2093, 0.1, 'sine', 0.03, 0, 0.05); break;
      case 'bell': [1320, 2640, 1980].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.05 / (i + 1))); break;
      case 'buster': this.tone(110, 0.35, 'sine', 0.14, 70); break;
      case 'aoe': this.tone(300, 0.6, 'sawtooth', 0.03, 900); break;
      case 'tick': this.tone(620, 0.05, 'square', 0.03); break;
      case 'death': this.tone(400, 0.45, 'triangle', 0.06, 140); break;
      case 'burst': this.tone(200, 0.25, 'sawtooth', 0.05, 80); break;
      case 'hymn': [523, 659, 784].forEach((f, i) => this.tone(f, 1.5, 'sine', 0.035, 0, i * 0.08)); break;
      case 'gauge': [1320, 1760].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.04, 0, i * 0.12)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.06, 0, i * 0.12)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.06, 0, i * 0.18)); break;
      case 'error': this.tone(180, 0.12, 'square', 0.03); break;
      case 'cast': this.tone(523, 0.08, 'sine', 0.025, 659); break;
      case 'zone': this.tone(70, 0.6, 'sine', 0.12, 55); this.tone(140, 0.4, 'triangle', 0.03, 90); break;
      case 'heart': this.tone(62, 0.12, 'sine', 0.13); this.tone(58, 0.14, 'sine', 0.1, 0, 0.18); break;
      case 'cough': this.tone(240, 0.07, 'sawtooth', 0.03, 150); this.tone(220, 0.07, 'sawtooth', 0.025, 140, 0.1); break;
      case 'bubble': [700, 900, 1150].forEach((f, i) => this.tone(f, 0.05, 'sine', 0.025, f * 1.4, i * 0.06)); break;
      case 'zap': this.tone(1800, 0.06, 'square', 0.02, 400); break;
      case 'potion': [420, 560, 760].forEach((f, i) => this.tone(f, 0.09, 'sine', 0.05, f * 1.3, i * 0.07)); break;
      case 'scroll': this.tone(900, 0.18, 'triangle', 0.03, 1800); this.tone(1568, 0.4, 'sine', 0.035, 0, 0.12); break;
    }
  },
};

export function vibe(ms: number | number[], important?: boolean): void {
  if (!S.vibe) return;
  const now = performance.now();
  if (!important && now - ui.vibeAt < 1000) return;
  ui.vibeAt = now;
  try { navigator.vibrate?.(ms); } catch { /* 지원 안 함 (iOS 사파리) */ }
}

// ---------- 알림 ----------
export function toast(text: string): void {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
  const box = $('toast'); box.appendChild(el);
  while (box.children.length > 2) box.firstChild!.remove();
  setTimeout(() => el.remove(), 2300);
}
export function banner(text: string): void { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

/** 새 화면(.screen)이 늘어나도 하나만 보이게 */
export function show(id: string): void { document.querySelectorAll<HTMLElement>('#app > .screen').forEach(s => { s.hidden = s.id !== id; }); }
