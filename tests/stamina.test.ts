/** 휴식 보너스 (90, 예전 81 스테미너) · 전면 광고 · 앱 결제 상품 · 직업 해금 (81, 2026-10-15 Lim) */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { INTERSTITIAL, JOB_GOLD, jobProductId, NOADS, PAID_HEROES, REST_BONUS, STAMINA } from '../src/data/economy';
import { HEROES } from '../src/data/heroes';
import { buyJobWithGold, grantProduct, products } from '../src/game/economy';
import { Flow } from '../src/game/flow';
import { settle, type BattleResult } from '../src/game/settle';
import { adCharge, adsFree, restBase, restBonusOf, restGain, staminaCost, staminaMax, staminaView, syncStamina, useRest } from '../src/game/stamina';
import { G, heroStatus, switchHero } from '../src/game/state';
import { interstitialDue } from '../src/platform/ads';
import { migrate, newSave, type SaveData } from '../src/platform/storage';

const M = 60e3, H = 60 * M;
/** 2026-10-15 (목) 정오 */
const T0 = Date.UTC(2026, 9, 15, 12);
const fresh = (): SaveData => { const s = newSave(T0); s.tut = 3; return s; };

describe('휴식 회복 (90)', () => {
  it('새 저장은 가득 (100), 가득이면 시간이 지나도 그대로 (비축 없음)', () => {
    const s = fresh();
    expect(staminaView(s, T0)).toMatchObject({ n: 100, max: 100, next: 0, full: 0, adsLeft: 3 });
    expect(staminaView(s, T0 + 10 * H).n).toBe(100);
  });
  it('15분마다 1 (하루 96, 가득까지 25시간), 최대치에서 멈춤. 가득일 때 쓰면 그때부터 15분을 셈', () => {
    const s = fresh();
    syncStamina(s, T0 + 5 * H); // 5시간 동안 가득 → 넘친 시간은 쌓이지 않음
    expect(useRest(s, 10, T0 + 5 * H)).toEqual({ used: 10, share: 1 });
    expect(staminaView(s, T0 + 5 * H)).toMatchObject({ n: 90, next: 15 * M, full: 150 * M });
    expect(staminaView(s, T0 + 5 * H + 15 * M - 1).n).toBe(90);
    expect(staminaView(s, T0 + 5 * H + 15 * M).n).toBe(91);
    expect(staminaView(s, T0 + 5 * H + 40 * M)).toMatchObject({ n: 92, next: 5 * M });
    s.stamina = { n: 0, at: T0, day: '', ads: 0 };
    expect(staminaView(s, T0 + 24 * H).n).toBe(96);
    expect(staminaView(s, T0 + 25 * H).n).toBe(100);
  });
  it('기기 시계를 되돌리면 그 시각이 다시 올 때까지 차지 않음 (105 QA: 지금으로 당기면 시계를 뒤로 갔다 오는 것만으로 +96)', () => {
    const s = fresh();
    s.stamina = { n: 40, at: T0 + 2 * H, day: '', ads: 0 };
    expect(staminaView(s, T0).n).toBe(40);
    syncStamina(s, T0);
    expect(s.stamina.at).toBe(T0 + 2 * H);
    expect(staminaView(s, T0 + 2 * H + 15 * M).n).toBe(41);
    // 24시간 뒤로 갔다 돌아와도 공짜로 안 참
    const t = fresh(); t.stamina = { n: 10, at: T0, day: '', ads: 0 };
    syncStamina(t, T0 - 24 * H); syncStamina(t, T0);
    expect(t.stamina.n).toBe(10);
  });
});

describe('클리어할 때 쓰는 휴식 (90)', () => {
  it('탐험 10 · 던전 20 · 주간 도전 10 · 10인 레이드 30 · 20인 레이드 40', () => {
    expect([
      staminaCost(contentOf('plateau')), staminaCost(contentOf('rustfort')), staminaCost(contentOf('rustfort'), 4),
      staminaCost(contentOf('abyss1')), staminaCost(contentOf('cathedral1')),
    ]).toEqual([10, 20, 10, 30, 40]);
  });
  it('몫만큼 쓰고 휴식 보너스 전부, 모자라면 있는 만큼 다 쓰고 보너스도 그만큼 (비례, 2026-10-17: 휴식 3 · 던전 10 = 3/10), 0이면 쓰지 않고 기본 보상', () => {
    const s = fresh();
    s.stamina.n = 14;
    expect(useRest(s, 10, T0)).toEqual({ used: 10, share: 1 });
    expect(useRest(s, 15, T0)).toEqual({ used: 4, share: 4 / 15 });
    expect(s.stamina.n).toBe(0);
    expect(useRest(s, 5, T0)).toEqual({ used: 0, share: 0 });
    expect(s.stamina.n).toBe(0);
    s.stamina.n = 3;
    expect(useRest(s, 10, T0)).toEqual({ used: 3, share: 0.3 });
    // 받는 값 = 기본 + 보너스 몫 × share (휴식 판 300 = 기본 150 + 보너스 150)
    expect([restGain(300, 1), restGain(300, 0.3), restGain(300, 0), restGain(301, 0.5)]).toEqual([300, 195, 150, 226]);
  });
  it('15분마다 차는 1로 던전 보너스는 1/20만 받음', () => {
    const s = fresh();
    s.stamina = { n: 0, at: T0, day: '', ads: 0 };
    expect(useRest(s, staminaCost(contentOf('rustfort')), T0 + 15 * M)).toEqual({ used: 1, share: 0.05 });
    expect(restGain(1000, 0.05) - restBase(1000)).toBe(25);
  });
  it('개발 빌드 「휴식 무제한」: 줄지 않고 0이어도 휴식 보너스 전부', () => {
    const s = fresh();
    s.settings.devStamina = true; s.stamina.n = 0;
    expect(useRest(s, 20, T0)).toEqual({ used: 0, share: 1 });
    expect(staminaView(s, T0)).toMatchObject({ n: 0, unlimited: true });
  });
  it('기본 보상 = 휴식 보상의 1/REST_BONUS (반올림, 1 이상), 휴식 보너스 몫 = 휴식 보상 − 기본 (기본 × 배수로 다시 셈하지 않음)', () => {
    expect(REST_BONUS).toBe(2); // 2026-10-17 Lim 「휴식 보너스는 두배로」 (예전 기본 1/3)
    expect([restBase(0), restBase(1), restBase(3), restBase(100), restBase(1001)]).toEqual([0, 1, 2, 50, 501]);
    expect([restBonusOf(0), restBonusOf(1), restBonusOf(3), restBonusOf(100), restBonusOf(1001)]).toEqual([0, 0, 1, 50, 500]);
    for (const n of [1, 2, 7, 100, 1234]) expect(restBase(n) + restBonusOf(n)).toBe(n);
  });
});

describe('정산의 휴식 (90 settle)', () => {
  const run = (o: Partial<BattleResult> = {}): BattleResult => ({
    content: 'rustfort', diff: '악몽', win: true, quit: false, reason: '', segIdx: 2, segN: 3, time: 200, restSec: 0, deaths: 0,
    healed: 1000, overheal: 100, dispels: 0, dispellable: 0, endMana: 40, minMana: 20, auto: false, party: [], detail: [], stage: 30, ...o,
  });
  const lv30 = (): SaveData => { const s = fresh(); s.player.level = 30; s.clears.rustfort = { '악몽': { stars: 3, grade: 'S', best: 100, n: 1 } }; return s; };
  it('던전 20 소비, 휴식 3이면 보너스 3/20, 휴식 0의 기본 보상·장비는 그대로', () => {
    const a = lv30(), b = lv30(), c = lv30();
    b.stamina.n = 0; c.stamina.n = 3;
    const xa = settle(a, run(), () => 0.5, [], T0), xb = settle(b, run(), () => 0.5, [], T0), xc = settle(c, run(), () => 0.5, [], T0);
    expect(xa.rest).toEqual({ used: 20, share: 1 });
    expect(a.stamina.n).toBe(80);
    expect(xb.rest).toEqual({ used: 0, share: 0 });
    expect(xc.rest).toEqual({ used: 3, share: 0.15 });
    expect(c.stamina.n).toBe(0);
    expect(xc.xp).toBe(xb.xp + Math.round((xa.xp - xb.xp) * 0.15));
    expect(xc.restBonus).toEqual({ xp: xc.xp - xb.xp, gold: xc.gold - xb.gold });
    expect(b.stamina.n).toBe(0);
    expect(xb.xp).toBe(Math.round(xa.xp / REST_BONUS));
    expect(xa.gold).toBeGreaterThan(0);
    expect(xb.gold).toBe(Math.round(xa.gold / REST_BONUS));
    expect([a.player.gold, b.player.gold]).toEqual([xa.gold, xb.gold]);
    expect(xb.items.length).toBe(1);
    // 휴식 보너스 몫 = 휴식 보상 − 기본 보상, 기본만 받은 판은 null (결과 화면 꼬리표 없음)
    expect(xa.restBonus).toEqual({ xp: xa.xp - xb.xp, gold: xa.gold - xb.gold });
    expect(xb.restBonus).toBeNull();
  });
  it('진 판 · 포기 · 튜토리얼은 휴식을 쓰지 않음 (rest = null)', () => {
    const s = lv30();
    expect(settle(s, run({ win: false }), () => 0.5, [], T0).rest).toBeNull();
    expect(settle(s, run({ win: false, quit: true }), () => 0.5, [], T0).rest).toBeNull();
    const t = newSave(T0);
    expect(settle(t, run({ content: 'plateau', diff: '쉬움' }), () => 0.5, [], T0).rest).toBeNull();
    expect([s.stamina.n, t.stamina.n]).toEqual([100, 100]);
  });
  it('주간 도전은 10, 레이드는 10인 30', () => {
    const s = lv30();
    expect(settle(s, run({ chal: 3, limit: 9999 }), () => 0.5, [], T0).rest).toEqual({ used: 10, share: 1 });
    expect(settle(s, run({ content: 'abyss1', diff: '보통', segIdx: 0, segN: 1 }), () => 0.5, [], T0).rest).toEqual({ used: 30, share: 1 });
    expect(s.stamina.n).toBe(60);
  });
});

describe('휴식 광고 충전 (90)', () => {
  it.each([0, 40, 99])('휴식 %i에서 광고를 보면 최대 100까지 충전하고 자연 회복 시계를 다시 시작', n => {
    const s = fresh();
    s.stamina.n = n;
    expect(adCharge(s, T0)).toBe('');
    expect(staminaView(s, T0 + H)).toMatchObject({ n: 100, next: 0 });
    expect(useRest(s, 20, T0 + H)).toEqual({ used: 20, share: 1 });
    expect(staminaView(s, T0 + H + 15 * M).n).toBe(81);
  });
  it('광고 제거 패키지는 최대 150까지 충전', () => {
    const s = fresh(); s.bought.push(NOADS.id); s.stamina.n = 10;
    expect(adCharge(s, T0)).toBe('');
    expect([s.stamina.n, s.stamina.ads]).toEqual([150, 1]);
  });
  it.each([100, 130])('이미 %i이면 충전 횟수를 쓰지 않고 초과 보유량도 보존', n => {
    const s = fresh(); s.stamina.n = n;
    expect(adCharge(s, T0)).toMatch(/가득/);
    expect([s.stamina.n, s.stamina.ads]).toEqual([n, 0]);
  });
  it('하루 3번, UTC 0시 (한국 오전 9시)에 다시 3번', () => {
    const s = fresh();
    for (let i = 0; i < 3; i++) { s.stamina.n = 0; expect(adCharge(s, T0)).toBe(''); }
    s.stamina.n = 0;
    expect(adCharge(s, T0)).toMatch(/3번/);
    expect(staminaView(s, T0).adsLeft).toBe(0);
    const nextDay5 = Date.UTC(2026, 9, 15, 23, 59), nextDay6 = Date.UTC(2026, 9, 16, 0);
    expect(adCharge(s, nextDay5)).toMatch(/3번/);
    expect(adCharge(s, nextDay6)).toBe('');
    expect(staminaView(s, nextDay6).adsLeft).toBe(2);
  });
});

describe('전면 광고 (90)', () => {
  const due = (o: Partial<Parameters<typeof interstitialDue>[0]> = {}) => interstitialDue({ won: true, level: 10, tutDone: true, adsFree: false, ms: INTERSTITIAL.everyMs, ...o });
  it('클리어 · Lv 10 이상 · 튜토리얼 끝 · 광고 제거 안 삼 · 화면 10분 지남이면 띄움', () => {
    expect(INTERSTITIAL).toEqual({ everyMs: 10 * M, minLv: 10 });
    expect(due()).toBe(true);
    expect([due({ won: false }), due({ level: 9 }), due({ tutDone: false }), due({ adsFree: true }), due({ ms: 10 * M - 1 })]).toEqual([false, false, false, false, false]);
  });
});

describe('앱 결제 상품 (81 3장)', () => {
  it('광고 제거 패키지 5,500원: 휴식 최대 +50 (150), 광고 없이 충전', () => {
    const s = fresh();
    expect(products(s).map(p => [p.id, p.price])).toEqual([[NOADS.id, '5,500원'], ...PAID_HEROES.map(h => [jobProductId(h), '2,200원'])]);
    expect(grantProduct(s, NOADS.id)).toBe('');
    expect(grantProduct(s, NOADS.id)).toMatch(/이미/);
    expect(grantProduct(s, 'c100')).toMatch(/없는/);
    expect([adsFree(s), staminaMax(s)]).toEqual([true, 150]);
    expect(staminaView(s, T0 + 15 * M).n).toBe(101);
    expect(STAMINA.max + STAMINA.bonus).toBe(150);
  });
  it('옛 저장 (v13)은 휴식 가득 · 산 것 없음으로 시작', () => {
    const d = migrate({ v: 13, createdAt: 1, player: { level: 30, xp: 0, gold: 5 } });
    expect([d.stamina.n, d.bought]).toEqual([100, []]);
  });
});

describe('직업 해금 (81 3-2)', () => {
  beforeEach(() => { G.save = fresh(); Flow.running = false; });
  afterEach(() => { G.save = newSave(1); });
  it('드루이드 Lv 20 · 성기사 Lv 30 무료, 나머지 4종은 상점 2,200원 (레벨과 상관없음)', () => {
    expect([HEROES.druid.unlock.lv, HEROES.paladin.unlock.lv]).toEqual([20, 30]);
    expect(PAID_HEROES.every(h => HEROES[h].unlock.buy)).toBe(true);
    G.save.player.level = 19;
    expect(heroStatus('druid')).toMatchObject({ state: 'locked', buy: false });
    G.save.player.level = 29;
    expect([heroStatus('druid').state, heroStatus('paladin').state]).toEqual(['open', 'locked']);
    G.save.player.level = 100;
    expect(heroStatus('paladin').state).toBe('open');
    expect(PAID_HEROES.map(h => heroStatus(h))).toEqual(PAID_HEROES.map(() => expect.objectContaining({ state: 'locked', buy: true })));
    expect(switchHero('shaman', T0)).toBe(false);
  });
  it('사면 Lv 1이어도 바로 전환 · 모든 캐릭터에서 (계정)', () => {
    G.save.player.level = 1;
    expect(grantProduct(G.save, jobProductId('warder'))).toBe('');
    expect(heroStatus('warder')).toMatchObject({ state: 'open', buy: false });
    expect(heroStatus('monk').state).toBe('locked');
    expect(switchHero('warder', T0)).toBe(true);
    expect(G.save.hero).toBe('warder');
  });
  it('골드로도 삼: 50,000골드 · 레벨 조건 없음, 산 기록은 현금과 같은 상품 (2026-10-28 Lim)', () => {
    expect(JOB_GOLD).toBe(50_000);
    G.save.player.level = 1; G.save.player.gold = JOB_GOLD - 1;
    expect(buyJobWithGold(G.save, 'monk')).toMatch(/골드 부족/);
    expect([G.save.player.gold, G.save.bought]).toEqual([JOB_GOLD - 1, []]);
    G.save.player.gold = JOB_GOLD + 7;
    expect(buyJobWithGold(G.save, 'monk')).toBe('');
    expect([G.save.player.gold, G.save.bought]).toEqual([7, [jobProductId('monk')]]);
    expect(heroStatus('monk')).toMatchObject({ state: 'open', buy: false });
    expect(switchHero('monk', T0)).toBe(true);
    G.save.player.gold = 1e6;
    expect(buyJobWithGold(G.save, 'monk')).toMatch(/이미/);
    expect(buyJobWithGold(G.save, 'druid')).toMatch(/없는/); // 무료 직업은 상품이 아님
    expect(G.save.player.gold).toBe(1e6);
    // 개발 빌드 골드 무제한: 잔액은 그대로 (91)
    G.save.settings.devGold = true; G.save.player.gold = 0;
    expect([buyJobWithGold(G.save, 'warder'), G.save.player.gold]).toEqual(['', 0]);
  });
  it('예전에 바꿔 본 직업은 사지 않아도 계속 열림 (이전 해금 보존)', () => {
    G.save.heroes.monk = { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 3 };
    expect(heroStatus('monk')).toMatchObject({ state: 'open', buy: false });
  });
});
