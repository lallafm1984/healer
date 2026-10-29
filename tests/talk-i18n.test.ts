// 파티원 대사 세 언어 (기획 121 3단계 ⑥-3): 공통 940 · 역할 392 · 직업 683줄이 영어 · 일본어 사전 (talk-*.ts) 에 다 있고, 자리표시가 같고, 한국어가 남지 않는다.
// 영어 · 일본어에서는 번역 있는 대사만 고른다 (hasTalk → pickLine의 ok): 성격 줄에 번역이 없으면 직업 · 역할 · 공통 대사로 내려간다.
import { afterAll, describe, expect, it } from 'vitest';
import { CLASS_LINES, COMMON_LINES, pickLine, ROLE_LINES, SITS, type TalkSit } from '../src/data/talk';
import enTalk from '../src/i18n/talk-en';
import jaTalk from '../src/i18n/talk-ja';
import { hasTalk, setLang, talkOf } from '../src/i18n';

const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

describe('파티원 대사 사전', () => {
  afterAll(async () => { await setLang('ko'); });
  for (const [lang, d] of [['en', enTalk], ['ja', jaTalk]] as const) {
    it(`${lang}: 공통 · 역할 · 직업 대사 모두 번역이 있고 자리표시가 같고 한국어 · 빈 글이 없다`, () => {
      const miss: string[] = [];
      for (const g of [COMMON_LINES, ...Object.values(ROLE_LINES), ...Object.values(CLASS_LINES)]) for (const lines of Object.values(g)) for (const l of lines ?? []) if (!(l in d)) miss.push(l);
      expect(miss).toEqual([]);
      for (const [k, v] of Object.entries(d)) { expect(v, k).not.toBe(''); expect(v, k).not.toMatch(/[가-힣]/); expect(slots(v), `${k} → ${v}`).toBe(slots(k)); }
    });
  }
  it('영어 · 일본어에서는 번역 있는 대사만: 모든 상황에서 공통 대사까지 내려가고, 한국어는 그대로', async () => {
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
