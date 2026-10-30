// 파티원 대사 세 언어 (기획 121 3단계 ⑥-3): 공통 940 · 역할 392 · 직업 683줄과 성격 대사 가운데 성격 신호 상황 (BarkSit, 엔진 bark 사건) · personalities.ts barks · 인사 · 출발 · 실수 줄이
// 영어 · 일본어 사전 (talk-*.ts) 에 다 있고, 자리표시가 같고, 한국어가 남지 않는다. 성격 신호 줄이 없으면 엔진 bark 글 (한국어) 이 그대로 떴다.
// 영어 · 일본어에서는 번역 있는 대사만 고른다 (hasTalk → pickLine의 ok): 성격 줄에 번역이 없으면 직업 · 역할 · 공통 대사로 내려간다. 나머지 성격 상황은 자주 나오는 것부터 묶음마다 (121 3장 ⑥-3c).
import { afterAll, describe, expect, it } from 'vitest';
import { CLASS_LINES, COMMON_LINES, PERS_LINES, pickLine, ROLE_LINES, SITS, type TalkSit } from '../src/data/talk';
import { NICKS, PERS } from '../src/data/personalities';
import * as E from '../src/engine';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import { createTalk } from '../src/battle/talk';

/** 로스터 없이 만든 시험 전투는 프로토타입용 옛 닉네임 28개를 쓰므로 그 이름은 한국어여도 됨 (게임은 1000명 목록에서 뽑아 nickOf가 바꿈) */
const oldNicks = new RegExp(NICKS.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
import enTalk from '../src/i18n/talk-en';
import jaTalk from '../src/i18n/talk-ja';
import { hasTalk, setLang, talkOf } from '../src/i18n';

const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
/** 성격 대사 가운데 번역이 있어야 하는 상황: 엔진 bark 사건의 상황 (BarkSit, sits.ts 와 같은 목록) + 인사 · 출발 · 깔끔 승리 · 강타 · 체력 25% · 10% · 구출 · 악몽 출발 · 광역 예고 · 동료 · 탱커 쓰러짐 · 패배 · 보스 출발 · 치유 · 크게 맞음 · 파티 위험 · 딜 1등 · 강타 버팀 · 아슬 · 힐 없음 · 힐러 위험 · 잡몹 · 긴 디버프 · 힐러 쓰러짐 (⑥-3c 1 ~ 4묶음) */
const BARK_SITS = ['mistake', 'dodge', 'stubborn', 'brave', 'wrongStep', 'noEscape', 'lateDodge', 'wrongDodge', 'tankLost', 'whiff', 'skillFumble', 'spaceOut', 'reel', 'clump', 'coverCut', 'alone', 'standIn', 'regroup',
  'aggroHold', 'aggroIgnore', 'aggroAdds', 'aggroPanic', 'aggroLost', 'flee', 'shelter', 'sulk', 'thanks', 'revived', 'slowMove', 'follow', 'wander', 'luckLost', 'luckBack', 'cover', 'selfish', 'cheer', 'rival', 'rage', 'calmStep',
  'optimist', 'pessimist', 'panic', 'panicEnd', 'allIn', 'tired', 'warmUp', 'focusBroken', 'shaken', 'learned', 'hoardUse', 'spamUse', 'cutTry', 'addHunt', 'oneTrack', 'preGuard', 'clutchOk', 'clutchLate', 'gather', 'aggroSlip', 'selfCare',
  'aggroSteal', 'aggroEase', 'aggroWarn', 'aggroRegain', 'aggroHealer', 'aggroLevel', 'foresee', 'foreseeWrong', 'hop', 'endure', 'edgeStep', 'freeze', 'buddyUp', 'yieldStep', 'homeBack', 'mentor', 'moodUp', 'praise', 'repay', 'envy', 'cry',
  'bounce', 'relief', 'windUp', 'vent', 'burst', 'breather', 'timing', 'gritMax', 'aggroHealerHigh', 'aggroDealerHigh', 'aggroStealHigh'] as const satisfies readonly TalkSit[];
const PERS_SITS_DONE: TalkSit[] = [...BARK_SITS, 'hello', 'go', 'winClean', 'buster', 'low25', 'low10', 'saved', 'pullNightmare', 'aoeWarn', 'allyDown', 'tankDown', 'lose',
  'pullBoss', 'healed', 'hurtBig', 'partyLow', 'meterTop', 'busterOk', 'clutch', 'noHeal', 'healerLow', 'pullTrash', 'debLong', 'loseHealer',
  'idle', 'lastMob', 'pullRaid', 'gauge', 'hotOn', 'healCut', 'boss5', 'pullElite', 'aoeHit', 'boss20', 'dispelled', 'boss50', 'raidCd',
  'noDps', 'guardOn', 'mobDown', 'pulled', 'enraged', 'quakeWarn', 'jealous', 'zoneHit', 'debPoison', 'soulOn', 'low50', 'noTank',
  'debDisease', 'phase', 'lastStand', 'cured', 'linkOn', 'debMagic', 'trapMark', 'fullHp', 'fullMark', 'manaEmpty', 'adds', 'maxCut',
  'selfDown', 'groupHeal', 'staggerStart', 'bomb', 'safeCall', 'addDown', 'daze', 'staggerWin', 'drainAdd', 'linkShare', 'orderStart', 'invertOn',
  'win', 'allFull', 'bigHeal', 'jailed', 'manaLow', 'offTank', 'swarm', 'debCurse', 'vesselOn', 'pylon', 'padsCall', 'padGo',
  'retry', 'loseClose', 'pullHard', 'winClose', 'guildGo', 'guildSaved', 'guildFirst', 'dodgeOk', 'longFight', 'enrageSoon', 'guildTame', 'allyRevived', 'sulkEnd', 'fleeBack',
  'abDef', 'shieldOn', 'abAtk', 'healCrit', 'aheal', 'fixate', 'charmed', 'watchOn', 'overheal', 'abCtl', 'zoneStand', 'abHeal', 'pullEasy', 'counterOk', 'overMark', 'addOnMe'];

describe('파티원 대사 사전', () => {
  afterAll(async () => { await setLang('ko'); });
  for (const [lang, d] of [['en', enTalk], ['ja', jaTalk]] as const) {
    it(`${lang}: 공통 · 역할 · 직업 대사 모두 번역이 있고 자리표시가 같고 한국어 · 빈 글이 없다`, () => {
      const miss: string[] = [];
      for (const g of [COMMON_LINES, ...Object.values(ROLE_LINES), ...Object.values(CLASS_LINES)]) for (const lines of Object.values(g)) for (const l of lines ?? []) if (!(l in d)) miss.push(l);
      for (const [pers, lines] of Object.entries(PERS_LINES)) for (const sit of PERS_SITS_DONE) for (const l of lines[sit] ?? []) if (!(l in d)) miss.push(`${pers}.${sit}: ${l}`);
      for (const [pers, p] of Object.entries(PERS)) for (const b of p.barks ?? []) if (!(b in d)) miss.push(`${pers} bark: ${b}`);
      expect(miss).toEqual([]);
      for (const [k, v] of Object.entries(d)) { expect(v, k).not.toBe(''); expect(v, k).not.toMatch(/[가-힣]/); expect(slots(v), `${k} → ${v}`).toBe(slots(k)); }
    });
  }
  it('en: 모든 장소 악몽을 자동 힐러로 90초 돌린 말풍선 (엔진 bark 사건의 성격 한마디 포함) 에 한국어가 없다', async () => {
    await setLang('en');
    const seeded = (x: number) => () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const bad: string[] = []; let n = 0;
    for (const enc of Object.keys(ENCOUNTERS) as EncounterKey[]) {
      const f = E.create({ encounter: enc, diff: '악몽', seed: 3, stageLv: 60, heroLv: 60 });
      const talk = createTalk(seeded(enc.length * 31 + 7));
      talk.start(f, { seg: 0, segN: 1, affix: false, chal: false }, 0);
      while (!f.over && f.t < 90) {
        E.autoHealer(f); E.step(f);
        for (const b of talk.frame(f, f.t * 1000, { pulling: false, paused: false })) { n++; if (/[가-힣]/.test(b.text.replace(oldNicks, ''))) bad.push(`${enc} ${b.sit}: ${b.text}`); }
        f.events.length = 0;
      }
    }
    expect(n).toBeGreaterThan(500);
    expect([...new Set(bad)].slice(0, 20)).toEqual([]);
  });
  it('영어 · 일본어에서는 번역 있는 대사만: 모든 상황에서 공통 대사까지 내려가고, 한국어는 그대로', async () => {
    await setLang('ko');
    const rand = () => 0.37;
    const spk = { pers: '신중파', cls: 'warrior', role: 'tank' } as const;
    expect(hasTalk('ㅎㅇ')).toBe(true); expect(hasTalk('번역 없는 대사')).toBe(true); expect(talkOf('ㅎㅇ')).toBe('ㅎㅇ');
    await setLang('en');
    expect(hasTalk('ㅎㅇ')).toBe(true); expect(hasTalk('번역 없는 대사')).toBe(false); expect(talkOf('ㅎㅇ')).toBe('hi'); expect(talkOf('{ally} 어서 와')).toBe('welcome back {ally}');
    for (const sit of Object.keys(SITS) as TalkSit[]) {
      const line = pickLine(sit, spk, rand, new Set(), hasTalk);
      if (!COMMON_LINES[sit]?.length) continue;
      expect(line, sit).not.toBeNull();
      expect(hasTalk(line!), `${sit}: ${line}`).toBe(true);
      expect(talkOf(line!), `${sit}: ${line}`).not.toMatch(/[가-힣]/);
    }
    await setLang('ja');
    expect(talkOf('ㅎㅇ')).toBe('よろ');
    expect(talkOf('도발 ㄱ!')).toBe('挑発いく！');
    expect(talkOf('{boss} 멀리서 쏜다')).toBe('{boss} 遠くから撃つ');
  });
});
