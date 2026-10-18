/**
 * 전투 화면 공용: 상수·설정·화면 상태·소리·진동·알림.
 * 프로토타입 v11 전투 화면을 TypeScript로 옮긴 것. 판 그리기는 board.ts(PixiJS).
 */
import type { CoachKey } from '../game/tutorial';
import type { GearStats } from '../data/gear';
import type { TalentKey } from '../data/talents';
import type { AffixKey } from '../data/affixes';
import { DEB_COLOR, HEROES, type HeroKey } from '../data/heroes';
import { SKILLS, type SkillKey } from '../data/skills';
import { knows, SLOT_OF, type Fight, type RosterEntry, type Role } from '../engine';
import { castText } from '../game/tooltip';
import type { MeterRow } from '../game/meter';
import type { BattleResult } from '../game/settle';

export const $ = (id: string) => document.getElementById(id)!;

export const ROLE: Record<Role, { name: string; color: string }> = {
  tank: { name: '탱커', color: '#9AA3B5' },
  melee: { name: '근접', color: '#C2905E' },
  ranged: { name: '원거리', color: '#6FA9B8' },
  healer: { name: '나', color: '#F1E4C8' },
};
export const DEB = DEB_COLOR;
export const ICON_COLOR: Record<string, string> = { '숨결': '#D9A13B', '독침': '#3CC24A', '전염': '#D9A13B', '찍기': '#FF6B57', '증기': '#FF9F43', '파동': '#FF9F43', '장판': '#E0664F', '쥐떼': '#B9A38A', '폭풍': '#E0664F', '광폭': '#FF4A3D', '휘두': '#FF6B57', '쇳조': '#FF9F43', '노래': '#8E86C9', '크레': '#B07CE8', '지휘': '#FF6B57', '포르': '#FF9F43', '독창': '#3D8BFF' };
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
export const layoutLabel = (k: string) => (k === 'heal' ? '치유/평온' : SKILLS[k as SkillKey].name);
export const layoutText = (l: Record<string, string | null>) => READ_ORDER.filter(d => l[d]).map(d => `${ARROW[d]} ${layoutLabel(l[d]!)}`).join(' · ');
export const layoutCode = (l: Layout) => READ_ORDER.map(d => `${d}:${l[d] || '-'}`).join(',');

/** key = 휠 칸 이름 (사제 스킬 이름 그대로, 8번째 칸은 unique). 실제 스킬은 engine slotKey */
export interface DirSlot { d: Dir; arrow: string; key: string | null }
export let DIRS: (DirSlot | null)[] = [];
/** 배치의 빈 방향 = 8번째 칸 (사제 빛의 전이 · 드루이드 환생 · 성기사 보호의 손, 25 2장) */
export function applyLayout(): void {
  const uniq = HEROES[S.hero].slots.unique ? 'unique' : null;
  DIRS = GRID.map(d => (d ? { d, arrow: ARROW[d], key: S.layout[d] || uniq } : null));
}
/** 지금 직업에서 그 칸의 스킬 (사제는 칸 이름 그대로, 성언으로 바뀌지 않음. 8번째 칸은 직업마다) */
export function heroSkill(slot: string): SkillKey {
  if (S.hero === 'priest' && slot !== 'unique') return slot as SkillKey;
  return HEROES[S.hero].slots[SLOT_OF[slot]] || (slot as SkillKey);
}
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

/** 칸 탭 기본 힐 후보 = 기본·빠른·지속 힐 칸 */
export const TAP_KEYS: Record<string, string> = { heal: '치유 (1.8초 시전)', flash: '순간 치유 (1초 시전)', renew: '소생 (즉시, 지속 힐)' };
/** 그 직업의 칸 탭 후보 설명 (스킬 이름 + 시전) */
export function tapKeysOf(hero: HeroKey): Record<string, string> {
  const o: Record<string, string> = {};
  for (const slot of Object.keys(TAP_KEYS)) { const k = HEROES[hero].slots[SLOT_OF[slot]]; if (k && SKILLS[k].target === 'ally') o[slot] = `${SKILLS[k].name} (${castText(k)})`; } // 아군에게 거는 스킬만 (2026-10-16: 주술사 · 결계사 빠른 힐 칸이 샘 토템 · 심판)
  return o;
}

// ---------- 설정·한 판 (새 화면이 start()/settings()로 넣어 줌) ----------
export interface StartOptions {
  content: string; name: string; segs: string[]; diff: string;
  /** 힐러 레벨 (스킬 해금) */ level: number;
  /** 실제 레벨 (힐량·체력) */ heroLv?: number;
  /** 단계 레벨 */ stageLv?: number;
  gearStats?: GearStats; party: RosterEntry[]; seed?: number | null;
  onEnd?(r: BattleResult): void;
  /** 튜토리얼 안내 묶음 (02 11장) */
  coach?: CoachKey | null;
  /** 힐러 직업 (25) */
  hero?: HeroKey;
  /** 사제 특성: 단마다 고른 칸 (06 6장) */
  talents?: (number | null)[];
  /** 착용 장비 특수능력 값 (42). 없으면 특수능력 없음 */
  specs?: Record<string, number>;
  /** 어픽스 (07 3장, 13 3-3) */
  affixes?: AffixKey[];
  /** 보스·적 배율 (주간 도전 단계) */
  bossMult?: { hp: number; dmg: number };
  /** 제한시간 (초, 주간 도전). 휴식 뺀 전투 시간 합 */
  limit?: number;
  /** 주간 도전 단계 (결과에 그대로) */
  chal?: number;
}

export interface Run {
  content: string; name: string; segs: string[]; seed0: number | null; coachDone: Set<number>;
  idx: number; carry: { mana: number; g: { p: number } } | null; time: number; deaths: number; restSec: number;
  healed: number; overheal: number; dispels: number; dispellable: number; auto: boolean;
  meter: MeterRow[];
  /** 광고 이어하기 횟수 (등급 최대 B) */
  cont: number;
  /** 인연 (93 3-2): 파티원마다 구간 합 받은 내 치유 · 가장 낮았던 체력 · 생명의 은인 (위험선 아래에서 내 힐을 받고 그 구간 끝까지 삶) */
  bond?: Record<string, { got: number; low: number; rescued: boolean; did?: { dodge: number; move: number; cut: number; buster: number; adds: number }; dealt: number }>;
}

export const S = {
  diff: '보통', gearStats: null as GearStats | null, level: 100, heroLv: undefined as number | undefined, stageLv: undefined as number | undefined,
  party: null as RosterEntry[] | null,
  sound: true, vibe: true, auto: false, tapKey: 'heal' as string, hand: 'right', zoom: true, compactSkills: true, reducedEffects: false, hero: 'priest' as HeroKey, talents: undefined as (number | null)[] | undefined, specs: undefined as Record<string, number> | undefined,
  affixes: undefined as AffixKey[] | undefined, bossMult: undefined as { hp: number; dmg: number } | undefined, limit: undefined as number | undefined, chal: 0,
  layout: { ...DEFAULT_LAYOUT } as Layout,
  run: null as Run | null, onEnd: null as ((r: BattleResult) => void) | null, coach: null as CoachKey | null,
  onSetting: null as ((key: string, val: unknown) => void) | null,
};
applyLayout();

/** 지금 전투와 입력 상태 */
export const B = {
  F: null as Fight | null,
  /** 휠에서 장전한 칸 (짧게 누르기) */
  armed: null as string | null,
  paused: false,
  overShown: false,
  /** 성기사 봉화: 휠 가운데를 누르고 칸 탭 (25 3장) */
  beacon: false,
  /** 가운데 스킬을 칸에 (주술사 샘 토템, 79 2-3): 휠 가운데를 누르고 칸 탭 */
  coreCell: false,
};

export interface Pointer { id?: number; x0: number; y0: number; x: number; y: number; idx: number; lp: boolean; moved: boolean; dir?: Dir | null; timer?: ReturnType<typeof setTimeout> }
export interface Coach { uid: number | null; freeze: boolean; until: number; need?: string; slot?: SkillKey; swipe?: SkillKey }

/** 화면 상태 (한 판마다 초기화) */
export const ui = {
  selectedUnitId: null as number | null,
  pointer: null as Pointer | null, lastHealSnd: 0, tickSec: null as number | null, lowFlags: {} as Record<number, boolean>, lastLowVibe: 0, qAt: 0,
  vibeAt: 0, vibedTel: new Set<number>(), lastHeart: 0, debSnd: {} as Record<string, number>, tapOff: [] as number[], lastTap: null as { idx: number; t: number } | null, retarget: 0,
  touchSeen: false, pullLeft: 0, pullShown: null as number | null, guideSec: 0, skillTips: 0, busterHint: false,
  swipes: {} as Record<string, number>, swipeCancel: 0, swipeEmpty: 0,
  coach: null as Coach | null,
  /** 쉼터 장전 중 (빈 칸 탭) */
  talArmed: null as TalentKey | null,
  /** 떠 있는 설명 팝업: 예고 칸 (ic · imp) · 스킬 · 특성. held = 길게 눌러 연 팝업 (손을 뗄 때까지 유지) */
  tip: null as { ic?: string; imp?: number; skill?: SkillKey; tal?: TalentKey; held?: boolean } | null, tipTimer: 0 as unknown as ReturnType<typeof setTimeout>,
  restAt: 0, restMana: null as number | null, lastResult: null as BattleResult | null,
};

/** 칸 탭 기본 힐: 아직 안 배운 스킬로 정해 뒀으면 기본 힐 (06 7장). 칸 이름 → 지금 직업의 스킬 */
export function tapKey(): SkillKey {
  const k = heroSkill(S.tapKey);
  return (B.F && !knows(B.F, k)) || SKILLS[k].target !== 'ally' ? heroSkill('heal') : k;
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
      case 'chime': [1320, 2640, 1980].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.05 / (i + 1))); break;
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

// ---------- 전투 메시지 ----------
// 2026-10-11 Lim 「너무 빨리 없어지고 20인에서 파티원을 가린다」 → 판 위가 아니라 시전 막대 자리 안 (#castbar 안 #toast).
// 한 번에 하나씩 차례로: 맨 앞(첫 자식)이 보이고 뒤는 기다림. 보이는 시간 = 3.6초 + 긴 글은 글자마다 조금 더 (최대 7초),
// 뒤에 기다리는 메시지가 있으면 적어도 NOTE_MIN만 보이고 다음으로. 같은 글이 또 오면 줄 세우지 않고 시간만 새로.
// kind: bad = 파티원이 쓰러짐 같은 나쁜 소식 (붉게) · good = 보스 처치 · 성언 준비 (금빛)
const NOTE_MIN = 1400, NOTE_WAIT = 3;
let noteTimer: ReturnType<typeof setTimeout> | undefined, noteAt = 0;
const noteLife = (text: string) => Math.min(7000, 3600 + Math.max(0, text.length - 16) * 90);
function showNote(): void {
  const box = $('toast'), el = box.firstElementChild as HTMLElement | null;
  clearTimeout(noteTimer);
  if (alarmOn) return; // 붉은 경고가 떠 있는 동안 메시지는 기다림 (꺼지면 이어서)
  $('castbar').classList.toggle('has-msg', !!el);
  if (!el) return;
  if (!el.classList.contains('on')) { el.classList.add('on'); noteAt = performance.now(); }
  noteTimer = setTimeout(nextNote, box.children.length > 1 ? Math.max(0, NOTE_MIN - (performance.now() - noteAt)) : noteLife(el.textContent || ''));
}
function nextNote(): void { $('toast').firstElementChild?.remove(); showNote(); }
export function toast(text: string, kind?: 'bad' | 'good'): void {
  const box = $('toast'), last = box.lastElementChild as HTMLElement | null;
  if (last && last.textContent === text) { if (last === box.firstElementChild) { noteAt = performance.now(); showNote(); } return; }
  const el = document.createElement('div'); el.className = `toast${kind ? ` ${kind}` : ''}`; el.title = text;
  const t = document.createElement('span'); t.textContent = text; el.appendChild(t);
  box.appendChild(el);
  while (box.children.length > NOTE_WAIT + 1) box.children[1].remove(); // 오래 기다린 것부터 버림 (지금 보이는 것은 그대로)
  showNote();
}
/** 전투를 새로 시작할 때 */
export function clearToasts(): void { clearTimeout(noteTimer); $('toast').innerHTML = ''; $('castbar').classList.remove('has-msg'); alarm(null); }

/**
 * 붉은 경고 (위치 규칙 · 탱커 앞줄 이탈, 2026-10-13 Lim 「어그로라는 말을 모를 수 있으니 쉬운 말로」): 상황이 이어지는 동안 메시지 자리를 차지함.
 * 다른 메시지는 뒤에서 기다렸다가 꺼지면 이어서. 처음 켜질 때만 짧게 진동
 */
let alarmOn = '';
export function alarm(a: { title: string; text: string } | null): void {
  const key = a ? `${a.title}|${a.text}` : '';
  if (key === alarmOn) return;
  const was = !!alarmOn, el = $('alarm');
  alarmOn = key;
  el.hidden = !a;
  $('castbar').classList.toggle('has-alarm', !!a);
  if (a) {
    el.querySelector('b')!.textContent = a.title;
    el.querySelector('span')!.textContent = a.text;
    if (!was) vibe([30, 50, 30]);
  } else { noteAt = performance.now(); showNote(); }
}
let bannerTimer: ReturnType<typeof setTimeout> | undefined;
/** 큰 알림이 한 줄에 안 들어갈 때 줄일 글자 크기 (px). 두 줄에 들어가는 가장 큰 크기, 끝까지 안 되면 마지막 크기로 세 줄 */
const BANNER_FIT = [22, 20, 18, 16];
/** 판 가운데 큰 알림 띠. tone = 색 (danger 붉게 · win 금빛 · lose 잿빛), sub = 아래 작은 줄 (글자 내용은 text만) */
export function banner(text: string, o: { tone?: 'danger' | 'win' | 'lose'; sub?: string } = {}): void {
  const b = $('banner');
  clearTimeout(bannerTimer);
  const main = document.createElement('span');
  // 「·」 「→」가 줄 맨 앞에 오지 않게 앞 칸을 붙는 공백으로 (줄은 그 뒤에서 바뀜)
  main.className = 'bn-main'; main.textContent = text.replace(/ ([·→])/g, '\u00A0$1');
  b.replaceChildren(main); b.dataset.tone = o.tone ?? ''; b.dataset.sub = o.sub ?? '';
  fitBanner(main);
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  // 효과를 끈 때도 경고를 정적으로 보여 주고 같은 수명 뒤 숨긴다.
  bannerTimer = setTimeout(() => b.classList.remove('show'), 2600);
}
/** 긴 알림 (보스 페이즈 설명 등)은 어절 단위로 줄을 바꾸고 (CSS), 한 줄에 안 들어가면 두 줄에 들어갈 때까지 글자를 줄임 */
function fitBanner(main: HTMLElement): void {
  const lines = () => {
    const cs = getComputedStyle(main);
    return Math.round(main.offsetHeight / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.12));
  };
  if (lines() <= 1) return; // 판이 안 보일 때 (0줄)도 그대로
  const base = parseFloat(getComputedStyle(main).fontSize);
  for (const px of BANNER_FIT) {
    if (px >= base) continue;
    main.style.fontSize = `${px}px`;
    if (lines() <= 2) return;
  }
}

/** 새 화면(.screen)이 늘어나도 하나만 보이게 */
export function show(id: string): void {
  document.querySelectorAll<HTMLElement>('#app > .screen').forEach(s => { s.hidden = s.id !== id; });
  // focus/scrollIntoView가 남긴 상위 offset이 다음 화면을 광고 뒤로 밀지 않게 함.
  $('app').scrollTop = 0; $('app').scrollLeft = 0;
  $('viewport').scrollTop = 0; $('viewport').scrollLeft = 0;
}
