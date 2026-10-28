/**
 * S04 입장 = 주간 도전 「모래시계 시련」만 (13 3-2): 단계 고르기 · 제한시간 · 이번 주 어픽스 · 구간 · 보상, 아래 고정 붉은 「출전」 (→ 편성).
 * 던전·레이드는 2026-10-08부터 입장 화면 없이 전투 탭 「출전」 → 편성 (난이도는 전투 탭에서만, 적 레벨 = 장소 레벨 (61 · 2026-10-21 레이드도), 공략은 편성의 시트).
 */
import { contentOf } from '../data/content';
import { clearGold, clearXp, restRun } from '../data/progression';
import { Flow } from '../game/flow';
import { chalChestOf } from '../game/economy';
import { AFFIXES } from '../data/affixes';
import { CHAL, chalDropDiff, chalReward, chalShown } from '../data/challenge';
import { ITEM_GRADES } from '../data/equipment';
import { gearGradeOdds } from '../data/reward-preview';
import { nextWeekAffixes, runMode, weekAffixes } from '../game/runmode';
import { untilWeekReset, weekRemaining } from '../game/clock';
import { restBase } from '../game/stamina';
import { G } from '../game/state';
import { esc, fmt, go, mmss, previous, screen, topBar } from './kit';
import { currencyIcon, departureArrow, gameIcon, placeArt, uiIcon } from './art';
import { sortie } from './stamina';
import { afxIcon, timeline } from './brief';

/** 「←」 갈 곳: 로비 주간 도전 소켓에서 바로 왔으면 로비 (2026-10-22 Lim 「주간 도전 선택시 바로 주간도전 화면으로」), 전투 탭 도전 카드에서 왔으면 전투 탭. 편성 · 결과에서 돌아오면 그대로 */
let back = 's-content';
/** 열린 ⓘ (길드 화면과 같음: 규칙 · 긴 설명은 ⓘ 안에만) */
let tip: string | null = null;
const s = screen('s-entry', '주간 도전', { enter() { if (previous === 's-lobby' || previous === 's-content') back = previous; tip = null; render(); } });

const infoBtn = (key: string, label: string) => `<button type="button" class="g-info" data-tip="${key}" aria-expanded="${tip === key}" aria-label="${esc(label)} 설명">${uiIcon('info')}</button>`;
const tipBox = (key: string, html: string) => (tip === key ? `<div class="g-tip" role="note">${html}</div>` : '');
/** 길드 화면과 같은 판 (.g-card: 머리 = 그림 · 제목 · 숫자 · ⓘ, 몸) */
function card(o: { key: string; cls: string; icon: string; title: string; meta?: string; tip?: string; body: string }): string {
  return `<section class="g-card ${o.cls}" data-sec="${o.key}"><header class="g-hd"><span class="g-hi">${o.icon}</span><h3>${o.title}</h3>${o.meta ? `<span class="g-meta">${o.meta}</span>` : ''}${o.tip ? infoBtn(o.key, o.title) : ''}</header>${o.tip ? tipBox(o.key, o.tip) : ''}${o.body}</section>`;
}
const pill = (html: string, cls = '') => `<span class="g-pill${cls ? ` ${cls}` : ''}">${html}</span>`;
const pct = (n: number) => `+${Math.round(n * 100)}%`;
/** 상자 등급 「영웅 2」 · 「고급」 */
const gradeTxt = (gs: string[]) => [...new Set(gs)].map(g => `${g}${gs.filter(x => x === g).length > 1 ? ` ${gs.filter(x => x === g).length}` : ''}`).join(' · ');
/** 월요일 상자 등급이 오르는 단계 */
const MILES = [5, 10, 15, 20];

/**
 * 주간 도전 화면 (2026-10-22 Lim 「주간 디자인을 길드화면을 참조해서 일관성을 유지하여 개선하자」, 시안 A 「판 넷」, Lim 「a」): 길드 화면의 위 줄 · 그림 머리 · 판 · 줄 · 알약 · ⓘ · 붉은 출전을 그대로.
 * 나무 「← 모래시계 시련」 → 이번 주 던전 그림 머리 (길드 머리판처럼 두 줄) → 길드 판 넷: 도전 단계 (± · 수치 네 칸 · 단계 길) ·
 * 이번 주 어픽스 (줄 + 다음 주 알약) · 구간 · 보상 (세 칸 + 월요일 상자 = 길드 주간 목표 줄). 규칙 · 어픽스 공략은 ⓘ 안에만
 */
function render(): void {
  // 주간 도전이 아니면 편성으로 (예전 경로)
  if (!Flow.chal) { Flow.party = null; go('s-party'); return; }
  const c = contentOf(Flow.content), d = Flow.diff, open = G.save.chalOpen, st = Math.max(1, Math.min(open, CHAL.max, Flow.chal));
  Flow.chal = st;
  const m = runMode(G.save, c, d, { chal: st });
  const segs = c.fights(d), best = G.save.weekly.chalBest, lv = G.save.player.level;
  const bonus = chalReward(st), shown = chalShown(st);
  // 기본 값 (90 · 2026-10-17 Lim): 휴식이 없을 때 받는 값. 휴식 보너스는 결과 화면에서만. 보통 던전의 반 (110 2차) · 단계 보너스는 넣음 (110)
  const gold = restBase(restRun(clearGold(m.stage, d, 'A') * CHAL.rewardCut * bonus));
  const xp = restBase(restRun(clearXp(lv, d, 'A', { win: true }) * CHAL.rewardCut * bonus));
  const box = best ? chalChestOf(best, lv) : null;
  // 장비 최고 등급 = 실제 확률 (영웅 · 전설 확률까지, 출전 확률 창과 같은 dropOdds)에서 나오는 가장 높은 등급 (103)
  const chalOdds = gearGradeOdds(chalDropDiff(st), 0, lv), chalTop = [...ITEM_GRADES].reverse().find(g => chalOdds[g] > 0) ?? ITEM_GRADES[0]; // 상자 등급은 내 레벨로 (Lv 45 전 영웅 없음, 103)
  const next = nextWeekAffixes();

  // 그림 머리: 길드 머리판과 같은 두 줄 (던전 이름 · 인원 구간 / 「이번 주 던전」 칸 + 바뀌기까지 남은 시간 막대 = 길드 Lv + 명성 막대 자리)
  const art = placeArt(c.key).url, left = Math.max(0, Math.min(1, untilWeekReset() / (7 * 86400e3)));
  const hero = `<header class="art-hero wc-hero"${art ? ` style="--hero-art:url('${art}')"` : ''}><div class="ah-copy"><h2>${esc(c.name)}</h2></div>
      <span class="wc-hcap"><span>${c.size(d)}인</span><b>${segs.length}구간</b></span>
      <span class="wc-hrow"><span class="wc-hlv">${gameIcon('challenge', '')}<span>이번 주 던전</span></span><span class="wc-hbar" role="img" aria-label="던전 교체까지 ${weekRemaining()}"><i style="width:${(left * 100).toFixed(1)}%"></i><small aria-hidden="true">${weekRemaining()} 남음</small></span></span></header>`;

  // 도전 단계 판 (머리 = 열린 단계 · ⓘ)
  const stageTip = `<p>제한시간 안에 깨면 다음 단계가 열립니다. 지거나 시간을 넘겨도 열린 단계는 그대로입니다.</p>
      <p>단계마다 적 체력 +${Math.round(CHAL.hpStep * 100)}% · 피해 ${pct(CHAL.dmgRate - 1)}, 골드 · 경험치 ${pct(CHAL.rewardStep)}씩 오릅니다.</p>
      <p>던전은 매주 월요일 내 레벨 이하 던전 가운데 하나로 바뀌고, 적은 내 레벨입니다.</p>`;
  const stage = card({ key: 'stage', cls: 'wc-overview', icon: gameIcon('challenge', ''), title: '도전 단계', meta: `열림 ${open}<small> / ${CHAL.max}</small>`, tip: stageTip,
    body: `<div class="wc-stagebody"><div class="chalstep"><button class="btn2" type="button" data-cstep="-1" aria-label="한 단계 아래"${st <= 1 ? ' disabled' : ''}>−</button><b aria-live="polite">${st}단계</b><button class="btn2" type="button" data-cstep="1" aria-label="한 단계 위"${st >= open ? ' disabled' : ''}>+</button></div>
        <dl class="f-cinfo"><div><dt>제한시간</dt><dd>${mmss(m.limit!)}</dd></div><div><dt>적 체력</dt><dd>${pct(shown.hp)}</dd></div><div><dt>적 피해</dt><dd>${pct(shown.dmg)}</dd></div><div class="wc-bonus"><dt>보상</dt><dd>${pct(bonus - 1)}</dd></div></dl>
        ${track(st, open, best, lv)}</div>` });

  // 이번 주 어픽스 (줄 + 다음 주 알약) · 구간 · 보상 (세 칸 + 보너스 알약 + 월요일 상자 줄)
  // 이번 주 어픽스 셋 (115 나안): 셋째는 CHAL.third단계부터, 그 아래 단계를 고르면 셋째 줄은 흐리게 + 「10단계부터」
  const week = weekAffixes();
  const afxTip = week.map(k => `<p><b>${AFFIXES[k].name}</b>${esc(AFFIXES[k].tip)}</p>`).join('') + `<p>셋째 어픽스는 ${CHAL.third}단계부터 붙습니다. 어픽스는 월요일 오전 6시에 바뀝니다.</p>`;
  const afx = `<ul class="g-rows wc-afx">${week.map((k, i) => {
    const later = i >= 2, off = later && !m.affixes.includes(k);
    return `<li class="g-row${off ? ' wc-later' : ''}"><span class="g-ri">${afxIcon(k)}</span><div class="g-rm"><b>${AFFIXES[k].name}</b><span class="g-sub wrap">${esc(AFFIXES[k].desc)}</span></div>${later ? `<span class="g-rs">${pill(`${CHAL.third}단계부터`, off ? '' : 'warn')}</span>` : ''}</li>`;
  }).join('')}</ul>
      <p class="wc-next"><span class="cap">다음 주</span>${next.map(k => pill(`${afxIcon(k)}${AFFIXES[k].name}`)).join('')}</p>`;
  const tags = [bonus > 1 ? `${st}단계 보너스 ${pct(bonus - 1)}` : ''].filter(Boolean);
  const rewardTip = `<p>골드 · 경험치는 보통 던전 한 판의 반에 단계 보너스를 더한 값입니다. 휴식 보너스는 결과에서 더해집니다.</p><p><b>월요일 상자</b>이번 주 최고 단계로 다음 월요일에 받습니다. 5단계 고급 · 10단계 희귀 · 15단계 영웅 · 20단계 영웅 2, 골드는 5단계마다 늘어납니다.</p>`;
  // 월요일 상자 줄 = 길드 「주간 목표」 줄 (그림 · 이름 · 다음 등급 · 막대 / 오른쪽 이번 주 최고 / 다음 단계 · 지금 상자 알약)
  const nm = MILES.find(n => n > best) ?? CHAL.max, prev = [...MILES].reverse().find(n => n <= best) ?? 0, full = best >= CHAL.max;
  const chestPill = box ? (box.grades.length ? pill(gradeTxt(box.grades)) : pill(`${currencyIcon('gold')}${fmt(box.gold)}`, 'fame')) : '';
  const chest = `<li class="g-row wc-chest2"><span class="g-ri">${gameIcon('chest', '')}</span><div class="g-rm"><b>월요일 상자</b><span class="g-sub">${full ? '최고 단계 달성' : `${nm}단계 ${gradeTxt(chalChestOf(nm, lv).grades)}`}</span><span class="g-bar" role="img" aria-label="이번 주 최고 ${best}단계 · 다음 상자 ${nm}단계"><i style="width:${full ? 100 : Math.round(((best - prev) / (nm - prev)) * 100)}%"></i></span></div>
      <span class="g-rs"><b class="g-num">${best}<small> / ${nm}</small></b>${chestPill}</span></li>`;
  const rewards = `<div class="wc-reward-grid"><div>${gameIcon('gear', '')}<span>장비<b>1개</b><small>${chalTop}까지</small></span></div><div>${currencyIcon('gold')}<span>골드<b>${fmt(gold)}</b></span></div><div>${gameIcon('a2-goal-book-r6', '')}<span>경험치<b>약 ${fmt(xp)}</b></span></div></div>
      ${tags.length ? `<p class="wc-tags">${tags.map(t => pill(t, 'ok')).join('')}</p>` : ''}<ul class="g-rows">${chest}</ul>`;
  const cards = [
    card({ key: 'afx', cls: 'wc-affixes', icon: gameIcon('gim-pulse', ''), title: '이번 주 어픽스', tip: afxTip, body: afx }),
    card({ key: 'route', cls: 'wc-route', icon: gameIcon('dungeon', ''), title: '구간', meta: `${segs.length}<small> 구간</small>`, body: `<div class="wc-tl">${timeline(segs)}</div>` }),
    card({ key: 'reward', cls: 'f-rw wc-rewards', icon: gameIcon('chest', ''), title: '보상', meta: '<small>클리어마다</small>', tip: rewardTip, body: rewards }),
  ].join('');

  s.el.innerHTML = `${topBar({ back, title: CHAL.name })}
    <div class="ns-body f-ebody wc-body">${hero}${stage}${cards}</div>
    <footer class="ns-foot g-foot wc-foot"><button type="button" class="g-cta" id="entryGo" aria-label="출전 · 주간 도전 ${st}단계"><span class="g-mk" aria-hidden="true"><span>${gameIcon('challenge', '')}</span></span><span class="g-ct"><b>출전</b><small>주간 도전 ${st}단계</small></span>${departureArrow()}</button></footer>`;
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
  const marks = MILES.map(n => { const g = chalChestOf(n, lv).grades; return `<span class="${best >= n ? 'reached' : ''}" style="--at:${n}"><small>${n}</small>${g[0]}${g.length > 1 ? ` ${g.length}` : ''}</span>`; }).join('');
  return `<div class="wc-track" role="img" aria-label="단계 ${st} · 열린 단계 ${open} · 이번 주 최고 ${best || 0} · 월요일 상자 5단계 고급 · 10단계 희귀 · 15 · 20단계 영웅"><div class="wc-pips">${pips}</div><div class="wc-marks">${marks}</div></div>`;
}

s.el.addEventListener('click', e => {
  const ib = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (ib) { tip = tip === ib.dataset.tip ? null : ib.dataset.tip!; render(); return; }
  const cs = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cstep]');
  if (cs && !cs.disabled) { Flow.chal += Number(cs.dataset.cstep); render(); return; }
  // 81 · 90: 편성 (파티원 보기) 전에 입장 확인
  if ((e.target as HTMLElement).closest('#entryGo')) sortie();
});
