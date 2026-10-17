/**
 * 휴식 화면 조각 (90, 예전 81 2장): 위 줄 칸 · 휴식 창 (다음 충전 시간 · 광고 충전) · 입장 확인 팝업.
 * 규칙은 game/stamina.ts (코드 이름은 stamina 그대로). 팝업은 .admodal 위에 그리고, 닫으면 연 버튼으로 초점을 돌려준다.
 */
import { CHAL } from '../data/challenge';
import { contentOf } from '../data/content';
import { REST_BONUS, STAMINA } from '../data/economy';
import { Flow } from '../game/flow';
import { commit, G } from '../game/state';
import { adCharge, adsFree, restSpend, staminaClock, staminaCost, staminaView } from '../game/stamina';
import { TUT } from '../game/tutorial';
import { showRewarded } from '../platform/ads';
import { currencyIcon } from './art';
import { esc, fmt, go } from './kit';

const view = () => staminaView(G.save, Date.now());
const amount = (n: number, unlimited: boolean) => (unlimited ? '∞' : fmt(n));

/**
 * 위 줄 (topBar) 휴식 칸: 누르면 휴식 창. 숫자 · 고리 · 시간은 1초마다 고침 (refreshCells).
 * 2026-10-16 Lim 「8분에 1씩 차는것도 UI로」: 달 그림 둘레 고리가 다음 +1까지 차고 (90: 15분), 숫자 아래 초록 「+1」 배지 + 남은 시간 (가득이면 「가득」).
 * 「+1 4:59」가 「14:59」로 읽혀서 (Lim) +1은 글자가 아니라 배지로 떼어 둠
 */
export function staminaCell(): string {
  const v = view(), label = staminaLabel();
  return `<button class="tb-cur tb-st" type="button" data-stamina-open aria-label="${label}" title="${label}"><span class="tb-st-ic" data-stam-ring style="--p:${ringOf(v).toFixed(3)}">${currencyIcon('rest')}</span><span class="tb-st-v"><b data-stam-n>${amount(v.n, v.unlimited)}</b><small data-stam-max>/${v.max}</small></span><small class="tb-st-t"><i class="tb-st-plus" aria-hidden="true"${charging(v) ? '' : ' hidden'}>+1</i><span data-stam-tb>${nextText(v)}</span></small></button>`;
}
/** 고리 채움 (0~1): 다음 +1까지 지난 몫. 가득 · 무제한이면 1 */
const ringOf = (v: ReturnType<typeof view>) => (v.unlimited || !v.next ? 1 : Math.min(1, Math.max(0, 1 - v.next / STAMINA.regenMs)));
/** 차는 중 (다음 +1까지 시간이 있음) */
const charging = (v: ReturnType<typeof view>) => !v.unlimited && !!v.next;
/** 숫자 아래 한 줄: 다음 +1까지 남은 시간 (앞의 「+1」은 배지) · 가득 · 무제한 */
const nextText = (v: ReturnType<typeof view>) => (v.unlimited ? '무제한' : v.next ? staminaClock(v.next) : '가득');
function staminaLabel(): string {
  const v = view();
  return `휴식 ${v.unlimited ? '무제한' : `${v.n} / ${v.max}`}${!v.unlimited && v.next ? ` · 다음 1까지 ${staminaClock(v.next)}` : ''}`;
}

// ---------- 팝업 틀 ----------
let pop: HTMLElement | null = null;
let opener: HTMLElement | null = null;

function close(): void {
  pop?.remove(); pop = null;
  opener?.focus({ preventScroll: true }); opener = null;
}

/** 팝업을 열거나 내용만 바꿈. 처음 열면 첫 버튼 (또는 primary)으로 초점 */
function show(cls: string, html: string): HTMLElement {
  if (!pop) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pop = document.createElement('div');
    pop.className = 'admodal st-modal';
    (document.getElementById('app') || document.body).appendChild(pop);
  }
  pop.innerHTML = `<section class="panel st-pop ${cls}" role="dialog" aria-modal="true" aria-labelledby="stTitle">${html}</section>`;
  (pop.querySelector<HTMLElement>('.btn.primary:not(:disabled)') || pop.querySelector<HTMLElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
  return pop;
}

document.addEventListener('keydown', e => {
  if (!pop) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
  if (e.key !== 'Tab') return;
  // 팝업 안에서만 돌기
  const btns = Array.from(pop.querySelectorAll<HTMLElement>('button:not(:disabled)'));
  if (!btns.length) return;
  const i = btns.indexOf(document.activeElement as HTMLElement);
  e.preventDefault();
  btns[(i + (e.shiftKey ? btns.length - 1 : 1) + btns.length) % btns.length].focus();
}, true);

/** 미터 줄: 아이콘 · 지금/최대 · 막대 */
function meter(extraCls = ''): string {
  const v = view(), pct = v.unlimited ? 100 : Math.min(100, (v.n / v.max) * 100);
  return `<div class="st-meter${extraCls}">${currencyIcon('rest')}<b data-stam-n>${amount(v.n, v.unlimited)}</b><small data-stam-max>/${v.max}</small>
    <span class="st-bar${v.n > v.max ? ' over' : ''}" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span></div>`;
}

/** 다음 충전 · 가득까지 */
function timeRows(): string {
  const v = view();
  if (v.unlimited) return '<p class="st-time">개발 빌드 · 휴식 무제한</p>';
  if (!v.next) return `<p class="st-time">${v.n > v.max ? '최대치 넘음 · 쓰면 다시 참' : '가득 참'}</p>`;
  return `<p class="st-time"><span>다음 +1 <b data-stam-next>${staminaClock(v.next)}</b></span><span>가득까지 <b data-stam-full>${staminaClock(v.full)}</b></span></p>`;
}

/** 광고 충전 버튼 (광고 제거 패키지면 광고 없이 바로) */
function adButton(primary: boolean): string {
  const v = view(), free = adsFree(G.save), left = v.adsLeft;
  const label = `${free ? '바로' : '광고 보고'} +${STAMINA.ad}`;
  return `<button class="btn${primary ? ' primary' : ''} st-ad" type="button" data-st="ad"${left ? '' : ' disabled'}>${label}<small>오늘 ${left}/${STAMINA.adDaily}</small></button>`;
}

/** 광고 보고 충전. 했으면 true */
async function charge(): Promise<boolean> {
  if (view().adsLeft <= 0) return false;
  if (!(await showRewarded(`휴식 +${STAMINA.ad}`, adsFree(G.save)))) return false;
  const err = adCharge(G.save, Date.now());
  if (err) return false;
  commit();
  refreshCells();
  return true;
}

// ---------- 휴식 창 (위 줄 칸 · 상점) ----------
export function openStamina(): void {
  const render = (msg = '') => {
    const el = show('st-info', `<h3 id="stTitle">휴식</h3>${meter()}${timeRows()}
      <p class="note">${STAMINA.regenMs / 60e3}분마다 1씩 찹니다. 휴식이 있으면 클리어할 때 콘텐츠만큼 쓰고 경험치 · 골드를 휴식 보너스로 ×${REST_BONUS} 받습니다. 광고 충전은 최대치를 넘어도 들어갑니다.</p>
      ${msg ? `<p class="st-msg" role="status">${esc(msg)}</p>` : ''}
      <div class="st-btns">${adButton(true)}<button class="btn" type="button" data-st="shop">상점</button><button class="btn" type="button" data-st="no">닫기</button></div>`);
    el.onclick = async e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-st]');
      if (!b || b.disabled) { if (e.target === el) close(); return; }
      const k = b.dataset.st;
      if (k === 'no') close();
      else if (k === 'shop') { close(); go('s-shop', 'cash'); }
      else if (k === 'ad' && await charge()) render(`휴식 +${STAMINA.ad}`);
    };
  };
  render();
}

// ---------- 입장 확인 (81 2-3 · 90): 언제나 「입장」. 휴식은 클리어할 때 씀. 휴식이 있으면 「휴식 보너스 ×N」, 0이면 「휴식이 있으면 보너스 ×N」 + 광고 충전 ----------
export interface EntryOpts { name: string; sub: string; cost: number; onGo(): void }

export function confirmEntry(o: EntryOpts): void {
  const render = (msg = '') => {
    const v = view(), empty = !v.unlimited && v.n < 1;
    // 보유 (왼쪽) · 소모 (오른쪽) 두 칸 (Lim 2026-10-16: 보유는 지금 값만, 입장 후 값 · 안내 문장 없음).
    // 소모 = 클리어할 때 실제로 쓸 휴식 (2026-10-17 Lim 「실제 쓰는 값」, restSpend): 0이면 0 · 모자라면 남은 만큼. 원래 비용은 따로 안 적음. 1초마다 보유와 함께 고침 (data-stam-use)
    // 2026-10-17 Lim 「휴식이 있으면 보너스를 준다고 해야 반감을 적게」: 휴식이 있으면 남빛 「휴식 보너스 ×N」, 0이면 빨간 테 없이 중립색 「휴식이 있으면 보너스 ×N」 + 광고 충전
    const cell = (cls: string, label: string, val: string) => `<div class="st-c ${cls}"><dt>${label}</dt><dd>${val}</dd></div>`;
    const cost = `<dl class="st-cost">
      ${cell('st-have', '보유', `${currencyIcon('rest')}<b data-stam-n>${amount(v.n, v.unlimited)}</b>`)}
      ${cell('st-need', '소모', `${currencyIcon('rest')}<b data-stam-use="${o.cost}">${fmt(restSpend(G.save, o.cost, Date.now()))}</b>`)}</dl>`;
    const dest = `<p class="st-dest"><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></p>`;
    const bonus = empty ? `<p class="st-bonus off">휴식이 있으면 보너스 ×${REST_BONUS}</p>` : `<p class="st-bonus">휴식 보너스 ×${REST_BONUS}</p>`;
    const el = show(`st-entry${empty ? ' empty' : ''}`, `<h3 id="stTitle">입장</h3>${dest}${cost}
      ${bonus}
      ${msg ? `<p class="st-msg" role="status">${esc(msg)}</p>` : ''}
      ${empty ? `<div class="st-btns">${adButton(false)}</div>` : ''}
      <div class="row2"><button class="btn" type="button" data-st="no">취소</button><button class="btn primary" type="button" data-st="go">입장</button></div>`);
    el.onclick = async e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-st]');
      if (!b || b.disabled) { if (e.target === el) close(); return; }
      const k = b.dataset.st;
      if (k === 'no') close();
      else if (k === 'ad') { if (await charge()) render(`휴식 +${STAMINA.ad}`); }
      else if (k === 'go') {
        pop?.remove(); pop = null; opener = null;
        o.onGo();
      }
    };
  };
  render();
}

/** 지금 Flow (장소 · 난이도 · 주간 도전 단계)의 입장 확인. 튜토리얼은 팝업 없이 바로 */
export function payEntry(onGo: () => void): void {
  if (G.save.tut < TUT.done) { onGo(); return; }
  const c = contentOf(Flow.content), size = `${c.size(Flow.diff)}인`;
  confirmEntry({ name: Flow.chal ? CHAL.name : c.name, sub: Flow.chal ? `주간 도전 ${Flow.chal}단계 · ${size}` : `${Flow.diff} · ${size}`, cost: staminaCost(c, Flow.chal), onGo });
}

/**
 * 출전 (Lim 2026-10-15 「출전 버튼 다음에 팝업」): 파티원을 보기 전에 입장 확인을 거쳐 편성으로.
 * 편성 「출발」은 확인한 판이면 바로 전투 (party.ts). 휴식은 클리어할 때 씀 (90)
 */
export function sortie(): void {
  payEntry(() => { Flow.party = null; Flow.rerolls = 0; Flow.paid = G.save.tut >= TUT.done; go('s-party'); });
}

// ---------- 1초마다: 보이는 휴식 숫자 · 시간 ----------
export function refreshCells(): void {
  if (typeof document === 'undefined') return;
  const v = view();
  document.querySelectorAll<HTMLElement>('[data-stam-n]').forEach(el => { el.textContent = amount(v.n, v.unlimited); });
  document.querySelectorAll<HTMLElement>('[data-stam-max]').forEach(el => { el.textContent = `/${v.max}`; });
  document.querySelectorAll<HTMLElement>('[data-stam-use]').forEach(el => { el.textContent = fmt(restSpend(G.save, Number(el.dataset.stamUse), Date.now())); });
  document.querySelectorAll<HTMLElement>('[data-stam-next]').forEach(el => { el.textContent = staminaClock(v.next); });
  document.querySelectorAll<HTMLElement>('[data-stam-full]').forEach(el => { el.textContent = staminaClock(v.full); });
  document.querySelectorAll<HTMLElement>('[data-stam-tb]').forEach(el => {
    el.textContent = nextText(v);
    const plus = el.previousElementSibling as HTMLElement | null;
    if (plus?.classList.contains('tb-st-plus')) plus.hidden = !charging(v);
  });
  document.querySelectorAll<HTMLElement>('[data-stam-ring]').forEach(el => { el.style.setProperty('--p', ringOf(v).toFixed(3)); });
  document.querySelectorAll<HTMLElement>('[data-stamina-open]').forEach(el => { const l = staminaLabel(); el.setAttribute('aria-label', l); el.title = l; });
}

if (typeof window !== 'undefined') {
  setInterval(() => { if (document.querySelector('[data-stam-n]')) refreshCells(); }, 1000);
  document.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-stamina-open]');
    if (b && b.closest('#app')) openStamina();
  });
}
