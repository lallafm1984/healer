/** 스테미너 · 앱 결제 상품 · 직업 해금 (81, 2026-10-15 Lim) */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { jobProductId, NOADS, PAID_HEROES, STAMINA } from '../src/data/economy';
import { HEROES } from '../src/data/heroes';
import { grantProduct, products } from '../src/game/economy';
import { Flow } from '../src/game/flow';
import { adCharge, adsFree, spendStamina, staminaCost, staminaMax, staminaView, syncStamina } from '../src/game/stamina';
import { G, heroStatus, switchHero } from '../src/game/state';
import { migrate, newSave, type SaveData } from '../src/platform/storage';

const M = 60e3, H = 60 * M;
/** 2026-10-15 (목) 정오 */
const T0 = new Date(2026, 9, 15, 12).getTime();
const fresh = (): SaveData => { const s = newSave(T0); s.tut = 3; return s; };

describe('스테미너 회복 (81 2-1)', () => {
  it('새 저장은 가득 (100), 가득이면 시간이 지나도 그대로 (비축 없음)', () => {
    const s = fresh();
    expect(staminaView(s, T0)).toMatchObject({ n: 100, max: 100, next: 0, full: 0, adsLeft: 3 });
    expect(staminaView(s, T0 + 10 * H).n).toBe(100);
  });
  it('8분마다 1, 최대치에서 멈춤. 가득일 때 쓰면 그때부터 8분을 셈', () => {
    const s = fresh();
    syncStamina(s, T0 + 5 * H); // 5시간 동안 가득 → 넘친 시간은 쌓이지 않음
    expect(spendStamina(s, 10, T0 + 5 * H)).toBe('');
    expect(staminaView(s, T0 + 5 * H)).toMatchObject({ n: 90, next: 8 * M, full: 80 * M });
    expect(staminaView(s, T0 + 5 * H + 8 * M - 1).n).toBe(90);
    expect(staminaView(s, T0 + 5 * H + 8 * M).n).toBe(91);
    expect(staminaView(s, T0 + 5 * H + 20 * M)).toMatchObject({ n: 92, next: 4 * M });
    expect(staminaView(s, T0 + 9 * H).n).toBe(100);
  });
  it('기기 시계를 되돌리면 그 시각이 다시 올 때까지 차지 않음', () => {
    const s = fresh();
    s.stamina = { n: 40, at: T0 + 2 * H, day: '', ads: 0 };
    expect(staminaView(s, T0).n).toBe(40);
    expect(staminaView(s, T0 + 2 * H + 8 * M).n).toBe(41);
  });
});

describe('입장 비용 (81 2-2)', () => {
  it('탐험 5 · 던전 10 · 주간 도전 10 · 10인 레이드 15 · 20인 레이드 20', () => {
    expect([
      staminaCost(contentOf('plateau')), staminaCost(contentOf('rustfort')), staminaCost(contentOf('rustfort'), 4),
      staminaCost(contentOf('abyss1')), staminaCost(contentOf('cathedral1')),
    ]).toEqual([5, 10, 10, 15, 20]);
  });
  it('모자라면 못 들어가고, 쓴 스테미너는 돌려주지 않음', () => {
    const s = fresh();
    s.stamina.n = 14;
    expect(spendStamina(s, 15, T0)).toMatch(/부족/);
    expect(s.stamina.n).toBe(14);
    expect(spendStamina(s, 10, T0)).toBe('');
    expect(s.stamina.n).toBe(4);
  });
  it('개발 빌드 「스테미너 무제한」: 줄지 않고 0이어도 들어감', () => {
    const s = fresh();
    s.settings.devStamina = true; s.stamina.n = 0;
    expect(spendStamina(s, 20, T0)).toBe('');
    expect(staminaView(s, T0)).toMatchObject({ n: 0, unlimited: true });
  });
});

describe('광고 충전 (81 2-1)', () => {
  it('+50, 최대치를 넘어도 들어감, 넘은 동안은 안 참', () => {
    const s = fresh();
    s.stamina.n = 90;
    expect(adCharge(s, T0)).toBe('');
    expect(staminaView(s, T0 + H)).toMatchObject({ n: 140, next: 0 });
    expect(spendStamina(s, 50, T0 + H)).toBe('');
    expect(staminaView(s, T0 + H + 8 * M).n).toBe(91);
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

describe('앱 결제 상품 (81 3장)', () => {
  it('광고 제거 패키지 5,500원: 최대 +50 (150), 광고 없이 충전', () => {
    const s = fresh();
    expect(products(s).map(p => [p.id, p.price])).toEqual([[NOADS.id, '5,500원'], ...PAID_HEROES.map(h => [jobProductId(h), '2,200원'])]);
    expect(grantProduct(s, NOADS.id)).toBe('');
    expect(grantProduct(s, NOADS.id)).toMatch(/이미/);
    expect(grantProduct(s, 'c100')).toMatch(/없는/);
    expect([adsFree(s), staminaMax(s)]).toEqual([true, 150]);
    expect(staminaView(s, T0 + 8 * M).n).toBe(101);
    expect(STAMINA.max + STAMINA.bonus).toBe(150);
  });
  it('옛 저장 (v13)은 스테미너 가득 · 산 것 없음으로 시작', () => {
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
