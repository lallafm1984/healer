/** S03 콘텐츠 선택 (09): 탭 탐험 / 던전 5인 / 레이드 / 이벤트, 카드에 레벨 단계·보스·별·드롭 세트. 던전 탭 맨 위에 주간 도전 (13 3-2) */
import { ALL_DIFFS, CONTENT, type ContentDef, type ContentKind } from '../data/content';
import { Flow } from '../game/flow';
import { G, lockOf } from '../game/state';
import { TUT } from '../game/tutorial';
import { AFFIXES } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { chalGate, weekAffixes } from '../game/runmode';
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
  const size = `${c.size('보통')}인`;
  const state = !c.ready ? `<em class="soon">준비 중</em>` : lk.locked ? `<em class="lock">🔒 Lv ${lk.lv}</em>` : lk.dev ? `<em class="dev">Lv ${lk.lv} 해금 · 개발 빌드라 열림</em>` : '';
  const off = !c.ready || lk.locked;
  return `<button class="ccard${off ? ' off' : ''}" type="button" data-content="${c.key}"${off ? ' aria-disabled="true"' : ''}>
    <div class="cc-head"><b>${esc(c.name)}</b><span>단계 Lv ${c.stageLv}</span></div>
    <p>${esc(c.place)} · ${size} · 보스 ${c.bosses.length}${c.set ? ` · 세트 「${esc(c.set)}」` : ''}${c.tiers && G.save.tut >= TUT.done ? ` · 레벨 단계 ${c.tiers.join('·')}` : ''}</p>
    ${c.ready && !lk.locked ? `<div class="cc-stars">${stars(c)}</div>` : ''}${state}</button>`;
}

/** 주간 도전 카드 (13 3-2): 던전 탭 맨 위 */
function chalCard(): string {
  if (G.save.tut < TUT.done) return '';
  const g = chalGate(G.save), aff = weekAffixes();
  const best = G.save.weekly.chalBest;
  const state = !g.ok ? `<em class="lock">🔒 Lv ${g.lv}</em>` : g.dev ? `<em class="dev">Lv ${g.lv} 해금 · 개발 빌드라 열림</em>` : '';
  return `<button class="ccard chal${g.ok ? '' : ' off'}" type="button" data-chal${g.ok ? '' : ' aria-disabled="true"'}>
    <div class="cc-head"><b>⏳ 주간 도전 「${CHAL.name}」</b><span>단계 1~${CHAL.max}</span></div>
    <p>이번 주 어픽스 ${aff.map(k => `<span class="afx${AFFIXES[k].good ? ' good' : ''}">${AFFIXES[k].name}</span>`).join(' ')}</p>
    ${g.ok ? `<p class="cc-stars"><span class="cs">이번 주 최고 ${best ? `${best}단계` : '없음'} · 열린 단계 ${G.save.chalOpen}</span></p>` : ''}${state}</button>`;
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
    <div class="ns-body clist">${tip}${tab === 'dungeon' ? chalCard() : ''}${list.map(card).join('') || `<p class="note center">${empty}</p>`}</div>`;
  if (tip) s.el.querySelector('[data-content="rustfort"]')?.classList.add('hi-pulse');
}

s.el.addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-ctab]');
  if (t) { tab = t.dataset.ctab as ContentKind; render(); return; }
  const ch = (e.target as HTMLElement).closest<HTMLElement>('[data-chal]');
  if (ch && ch.getAttribute('aria-disabled') !== 'true') {
    Flow.content = CHAL.content; Flow.diff = CHAL.diff; Flow.tier = 0; Flow.chal = G.save.chalOpen;
    go('s-entry'); return;
  }
  const c = (e.target as HTMLElement).closest<HTMLElement>('[data-content]');
  if (c && c.getAttribute('aria-disabled') !== 'true') {
    Flow.content = c.dataset.content as never; Flow.tier = 0; Flow.chal = 0;
    // 튜토리얼 첫 던전은 쉬움으로 (09 4장)
    if (G.save.tut === TUT.dungeon && Flow.content === 'rustfort') Flow.diff = '쉬움';
    go('s-entry');
  }
});
