/**
 * 휴식 화면 조각 (90, 예전 81 2장): 위 줄 칸 · 휴식 창 (막대 · 광고 충전) · 출전 (입장 확인 팝업은 2026-10-17에 없앰).
 * 규칙은 game/stamina.ts (코드 이름은 stamina 그대로). 팝업은 .admodal 위에 그리고, 닫으면 연 버튼으로 초점을 돌려준다.
 */
import { REST_BONUS, STAMINA } from '../data/economy';
import { t } from '../i18n';
import { Flow } from '../game/flow';
import { commit, G } from '../game/state';
import { adCharge, staminaClock, staminaView } from '../game/stamina';
import { showRewarded } from '../platform/ads';
import { currencyIcon } from './art';
import { fmt, go } from './kit';
import { notify } from './toast';
import { sfx } from '../sfx';
import { now as gameNow } from '../platform/time';

const view = () => staminaView(G.save, gameNow());
const amount = (n: number, unlimited: boolean) => (unlimited ? '∞' : fmt(n));

/**
 * 위 줄 (topBar) 휴식 칸: 누르면 휴식 창. 숫자는 1초마다 고침 (refreshCells).
 * 2026-10-16 「+1」 배지 · 남은 시간은 2026-10-20에, 다음 +1까지 차던 달 둘레 고리는 2026-10-22 Lim 「휴식 아이콘 사이즈를 골드와 동일하게해서 두줄 로 나란히」로 뺌.
 * 그림 + 지금/최대 한 줄, 그 아래 줄에 골드 (kit.ts goldCell). 남은 시간은 읽어 주는 글에만 (휴식 창에서도 2026-10-28에 뺌)
 */
export function staminaCell(): string {
  const v = view(), label = staminaLabel();
  // 2026-10-20 Lim 「헤더에 휴식게이지에 배경이미지와 시간표시제거, 가득찾을때 최대 같은 텍스트 제거」: 그림 + 지금/최대만 (남은 시간 · 가득 · 무제한 글은 팝업 · 읽어 주는 글에만)
  return `<button class="tb-cur tb-st" type="button" data-stamina-open aria-label="${label}" title="${label}"><span class="tb-st-ic">${currencyIcon('rest')}</span><span class="tb-st-v"><b data-stam-n>${amount(v.n, v.unlimited)}</b><small data-stam-max>/${v.max}</small></span></button>`;
}
function staminaLabel(): string {
  const v = view();
  return `${t('휴식')} ${v.unlimited ? t('무제한') : `${v.n} / ${v.max}`}${!v.unlimited && v.next ? ` · ${t('다음 1까지 {t}', { t: staminaClock(v.next) })}` : ''}`;
}

// ---------- 팝업 틀 ----------
let pop: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let charging = false;

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

/** 보상형 광고 충전 버튼 (구매 여부와 관계없이 시청 필요) */
function adButton(): string {
  const v = view(), left = v.adsLeft;
  const full = v.n >= v.max;
  const label = full ? t('휴식 가득 참') : t('광고 보고 최대 충전');
  return `<button class="btn primary st-ad" type="button" data-st="ad"${left && !full && !charging ? '' : ' disabled'}>${label}<small>${t('오늘 {a}/{b}', { a: left, b: STAMINA.adDaily })}</small></button>`;
}

/** 광고 보고 충전. 했으면 true */
async function charge(): Promise<boolean> {
  const v = view();
  if (charging || v.adsLeft <= 0 || v.n >= v.max) return false;
  const save = G.save, opened = pop;
  charging = true;
  try {
    if (!(await showRewarded(t('휴식 최대 충전'), () => G.save === save && pop === opened && !!opened?.isConnected && view().adsLeft > 0 && view().n < view().max))) return false;
    if (G.save !== save) return false;
    const err = adCharge(save, gameNow());
    if (err) return false;
    sfx('rest-charge');
    commit();
    refreshCells();
    return true;
  } finally { charging = false; }
}

// ---------- 휴식 창 (위 줄 칸 · 상점) ----------
/** 2026-10-28 Lim: 「다음 +1 · 가득까지」 시간 줄은 없앰, 설명은 두 줄 (남은 시간은 위 칸 읽어 주는 글에만) */
export function openStamina(): void {
  const render = () => {
    const el = show('st-info', `<h3 id="stTitle">${t('휴식')}</h3>${meter()}
      <p class="note">${t('{m}분마다 1씩 찹니다. 클리어할 때 써서 경험치 · 골드를 {x}배로 받습니다.', { m: STAMINA.regenMs / 60e3, x: REST_BONUS })}</p>
      <div class="st-btns">${adButton()}<button class="btn" type="button" data-st="no">${t('닫기')}</button></div>`);
    el.onclick = async e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-st]');
      if (!b || b.disabled) { if (e.target === el) close(); return; }
      const k = b.dataset.st;
      if (k === 'no') close();
      else if (k === 'ad') {
        b.disabled = true;
        const charged = await charge();
        if (pop === el) render();
        if (charged) notify(t('휴식 최대 충전'));
      }
    };
  };
  render();
}

/**
 * 출전 (90 · 2026-10-17 Lim 「출전전 휴식 팝업은 제거」): 입장 확인 팝업 없이 바로 편성으로. 편성 「출발」은 바로 전투 (party.ts).
 * 휴식은 클리어할 때 쓰고, 전투 전에는 휴식을 보여 주지 않음 (충전은 위 휴식 칸 · 로비 소켓 · 상점)
 */
export function sortie(): void {
  sfx('sortie');
  Flow.party = null;
  go('s-party');
}

// ---------- 1초마다: 보이는 휴식 숫자 ----------
export function refreshCells(): void {
  if (typeof document === 'undefined') return;
  const v = view();
  document.querySelectorAll<HTMLElement>('[data-stam-n]').forEach(el => { el.textContent = amount(v.n, v.unlimited); });
  document.querySelectorAll<HTMLElement>('[data-stam-max]').forEach(el => { el.textContent = `/${v.max}`; });
  document.querySelectorAll<HTMLElement>('[data-stamina-open]').forEach(el => { const l = staminaLabel(); el.setAttribute('aria-label', l); el.title = l; });
}

if (typeof window !== 'undefined') {
  setInterval(() => { if (document.querySelector('[data-stam-n]')) refreshCells(); }, 1000);
  document.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-stamina-open]');
    if (b && b.closest('#app')) openStamina();
  });
}
