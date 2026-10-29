/**
 * 하단 탭 4개: 로비 · 전투 · 캐릭터 · 길드 (Lv 30). 앱을 켜면 로비.
 * 레벨로 잠긴 탭은 자물쇠 그림 (tab-lock) · 이름만, 오른쪽 위 「Lv 30」 글은 없다 (2026-10-28 Lim 「메뉴에 길드 잠금이 보기 안좋다. lv30텍스트 제거」, 읽어 주는 글에만)
 * 2026-10-18 Lim 「메뉴의 상점을 빼고 길드를 넣자. 상점의 진입 루트는 로비이다」: 상점은 탭이 아니라 로비 「상점」 팻말 (예전 「잡화점」, 그리고 휴식 창 · 직업 구매)에서 들어가고,
 * (상점의 패스 빨간 점은 시즌 패스와 함께 2026-10-20 없앰.) (예전: 27 1장 탭 5개 → 2026-10-09 길드를 빼 두어 로비 · 전투 · 캐릭터 · 상점)
 * 탭 막대는 탭 루트(로비 S02 · 모험 선택 S03 · 캐릭터 · 길드)에서만 보인다. 고른 탭을 다시 누르면 그 루트 맨 위로.
 * 아이콘: 로비 등불, 전투 방패, 캐릭터 = 지금 직업 문장, 길드 깃발 (그림 tab-*, 30 문서. 없으면 선 아이콘). 잠긴 탭은 황동 자물쇠 그림 (tab-lock). 빨간 점 = 받을 것·볼 것.
 * 아이콘은 전투 아이템 칸과 같은 황동 사각 소켓(.tab-sock) 안에. 고른 탭 = 밝은 금색 안쪽 테 (sunforged-ui.css).
 */
import { FEATURES } from '../data/features';
import { GUILD_LEVEL } from '../data/progression';
import { talentsLeft } from '../game/charinfo';
import { chestState, missionReady } from '../game/economy';
import { guildOpen, postNew } from '../game/guild';
import { jobsDot } from '../game/guildjobs';
import { Flow } from '../game/flow';
import { G, heroNow, newGearCount } from '../game/state';
import { topLevel } from '../platform/storage';
import { TUT } from '../game/tutorial';
import { go, setTabsHandler, type TabKey } from './kit';
import { classEmblem, gameIcon, uiIcon } from './art';

export interface TabDef {
  key: TabKey;
  name: string;
  /** 탭 루트 화면 */
  root: string;
  /** 해금 레벨 (09 1-1) */
  lv?: number;
}

const ALL_TABS: TabDef[] = [
  { key: 'lobby', name: '로비', root: 's-lobby' },
  { key: 'battle', name: '전투', root: 's-content' },
  { key: 'char', name: '캐릭터', root: 's-char' },
  { key: 'guild', name: '길드', root: 's-guild', lv: GUILD_LEVEL },
];
export const TABS = ALL_TABS.filter(t => t.key !== 'guild' || FEATURES.guild);

const HOME = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/></svg>';

/** 튜토리얼 중엔 로비·전투만 (09 4장). 캐릭터 탭은 첫 장비를 얻으면 열림 */
function tutLocked(k: TabKey): boolean {
  if (G.save.tut >= TUT.done || k === 'lobby' || k === 'battle') return false;
  if (k === 'char') return !G.save.gear.bag.length && !Object.keys(G.save.gear.equipped).length;
  return true;
}

/** 로비에서 받을 것 (일일·주간 임무, 일일 상자, 주간 도전 상자) */
export function lobbyReady(): number {
  const s = G.save, ch = chestState(s);
  return s.daily.missions.filter(missionReady).length + s.weekly.missions.filter(missionReady).length + (ch.today || ch.banked ? 1 : 0) + (s.chalChest ? 1 : 0);
}
/** 길드에서 확인할 것: 새 공고 지원자 (매일 오전 6시, 아직 영입 탭을 안 봄, 2026-10-22) · 부탁 쪽지 · 원정 상자 (93 8장, 빨간 점은 길드 탭 하나만) */
const guildReady = (): boolean => guildOpen(G.save).ok && (postNew(G.save) || jobsDot(G.save));
function dotOf(k: TabKey): boolean {
  if (G.save.tut < TUT.done) return false;
  if (k === 'lobby') return lobbyReady() > 0;
  if (k === 'char') return newGearCount() > 0 || talentsLeft() > 0;
  if (k === 'guild') return guildReady();
  return false;
}
function iconOf(k: TabKey): string {
  if (k === 'char') return G.save.tut >= TUT.done ? classEmblem(heroNow(), 'sm') : uiIcon('char');
  return gameIcon(k, k === 'lobby' ? HOME : uiIcon(k), 'tab');
}

export function mountTabs(nav: HTMLElement): void {
  let cur: TabKey | undefined;
  const render = () => {
    const glints = nav.querySelectorAll('.xf-glint'); // 화면 전환 탭 금빛 (transition.ts)은 다시 그려도 이어서
    nav.innerHTML = TABS.map(t => {
      const locked = !!t.lv && topLevel(G.save) < t.lv && !(t.key === 'guild' && G.save.guild.founded); // 이미 만든 길드는 잠그지 않음 (guildOpen과 같게, 2026-10-29 Lim)
      const tl = tutLocked(t.key);
      const baseIcon = iconOf(t.key);
      // A2 교차검을 모든 탭에서 동일하게 사용한다. 잠금 상태의 자물쇠는 보존한다.
      // 잠금 = 다른 탭과 같은 결의 황동 자물쇠 그림 tab-lock (2026-10-28 Lim 「자물쇠도 아이콘으로 다른아이콘과 비슷한걸로」), 없으면 선 아이콘
      const icon = locked || tl ? gameIcon('lock', uiIcon('lock'), 'tab') : t.key === 'battle' ? gameIcon('a2-swords', baseIcon) : baseIcon;
      const cls = tl ? ' class="tlock"' : locked ? ' class="llock"' : '';
      return `<button type="button" data-tab="${t.key}"${t.key === cur ? ' aria-current="page"' : ''}${cls}${tl ? ' aria-disabled="true"' : ''}><span class="tab-sock">${icon}</span><span>${t.name}</span>${tl ? '<small>잠금</small>' : locked ? `<span class="sr"> Lv ${t.lv}에 열림</span>` : ''}${!tl && !locked && dotOf(t.key) ? '<i class="rdot" aria-label="새 소식"></i>' : ''}</button>`;
    }).join('');
    nav.append(...glints);
  };
  nav.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const t = TABS.find(x => x.key === b.dataset.tab);
    if (!t) return;
    // 길드 탭 「길드파티로 출전」은 그 길로 편성까지 갈 때만 (탭을 직접 누르면 취소)
    Flow.preferGuild = false; Flow.needNick = undefined;
    // 고른 탭을 다시 눌러도 그 탭의 루트로, 스크롤 맨 위 (잠긴 길드는 루트가 잠금 안내)
    go(t.root);
    document.querySelector<HTMLElement>(`#${t.root} .ns-body`)?.scrollTo({ top: 0 });
  });
  setTabsHandler(t => {
    cur = t;
    nav.hidden = !t;
    document.body.classList.toggle('tabs-on', !!t);
    if (t) render();
  });
  nav.hidden = true;
}
