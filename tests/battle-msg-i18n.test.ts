// 엔진 알림 글 세 언어 (기획 121 3단계 ⑥-2): 모든 장소 악몽을 자동 힐러로 90초 돌려 나온 알림 글 (msg) 이 모두 틀 (k) 을 갖고,
// 영어 · 일본어로 채우면 (battle/core.ts msgParams: 닉네임 nickOf · 이름 t()) 한국어가 남지 않는다. 한국어 글은 text 그대로 (시뮬 · 한국어 화면).
import { afterAll, describe, expect, it } from 'vitest';
import * as E from '../src/engine';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import { msgParams } from '../src/battle/core';
import { setLang, t } from '../src/i18n';
import { NICKS } from '../src/data/personalities';

/** 로스터 없이 만든 시험 전투는 프로토타입용 옛 닉네임 28개 (personalities NICKS) 를 쓰므로 그 이름은 한국어여도 됨 (게임은 1000명 목록에서 뽑아 nickOf가 바꿈) */
const oldNicks = new RegExp(NICKS.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

function collect(): { k?: string; p?: Record<string, string | number>; text: string; enc: string }[] {
  const out: { k?: string; p?: Record<string, string | number>; text: string; enc: string }[] = [];
  for (const enc of Object.keys(ENCOUNTERS) as EncounterKey[]) {
    const f = E.create({ encounter: enc, diff: '악몽', seed: 3, stageLv: 60, heroLv: 60 });
    while (!f.over && f.t < 90) {
      E.autoHealer(f); E.step(f);
      for (const ev of f.events) if (ev.type === 'msg') out.push({ k: ev.k, p: ev.p, text: ev.text, enc });
      f.events.length = 0;
    }
  }
  return out;
}

describe('엔진 알림 글 세 언어', () => {
  const msgs = collect();
  afterAll(async () => { await setLang('ko'); });
  it('알림 글이 수천 개 나오고 모두 틀 (k) 을 가짐, 한국어 글 = 틀을 채운 글', () => {
    expect(msgs.length).toBeGreaterThan(500);
    const raw = msgs.filter(m => !m.k);
    expect(raw.map(m => `${m.enc}: ${m.text}`).slice(0, 10)).toEqual([]);
    for (const m of msgs) expect(t(m.k!, m.p)).toBe(m.text);
  });
  for (const lang of ['en', 'ja'] as const) {
    it(`${lang}: 채운 알림 글에 한국어가 없다`, async () => {
      await setLang(lang);
      const bad = [...new Set(msgs.map(m => t(m.k!, msgParams(m.p)).replace(oldNicks, '')).filter(s => /[가-힣]/.test(s)))];
      expect(bad.slice(0, 20)).toEqual([]);
    });
  }
});
