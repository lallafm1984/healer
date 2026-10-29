/** 화면 공통 도구: 화면 틀 만들기, 이동, 상단 바, 글자 이스케이프 */
import { syncBgm } from '../bgm';
import { locale, t } from '../i18n';
import type { GearStats } from '../data/gear';
import { HEROES, type HeroKey } from '../data/heroes';
import type { RosterEntry } from '../engine';
import type { BattleResult } from '../game/settle';
import { TUT, type CoachKey } from '../game/tutorial';
import { G, heroNow, newGearCount, setCommitHook } from '../game/state';
import { talentsLeft } from '../game/charinfo';
import { apexOf, xpToNext } from '../data/progression';
import { classEmblem, currencyIcon, shortAmount } from './art';
import { resourceBalance } from '../game/resources';
import { releaseSheetDialogs, resetShellScroll } from './dialog';
import { staminaCell } from './stamina';

export const $ = (id: string) => document.getElementById(id)!;

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const fmt = (n: number) => Math.round(n).toLocaleString(locale());
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
export type TabKey = 'lobby' | 'battle' | 'char' | 'guild';

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
/** 화면 전환 연출 (transition.ts): 새 화면을 보인 뒤 (바로 앞 화면, 새 화면, 「←」인지) */
let onShift: ((from: string, to: string, back: boolean) => void) | null = null;
export let current = '';
/** 바로 전 화면 (설정에서 돌아갈 곳) */
export let previous = '';
/** 이번 이동 바로 앞 화면 (같은 화면 안에서 다시 그리면 그 화면 자신) */
let fromId = '';
/** 이번 이동이 머리의 「←」 (.tb-back: 설정 · 상점 · 편성 · 주간 도전 · 임무 · 행상인)인지 */
let backNav = false;
/**
 * 하위 탭이 있는 메뉴 (전투 · 캐릭터 · 길드)에 새로 들어옴: 다른 화면에서 왔고 「←」로 돌아온 것이 아님 → 첫 탭.
 * 2026-10-21 Lim 「각 메뉴에 들어갔을때 그전의 탭화면을 유지 하지 말고 항상 첫번째 탭이 되도록. (강제로 그화면 이동은 제외)」:
 * 「←」로 돌아오면 보던 탭, 같은 화면 안에서 탭을 바꾸면 그 탭, 특정 탭으로 보내는 이동 (로비 출전 · 주간 도전 · 초상 빨간 점 · 설정 「스킬」 · 길드 부탁)은 arg로 그 탭
 */
export const freshEntry = (): boolean => fromId !== current && !backNav;
/** 이번 이동이 「←」로 돌아오는 것인지 */
export const goingBack = (): boolean => backNav;

/** <section class="screen"> 하나를 #app에 붙이고 등록 */
export function screen(id: string, label: string, def: Omit<Screen, 'el'> = {}): Screen {
  const el = document.createElement('section');
  el.id = id; el.className = 'screen ns'; el.hidden = true; el.setAttribute('aria-label', t(label));
  $('app').appendChild(el);
  const s = { el, ...def };
  screens.set(id, s);
  return s;
}

export function go(id: string, arg?: unknown): void {
  const s = screens.get(id);
  if (!s) throw new Error(`화면 없음: ${id}`);
  fromId = current;
  if (id !== current) screens.get(current)?.leave?.();
  releaseSheetDialogs();
  if (id !== current) previous = current;
  current = id;
  document.querySelectorAll<HTMLElement>('#app > .screen').forEach(x => { x.hidden = x.id !== id; });
  s.enter?.(arg);
  s.el.scrollTop = 0;
  onTabs?.(s.tab);
  onShift?.(fromId, id, backNav);
  syncBgm(id);
  // overflow:hidden ancestors can still be scrolled by focus/scrollIntoView.
  // Only the active screen's inner list may scroll; never carry this offset to a new screen.
  resetShellScroll();
}

export function setTabsHandler(fn: (t: TabKey | undefined) => void): void { onTabs = fn; }
export function setShiftHandler(fn: (from: string, to: string, back: boolean) => void): void { onShift = fn; }
/** 화면은 그대로 두고 하단 탭 (빨간 점)만 다시 그림 */
export function refreshTabs(): void { if (current) onTabs?.(screens.get(current)?.tab); }

// ---------- 상단 바 (09 5장: 레벨 · 휴식 · 골드 고정, 전투 화면 제외. 골드는 2026-10-17 #218에 뺐다가 2026-10-22 Lim 「헤드 메뉴에 골드 표시를 넣어보자」로 휴식 아래 줄에) ----------
const GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="6.6"/><path d="M12 2.5v2.9M12 18.6v2.9M2.5 12h2.9M18.6 12h2.9M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2"/></svg>';

/**
 * 상단 바. back이 있으면 「← 제목」 줄, 없으면 MMO 캐릭터 칸 (30 0장 공통 위 줄, 전투 Sunforged 기준 코덱스 로비 시안):
 * 황동 초상 테 직업 문장 + 알림 빨간 점 (특성 남음·새 장비) → 캐릭터 탭 · 직업 이름 + Lv + 짧은 경험치 막대 (% 글자는 막대 안) ·
 * 휴식 (달 그림 + 지금/최대, 누르면 휴식 창, 90) · 그 아래 줄에 같은 크기 그림의 골드 · 설정 (초상과 같은 둥근 황동 테).
 * 2026-10-16 Lim: 골드 칸 없앰 · 경험치 줄 짧게 · 충전을 보이게 · 설정 버튼을 정보창과 같은 결로 (모양 · 색은 a2-topbar.css).
 * 91에서 골드가 돌아오며 막대 옆 · 「← 제목」 줄 오른쪽에 골드를 다시 넣었다가, 2026-10-17 Lim 「헤드에서 골드 재화는 빼자」로 다시 뺌
 * (막대 아래로 내려간 골드 줄이 이름을 판 위 테두리로 밀었음). 2026-10-22 Lim 「헤드 메뉴에 골드 표시를 넣어보자」: 이름 칸은 그대로 두고
 * 휴식 아래 줄에 (`goldCell`, 같은 날 「휴식 아이콘 사이즈를 골드와 동일하게해서 두줄 로 나란히」). 「← 제목」 줄에는 넣지 않는다.
 * 캐릭터 칸은 탭 루트(settings)에서만 누름. 튜토리얼 중 캐릭터 탭이 잠겼으면(첫 장비 전) 누르지 않음.
 */
export function topBar(opts: { back?: string; title?: string; settings?: boolean } = {}): string {
  const s = G.save, p = s.player;
  const set = opts.settings ? `<button class="tb-set" type="button" data-go="s-settings" aria-label="${t('설정')}"><span class="tb-ring2">${GEAR_SVG}</span></button>` : '';
  if (opts.back) {
    return `<header class="topbar"><button class="tb-back" type="button" data-go="${opts.back}" aria-label="${t('뒤로')}">←</button><b class="tb-title">${esc(opts.title || '')}</b>${set}</header>`;
  }
  const need = xpToNext(p.level);
  const pct = isFinite(need) ? Math.min(100, (p.xp / need) * 100) : 100;
  const tutDone = s.tut >= TUT.done;
  const left = tutDone ? talentsLeft() : 0, fresh = tutDone ? newGearCount() : 0;
  const charOk = tutDone || s.gear.bag.length > 0 || Object.keys(s.gear.equipped).length > 0;
  const hero = HEROES[heroNow()];
  const note = [left ? t('특성 {n} 남음', { n: left }) : '', fresh ? t('새 장비 {n}개', { n: fresh }) : ''].filter(Boolean).join(' · ');
  const pfIn = `<span class="tb-em">${classEmblem(heroNow(), 'lg')}</span>${note ? '<i class="tb-dot"></i>' : ''}`;
  const pf = opts.settings && charOk
    ? `<button class="tb-pf" type="button" data-go="s-char"${fresh ? ' data-arg="gear"' : left ? ' data-arg="talent"' : ''} aria-label="${t('캐릭터')} · ${esc(t(hero.name))} Lv ${p.level}${note ? ` · ${note}` : ''}">${pfIn}</button>`
    : `<span class="tb-pf" role="img" aria-label="${esc(t(hero.name))} Lv ${p.level}">${pfIn}</span>`;
  return `<header class="topbar tb-mmo">${pf}
    <span class="tb-nm"><span class="tb-id"><b class="tb-cls">${esc(t(hero.name))}</b><small class="tb-lv">Lv. ${p.level}</small></span>
      <span class="tb-xprow"><span class="tb-xp" role="img" aria-label="${t('경험치 {n}%', { n: Math.floor(pct) })}" title="${t('경험치 {a} / {b}', { a: fmt(p.xp), b: isFinite(need) ? fmt(need) : t('최대') })}${apexOf(p.level) > 1 ? ` · ${t('수련 +{n}%', { n: ((apexOf(p.level) - 1) * 100).toFixed(1) })}` : ''}"><i style="width:${pct.toFixed(1)}%"></i><small class="tb-xpt" aria-hidden="true">${isFinite(need) ? `${Math.floor(pct)}%` : 'MAX'}</small></span></span></span>
    ${s.tut >= TUT.done ? `<span class="tb-wal">${staminaCell()}${goldCell()}</span>` : ''}
    ${set}</header>`;
}

const goldLabel = (n: number) => (isFinite(n) ? t('골드 {n}', { n: fmt(n) }) : t('골드 무제한'));
/** 위 줄 골드 (2026-10-22): 휴식 숫자 아래 줄. 누르는 칸이 아님 (터치는 아래 휴식 칸으로 지나감). 툴팁 · 접근성 이름에는 전체 값 */
function goldCell(): string {
  const n = resourceBalance(G.save, 'gold'), label = goldLabel(n);
  return `<span class="tb-cur tb-gold" data-gold role="img" aria-label="${label}" title="${label}">${currencyIcon('gold')}<b aria-hidden="true">${shortAmount(n)}</b></span>`;
}
/** 보이는 위 줄 골드를 지금 값으로 (저장할 때마다 · 화면을 다시 그리지 않는 곳에서 골드가 바뀌어도 바로) */
function refreshGold(): void {
  if (typeof document === 'undefined') return;
  const n = resourceBalance(G.save, 'gold'), shown = shortAmount(n), label = goldLabel(n);
  document.querySelectorAll<HTMLElement>('[data-gold]').forEach(el => {
    const b = el.querySelector('b');
    if (b && b.textContent !== shown) b.textContent = shown;
    if (el.title !== label) { el.title = label; el.setAttribute('aria-label', label); }
  });
}
setCommitHook(refreshGold);

/** [data-go] 버튼 = 그 화면으로 */
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (!b || !b.closest('#app')) return;
  backNav = b.classList.contains('tb-back');
  try { go(b.dataset.go!, b.dataset.arg); } finally { backNav = false; }
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
    affixes?: string[]; bossMult?: { hp: number; dmg: number }; limit?: number; chal?: number; guildFirst?: boolean; variant?: number;
  }): void;
  settings(s: object): void;
  /** 전투 화면에서 바꾼 설정 (일시정지의 자동 치유) → 저장 */
  onSetting: ((key: string, val: unknown) => void) | null;
  /** 전투 전 공략. 단계 레벨을 주면 그 레벨 숫자로 */
  guide(encKey: string, diff: string, stageLv?: number, heroLv?: number, variant?: number): string;
  bossSvg(script: string, key?: string): string;
  layout: {
    GRID: (string | null)[]; ARROW: Record<string, string>; READ_ORDER: string[]; DEFAULT_LAYOUT: Record<string, string | null>;
    LAYOUT_SKILLS: string[]; valid(v: unknown): boolean; label(k: string): string; text(l: Record<string, string | null>): string;
  };
  tapKeys: Record<string, string>;
  /** 그 직업의 칸 탭 후보 (스킬 이름 + 시전) */
  tapKeysOf(hero: string): Record<string, string>;
  sound(k: string): void;
  /** 안드로이드 뒤로가기: 전투 · 정비 화면이면 처리하고 true */
  back(): boolean;
}
export const battle = () => (window as unknown as { __battle: BattleApi }).__battle;
