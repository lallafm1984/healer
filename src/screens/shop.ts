/**
 * S18 상점 (09, 15 6장, 12, 81). 상품 한 쪽: 하위 탭 없음. 골드 탭 (소비 아이템)은 2026-10-16 소비 아이템과 함께, 시즌 패스 탭 (S19) · 공훈 탭은
 * 2026-10-20 Lim 「시즌패스 시스템 제거」 · 「공훈 재화및 시스템도 제거하자」로 없앰 (지갑 줄도 공훈과 함께).
 * 81 (2026-10-15 Lim): 크리스탈 · 악몽 열쇠 · 월정액 · 프리미엄 패스를 없앰. 상품 탭 = 휴식 광고 충전 (90) · 광고 제거 패키지 5,500원 · 직업 4종 하나에 2,200원.
 * 결제는 자리만 (platform/billing.ts). 개발 빌드는 누르면 결제 없이 바로 받음.
 * 2026-10-18 Lim 「메뉴의 상점을 빼고 길드를 넣자. 상점의 진입 루트는 로비이다」: 하단 탭이 아니라 로비 「상점」 팻말 (예전 「잡화점」, 2026-10-21 이름 바꿈) · 휴식 창 · 직업 구매에서 들어오는 화면.
 * 탭 막대 없이 「← 상점」, 뒤로 = 들어온 화면 (없으면 로비).
 * 2026-10-27 (마무리 목록 8번): 본문 = 길드 판 셋 (휴식 · 광고 제거 패키지 · 직업, guild-hall.css .g-card · .g-row), 판 밖 소제목 없음. 머리 그림은 그대로
 * 2026-10-28 Lim 「레벨 제한없이 5만 및 2200원으로 하자」: 직업 줄은 현금 버튼 아래 골드 버튼 (JOB_GOLD, 확인 창 뒤 buyJobWithGold)
 * 같은 날 Lim 「저렇게 가운데 생기는 ui는 최대한 자제」: 상품 위 알림 줄은 없앰. 못 산 까닭 = 알림 창 (골드 부족 · 구매 안 됨), 산 것 = 짧은 알림 (toast.ts)
 */
import { JOB_GOLD, NOADS, PAID_HEROES, REST_BONUS, STAMINA, jobProductId } from '../data/economy';
import { t } from '../i18n';
import { HEROES } from '../data/heroes';
import { buyJobWithGold, grantProduct, products } from '../game/economy';
import { resourceBalance } from '../game/resources';
import { askModal, noticeModal } from '../platform/ads';
import { commit, G, refreshDay, syncAds } from '../game/state';
import { purchase, STORE_WHY } from '../platform/billing';
import { esc, fmt, previous, screen, topBar } from './kit';
import { classEmblem, currencyAmount, currencyIcon, gameIcon, uiIcon } from './art';
import { refreshCells } from './stamina';
import { notify } from './toast';
import { staminaView } from '../game/stamina';
import { sfx } from '../sfx';
import './shop.css';
import { now as gameNow } from '../platform/time';

/** focus = 들어올 때 강조할 상품 (캐릭터 → 직업에서 잠긴 직업을 누르면 「cash:job_shaman」, 앞 「cash」는 예전 하위 탭 이름), from = 뒤로 갈 화면 */
const st: { focus: string; from: string } = { focus: '', from: 's-lobby' };

const s = screen('s-shop', t('상점'), {
  enter(arg) {
    // 설정에서 돌아올 때는 처음 들어온 화면을 그대로 둠
    if (previous !== 's-settings' && previous !== 's-shop') st.from = previous || 's-lobby';
    st.focus = typeof arg === 'string' ? arg.split(':')[1] || '' : '';
    refreshDay(); render();
    if (st.focus) s.el.querySelector<HTMLElement>(`[data-prod="${CSS.escape(st.focus)}"]`)?.scrollIntoView({ block: 'center' });
  },
});

function render(): void {
  s.el.innerHTML = `${topBar({ back: st.from, title: t('상점') })}
    <div class="ns-body shop">
      <header class="art-hero shop-hero"><div class="ah-copy"><p class="eyebrow">${t('모험가 상점')}</p><h2>${t('상품')}</h2></div></header>
      ${cashHtml()}
    </div>`;
}

/** 직업 상품 한 줄 설명 (캐릭터 → 직업 목록과 같은 말) */
const JOB_LINE: Record<string, string> = {
  shaman: '토템 · 연쇄 치유', monk: '연속 치유 · 안개', astrologer: '별자리 · 집중 치유', warder: '보호막 · 인장 치유',
};

/** 상품 (81 3장 · 90): 휴식 충전 · 광고 제거 패키지 (그림 icon-noads, 81 4장) · 직업 4종. 길드 판 (머리 = 그림 · 제목, 줄 = 상품 하나) */
function cashHtml(): string {
  const dev = G.save.settings.devUnlock, own = (id: string) => G.save.bought.includes(id);
  const buyBtn = (id: string, price: string) => own(id)
    ? `<span class="cash-own">${t('보유')}</span>`
    : `<button class="btn mini primary cash-buy" type="button" data-iap="${id}">${t(price)}${dev ? `<small>${t('시험 구매')}</small>` : ''}</button>`;
  // 직업은 골드로도 (현금 버튼 아래)
  const goldBtn = (id: string) => (PAID_HEROES.some(h => jobProductId(h) === id) && !own(id)
    ? `<button class="btn mini cash-gold" type="button" data-gold-job="${id}">${currencyAmount('gold', JOB_GOLD)}</button>` : '');
  const row = (id: string, icon: string, name: string, line: string) =>
    `<li class="g-row cash-row${own(id) ? ' owned' : ''}${st.focus === id ? ' hi' : ''}" data-prod="${id}"><span class="g-ri">${icon}</span><div class="g-rm"><b>${esc(name)}</b><span class="g-sub wrap">${line}</span></div><span class="g-rs">${buyBtn(id, products(G.save).find(p => p.id === id)!.price)}${goldBtn(id)}</span></li>`;
  const card = (key: string, icon: string, title: string, body: string) =>
    `<section class="g-card sh-card" data-sec="${key}"><header class="g-hd"><span class="g-hi">${icon}</span><h3>${title}</h3></header>${body}</section>`;
  const v = staminaView(G.save, gameNow());
  return `${card('rest', currencyIcon('rest'), t('휴식'), `<div class="cash-stam">
      <button class="cash-meter" type="button" data-stamina-open aria-label="${t('휴식 창 열기')}">${currencyIcon('rest')}<b data-stam-n>${v.unlimited ? '∞' : fmt(v.n)}</b><small data-stam-max>/${v.max}</small><span class="cash-go">${t('충전')} ${uiIcon('arrow')}</span></button>
      <p class="g-sub wrap">${t('{m}분마다 1씩 찹니다. 휴식이 있으면 클리어 경험치 · 골드 휴식 보너스 ×{x} · 광고 보고 최대 충전 · 하루 {n}번', { m: STAMINA.regenMs / 60e3, x: REST_BONUS, n: STAMINA.adDaily })}</p></div>`)}
    ${card('noads', gameIcon('noads', uiIcon('star')), t('광고 제거 패키지'), `<ul class="g-rows">${row(NOADS.id, gameIcon('noads', uiIcon('star')), t(NOADS.name), t('전면 광고 없음 · 휴식 최대 +{n}', { n: STAMINA.bonus }))}</ul>`)}
    ${card('jobs', uiIcon('char'), t('직업'), `<p class="g-sub wrap sh-lead">${t('현금 또는 골드 · 레벨 조건 없이 바로 열림 · 모든 캐릭터')}</p><ul class="g-rows">${PAID_HEROES.map(h => row(jobProductId(h), classEmblem(h, 'md'), t(HEROES[h].name), t(JOB_LINE[h]))).join('')}</ul>`)}
    <p class="note sh-foot">${dev ? t('개발 빌드: 누르면 결제 없이 바로 받음') : esc(t(STORE_WHY))}</p>`;
}

s.el.addEventListener('click', async e => {
  const el = e.target as HTMLElement, save = G.save;
  const gb = el.closest<HTMLButtonElement>('[data-gold-job]');
  if (gb && !gb.disabled) {
    const hero = PAID_HEROES.find(h => jobProductId(h) === gb.dataset.goldJob)!, name = HEROES[hero].name, have = resourceBalance(save, 'gold');
    if (have < JOB_GOLD) { sfx('deny'); void noticeModal(t('골드 부족'), t('골드가 모자랍니다.<br>필요 {a} · 보유 {b}', { a: fmt(JOB_GOLD), b: fmt(have) })); return; }
    if (!(await askModal(t('{n} 해금', { n: t(name) }), t('골드 {g}으로 {n} 직업을 엽니다.', { g: fmt(JOB_GOLD), n: esc(t(name)) }), t('취소'), t('골드로 사기')))) return;
    const err = buyJobWithGold(save, hero);
    sfx(err ? 'deny' : 'purchase');
    commit(); render(); refreshCells();
    if (err) void noticeModal(t('구매 안 됨'), esc(t(err))); else notify(t('{n} 해금 · 캐릭터 → 직업에서 전환', { n: t(name) }));
    return;
  }
  const iap = el.closest<HTMLButtonElement>('[data-iap]');
  if (iap && !iap.disabled) {
    const id = iap.dataset.iap!;
    iap.disabled = true;
    const r = await purchase(id, save.settings.devUnlock);
    if (!r.ok) { sfx('deny'); render(); void noticeModal(t('구매 안 됨'), esc(r.why ? t(r.why) : t('결제가 끝나지 않았습니다.'))); return; }
    const err = grantProduct(save, id);
    sfx(err ? 'deny' : 'purchase');
    const hero = PAID_HEROES.find(h => jobProductId(h) === id);
    commit(); syncAds(); render(); refreshCells();
    if (err) void noticeModal(t('구매 안 됨'), esc(t(err)));
    else notify((hero ? t('{n} 해금 · 캐릭터 → 직업에서 전환', { n: t(HEROES[hero].name) }) : t('{n} · 휴식 최대 +{b}', { n: t(NOADS.name), b: STAMINA.bonus })) + (r.test ? ` (${t('시험 구매')})` : ''));
  }
});
