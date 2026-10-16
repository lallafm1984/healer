/** 휴식 보너스 (90, 예전 81 스테미너) · 전면 광고 · 앱 결제 상품 · 직업 해금 (81, 2026-10-15 Lim) */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { INTERSTITIAL, jobProductId, NOADS, PAID_HEROES, STAMINA } from '../src/data/economy';
import { HEROES } from '../src/data/heroes';
import { grantProduct, products } from '../src/game/economy';
import { Flow } from '../src/game/flow';
import { settle, type BattleResult } from '../src/game/settle';
import { adCharge, adsFree, restCut, staminaCost, staminaMax, staminaView, syncStamina, useRest } from '../src/game/stamina';
import { G, heroStatus, switchHero } from '../src/game/state';
import { interstitialDue } from '../src/platform/ads';
import { migrate, newSave, type SaveData } from '../src/platform/storage';

const M = 60e3, H = 60 * M;
/** 2026-10-15 (목) 정오 */
const T0 = new Date(2026, 9, 15, 12).getTime();
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
    expect(useRest(s, 10, T0 + 5 * H)).toEqual({ used: 10, cut: false });
    expect(staminaView(s, T0 + 5 * H)).toMatchObject({ n: 90, next: 15 * M, full: 150 * M });
    expect(staminaView(s, T0 + 5 * H + 15 * M - 1).n).toBe(90);
    expect(staminaView(s, T0 + 5 * H + 15 * M).n).toBe(91);
    expect(staminaView(s, T0 + 5 * H + 40 * M)).toMatchObject({ n: 92, next: 5 * M });
    s.stamina = { n: 0, at: T0, day: '', ads: 0 };
    expect(staminaView(s, T0 + 24 * H).n).toBe(96);
    expect(staminaView(s, T0 + 25 * H).n).toBe(100);
  });
  it('기기 시계를 되돌리면 그 시각이 다시 올 때까지 차지 않음', () => {
    const s = fresh();
    s.stamina = { n: 40, at: T0 + 2 * H, day: '', ads: 0 };
    expect(staminaView(s, T0).n).toBe(40);
    expect(staminaView(s, T0 + 2 * H + 15 * M).n).toBe(41);
  });
});

describe('클리어할 때 쓰는 휴식 (90)', () => {
  it('탐험 5 · 던전 10 · 주간 도전 10 · 10인 레이드 15 · 20인 레이드 20', () => {
    expect([
      staminaCost(contentOf('plateau')), staminaCost(contentOf('rustfort')), staminaCost(contentOf('rustfort'), 4),
      staminaCost(contentOf('abyss1')), staminaCost(contentOf('cathedral1')),
    ]).toEqual([5, 10, 10, 15, 20]);
  });
  it('1 이상이면 몫만큼 쓰고 (0 아래로 안 감) 보상 그대로, 0이면 쓰지 않고 1/3', () => {
    const s = fresh();
    s.stamina.n = 14;
    expect(useRest(s, 10, T0)).toEqual({ used: 10, cut: false });
    expect(useRest(s, 15, T0)).toEqual({ used: 4, cut: false });
    expect(s.stamina.n).toBe(0);
    expect(useRest(s, 5, T0)).toEqual({ used: 0, cut: true });
    expect(s.stamina.n).toBe(0);
  });
  it('개발 빌드 「휴식 무제한」: 줄지 않고 0이어도 보상 그대로', () => {
    const s = fresh();
    s.settings.devStamina = true; s.stamina.n = 0;
    expect(useRest(s, 20, T0)).toEqual({ used: 0, cut: false });
    expect(staminaView(s, T0)).toMatchObject({ n: 0, unlimited: true });
  });
  it('1/3: 경험치 · 골드 반올림 (1 이상, 91: 예전 강화석 · 정제 강화석 자리에 골드)', () => {
    expect([restCut(0), restCut(1), restCut(100), restCut(1000)]).toEqual([0, 1, 33, 333]);
  });
});

describe('정산의 휴식 (90 settle)', () => {
  const run = (o: Partial<BattleResult> = {}): BattleResult => ({
    content: 'rustfort', diff: '악몽', win: true, quit: false, reason: '', segIdx: 2, segN: 3, time: 200, restSec: 0, deaths: 0,
    healed: 1000, overheal: 100, dispels: 0, dispellable: 0, endMana: 40, minMana: 20, auto: false, party: [], detail: [], stage: 30, ...o,
  });
  const lv30 = (): SaveData => { const s = fresh(); s.player.level = 30; s.clears.rustfort = { '악몽': { stars: 3, grade: 'S', best: 100, n: 1 } }; return s; };
  it('휴식이 있으면 던전 10을 쓰고 경험치 · 골드 그대로, 0이면 1/3 · 장비는 그대로', () => {
    const a = lv30(), b = lv30();
    b.stamina.n = 0;
    const xa = settle(a, run(), () => 0.5, [], T0), xb = settle(b, run(), () => 0.5, [], T0);
    expect(xa.rest).toEqual({ used: 10, cut: false });
    expect(a.stamina.n).toBe(90);
    expect(xb.rest).toEqual({ used: 0, cut: true });
    expect(b.stamina.n).toBe(0);
    expect(xb.xp).toBe(Math.round(xa.xp / 3));
    expect(xa.gold).toBeGreaterThan(0);
    expect(xb.gold).toBe(Math.round(xa.gold / 3));
    expect([a.player.gold, b.player.gold]).toEqual([xa.gold, xb.gold]);
    expect(xb.items.length).toBe(1);
  });
  it('진 판 · 포기 · 튜토리얼은 휴식을 쓰지 않음 (rest = null)', () => {
    const s = lv30();
    expect(settle(s, run({ win: false }), () => 0.5, [], T0).rest).toBeNull();
    expect(settle(s, run({ win: false, quit: true }), () => 0.5, [], T0).rest).toBeNull();
    const t = newSave(T0);
    expect(settle(t, run({ content: 'plateau', diff: '쉬움' }), () => 0.5, [], T0).rest).toBeNull();
    expect([s.stamina.n, t.stamina.n]).toEqual([100, 100]);
  });
  it('주간 도전은 10, 레이드는 10인 15', () => {
    const s = lv30();
    expect(settle(s, run({ chal: 3, limit: 9999 }), () => 0.5, [], T0).rest).toEqual({ used: 10, cut: false });
    expect(settle(s, run({ content: 'abyss1', diff: '보통', segIdx: 0, segN: 1 }), () => 0.5, [], T0).rest).toEqual({ used: 15, cut: false });
    expect(s.stamina.n).toBe(75);
  });
});

describe('휴식 광고 충전 (90)', () => {
  it('+30, 최대치를 넘어도 들어감, 넘은 동안은 안 참', () => {
    const s = fresh();
    s.stamina.n = 90;
    expect(adCharge(s, T0)).toBe('');
    expect(staminaView(s, T0 + H)).toMatchObject({ n: 120, next: 0 });
    expect(useRest(s, 20, T0 + H)).toEqual({ used: 20, cut: false });
    expect(useRest(s, 10, T0 + H)).toEqual({ used: 10, cut: false });
    expect(staminaView(s, T0 + H + 15 * M).n).toBe(91);
  });
  it('하루 3번, 오전 6시에 다시 3번', () => {
    const s = fresh();
    for (let i = 0; i < 3; i++) expect(adCharge(s, T0)).toBe('');
    expect(adCharge(s, T0)).toMatch(/3번/);
    expect(staminaView(s, T0).adsLeft).toBe(0);
    const nextDay5 = new Date(2026, 9, 16, 5, 59).getTime(), nextDay6 = new Date(2026, 9, 16, 6).getTime();
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
  it('예전에 바꿔 본 직업은 사지 않아도 계속 열림 (이전 해금 보존)', () => {
    G.save.heroes.monk = { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 3 };
    expect(heroStatus('monk')).toMatchObject({ state: 'open', buy: false });
  });
});
