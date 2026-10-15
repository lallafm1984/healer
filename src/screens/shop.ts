/**
 * S18 상점 · S19 시즌 패스 (09, 15 6장, 12, 81). 하위 탭: 골드 · 공훈 · 패스 · 상품.
 * 81 (2026-10-15 Lim): 크리스탈 · 악몽 열쇠 · 월정액 · 프리미엄 패스를 없앰. 상품 탭 = 스테미너 광고 충전 · 광고 제거 패키지 5,500원 · 직업 4종 하나에 2,200원.
 * 결제는 자리만 (platform/billing.ts). 개발 빌드는 누르면 결제 없이 바로 받음.
 */
import { resourceBalance } from '../game/resources';
import { BAG_MAX, itemPrice, MERIT_GEAR_COST, MERIT_WEEK_CAP, NOADS, PAID_HEROES, PASS_LEVELS, PASS_XP, SEASON, STAMINA, jobProductId } from '../data/economy';
import { SLOTS, type SlotKey } from '../data/equipment';
import { HEROES } from '../data/heroes';
import { ITEMS, type ItemKey } from '../data/items';
import { seasonOf } from '../game/clock';
import { buyItem, claimPass, exchangeMerit, grantProduct, passGain, passLevel, products, type Gain } from '../game/economy';
import { commit, G, refreshDay, syncAds } from '../game/state';
import { topLevel } from '../platform/storage';
import { purchase, STORE_WHY } from '../platform/billing';
import { esc, fmt, screen, topBar, useIcon } from './kit';
import { classEmblem, currencyAmount, currencyIcon, gameIcon, uiIcon, type CurrencyIconKey } from './art';
import { refreshCells } from './stamina';
import { staminaView } from '../game/stamina';

type Sub = 'gold' | 'merit' | 'pass' | 'cash';
const SUBS: [Sub, string][] = [['gold', '골드'], ['merit', '공훈'], ['pass', '시즌 패스'], ['cash', '상품']];
/** focus = 들어올 때 강조할 상품 (캐릭터 → 직업에서 잠긴 직업을 누르면 「cash:job_shaman」) */
const st: { sub: Sub; msg: string; focus: string } = { sub: 'gold', msg: '', focus: '' };

const s = screen('s-shop', '상점', {
  tab: 'shop',
  enter(arg) {
    st.focus = '';
    if (typeof arg === 'string') {
      const [sub, focus] = arg.split(':');
      if (SUBS.some(([k]) => k === sub)) st.sub = sub as Sub;
      st.focus = focus || '';
    }
    refreshDay(); st.msg = ''; render();
    if (st.focus) s.el.querySelector<HTMLElement>(`[data-prod="${CSS.escape(st.focus)}"]`)?.scrollIntoView({ block: 'center' });
  },
});

/** 받은 것 한 줄 */
export function gainText(g: Gain): string { return gainParts(g, false); }
/** 보상 미리보기는 재화 공통 아이콘을 사용하며, 알림 문장은 텍스트로 유지한다. */
export function gainHtml(g: Gain): string { return gainParts(g, true); }
function gainParts(g: Gain, icons: boolean): string {
  const out: string[] = [];
  if (g.gold) out.push(icons ? currencyAmount('gold', g.gold, { prefix: '+' }) : `골드 +${fmt(g.gold)}`);
  if (g.stone) out.push(icons ? currencyAmount('stone', g.stone, { prefix: '+' }) : `강화석 +${g.stone}`);
  if (g.refined) out.push(icons ? currencyAmount('refined', g.refined, { prefix: '+' }) : `정제 강화석 +${g.refined}`);
  if (g.items?.length) out.push(g.items.map(i => icons ? esc(i.name) : i.name).join(', '));
  if (g.deco) out.push(`「${icons ? esc(g.deco) : g.deco}」`);
  if (g.pass) out.push(`패스 경험치 +${g.pass}`);
  return out.join(' · ');
}

const wallet = () => {
  const w = G.save.wallet;
  const cells: [CurrencyIconKey, number | string, string][] = [
    ['merit', w.merit, '공훈'], ['stone', resourceBalance(G.save, 'stone'), '강화석'], ['refined', resourceBalance(G.save, 'refined'), '정제 강화석'],
  ];
  return `<p class="wallet shop-wallet">${cells.map(([key, n, name]) => `<span>${currencyIcon(key)}<b>${typeof n === 'number' ? fmt(n) : n}</b><small>${name}</small></span>`).join('')}</p>`;
};

function render(): void {
  const passOpen = s.el.querySelector<HTMLDetailsElement>('.pass-archive')?.open || false;
  s.el.innerHTML = `${topBar({ settings: true })}
    <nav class="subtabs" role="tablist">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${n}</button>`).join('')}</nav>
    <div class="ns-body shop">
      <header class="art-hero shop-hero"><div class="ah-copy"><p class="eyebrow">모험가 상점</p><h2>${SUBS.find(([k]) => k === st.sub)![1]}</h2></div></header>
      ${st.sub === 'cash' ? '' : wallet()}
      ${st.msg ? `<p class="warnbox" role="status">${esc(st.msg)}</p>` : ''}
      ${st.sub === 'gold' ? goldHtml() : st.sub === 'merit' ? meritHtml() : st.sub === 'pass' ? passHtml() : cashHtml()}
    </div>`;
  const archive = s.el.querySelector<HTMLDetailsElement>('.pass-archive');
  if (archive) archive.open = passOpen;
  st.msg = '';
}

function goldHtml(): string {
  const lv = topLevel(G.save), gold = resourceBalance(G.save, 'gold');
  const rows = (Object.keys(ITEMS) as ItemKey[]).map(k => {
    const price = itemPrice(k, lv), have = G.save.bag[k] || 0;
    // 가격은 버튼 안에 (살 수 있는 만큼). 가방이 가득이면 「가득」
    const btn = (n: number) => {
      const m = Math.min(n, BAG_MAX - have);
      return `<button class="btn mini buy" type="button" data-buy="${k}" data-n="${n}"${price == null || have >= BAG_MAX || gold < price! * m ? ' disabled' : ''}>${n}개<small>${have >= BAG_MAX ? '가득' : currencyAmount('gold', price! * m)}</small></button>`;
    };
    // 위 줄 = 아이콘·이름·구매 버튼, 아래 줄 = 설명 (좁은 화면에서도 설명이 한 줄을 다 씀)
    return `<li class="srow itemrow"><div class="ir-top"><span class="sic">${useIcon(k)}${have ? `<i class="stack">${have}</i>` : ''}</span><div class="ir-name"><b>${ITEMS[k].name}</b><small${have >= BAG_MAX ? ' class="full"' : ''}>가방 ${have}/${BAG_MAX}${have >= BAG_MAX ? ' · 가득' : ''}</small></div>
      ${price == null ? '<small class="mute">레이드 드롭·주간 보상만</small>' : `<div class="sbuy">${btn(1)}${btn(5)}</div>`}</div><p class="note use">사용: ${esc(ITEMS[k].desc)}</p></li>`;
  }).join('');
  return `<h3 class="sec">소비 아이템 <small>레벨 비례 가격 · 종류마다 최대 ${BAG_MAX}</small></h3><ul class="slist">${rows}</ul>`;
}

function meritHtml(): string {
  const w = G.save.wallet, wk = G.save.weekly.merit;
  return `<p class="note">레이드 보스를 잡으면 공훈. 레이드마다 주 ${MERIT_WEEK_CAP}까지 (10인 ${wk[10]}/${MERIT_WEEK_CAP} · 20인 ${wk[20]}/${MERIT_WEEK_CAP})</p>
    <section class="panel mgear"><h4>영웅 장비 <small>원하는 부위 1개</small></h4>
      <div class="gbtns">${SLOTS.map(sl => `<button class="btn" type="button" data-ex="${sl.key}"${w.merit < MERIT_GEAR_COST ? ' disabled' : ''}>${sl.name}<small>${currencyAmount('merit', MERIT_GEAR_COST)}</small></button>`).join('')}</div></section>`;
}

function passHtml(): string {
  const p = G.save.pass, lv = passLevel(p.xp), se = seasonOf();
  const into = lv >= PASS_LEVELS ? PASS_XP : p.xp - lv * PASS_XP;
  const row = (l: number) => {
    const open = l <= lv, got = p.free.includes(l);
    return `<li class="prow solo${open ? ' open' : ''}"><b>${l}</b>
      <span class="pf">${gainHtml(passGain(G.save, l))}${open ? (got ? ' <i>받음</i>' : ` <button class="btn mini" type="button" data-pass="${l}">받기</button>`) : ''}</span></li>`;
  };
  return `<section class="panel passhead"><h4>시즌 ${p.season || SEASON.n} 「${SEASON.name}」 <small>${se.week + 1}/${SEASON.weeks}주${se.catchUp ? ' · 따라잡기 경험치 +50%' : ''}</small></h4>
      <p>패스 Lv <b>${lv}</b>/${PASS_LEVELS} <span class="bar"><i style="width:${Math.min(100, (into / PASS_XP) * 100)}%"></i></span> ${fmt(into)}/${fmt(PASS_XP)}</p>
      <p class="note">일일·주간 임무로 패스 경험치를 얻습니다. 보상은 모두 무료입니다.</p></section>
    ${passRewards(lv, row)}`;
}

/** 받을 보상과 바로 다음 단계부터. 나머지 50단계 표는 필요할 때 펼친다. */
function passRewards(lv: number, row: (level: number) => string): string {
  const p = G.save.pass;
  const levels = Array.from({ length: PASS_LEVELS }, (_, i) => i + 1);
  const ready = levels.filter(l => l <= lv && !p.free.includes(l));
  const priority = new Set([...ready, ...(lv < PASS_LEVELS ? [lv + 1] : [])]);
  const rest = levels.filter(l => !priority.has(l));
  return `<h3 class="sec">${ready.length ? `받을 보상 ${ready.length}단계` : lv < PASS_LEVELS ? '다음 보상' : '보상 수령 완료'}</h3>
    <ul class="plist"><li class="prow solo head"><b>Lv</b><span class="pf">보상</span></li>${levels.filter(l => priority.has(l)).map(row).join('')}</ul>
    ${rest.length ? `<details class="pass-archive"><summary>다른 보상 ${rest.length}단계 보기</summary><ul class="plist">${rest.map(row).join('')}</ul></details>` : ''}`;
}

/** 직업 상품 한 줄 설명 (캐릭터 → 직업 목록과 같은 말) */
const JOB_LINE: Record<string, string> = {
  shaman: '토템 · 연쇄 치유', monk: '연속 치유 · 안개', astrologer: '별자리 · 집중 치유', warder: '보호막 · 공격 치유',
};

/** 상품 탭 (81 3장): 스테미너 충전 · 광고 제거 패키지 (그림 icon-noads, 81 4장) · 직업 4종 */
function cashHtml(): string {
  const dev = G.save.settings.devUnlock, own = (id: string) => G.save.bought.includes(id);
  const buyBtn = (id: string, price: string) => own(id)
    ? '<span class="cash-own">보유</span>'
    : `<button class="btn mini primary cash-buy" type="button" data-iap="${id}">${price}${dev ? '<small>시험 구매</small>' : ''}</button>`;
  const row = (id: string, icon: string, name: string, line: string) =>
    `<li class="srow cash-row${own(id) ? ' owned' : ''}${st.focus === id ? ' hi' : ''}" data-prod="${id}"><span class="sic">${icon}</span><div><b>${esc(name)}</b><p class="note">${line}</p></div><div class="sbuy">${buyBtn(id, products(G.save).find(p => p.id === id)!.price)}</div></li>`;
  const v = staminaView(G.save, Date.now());
  return `<section class="panel cash-stam"><h4>스테미너</h4>
      <button class="cash-meter" type="button" data-stamina-open aria-label="스테미너 창 열기">${currencyIcon('stamina')}<b data-stam-n>${v.unlimited ? '∞' : fmt(v.n)}</b><small data-stam-max>/${v.max}</small><span class="cash-go">충전 ${uiIcon('arrow')}</span></button>
      <p class="note">8분마다 1씩 찹니다. 광고 충전 +${STAMINA.ad} · 하루 ${STAMINA.adDaily}번</p></section>
    <h3 class="sec">광고 제거 패키지</h3>
    <ul class="slist">${row(NOADS.id, gameIcon('noads', uiIcon('star')), NOADS.name, `배너 · 전면 광고 없음 · 광고 충전도 바로 · 스테미너 최대 +${STAMINA.bonus}`)}</ul>
    <h3 class="sec">직업 <small>사면 레벨 조건 없이 바로 열림 · 모든 캐릭터</small></h3>
    <ul class="slist">${PAID_HEROES.map(h => row(jobProductId(h), classEmblem(h, 'md'), HEROES[h].name, JOB_LINE[h])).join('')}</ul>
    <p class="note">${dev ? '개발 빌드: 누르면 결제 없이 바로 받음' : esc(STORE_WHY)}</p>`;
}

s.el.addEventListener('click', async e => {
  const t = e.target as HTMLElement, save = G.save;
  const sub = t.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; st.focus = ''; render(); return; }
  const b = t.closest<HTMLElement>('[data-buy]');
  if (b) { const k = b.dataset.buy as ItemKey, n = Number(b.dataset.n); const err = buyItem(save, k, n); st.msg = err || `${ITEMS[k].name} 구매 · 가방 ×${save.bag[k]}`; commit(); render(); return; }
  const ex = t.closest<HTMLElement>('[data-ex]');
  if (ex) { const r = exchangeMerit(save, ex.dataset.ex as SlotKey); st.msg = typeof r === 'string' ? r : `교환: ${r.name} (가방)`; commit(); render(); return; }
  const pa = t.closest<HTMLElement>('[data-pass]');
  if (pa) { const r = claimPass(save, Number(pa.dataset.pass), Date.now()); st.msg = typeof r === 'string' ? r : `받음: ${gainText(r)}`; commit(); render(); return; }
  const iap = t.closest<HTMLButtonElement>('[data-iap]');
  if (iap && !iap.disabled) {
    const id = iap.dataset.iap!;
    iap.disabled = true;
    const r = await purchase(id, save.settings.devUnlock);
    if (!r.ok) { st.msg = r.why || '구매 안 됨'; render(); return; }
    const err = grantProduct(save, id);
    const hero = PAID_HEROES.find(h => jobProductId(h) === id);
    st.msg = err || (hero ? `${HEROES[hero].name} 해금 · 캐릭터 → 직업에서 전환` : `${NOADS.name} · 스테미너 최대 +${STAMINA.bonus}`) + (r.test ? ' (시험 구매)' : '');
    commit(); syncAds(); render(); refreshCells();
  }
});
