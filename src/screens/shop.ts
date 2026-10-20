/**
 * S18 상점 (09, 15 6장, 12, 81). 상품 한 쪽: 하위 탭 없음. 골드 탭 (소비 아이템)은 2026-10-16 소비 아이템과 함께, 시즌 패스 탭 (S19) · 공훈 탭은
 * 2026-10-20 Lim 「시즌패스 시스템 제거」 · 「공훈 재화및 시스템도 제거하자」로 없앰 (지갑 줄도 공훈과 함께).
 * 81 (2026-10-15 Lim): 크리스탈 · 악몽 열쇠 · 월정액 · 프리미엄 패스를 없앰. 상품 탭 = 휴식 광고 충전 (90) · 광고 제거 패키지 5,500원 · 직업 4종 하나에 2,200원.
 * 결제는 자리만 (platform/billing.ts). 개발 빌드는 누르면 결제 없이 바로 받음.
 * 2026-10-18 Lim 「메뉴의 상점을 빼고 길드를 넣자. 상점의 진입 루트는 로비이다」: 하단 탭이 아니라 로비 「잡화점」 · 휴식 창 · 직업 구매에서 들어오는 화면.
 * 탭 막대 없이 「← 상점」, 뒤로 = 들어온 화면 (없으면 로비).
 */
import { NOADS, PAID_HEROES, REST_BONUS, STAMINA, jobProductId } from '../data/economy';
import { HEROES } from '../data/heroes';
import { grantProduct, products, type Gain } from '../game/economy';
import { commit, G, refreshDay, syncAds } from '../game/state';
import { purchase, STORE_WHY } from '../platform/billing';
import { esc, fmt, previous, screen, topBar } from './kit';
import { classEmblem, currencyIcon, gameIcon, uiIcon } from './art';
import { refreshCells } from './stamina';
import { staminaView } from '../game/stamina';
import { sfx } from '../sfx';

/** focus = 들어올 때 강조할 상품 (캐릭터 → 직업에서 잠긴 직업을 누르면 「cash:job_shaman」, 앞 「cash」는 예전 하위 탭 이름), from = 뒤로 갈 화면 */
const st: { msg: string; focus: string; from: string } = { msg: '', focus: '', from: 's-lobby' };

const s = screen('s-shop', '상점', {
  enter(arg) {
    // 설정에서 돌아올 때는 처음 들어온 화면을 그대로 둠
    if (previous !== 's-settings' && previous !== 's-shop') st.from = previous || 's-lobby';
    st.focus = typeof arg === 'string' ? arg.split(':')[1] || '' : '';
    refreshDay(); st.msg = ''; render();
    if (st.focus) s.el.querySelector<HTMLElement>(`[data-prod="${CSS.escape(st.focus)}"]`)?.scrollIntoView({ block: 'center' });
  },
});

/** 받은 것 한 줄 (알림 문장 = 텍스트) */
export function gainText(g: Gain): string {
  const out: string[] = [];
  if (g.gold) out.push(`골드 +${fmt(g.gold)}`);
  if (g.items?.length) out.push(g.items.map(i => i.name).join(', '));
  return out.join(' · ');
}

function render(): void {
  s.el.innerHTML = `${topBar({ back: st.from, title: '상점' })}
    <div class="ns-body shop">
      <header class="art-hero shop-hero"><div class="ah-copy"><p class="eyebrow">모험가 상점</p><h2>상품</h2></div></header>
      ${st.msg ? `<p class="warnbox" role="status">${esc(st.msg)}</p>` : ''}
      ${cashHtml()}
    </div>`;
  st.msg = '';
}

/** 직업 상품 한 줄 설명 (캐릭터 → 직업 목록과 같은 말) */
const JOB_LINE: Record<string, string> = {
  shaman: '토템 · 연쇄 치유', monk: '연속 치유 · 안개', astrologer: '별자리 · 집중 치유', warder: '보호막 · 인장 치유',
};

/** 상품 탭 (81 3장 · 90): 휴식 충전 · 광고 제거 패키지 (그림 icon-noads, 81 4장) · 직업 4종 */
function cashHtml(): string {
  const dev = G.save.settings.devUnlock, own = (id: string) => G.save.bought.includes(id);
  const buyBtn = (id: string, price: string) => own(id)
    ? '<span class="cash-own">보유</span>'
    : `<button class="btn mini primary cash-buy" type="button" data-iap="${id}">${price}${dev ? '<small>시험 구매</small>' : ''}</button>`;
  const row = (id: string, icon: string, name: string, line: string) =>
    `<li class="srow cash-row${own(id) ? ' owned' : ''}${st.focus === id ? ' hi' : ''}" data-prod="${id}"><span class="sic">${icon}</span><div><b>${esc(name)}</b><p class="note">${line}</p></div><div class="sbuy">${buyBtn(id, products(G.save).find(p => p.id === id)!.price)}</div></li>`;
  const v = staminaView(G.save, Date.now());
  return `<section class="panel cash-stam"><h4>휴식</h4>
      <button class="cash-meter" type="button" data-stamina-open aria-label="휴식 창 열기">${currencyIcon('rest')}<b data-stam-n>${v.unlimited ? '∞' : fmt(v.n)}</b><small data-stam-max>/${v.max}</small><span class="cash-go">충전 ${uiIcon('arrow')}</span></button>
      <p class="note">${STAMINA.regenMs / 60e3}분마다 1씩 찹니다. 휴식이 있으면 클리어 경험치 · 골드 휴식 보너스 ×${REST_BONUS} · 광고 충전 +${STAMINA.ad} · 하루 ${STAMINA.adDaily}번</p></section>
    <h3 class="sec">광고 제거 패키지</h3>
    <ul class="slist">${row(NOADS.id, gameIcon('noads', uiIcon('star')), NOADS.name, `배너 · 전면 광고 없음 · 휴식 충전도 바로 · 휴식 최대 +${STAMINA.bonus}`)}</ul>
    <h3 class="sec">직업 <small>사면 레벨 조건 없이 바로 열림 · 모든 캐릭터</small></h3>
    <ul class="slist">${PAID_HEROES.map(h => row(jobProductId(h), classEmblem(h, 'md'), HEROES[h].name, JOB_LINE[h])).join('')}</ul>
    <p class="note">${dev ? '개발 빌드: 누르면 결제 없이 바로 받음' : esc(STORE_WHY)}</p>`;
}

s.el.addEventListener('click', async e => {
  const t = e.target as HTMLElement, save = G.save;
  const iap = t.closest<HTMLButtonElement>('[data-iap]');
  if (iap && !iap.disabled) {
    const id = iap.dataset.iap!;
    iap.disabled = true;
    const r = await purchase(id, save.settings.devUnlock);
    if (!r.ok) { sfx('deny'); st.msg = r.why || '구매 안 됨'; render(); return; }
    const err = grantProduct(save, id);
    sfx(err ? 'deny' : 'purchase');
    const hero = PAID_HEROES.find(h => jobProductId(h) === id);
    st.msg = err || (hero ? `${HEROES[hero].name} 해금 · 캐릭터 → 직업에서 전환` : `${NOADS.name} · 휴식 최대 +${STAMINA.bonus}`) + (r.test ? ' (시험 구매)' : '');
    commit(); syncAds(); render(); refreshCells();
  }
});
