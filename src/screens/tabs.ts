/** 하단 탭 5개 (09 2-2). 전투 탭 = 지금은 프로토타입 메뉴, 나머지는 자리만 */
export interface TabDef {
  key: 'battle' | 'gear' | 'guild' | 'talent' | 'shop';
  name: string;
  /** 만드는 단계 (21 문서) */
  phase: string;
  docs: string;
}

export const TABS: TabDef[] = [
  { key: 'battle', name: '전투', phase: 'P1', docs: '02 · 05 · 09 S03~S09' },
  { key: 'gear', name: '장비', phase: 'P2', docs: '02 10장 · 09 S10' },
  { key: 'guild', name: '길드', phase: 'P2', docs: '02 9장 · 17 · 09 S12~S14' },
  { key: 'talent', name: '특성', phase: 'P2', docs: '06 · 18' },
  { key: 'shop', name: '상점', phase: 'P3', docs: '12 · 15' },
];

export function mountTabs(nav: HTMLElement, page: HTMLElement, menu: HTMLElement): void {
  let current: TabDef['key'] = 'battle';
  const render = () => {
    nav.innerHTML = TABS.map(t => `<button type="button" data-tab="${t.key}"${t.key === current ? ' aria-current="page"' : ''}>${t.name}${t.key === 'battle' ? '' : `<small>${t.phase}</small>`}</button>`).join('');
    const tab = TABS.find(t => t.key === current)!;
    page.hidden = current === 'battle';
    if (current !== 'battle') page.innerHTML = `<h2>${tab.name}</h2><p>${tab.phase} 단계에서 만들어요.</p><p>기획: ${tab.docs}</p>`;
  };
  nav.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
    if (!b) return;
    current = b.dataset.tab as TabDef['key'];
    render();
  });
  // 탭은 로비(메뉴)에서만 보임. 전투·공략·결과 화면에선 숨김
  const sync = () => {
    const on = !menu.hidden;
    nav.hidden = !on;
    document.body.classList.toggle('tabs-on', on);
    if (!on) { current = 'battle'; page.hidden = true; }
  };
  new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  render();
  sync();
}
