/** 하단 탭 4개 (09 2-2, Lim 2026-10-07: 장비·특성은 캐릭터 탭 안으로). 로비·캐릭터·탭 화면에서만 보임. 아직 없는 탭은 자리 + 잠금 레벨 */
import { GUILD_LEVEL } from '../data/progression';
import { G } from '../game/state';
import { TUT } from '../game/tutorial';
import { go, screen, setTabsHandler, topBar, type TabKey } from './kit';

export interface TabDef {
  key: TabKey;
  name: string;
  /** 만드는 단계 (21 문서) */
  phase: string;
  docs: string;
  /** 해금 레벨 (09 1-1) */
  lv?: number;
}

export const TABS: TabDef[] = [
  { key: 'battle', name: '전투', phase: 'P1', docs: '02 · 05 · 09 S03~S09' },
  { key: 'char', name: '캐릭터', phase: 'P1', docs: '06 · 09 S10·S16·S17' },
  { key: 'guild', name: '길드', phase: 'P2', docs: '02 9장 · 17 · 09 S12~S14', lv: GUILD_LEVEL },
  { key: 'shop', name: '상점', phase: 'P3', docs: '12 · 15' },
];

const ph = screen('s-tab', '준비 중인 탭', {
  enter(arg) {
    const t = TABS.find(x => x.key === arg) || TABS[TABS.length - 1];
    ph.tab = t.key;
    const locked = t.lv && G.save.player.level < t.lv;
    ph.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body tabph"><h2 class="h">${t.name}</h2>
      ${locked ? `<p class="lockline">🔒 Lv ${t.lv}에 열림 (지금 Lv ${G.save.player.level})</p>` : ''}
      <p class="note">${t.phase} 단계에서 추가</p><p class="note">기획: ${t.docs}</p></div>`;
  },
});

/** 튜토리얼 중엔 「전투」만 (09 4장). 캐릭터 탭은 첫 장비를 얻으면 열림 */
function tutLocked(k: TabKey): boolean {
  if (G.save.tut >= TUT.done || k === 'battle') return false;
  if (k === 'char') return !G.save.gear.bag.length && !Object.keys(G.save.gear.equipped).length;
  return true;
}

export function mountTabs(nav: HTMLElement): void {
  let cur: TabKey | undefined;
  const render = () => {
    nav.innerHTML = TABS.map(t => {
      const locked = t.lv && G.save.player.level < t.lv;
      const tl = tutLocked(t.key);
      return `<button type="button" data-tab="${t.key}"${t.key === cur ? ' aria-current="page"' : ''}${tl ? ' class="tlock" aria-disabled="true"' : ''}>${t.name}<small>${tl ? '🔒' : locked ? `🔒 Lv ${t.lv}` : t.key === 'battle' || t.key === 'char' ? '' : t.phase}</small></button>`;
    }).join('');
  };
  nav.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const k = b.dataset.tab as TabKey;
    if (k === 'battle') go('s-lobby');
    else if (k === 'char') go('s-char');
    else go('s-tab', k);
  });
  setTabsHandler(t => {
    cur = t;
    nav.hidden = !t;
    document.body.classList.toggle('tabs-on', !!t);
    if (t) render();
  });
  nav.hidden = true;
}
