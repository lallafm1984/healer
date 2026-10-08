/** 길드 (02 9장, 12 3-3, 17 8~9장): 열림, 영입, 육성, 편성, 판 뒤 경험치·인연 스카우트, 저장 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CLASSES } from '../src/data/classes';
import { ENCOUNTERS } from '../src/data/encounters';
import { guildCap, memberPower, pointsAt, type GuildMember } from '../src/data/guild';
import { clearXp, xpToNext } from '../src/data/progression';
import * as E from '../src/engine';
import {
  addMemberXp, autoPick, guildAfter, guildOpen, guildRoster, hire, makeCandidate, postRecruit, release, rerollAbility, resetPoints, scoutHire, spendPoint, togglePick, train,
} from '../src/game/guild';
import { settle, type BattleResult } from '../src/game/settle';
import { migrate, newSave, SAVE_VERSION, type SaveData } from '../src/platform/storage';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function save(level = 15, gold = 100000): SaveData {
  const s = newSave(1);
  s.tut = 3; s.player.level = level; s.player.gold = gold; s.settings.devUnlock = false;
  return s;
}
const mem = (o: Partial<GuildMember> = {}): GuildMember => ({
  id: 0, nick: '바위', cls: 'warrior', pers: '신중파', traits: [], lv: 15, xp: 0, apt0: [3, 3, 3], aptUp: [0, 0, 0], ab: 'warrior.shieldBlock', star: 0, runs: 0, ...o,
});
function add(s: SaveData, o: Partial<GuildMember> = {}): GuildMember {
  const m = mem({ ...o, id: s.guild.nextId++ });
  if (!o.nick) m.nick = `길드원${m.id}`;
  s.guild.members.push(m);
  return m;
}

describe('열림 · 정원 (02 9-2, 18)', () => {
  it('Lv 15에 열림, 튜토리얼 전엔 닫힘, 개발 빌드 잠금 무시면 미리 열림', () => {
    expect(guildOpen(save(14)).ok).toBe(false);
    expect(guildOpen(save(15)).ok).toBe(true);
    const s = save(3); s.settings.devUnlock = true;
    expect(guildOpen(s)).toMatchObject({ ok: true, dev: true });
    const t = save(20); t.tut = 1;
    expect(guildOpen(t).ok).toBe(false);
  });
  it('정원 6 → Lv 35 12 → Lv 70 25', () => {
    expect([15, 34, 35, 69, 70].map(l => guildCap(l).cap)).toEqual([6, 6, 12, 12, 25]);
  });
});

describe('영입 (02 9-3, 12 3-3)', () => {
  beforeEach(() => { seed = 7; });
  it('골드 모집: 공고 비용, 지원자 3명, 레벨은 공고 등급 범위 (내 레벨 위로 안 감)', () => {
    const s = save(30, 10000);
    expect(postRecruit(s, 'best', rng)).toBe('');
    expect(s.player.gold).toBe(2000);
    expect(s.guild.post!.cands.length).toBe(3);
    for (const c of s.guild.post!.cands) {
      expect(c.lv).toBeGreaterThanOrEqual(29); expect(c.lv).toBeLessThanOrEqual(30);
      expect(ABILITIES[c.ab].cls).toBe(c.cls);
      expect(new Set(s.guild.post!.cands.map(x => x.nick)).size).toBe(3);
    }
    expect(postRecruit(s, 'best', rng)).toMatch(/골드 부족/);
    expect(hire(s, 1)).toBe('');
    expect(s.guild.members.length).toBe(1);
    expect(s.guild.post).toBeNull();
  });
  it('일반 공고 지원자는 내 레벨보다 3~6 낮음, 탱커는 덜렁이·겁쟁이 아님', () => {
    const s = save(40);
    for (let i = 0; i < 200; i++) {
      const c = makeCandidate(s, rng, 'normal');
      expect(c.lv).toBeGreaterThanOrEqual(34); expect(c.lv).toBeLessThanOrEqual(37);
      if (CLASSES[c.cls].role === 'tank') expect(['덜렁이', '겁쟁이']).not.toContain(c.pers);
    }
  });
  it('정원이 다 차면 공고·영입 안 됨', () => {
    const s = save(15);
    for (let i = 0; i < 6; i++) add(s);
    expect(postRecruit(s, 'normal', rng)).toMatch(/정원/);
  });
  it('인연 스카우트 300 골드', () => {
    const s = save(15, 299);
    s.guild.scouts.push({ nick: '칼날', cls: 'rogue', pers: '감사형', traits: [], lv: 12, apt0: [3, 4, 3], ab: 'rogue.kick', from: '녹슨 요새' });
    expect(scoutHire(s, 0)).toMatch(/골드 부족/);
    s.player.gold = 300;
    expect(scoutHire(s, 0)).toBe('');
    expect([s.player.gold, s.guild.scouts.length, s.guild.members[0].nick, s.guild.members[0].ab]).toEqual([0, 0, '칼날', 'rogue.kick']);
  });
});

describe('육성 (17 8장, 12 3-3)', () => {
  it('훈련: 레벨 × 30 골드, 내 레벨까지만', () => {
    const s = save(15, 1000), m = add(s, { lv: 14 });
    expect(train(s, m.id)).toBe('');
    expect([m.lv, s.player.gold]).toEqual([15, 1000 - 420]);
    expect(train(s, m.id)).toMatch(/내 레벨/);
  });
  it('육성 포인트: Lv 20부터 10레벨마다 1점 (최대 9), 1점 = 레벨 × 100 골드, 자질·★ 최대 5', () => {
    expect([19, 20, 29, 30, 100].map(pointsAt)).toEqual([0, 1, 1, 2, 9]);
    const s = save(50, 100000), m = add(s, { lv: 40, apt0: [4, 3, 3] });
    expect(spendPoint(s, m.id, 0)).toBe('');
    expect(spendPoint(s, m.id, 0)).toMatch(/최대/);
    expect(spendPoint(s, m.id, 'star')).toBe('');
    expect(spendPoint(s, m.id, 'star')).toBe('');
    expect(spendPoint(s, m.id, 1)).toMatch(/포인트 없음/);
    expect([m.aptUp, m.star, s.player.gold]).toEqual([[1, 0, 0], 2, 100000 - 3 * 4000]);
    expect(resetPoints(s, m.id)).toBe('');
    expect([m.aptUp, m.star, s.player.gold]).toEqual([[0, 0, 0], 0, 100000 - 12000 - 5000]);
  });
  it('능력 다시 뽑기 3,000: 같은 직업 안에서, ★ 유지', () => {
    seed = 3;
    const s = save(30, 3000), m = add(s, { star: 2 });
    expect(rerollAbility(s, m.id, rng)).toBe('');
    expect([ABILITIES[m.ab].cls, m.star, s.player.gold]).toEqual(['warrior', 2, 0]);
  });
  it('전투력 (17 9-3): Lv 30 · 자질 9 · 일반 능력 = 3,000', () => {
    expect(memberPower({ lv: 30, apt: [3, 3, 3], ab: 'warrior.shieldBlock', star: 0, traits: [] })).toBe(3000);
    expect(memberPower({ lv: 30, apt: [5, 4, 4], ab: 'warrior.shieldWall', star: 2, traits: [] })).toBe(Math.round(3000 * 1.12 * 1.04 * 1.03));
  });
  it('방출', () => {
    const s = save(), m = add(s);
    s.guild.pick = [m.id];
    expect(release(s, m.id)).toBe(true);
    expect([s.guild.members.length, s.guild.pick]).toEqual([0, []]);
  });
});

describe('길드파티 편성 (02 9-2)', () => {
  const plague = ENCOUNTERS.plague;
  it('자동 편성 = 전투력 순, 탱커 2 · 딜러 7 자리를 넘지 않음', () => {
    const s = save(40);
    const t = [add(s, { lv: 30 }), add(s, { lv: 40 }), add(s, { lv: 35 })];
    const d = [add(s, { cls: 'mage', ab: 'mage.blink', lv: 38 })];
    const pick = autoPick(s, plague);
    expect(pick).toEqual([t[1].id, d[0].id, t[2].id]);
    expect(togglePick(s, plague, pick, t[0].id).msg).toMatch(/탱커 자리/);
  });
  it('빈자리는 공개모집 파티에서 같은 역할로 채움, 길드원 정보는 전투로', () => {
    const s = save(40);
    const t = add(s, { lv: 33, apt0: [2, 5, 4], star: 3 }), d = add(s, { cls: 'archer', ab: 'archer.snipe', lv: 31 });
    const pub = E.recruitParty('plague', 5, { abilities: true });
    const roster = guildRoster(s, [t.id, d.id], pub, plague);
    expect(roster.length).toBe(9);
    expect(roster.filter(r => r.role === 'tank').length).toBe(2);
    expect(roster[0]).toMatchObject({ gid: t.id, lv: 33, apt: [2, 5, 4], ab: 'warrior.shieldBlock', star: 3 });
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 1, party: roster, stageLv: 35 });
    expect(f.party.find(u => u.gid === d.id)!.ab!.key).toBe('archer.snipe');
  });
});

describe('판 뒤 (02 9장)', () => {
  it('길드원 경험치: 레벨 상한 = 내 레벨, 상한에서도 다음 레벨 바로 앞까지 모아 둠 (32)', () => {
    const m = mem({ lv: 14 });
    expect(addMemberXp(m, 1e9, 15)).toEqual([15]);
    expect([m.lv, m.xp]).toEqual([15, xpToNext(15) - 1]);
    expect(addMemberXp(m, 100, 15)).toEqual([]);
    expect(m.xp).toBe(xpToNext(15) - 1);
    // 내가 Lv 16이 되면 다음 판에 바로 따라옴
    expect(addMemberXp(m, 1, 16)).toEqual([16]);
    const n = mem({ lv: 20, xp: 0 });
    expect(addMemberXp(n, 50, 20)).toEqual([]);
    expect([n.lv, n.xp]).toEqual([20, 50]);
  });
  it('길드 평균보다 낮으면 2배, 인연 = 이긴 판(S·A)에서 살아남은 공개모집 중 내 힐을 가장 많이 받은 1명', () => {
    seed = 5;
    const s = save(30);
    const lo = add(s, { lv: 10 }), hi = add(s, { lv: 29 });
    const pub = E.recruitParty('warden', 2, { abilities: true });
    const roster = [{ ...pub[0] }, { ...pub[1] }, ...[lo, hi].map(m => ({ role: 'melee' as const, cls: m.cls, pers: m.pers, nick: m.nick, gid: m.id }))];
    const party = [
      { nick: pub[0].nick, alive: true, got: 500 }, { nick: pub[1].nick, alive: true, got: 900 },
      { nick: lo.nick, alive: true, got: 2000, gid: lo.id }, { nick: hi.nick, alive: true, got: 0, gid: hi.id },
    ];
    const r = guildAfter(s, rng, { win: true, quit: false, grade: 'A', diff: '보통', stage: 25, raid: 0, content: '녹슨 요새', party, roster });
    const [a, b] = r.members;
    expect(a.nick).toBe(lo.nick);
    expect(a.xp).toBe(Math.round(clearXp(10, '보통', 'A', { raid: 0, win: true }) * 2)); // 평균(19.5)보다 낮음 → 2배
    expect(b.xp).toBe(clearXp(29, '보통', 'A', { raid: 0, win: true }));
    expect(r.scout!.nick).toBe(pub[1].nick);
    expect(r.scout!.lv).toBe(25);
    expect(s.guild.scouts.length).toBe(1);
    expect([lo.runs, hi.runs, s.guild.fame]).toEqual([1, 1, 1]);
    // 같은 사람은 두 번 안 들어감, B 등급이면 인연 없음
    expect(guildAfter(s, rng, { win: true, quit: false, grade: 'A', diff: '보통', stage: 25, raid: 0, content: 'x', party, roster }).scout).toBeNull();
    expect(guildAfter(s, rng, { win: true, quit: false, grade: 'B', diff: '보통', stage: 25, raid: 0, content: 'x', party: party.map(p => ({ ...p, nick: `${p.nick}2` })), roster }).scout).toBeNull();
  });
  it('settle에 편성을 넘기면 길드 정산 (포기한 판은 없음)', () => {
    const s = save(20);
    const m = add(s, { lv: 18 });
    const base: BattleResult = {
      content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 3, time: 200, restSec: 0, deaths: 0, healed: 1000, overheal: 100,
      dispels: 0, dispellable: 0, endMana: 50, minMana: 20, auto: false, party: [{ nick: m.nick, pers: '신중파', role: 'tank', alive: true, got: 10, gid: m.id }], detail: [],
    };
    const x = settle(s, base, rng, [{ role: 'tank', cls: 'warrior', pers: '신중파', nick: m.nick, gid: m.id }]);
    expect(x.guild!.members[0].xp).toBeGreaterThan(0);
    expect(settle(s, { ...base, quit: true, win: false }, rng, [{ role: 'tank', cls: 'warrior', pers: '신중파', nick: m.nick, gid: m.id }]).guild!.members).toEqual([]);
    expect(settle(s, base, rng).guild).toBeNull();
  });
});

describe('저장 v4', () => {
  it('옛 저장은 빈 길드, 깨진 값은 기본값', () => {
    const d = migrate({ v: 3, createdAt: 1 });
    expect(d.v).toBe(SAVE_VERSION);
    expect(d.guild).toMatchObject({ name: '새벽의 손', members: [], scouts: [], post: null, fame: 0, nextId: 1, pick: [] });
    expect(migrate({ v: 4, guild: { members: 'x', fame: 'y', post: { cands: 1 } } }).guild).toMatchObject({ members: [], fame: 0, post: null });
    const g = migrate({ v: 4, guild: { members: [mem({ id: 3 })], nextId: 4 } }).guild;
    expect([g.members.length, g.nextId]).toEqual([1, 4]);
  });
});
