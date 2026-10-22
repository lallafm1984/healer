/**
 * S04 입장 = 주간 도전 「모래시계 시련」만 (13 3-2): 단계 고르기 · 제한시간 · 이번 주 어픽스 · 구간 · 보상, 아래 고정 「편성으로」.
 * 던전·레이드는 2026-10-08부터 입장 화면 없이 전투 탭 「출전」 → 편성 (난이도는 전투 탭에서만, 적 레벨 = 장소 레벨 (61 · 2026-10-21 레이드도), 공략은 편성의 시트).
 */
import { contentOf } from '../data/content';
import { clearGold, clearXp, restRun } from '../data/progression';
import { Flow } from '../game/flow';
import { chalChestOf } from '../game/economy';
import { AFFIXES } from '../data/affixes';
import { CHAL, chalDropDiff, chalReward } from '../data/challenge';
import { ITEM_GRADES } from '../data/equipment';
import { gearGradeOdds } from '../data/reward-preview';
import { nextWeekAffixes, runMode } from '../game/runmode';
import { weekRemaining } from '../game/clock';
import { restBase } from '../game/stamina';
import { G } from '../game/state';
import { esc, fmt, go, mmss, previous, screen } from './kit';
import { currencyIcon, gameIcon } from './art';
import { sortie } from './stamina';
import { afxIcon, afxRows, flowHead, timeline } from './brief';

/** 「←」 갈 곳: 로비 주간 도전 소켓에서 바로 왔으면 로비 (2026-10-22 Lim 「주간 도전 선택시 바로 주간도전 화면으로」), 전투 탭 도전 카드에서 왔으면 전투 탭. 편성 · 결과에서 돌아오면 그대로 */
let back = 's-content';
const s = screen('s-entry', '주간 도전', { enter() { if (previous === 's-lobby' || previous === 's-content') back = previous; render(); } });

function render(): void {
  // 주간 도전이 아니면 편성으로 (예전 경로)
  if (!Flow.chal) { Flow.party = null; go('s-party'); return; }
  const c = contentOf(Flow.content), d = Flow.diff, open = G.save.chalOpen, st = Math.max(1, Math.min(open, CHAL.max, Flow.chal));
  Flow.chal = st;
  const m = runMode(G.save, c, d, { chal: st });
  const segs = c.fights(d), best = G.save.weekly.chalBest, bm = m.bossMult!, lv = G.save.player.level;
  const festival = m.affixes.includes('festival'), bounty = m.affixes.includes('bounty'), bonus = chalReward(st);
  // 기본 값 (90 · 2026-10-17 Lim): 휴식이 없을 때 받는 값. 휴식 보너스는 결과 화면에서만. 단계 보너스 · 축제 · 풍요는 넣음 (110)
  const gold = restBase(restRun(clearGold(m.stage, d, 'A') * bonus * (bounty ? CHAL.bountyGold : 1)));
  const xp = restBase(restRun(clearXp(lv, d, 'A', { win: true }) * bonus * (festival ? CHAL.festivalXp : 1)));
  const box = best ? chalChestOf(best, lv) : null;
  // 장비 최고 등급 = 실제 확률 (영웅 · 전설 확률까지, 출전 확률 창과 같은 dropOdds)에서 나오는 가장 높은 등급 (103)
  const chalOdds = gearGradeOdds(chalDropDiff(st), 0, lv), chalTop = [...ITEM_GRADES].reverse().find(g => chalOdds[g] > 0) ?? ITEM_GRADES[0]; // 상자 등급은 내 레벨로 (Lv 45 전 영웅 없음, 103)
  const chestReward = box ? [...[...new Set(box.grades)].map(grade => `${grade} ${box.grades.filter(g => g === grade).length}개`), `골드 ${box.goldRuns}판`].join(' · ') : '';
  const next = nextWeekAffixes();
  s.el.innerHTML = `${flowHead(back, CHAL.name, `${esc(c.name)} · ${c.size(d)}인 · ${weekRemaining()} 남음`)}
    <div class="ns-body f-ebody">
      <section class="pn wc-overview" aria-label="도전 단계">
        <div class="wc-stage"><span class="wc-emblem" aria-hidden="true">${gameIcon('challenge', '')}</span><div class="wc-stage-controls"><span class="cap">도전 단계</span>
          <div class="chalstep"><button class="btn2" type="button" data-cstep="-1" aria-label="한 단계 아래"${st <= 1 ? ' disabled' : ''}>−</button><b aria-live="polite">${st}단계</b><button class="btn2" type="button" data-cstep="1" aria-label="한 단계 위"${st >= open ? ' disabled' : ''}>+</button></div>
        </div></div>
        <dl class="f-cinfo"><div><dt>제한시간</dt><dd>${mmss(m.limit!)}</dd></div><div><dt>적 체력</dt><dd>+${Math.round((bm.hp - 1) * 100)}%</dd></div><div><dt>적 피해</dt><dd>+${Math.round((bm.dmg - 1) * 100)}%</dd></div><div class="wc-bonus"><dt>보상</dt><dd>+${Math.round((bonus - 1) * 100)}%</dd></div></dl>
        ${track(st, open, best, lv)}
        <p class="wc-record"><span>열린 단계 <b>${open}/${CHAL.max}</b></span><span>이번 주 최고 <b>${best ? `${best}단계` : '없음'}</b></span></p>
      </section>
      <section class="pn f-sec wc-affixes"><h2 class="h-rule">이번 주 어픽스<span class="rule"></span><span class="cap">월요일 06:00 갱신</span></h2>${afxRows(m.affixes)}
        <p class="wc-next"><span class="cap">다음 주</span>${next.map(k => `<span class="wc-ntag${AFFIXES[k].good ? ' good' : ''}">${afxIcon(k)}${AFFIXES[k].name}</span>`).join('')}</p></section>
      <section class="pn f-sec wc-route"><h2 class="h-rule">구간<span class="rule"></span><span class="cap">${segs.length}개 구간</span></h2>${timeline(segs)}</section>
      <section class="pn f-sec f-rw wc-rewards"><h2 class="h-rule">보상<span class="rule"></span><span class="cap">클리어마다 · 장비 ${chalTop}까지</span></h2>
        <div class="wc-reward-grid"><div>${gameIcon('gear', '')}<span>장비<b>1개</b></span></div><div>${currencyIcon('gold')}<span>골드<b>${fmt(gold)}</b></span></div><div>${gameIcon('a2-goal-book-r6', '')}<span>경험치<b>약 ${fmt(xp)}</b></span></div></div>
        ${bonus > 1 || festival || bounty ? `<p class="wc-festival">${[bonus > 1 ? `${st}단계 보너스 골드 · 경험치 +${Math.round((bonus - 1) * 100)}%` : '', festival ? '축제 주간 경험치 +20%' : '', bounty ? '풍요 주간 골드 +30%' : ''].filter(Boolean).join(' · ')}</p>` : ''}
        <div class="wc-chest">${gameIcon('chest', '')}<div><span>월요일 상자 <small>이번 주 최고 단계 기준</small></span><b>${chestReward || '5단계부터 장비'}</b></div></div>
      </section>
    </div>
    <footer class="ns-foot f-foot"><button class="f-go" type="button" id="entryGo"><span class="cta2"><span class="f-gt">편성으로</span><small>주간 도전 ${st}단계</small></span></button></footer>`;
}

/**
 * 단계 길 (110, 2026-10-22 Lim 「ui 개선」): 1~20단계 눈금 (열림 · 이번 주 깸 · 고른 단계), 5 · 10 · 15 · 20단계 아래 월요일 상자 등급.
 * 보기만 (눈금은 44px가 안 돼 누르지 않음), 단계는 ± 버튼으로
 */
function track(st: number, open: number, best: number, lv: number): string {
  const pips = Array.from({ length: CHAL.max }, (_, i) => {
    const n = i + 1, cls = [n <= best ? 'done' : n <= open ? 'open' : '', n === st ? 'cur' : '', n % 5 === 0 ? 'mile' : ''].filter(Boolean).join(' ');
    return `<i${cls ? ` class="${cls}"` : ''}></i>`;
  }).join('');
  const marks = [5, 10, 15, 20].map(n => { const g = chalChestOf(n, lv).grades; return `<span class="${best >= n ? 'reached' : ''}" style="--at:${n}"><small>${n}</small>${g[0]}${g.length > 1 ? ` ${g.length}` : ''}</span>`; }).join('');
  return `<div class="wc-track" role="img" aria-label="단계 ${st} · 열린 단계 ${open} · 이번 주 최고 ${best || 0} · 월요일 상자 5단계 고급 · 10단계 희귀 · 15 · 20단계 영웅"><div class="wc-pips">${pips}</div><div class="wc-marks">${marks}</div></div>`;
}

s.el.addEventListener('click', e => {
  const cs = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cstep]');
  if (cs && !cs.disabled) { Flow.chal += Number(cs.dataset.cstep); render(); return; }
  // 81 · 90: 편성 (파티원 보기) 전에 입장 확인
  if ((e.target as HTMLElement).closest('#entryGo')) sortie();
});
