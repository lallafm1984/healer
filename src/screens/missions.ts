/**
 * S22 일일·주간 임무 (09, 13). 로비 「오늘의 임무」에서 들어옴.
 * 일일 5개 + 완료 상자 (놓친 날 2일까지), 주간 3개 (클리어 골드 3판), 길드 주간 목표 (길드를 빼 두면 없음), 주간 도전 월요일 상자.
 */
import { AD_LIMIT } from '../data/economy';
import { adsFree } from '../game/stamina';
import { CHEST_REWARD, GUILD_GOAL, WEEKLY_LV } from '../data/missions';
import { FEATURES } from '../data/features';
import { GUILD_LEVEL } from '../data/progression';
import { hhmm, untilReset, weekRemaining } from '../game/clock';
import { chalChestOf, chestState, claimChalChest, claimChest, claimGuildGoal, claimMission, missionDef, missionGold, missionReady, runGold, swapMission } from '../game/economy';
import { commit, G, refreshDay } from '../game/state';
import { topLevel } from '../platform/storage';
import { showRewarded } from '../platform/ads';
import { esc, screen, topBar } from './kit';
import { gainText } from './shop';
import { currencyAmount } from './art';
import { art } from '../art';
import './missions.css';
import { sfx } from '../sfx';

const st = { msg: '', tab: 'daily' as 'daily' | 'weekly' };
const s = screen('s-missions', '임무', { enter() { refreshDay(); st.msg = ''; st.tab = 'daily'; render(); } });

/** 임무 그림 (2026-10-22 Lim 임무 시안): 있는 그림을 빌려 씀. 이름 · 보상 · 진행은 그림이 아니라 실제 임무 값 */
const MISSION_ART: Record<string, string> = {
  clear3: 'icon-a2-swords', pub2: 'icon-guild-members', dispel10: 'skill-purify',
  overheal: 'skill-renew', nodeath: 'skill-guardian', mana20: 'spec-mana',
  clumsy: 'icon-guild-members', sell2: 'icon-forge', guild2: 'icon-guild-flag',
  w_raid3: 'icon-raid', w_hard5: 'icon-a2-swords', w_dclear15: 'icon-a2-swords',
  w_chal5: 'icon-challenge', w_chest5: 'icon-chest',
};
const missionImage = (key: string) => art(MISSION_ART[key] ?? 'icon-mission') || art('icon-mission');

function row(kind: 'daily' | 'weekly', i: number): string {
  const m = (kind === 'daily' ? G.save.daily : G.save.weekly).missions[i], d = missionDef(m.key);
  const value = Math.min(m.n, d.need), pct = Math.min(100, (m.n / d.need) * 100);
  const reward = missionGold(G.save, kind);
  const act = m.got ? '<span class="done">받음</span>'
    : missionReady(m) ? `<button class="btn mini primary" type="button" data-claim="${kind}" data-i="${i}" aria-label="${esc(d.text)} 보상 받기">받기</button>`
      : kind === 'daily' && !G.save.daily.swapped ? `<button class="btn mini ghost" type="button" data-swap="${i}" aria-label="${esc(d.text)} 교체">교체</button>` : '<span class="mission-pending">진행 중</span>';
  return `<li class="mrow${m.got ? ' got' : ''}${missionReady(m) && !m.got ? ' ready' : ''}">
    <span class="mission-icon"><img src="${missionImage(m.key)}" alt="" aria-hidden="true"></span>
    <div class="mission-copy"><b>${esc(d.text)}</b><div class="mission-progress"><small>${value}/${d.need}</small><span class="bar" role="progressbar" aria-label="${esc(d.text)}" aria-valuemin="0" aria-valuemax="${d.need}" aria-valuenow="${value}"><i style="width:${pct.toFixed(0)}%"></i></span></div></div>
    <span class="mission-reward">${currencyAmount('gold', reward)}</span><span class="mission-action">${act}</span></li>`;
}

function shields(got: number, total: number): string {
  return `<span class="mission-shields" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<img class="${i < got ? 'filled' : 'empty'}" src="${art('ui-class-paladin-shield-b3')}" alt="">`).join('')}</span>`;
}

function render(): void {
  const d = G.save.daily, w = G.save.weekly, lv = topLevel(G.save);
  const ch = chestState(G.save), gotN = d.missions.filter(m => m.got).length, weeklyN = w.missions.filter(m => m.got).length;
  const g = w.guild, run = runGold(lv), chal = G.save.chalChest ? chalChestOf(G.save.chalChest, G.save.player.level) : null;
  const adLeft = AD_LIMIT.chest - d.ads.chest;
  s.el.innerHTML = `${topBar({ back: 's-lobby', title: '임무' })}
    <div class="ns-body missions">
      <div class="mission-tabs" role="tablist" aria-label="임무 기간">
        ${(['daily', 'weekly'] as const).map(tab => `<button type="button" role="tab" id="mission-tab-${tab}" data-mission-tab="${tab}" aria-selected="${st.tab === tab}" aria-controls="mission-${tab}" tabindex="${st.tab === tab ? 0 : -1}">${tab === 'daily' ? '일일' : '주간'}</button>`).join('')}
      </div>
      ${st.msg ? `<p class="warnbox" role="status">${esc(st.msg)}</p>` : ''}
      <div id="mission-daily" role="tabpanel" aria-labelledby="mission-tab-daily"${st.tab === 'daily' ? '' : ' hidden'}>
        <section class="mission-chest" aria-label="일일 임무 완료 상자">
          <div class="mission-chest-art"><div class="mission-chest-copy"><h2>완료 상자</h2><p>임무 ${d.missions.length}개 보상 수령 시 열림</p><div class="mission-chest-rewards">${currencyAmount('gold', run * CHEST_REWARD.runs)}<span><img src="${art('item-chest-vestment')}" alt="" aria-hidden="true">장비 1개</span></div></div></div>
          <div class="mission-collection"><span>보상 수령 <b>${gotN}/${d.missions.length}</b></span>${shields(gotN, d.missions.length)}</div>
          ${ch.banked ? `<p class="note">놓친 날 상자 ${ch.banked}개 (최대 2일)</p>` : ''}
          <div class="gbtns"><button class="btn primary" type="button" id="chest"${ch.today || ch.banked ? '' : ' disabled'}>${ch.today ? '오늘 상자 열기' : ch.banked ? '놓친 날 상자 열기' : d.chest ? '오늘 상자 받음' : '완료 상자 잠김'}</button>
          ${d.chest && !d.chest2 ? `<button class="btn" type="button" id="chest2"${adLeft > 0 || adsFree(G.save) ? '' : ' disabled'}>${adsFree(G.save) ? '한 번 더 (광고 없음)' : '광고 보고 한 번 더'}</button>` : ''}</div>
        </section>
        <h3 class="mission-heading">오늘의 임무 <small>매일 오전 6시 갱신 · ${hhmm(untilReset())}</small></h3>
        <ul class="mlist">${d.missions.map((_, i) => row('daily', i)).join('')}</ul>
      </div>
      <div id="mission-weekly" role="tabpanel" aria-labelledby="mission-tab-weekly"${st.tab === 'weekly' ? '' : ' hidden'}>
        <section class="mission-week-head"><img src="${art('icon-mission')}" alt="" aria-hidden="true"><div><h2>주간 임무</h2><p>월요일 오전 6시 갱신 · ${weekRemaining()}</p></div></section>
        ${lv >= WEEKLY_LV ? `<div class="mission-collection"><span>보상 수령 <b>${weeklyN}/${w.missions.length}</b></span>${shields(weeklyN, w.missions.length)}</div><ul class="mlist">${w.missions.map((_, i) => row('weekly', i)).join('')}</ul>` : `<p class="mission-locked">주간 임무는 Lv ${WEEKLY_LV}부터</p>`}
        ${FEATURES.guild && lv >= GUILD_LEVEL ? `<section class="panel"><h4>길드 주간 목표 <small>길드파티로 클리어 ${g.n}/${GUILD_GOAL.need}</small></h4><p class="note">명성 +${GUILD_GOAL.fame} (길드파티 = 자리 절반 이상이 길드원)</p><button class="btn" type="button" id="guildGoal"${g.got || g.n < GUILD_GOAL.need ? ' disabled' : ''}>${g.got ? '받음' : '받기'}</button></section>` : ''}
        ${G.save.chalChest ? `<section class="panel"><h4>주간 도전 상자 <small>지난주 최고 ${G.save.chalChest}단계</small></h4><p class="note">${chal!.grades.length ? `${chal!.grades.join(' · ')} 보장 · ` : ''}${currencyAmount('gold', chal!.gold)}${chal!.grades.length ? '' : ' (장비는 5단계부터)'}</p><button class="btn primary" type="button" id="chalChest">열기</button></section>` : ''}
      </div>
    </div>`;
  st.msg = '';
}

s.el.addEventListener('keydown', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-mission-tab]');
  if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  st.tab = e.key === 'Home' ? 'daily' : e.key === 'End' ? 'weekly' : st.tab === 'daily' ? 'weekly' : 'daily';
  render(); s.el.querySelector<HTMLElement>(`#mission-tab-${st.tab}`)?.focus();
});

/** 받기 소리 (107): 받았으면 그 소리, 못 받았으면 (글자 = 까닭) deny */
const got = (r: unknown, name: string) => sfx(typeof r === 'string' ? 'deny' : name);

s.el.addEventListener('click', async e => {
  const t = e.target as HTMLElement, save = G.save;
  const tab = t.closest<HTMLElement>('[data-mission-tab]');
  if (tab) { st.tab = tab.dataset.missionTab as 'daily' | 'weekly'; render(); s.el.querySelector<HTMLElement>(`#mission-tab-${st.tab}`)?.focus(); return; }
  const c = t.closest<HTMLElement>('[data-claim]');
  if (c) { const r = claimMission(save, c.dataset.claim as 'daily' | 'weekly', Number(c.dataset.i)); got(r, 'mission-claim'); st.msg = typeof r === 'string' ? r : gainText(r); commit(); render(); return; }
  const sw = t.closest<HTMLElement>('[data-swap]');
  if (sw) { st.msg = swapMission(save, Number(sw.dataset.swap), Math.random) || '임무 교체'; commit(); render(); return; }
  if (t.closest('#chest')) { const r = claimChest(save, Math.random); got(r, 'chest-open'); st.msg = typeof r === 'string' ? r : `완료 상자: ${gainText(r)}`; commit(); render(); return; }
  if (t.closest('#chest2')) {
    const mem = adsFree(save);
    if (!mem && save.daily.ads.chest >= AD_LIMIT.chest) return;
    if (!(await showRewarded('완료 상자 한 번 더', mem))) return;
    if (!mem) save.daily.ads.chest++;
    const r = claimChest(save, Math.random, true);
    got(r, 'chest-open');
    st.msg = typeof r === 'string' ? r : `한 번 더: ${gainText(r)}`; commit(); render(); return;
  }
  if (t.closest('#guildGoal')) { const err = claimGuildGoal(save); got(err || {}, 'mission-claim'); st.msg = err || `길드 주간 목표 · 명성 +${GUILD_GOAL.fame}`; commit(); render(); return; }
  if (t.closest('#chalChest')) { const r = claimChalChest(save, Math.random); got(r, 'chest-open'); st.msg = typeof r === 'string' ? r : `주간 도전 상자: ${gainText(r)}`; commit(); render(); }
});
