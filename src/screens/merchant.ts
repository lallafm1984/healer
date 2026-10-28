/**
 * 행상인 (떠돌이 상인, 106, 2026-10-20 Lim 「로비에 디아블로2 갬블 요소 처럼 랜덤으로 아이템이 뜨는 컨텐츠 … 골드소비처 용도」): 로비 오른쪽 팻말에서 들어오는 화면.
 * 가운데 = 부위 카드 6 (Lim 「부위만 고르게」: 종류는 그 부위 다섯 가지 중 무작위), 아래 = 사기 (값).
 * 사면 봉인 꾸러미 (icon-merchant)가 흔들리다 풀리고 장비 카드 (영웅 · 품질은 결과창과 같은 빛기둥) → 상세 · 판매 · 한 번 더.
 * 탭 막대 없이 「← 로비」 (상점과 같은 하위 화면). 규칙 · 수치는 game/merchant.ts · data/economy MERCHANT
 * 2026-10-27 (마무리 목록 8번): 부위 고르기 · 사기를 길드 판 둘로 (guild-hall.css .g-card, 판 머리 = 그림 · 제목 · 숫자). 머리 그림 · 감정 결과 시트는 그대로
 * 2026-10-27 Lim: 부위 설명 줄 · 부위 칸 「종류 5가지」 · 맨 아래 영웅 · 장비 레벨 줄 · 감정 결과 「점수 N」은 없앰 (다시 넣지 않는다), 판매는 장비 상세와 같은 확인 창 (sellConfirmHtml)을 거침
 * 2026-10-28 Lim: 사기 판의 등급 확률 칩은 없앰 (다시 넣지 않는다, 확률은 game/merchant merchantOdds 안에만)
 */
import { art } from '../art';
import { GRADE_STYLE, kindOf, qualityOf, sellGold, slotName, SLOTS, type ItemGrade, type SlotKey } from '../data/equipment';
import { specName } from '../game/charinfo';
import { buyUnknown, merchantOffer } from '../game/merchant';
import { resourceBalance } from '../game/resources';
import { commit, findItem, G, refreshDay, sell } from '../game/state';
import { specKeysOf } from '../data/equipment';
import { currencyAmount, gameIcon, gearIcon, uiIcon } from './art';
import { openItemDetail, sellConfirmHtml } from './character';
import { sheetDialog } from './dialog';
import { noticeModal } from '../platform/ads';
import { esc, fmt, screen, topBar } from './kit';
import { sfx } from '../sfx';
import { lootSound } from './ui-sound';

/** 등급 글자 색 (결과 · 장비 상세와 같은 값) */
const GRADE_INK: Record<ItemGrade, string> = { '일반': '#E4E0D8', '고급': '#8BEA9C', '희귀': '#8DBEFF', '영웅': '#D7A6FF', '전설': '#FFE680' };

/** slot = 고른 부위, got = 방금 산 장비 (감정 결과 창), fresh = 그 창의 봉인 풀기 연출을 아직 안 보여 줌, ask = 판매 확인 창을 띄움 */
const st: { slot: SlotKey; got: number | null; fresh: boolean; ask: boolean } = { slot: 'weapon', got: null, fresh: false, ask: false };
/** 지난 그리기에 띄운 감정 결과 (같은 창을 다시 그릴 땐 올라오는 움직임 없이) */
let shown: number | null = null;

const s = screen('s-merchant', '행상인', {
  enter() { refreshDay(); st.got = null; st.ask = false; render(); },
});
/** 뒤로가기 · Esc: 판매 확인 창이 떠 있으면 그것만 닫음 */
const modal = sheetDialog(s.el, () => { if (st.ask) st.ask = false; else st.got = null; render(); });

function render(): void {
  modal.beforeRender();
  const save = G.save, o = merchantOffer(save), slot = st.slot, nm = esc(slotName(slot));
  const have = resourceBalance(save, 'gold');
  s.el.innerHTML = `${topBar({ back: 's-lobby', title: '행상인' })}
    <div class="ns-body mc">
      <header class="art-hero mc-hero"><div class="ah-copy"><p class="eyebrow">떠돌이 행상인</p><h2>미확인 장비</h2></div>
        <p class="mc-have">${currencyAmount('gold', isFinite(have) ? have : '∞')}</p></header>
      <section class="g-card mc-card-slot" data-sec="slot"><header class="g-hd"><span class="g-hi">${gameIcon('merchant', uiIcon('shop'))}</span><h3>부위 고르기</h3></header>
        <div class="mc-kinds" role="radiogroup" aria-label="부위">${SLOTS.map(x => `<button type="button" class="mc-kind" role="radio" data-mslot="${x.key}" aria-checked="${x.key === slot}">
          <span class="mc-art">${gearIcon({ slot: x.key })}</span><b>${x.name}</b></button>`).join('')}</div>
      </section>
      <section class="g-card mc-buy" data-sec="buy" aria-label="사기"><header class="g-hd"><span class="g-hi">${gearIcon({ slot })}</span><h3>미확인 ${nm}</h3><span class="g-meta">Lv ${o.lv}<small>종류 무작위</small></span></header>
        <div class="mc-buy-body">
        <button type="button" class="btn primary mc-go" id="mcBuy"${o.ok ? '' : ' disabled'} aria-label="미확인 ${nm} 사기 · 골드 ${fmt(o.gold)}"><span>사기</span>${currencyAmount('gold', o.gold)}</button>
        ${o.why ? `<p class="mc-why">${esc(o.lock || `${o.why} · 보유 ${fmt(have)}`)}</p>` : ''}
        </div>
      </section>
    </div>
    ${st.got != null ? revealHtml(st.got) : ''}`;
  const sheet = s.el.querySelector<HTMLElement>('.mc-reveal'), ask = s.el.querySelector<HTMLElement>('.c7-confirm');
  if (!ask) st.ask = false;
  modal.sync(ask || sheet, sheet ? (ask ? ['reveal', 'confirm'] : ['reveal']) : []);
  st.fresh = false; shown = sheet ? st.got : null;
}

/** 감정 결과: 봉인 꾸러미가 흔들리다 풀리고 (fresh, 효과 줄이기면 없음) 장비 카드 → 상세 · 판매 · 한 번 더 · 닫기 */
function revealHtml(id: number): string {
  const it = findItem(id);
  if (!it) return '';
  const o = merchantOffer(G.save), q = qualityOf(it), calm = G.save.settings.reducedEffects;
  const anim = st.fresh && !calm, worn = G.save.gear.equipped[it.slot]?.id === it.id;
  const bu = it.grade === '영웅' || it.grade === '전설' || q ? art('fx-loot-beam') : '';
  const beam = bu ? `<span class="r-beam mc-beam${calm ? ' calm' : ''}" style="--beam:url('${bu}')" aria-hidden="true"></span>` : '';
  const sp = specKeysOf(it);
  // 판매 확인 창은 감정 결과 위에 (뒤 시트는 다시 올라오는 움직임 없이 still)
  const ask = st.ask && !worn && !it.lock;
  return `<div class="sheet-dim" data-mc-close></div>
    <section class="sheet mc-reveal${anim ? ' anim' : ''}${!st.fresh && shown === id ? ' still' : ''}" aria-labelledby="mcRevealTitle" style="--g:${GRADE_STYLE[it.grade].color};--gi:${GRADE_INK[it.grade]}">
      <div class="grip"></div>
      <h3 id="mcRevealTitle" class="mc-rt">감정 결과</h3>
      <div class="mc-stage" aria-hidden="true">${beam}${anim ? `<span class="mc-bundle">${gameIcon('merchant', uiIcon('shop'))}</span>` : ''}<span class="mc-item">${gearIcon(it)}</span></div>
      <div class="mc-card">
        <p class="mc-grade"><i>${it.grade}</i>${q ? ` <span class="r-q" data-q="${q}">${q}</span>` : ''}</p>
        <h4 class="mc-name">${esc(it.name)}</h4>
        <p class="mc-sub">${esc(slotName(it.slot))} · ${esc(kindOf(it).name)} · Lv ${it.lv ?? o.lv}</p>
        ${sp.length ? `<p class="mc-sp">${sp.map(k => esc(specName(k))).join(' · ')}</p>` : ''}
      </div>
      <div class="mc-acts">
        <button type="button" class="btn" data-mc-detail="${it.id}">상세</button>
        <button type="button" class="btn" data-mc-sell="${it.id}"${worn || it.lock ? ' disabled' : ''}>판매 ${currencyAmount('gold', sellGold(it), { prefix: '+' })}</button>
        <button type="button" class="btn primary" data-mc-again${o.ok ? '' : ' disabled'} aria-label="한 번 더 · 골드 ${fmt(o.gold)}">한 번 더 ${currencyAmount('gold', o.gold)}</button>
      </div>
      <button type="button" class="btn2 mc-close" data-mc-close>닫기</button>
    </section>${ask ? sellConfirmHtml(it) : ''}`;
}

/** 지금 고른 부위로 사기 (종류는 무작위) → 감정 결과 창 */
function buy(): void {
  const r = buyUnknown(G.save, st.slot);
  if (typeof r === 'string') { sfx('deny'); render(); void noticeModal('사기 안 됨', esc(r)); return; }
  commit();
  // 107: 금화를 내고 꾸러미가 흔들리다 풀림 → 장비가 튀어나오는 때 (merchant.css mcPop 0.66초) 등급 소리. 효과 줄이기면 바로
  const calm = G.save.settings.reducedEffects, it = findItem(r.id);
  sfx('gold-spend');
  if (!calm) sfx('merchant-reveal', { delay: 0.15 });
  if (it) sfx(lootSound(it), { delay: calm ? 0.1 : 0.66 });
  st.got = r.id; st.fresh = true;
  render();
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const tab = t.closest<HTMLElement>('[data-mslot]');
  if (tab) { st.slot = tab.dataset.mslot as SlotKey; render(); return; }
  if (t.closest('#mcBuy') || t.closest('[data-mc-again]')) { buy(); return; }
  if (st.ask) {
    if (t.closest('[data-confirmgo]')) {
      const got = sell([st.got ?? -1]);
      sfx(got.n ? 'gear-sell' : 'deny');
      st.ask = false; st.got = null; // 판매 골드 띠 (「판매: 골드 +N」)는 없앰 (2026-10-24 Lim): 위 정보창 골드가 바로 오름
      render();
    } else if (t.closest('[data-confirmcancel]')) { st.ask = false; render(); }
    return;
  }
  if (t.closest('[data-mc-close]')) { st.got = null; render(); return; }
  const det = t.closest<HTMLElement>('[data-mc-detail]');
  if (det) {
    const id = Number(det.dataset.mcDetail);
    // 장비 상세 (캐릭터 메뉴와 같은 창): 감정 결과 시트는 다른 화면을 막으니 (inert) 먼저 닫고, 상세를 닫으면 다시 (판매했으면 안 엶)
    st.got = null; render();
    if (!openItemDetail(id, () => { st.got = findItem(id) ? id : null; render(); })) { st.got = id; render(); }
    return;
  }
  // 판매: 장비 상세와 같은 확인 창 → 「판매하기」에서만 팖
  const sl = t.closest<HTMLButtonElement>('[data-mc-sell]');
  if (sl && !sl.disabled && Number(sl.dataset.mcSell) === st.got) { st.ask = true; render(); }
});

