import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FEATURES } from '../src/data/features';
import { memberSkillLevel } from '../src/data/guild';
import { PARTY_POOL } from '../src/data/nicknames';
import { xpToNext } from '../src/data/progression';
import { rngFrom } from '../src/engine/rng';
import { memberEntry, newMember, personOf } from '../src/game/guild';
import { settle, type BattleResult } from '../src/game/settle';
import { TUT } from '../src/game/tutorial';
import { newSave, type SaveData } from '../src/platform/storage';
import { dayKey } from '../src/game/clock';

const enabled = FEATURES.guild;
beforeAll(() => { FEATURES.guild = true; });
afterAll(() => { FEATURES.guild = enabled; });

function setup(): SaveData {
  const s = newSave();
  s.player.level = 40; s.tut = TUT.done;
  s.guild.founded = s.guild.storySeen = true;
  s.guild.members = PARTY_POOL.mage.slice(0, 4).map(p => ({ ...newMember(s, personOf(p.nick)!, 20), id: s.guild.nextId++ }));
  s.guild.members[0].boost = s.guild.members[3].boost = 5;
  s.guild.reqs = { day: dayKey(), list: [0, 2].map(i => ({ nick: s.guild.members[i].nick, content: 'rustfort', diff: '보통', done: false })) }; // 오늘 부탁 (지난 날 부탁은 정산이 건너뜀, 105 QA 2)
  return s;
}
function run(s: SaveData, override: Partial<BattleResult> = {}, ids = [0, 1]) {
  const roster = ids.map(i => memberEntry(s, s.guild.members[i]));
  const result: BattleResult = {
    content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 3, time: 200, restSec: 0,
    deaths: 0, healed: 1000, overheal: 100, dispels: 0, dispellable: 0, endMana: 50, minMana: 20, auto: false,
    party: roster.map(e => ({ nick: e.nick, pers: e.pers, role: e.role, alive: true, gid: e.gid })), detail: [], ...override,
  };
  return settle(s, result, rngFrom(71), roster);
}
const withoutRequests = (s: SaveData) => { const c = structuredClone(s); c.guild.reqs.list = []; return c; };

describe('부탁 완료 전투 경험치 2배', () => {
  it('부탁한 출전 길드원만 정확히 2배, 다른 출전자·대기·후원·명성은 그대로', () => {
    const s = setup(), control = withoutRequests(s), base = run(control), out = run(s);
    expect(out.jobs!.reqs).toEqual([s.guild.members[0].nick]);
    expect(out.guild!.members[0].xp).toBe(base.guild!.members[0].xp * 2);
    expect(s.guild.members[0].xp).toBe(control.guild.members[0].xp * 2);
    expect(out.guild!.members[1].xp).toBe(base.guild!.members[1].xp);
    expect(s.guild.members.slice(1)).toEqual(control.guild.members.slice(1));
    expect(out.guild!.rest).toBe(base.guild!.rest);
    expect(out.guild!.boosted).toEqual(base.guild!.boosted);
    expect(s.guild.members[0].boost).toBe(5); // 출전 중 후원은 소모하지 않음
    expect(s.guild.members[3].boost).toBe(4);
    expect(s.guild.reqs.list.map(q => q.done)).toEqual([true, false]);
    expect(out.jobs!.fame).toBe(0);
    expect(s.guild.fame).toBe(control.guild.fame);

    const nextControl = withoutRequests(s), nextBase = run(nextControl), next = run(s);
    expect(next.jobs!.reqs).toEqual([]);
    expect(next.guild!.members[0].xp).toBe(nextBase.guild!.members[0].xp);
    expect(s.guild.members).toEqual(nextControl.guild.members);
  });

  it.each([
    ['다른 장소', { content: 'plateau' }],
    ['낮은 난이도', { diff: '쉬움' }],
    ['패배', { win: false }],
    ['포기', { win: false, quit: true }],
  ] as const)('%s에서는 완료와 경험치 배수 없음', (_name, override) => {
    const s = setup(), control = withoutRequests(s), base = run(control, override), out = run(s, override);
    expect(out.jobs!.reqs).toEqual([]);
    expect(s.guild.reqs.list.every(q => !q.done)).toBe(true);
    expect(out.guild).toEqual(base.guild);
    expect(s.guild.members).toEqual(control.guild.members);
  });

  it('요청자를 편성하지 않으면 완료되지 않고, 높은 난이도에서도 완료한 사람마다 2배', () => {
    const s = setup(), control = withoutRequests(s);
    expect(run(s, {}, [1, 3]).jobs!.reqs).toEqual([]);
    run(control, {}, [1, 3]);
    const base = run(control, { diff: '어려움' }, [0, 2]), out = run(s, { diff: '어려움' }, [0, 2]);
    expect(out.jobs!.reqs).toEqual([s.guild.members[0].nick, s.guild.members[2].nick]);
    out.guild!.members.forEach((m, i) => expect(m.xp).toBe(base.guild!.members[i].xp * 2));
  });

  it('보너스로 발생한 레벨업·능력치 상승·스킬 성장을 같은 정산에 반영', () => {
    const s = setup(), m = s.guild.members[0];
    m.lv = 19; m.sxp = 0.95;
    for (const key of Object.keys(m.stats) as (keyof typeof m.stats)[]) m.stats[key] = 5;
    const probe = run(withoutRequests(s)).guild!.members[0].xp;
    m.xp = xpToNext(19) - Math.floor(probe * 1.5);
    const control = withoutRequests(s), base = run(control), out = run(s);
    expect(base.guild!.members[0].ups).toEqual([]);
    expect(out.guild!.members[0].ups).toEqual([20]);
    expect(m.xp).toBe(probe * 2 - Math.floor(probe * 1.5));
    expect(out.guild!.members[0].stats).toHaveLength(1);
    expect(m.lastStatGains).toEqual([out.guild!.members[0].stats[0].k]);
    expect(memberSkillLevel(m)).toBe(2);
  });

  it('내 레벨 상한은 유지하고 다음 레벨 직전까지만 저장', () => {
    const s = setup(), m = s.guild.members[0];
    m.lv = 40; m.xp = xpToNext(40) - 2;
    const out = run(s);
    expect(out.jobs!.reqs).toEqual([m.nick]);
    expect(out.guild!.members[0].ups).toEqual([]);
    expect(m.lv).toBe(40);
    expect(m.xp).toBe(xpToNext(40) - 1);
  });
});
