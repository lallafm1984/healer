/** S08 정산 · S09 보상 · P04 레벨업 팝업 (09) */
import { contentOf } from '../data/content';
import { GRADE_STYLE, slotName, type GearItem } from '../data/equipment';
import { GRADE } from '../data/gear';
import { SETS } from '../data/sets';
import { CLASSES } from '../data/classes';
import { HEROES } from '../data/heroes';
import { lvPower, MILESTONES, STAR_OVERHEAL, xpToNext } from '../data/progression';
import { Flow, newSeed } from '../game/flow';
import { meterHtml } from '../game/meter';
import { equip, G } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, fmt, go, mmss, screen, topBar } from './kit';
import { depart } from './party';

const STAR_TEXT = ['클리어', '아무도 안 쓰러짐', `오버힐 ${Math.round(STAR_OVERHEAL * 100)}% 이하`];

// ---------- 정산 ----------
const st = screen('s-settle', '정산', { enter() { renderSettle(); } });

function renderSettle(): void {
  const r = Flow.result!, x = Flow.settle!;
  const c = contentOf(r.content);
  const multi = r.segN > 1;
  const title = r.quit ? '포기' : r.win ? (multi ? '던전 클리어!' : '클리어!') : '전멸';
  const n = x.stars.filter(Boolean).length;
  const metrics: [string, string][] = [
    ['클리어 시간', `${mmss(r.time)}${multi && r.restSec ? ` (휴식 ${Math.round(r.restSec)}초 따로)` : ''}`],
    ['쓰러진 파티원', `${r.deaths}명`],
    ['오버힐', `${x.overhealPct}%`],
    ['해제 성공률', x.dispelPct == null ? '해제할 디버프 없음' : `${x.dispelPct}% (${r.dispels}/${r.dispellable})`],
    ['남은 마나', `${r.endMana}% (최저 ${r.minMana}%)`],
  ];
  if (!r.win) metrics.unshift(['진행', multi ? `${r.segIdx} / ${r.segN} 구간` : '보스 못 잡음']);
  st.el.innerHTML = `${topBar()}
    <div class="ns-body settle">
      <header class="res-head ${r.win ? 'win' : 'lose'}">
        <h1>${title}</h1>
        <p>${esc(c.name)} · ${esc(r.diff)} — ${esc(r.reason)}${r.auto ? ' · 자동 힐러' : ''}</p>
        ${r.win ? `<div class="gradebox"><b class="grade">${x.grade}</b><span class="stars" aria-label="별 ${n}개">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span></div>` : ''}
        ${x.first ? '<em class="badge">첫 클리어</em>' : x.best ? '<em class="badge">최고 기록</em>' : ''}
      </header>
      ${r.win ? `<ul class="starlist">${x.stars.map((ok, i) => `<li class="${ok ? 'ok' : ''}">${ok ? '★' : '☆'} ${STAR_TEXT[i]}</li>`).join('')}</ul>` : ''}
      <dl class="metrics">${metrics.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${r.meter ? meterHtml(r.meter, r.time, { title: multi ? '딜미터기 · 던전 전체' : '딜미터기', heal: r.healed }) : ''}
      ${!r.win && x.xp ? `<p class="note center">경험치 +${fmt(x.xp)} (진 판은 20%)</p>` : ''}
      <details class="more"><summary>자세히</summary><dl class="metrics small">${r.detail.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>
    </div>
    <footer class="ns-foot ${r.win ? '' : 'row3'}">${r.win
      ? '<button class="btn primary" type="button" id="toReward">다음 (보상)</button>'
      : '<button class="btn" type="button" id="retry">다시 도전</button><button class="btn" type="button" data-go="s-party">편성 바꾸기</button><button class="btn" type="button" data-go="s-lobby">로비</button>'}</footer>`;
  if (!r.win && x.levelUps.length) showLevelUp(st.el, x.levelUps);
}

st.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('#toReward')) go('s-reward');
  else if (t.closest('#retry')) retry();
});

/** 같은 파티로 다시 (시작 위치는 새로) */
function retry(): void { Flow.seed = newSeed(); depart(); }

// ---------- 보상 ----------
const rw = screen('s-reward', '보상', { enter() { renderReward(); } });

function itemCard(it: GearItem): string {
  const cur = G.save.gear.equipped[it.slot];
  const pct = (g: GearItem | undefined) => (g ? `${Math.round(GRADE[g.grade][0] * 100)}%` : '0%');
  const subs = (g: GearItem | undefined) => (g ? GRADE[g.grade][1] : 0);
  const isOn = cur?.id === it.id;
  return `<div class="rw-item" style="--g:${GRADE_STYLE[it.grade].color}">
    <div class="rw-box" aria-hidden="true"><span>${it.grade[0]}</span></div>
    <b>${it.grade} · ${esc(it.name)}</b><small>${slotName(it.slot)} · +${it.plus}${it.set ? ` · 세트 「${SETS[it.set].name}」` : ''}</small>
    <p class="cmp">${isOn ? '장착함' : `지금 ${cur ? `${cur.grade} ${esc(cur.name)}` : '빈칸'} → 힐량 ${pct(cur)} → ${pct(it)}, 보조 능력치 ${subs(cur)} → ${subs(it)}개`}</p>
  </div>`;
}

/** 길드원 경험치·인연 스카우트 (02 9장) */
function guildLines(gd: NonNullable<typeof Flow.settle>['guild']): string {
  if (!gd) return '';
  const ms = gd.members.length ? `<div><dt>길드원</dt><dd>${gd.members.map(m => `${esc(m.nick)} +${fmt(m.xp)}${m.ups.length ? ` <em class="lvup">Lv ${m.ups[m.ups.length - 1]}</em>` : ''}`).join(' · ')}${gd.fame ? ` · 명성 +${gd.fame}` : ''}</dd></div>` : '';
  const sc = gd.scout ? `<p class="coachtip">인연: <b>${esc(gd.scout.nick)}</b>(${CLASSES[gd.scout.cls].name}) 호감도 최대 · 길드 → 영입 → 인연 스카우트</p>` : '';
  return (ms ? `<dl class="metrics">${ms}</dl>` : '') + sc;
}

/** 직업 퀘스트 한 줄 (25 5-4) */
function heroQuestLine(q: NonNullable<typeof Flow.settle>['heroQuest']): string {
  if (!q) return '';
  const h = HEROES[q.hero], name = h.unlock.quest!.name;
  return `<p class="coachtip">직업 퀘스트 「${name}」 <b>${q.n} / ${q.need}</b>${q.unlocked ? ` · <b>${h.name} 해금!</b> 캐릭터 → 직업` : ''}</p>`;
}

function renderReward(): void {
  const x = Flow.settle!;
  const p = G.save.player;
  const need = xpToNext(p.level);
  const it = x.item ? G.save.gear.bag.find(b => b.id === x.item!.id) || Object.values(G.save.gear.equipped).find(b => b?.id === x.item!.id) : null;
  const r = Flow.result!;
  const canEquip = !!it && G.save.gear.bag.some(b => b.id === it.id);
  // 튜토리얼: 탐험 보상 = 첫 장비 장착 유도, 녹슨 요새 첫 클리어 = 끝 (09 4장)
  const tip = r.content === 'plateau' && G.save.tut === TUT.dungeon && canEquip ? '<p class="coachtip"><b>첫 장비</b>! 「장착」을 눌러 바로 사용. 힐량 상승</p>'
    : r.content === 'rustfort' && G.save.tut === TUT.done && x.first && r.diff === '쉬움' && !G.save.clears.rustfort?.['보통'] ? '<p class="coachtip">첫 던전 클리어! 튜토리얼은 여기까지. 다음은 녹슨 요새 <b>보통</b>. Lv 10에 특성 열림</p>' : '';
  rw.el.innerHTML = `${topBar()}
    <div class="ns-body reward">
      ${tip}
      ${it ? itemCard(it) : '<p class="note center">장비 없음</p>'}
      <dl class="metrics">
        <div><dt>골드</dt><dd>🪙 +${fmt(x.gold)}</dd></div>
        ${x.mats.stone || x.mats.refined ? `<div><dt>재료</dt><dd>강화석 +${x.mats.stone}${x.mats.refined ? ` · 정제 강화석 +${x.mats.refined}` : ''}</dd></div>` : ''}
        <div><dt>경험치</dt><dd>+${fmt(x.xp)}${x.levelUps.length ? ` <em class="lvup">레벨 업! Lv ${x.levelBefore} → ${p.level}</em>` : ''}</dd></div>
      </dl>
      ${heroQuestLine(x.heroQuest)}
      ${guildLines(x.guild)}
      <div class="xpbar" aria-label="경험치 ${fmt(p.xp)} / ${isFinite(need) ? fmt(need) : '최대'}"><i style="width:${isFinite(need) ? Math.min(100, (p.xp / need) * 100) : 100}%"></i><span>Lv ${p.level} · ${fmt(p.xp)} / ${isFinite(need) ? fmt(need) : '최대'}</span></div>
    </div>
    <footer class="ns-foot row3">
      ${canEquip ? `<button class="btn${tip && r.content === 'plateau' ? ' hi-pulse' : ''}" type="button" id="equipNow">장착</button>` : '<button class="btn" type="button" data-go="s-char">장비 보기</button>'}
      <button class="btn" type="button" id="again">다시 도전</button>
      <button class="btn primary" type="button" data-go="s-lobby">로비</button>
    </footer>`;
  if (x.levelUps.length && !shown.has(x)) { shown.add(x); showLevelUp(rw.el, x.levelUps); }
}
const shown = new WeakSet<object>();

rw.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('#equipNow') && Flow.settle?.item) { equip(Flow.settle.item.id); renderReward(); }
  else if (t.closest('#again')) { Flow.party = null; Flow.rerolls = 0; go('s-party'); }
});

// ---------- 레벨업 팝업 (P04) ----------
export function showLevelUp(host: HTMLElement, ups: number[]): void {
  const items = ups.flatMap(lv => (MILESTONES[lv] || []).map(m => ({ lv, ...m })));
  const box = document.createElement('div');
  box.className = 'overlay lvpop';
  box.innerHTML = `<div class="card" role="dialog" aria-label="레벨 업"><h3>레벨 업!</h3><p class="lvnum">Lv ${ups[0] - 1} → <b>${ups[ups.length - 1]}</b></p>
    <p class="lvgain">힐량·체력 ×${lvPower(ups[0] - 1).toFixed(2)} → <b>×${lvPower(ups[ups.length - 1]).toFixed(2)}</b></p>
    ${items.length ? `<ul>${items.map(m => `<li class="${m.live ? '' : 'later'}">Lv ${m.lv} · ${esc(m.text)}${m.live ? '' : ' <small>준비 중</small>'}</li>`).join('')}</ul>` : '<p class="note">새로 열린 기능 없음</p>'}
    <button class="btn primary" type="button">확인</button></div>`;
  box.querySelector('button')!.addEventListener('click', () => box.remove());
  host.appendChild(box);
}
