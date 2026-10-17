/** 화면 공통 도구: 화면 틀 만들기, 이동, 상단 바, 글자 이스케이프 */
import type { GearStats } from '../data/gear';
import { HEROES, type HeroKey } from '../data/heroes';
import type { RosterEntry } from '../engine';
import type { BattleResult } from '../game/settle';
import { TUT, type CoachKey } from '../game/tutorial';
import { G, heroNow, newGearCount } from '../game/state';
import { talentsLeft } from '../game/charinfo';
import { apexOf, xpToNext } from '../data/progression';
import { classEmblem, currencyIcon } from './art';
import { resourceBalance } from '../game/resources';
import { releaseSheetDialogs, resetShellScroll } from './dialog';
import { staminaCell } from './stamina';

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
  /** 다른 화면으로 이동하기 전에 실행합니다. */
  leave?(): void;
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
  if (id !== current) screens.get(current)?.leave?.();
  releaseSheetDialogs();
  if (id !== current) previous = current;
  current = id;
  document.querySelectorAll<HTMLElement>('#app > .screen').forEach(x => { x.hidden = x.id !== id; });
  s.enter?.(arg);
  s.el.scrollTop = 0;
  onTabs?.(s.tab);
  // overflow:hidden ancestors can still be scrolled by focus/scrollIntoView.
  // Only the active screen's inner list may scroll; never carry this offset to a new screen.
  resetShellScroll();
}

export function setTabsHandler(fn: (t: TabKey | undefined) => void): void { onTabs = fn; }
/** 화면은 그대로 두고 하단 탭 (빨간 점)만 다시 그림 */
export function refreshTabs(): void { if (current) onTabs?.(screens.get(current)?.tab); }

// ---------- 상단 바 (09 5장: 레벨 · 골드 고정, 전투 화면 제외. 골드는 2026-10-16 #172에 없앴다가 91에서 다시) ----------
const GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="6.6"/><path d="M12 2.5v2.9M12 18.6v2.9M2.5 12h2.9M18.6 12h2.9M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2"/></svg>';

/**
 * 상단 바. back이 있으면 「← 제목」 줄, 없으면 MMO 캐릭터 칸 (30 0장 공통 위 줄, 전투 Sunforged 기준 코덱스 로비 시안):
 * 황동 초상 테 직업 문장 + 알림 빨간 점 (특성 남음·새 장비) → 캐릭터 탭 · 직업 이름 + Lv + 짧은 경험치 막대 (% 글자는 막대 안) ·
 * 휴식 (15분에 1씩 차는 고리 + 다음 +1까지 시간, 누르면 휴식 창, 90) · 설정 (초상과 같은 둥근 황동 테).
 * 2026-10-16 Lim: 골드 칸 없앰 · 경험치 줄 짧게 · 충전을 보이게 · 설정 버튼을 정보창과 같은 결로 (모양 · 색은 a2-topbar.css).
 * 91 (같은 날, 골드 다시): 경험치 막대 오른쪽에 골드 (그림 + 수, 1만부터 줄여 씀). 「← 제목」 줄은 오른쪽에 골드 (#172 전 자리)
 * 캐릭터 칸은 탭 루트(settings)에서만 누름. 튜토리얼 중 캐릭터 탭이 잠겼으면(첫 장비 전) 누르지 않음.
 */
export function topBar(opts: { back?: string; title?: string; settings?: boolean } = {}): string {
  const s = G.save, p = s.player;
  const set = opts.settings ? `<button class="tb-set" type="button" data-go="s-settings" aria-label="설정"><span class="tb-ring2">${GEAR_SVG}</span></button>` : '';
  if (opts.back) {
    return `<header class="topbar"><button class="tb-back" type="button" data-go="${opts.back}" aria-label="뒤로">←</button><b class="tb-title">${esc(opts.title || '')}</b>${goldCell('tb-gold')}${set}</header>`;
  }
  const need = xpToNext(p.level);
  const pct = isFinite(need) ? Math.min(100, (p.xp / need) * 100) : 100;
  const tutDone = s.tut >= TUT.done;
  const left = tutDone ? talentsLeft() : 0, fresh = tutDone ? newGearCount() : 0;
  const charOk = tutDone || s.gear.bag.length > 0 || Object.keys(s.gear.equipped).length > 0;
  const hero = HEROES[heroNow()];
  const note = [left ? `특성 ${left} 남음` : '', fresh ? `새 장비 ${fresh}개` : ''].filter(Boolean).join(' · ');
  const pfIn = `<span class="tb-em">${classEmblem(heroNow(), 'lg')}</span>${note ? '<i class="tb-dot"></i>' : ''}`;
  const pf = opts.settings && charOk
    ? `<button class="tb-pf" type="button" data-go="s-char"${fresh ? ' data-arg="gear"' : left ? ' data-arg="talent"' : ''} aria-label="캐릭터 · ${esc(hero.name)} Lv ${p.level}${note ? ` · ${note}` : ''}">${pfIn}</button>`
    : `<span class="tb-pf" role="img" aria-label="${esc(hero.name)} Lv ${p.level}">${pfIn}</span>`;
  return `<header class="topbar tb-mmo">${pf}
    <span class="tb-nm"><span class="tb-id"><b class="tb-cls">${esc(hero.name)}</b><small class="tb-lv">Lv. ${p.level}</small></span>
      <span class="tb-xprow"><span class="tb-xp" role="img" aria-label="경험치 ${Math.floor(pct)}%" title="경험치 ${fmt(p.xp)} / ${isFinite(need) ? fmt(need) : '최대'}${apexOf(p.level) > 1 ? ` · 수련 +${((apexOf(p.level) - 1) * 100).toFixed(1)}%` : ''}"><i style="width:${pct.toFixed(1)}%"></i><small class="tb-xpt" aria-hidden="true">${isFinite(need) ? `${Math.floor(pct)}%` : 'MAX'}</small></span>${goldCell('tb-gold-mmo')}</span></span>
    ${s.tut >= TUT.done ? `<span class="tb-wal">${staminaCell()}</span>` : ''}
    ${set}</header>`;
}

const compactGold = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumSignificantDigits: 3 });
/** 위 줄 골드 칸 (91): 좁아서 1만부터 단위 축약 (5.23만, #172 전과 같음). 툴팁 · 접근성 이름에는 전체 값. 개발 빌드 골드 무제한이면 ∞ */
function goldCell(cls: string): string {
  const n = resourceBalance(G.save, 'gold'), full = isFinite(n) ? `골드 ${fmt(n)}` : '골드 무제한';
  const shown = !isFinite(n) ? '∞' : n >= 10000 ? compactGold.format(Math.floor(n)) : fmt(n);
  return `<span class="tb-cur ${cls}" role="img" aria-label="${full}" title="${full}">${currencyIcon('gold')}<b>${shown}</b></span>`;
}

/** [data-go] 버튼 = 그 화면으로 */
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (b && b.closest('#app')) go(b.dataset.go!, b.dataset.arg);
});

// ---------- 전투 화면 입구 (battle/index.ts가 window.__battle로 엶) ----------
export interface BattleApi {
  start(o: {
    content: string; name: string; segs: string[]; diff: string; /** 힐러 레벨 (스킬 해금) */ level: number; /** 실제 레벨 (힐량·체력) */ heroLv: number; /** 단계 레벨 */ stageLv: number; gearStats: GearStats; party: RosterEntry[];
    seed: number; onEnd(r: BattleResult): void;
    /** 튜토리얼 안내 묶음 (02 11장) */
    coach?: CoachKey | null;
    /** 힐러 직업 (25) */
    hero?: HeroKey;
    /** 사제 특성 (06 6장) */
    talents?: (number | null)[];
    /** 착용 장비 특수능력 값 (42, data/equipment specsOf) */
    specs?: Record<string, number>;
    /** 어픽스·보스 배율·제한시간 (32 난이도 어픽스, 13 3-2 주간 도전) */
    affixes?: string[]; bossMult?: { hp: number; dmg: number }; limit?: number; chal?: number;
  }): void;
  settings(s: object): void;
  /** 전투 화면에서 바꾼 설정 (일시정지의 자동 치유) → 저장 */
  onSetting: ((key: string, val: unknown) => void) | null;
  /** 전투 전 공략. 단계 레벨을 주면 그 레벨 숫자로 */
  guide(encKey: string, diff: string, stageLv?: number, heroLv?: number): string;
  bossSvg(script: string, key?: string): string;
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
