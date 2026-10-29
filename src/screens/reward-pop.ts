/**
 * 보상 창 (2026-10-24 Lim 「장비 획득시 연출과 함께 획득 장비를 팝업으로 보여주고 효과음도 넣어줘. 그리고 골드 획득도 팝업으로 효과음과 함께」
 * → 시안 판 「보상 팝업 시안」 A · 골드 소리 1 · 장비 소리 1 「추천대로」).
 * 임무 받기 · 완료 상자 (한 번 더 · 놓친 날) · 주간 도전 상자 (임무 · 로비) · 길드 원정 상자 · 길드 주간 목표 (명성)가 같은 창을 쓴다.
 * 장비 판매 · 전투 결과 · 행상인 사기는 안 씀 (판매는 여러 개 팔 때마다 뜨고, 결과 · 행상인은 보상 판 · 감정 창이 있음).
 * 골드 · 명성만: 금화가 튀고 숫자가 오른 뒤 1.6초에 저절로 닫힘. 장비가 있으면: 상자가 흔들리다 터지고 장비가 등급 색 테로 튀어나옴
 * (영웅 이상 · 정교한 · 완벽한은 빛기둥), 「확인」까지 남음. 아무 곳이나 · 뒤로가기 (Esc)로도 닫힘.
 * 소리: 받기 소리 (임무 도장 · 상자 걸쇠)는 부른 쪽이 그대로 내고, 여기서는 금화 = gold-gain (결과 화면 골드), 장비 = 가장 좋은 장비 등급 소리 (lootSound).
 * 시각 효과 줄이기 · 기기 동작 줄이기면 움직임 없이 결과만. Playwright (navigator.webdriver)는 안 띄움 (다른 화면 검사가 창에 막히지 않게), 검사는 window.__rewardPopTest = true
 */
import { GRADE_STYLE, kindOf, qualityOf, slotName, type GearItem, type ItemGrade } from '../data/equipment';
import { t } from '../i18n';
import { scoreOf } from '../game/charinfo';
import { G } from '../game/state';
import { art } from '../art';
import { sfx } from '../sfx';
import { esc, fmt } from './kit';
import { currencyIcon, gameIcon, gearIcon } from './art';
import { lootSound } from './ui-sound';
import './reward-pop.css';

export interface Reward { title: string; gold?: number; fame?: number; items?: GearItem[] }

const GRADE_INK: Record<ItemGrade, string> = { '일반': '#E4E0D8', '고급': '#8BEA9C', '희귀': '#8DBEFF', '영웅': '#D7A6FF', '전설': '#FFE680' };
/** 골드 · 명성만인 창이 저절로 닫히기까지 (초) */
const AUTO_CLOSE = 1.6;
/** 연출 때 (초): 골드만 = 금화 0.12, 장비 = 상자 흔들림 0.5 → 장비 0.55 → 이름 0.85 → 골드 알약 0.95 */
const AT = { coin: 0.12, item: 0.55, info: 0.85, gold: 0.95, ok: 1.05 };

let box: HTMLElement | null = null, timer = 0, raf = 0, back: Element | null = null, appWas = false;

const off = (): boolean => navigator.webdriver && !(window as unknown as { __rewardPopTest?: boolean }).__rewardPopTest;
const calm = (): boolean => G.save.settings.reducedEffects || matchMedia('(prefers-reduced-motion: reduce)').matches;
const gv = (it: GearItem) => `--g:${GRADE_STYLE[it.grade].color};--gi:${GRADE_INK[it.grade]}`;
const d = (s: number) => `--d:${s.toFixed(2)}s`;

/** 사방으로 튀는 금화 (자리는 고정 값, 게임 난수를 쓰지 않음) */
function coins(at: number, icon: string): string {
  let h = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + (i % 2 ? 0.3 : -0.2), r = 95 * (0.65 + ((i * 37) % 10) / 22);
    h += `<span class="rw-coin" style="${d(at + (i % 4) * 0.03)};--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r * 0.8 + 18).toFixed(0)}px;--rot:${(i * 47) % 300 - 150}deg">${icon}</span>`;
  }
  return h;
}

function itemsHtml(items: GearItem[]): string {
  const size = items.length === 1 ? 'one' : items.length <= 3 ? 'few' : 'many';
  const beam = art('fx-loot-beam'), twk = art('fx-gear-twinkle');
  return `<div class="rw-box gear"><span class="rw-chest">${gameIcon('chest', '')}</span>
    <div class="rw-items ${size}">${items.map((it, i) => {
      const at = AT.item + i * 0.14, big = it.grade === '영웅' || it.grade === '전설' || !!qualityOf(it);
      return `<div class="rw-it" style="${gv(it)};${d(at)}">${big && beam ? `<span class="rw-beam" style="--beam:url('${beam}');${d(at + 0.05)}"></span>` : ''}<span class="rw-frame">${gearIcon(it)}</span>${twk ? `<img class="rw-twk" src="${twk}" alt="" style="${d(at)}">` : ''}</div>`;
    }).join('')}</div></div>`;
}

function infoHtml(items: GearItem[]): string {
  if (items.length === 1) {
    const it = items[0], q = qualityOf(it);
    return `<div class="rw-info" style="${gv(it)};${d(AT.info)}"><p class="rw-grade"><i>${t(it.grade)}</i>${q ? ` <span class="rw-q" data-q="${q}">${t(q)}</span>` : ''}</p>
      <h4 class="rw-name">${esc(t(it.name))}</h4><p class="rw-sub">${t('점수 {n}', { n: scoreOf(it) })} · ${esc(t(slotName(it.slot)))} · ${esc(t(kindOf(it).name))}${it.lv ? ` · Lv ${it.lv}` : ''}</p></div>`;
  }
  return `<ul class="rw-info rw-names" style="${d(AT.info)}">${items.map(it => `<li style="${gv(it)}"><i>${t(it.grade)}</i><b>${esc(t(it.name))}</b></li>`).join('')}</ul>`;
}

/** 숫자 칸: 0부터 올라감 (data-to · data-at) */
const num = (to: number, at: number) => `<b data-to="${to}" data-at="${at}">${calm() ? fmt(to) : 0}</b>`;

function html(r: Reward): string {
  const items = r.items ?? [], gold = r.gold ?? 0, fame = r.fame ?? 0, gear = items.length > 0;
  const goldIc = currencyIcon('gold'), fameIc = gameIcon('guild-fame', '');
  let body: string;
  if (gear) {
    const pills = [gold ? `<span class="rw-pill" aria-label="${t('골드 {n}', { n: fmt(gold) })}">${goldIc}${num(gold, AT.gold)}</span>` : '', fame ? `<span class="rw-pill fame" aria-label="${t('명성 {n}', { n: fmt(fame) })}">${fameIc}${num(fame, AT.gold)}</span>` : ''].join('');
    body = `${itemsHtml(items)}${infoHtml(items)}${pills ? `<p class="rw-pills" style="${d(AT.gold)}">${pills}</p>` : ''}`;
  } else {
    // 골드 · 명성만: 큰 그림 하나 (골드가 있으면 골드), 숫자 줄은 둘 다
    const ic = gold ? goldIc : fameIc;
    const line = (n: number, label: string) => `<p class="rw-num" aria-label="${label} ${fmt(n)}">${num(n, AT.coin)}<span>${label}</span></p>`;
    body = `<div class="rw-box"><span class="rw-rays" style="${d(0)}"></span><span class="rw-big" style="${d(0)}">${ic}</span>${coins(0.08, ic)}</div>
      <div class="rw-info" style="${d(0.2)}">${gold ? line(gold, t('골드')) : ''}${fame ? line(fame, t('명성')) : ''}</div>`;
  }
  return `<div class="rw-dim"></div>
    <div class="rw-card" role="dialog" aria-modal="true" aria-labelledby="rwTitle" tabindex="-1">
      <h3 class="rw-ribbon" id="rwTitle">${esc(r.title)}</h3>
      ${body}
      <button class="btn primary rw-ok" type="button" style="${d(gear ? AT.ok : 0.5)}">${t('확인')}</button>
      ${gear ? '' : `<span class="rw-auto" aria-hidden="true"><i style="animation-duration:${AUTO_CLOSE}s"></i></span>`}
    </div>`;
}

function countUp(root: HTMLElement): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-to]'));
  if (calm() || !els.length) return;
  const t0 = performance.now();
  const step = (now: number) => {
    let more = false;
    for (const el of els) {
      const p = Math.min(1, Math.max(0, (now - t0 - Number(el.dataset.at) * 1000) / 550));
      el.textContent = fmt(Math.round(Number(el.dataset.to) * (1 - (1 - p) ** 3)));
      if (p < 1) more = true;
    }
    raf = more ? requestAnimationFrame(step) : 0;
  };
  raf = requestAnimationFrame(step);
}

function onKey(e: KeyboardEvent): void {
  if (!box) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeReward(); }
  else if (e.key === 'Tab') { e.preventDefault(); box.querySelector<HTMLElement>('.rw-ok')?.focus({ preventScroll: true }); }
}

/** 보상 창 닫기 (열려 있지 않으면 아무것도 안 함) */
export function closeReward(): void {
  if (!box) return;
  clearTimeout(timer); cancelAnimationFrame(raf); timer = raf = 0;
  box.remove(); box = null;
  document.removeEventListener('keydown', onKey, true);
  const app = document.getElementById('app');
  if (app) app.inert = appWas;
  if (back instanceof HTMLElement && back.isConnected && !back.closest('[hidden], [inert]')) back.focus({ preventScroll: true });
  back = null;
}

/** 보상 창 띄우기. 받은 것이 없으면 안 띄움 */
export function showReward(r: Reward): void {
  const items = r.items ?? [];
  if (off() || (!items.length && !r.gold && !r.fame)) return;
  closeReward();
  const still = calm();
  back = document.activeElement;
  box = document.createElement('div');
  box.className = `rwpop${still ? ' calm' : ''}`;
  box.innerHTML = html(r);
  box.addEventListener('click', closeReward);
  document.body.appendChild(box);
  const app = document.getElementById('app');
  if (app) { appWas = app.inert; app.inert = true; }
  document.addEventListener('keydown', onKey, true);
  box.querySelector<HTMLElement>('.rw-ok')?.focus({ preventScroll: true });
  countUp(box);
  // 소리: 장비 = 가장 좋은 장비 등급 소리 (튀어나올 때), 금화 = 결과 화면 골드 소리
  const best = items.reduce<GearItem | null>((a, c) => (!a || ['loot', 'loot-rare', 'loot-legend'].indexOf(lootSound(c)) > ['loot', 'loot-rare', 'loot-legend'].indexOf(lootSound(a)) ? c : a), null);
  if (best) {
    sfx(lootSound(best), { delay: still ? 0.1 : AT.item });
    if (r.gold) sfx('gold-gain', { delay: still ? 0.3 : AT.gold, vol: 0.7 });
  } else if (r.gold) sfx('gold-gain', { delay: still ? 0 : AT.coin });
  if (!items.length) timer = window.setTimeout(closeReward, AUTO_CLOSE * 1000);
}
