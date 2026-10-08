/**
 * S22 일일·주간 임무 (09, 13). 로비 「오늘의 임무」에서 들어옴.
 * 일일 5개 + 완료 상자 (놓친 날 2일까지) + 하루 1회 무료 교체, 주간 3개 (종 조각), 길드 주간 목표, 주간 도전 월요일 상자.
 */
import { AD_LIMIT } from '../data/economy';
import { GUILD_GOAL, MISSION_REWARD, WEEKLY_LV } from '../data/missions';
import { GUILD_LEVEL } from '../data/progression';
import { hhmm, untilReset } from '../game/clock';
import { chalChestOf, chestState, claimChalChest, claimChest, claimGuildGoal, claimMission, isMember, missionDef, missionReady, runGold, swapMission } from '../game/economy';
import { commit, G, refreshDay } from '../game/state';
import { showRewarded } from '../platform/ads';
import { esc, fmt, screen, topBar } from './kit';
import { gainText } from './shop';

const st = { msg: '' };
const s = screen('s-missions', '임무', { enter() { refreshDay(); st.msg = ''; render(); } });

function row(kind: 'daily' | 'weekly', i: number): string {
  const m = (kind === 'daily' ? G.save.daily : G.save.weekly).missions[i], d = missionDef(m.key);
  const pct = Math.min(100, (m.n / d.need) * 100);
  const act = m.got ? '<i class="done">받음</i>'
    : missionReady(m) ? `<button class="btn mini primary" type="button" data-claim="${kind}" data-i="${i}">받기</button>`
      : kind === 'daily' && !G.save.daily.swapped ? `<button class="btn mini ghost" type="button" data-swap="${i}">교체</button>` : '';
  return `<li class="mrow${m.got ? ' got' : ''}"><div><b>${esc(d.text)}</b> <small>${Math.min(m.n, d.need)}/${d.need}</small><span class="bar"><i style="width:${pct.toFixed(0)}%"></i></span></div>${act}</li>`;
}

function render(): void {
  const d = G.save.daily, w = G.save.weekly, lv = G.save.player.level;
  const ch = chestState(G.save), gotN = d.missions.filter(m => m.got).length;
  const gold = Math.round(runGold(lv) * MISSION_REWARD.goldShare);
  const g = w.guild;
  const adLeft = AD_LIMIT.chest - d.ads.chest;
  s.el.innerHTML = `${topBar({ back: 's-lobby', title: '임무' })}
    <div class="ns-body missions">
      ${st.msg ? `<p class="warnbox">${esc(st.msg)}</p>` : ''}
      <h3 class="sec">일일 임무 <small>${gotN}/${d.missions.length} · 리셋까지 ${hhmm(untilReset())}</small></h3>
      <p class="note">1개마다 골드 ${fmt(gold)} · 강화석 ${MISSION_REWARD.stone} · 패스 경험치${d.swapped ? '' : ' · 하루 1번 무료 교체'}</p>
      <ul class="mlist">${d.missions.map((_, i) => row('daily', i)).join('')}</ul>
      <section class="panel chest">
        <h4>완료 상자 <small>임무 5개를 다 받으면 · 골드 1판 + 강화석 5 + 장비 1개</small></h4>
        ${ch.banked ? `<p class="note">놓친 날 상자 ${ch.banked}개 (최대 2일)</p>` : ''}
        <div class="gbtns">
          <button class="btn primary" type="button" id="chest"${ch.today || ch.banked ? '' : ' disabled'}>${ch.today ? '오늘 상자 열기' : ch.banked ? '놓친 날 상자 열기' : d.chest ? '오늘 상자 받음' : `${gotN}/5`}</button>
          ${d.chest && !d.chest2 ? `<button class="btn" type="button" id="chest2"${adLeft > 0 || isMember(G.save) ? '' : ' disabled'}>${isMember(G.save) ? '회원 · 한 번 더' : '광고 보고 한 번 더'}</button>` : ''}
        </div>
      </section>
      ${lv >= WEEKLY_LV ? `<h3 class="sec">주간 임무 <small>1개마다 종 조각 1 · 월요일 오전 6시 리셋</small></h3>
        <ul class="mlist">${w.missions.map((_, i) => row('weekly', i)).join('')}</ul>` : `<p class="note">주간 임무는 Lv ${WEEKLY_LV}부터 (종 조각)</p>`}
      ${lv >= GUILD_LEVEL ? `<section class="panel"><h4>길드 주간 목표 <small>길드파티로 클리어 ${g.n}/${GUILD_GOAL.need}</small></h4>
        <p class="note">명성 +${GUILD_GOAL.fame} · 길드원 전원 경험치 (다음 레벨까지의 절반)</p>
        <button class="btn" type="button" id="guildGoal"${g.got || g.n < GUILD_GOAL.need ? ' disabled' : ''}>${g.got ? '받음' : '받기'}</button></section>` : ''}
      ${G.save.chalChest ? `<section class="panel"><h4>주간 도전 상자 <small>지난주 최고 ${G.save.chalChest}단계</small></h4>
        <p class="note">${chalChestOf(G.save.chalChest).grades.join(' · ')} 보장${chalChestOf(G.save.chalChest).legend ? ' · 전설 확률' : ''}</p>
        <button class="btn primary" type="button" id="chalChest">열기</button></section>` : ''}
    </div>`;
  st.msg = '';
}

s.el.addEventListener('click', async e => {
  const t = e.target as HTMLElement, save = G.save, now = Date.now();
  const c = t.closest<HTMLElement>('[data-claim]');
  if (c) { const r = claimMission(save, c.dataset.claim as 'daily' | 'weekly', Number(c.dataset.i), now); st.msg = typeof r === 'string' ? r : gainText(r); commit(); render(); return; }
  const sw = t.closest<HTMLElement>('[data-swap]');
  if (sw) { st.msg = swapMission(save, Number(sw.dataset.swap), Math.random) || '임무 교체'; commit(); render(); return; }
  if (t.closest('#chest')) { const r = claimChest(save, Math.random, now); st.msg = typeof r === 'string' ? r : `완료 상자: ${gainText(r)}`; commit(); render(); return; }
  if (t.closest('#chest2')) {
    const mem = isMember(save);
    if (!mem && save.daily.ads.chest >= AD_LIMIT.chest) return;
    if (!(await showRewarded('완료 상자 한 번 더', mem))) return;
    if (!mem) save.daily.ads.chest++;
    const r = claimChest(save, Math.random, now, true);
    st.msg = typeof r === 'string' ? r : `한 번 더: ${gainText(r)}`; commit(); render(); return;
  }
  if (t.closest('#guildGoal')) { st.msg = claimGuildGoal(save) || `길드 주간 목표 · 명성 +${GUILD_GOAL.fame}`; commit(); render(); return; }
  if (t.closest('#chalChest')) { const r = claimChalChest(save, Math.random, now); st.msg = typeof r === 'string' ? r : `주간 도전 상자: ${gainText(r)}`; commit(); render(); }
});
