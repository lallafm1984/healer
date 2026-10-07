/** S03 콘텐츠 선택 (09): 탭 탐험 / 던전 5인 / 레이드 / 이벤트, 카드에 레벨 단계·보스·별·드롭 세트 */
import { ALL_DIFFS, CONTENT, type ContentDef, type ContentKind } from '../data/content';
import { Flow } from '../game/flow';
import { G, lockOf } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, go, screen, topBar } from './kit';

const TABS: { kind: ContentKind; name: string }[] = [
  { kind: 'explore', name: '탐험 3인' },
  { kind: 'dungeon', name: '던전 5인' },
  { kind: 'raid', name: '레이드' },
  { kind: 'event', name: '이벤트' },
];
let tab: ContentKind = 'dungeon';

function stars(c: ContentDef): string {
  const rec = G.save.clears[c.key] || {};
  const got = ALL_DIFFS.filter(d => rec[d]).map(d => { const n = rec[d]!.stars; return `<span class="cs">${d} ${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`; });
  return got.join('') || '<span class="cs none">아직 클리어 없음</span>';
}

function card(c: ContentDef): string {
  const lk = lockOf(c);
  const size = c.kind === 'raid' ? '10인 · 악몽 20인' : `${c.size('보통')}인`;
  const state = !c.ready ? `<em class="soon">준비 중</em>` : lk.locked ? `<em class="lock">🔒 Lv ${lk.lv}</em>` : lk.dev ? `<em class="dev">Lv ${lk.lv} 해금 · 개발 빌드라 열림</em>` : '';
  const off = !c.ready || lk.locked;
  return `<button class="ccard${off ? ' off' : ''}" type="button" data-content="${c.key}"${off ? ' aria-disabled="true"' : ''}>
    <div class="cc-head"><b>${esc(c.name)}</b><span>단계 Lv ${c.stageLv}</span></div>
    <p>${esc(c.place)} · ${size} · 보스 ${c.bosses.length}${c.set ? ` · 세트 「${esc(c.set)}」` : ''}</p>
    ${c.ready && !lk.locked ? `<div class="cc-stars">${stars(c)}</div>` : ''}${state}</button>`;
}

const s = screen('s-content', '콘텐츠 선택', {
  enter() { if (G.save.tut === TUT.dungeon) tab = 'dungeon'; render(); },
});

function render(): void {
  const list = CONTENT.filter(c => c.kind === tab && !c.hidden);
  const empty = tab === 'event' ? '이벤트는 P3에서 추가' : '';
  const tip = G.save.tut === TUT.dungeon && tab === 'dungeon' ? '<p class="coachtip"><b>녹슨 요새</b> 선택. 일반·정예 구간 둘, 보스 둘을 이어서 진행</p>' : '';
  s.el.innerHTML = `${topBar({ back: 's-lobby', title: '콘텐츠' })}
    <nav class="subtabs" role="tablist">${TABS.map(t => `<button type="button" role="tab" data-ctab="${t.kind}" aria-selected="${t.kind === tab}">${t.name}${t.kind === 'raid' && G.save.player.level < 35 ? ' 🔒' : ''}</button>`).join('')}</nav>
    <div class="ns-body clist">${tip}${list.map(card).join('') || `<p class="note center">${empty}</p>`}</div>`;
  if (tip) s.el.querySelector('[data-content="rustfort"]')?.classList.add('hi-pulse');
}

s.el.addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-ctab]');
  if (t) { tab = t.dataset.ctab as ContentKind; render(); return; }
  const c = (e.target as HTMLElement).closest<HTMLElement>('[data-content]');
  if (c && c.getAttribute('aria-disabled') !== 'true') {
    Flow.content = c.dataset.content as never;
    // 튜토리얼 첫 던전은 쉬움으로 (09 4장)
    if (G.save.tut === TUT.dungeon && Flow.content === 'rustfort') Flow.diff = '쉬움';
    go('s-entry');
  }
});
