/** 화면 공통 도구: 화면 틀 만들기, 이동, 상단 바, 글자 이스케이프 */
import { ITEMS, type ItemKey } from '../data/items';
import type { GearStats } from '../data/gear';
import { HEROES, type HeroKey } from '../data/heroes';
import type { RosterEntry } from '../engine';
import type { BattleResult } from '../game/settle';
import { TUT, type CoachKey } from '../game/tutorial';
import { G, heroNow } from '../game/state';
import { betterSlots, talentsLeft } from '../game/charinfo';
import { xpToNext } from '../data/progression';
import { classEmblem, gameIcon, uiIcon } from './art';

export const $ = (id: string) => document.getElementById(id)!;

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** 받침 있으면 a, 없으면 b */
export const josa = (w: string, a: string, b: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };

export const ROLE: Record<string, { name: string; short: string; color: string }> = {
  tank: { name: '탱커', short: '탱', color: '#9AA3B5' },
  melee: { name: '근접', short: '근', color: '#C2905E' },
  ranged: { name: '원거리', short: '원', color: '#6FA9B8' },
  healer: { name: '나', short: '나', color: '#F1E4C8' },
};

// ---------- 화면 이동 ----------
export type TabKey = 'lobby' | 'battle' | 'char' | 'guild' | 'shop';

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
/** 위 줄 재화 그림 (30 3장 icon-gold · icon-crystal이 오면 그 그림) */
const COIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#E8B23A" stroke="#7A5418" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="#B9831F" stroke-width="1.6"/></svg>';
const GEM_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l3 5-9 11L3 9z" fill="#7FC8FF" stroke="#1E4A7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 9h18M9 4l3 16 3-16" fill="none" stroke="#1E4A7A" stroke-width="1.2"/></svg>';
const GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="6.6"/><path d="M12 2.5v2.9M12 18.6v2.9M2.5 12h2.9M18.6 12h2.9M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2"/></svg>';

/**
 * 상단 바. back이 있으면 「← 제목」 줄, 없으면 MMO 캐릭터 칸 (30 0장 공통 위 줄, 시안 Lobby30 .hud):
 * 금테 원 직업 문장 + 진홍 Lv 띠 + 알림 빨간 점 (특성 남음·더 좋은 장비) → 캐릭터 탭 · 직업 이름 + 경험치 막대 · 골드·크리스탈 · 설정.
 * 캐릭터 칸은 탭 루트(settings)에서만 누름. 튜토리얼 중 캐릭터 탭이 잠겼으면(첫 장비 전) 누르지 않음.
 */
export function topBar(opts: { back?: string; title?: string; settings?: boolean } = {}): string {
  const s = G.save, p = s.player;
  const set = opts.settings ? `<button class="tb-set" type="button" data-go="s-settings" aria-label="설정"><span class="tb-ring2">${GEAR_SVG}</span></button>` : '';
  if (opts.back) {
    return `<header class="topbar"><button class="tb-back" type="button" data-go="${opts.back}" aria-label="뒤로">←</button><b class="tb-title">${esc(opts.title || '')}</b><span class="tb-gold" aria-label="골드">${uiIcon('coin')} <b>${fmt(p.gold)}</b></span>${set}</header>`;
  }
  const need = xpToNext(p.level);
  const pct = isFinite(need) ? Math.min(100, (p.xp / need) * 100) : 100;
  const tutDone = s.tut >= TUT.done;
  const left = tutDone ? talentsLeft() : 0, better = tutDone ? betterSlots().length : 0;
  const charOk = tutDone || s.gear.bag.length > 0 || Object.keys(s.gear.equipped).length > 0;
  const hero = HEROES[heroNow()];
  const note = [left ? `특성 ${left} 남음` : '', better ? `더 좋은 장비 ${better}` : ''].filter(Boolean).join(' · ');
  const pfIn = `<span class="tb-em">${classEmblem(heroNow(), 'lg')}</span><span class="tb-lv"><b>${p.level}</b></span>${note ? '<i class="tb-dot"></i>' : ''}`;
  const pf = opts.settings && charOk
    ? `<button class="tb-pf" type="button" data-go="s-char"${better ? ' data-arg="gear"' : left ? ' data-arg="talent"' : ''} aria-label="캐릭터 · ${esc(hero.name)} Lv ${p.level}${note ? ` · ${note}` : ''}">${pfIn}</button>`
    : `<span class="tb-pf" role="img" aria-label="${esc(hero.name)} Lv ${p.level}">${pfIn}</span>`;
  return `<header class="topbar tb-mmo">${pf}
    <span class="tb-nm"><b class="tb-cls">${esc(hero.name)}</b><span class="tb-xp" title="경험치 ${fmt(p.xp)} / ${isFinite(need) ? fmt(need) : '최대'}"><i style="width:${pct.toFixed(1)}%"></i></span><small class="tb-xpt" aria-hidden="true" data-pct="${Math.floor(pct)}"></small></span>
    <span class="tb-wal"><span class="tb-cur tb-gold" aria-label="골드">${gameIcon('gold', COIN_SVG)}<b>${fmt(p.gold)}</b></span><span class="tb-cur tb-cr" aria-label="크리스탈">${gameIcon('crystal', GEM_SVG)}<b>${fmt(s.wallet.crystal)}</b></span></span>
    ${set}</header>`;
}

/** [data-go] 버튼 = 그 화면으로 */
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (b && b.closest('#app')) go(b.dataset.go!, b.dataset.arg);
});

/** 단축칸 고르기 칩 (편성·캐릭터): 튜토리얼 뒤엔 가방 개수 (19 11장) */
export function itemChipsHtml(items: ItemKey[]): string {
  const stock = G.save.tut >= 3 ? G.save.bag : null;
  return `<div class="chips items">${(Object.keys(ITEMS) as ItemKey[]).map(k => {
    const n = stock ? stock[k] || 0 : null;
    return `<button class="chip ichip${n === 0 ? ' empty' : ''}" type="button" data-item="${k}" aria-pressed="${items.includes(k)}">${battle().itemIcon(k)}${ITEMS[k].name}${n != null ? ` <small>×${n}</small>` : ''}</button>`;
  }).join('')}</div>`;
}

// ---------- 전투 화면 입구 (battle/index.ts가 window.__battle로 엶) ----------
export interface BattleApi {
  start(o: {
    content: string; name: string; segs: string[]; diff: string; /** 힐러 레벨 (스킬 해금) */ level: number; /** 실제 레벨 (힐량·체력) */ heroLv: number; /** 단계 레벨 */ stageLv: number; gearStats: GearStats; party: RosterEntry[];
    items: ItemKey[]; slots: number; seed: number; onEnd(r: BattleResult): void;
    /** 튜토리얼 안내 묶음 (02 11장) */
    coach?: CoachKey | null;
    /** 힐러 직업 (25) */
    hero?: HeroKey;
    /** 사제 특성 (06 6장) */
    talents?: (number | null)[];
    /** 가방에 있는 소비 아이템 (19 11장) */
    stock?: Partial<Record<ItemKey, number>>;
    /** 어픽스·보스 배율·제한시간 (32 난이도 어픽스, 13 3-2 주간 도전) */
    affixes?: string[]; bossMult?: { hp: number; dmg: number }; limit?: number; chal?: number;
  }): void;
  /** 진 구간부터 다시 (광고 이어하기, 15). 마나는 그 구간 시작 때로 */
  resume(): void;
  settings(s: object): void;
  /** 전투 화면에서 바꾼 설정 (일시정지의 자동 치유) → 저장 */
  onSetting: ((key: string, val: unknown) => void) | null;
  /** 전투 전 공략. 단계 레벨을 주면 그 레벨 숫자로 */
  guide(encKey: string, diff: string, stageLv?: number, heroLv?: number): string;
  bossSvg(script: string, key?: string): string;
  itemIcon(k: string): string;
  itemHint(script: string): string;
  layout: {
    GRID: (string | null)[]; ARROW: Record<string, string>; READ_ORDER: string[]; DEFAULT_LAYOUT: Record<string, string | null>;
    LAYOUT_SKILLS: string[]; valid(v: unknown): boolean; label(k: string): string; text(l: Record<string, string | null>): string;
  };
  tapKeys: Record<string, string>;
  /** 그 직업의 칸 탭 후보 (스킬 이름 + 시전) */
  tapKeysOf(hero: string): Record<string, string>;
  sound(k: string): void;
}
export const battle = () => (window as unknown as { __battle: BattleApi }).__battle;
