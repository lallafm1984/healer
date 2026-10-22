/**
 * S04 입장 = 주간 도전 「모래시계 시련」만 (13 3-2): 단계 고르기 · 제한시간 · 이번 주 어픽스 · 구간 · 보상, 아래 고정 「편성으로」.
 * 던전·레이드는 2026-10-08부터 입장 화면 없이 전투 탭 「출전」 → 편성 (난이도는 전투 탭에서만, 적 레벨 = 장소 레벨 (61 · 2026-10-21 레이드도), 공략은 편성의 시트).
 */
import { contentOf } from '../data/content';
import { clearGold, clearXp, restRun } from '../data/progression';
import { Flow } from '../game/flow';
import { chalChestOf } from '../game/economy';
import { CHAL, chalDropDiff } from '../data/challenge';
import { ITEM_GRADES } from '../data/equipment';
import { gearGradeOdds } from '../data/reward-preview';
import { runMode } from '../game/runmode';
import { restBase } from '../game/stamina';
import { G } from '../game/state';
import { esc, fmt, go, mmss, previous, screen } from './kit';
import { currencyIcon, gameIcon } from './art';
import { sortie } from './stamina';
import { afxRows, flowHead, timeline } from './brief';

/** 「←」 갈 곳: 로비 주간 도전 소켓에서 바로 왔으면 로비 (2026-10-22 Lim 「주간 도전 선택시 바로 주간도전 화면으로」), 전투 탭 도전 카드에서 왔으면 전투 탭. 편성 · 결과에서 돌아오면 그대로 */
let back = 's-content';
const s = screen('s-entry', '주간 도전', { enter() { if (previous === 's-lobby' || previous === 's-content') back = previous; render(); } });

function render(): void {
  // 주간 도전이 아니면 편성으로 (예전 경로)
  if (!Flow.chal) { Flow.party = null; go('s-party'); return; }
  const c = contentOf(Flow.content), d = Flow.diff, open = G.save.chalOpen;
  Flow.chal = Math.max(1, Math.min(open, CHAL.max, Flow.chal));
  const m = runMode(G.save, c, d, { chal: Flow.chal });
  const segs = c.fights(d), best = G.save.weekly.chalBest, bm = m.bossMult!;
  const festival = m.affixes.includes('festival');
  // 기본 값 (90 · 2026-10-17 Lim): 휴식이 없을 때 받는 값. 휴식 보너스는 결과 화면에서만
  const gold = restBase(restRun(clearGold(m.stage, d, 'A')));
  const xp = restBase(restRun(clearXp(G.save.player.level, d, 'A', { win: true }) * (festival ? CHAL.festivalXp : 1)));
  const box = best ? chalChestOf(best, G.save.player.level) : null;
  // 장비 최고 등급 = 실제 확률 (영웅 · 전설 확률까지, 출전 확률 창과 같은 dropOdds)에서 나오는 가장 높은 등급 (103)
  const chalOdds = gearGradeOdds(chalDropDiff(Flow.chal), 0, G.save.player.level), chalTop = [...ITEM_GRADES].reverse().find(g => chalOdds[g] > 0) ?? ITEM_GRADES[0]; // 상자 등급은 내 레벨로 (Lv 45 전 영웅 없음, 103)
  const chestReward = box ? [...[...new Set(box.grades)].map(grade => `${grade} ${box.grades.filter(g => g === grade).length}개`), `골드 ${box.goldRuns}판`].join(' · ') : '';
  s.el.innerHTML = `${flowHead(back, CHAL.name, `${esc(c.name)} ${d} · ${c.size(d)}인`)}
    <div class="ns-body f-ebody">
      <section class="pn wc-overview" aria-label="도전 단계">
        <div class="wc-stage"><span class="wc-emblem" aria-hidden="true">${gameIcon('challenge', '')}</span><div class="wc-stage-controls"><span class="cap">도전 단계</span>
          <div class="chalstep"><button class="btn2" type="button" data-cstep="-1" aria-label="한 단계 아래"${Flow.chal <= 1 ? ' disabled' : ''}>−</button><b aria-live="polite">${Flow.chal}단계</b><button class="btn2" type="button" data-cstep="1" aria-label="한 단계 위"${Flow.chal >= open ? ' disabled' : ''}>+</button></div>
        </div></div>
        <dl class="f-cinfo"><div><dt>제한시간</dt><dd>${mmss(m.limit!)}</dd></div><div><dt>적 체력</dt><dd>+${Math.round((bm.hp - 1) * 100)}%</dd></div><div><dt>피해</dt><dd>+${Math.round((bm.dmg - 1) * 100)}%</dd></div></dl>
        <p class="wc-record"><span>열린 단계 <b>${open}/${CHAL.max}</b></span><span>이번 주 최고 <b>${best ? `${best}단계` : '없음'}</b></span></p>
      </section>
      <section class="pn f-sec wc-affixes"><h2 class="h-rule">이번 주 어픽스<span class="rule"></span><span class="cap">월요일 06:00 갱신</span></h2>${afxRows(m.affixes)}</section>
      <section class="pn f-sec wc-route"><h2 class="h-rule">구간<span class="rule"></span><span class="cap">${segs.length}개 구간</span></h2>${timeline(segs)}</section>
      <section class="pn f-sec f-rw wc-rewards"><h2 class="h-rule">보상<span class="rule"></span><span class="cap">클리어마다 · 장비 ${chalTop}까지</span></h2>
        <div class="wc-reward-grid"><div>${gameIcon('gear', '')}<span>장비<b>1개</b></span></div><div>${currencyIcon('gold')}<span>골드<b>${fmt(gold)}</b></span></div><div>${gameIcon('a2-goal-book-r6', '')}<span>경험치<b>약 ${fmt(xp)}</b></span></div></div>
        ${festival ? '<p class="wc-festival">축제 주간 · 경험치 +20%</p>' : ''}
        <div class="wc-chest">${gameIcon('chest', '')}<div><span>월요일 상자 <small>이번 주 최고 단계 기준</small></span>${chestReward ? `<b>${chestReward}</b>` : ''}</div></div>
        <div class="wc-milestones" aria-label="월요일 상자 단계별 보상">${[5, 10, 15, 20].map(stage => { const reward = chalChestOf(stage, G.save.player.level); return `<span${best >= stage ? ' class="reached"' : ''}><small>${stage}단계</small><b>${reward.grades[0]} ${reward.grades.length}개</b></span>`; }).join('')}</div>
      </section>
    </div>
    <footer class="ns-foot f-foot"><button class="f-go" type="button" id="entryGo"><span class="cta2"><span class="f-gt">편성으로</span><small>주간 도전 ${Flow.chal}단계</small></span></button></footer>`;
}

s.el.addEventListener('click', e => {
  const cs = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cstep]');
  if (cs && !cs.disabled) { Flow.chal += Number(cs.dataset.cstep); render(); return; }
  // 81 · 90: 편성 (파티원 보기) 전에 입장 확인
  if ((e.target as HTMLElement).closest('#entryGo')) sortie();
});
