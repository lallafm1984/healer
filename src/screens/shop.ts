/**
 * S18 상점 · S19 시즌 패스 (09, 15 6장, 12). 하위 탭: 골드 · 공훈 · 패스 · 크리스탈.
 * 결제·광고는 자리만 (platform/billing.ts). 개발 빌드는 「시험 구매」로 흐름만 확인.
 */
import {
  BAG_MAX, CRYSTAL_PACKS, itemPrice, MEMBER, MERIT_GEAR_COST, MERIT_WEEK_CAP, PASS_LEVELS, PASS_PREMIUM_CRYSTAL, PASS_XP, passPremium, SEASON, SHARD_CRAFT, SHARD_MAX,
} from '../data/economy';
import { SLOTS, type SlotKey } from '../data/equipment';
import { ITEMS, type ItemKey } from '../data/items';
import { hhmm, seasonOf, untilReset } from '../game/clock';
import { buyItem, buyPremium, claimPass, craftShard, exchangeMerit, grantMember, isMember, passGain, passLevel, type Gain } from '../game/economy';
import { commit, G, refreshDay } from '../game/state';
import { purchase, STORE_WHY } from '../platform/billing';
import { battle, esc, fmt, screen, topBar } from './kit';
import { uiIcon } from './art';

type Sub = 'gold' | 'merit' | 'pass' | 'crystal';
const SUBS: [Sub, string][] = [['gold', '골드'], ['merit', '공훈'], ['pass', '시즌 패스'], ['crystal', '크리스탈']];
const st: { sub: Sub; msg: string } = { sub: 'gold', msg: '' };

const s = screen('s-shop', '상점', { tab: 'shop', enter(arg) { if (typeof arg === 'string' && SUBS.some(([k]) => k === arg)) st.sub = arg as Sub; refreshDay(); st.msg = ''; render(); } });

/** 받은 것 한 줄 */
export function gainText(g: Gain): string {
  const out: string[] = [];
  if (g.gold) out.push(`골드 +${fmt(g.gold)}`);
  if (g.stone) out.push(`강화석 +${g.stone}`);
  if (g.refined) out.push(`정제 강화석 +${g.refined}`);
  if (g.crystal) out.push(`크리스탈 +${g.crystal}`);
  if (g.shards) out.push(`종 조각 +${g.shards}`);
  if (g.ticket) out.push(`모집권 +${g.ticket}`);
  if (g.items?.length) out.push(g.items.map(i => i.name).join(', '));
  if (g.deco) out.push(`「${g.deco}」`);
  if (g.pass) out.push(`패스 경험치 +${g.pass}`);
  return out.join(' · ');
}

const wallet = () => {
  const w = G.save.wallet;
  return `<p class="wallet shop-wallet"><span>${uiIcon('gem')}<b>${fmt(w.crystal)}</b><small>크리스탈</small></span><span>${uiIcon('bell')}<b>${w.shards}/${SHARD_MAX}</b><small>종 조각</small></span><span>${uiIcon('star')}<b>${fmt(w.merit)}</b><small>공훈</small></span><span><b>${G.save.mats.stone}</b><small>강화석</small></span></p>`;
};

function render(): void {
  s.el.innerHTML = `${topBar({ settings: true })}
    <nav class="subtabs" role="tablist">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${n}</button>`).join('')}</nav>
    <div class="ns-body shop">
      <header class="art-hero shop-hero"><div class="ah-copy"><p class="eyebrow">모험가 상점</p><h2>${SUBS.find(([k]) => k === st.sub)![1]}</h2></div></header>
      ${wallet()}
      ${st.msg ? `<p class="warnbox">${esc(st.msg)}</p>` : ''}
      ${st.sub === 'gold' ? goldHtml() : st.sub === 'merit' ? meritHtml() : st.sub === 'pass' ? passHtml() : crystalHtml()}
    </div>`;
  st.msg = '';
}

function goldHtml(): string {
  const lv = G.save.player.level, gold = G.save.player.gold, w = G.save.weekly;
  const rows = (Object.keys(ITEMS) as ItemKey[]).map(k => {
    const price = itemPrice(k, lv), have = G.save.bag[k] || 0;
    // 가격은 버튼 안에 (살 수 있는 만큼). 가방이 가득이면 「가득」
    const btn = (n: number) => {
      const m = Math.min(n, BAG_MAX - have);
      return `<button class="btn mini buy" type="button" data-buy="${k}" data-n="${n}"${price == null || have >= BAG_MAX || gold < price! * m ? ' disabled' : ''}>${n}개<small>${have >= BAG_MAX ? '가득' : `${uiIcon('coin')}${fmt(price! * m)}`}</small></button>`;
    };
    // 위 줄 = 아이콘·이름·구매 버튼, 아래 줄 = 설명 (좁은 화면에서도 설명이 한 줄을 다 씀)
    return `<li class="srow itemrow"><div class="ir-top"><span class="sic">${battle().itemIcon(k)}${have ? `<i class="stack">${have}</i>` : ''}</span><div class="ir-name"><b>${ITEMS[k].name}</b><small${have >= BAG_MAX ? ' class="full"' : ''}>가방 ${have}/${BAG_MAX}${have >= BAG_MAX ? ' · 가득' : ''}</small></div>
      ${price == null ? '<small class="mute">레이드 드롭·주간 보상만</small>' : `<div class="sbuy">${btn(1)}${btn(5)}</div>`}</div><p class="note use">사용: ${esc(ITEMS[k].desc)}</p></li>`;
  }).join('');
  const sh = G.save.wallet.shards;
  const can = sh < SHARD_MAX && w.craft < SHARD_CRAFT.weekly && gold >= SHARD_CRAFT.gold && G.save.mats.stone >= SHARD_CRAFT.stone;
  return `<h3 class="sec">소비 아이템 <small>레벨 비례 가격 · 종류마다 최대 ${BAG_MAX}</small></h3><ul class="slist">${rows}</ul>
    <h3 class="sec">종 조각 제작 <small>이번 주 ${w.craft}/${SHARD_CRAFT.weekly}</small></h3>
    <div class="srow solo"><span class="sic">${uiIcon('bell')}</span><div><b>종 조각</b> <small>보유 ${sh}/${SHARD_MAX}</small><p class="note">악몽 입장권. 출발할 때 1개 소모</p></div>
      <div class="sbuy"><small>${uiIcon('coin')}${fmt(SHARD_CRAFT.gold)} + 강화석 ${SHARD_CRAFT.stone}</small><button class="btn mini primary" type="button" id="craft"${can ? '' : ' disabled'}>제작</button></div></div>`;
}

function meritHtml(): string {
  const w = G.save.wallet, wk = G.save.weekly.merit;
  return `<p class="note">레이드 보스를 잡으면 공훈. 레이드마다 주 ${MERIT_WEEK_CAP}까지 (10인 ${wk[10]}/${MERIT_WEEK_CAP} · 20인 ${wk[20]}/${MERIT_WEEK_CAP})</p>
    <section class="panel mgear"><h4>영웅 장비 <small>원하는 부위 1개</small></h4>
      <div class="gbtns">${SLOTS.map(sl => `<button class="btn" type="button" data-ex="${sl.key}"${w.merit < MERIT_GEAR_COST ? ' disabled' : ''}>${sl.name}<small>공훈 ${MERIT_GEAR_COST}</small></button>`).join('')}</div></section>`;
}

function passHtml(): string {
  const p = G.save.pass, lv = passLevel(p.xp), se = seasonOf();
  const into = lv >= PASS_LEVELS ? PASS_XP : p.xp - lv * PASS_XP;
  const row = (l: number) => {
    const open = l <= lv, gf = p.free.includes(l), gp = p.prem.includes(l);
    const f = gainText(passGain(G.save, l));
    return `<li class="prow${open ? ' open' : ''}"><b>${l}</b>
      <span class="pf">${esc(f)}${open ? (gf ? ' <i>받음</i>' : ` <button class="btn mini" type="button" data-pass="${l}" data-line="free">받기</button>`) : ''}</span>
      <span class="pp">${esc(passPremium(l))}${open && p.premium ? (gp ? ' <i>받음</i>' : ` <button class="btn mini" type="button" data-pass="${l}" data-line="prem">받기</button>`) : ''}</span></li>`;
  };
  return `<section class="panel passhead"><h4>시즌 ${p.season || SEASON.n} 「${SEASON.name}」 <small>${se.week + 1}/${SEASON.weeks}주${se.catchUp ? ' · 따라잡기 경험치 +50%' : ''}</small></h4>
      <p>패스 Lv <b>${lv}</b>/${PASS_LEVELS} <span class="bar"><i style="width:${Math.min(100, (into / PASS_XP) * 100)}%"></i></span> ${fmt(into)}/${fmt(PASS_XP)}</p>
      <p class="note">패스 경험치는 일일·주간 임무에서만 (판 수로는 안 줌). 프리미엄 라인은 꾸미기만 (그림은 원화 작업 때)</p>
      ${p.premium ? '<p class="note">프리미엄 패스 있음</p>' : `<button class="btn primary" type="button" id="premium"${G.save.wallet.crystal < PASS_PREMIUM_CRYSTAL ? ' disabled' : ''}>프리미엄 패스 ${uiIcon('gem')}${fmt(PASS_PREMIUM_CRYSTAL)}</button>`}</section>
    <ul class="plist"><li class="prow head"><b>Lv</b><span class="pf">무료</span><span class="pp">프리미엄</span></li>${Array.from({ length: PASS_LEVELS }, (_, i) => row(i + 1)).join('')}</ul>`;
}

function crystalHtml(): string {
  const dev = G.save.settings.devUnlock, mem = isMember(G.save);
  const left = mem ? Math.ceil((G.save.member - Date.now()) / 864e5) : 0;
  return `<p class="note">${dev ? '개발 빌드: 「시험 구매」는 실제 결제 없이 바로 받음' : esc(STORE_WHY)}. 크리스탈은 골드·장비·재료로 안 바뀜</p>
    <section class="panel member"><h4>프리미엄 회원 <small>${MEMBER.price} / ${MEMBER.days}일</small></h4>
      <p>${uiIcon('gem')} ${MEMBER.now} 바로 + 매일 ${MEMBER.daily} · 상단 배너 없음 · 보상형 광고 없이 바로 보상</p>
      ${mem ? `<p class="note">회원 · ${left}일 남음 (다음 리셋까지 ${hhmm(untilReset())})</p>` : ''}
      <button class="btn primary" type="button" data-iap="${MEMBER.id}">${mem ? '30일 연장' : '가입'}${dev ? ' (시험 구매)' : ''}</button></section>
    <h3 class="sec">크리스탈 <small>첫 구매는 2배</small></h3>
    <ul class="slist">${CRYSTAL_PACKS.map(c => {
      const first = !G.save.firstBuy.includes(c.id);
      return `<li class="srow"><span class="sic">${uiIcon('gem')}</span><div><b>${c.name}</b> <small>${fmt(c.crystal)}${first ? ` + 첫 구매 ${fmt(c.crystal)}` : ''}</small></div><div class="sbuy"><button class="btn mini" type="button" data-iap="${c.id}">${c.price}${dev ? ' 시험' : ''}</button></div></li>`;
    }).join('')}</ul>
    <h3 class="sec">꾸미기 <small>원화 작업 때 · 정보 색은 못 바꿈</small></h3>
    <ul class="slist dim">${[['파티창 애드온', 600], ['애드온 풀세트', 1200], ['힐 이펙트', 400], ['힐 사운드팩', 400], ['힐러 의상', 800], ['정산 미터기 스킨', 300]].map(([n, c]) => `<li class="srow"><span class="sic">✦</span><div><b>${n}</b></div><div class="sbuy"><small>${uiIcon('gem')}${c}</small><button class="btn mini" type="button" disabled>준비 중</button></div></li>`).join('')}</ul>`;
}

s.el.addEventListener('click', async e => {
  const t = e.target as HTMLElement, save = G.save;
  const sub = t.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; render(); return; }
  const b = t.closest<HTMLElement>('[data-buy]');
  if (b) { const k = b.dataset.buy as ItemKey, n = Number(b.dataset.n); const err = buyItem(save, k, n); st.msg = err || `${ITEMS[k].name} 구매 · 가방 ×${save.bag[k]}`; commit(); render(); return; }
  if (t.closest('#craft')) { st.msg = craftShard(save) || `종 조각 제작 · 보유 ${save.wallet.shards}/${SHARD_MAX}`; commit(); render(); return; }
  const ex = t.closest<HTMLElement>('[data-ex]');
  if (ex) { const r = exchangeMerit(save, ex.dataset.ex as SlotKey); st.msg = typeof r === 'string' ? r : `교환: ${r.name} (가방)`; commit(); render(); return; }
  const pa = t.closest<HTMLElement>('[data-pass]');
  if (pa) { const r = claimPass(save, Number(pa.dataset.pass), pa.dataset.line as 'free' | 'prem', Date.now()); st.msg = typeof r === 'string' ? r : `받음: ${gainText(r)}`; commit(); render(); return; }
  if (t.closest('#premium')) { st.msg = buyPremium(save) || '프리미엄 패스 · 지난 단계 꾸미기도 받을 수 있음'; commit(); render(); return; }
  const iap = t.closest<HTMLElement>('[data-iap]');
  if (iap) {
    const id = iap.dataset.iap!;
    const r = await purchase(id, save.settings.devUnlock);
    if (!r.ok) { st.msg = r.why || '구매 안 됨'; render(); return; }
    if (id === MEMBER.id) { grantMember(save, Date.now()); st.msg = `프리미엄 회원 · 💎 +${MEMBER.now}${r.test ? ' (시험 구매)' : ''}`; document.body.classList.add('member'); }
    else {
      const c = CRYSTAL_PACKS.find(x => x.id === id)!;
      const first = !save.firstBuy.includes(id);
      save.wallet.crystal += c.crystal * (first ? 2 : 1);
      if (first) save.firstBuy.push(id);
      st.msg = `💎 +${fmt(c.crystal * (first ? 2 : 1))}${first ? ' (첫 구매 2배)' : ''}${r.test ? ' · 시험 구매' : ''}`;
    }
    commit(); render();
  }
});

