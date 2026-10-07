/** 화면 공통 도구: 화면 틀 만들기, 이동, 상단 바, 글자 이스케이프 */
import type { ItemKey } from '../data/items';
import type { GearStats } from '../data/gear';
import type { RosterEntry } from '../engine';
import type { BattleResult } from '../game/settle';
import type { CoachKey } from '../game/tutorial';
import { G } from '../game/state';
import { xpToNext } from '../data/progression';

export const $ = (id: string) => document.getElementById(id)!;

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** 받침 있으면 a, 없으면 b */
export const josa = (w: string, a: string, b: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };

export const ROLE: Record<string, { name: string; short: string; color: string }> = {
  tank: { name: '탱커', short: '탱', color: '#8A97AD' },
  melee: { name: '근접', short: '근', color: '#AE8A76' },
  ranged: { name: '원거리', short: '원', color: '#7FA3A0' },
  healer: { name: '나', short: '나', color: '#E9E1C6' },
};

// ---------- 화면 이동 ----------
export type TabKey = 'battle' | 'char' | 'guild' | 'shop';

export interface Screen {
  el: HTMLElement;
  /** 하단 탭을 보일 때 켜 둘 탭 */
  tab?: TabKey;
  enter?(arg?: unknown): void;
}

const screens = new Map<string, Screen>();
let onTabs: ((t: TabKey | undefined) => void) | null = null;
export let current = '';
/** 바로 전 화면 (설정에서 돌아갈 곳) */
export let previous = '';

/** <section class="screen"> 하나를 #app에 붙이고 등록 */
export function screen(id: string, label: string, def: Omit<Screen, 'el'> = {}): Screen {
  const el = document.createElement('section');
  el.id = id; el.className = 'screen ns'; el.hidden = true; el.setAttribute('aria-label', label);
  $('app').appendChild(el);
  const s = { el, ...def };
  screens.set(id, s);
  return s;
}

export function go(id: string, arg?: unknown): void {
  const s = screens.get(id);
  if (!s) throw new Error(`화면 없음: ${id}`);
  if (id !== current) previous = current;
  current = id;
  document.querySelectorAll<HTMLElement>('#app > .screen').forEach(x => { x.hidden = x.id !== id; });
  s.enter?.(arg);
  s.el.scrollTop = 0;
  onTabs?.(s.tab);
}

export function setTabsHandler(fn: (t: TabKey | undefined) => void): void { onTabs = fn; }

// ---------- 상단 바 (09 5장: 레벨·골드 고정, 전투 화면 제외) ----------
export function topBar(opts: { back?: string; title?: string; settings?: boolean } = {}): string {
  const p = G.save.player;
  const need = xpToNext(p.level);
  const pct = isFinite(need) ? Math.min(100, (p.xp / need) * 100) : 100;
  const left = opts.back
    ? `<button class="tb-back" type="button" data-go="${opts.back}" aria-label="뒤로">←</button><b class="tb-title">${esc(opts.title || '')}</b>`
    : `<span class="tb-lv">Lv <b>${p.level}</b></span><span class="tb-xp" title="경험치 ${fmt(p.xp)} / ${isFinite(need) ? fmt(need) : '최대'}"><i style="width:${pct}%"></i></span>`;
  return `<header class="topbar">${left}<span class="tb-gold" aria-label="골드">🪙 <b>${fmt(p.gold)}</b></span>${opts.settings ? '<button class="tb-set" type="button" data-go="s-settings" aria-label="설정">⚙</button>' : ''}</header>`;
}

/** [data-go] 버튼 = 그 화면으로 */
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (b && b.closest('#app')) go(b.dataset.go!);
});

// ---------- 전투 화면 입구 (battle/index.ts가 window.__battle로 엶) ----------
export interface BattleApi {
  start(o: {
    content: string; name: string; segs: string[]; diff: string; /** 힐러 레벨 (스킬 해금) */ level: number; /** 실제 레벨 (힐량·체력) */ heroLv: number; /** 단계 레벨 */ stageLv: number; gearStats: GearStats; party: RosterEntry[];
    items: ItemKey[]; slots: number; seed: number; onEnd(r: BattleResult): void;
    /** 튜토리얼 안내 묶음 (02 11장) */
    coach?: CoachKey | null;
  }): void;
  settings(s: object): void;
  /** 전투 화면에서 바꾼 설정 (일시정지의 자동 치유) → 저장 */
  onSetting: ((key: string, val: unknown) => void) | null;
  /** 전투 전 공략. 단계 레벨을 주면 그 레벨 숫자로 */
  guide(encKey: string, diff: string, stageLv?: number, heroLv?: number): string;
  bossSvg(script: string): string;
  itemIcon(k: string): string;
  itemHint(script: string): string;
  layout: {
    GRID: (string | null)[]; ARROW: Record<string, string>; READ_ORDER: string[]; DEFAULT_LAYOUT: Record<string, string | null>;
    LAYOUT_SKILLS: string[]; valid(v: unknown): boolean; label(k: string): string; text(l: Record<string, string | null>): string;
  };
  tapKeys: Record<string, string>;
  sound(k: string): void;
}
export const battle = () => (window as unknown as { __battle: BattleApi }).__battle;
