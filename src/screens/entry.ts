/**
 * S04 입장 = 주간 도전 「침묵의 시계」만 (13 3-2): 단계 고르기 · 제한시간 · 이번 주 어픽스 · 구간 · 보상, 아래 고정 「편성으로」.
 * 던전·레이드는 2026-10-08부터 입장 화면 없이 전투 탭 「출전」 → 편성 (난이도는 전투 탭에서만, 레벨 단계는 자동, 공략은 편성의 시트).
 */
import { contentOf } from '../data/content';
import { clearGold, clearXp } from '../data/progression';
import { Flow } from '../game/flow';
import { chalChestOf } from '../game/economy';
import { CHAL } from '../data/challenge';
import { runMode } from '../game/runmode';
import { G } from '../game/state';
import { esc, fmt, go, mmss, screen } from './kit';
import { uiIcon } from './art';
import { afxRows, ARROW, cover, flowHead, timeline, warnings } from './brief';

const s = screen('s-entry', '주간 도전', { enter() { render(); } });

function render(): void {
  // 주간 도전이 아니면 편성으로 (예전 경로)
  if (!Flow.chal) { Flow.party = null; Flow.rerolls = 0; go('s-party'); return; }
  const c = contentOf(Flow.content), d = Flow.diff, open = G.save.chalOpen;
  Flow.chal = Math.max(1, Math.min(open, CHAL.max, Flow.chal));
  const m = runMode(G.save, c, d, { chal: Flow.chal });
  const segs = c.fights(d), best = G.save.weekly.chalBest, bm = m.bossMult!;
  const festival = m.affixes.includes('festival');
  const gold = Math.round(clearGold(m.stage, d, 'A') * (festival ? CHAL.festivalGold : 1));
  const xp = clearXp(G.save.player.level, m.stage, d, 'A', { win: true });
  const box = best ? chalChestOf(best) : null;
  s.el.innerHTML = `${cover(c, flowHead('s-content', CHAL.name, `${esc(c.name)} ${d} · ${c.size(d)}인 · 단계 Lv ${m.stage}`, `<span class="f-hg sm">${uiIcon('hourglass')}</span>`))}
    <div class="ns-body f-ebody">
      <div class="chalstep"><button class="btn2" type="button" data-cstep="-1" aria-label="한 단계 아래"${Flow.chal <= 1 ? ' disabled' : ''}>−</button><b>${Flow.chal}단계</b><button class="btn2" type="button" data-cstep="1" aria-label="한 단계 위"${Flow.chal >= open ? ' disabled' : ''}>+</button></div>
      <p class="f-cinfo"><span>제한 <b>${mmss(m.limit!)}</b></span><span>적 체력 <b>+${Math.round((bm.hp - 1) * 100)}%</b></span><span>피해 <b>+${Math.round((bm.dmg - 1) * 100)}%</b></span></p>
      <p class="note center">열린 단계 ${open}/${CHAL.max} · 이번 주 최고 ${best ? `${best}단계` : '없음'}</p>
      ${warnings(segs, d, 0, { gear: false })}
      <section class="pn f-sec"><h2 class="h-rule">이번 주 어픽스<span class="rule"></span><span class="cap">월요일 오전 6시에 바뀜</span></h2>${afxRows(m.affixes)}</section>
      <section class="pn f-sec"><h2 class="h-rule">구간<span class="rule"></span></h2>${timeline(segs)}</section>
      <section class="pn f-sec f-rw"><h2 class="h-rule">보상<span class="rule"></span></h2>
        <span class="cap">판마다 장비 1개 · 골드 ${fmt(gold)}${festival ? ' (축제 주간 +20%)' : ''} · 경험치 약 ${fmt(xp)}</span>
        <span class="cap">월요일 상자 (이번 주 최고 단계): ${box ? `지금 기록이면 ${box.grades.join(' · ')}${box.legend ? ' · 전설 확률' : ''}` : '5단계 희귀 · 10단계 영웅 · 15단계 영웅 2개 · 20단계 전설 확률'}</span>
      </section>
      <p class="note center f-rules">제한시간 안에 깨면 다음 단계 열림 · 실패해도 단계 유지 · 광고 이어하기 없음</p>
    </div>
    <footer class="ns-foot f-foot"><button class="f-go" type="button" id="entryGo">${uiIcon('hourglass')}<span class="cta2"><span class="f-gt">편성으로</span><small>주간 도전 ${Flow.chal}단계 · 단계 Lv ${m.stage}</small></span>${ARROW}</button></footer>`;
}

s.el.addEventListener('click', e => {
  const cs = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cstep]');
  if (cs && !cs.disabled) { Flow.chal += Number(cs.dataset.cstep); render(); return; }
  if ((e.target as HTMLElement).closest('#entryGo')) { Flow.party = null; Flow.rerolls = 0; go('s-party'); }
});
